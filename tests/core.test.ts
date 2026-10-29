import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { capability, capabilities, defaults, extension, validateOptions } from '../src/shared/capabilities';
import { identify, publish, safeEntry, inspectExtracted } from '../src/core/files';
import { Engines } from '../src/core/engines';
import { Queue } from '../src/core/queue';
import { Cancelled, run, type RunContext } from '../src/core/process';
import type { ConversionCapability, ConversionOptions } from '../src/shared/types';

test('capabilities are unique, directional, and exclusions stay excluded', () => {
  assert.equal(new Set(capabilities.map(c => c.id)).size, capabilities.length);
  assert.equal(extension('PHOTO.JPEG'), 'jpg'); assert.equal(extension('backup.TAR.GZ'), 'tar.gz'); assert.equal(extension('backup.tgz'), 'tar.gz');
  assert.equal(capability('pdf', 'txt').engine, 'poppler'); assert.equal(capability('docx', 'epub').engine, 'pandoc');
  assert.throws(() => capability('pdf', 'docx')); assert.throws(() => capability('zip', 'rar'));
});
test('options reject unknown shapes and dangerous dimensions', () => {
  for (const bad of [null, {}, { ...defaults, quality: NaN }, { ...defaults, width: -1 }, { ...defaults, height: 1.5 }, { ...defaults, bitrate: 999 }, { ...defaults, acknowledgeLoss: 'yes' }]) assert.throws(() => validateOptions(bad));
  assert.equal(validateOptions({ ...defaults, width: 1200 }).width, 1200);
});
test('archive paths reject traversal, streams and Windows device names', () => {
  for (const path of ['../x', 'a/../../x', 'C:\\secret', '\\\\server\\x', '/etc/x', 'a:b', 'NUL.txt', 'a/CON', 'x. /a', 'a\nPath = x', 'folder./x']) assert.throws(() => safeEntry(path), path);
  for (const path of ['readme.txt', 'photos/a.png', 'a\\b.txt', '日本語/file.txt']) safeEntry(path);
});
test('publication preserves existing files and input contents', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-test-'));
  try {
    const input = join(dir, 'input.txt'); await writeFile(input, 'original');
    const dest = join(dir, 'output'); await mkdir(dest); await writeFile(join(dest, 'input.txt'), 'existing');
    const result = await publish(input, dest, 'input.txt', false);
    assert.equal(await readFile(result, 'utf8'), 'original'); assert.match(result, /input \(1\)\.txt$/);
    assert.equal(await readFile(join(dest, 'input.txt'), 'utf8'), 'existing'); assert.equal(await readFile(input, 'utf8'), 'original');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('cancellation during publication removes staging and leaves no completed output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-test-'));
  try {
    const input = join(dir, 'input.txt'); await writeFile(input, Buffer.alloc(1024 * 1024, 65));
    const destination = join(dir, 'output'); const controller = new AbortController();
    const publishing = publish(input, destination, 'result.txt', false, controller.signal);
    const rejected = assert.rejects(publishing, Cancelled); controller.abort(); await rejected;
    assert.deepEqual(await readdir(destination), []); assert.equal((await readFile(input)).length, 1024 * 1024);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('file identification rejects corrupt and executable masquerades', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-test-'));
  try {
    const file = join(dir, 'fake.png'); await writeFile(file, 'MZpretend'); await assert.rejects(identify(file), /match/);
    await writeFile(file, ''); await assert.rejects(identify(file), /empty/);
    await writeFile(join(dir, 'file.unknown'), 'text'); await assert.rejects(identify(join(dir, 'file.unknown')), /Unsupported/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
class StubEngines extends Engines {
  constructor(readonly behavior: 'fail-first' | 'wait') { super(''); }
  count = 0;
  override async status() { return [{ id: 'libreoffice' as const, available: true }]; }
  override async convert(_c: ConversionCapability, _input: string, dir: string, _options: ConversionOptions, context: RunContext) {
    this.count++;
    if (this.behavior === 'wait') await new Promise<void>((_resolve, reject) => context.signal.addEventListener('abort', () => reject(new Cancelled()), { once: true }));
    if (this.behavior === 'fail-first' && this.count === 1) throw new Error('test engine failure');
    const path = join(dir, 'result.pdf'); await writeFile(path, '%PDF-converted'); return { path, folder: false };
  }
}
test('queue isolates failures and continues next file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-test-'));
  try {
    const paths = [join(dir, 'one.txt'), join(dir, 'two.txt')]; for (const p of paths) await writeFile(p, 'original text');
    const q = new Queue(new StubEngines('fail-first'), () => join(dir, 'out')); await q.add(paths);
    for (const j of q.snapshot()) q.configure(j.id, 'pdf', defaults);
    const idle = new Promise<void>(resolve => q.once('idle', resolve)); q.start(); await idle;
    assert.deepEqual(q.snapshot().map(j => j.status), ['failed', 'completed']);
    assert.equal(await readFile(paths[0], 'utf8'), 'original text');
    q.retry(q.snapshot()[0].id); assert.equal(q.snapshot()[0].status, 'ready');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('cancellation cleans temporary output and does not publish result', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-test-'));
  try {
    const input = join(dir, 'one.txt'); await writeFile(input, 'original'); const engine = new StubEngines('wait');
    const q = new Queue(engine, () => join(dir, 'out')); await q.add([input]);
    q.configure(q.snapshot()[0].id, 'pdf', defaults);
    const started = new Promise<void>(resolve => { q.on('jobs', () => { if (engine.count) resolve(); }); });
    q.start();
    for (let n = 0; n < 100 && !engine.count; n++) await new Promise(resolve => setTimeout(resolve, 5));
    const idle = new Promise<void>(resolve => q.once('idle', resolve)); q.cancel(q.snapshot()[0].id); await idle;
    assert.equal(q.snapshot()[0].status, 'cancelled'); assert.equal(q.snapshot()[0].outputPath, undefined);
    await assert.rejects(readdir(join(dir, 'out'))); assert.equal(await readFile(input, 'utf8'), 'original'); void started;
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('Unicode and long paths publish without changing sources', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-test-'));
  try {
    const nested = join(dir, ...Array(5).fill('long-folder-name-for-conversion-testing'));
    await mkdir(nested, { recursive: true });
    const input = join(nested, '日本語 résumé.txt'); await writeFile(input, 'original');
    const result = await publish(input, join(nested, 'converted'), '日本語 résumé.txt', false);
    assert.equal(await readFile(result, 'utf8'), 'original'); assert.equal(await readFile(input, 'utf8'), 'original');
    await assert.rejects(publish(input, input, 'result.txt', false));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('queue rejects changed sources and invalid renderer requests', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-test-'));
  try {
    const input = join(dir, 'one.txt'); await writeFile(input, 'original'); const engine = new StubEngines('fail-first');
    const q = new Queue(engine, () => join(dir, 'out'));
    await assert.rejects(q.add(['x', null])); await q.add([input]);
    const id = q.snapshot()[0].id;
    assert.throws(() => q.configure(id, 'exe', defaults)); assert.throws(() => q.configure(id, 'pdf', {})); assert.throws(() => q.cancel('unknown'));
    await writeFile(input, 'changed after import');
    const idle = new Promise<void>(resolve => q.once('idle', resolve)); q.start(); await idle;
    assert.equal(q.snapshot()[0].status, 'failed'); assert.match(q.snapshot()[0].message!, /changed/); assert.equal(engine.count, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('remote resources and SVG active content are blocked before engines launch', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-test-'));
  try {
    const engine = new Engines('nonexistent-engine-directory'); const context = { signal: new AbortController().signal };
    const svg = join(dir, 'remote.svg'); await writeFile(svg, '<svg><image href="https://example.com/x.png"/></svg>');
    await assert.rejects(engine.convert(capability('svg', 'png'), svg, join(dir, 'svg'), defaults, context), /external resources/);
    const markdown = join(dir, 'remote.md'); await writeFile(markdown, '![image](https://example.com/x.png)');
    await assert.rejects(engine.convert(capability('md', 'html'), markdown, join(dir, 'md'), defaults, context), /remote resources/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('extraction expansion budget stops at the file limit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-test-'));
  try { await writeFile(join(dir, 'entry.txt'), 'data'); await assert.rejects(inspectExtracted(dir, { bytes: 0, files: 100000 }), /expansion limit/); }
  finally { await rm(dir, { recursive: true, force: true }); }
});
test('Office profiles disable macros and use each applications never-update value', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-test-'));
  try {
    const engine = new Engines('nonexistent-engine-directory');
    await assert.rejects(engine.convert(capability('txt', 'pdf'), join(dir, 'input.txt'), dir, defaults, { signal: new AbortController().signal }));
    const profile = await readFile(join(dir, 'office-profile/user/registrymodifications.xcu'), 'utf8');
    assert.match(profile, /DisableMacrosExecution[^<]*[^]*?<value>true<\/value>/);
    assert.match(profile, /Office.Writer\/Content\/Update[^]*?<value>2<\/value>/);
    assert.match(profile, /Office.Calc\/Content\/Update[^]*?<value>1<\/value>/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('cancelling a native command terminates its owned child process', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-test-'));
  const controller = new AbortController(); const marker = join(dir, 'child.txt');
  try {
    const script = `const {spawn}=require('node:child_process');const fs=require('node:fs');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});fs.writeFileSync(process.argv[1],String(child.pid));setInterval(()=>{},1000);`;
    const result = run(process.execPath, ['-e', script, marker], { signal: controller.signal });
    const rejected = assert.rejects(result, Cancelled);
    let child = 0;
    for (let n = 0; n < 100 && !child; n++) { child = await readFile(marker, 'utf8').then(Number, () => 0); if (!child) await new Promise(resolve => setTimeout(resolve, 20)); }
    assert.ok(child, 'Child process started'); controller.abort(); await rejected;
    assert.throws(() => process.kill(child, 0), 'Child no longer running');
  } finally { controller.abort(); await rm(dir, { recursive: true, force: true }); }
});
