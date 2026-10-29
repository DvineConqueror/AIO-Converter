import { lstat, open, readdir, mkdir, copyFile, unlink, rm, link } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { extension, targets } from '../shared/capabilities';
import { Cancelled } from './process';

export async function identify(path: string) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Choose regular files, not folders or links.');
  const ext = extension(path);
  if (!targets(ext).length) throw new Error(`Unsupported file: ${basename(path)}`);
  const handle = await open(path, 'r');
  const bytes = Buffer.alloc(4096);
  const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0); await handle.close();
  const b = bytes.subarray(0, bytesRead);
  if (!b.length) throw new Error('File is empty.');
  const starts = (hex: string) => b.subarray(0, hex.length / 2).toString('hex') === hex;
  const ascii = b.toString('latin1');
  const checks: Record<string, boolean> = {
    png: starts('89504e470d0a1a0a'), jpg: starts('ffd8ff'), gif: ascii.startsWith('GIF8'), bmp: ascii.startsWith('BM'),
    tiff: starts('49492a00') || starts('4d4d002a'), ico: starts('00000100'), webp: ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP',
    pdf: ascii.slice(0, 1024).includes('%PDF-'), zip: starts('504b'), '7z': starts('377abcaf271c'), rar: ascii.startsWith('Rar!'), 'tar.gz': starts('1f8b'),
    docx: starts('504b'), xlsx: starts('504b'), pptx: starts('504b'), odt: starts('504b'), ods: starts('504b'), odp: starts('504b'), epub: starts('504b'),
    doc: starts('d0cf11e0a1b11ae1'), xls: starts('d0cf11e0a1b11ae1'), ppt: starts('d0cf11e0a1b11ae1'),
    rtf: ascii.trimStart().startsWith('{\\rtf'), flac: ascii.startsWith('fLaC'), wav: ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE',
    ogg: ascii.startsWith('OggS'), opus: ascii.startsWith('OggS'), aiff: ascii.startsWith('FORM'), avi: ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'AVI ',
    mp4: ascii.slice(4, 8) === 'ftyp', m4a: ascii.slice(4, 8) === 'ftyp', avif: ascii.slice(4, 8) === 'ftyp', heic: ascii.slice(4, 8) === 'ftyp',
    webm: starts('1a45dfa3'), mkv: starts('1a45dfa3'), wma: starts('3026b2758e66cf11'), wmv: starts('3026b2758e66cf11')
  };
  if (checks[ext] === false || starts('4d5a') || starts('7f454c46')) throw new Error('File contents do not match the extension, or the file is corrupt.');
  if (['txt', 'csv', 'md', 'html', 'svg', 'fb2'].includes(ext) && b.includes(0)) throw new Error('Expected a text file; binary data was found.');
  return { path: resolve(path), ext, size: info.size, mtime: info.mtimeMs };
}

export function safeEntry(path: string) {
  const parts = path.replaceAll('\\', '/').split('/');
  if (!path || /[\x00-\x1f:]/.test(path) || /^[\\/]/.test(path) || parts.some(p => p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw new Error('Archive contains an unsafe path.');
}
export async function inspectExtracted(dir: string, budget = { bytes: 0, files: 0 }) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    safeEntry(item.name);
    const path = join(dir, item.name); const s = await lstat(path);
    if (s.isSymbolicLink() || (!s.isDirectory() && !s.isFile())) throw new Error('Archive links and special files are not supported.');
    if (s.isDirectory()) await inspectExtracted(path, budget);
    else { budget.files++; budget.bytes += s.size; }
    if (budget.files > 100000 || budget.bytes > 20 * 1024 ** 3) throw new Error('Archive exceeds the 100,000-file or 20 GiB expansion limit.');
  }
  return budget;
}
export async function publish(source: string, destination: string, name: string, folder: boolean, signal?: AbortSignal) {
  const check = () => { if (signal?.aborted) throw new Cancelled(); };
  check();
  await mkdir(destination, { recursive: true });
  const staged = folder ? undefined : join(destination, `.aio-${randomUUID()}.partial`);
  if (staged) {
    try { await copyFile(source, staged, constants.COPYFILE_EXCL); }
    catch (error) { await unlink(staged).catch(() => {}); throw error; }
  }
  const dot = name.lastIndexOf('.'); const stem = dot > 0 ? name.slice(0, dot) : name; const ext = dot > 0 ? name.slice(dot) : '';
  try {
  check();
  for (let n = 0; n < 10000; n++) {
    const output = join(destination, n ? `${stem} (${n})${ext}` : name);
    try {
      if (folder) {
        await mkdir(output);
        try { await copyTree(source, output, check); check(); } catch (error) { await rm(output, { recursive: true, force: true }); throw error; }
      } else {
        // Publish a complete file atomically; hard-link creation never replaces an existing path.
        try { await link(staged!, output); }
        catch (error) {
          if (!['EPERM', 'ENOTSUP', 'EINVAL', 'ENOSYS'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
          // shortcut: FAT/exFAT cannot hard-link; exclusive copy stays uncompleted until the copy finishes.
          await copyFile(staged!, output, constants.COPYFILE_EXCL);
        }
      }
      if (signal?.aborted) { await rm(output, { recursive: folder, force: true }); throw new Cancelled(); }
      return output;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  }
  throw new Error('Too many files with this name. Choose another destination.');
  } finally { if (staged) await unlink(staged).catch(() => {}); }
}
async function copyTree(source: string, dest: string, check: () => void) {
  for (const file of await readdir(source, { withFileTypes: true })) {
    check();
    const from = join(source, file.name), to = join(dest, file.name);
    if (file.isDirectory()) { await mkdir(to); await copyTree(from, to, check); }
    else await copyFile(from, to, constants.COPYFILE_EXCL);
  }
}
