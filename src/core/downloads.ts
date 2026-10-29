import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { downloadFormats, type DownloadJob, type DownloadRequest } from '../shared/types';
import { defaults } from '../shared/capabilities';
import { publish } from './files';
import { Cancelled, run } from './process';
import { Engines } from './engines';

export function validateDownload(value: unknown): DownloadRequest {
  if (!value || typeof value !== 'object') throw new Error('Enter a public video or audio link.');
  const r = value as DownloadRequest;
  if (Object.keys(r).some(k => !['url', 'kind', 'format', 'quality'].includes(k)) ||
    !['Video', 'Audio'].includes(r.kind) || !downloadFormats[r.kind]?.includes(r.format as never) ||
    !['best', '1080', '720', '480'].includes(r.quality) || typeof r.url !== 'string' || r.url.length > 4096) throw new Error('Invalid download settings.');
  let url: URL;
  try { url = new URL(r.url.trim()); } catch { throw new Error('Enter a complete https:// or http:// link.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.') || url.port && !['80', '443'].includes(url.port)) throw new Error('Use a public HTTP or HTTPS link without credentials or a custom port.');
  if (isIP(url.hostname.replace(/^\[|\]$/g, '')) && !publicAddress(url.hostname)) throw new Error('Private network links are not supported.');
  url.hash = '';
  return { url: url.href, kind: r.kind, format: r.format, quality: r.quality };
}
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0) || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19].includes(b));
  }
  // Only global unicast IPv6, excluding transition mechanisms that embed IPv4.
  return isIP(address) === 6 && /^2[0-9a-f]{3}:/i.test(address) && !/^(?:2002:|2001:(?:0*:|db8:))/i.test(address);
}
export function downloadName(title: string): string {
  let name = title.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_').replace(/[. ]+$/g, '').slice(0, 120).replace(/[. ]+$/g, '');
  if (!name || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) name = `Download_${name || 'media'}`;
  return name;
}
export class Downloads extends EventEmitter {
  private jobs: DownloadJob[] = [];
  private controller?: AbortController;
  private active = false;
  private closing = false;
  constructor(private engines: Engines, private destination: () => string) { super(); }
  get busy() { return this.active; }
  snapshot() { return this.jobs.map(j => ({ ...j })); }
  get(id: unknown) { const job = this.jobs.find(j => typeof id === 'string' && j.id === id); if (!job) throw new Error('Download no longer exists.'); return job; }
  private changed() { this.emit('jobs', this.snapshot()); }
  async available() { return Promise.all(['yt-dlp/yt-dlp.exe', 'deno/deno.exe'].map(p => access(join(this.engines.root, p)))).then(() => true, () => false); }
  async add(value: unknown) {
    if (this.closing || this.jobs.length >= 50) throw new Error('Remove finished downloads before adding more (limit 50).');
    const request = validateDownload(value);
    if (!await this.available()) throw new Error('Download tools are missing. Reinstall the full app.');
    if (this.closing || this.jobs.length >= 50) throw new Error('Download queue is full or closing.');
    // DNS is checked at execution too, since queued links may wait before use.
    this.jobs.push({ ...request, id: randomUUID(), name: new URL(request.url).hostname, status: 'queued' });
    this.changed(); void this.pump();
  }
  cancel(id: unknown) {
    const j = this.get(id);
    if (j.status === 'running') { j.message = 'Cancelling…'; this.controller?.abort(); }
    else if (j.status === 'queued') j.status = 'cancelled';
    this.changed();
  }
  retry(id: unknown) {
    const j = this.get(id);
    if (this.closing || !['failed', 'cancelled'].includes(j.status)) throw new Error('Only failed or cancelled downloads can be retried.');
    j.status = 'queued'; j.message = undefined; j.progress = undefined; this.changed(); void this.pump();
  }
  remove(id: unknown) { const j = this.get(id); if (['running', 'queued'].includes(j.status)) throw new Error('Cancel this download first.'); this.jobs = this.jobs.filter(v => v !== j); this.changed(); }
  async close() {
    this.closing = true; for (const j of this.jobs) if (j.status === 'queued') j.status = 'cancelled';
    if (!this.active) return;
    const idle = new Promise<void>(resolve => this.once('idle', resolve)); this.controller?.abort(); await idle;
  }
  private async pump() {
    if (this.active || this.closing) return;
    this.active = true;
    try {
      while (!this.closing) {
        const job = this.jobs.find(j => j.status === 'queued');
        if (!job) break;
        this.controller = new AbortController(); const signal = this.controller.signal;
        job.status = 'running'; job.message = 'Connecting…'; this.changed();
        let dir: string | undefined;
        try {
          const addresses = await lookup(new URL(job.url).hostname, { all: true });
          if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error('This link resolves to a private or unsupported network address.');
          if (signal.aborted) throw new Cancelled();
          dir = await mkdtemp(join(tmpdir(), 'aio-download-'));
          const video = job.quality === 'best' ? 'bv*+ba/b' : `bv*[height<=?${job.quality}]+ba/b[height<=?${job.quality}]`;
          await run(join(this.engines.root, 'yt-dlp/yt-dlp.exe'), [
            '--ignore-config', '--no-plugin-dirs', '--no-update', '--no-remote-components', '--no-simulate', '--no-cache-dir', '--no-playlist', '--playlist-items', '1', '--no-colors', '--newline', '--no-warnings',
            '--socket-timeout', '20', '--retries', '3', '--fragment-retries', '3', '--max-filesize', '10G', '--match-filters', '!is_live',
            '--js-runtimes', `deno:${join(this.engines.root, 'deno/deno.exe')}`, '--ffmpeg-location', join(this.engines.root, 'ffmpeg/bin'),
            '--format', job.kind === 'Audio' ? 'ba/b' : video, '--merge-output-format', 'mkv', '--no-write-thumbnail', '--no-write-info-json',
            '--print', 'before_dl:AIO_TITLE:%(title)j', '--progress', '--progress-template', 'download:AIO_PROGRESS:%(progress._percent_str)s',
            '--output', join(dir, 'source.%(ext)s'), '--', job.url
          ], { signal }, { cwd: dir, timeout: 2 * 60 * 60 * 1000, onLine: line => {
            if (line.startsWith('AIO_TITLE:')) { try { const title = JSON.parse(line.slice(10)); if (typeof title === 'string') job.name = downloadName(title); } catch {} }
            if (line.startsWith('AIO_PROGRESS:')) { const p = Number.parseFloat(line.slice(13)); if (Number.isFinite(p)) job.progress = Math.min(79, Math.round(p * .79)); }
            job.message = 'Downloading…'; this.changed();
          } });
          const files = (await readdir(dir)).filter(n => /^source\.[a-zA-Z0-9]+$/.test(n));
          if (files.length !== 1) throw new Error('No complete media file was returned. Try a direct video link.');
          job.message = `Converting to ${job.format.toUpperCase()}…`; job.progress = 80; this.changed();
          const input = join(dir, files[0]);
          const options = { ...defaults };
          if (job.kind === 'Video' && job.quality !== 'best') {
            const probe = JSON.parse(await run(join(this.engines.root, 'ffmpeg/bin/ffprobe.exe'), ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-of', 'json', input], { signal }));
            if (probe.streams?.some((s: { codec_type: string; height: number }) => s.codec_type === 'video' && s.height > Number(job.quality))) options.height = Number(job.quality);
          }
          const result = await this.engines.convert({ id: `download:${job.format}`, input: 'media', output: job.format, engine: 'ffmpeg', family: job.kind }, input, join(dir, 'converted'), options, { signal, onProgress: p => { job.progress = Math.round(80 + p * .19); this.changed(); } });
          job.outputPath = await publish(result.path, this.destination(), `${downloadName(job.name)}.${job.format}`, false, signal);
          job.status = 'completed'; job.progress = 100; job.message = undefined;
        } catch (error) {
          job.status = signal.aborted || error instanceof Cancelled ? 'cancelled' : 'failed';
          job.message = job.status === 'cancelled' ? undefined : `${(error as Error).message.slice(-2500)}\nTry another public link. Private, live, DRM and sign-in-only media are not supported.`;
        } finally { if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {}); this.changed(); }
      }
    } finally { this.active = false; this.controller = undefined; this.emit('idle'); }
  }
}
