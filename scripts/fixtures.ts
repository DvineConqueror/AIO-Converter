import { mkdir, writeFile, readFile, readdir, access, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Engines } from '../src/core/engines';
import { run } from '../src/core/process';
import { capability, defaults } from '../src/shared/capabilities';
import { pathToFileURL } from 'node:url';

export const fixtureDir = resolve('output/fixtures');
export const engines = new Engines(resolve(process.env.AIO_ENGINE_ROOT ?? 'vendor'));
export const context = { signal: new AbortController().signal };
const has = (p: string) => access(p).then(() => true, () => false);
export async function fixtures() {
  await mkdir(fixtureDir, { recursive: true });
  const magick = engines.exe('imagemagick'); const ffmpeg = engines.exe('ffmpeg');
  await writeFile(join(fixtureDir, 'sample.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="#2463dc"/></svg>');
  for (const ext of ['png', 'jpg', 'webp', 'gif', 'tiff', 'bmp', 'ico', 'avif']) {
    const path = join(fixtureDir, `sample.${ext}`); if (await has(path)) continue;
    await run(magick, ['-size', '64x48', 'xc:#2463dc', '-quality', '85', path], context);
  }
  if (!await has(join(fixtureDir, 'sample.heic'))) {
    await mkdir('.cache', { recursive: true });
    if (!await has(resolve('.cache/example.heic'))) await run('curl.exe', ['--fail', '--location', '--silent', '--show-error', '--max-time', '60', 'https://raw.githubusercontent.com/strukturag/libheif/master/examples/example.heic', '--output', resolve('.cache/example.heic')], context);
    await copyFile(resolve('.cache/example.heic'), join(fixtureDir, 'sample.heic'));
  }
  if (!await has(join(fixtureDir, 'sample.rar'))) {
    if (!await has(resolve('.cache/rar5-fixture.uu'))) await run('curl.exe', ['--fail', '--location', '--silent', '--show-error', '--max-time', '60', 'https://raw.githubusercontent.com/libarchive/libarchive/master/libarchive/test/test_read_format_rar5_multiple_files.rar.uu', '--output', resolve('.cache/rar5-fixture.uu')], context);
    const encoded = await readFile(resolve('.cache/rar5-fixture.uu'), 'utf8');
    const bytes: number[] = [];
    for (const line of encoded.split(/\r?\n/).slice(1)) {
      if (line === 'end') break;
      const length = (line.charCodeAt(0) - 32) & 63;
      const decoded: number[] = [];
      for (let i = 1; i + 3 < line.length; i += 4) { const n = [0, 1, 2, 3].map(j => (line.charCodeAt(i + j) - 32) & 63); decoded.push((n[0] << 2) | (n[1] >> 4), ((n[1] & 15) << 4) | (n[2] >> 2), ((n[2] & 3) << 6) | n[3]); }
      bytes.push(...decoded.slice(0, length));
    }
    await writeFile(join(fixtureDir, 'sample.rar'), Buffer.from(bytes));
  }
  for (const ext of ['wav', 'mp3', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'aiff', 'wma']) {
    const path = join(fixtureDir, `sample.${ext}`); if (await has(path)) continue;
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.6', ...(ext === 'wma' ? ['-c:a', 'wmav2'] : []), path], context);
  }
  for (const ext of ['mp4', 'mov', 'mkv', 'avi', 'webm', 'wmv', 'mpg']) {
    const path = join(fixtureDir, `sample.${ext}`); if (await has(path)) continue;
    const codecs = ext === 'webm' ? ['-c:v', 'libvpx-vp9', '-c:a', 'libopus'] : ext === 'wmv' ? ['-c:v', 'wmv2', '-c:a', 'wmav2'] : ext === 'mpg' ? ['-c:v', 'mpeg1video', '-c:a', 'mp2'] : ext === 'avi' ? ['-c:v', 'mpeg4', '-c:a', 'libmp3lame'] : ['-c:v', 'libx264', '-c:a', 'aac'];
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-f', 'lavfi', '-i', 'color=c=blue:s=64x48:r=25:d=0.6', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.6', ...codecs, '-pix_fmt', 'yuv420p', '-shortest', path], context);
  }
  await writeFile(join(fixtureDir, 'sample.md'), '# AIO conversion fixture\n\nOriginal text: local and offline.\n');
  await writeFile(join(fixtureDir, 'sample.txt'), 'AIO conversion fixture\nOriginal text: local and offline.\n');
  await writeFile(join(fixtureDir, 'sample.csv'), 'Name,Value\nAIO conversion fixture,42\n');
  for (const ext of ['docx', 'odt', 'rtf', 'epub', 'fb2', 'html']) {
    const path = join(fixtureDir, `sample.${ext}`); if (await has(path)) continue;
    await run(engines.exe('pandoc'), ['--standalone', '-f', 'markdown', '-t', ext, '-o', path, join(fixtureDir, 'sample.md')], context);
  }
  const contents = join(fixtureDir, 'archive-content'); await mkdir(contents, { recursive: true });
  await writeFile(join(contents, 'readme.txt'), 'AIO conversion fixture');
  for (const ext of ['zip', '7z', 'tar']) {
    const path = join(fixtureDir, `sample.${ext}`); if (!await has(path)) await run(engines.exe('sevenzip'), ['a', `-t${ext}`, path, '.'], context, { cwd: contents });
  }
  if (!await has(join(fixtureDir, 'sample.tar.gz'))) await run(engines.exe('sevenzip'), ['a', '-tgzip', join(fixtureDir, 'sample.tar.gz'), join(fixtureDir, 'sample.tar')], context);
  if (!await has(engines.exe('libreoffice'))) return fixtureDir;
  const convertOffice = async (source: string, target: string, filter: string) => {
    const result = join(fixtureDir, `sample.${target}`); if (await has(result)) return;
    const dir = join(fixtureDir, `generate-${target}`); await mkdir(dir, { recursive: true });
    const profile = pathToFileURL(join(dir, 'profile')).href;
    await run(engines.exe('libreoffice'), [`-env:UserInstallation=${profile}`, '--headless', '--nologo', '--nodefault', '--nofirststartwizard', '--norestore', '--convert-to', `${target}:${filter}`, '--outdir', dir, source], context, { timeout: 120000 });
    const found = (await readdir(dir)).find(p => p.endsWith(`.${target}`)); if (!found) throw new Error(`Fixture not generated: ${target}`);
    await copyFile(join(dir, found), result);
  };
  await convertOffice(join(fixtureDir, 'sample.docx'), 'doc', 'MS Word 97');
  for (const [ext, filter] of [['xlsx', 'Calc MS Excel 2007 XML'], ['xls', 'MS Excel 97'], ['ods', 'calc8']]) await convertOffice(join(fixtureDir, 'sample.csv'), ext, filter);
  await writeFile(join(fixtureDir, 'sample.fodp'), `<?xml version="1.0"?><office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.2" office:mimetype="application/vnd.oasis.opendocument.presentation"><office:body><office:presentation><draw:page draw:name="page1"><draw:frame svg:x="1cm" svg:y="1cm" svg:width="15cm" svg:height="5cm"><draw:text-box><text:p>AIO conversion fixture</text:p></draw:text-box></draw:frame></draw:page></office:presentation></office:body></office:document>`);
  for (const [ext, filter] of [['pptx', 'Impress MS PowerPoint 2007 XML'], ['ppt', 'MS PowerPoint 97'], ['odp', 'impress8']]) await convertOffice(join(fixtureDir, 'sample.fodp'), ext, filter);
  if (!await has(join(fixtureDir, 'sample.pdf'))) {
    const result = await engines.convert(capability('docx', 'pdf'), join(fixtureDir, 'sample.docx'), join(fixtureDir, `generate-pdf-${Date.now()}`), { ...defaults }, context);
    await copyFile(result.path, join(fixtureDir, 'sample.pdf'));
  }
  return fixtureDir;
}
