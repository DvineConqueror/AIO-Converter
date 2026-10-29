import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const root = resolve(process.env.AIO_ENGINE_ROOT ?? 'vendor');
const lock = JSON.parse(await readFile(join(root, 'engines.lock.json'), 'utf8'));
const commands = { 'yt-dlp': ['yt-dlp/yt-dlp.exe', '--version'], deno: ['deno/deno.exe', '--version'], ffmpeg: ['ffmpeg/bin/ffmpeg.exe', '-version'], imagemagick: ['imagemagick/magick.exe', '-version'], pandoc: ['pandoc/pandoc.exe', '--version'], poppler: ['poppler/bin/pdfinfo.exe', '-v'], sevenzip: ['sevenzip/7z.exe', 'i'], libreoffice: ['libreoffice/program/soffice.com', '--version'] };
const records = {};
for (const [id, [exe, ...args]] of Object.entries(commands)) {
  const versionOutput = await new Promise((res, rej) => {
    const p = spawn(join(root, exe), args, { windowsHide: true, shell: false }); let output = '';
    p.stdout.on('data', b => output += b); p.stderr.on('data', b => output += b); p.on('error', rej);
    p.on('close', code => code === 0 ? res(output) : rej(new Error(`${id}: ${code}: ${output}`)));
  });
  const files = [];
  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = prefix + entry.name, path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path, `${relative}/`);
      else {
        const info = await stat(path);
        files.push({ path: relative, bytes: info.size, ...(/\.(exe|dll)$/i.test(relative) ? { sha256: createHash('sha256').update(await readFile(path)).digest('hex') } : {}) });
      }
    }
  }
  await walk(join(root, id));
  records[id] = { ...lock[id], versionOutput, files };
}
await mkdir('release', { recursive: true });
await writeFile('release/engine-build-records.json', JSON.stringify({ platform: 'win32-x64', records, sourceClearance: 'PENDING: exact corresponding dependency sources/build records must be assembled before public distribution.' }, null, 2));
console.log('Recorded all engine versions, DLL hashes, and packaged file inventory.');
