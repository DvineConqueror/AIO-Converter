import { mkdir, readFile, writeFile, readdir, copyFile, cp, stat } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { download as downloadRanges } from './download.mjs';

const root = resolve('vendor');
const cache = resolve('.cache/downloads');
await mkdir(root, { recursive: true });
await mkdir(cache, { recursive: true });
const run = (exe, args) => new Promise((res, rej) => {
  const p = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; p.stdout.on('data', d => output += d); p.stderr.on('data', d => output += d);
  p.on('error', rej); p.on('exit', code => code === 0 ? res(output) : rej(new Error(`${exe}: ${code}\n${output.slice(-1800)}`)));
});
const exists = p => stat(p).then(() => true, () => false);
let lock = {};
try { lock = JSON.parse(await readFile('engines.lock.json', 'utf8')); } catch {}
const assets = [
  { id: 'sevenzip', version: '26.05', url: 'https://github.com/ip7z/7zip/releases/download/26.05/7z2605-x64.exe', source: 'https://github.com/ip7z/7zip/releases/download/26.05/7z2605-src.tar.xz', license: 'LGPL-2.1-or-later AND BSD AND unRAR restriction' },
  { id: 'imagemagick', version: '7.1.2-34', url: 'https://github.com/ImageMagick/ImageMagick/releases/download/7.1.2-34/ImageMagick-7.1.2-34-portable-Q16-x64.7z', sha256: '52cc6a441c7884f5ff4274b410c9b90c4b7d54245dcdf4d32988bb4e4df4e5d1', source: 'https://github.com/ImageMagick/ImageMagick/releases/download/7.1.2-34/ImageMagick-7.1.2-34.7z', license: 'ImageMagick AND delegate licenses' },
  { id: 'pandoc', version: '3.13', url: 'https://github.com/jgm/pandoc/releases/download/3.13/pandoc-3.13-windows-x86_64.zip', sha256: '23e1f2e978a3df80db8bf65c9c59534f41a23140480cfb4f783a882ab7dc6a4e', source: 'https://github.com/jgm/pandoc/archive/refs/tags/3.13.tar.gz', license: 'GPL-2.0-or-later' },
  { id: 'poppler', version: '26.09.0-0', url: 'https://github.com/oschwartz10612/poppler-windows/releases/download/v26.09.0-0/Release-26.09.0-0.zip', sha256: '7a6f256a0ddf7536182246a5733331bf4677cbcc34f4663774947ad34556c8d0', source: 'https://poppler.freedesktop.org/poppler-26.09.0.tar.xz', license: 'GPL-2.0-or-later AND dependency licenses' },
  { id: 'libreoffice', version: '26.8.1', url: 'https://download.documentfoundation.org/libreoffice/stable/26.8.1/win/x86_64/LibreOffice_26.8.1_Win_x86-64.msi', sha256: 'c6298b10cfa1748bcbedad94c62ce771e240e5021bfd6d7a967cd571b04b5312', source: 'https://download.documentfoundation.org/libreoffice/src/26.8.1/', license: 'MPL-2.0 AND component licenses' },
  { id: 'ffmpeg', version: 'n9.0.2-36-g6882969ce9', url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-10-27-18-38/ffmpeg-n9.0.2-36-g6882969ce9-win64-gpl-shared-9.0.zip', sha256: 'dbfef481021a393424c9bd4e588c8d568f0ebba780c01c63dfcb87c87be901c7', source: 'https://github.com/BtbN/FFmpeg-Builds/tree/autobuild-2026-10-27-18-38', license: 'GPL-3.0-or-later AND dependency licenses' }
];
async function download(asset) {
  const dest = join(cache, basename(new URL(asset.url).pathname));
  if (!await exists(dest)) {
    console.log(`Downloading ${asset.id} ${asset.version}`);
    await downloadRanges(asset.url, dest, asset.id === 'libreoffice' ? 24 : 12);
  }
  const hash = createHash('sha256').update(await readFile(dest)).digest('hex');
  const expected = asset.sha256 ?? lock[asset.id]?.sha256;
  if (expected && expected !== hash) throw new Error(`SHA-256 mismatch: ${asset.id}`);
  lock[asset.id] = { ...asset, sha256: hash };
  await writeFile('engines.lock.json', JSON.stringify(lock, null, 2) + '\n');
  return dest;
}
const settled = await Promise.allSettled(assets.map(async a => [a, await download(a)]));
for (const r of settled) if (r.status === 'rejected') throw r.reason;
const downloads = settled.map(r => r.value);
let seven = process.env.AIO_SEVENZIP_BOOTSTRAP ?? join(root, 'sevenzip/7z.exe');
if (!await exists(seven)) {
  const bootstrap = { id: 'sevenzip-bootstrap', version: '26.05', url: 'https://www.7-zip.org/a/7zr.exe', source: 'https://github.com/ip7z/7zip/releases/tag/26.05', license: 'LGPL-2.1-or-later' };
  seven = await download(bootstrap);
}
const sevenDest = join(root, 'sevenzip'); await mkdir(sevenDest, { recursive: true });
const sevenStage = resolve('.cache/sevenzip-bootstrap'); await mkdir(sevenStage, { recursive: true });
await run(seven, ['x', downloads.find(([a]) => a.id === 'sevenzip')[1], `-o${sevenStage}`, '-y']);
await cp(sevenStage, sevenDest, { recursive: true });
seven = join(sevenDest, '7z.exe');
for (const [asset, archive] of downloads) {
  const dest = join(root, asset.id);
  if (asset.id === 'sevenzip') continue;
  await mkdir(dest, { recursive: true });
  console.log(`Extracting ${asset.id}`);
  if (asset.id === 'libreoffice') {
    const marker = join(dest, 'program/soffice.exe');
    if (!await exists(marker)) {
      const admin = resolve('.cache/libreoffice-admin'); await mkdir(admin, { recursive: true });
      await run('msiexec.exe', ['/a', archive, '/qn', `TARGETDIR=${admin}`, '/L*v', resolve('.cache/libreoffice-extract.log')]);
      const find = async dir => {
        if (await exists(join(dir, 'program/soffice.exe'))) return dir;
        for (const ent of await readdir(dir, { withFileTypes: true })) if (ent.isDirectory()) { const hit = await find(join(dir, ent.name)); if (hit) return hit; }
      };
      const extracted = await find(admin); if (!extracted) throw new Error('LibreOffice administrative extraction did not contain soffice.exe');
      await cp(extracted, dest, { recursive: true });
    }
    // Administrative MSI extraction does not install the VC runtime; load its x64 DLLs beside soffice.
    for (const dll of await readdir(join(dest, 'System64'))) if (dll.endsWith('.dll')) await copyFile(join(dest, 'System64', dll), join(dest, 'program', dll));
  } else {
    const staging = resolve('.cache/extracted', asset.id); await mkdir(staging, { recursive: true });
    await run(seven, ['x', archive, `-o${staging}`, '-y']);
    const dirs = await readdir(staging, { withFileTypes: true });
    let extracted = staging;
    if (dirs.length === 1 && dirs[0].isDirectory()) extracted = join(staging, dirs[0].name);
    if (asset.id === 'poppler') extracted = join(extracted, 'Library');
    await cp(extracted, dest, { recursive: true });
  }
  console.log(`Ready: ${asset.id}`);
}
await copyFile('engines.lock.json', join(root, 'engines.lock.json'));
await import('./acquire-download-tools.mjs');
console.log('Conversion engines and link download tools bundled. Run npm run test:engines.');
