import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Downloads } from '../src/core/downloads';
import { Engines } from '../src/core/engines';
import { run } from '../src/core/process';
import type { DownloadJob } from '../src/shared/types';

const engines = new Engines(resolve(process.env.AIO_ENGINE_ROOT ?? 'vendor'));
const destination = resolve('output/download-check'); await mkdir(destination, { recursive: true });
const queue = new Downloads(engines, () => destination);
const urls = process.argv.slice(2);
const report: { checks: string[]; results: DownloadJob[] } = { checks: [], results: [] };
const source = urls[0] ?? 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4';
async function wait() { if (queue.busy) await new Promise<void>(res => queue.once('idle', res)); }
try {
  await queue.add({ url: 'https://example.com/aio-missing-media.mp4', kind: 'Video', format: 'mp4', quality: '720' });
  for (const format of ['mp4', 'mp3']) {
    await queue.add({ url: source, kind: format === 'mp3' ? 'Audio' : 'Video', format, quality: '720' }); await wait();
    const j = queue.snapshot().at(-1)!; report.results.push(j); assert.equal(j.status, 'completed', j.message);
    const metadata = JSON.parse(await run(resolve(engines.root, 'ffmpeg/bin/ffprobe.exe'), ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', j.outputPath!], { signal: new AbortController().signal }));
    assert.ok(Number(metadata.format.duration) > 0); assert.ok(metadata.streams.some((s: { codec_type: string }) => s.codec_type === (format === 'mp3' ? 'audio' : 'video'))); assert.ok((await readFile(j.outputPath!)).length > 0);
    if (format === 'mp4') assert.ok(metadata.streams.filter((s: { codec_type: string }) => s.codec_type === 'video').every((s: { height: number }) => s.height <= 720));
    report.checks.push(`Real public link → ${format.toUpperCase()}, readable stream and duration verified`);
  }
  assert.equal(queue.snapshot()[0].status, 'failed'); report.checks.push('Failed link does not block the next queued download');
  const cancelStarted = (jobs: DownloadJob[]) => { const j = jobs.at(-1)!; if (j.status === 'running' && j.message === 'Downloading…') { queue.off('jobs', cancelStarted); queue.cancel(j.id); } };
  queue.on('jobs', cancelStarted);
  await queue.add({ url: source, kind: 'Video', format: 'mp4', quality: '720' }); await wait(); queue.off('jobs', cancelStarted);
  const cancelled = queue.snapshot().at(-1)!; assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.outputPath, undefined); report.checks.push('Cancel removes incomplete output');
  queue.retry(cancelled.id); await wait(); assert.equal(queue.snapshot().at(-1)!.status, 'completed'); report.checks.push('Retry completes and preserves duplicate outputs');
} finally { await queue.close(); await writeFile(`output/download-${source.includes('youtube.com') ? 'youtube' : 'direct'}-test-results.json`, JSON.stringify(report, null, 2)); }
console.log(report.checks.join('\n'));
