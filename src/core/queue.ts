import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { capability, defaults, lossWarning, targets } from '../shared/capabilities';
import type { ConversionJob, ConversionOptions } from '../shared/types';
import { validateOptions } from '../shared/capabilities';
import { Engines } from './engines';
import { identify, publish } from './files';
import { Cancelled } from './process';

interface PrivateJob { view: ConversionJob; source: string; mtime: number; }
export class Queue extends EventEmitter {
  private entries: PrivateJob[] = [];
  private active?: { id: string; controller: AbortController };
  private pumping = false;
  private closing = false;
  constructor(readonly engines: Engines, readonly destination: () => string) { super(); }
  snapshot() { return structuredClone(this.entries.map(e => e.view)); }
  changed() { this.emit('jobs', { jobs: this.snapshot() }); }
  get(id: string) {
    if (typeof id !== 'string') throw new Error('Invalid job ID.');
    const entry = this.entries.find(e => e.view.id === id); if (!entry) throw new Error('File is no longer in the queue.'); return entry;
  }
  async add(paths: unknown) {
    if (!Array.isArray(paths) || paths.length > 500 || paths.some(p => typeof p !== 'string' || p.length > 32767)) throw new Error('Choose up to 500 files at a time.');
    const available = new Set((await this.engines.status()).filter(e => e.available).map(e => e.id));
    const errors: string[] = [];
    for (const path of paths as string[]) {
      try {
        const file = await identify(path);
        const validTargets = targets(file.ext).filter(t => available.has(capability(file.ext, t).engine));
        if (!validTargets.length) throw new Error('Required conversion engine is missing. Reinstall AIO Converter.');
        const target = validTargets.includes('png') ? 'png' : validTargets.includes('mp4') ? 'mp4' : validTargets.includes('mp3') ? 'mp3' : validTargets.includes('pdf') ? 'pdf' : validTargets[0];
        this.entries.push({ source: file.path, mtime: file.mtime, view: { id: randomUUID(), name: basename(path), extension: file.ext, size: file.size, family: capability(file.ext, target).family, targets: validTargets, target, options: { ...defaults }, status: 'ready' } });
      } catch (error) { errors.push(`${basename(path)}: ${(error as Error).message}`); }
    }
    this.changed();
    if (errors.length) throw new Error(`${errors.length} file(s) could not be added:\n${errors.slice(0, 8).join('\n')}`);
    return this.snapshot();
  }
  configure(id: string, target: string, options: unknown) {
    const { view } = this.get(id);
    if (['queued', 'running', 'completed'].includes(view.status)) throw new Error('Only idle files can be configured.');
    if (!view.targets.includes(target)) throw new Error('Target format is not supported for this file.');
    const validated = validateOptions(options); capability(view.extension, target);
    view.target = target; view.options = validated;
    view.family = capability(view.extension, target).family;
    if (['failed', 'cancelled'].includes(view.status)) view.status = 'ready';
    view.message = undefined; this.changed();
  }
  start() {
    if (this.closing) throw new Error('Application is closing.');
    const ready = this.entries.filter(e => e.view.status === 'ready');
    for (const { view } of ready) if (lossWarning(view.extension, view.target) && !view.options.acknowledgeLoss) throw new Error(`Review format warning for ${view.name} before converting.`);
    for (const { view } of ready) view.status = 'queued';
    this.changed(); void this.pump();
  }
  cancel(id: string) {
    const { view } = this.get(id);
    if (view.status === 'running') { this.active?.controller.abort(); view.message = 'Cancelling…'; }
    else if (['queued', 'ready'].includes(view.status)) { view.status = 'cancelled'; view.message = undefined; }
    this.changed();
  }
  retry(id: string) {
    const { view } = this.get(id);
    if (!['cancelled', 'failed'].includes(view.status)) throw new Error('Only failed or cancelled files can be retried.');
    view.status = 'ready'; view.progress = undefined; view.message = undefined; this.changed();
  }
  remove(id: string) {
    const { view } = this.get(id);
    if (['running', 'queued'].includes(view.status)) throw new Error('Cancel this file before removing it.');
    this.entries = this.entries.filter(e => e.view.id !== id); this.changed();
  }
  clearCompleted() { this.entries = this.entries.filter(e => e.view.status !== 'completed'); this.changed(); }
  get busy() { return this.pumping; }
  async close() {
    this.closing = true;
    for (const entry of this.entries) if (entry.view.status === 'queued') entry.view.status = 'cancelled';
    this.active?.controller.abort();
    if (this.pumping) await new Promise<void>(resolve => this.once('idle', resolve));
  }
  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      let entry: PrivateJob | undefined;
      while (!this.closing && (entry = this.entries.find(e => e.view.status === 'queued'))) {
        const { view, source, mtime } = entry;
        const controller = new AbortController(); this.active = { id: view.id, controller };
        view.status = 'running'; view.progress = undefined; view.message = undefined; this.changed();
        let temporary: string | undefined;
        try {
          const current = await identify(source);
          if (current.mtime !== mtime || current.size !== view.size) throw new Error('Source file changed after import. Remove it and add it again.');
          temporary = await mkdtemp(join(tmpdir(), 'aio-convert-'));
          const result = await this.engines.convert(capability(view.extension, view.target), source, temporary, view.options, { signal: controller.signal, onProgress: value => { view.progress = Math.round(value); this.changed(); } });
          if (controller.signal.aborted) throw new Cancelled();
          const stem = view.name.replace(/\.(?:tar\.gz|[^.]+)$/i, '');
          const name = result.folder ? `${stem} - ${view.target.toUpperCase()} pages` : `${stem}.${view.target}`;
          view.outputPath = await publish(result.path, this.destination(), name, result.folder, controller.signal);
          view.status = 'completed'; view.progress = 100;
        } catch (error) {
          view.status = error instanceof Cancelled ? 'cancelled' : 'failed';
          view.message = error instanceof Cancelled ? undefined : (error as Error).message.slice(0, 1800);
          view.progress = undefined;
        } finally {
          if (temporary) await rm(temporary, { recursive: true, force: true }).catch(() => {});
          this.active = undefined; this.changed();
        }
      }
    } finally { this.pumping = false; this.emit('idle'); }
  }
}
