import { access, mkdir, readFile, writeFile, readdir, stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ConversionCapability, ConversionOptions, EngineId, EngineStatus } from '../shared/types';
import { audio, images } from '../shared/capabilities';
import { inspectExtracted, safeEntry } from './files';
import { run, type RunContext } from './process';

const executables: Record<EngineId, string> = { imagemagick: 'imagemagick/magick.exe', ffmpeg: 'ffmpeg/bin/ffmpeg.exe', libreoffice: 'libreoffice/program/soffice.com', poppler: 'poppler/bin/pdftoppm.exe', pandoc: 'pandoc/pandoc.exe', sevenzip: 'sevenzip/7z.exe' };
export class Engines {
  constructor(readonly root: string) {}
  exe(id: EngineId) { return join(this.root, executables[id]); }
  async status(): Promise<EngineStatus[]> {
    return Promise.all((Object.keys(executables) as EngineId[]).map(async id => ({ id, available: await access(this.exe(id)).then(() => true, () => false) })));
  }
  async convert(c: ConversionCapability, input: string, dir: string, o: ConversionOptions, context: RunContext): Promise<{ path: string; folder: boolean }> {
    await mkdir(dir, { recursive: true });
    const output = join(dir, `result.${c.output}`);
    switch (c.engine) {
      case 'ffmpeg': await this.media(c, input, output, o, context); break;
      case 'imagemagick': await this.image(c, input, output, dir, o, context); break;
      case 'libreoffice': await this.office(c, input, dir, context); break;
      case 'pandoc': await this.ebook(c, input, output, dir, context); break;
      case 'poppler': {
        if (c.output === 'txt') {
          await run(join(this.root, 'poppler/bin/pdftotext.exe'), ['-enc', 'UTF-8', input, output], context);
          if (!(await readFile(output, 'utf8')).trim()) throw new Error('PDF contains no embedded text. Scanned pages require OCR, which is not included.');
        } else {
          const pages = join(dir, 'pages'); await mkdir(pages);
          await run(this.exe('poppler'), [c.output === 'jpg' ? '-jpeg' : '-png', '-r', '150', input, join(pages, 'page')], context);
          await validateOutput(pages, true); return { path: pages, folder: true };
        }
        break;
      }
      case 'sevenzip': await this.archive(c, input, output, dir, context); break;
    }
    let path = output;
    if (c.engine === 'libreoffice') {
      const found = (await readdir(join(dir, 'converted'))).filter(n => n.toLowerCase().endsWith(`.${c.output}`));
      if (found.length !== 1) throw new Error('Office could not convert this document. It may be corrupt, encrypted or unsupported.');
      path = join(dir, 'converted', found[0]);
    }
    await validateOutput(path, false);
    return { path, folder: false };
  }
  private async media(c: ConversionCapability, input: string, output: string, o: ConversionOptions, context: RunContext) {
    const probe = await run(join(this.root, 'ffmpeg/bin/ffprobe.exe'), ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_format', '-show_streams', '-of', 'json', input], context);
    const metadata = JSON.parse(probe); const duration = Number(metadata.format?.duration);
    const isAudio = audio.includes(c.output);
    if (isAudio && !metadata.streams?.some((s: { codec_type: string }) => s.codec_type === 'audio')) throw new Error('This file contains no audio track to extract.');
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-protocol_whitelist', 'file,pipe', '-i', input];
    if (isAudio) {
      args.push('-vn', '-map', '0:a:0');
      const codecs: Record<string, string> = { mp3: 'libmp3lame', wav: 'pcm_s16le', flac: 'flac', m4a: 'aac', aac: 'aac', ogg: 'libvorbis', opus: 'libopus', aiff: 'pcm_s16be' };
      args.push('-c:a', codecs[c.output]);
      if (!['wav', 'flac', 'aiff'].includes(c.output)) args.push('-b:a', `${o.bitrate}k`);
    } else {
      const scale = o.width || o.height ? `scale=${o.width ?? -2}:${o.height ?? -2}:force_original_aspect_ratio=decrease,` : '';
      if (c.output === 'gif') args.push('-filter_complex', `[0:v:0]${scale}fps=12,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse[out]`, '-map', '[out]');
      else {
        args.push('-map', '0:v:0', '-map', '0:a:0?', '-vf', `${scale}scale=trunc(iw/2)*2:trunc(ih/2)*2`, '-pix_fmt', 'yuv420p');
        const crf = o.preset === 'small' ? 29 : o.preset === 'quality' ? 18 : 23;
        if (c.output === 'webm') args.push('-c:v', 'libvpx-vp9', '-crf', String(crf + 8), '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k');
        else if (c.output === 'avi') args.push('-c:v', 'mpeg4', '-q:v', o.preset === 'quality' ? '2' : '5', '-c:a', 'libmp3lame', '-b:a', `${o.bitrate}k`);
        else args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-c:a', 'aac', '-b:a', `${o.bitrate}k`);
        if (['mp4', 'mov'].includes(c.output)) args.push('-movflags', '+faststart');
      }
    }
    args.push('-progress', 'pipe:1', output);
    await run(this.exe('ffmpeg'), args, context, { onLine: line => {
      if (line.startsWith('out_time_us=') && duration > 0) context.onProgress?.(Math.min(99, Number(line.slice(12)) / (duration * 1000000) * 100));
    } });
    const check = await run(join(this.root, 'ffmpeg/bin/ffprobe.exe'), ['-v', 'error', '-show_streams', '-of', 'json', output], context);
    if (!JSON.parse(check).streams?.length) throw new Error('Converted media contains no readable streams.');
  }
  private async image(c: ConversionCapability, input: string, output: string, dir: string, o: ConversionOptions, context: RunContext) {
    if (c.input === 'svg') {
      const svg = await readFile(input, 'utf8');
      if (/<!DOCTYPE|<!ENTITY|<script|<foreignObject|@import|xml-stylesheet|(?:href|src)\s*=\s*["'](?!#)|url\(\s*["']?(?!#)/i.test(svg)) throw new Error('SVG contains external resources or active content. Export a self-contained SVG first.');
    }
    const policy = join(dir, 'policy'); await mkdir(policy);
    await writeFile(join(policy, 'policy.xml'), `<policymap><policy domain="resource" name="memory" value="512MiB"/><policy domain="resource" name="map" value="1GiB"/><policy domain="resource" name="disk" value="4GiB"/><policy domain="resource" name="width" value="32KP"/><policy domain="resource" name="height" value="32KP"/><policy domain="resource" name="list-length" value="1000"/><policy domain="delegate" rights="none" pattern="*"/><policy domain="coder" rights="none" pattern="{HTTP,HTTPS,URL,FTP,MVG,MSL,PS,EPS,XPS,TEXT,LABEL,CAPTION}"/><policy domain="path" rights="none" pattern="@*"/></policymap>`);
    const source = c.input === 'svg' ? `RSVG:${input}` : input;
    const args = [(['gif', 'tiff'].includes(c.output) || c.output === 'pdf') ? source : `${source}[0]`, '-auto-orient'];
    if (o.width || o.height) args.push('-resize', `${o.width ?? ''}x${o.height ?? ''}>`);
    if (c.output === 'ico') args.push('-resize', '256x256>');
    if (c.output === 'jpg') args.push('-background', 'white', '-alpha', 'remove', '-alpha', 'off');
    args.push('-quality', String(o.quality), output);
    await run(this.exe('imagemagick'), args, context, { env: { MAGICK_CONFIGURE_PATH: policy, MAGICK_TEMPORARY_PATH: dir } });
    if (c.output !== 'pdf') await run(this.exe('imagemagick'), ['identify', output], context, { env: { MAGICK_CONFIGURE_PATH: policy } });
  }
  private async office(c: ConversionCapability, input: string, dir: string, context: RunContext) {
    const profile = join(dir, 'office-profile'); await mkdir(join(profile, 'user'), { recursive: true });
    // Writer uses 2 for Never; Calc uses 1 (their configuration enums differ).
    await writeFile(join(profile, 'user/registrymodifications.xcu'), `<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item><item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>2</value></prop></item><item oor:path="/org.openoffice.Office.Calc/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>1</value></prop></item></oor:items>`);
    if (['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'].includes(c.input)) await this.checkDocumentPackage(input, dir, context);
    const out = join(dir, 'converted'); await mkdir(out);
    const filters: Record<string, string> = { docx: 'Office Open XML Text', odt: 'writer8', rtf: 'Rich Text Format', txt: 'Text (encoded):UTF8', xlsx: 'Calc MS Excel 2007 XML', ods: 'calc8', csv: 'Text - txt - csv (StarCalc):44,34,76,1', pptx: 'Impress MS PowerPoint 2007 XML', odp: 'impress8' };
    const pdfFilter = c.family === 'Spreadsheets' ? 'calc_pdf_Export' : c.family === 'Presentations' ? 'impress_pdf_Export' : 'writer_pdf_Export';
    await run(this.exe('libreoffice'), [`-env:UserInstallation=${pathToFileURL(profile).href}`, '--headless', '--nologo', '--nodefault', '--nolockcheck', '--norestore', '--convert-to', `${c.output}:${c.output === 'pdf' ? pdfFilter : filters[c.output]}`, '--outdir', out, input], context, { timeout: 5 * 60 * 1000 });
  }
  private async checkDocumentPackage(input: string, dir: string, context: RunContext) {
    const list = await run(this.exe('sevenzip'), ['l', '-slt', '-ba', '-sccUTF-8', input], context);
    if (/Encrypted = \+|vbaProject\.bin|\/externalLinks\//i.test(list)) throw new Error('Encrypted documents, macros and external data links are not supported.');
    const rels = await run(this.exe('sevenzip'), ['e', '-so', '-y', input, '*.rels', 'content.xml', '-r'], context);
    if (/TargetMode=["']External["'][^>]*Type=["'][^"']*(?:image|oleObject|package)|Type=["'][^"']*(?:image|oleObject|package)["'][^>]*TargetMode=["']External|xlink:href=["'](?:https?:|file:|ftp:|\\\\)/i.test(rels)) throw new Error('Document references external resources. Embed those resources before converting.');
    void dir;
  }
  private async ebook(c: ConversionCapability, input: string, output: string, dir: string, context: RunContext) {
    if (['epub', 'docx'].includes(c.input)) await this.checkDocumentPackage(input, dir, context);
    if (['html', 'md', 'fb2'].includes(c.input)) {
      const text = await readFile(input, 'utf8');
      if (/(?:src|href|xlink:href)\s*=\s*["'](?:https?:|file:|ftp:|\/\/)|!\[[^\]]*\]\((?:https?:|file:|\/\/)/i.test(text)) throw new Error('Document contains remote resources. Use a self-contained document for offline conversion.');
    }
    await run(this.exe('pandoc'), ['--sandbox', '--standalone', '--from', c.input === 'md' ? 'markdown' : c.input, '--to', c.output === 'md' ? 'markdown' : c.output, '--output', output, input], context, { cwd: dir });
  }
  private async archive(c: ConversionCapability, input: string, output: string, dir: string, context: RunContext) {
    const extract = join(dir, 'extracted'); await mkdir(extract);
    let archiveInput = input;
    if (c.input === 'tar.gz') {
      const wrapped = join(dir, 'wrapped'); await mkdir(wrapped);
      await this.archiveList(input, context, dir);
      await run(this.exe('sevenzip'), ['x', '-y', '-p', `-o${wrapped}`, input], context);
      await inspectExtracted(wrapped);
      const files = await readdir(wrapped); if (files.length !== 1) throw new Error('Expected one TAR stream inside GZip archive.'); archiveInput = join(wrapped, files[0]);
    }
    await this.archiveList(archiveInput, context, dir);
    await run(this.exe('sevenzip'), ['x', '-y', '-p', '-sccUTF-8', `-o${extract}`, archiveInput], context);
    await inspectExtracted(extract);
    const type = c.output === 'tar.gz' ? 'tar' : c.output;
    const archiveOut = c.output === 'tar.gz' ? join(dir, 'result.tar') : output;
    await run(this.exe('sevenzip'), ['a', '-y', `-t${type}`, archiveOut, '.'], context, { cwd: extract });
    if (c.output === 'tar.gz') await run(this.exe('sevenzip'), ['a', '-y', '-tgzip', output, archiveOut], context);
    await run(this.exe('sevenzip'), ['t', '-p', output], context);
  }
  private async archiveList(input: string, context: RunContext, dir: string) {
    const listing = await run(this.exe('sevenzip'), ['l', '-slt', '-ba', '-sccUTF-8', '-p', input], context);
    let bytes = 0, count = 0;
    for (const block of listing.split(/\r?\n\r?\n/)) {
      const lines = block.split(/\r?\n/).filter(Boolean);
      if (lines.some(l => !l.includes(' = '))) throw new Error('Archive has ambiguous entry metadata.');
      const pairs = lines.map(l => { const i = l.indexOf(' = '); return [l.slice(0, i), l.slice(i + 3)]; });
      if (new Set(pairs.map(p => p[0])).size !== pairs.length) throw new Error('Archive has ambiguous entry metadata.');
      const fields = Object.fromEntries(pairs);
      if (!fields.Path) continue;
      safeEntry(fields.Path); count++;
      if (fields.Encrypted === '+' || fields['Symbolic Link'] || fields['Hard Link'] || /(?:^|\s)l[rwx-]{9}/.test(fields.Attributes ?? '') || /Reparse/.test(fields.Attributes ?? '')) throw new Error('Encrypted archives and archive links are not supported.');
      const size = Number(fields.Size ?? 0);
      if (!Number.isSafeInteger(size) || size < 0) throw new Error('Archive has invalid size metadata.'); bytes += size;
    }
    const disk = await statfs(dir); const available = Number(disk.bavail) * Number(disk.bsize);
    if (count > 100000 || bytes > 20 * 1024 ** 3 || bytes * 2 > available) throw new Error('Archive exceeds expansion limits or available temporary disk space.');
  }
}
async function validateOutput(path: string, folder: boolean) {
  if (folder) { const files = await readdir(path); if (!files.length) throw new Error('Conversion produced no output pages.'); for (const file of files) if (!(await stat(join(path, file))).size) throw new Error('Conversion produced an empty page.'); }
  else if (!(await stat(path)).size) throw new Error('Conversion produced an empty file.');
}
