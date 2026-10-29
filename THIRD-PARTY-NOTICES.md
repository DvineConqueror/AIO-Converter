# Third-party software

AIO Converter application code is MIT licensed. Bundled programs retain their own licenses; the app license does not relicense them. They run as separate executables.

| Program | License | Upstream |
|---|---|---|
| Electron / Chromium / Node.js | MIT / BSD and included notices | https://www.electronjs.org/ |
| FFmpeg (BtbN GPL shared build) | GPLv3+ and included dependency terms | https://ffmpeg.org/legal.html |
| ImageMagick | ImageMagick license and delegate terms | https://imagemagick.org/license/ |
| LibreOffice | MPL 2.0 and included component terms | https://www.libreoffice.org/licenses/ |
| Pandoc | GPLv2+ | https://pandoc.org/ |
| Poppler and dependencies | GPLv2+ and included component terms | https://poppler.freedesktop.org/ |
| 7-Zip | LGPLv2.1+, BSD, unRAR restriction | https://www.7-zip.org/license.txt |
| yt-dlp 2026.10.26 Windows executable (includes EJS) | GPLv3+ combined executable; Unlicense core and included dependency terms | https://github.com/yt-dlp/yt-dlp/blob/2026.10.26/THIRD_PARTY_LICENSES.txt |
| Deno 2.9.8 | MIT and included dependency terms | https://github.com/denoland/deno/tree/v2.9.8 |

Exact binary versions, download URLs and SHA-256 values are in engines.lock.json. Original engine package notices are retained alongside the binaries in resources/engines. Chromium notices ship with Electron.

## Public distribution gate

This local unsigned release candidate must not be published until corresponding source, dependency source and build records for the exact GPL/LGPL binaries have been assembled and checked. Upstream home-page links alone do not discharge source obligations. See RELEASE-CHECKLIST.md. No claim of legal clearance or codec patent clearance is made.
