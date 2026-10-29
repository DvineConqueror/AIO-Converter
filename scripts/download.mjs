import { spawn } from 'node:child_process';
import { mkdir, stat, open, writeFile, readFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
const curl = args => new Promise((resolve, reject) => {
  const p = spawn('curl.exe', ['--fail', '--location', '--silent', '--show-error', '--retry', '2', '--connect-timeout', '20', '--max-time', '240', ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let text = ''; p.stdout.on('data', d => text += d); p.stderr.on('data', d => text += d); p.on('error', reject); p.on('close', c => c === 0 ? resolve(text) : reject(new Error(text.slice(-1800))));
});
export async function download(url, destination, concurrency = 12) {
  await mkdir(dirname(destination), { recursive: true });
  const headers = await curl(['--head', url]);
  const lengths = [...headers.matchAll(/^content-length:\s*(\d+)/gim)];
  const size = Number(lengths.at(-1)?.[1]);
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error(`No size from ${url}`);
  if (await stat(destination).then(s => s.size === size, () => false)) return;
  const chunkSize = 2 * 1024 * 1024;
  const partsDir = destination + '.parts'; await mkdir(partsDir, { recursive: true });
  const existing = await stat(destination + '.part').then(s => s.size, () => 0);
  if (existing) {
    const file = await open(destination + '.part', 'r');
    for (let start = 0; start + chunkSize <= existing; start += chunkSize) {
      const name = `${partsDir}/${start}`;
      if (await stat(name).then(s => s.size === chunkSize, () => false)) continue;
      const data = Buffer.alloc(chunkSize); await file.read(data, 0, chunkSize, start); await writeFile(name, data);
    }
    await file.close();
  }
  let next = 0, completed = 0;
  const count = Math.ceil(size / chunkSize);
  async function worker() {
    while (next < count) {
      const index = next++; const start = index * chunkSize, end = Math.min(size, start + chunkSize) - 1;
      const part = `${partsDir}/${start}`;
      if (!await stat(part).then(s => s.size === end - start + 1, () => false)) {
        const partial = await stat(part + '.tmp').then(s => s.size, () => 0);
        if (partial > 0 && partial < end - start + 1) {
          await curl(['--range', `${start + partial}-${end}`, '--output', part + '.tail', url]);
          await writeFile(part + '.tmp', Buffer.concat([await readFile(part + '.tmp'), await readFile(part + '.tail')]));
        } else if (partial !== end - start + 1) await curl(['--range', `${start}-${end}`, '--output', part + '.tmp', url]);
        if ((await stat(part + '.tmp')).size !== end - start + 1) throw new Error('Server did not honor byte range.');
        await rename(part + '.tmp', part);
      }
      completed++;
      if (completed % 10 === 0 || completed === count) console.log(`Download ${destination.split(/[\\/]/).at(-1)}: ${completed}/${count} parts`);
    }
  }
  const settled = await Promise.allSettled(Array.from({ length: Math.min(concurrency, count) }, worker));
  for (const result of settled) if (result.status === 'rejected') throw result.reason;
  const final = await open(destination + '.assembled', 'w');
  try { for (let i = 0; i < count; i++) await final.write(await readFile(`${partsDir}/${i * chunkSize}`)); } finally { await final.close(); }
  if ((await stat(destination + '.assembled')).size !== size) throw new Error('Incomplete download.');
  await rename(destination + '.assembled', destination);
}
if (process.argv[1]?.endsWith('download.mjs') && process.argv[2]) await download(process.argv[2], process.argv[3]);
