import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, access, rm, mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Engines } from '../src/core/engines';
import { capability, defaults } from '../src/shared/capabilities';
import { run } from '../src/core/process';

function zip(name: string, content: string, mode = 0o100644) {
  const body = Buffer.from(content), filename = Buffer.from(name);
  let crc = 0xffffffff;
  for (const byte of body) { crc ^= byte; for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; }
  crc = (crc ^ 0xffffffff) >>> 0;
  const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt32LE(crc, 14); header.writeUInt32LE(body.length, 18); header.writeUInt32LE(body.length, 22); header.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(0x0314, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE((mode << 16) >>> 0, 38);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + filename.length, 12); end.writeUInt32LE(header.length + filename.length + body.length, 16);
  return Buffer.concat([header, filename, body, central, filename, end]);
}
const engines = new Engines(resolve('vendor'));
const available = await access(engines.exe('sevenzip')).then(() => true, () => false);
test('actual archive engine rejects traversal and links before extraction', { skip: !available }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-archive-test-'));
  try {
    for (const [index, name, mode] of [[1, '../escape.txt', 0o100644], [2, 'link', 0o120777]] as const) {
      const input = join(dir, `bad-${index}.zip`); await writeFile(input, zip(name, 'outside target', mode));
      await assert.rejects(engines.convert(capability('zip', '7z'), input, join(dir, `job-${index}`), defaults, { signal: new AbortController().signal }), /unsafe|links/);
      await assert.rejects(access(join(dir, 'escape.txt')));
      assert.deepEqual(await readdir(join(dir, `job-${index}/extracted`)), []);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('actual archive engine rejects encrypted ZIP entries', { skip: !available }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aio-archive-test-'));
  try {
    const input = join(dir, 'encrypted.zip'); const text = join(dir, 'file.txt'); await writeFile(text, 'private');
    const context = { signal: new AbortController().signal };
    await run(engines.exe('sevenzip'), ['a', '-tzip', '-psecret', '-mem=AES256', input, text], context);
    await assert.rejects(engines.convert(capability('zip', '7z'), input, join(dir, 'job'), defaults, context), /Encrypted/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
