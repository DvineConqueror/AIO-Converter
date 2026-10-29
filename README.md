# AIO Converter

An offline Windows 11 x64 file converter with optional online video/audio downloads. Free MIT application source; bundled engines keep their own licenses.

## Install

Run `release/AIO-Converter-Setup-0.2.0.exe`. The full installer contains Electron, ImageMagick, FFmpeg, LibreOffice, Poppler, Pandoc, 7-Zip, yt-dlp and Deno. Installation and local conversion do not download anything. No Microsoft Office installation or account is required.

The initial build is an **unsigned local release candidate**, not a cleared public release. Windows may show a reputation warning. Check RELEASE-CHECKLIST.md and VERIFICATION.md for the exact outstanding gates.

Installation is per user and creates a Start menu entry. To omit the desktop shortcut, launch the installer with `--no-desktop-shortcut` (for example, `& .\AIO-Converter-Setup-0.2.0.exe --no-desktop-shortcut` in PowerShell).

## Use

1. Add or drop files. Ctrl+O opens the file picker.
2. Choose each target format, or apply a format to compatible idle files.
3. Adjust quality/compression/size in the settings drawer if needed.
4. Choose an output folder and convert. Review any format-loss warnings first.
5. Reveal finished outputs in Explorer. Cancel or retry individual jobs as needed.

Original files are preserved. Existing outputs receive numbered suffixes. PDF page images are grouped into a result folder. Jobs are session-local; only theme and destination preferences persist.

See [SUPPORTED-FORMATS.md](SUPPORTED-FORMATS.md) for directional conversion coverage and limits.

## Download links

Open **Download links**, paste a public YouTube or supported website/media URL, choose **Video** or **Audio only**, select an extension, and press **Download**. Choose the destination in the bottom bar. Cancel, retry, remove or reveal individual items.

- Video: MP4, MKV, WebM, MOV; maximum 480p, 720p, 1080p or best available.
- Audio: MP3, M4A, WAV, FLAC, Opus, OGG; lossy exports use 192 kbps.
- One media item per link, serial download queue. Existing outputs receive numeric suffixes. Conversion cannot restore lost source quality.
- Internet is required for this workspace. Local conversion stays offline. No account access, browser-cookie import, DRM bypass, live stream capture, full playlists, browser extension or automatic updates.
- Site support can change. A direct media file URL is often the simplest fallback. Download media you own or have permission to save.

Public HTTP(S) URLs only, without embedded credentials or custom ports. Initial DNS addresses are checked; redirects and embedded media requests remain under the external downloader, not an OS network sandbox. Unknown-size media may exceed the upstream size estimate; keep sufficient free space. Downloads time out after two hours; conversion after 30 minutes. Queues and URLs remain session-local.

## Develop and rebuild

Requires Node.js 22+, npm, Windows 11 x64 and internet access **on the build machine** to acquire dependencies and engines.

```powershell
npm ci
npm run engines
npm test
npm run test:engines
npm run test:downloads
npm run test:matrix
npm run build
npm run dev
npm run pack
npm run dist
```

`npm run engines` downloads version-pinned engine archives, verifies known checksums, records initial acquisition hashes for remaining packages, and unpacks into ignored `vendor/`. Downloads are resumable. LibreOffice uses an MSI administrative extraction; it is not installed globally. Engine packages include large executables, dictionaries, fonts and runtime DLLs. Allow several GiB for cache, vendor, unpacked build and installer.

For a graphical preview, `npm run preview` starts Vite. Browser preview cannot convert or download files. Real operations require the Electron preload bridge.

`node scripts/verify-desktop.mjs` tests the built app with Playwright's Electron launcher. Set `AIO_PACKAGED_EXE` to an unpacked executable path to test packaged resources. Artifacts live under `output/`.

`node scripts/verify-downloads.mjs [path-to-packaged-exe]` checks native link downloads and captures the download workspace. `npm run test:downloads -- <public-media-url>` checks MP4, MP3, cancel and retry against a real link. Both use the network.

## Architecture

- `src/shared`: conversion routes and typed bridge contract.
- `src/core`: file validation, serial queue, process lifecycle, engine adapters, output publication.
- `src/main`: isolated desktop bridge, native dialogs and preferences.
- `src/renderer`: plain TypeScript DOM UI and accessible desktop styles.
- `scripts`: acquisition, build, fixtures, conversion matrix, desktop verification and checksums.

Engine arguments are built in the main process with shell execution disabled. Renderer has no Node integration, cannot navigate to external pages, and cannot issue external network requests. Office profiles disable macros/link updates. ImageMagick policies disable external delegates and dangerous coders. Archives are listed and checked before extraction and inspected again afterward.

External engine processes remain native programs running as the current user; this is not an OS-level malware sandbox. Keep dependencies patched and do not treat conversion as antivirus scanning.

## Release

GitHub Actions setup, first push and version-tag commands are in
[docs/GITHUB-SETUP.md](docs/GITHUB-SETUP.md). Pushes/PRs run source checks;
version tags build the full Windows installer and create a draft release.

`npm run dist` creates the full NSIS installer and a SHA-256 sidecar. Do not publish until all RELEASE-CHECKLIST.md gates are satisfied, including corresponding engine/dependency source materials and an offline clean-machine test. No auto-updater or telemetry is included. Website requests occur for downloads explicitly queued by the user.
