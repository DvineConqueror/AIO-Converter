import { access, readFile } from 'node:fs/promises';
const paths = ['ffmpeg/bin/ffmpeg.exe', 'ffmpeg/bin/ffprobe.exe', 'imagemagick/magick.exe', 'pandoc/pandoc.exe', 'poppler/bin/pdftoppm.exe', 'poppler/bin/pdftotext.exe', 'sevenzip/7z.exe', 'sevenzip/7z.dll', 'libreoffice/program/soffice.exe', 'libreoffice/program/soffice.com', 'libreoffice/program/vcruntime140.dll', 'libreoffice/program/msvcp140.dll', 'libreoffice/share/liblangtag/language-subtag-registry.xml'];
for (const path of paths) await access(`vendor/${path}`);
await readFile('vendor/engines.lock.json');
for (const path of ['yt-dlp/yt-dlp.exe', 'deno/deno.exe', 'yt-dlp/LICENSE.txt', 'yt-dlp/THIRD_PARTY_LICENSES.txt', 'deno/LICENSE.txt']) await access(`vendor/${path}`);
console.log('All bundled executables present.');
