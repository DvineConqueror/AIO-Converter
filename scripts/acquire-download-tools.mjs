import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { download } from './download.mjs';

const assets = [
  { id: 'yt-dlp', version: '2026.10.26', url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26/yt-dlp.exe', sha256: 'f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d', source: 'https://github.com/yt-dlp/yt-dlp/tree/2026.10.26', license: 'Unlicense (core); GPL-3.0-or-later and bundled dependency licenses (standalone executable)' },
  { id: 'deno', version: '2.9.8', url: 'https://github.com/denoland/deno/releases/download/v2.9.8/deno-x86_64-pc-windows-msvc.zip', sha256: 'cba84b26e0df5ae7f74fc66b86a95b866872a86292ebd84fa1e959927edd93bf', source: 'https://github.com/denoland/deno/tree/v2.9.8', license: 'MIT AND bundled dependency licenses' }
];
const lock = JSON.parse(await readFile('engines.lock.json', 'utf8'));
for (const asset of assets) {
  const folder = resolve('vendor', asset.id); await mkdir(folder, { recursive: true }); await mkdir('.cache/downloads', { recursive: true });
  const archive = resolve('.cache/downloads', asset.id === 'yt-dlp' ? `yt-dlp-${asset.version}.exe` : `deno-${asset.version}.zip`);
  try { await readFile(archive); } catch { console.log(`Downloading ${asset.id} ${asset.version}`); await download(asset.url, archive, 8); }
  if (createHash('sha256').update(await readFile(archive)).digest('hex') !== asset.sha256) throw new Error(`Hash mismatch: ${asset.id}`);
  if (asset.id === 'yt-dlp') await copyFile(archive, join(folder, 'yt-dlp.exe'));
  else await new Promise((res, rej) => {
    const p = spawn(resolve('vendor/sevenzip/7z.exe'), ['x', archive, `-o${folder}`, '-y'], { windowsHide: true, shell: false, stdio: 'ignore' });
    p.on('error', rej); p.on('exit', code => code === 0 ? res() : rej(new Error('Deno extraction failed.')));
  });
  const licenseURL = asset.id === 'yt-dlp' ? 'https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.10.26/LICENSE' : 'https://raw.githubusercontent.com/denoland/deno/v2.9.8/LICENSE.md';
  const response = await fetch(licenseURL); if (!response.ok) throw new Error(`License fetch failed: ${response.status}`);
  await writeFile(join(folder, 'LICENSE.txt'), await response.text()); lock[asset.id] = asset;
  if (asset.id === 'yt-dlp') {
    const notices = await fetch('https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.10.26/THIRD_PARTY_LICENSES.txt');
    if (!notices.ok) throw new Error('yt-dlp dependency license fetch failed.');
    await writeFile(join(folder, 'THIRD_PARTY_LICENSES.txt'), await notices.text());
  }
  console.log(`Ready: ${asset.id}`);
}
await writeFile('engines.lock.json', JSON.stringify(lock, null, 2) + '\n');
await copyFile('engines.lock.json', 'vendor/engines.lock.json');
