import type { ConversionCapability, ConversionOptions, EngineId, Family } from './types';

export const defaults: ConversionOptions = { quality: 85, preset: 'balanced', bitrate: 192, acknowledgeLoss: false };
export const capabilities: ConversionCapability[] = [];
function routes(inputs: string[], outputs: string[], family: Family, engine: EngineId) {
  for (const input of inputs) for (const output of outputs) if (input !== output && !capabilities.some(c => c.id === `${input}:${output}`)) capabilities.push({ id: `${input}:${output}`, input, output, family, engine });
}
export const images = ['jpg', 'png', 'webp', 'gif', 'tiff', 'bmp', 'ico', 'avif', 'heic', 'svg'];
export const audio = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'aiff', 'wma'];
export const video = ['mp4', 'mov', 'mkv', 'avi', 'webm', 'wmv', 'mpg'];
routes(images, ['jpg', 'png', 'webp', 'gif', 'tiff', 'bmp', 'ico', 'avif', 'pdf'], 'Images', 'imagemagick');
routes(audio, ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'aiff'], 'Audio', 'ffmpeg');
routes(video, ['mp4', 'mov', 'mkv', 'avi', 'webm', 'gif', 'mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'aiff'], 'Video', 'ffmpeg');
routes(['doc', 'docx', 'odt', 'rtf', 'txt'], ['docx', 'odt', 'rtf', 'txt', 'pdf'], 'Documents', 'libreoffice');
routes(['xls', 'xlsx', 'ods', 'csv'], ['xlsx', 'ods', 'csv', 'pdf'], 'Spreadsheets', 'libreoffice');
routes(['ppt', 'pptx', 'odp'], ['pptx', 'odp', 'pdf'], 'Presentations', 'libreoffice');
routes(['pdf'], ['png', 'jpg', 'txt'], 'PDF', 'poppler');
routes(['epub', 'fb2', 'md', 'html', 'docx'], ['epub', 'fb2', 'md', 'html', 'docx'], 'Ebooks', 'pandoc');
routes(['zip', '7z', 'tar', 'tar.gz', 'rar'], ['zip', '7z', 'tar', 'tar.gz'], 'Archives', 'sevenzip');

export function extension(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar.gz';
  const ext = lower.split('.').at(-1) ?? '';
  return ({ jpeg: 'jpg', tif: 'tiff', aif: 'aiff', htm: 'html', markdown: 'md', mpeg: 'mpg', heif: 'heic' } as Record<string, string>)[ext] ?? ext;
}
export function targets(input: string): string[] { return [...new Set(capabilities.filter(c => c.input === input).map(c => c.output))]; }
export function capability(input: string, output: string) {
  const found = capabilities.find(c => c.input === input && c.output === output);
  if (!found) throw new Error(`Conversion from ${input.toUpperCase()} to ${output.toUpperCase()} is not supported.`);
  return found;
}
export function validateOptions(value: unknown): ConversionOptions {
  if (!value || typeof value !== 'object') throw new Error('Invalid conversion options.');
  const o = value as ConversionOptions;
  if (!Number.isInteger(o.quality) || o.quality < 1 || o.quality > 100 || !['balanced', 'small', 'quality'].includes(o.preset) || !Number.isInteger(o.bitrate) || o.bitrate < 32 || o.bitrate > 320 || typeof o.acknowledgeLoss !== 'boolean') throw new Error('Invalid quality or bitrate.');
  for (const dim of [o.width, o.height]) if (dim !== undefined && (!Number.isInteger(dim) || dim < 1 || dim > 16384)) throw new Error('Dimensions must be between 1 and 16384 pixels.');
  return { quality: o.quality, preset: o.preset, bitrate: o.bitrate, width: o.width, height: o.height, acknowledgeLoss: o.acknowledgeLoss };
}
export function lossWarning(input: string, output: string): string | undefined {
  if (output === 'csv') return 'CSV exports only the first worksheet and removes formatting, formulas and other sheets.';
  if (images.includes(input) && ['jpg', 'bmp', 'ico'].includes(output)) return 'This format may remove transparency, reduce color depth or flatten animation.';
  if (['gif', 'tiff', 'ico'].includes(input) && images.includes(output) && !['gif', 'tiff'].includes(output)) return 'Only the first frame or page is exported to this image format.';
  if (['txt', 'md', 'fb2'].includes(output) && !['txt', 'md'].includes(input)) return 'Text conversion may remove formatting, images and layout.';
  return undefined;
}
