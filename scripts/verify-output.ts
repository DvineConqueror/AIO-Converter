import assert from 'node:assert/strict';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { Engines } from '../src/core/engines';
import { run } from '../src/core/process';
import type { ConversionCapability } from '../src/shared/types';

export async function verifyOutput(engines: Engines, route: ConversionCapability, result: { path: string; folder: boolean }) {
  const context = { signal: new AbortController().signal };
  if (result.folder || (route.family === 'Images' && route.output !== 'pdf')) {
    const paths = result.folder ? (await readdir(result.path)).map(p => join(result.path, p)) : [result.path];
    for (const path of paths) {
      const dimensions = await run(engines.exe('imagemagick'), ['identify', '-format', '%w %h\n', path], context);
      for (const line of dimensions.trim().split('\n')) assert.ok(line.split(' ').every(n => Number(n) > 0), 'Readable image dimensions');
    }
  } else if (route.output === 'pdf') {
    const info = await run(join(engines.root, 'poppler/bin/pdfinfo.exe'), [result.path], context);
    assert.ok(Number(info.match(/^Pages:\s+(\d+)/m)?.[1]) > 0, 'PDF has pages');
    if (route.engine === 'libreoffice') {
      const text = await run(join(engines.root, 'poppler/bin/pdftotext.exe'), [result.path, '-'], context);
      assert.match(text, /AIO conversion fixture/, 'Office PDF preserves fixture text');
    }
  } else if (route.engine === 'ffmpeg') {
    const metadata = JSON.parse(await run(join(engines.root, 'ffmpeg/bin/ffprobe.exe'), ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', result.path], context));
    assert.ok(Number(metadata.format.duration) > 0.3 && Number(metadata.format.duration) < 2, 'Duration preserved');
    assert.ok(metadata.streams.length, 'Media streams present');
  } else if (route.engine === 'libreoffice') {
    const text = ['txt', 'rtf', 'csv'].includes(route.output) ? await readFile(result.path, 'utf8') : await run(engines.exe('sevenzip'), ['e', '-so', result.path, '*.xml', '-r'], context);
    assert.match(text, /AIO conversion fixture/, 'Office output preserves fixture text');
  } else if (route.engine === 'pandoc') {
    const text = await run(engines.exe('pandoc'), ['--sandbox', '-f', route.output === 'md' ? 'markdown' : route.output, '-t', 'plain', result.path], context);
    assert.match(text, /AIO conversion fixture/, 'Ebook output preserves fixture text');
  } else if (route.engine === 'poppler') {
    assert.match(await readFile(result.path, 'utf8'), /AIO conversion fixture/, 'Embedded PDF text preserved');
  } else if (route.engine === 'sevenzip') {
    let archive = result.path;
    if (route.output === 'tar.gz') {
      const unpack = join(dirname(result.path), 'verify-gzip'); await mkdir(unpack);
      await run(engines.exe('sevenzip'), ['x', '-y', `-o${unpack}`, archive], context);
      archive = join(unpack, (await readdir(unpack))[0]);
    }
    const listing = await run(engines.exe('sevenzip'), ['l', '-slt', '-ba', archive], context);
    assert.match(listing, /^Path = .+/m, 'Archive retains members');
    if (route.input !== 'rar') assert.match(listing, /Path = readme.txt/, 'Archive retains fixture member');
  }
}
