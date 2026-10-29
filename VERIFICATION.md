# Verification — 0.2.0 local candidate

## Download extension — 2026-10-29

- Production TypeScript/Vite/Electron build passes; 20 automated core/security tests pass, including download URL/settings validation, public DNS address checks, remote-title filename safety and missing-tool handling.
- Real YouTube link and separate direct MP4 link each pass MP4 and MP3 export with readable streams/duration, a 720p output ceiling, failure isolation, cancellation during native downloading and retry with collision-safe output. Reports: `output/download-youtube-test-results.json` and `output/download-direct-test-results.json`.
- Nine native Electron download UI checks pass: Video/Audio extensions, invalid IPC URL rejection, actual MP3 download, form value/focus persistence, output reveal, expanded error and summary focus during another real download, failed-link feedback, themes/minimum window/high contrast, unchanged offline converter status and no renderer errors. See `output/playwright/downloads-checks.json`.
- Existing 15 local-conversion Electron checks pass again. The conversion adapters and pinned conversion engine binaries are unchanged; the 319-pair result below is retained from 0.1.0, rather than claimed as a new exhaustive run. The shared process timeout error wording was generalized for downloads.
- yt-dlp 2026.10.26 standalone Windows executable includes EJS; Deno 2.9.8 is bundled. Both archives match SHA-256 digests published with their official GitHub release assets. No runtime tool download, self-update, user configuration or external plugin loading is enabled.
- The final packaged app passes the nine download UI checks and 15 existing converter checks. Both reports identify app.asar SHA-256 `67a9b61723df3079db2811a4a39c206b62e20e9dc1b7a2903b113457c931da90`. Packaged yt-dlp and Deno bytes match the pinned vendor executables. Reports: `output/playwright/downloads-packaged-checks.json` and `output/playwright/packaged-checks.json`.
- All six conversion engines also pass seven fresh representative conversions from 0.2.0 packaged resource paths: PNG→WebP, WAV→MP3, MP4→WebM, DOCX→PDF, PDF→PNG pages, Markdown→EPUB and ZIP→7Z. Report: `output/smoke-results.json`.
- The fresh Impeccable review found one disclosure/focus persistence issue. It was fixed, recaptured and scored **resolved**, disposition **ship** at that fix's scope. Original review and verdict: `.impeccable/review/DOWNLOADS-VERDICT.md`. The documenter compared this extension with the incumbent design and preserved DESIGN.md and design.json; see `DOWNLOADS-DESIGN-NOTE.md` beside the verdict.
- This remains an unsigned local candidate. The 0.2.0 installer itself has not been installed/uninstalled again; only its packaged application/resources were retested. The earlier installation evidence below belongs to 0.1.0. Clean-machine and public-distribution gates remain open.
- Full installer built successfully: `AIO-Converter-Setup-0.2.0.exe`, 818,994,161 bytes (781.1 MiB), product version 0.2.0. SHA-256: `ce7cc2fbf5efe23c8ee75b825f325a679cd9793445bce6398a2805c2822f5494`. The sidecar is beside the installer. Updated MIT application source is `AIO-Converter-Source-0.2.0.zip` with its own checksum; pinned engine records and test reports accompany the candidate.

## Previous 0.1.0 evidence

Tested on Windows 11 x64, build 26200, 2026-10-28. This host has developer tools and Microsoft Office; all test commands explicitly use bundled engines. This is not clean-machine evidence.

## Passed

- TypeScript check and production Vite/Electron build.
- 16 automated core/security tests: directional routes, option validation, corrupt/mislabeled inputs, archive traversal/links/encryption, expansion budget, Unicode/long paths, collisions, unchanged originals, per-job failure isolation/retry, changed-source detection, blocked remote references, cancellation cleanup including output publication, and actual owned child-process termination.
- All **319/319** explicit conversion pairs with real fixtures; no failures or unverified routes. `output/matrix/results.json` contains individual results. Cache reuse requires matching source content, engine executable and conversion/validation code hashes.
- Matrix checks reopen images and inspect dimensions, probe media streams/duration, inspect PDF page counts and Office PDF text, check Office/ebook text, and verify archive members. Original fixture hashes remain unchanged.
- Seven representative conversions covering all six engines, including Office and PDF, from final packaged engine paths.
- 15 packaged Electron checks: isolated renderer, trusted bridge, searchable formats, saved theme, native-dialog bridge, PNG→WebP, reveal, actual File drag/drop, resize settings, collision suffix, cancel/retry, invalid preference rejection, foreign-window IPC rejection, minimum-window/high-contrast captures and no renderer exceptions.
- Fresh Impeccable review: **ship**, scoped to five captures and renderer source. See `.impeccable/review/VERDICT.md`. Design tokens recorded in DESIGN.md and `.impeccable/design.json`.
- LibreOffice MSI SHA-256 matches the publisher's checksum and its Authenticode signature validates as The Document Foundation. Other acquired archive hashes are pinned in engines.lock.json.

## Installer checks

- Full per-user NSIS installer built: `AIO-Converter-Setup-0.1.0.exe`, 762,330,296 bytes (727 MiB). Final SHA-256: `378cc63a70964d4825aca3d72247ff339dd1e9a175eb5b98befa0c97b1bda536`.
- Local silent install, installed-app launch/15 desktop checks, seven real conversions across all six installed engines, and uninstall passed. No AIO Converter uninstall registration remains afterward.
- Scope: that install test used the immediately preceding candidate (`65540c7f3d6b0ebfd79f4950b1b8fb461dda60a9ec41481a343a26b8961c5667`), before the Calc profile correction. The corrected packaged app passed separately. Engine assets and installer configuration are unchanged; the final installer itself was not reinstalled. See `release/installer-checks.json` for provenance.
- Installation takes several minutes on this host because the full bundle contains roughly 20,000 resource files. No installer or conversion benchmark is claimed.

## Limits and outstanding acceptance

- Clean Windows 11 x64 VM with networking disabled, no Office and no developer tools: not available in this session. A local installer test does not replace it.
- Full corresponding engine/dependency sources and exact upstream build materials: not assembled. `release/engine-build-records.json` records versions, FFmpeg build flags, executable/DLL hashes and file inventory; upstream links alone are insufficient for public redistribution. See THIRD-PARTY-NOTICES.md.
- No signing credentials; installer is unsigned. No public publication performed.
- Fixtures are small representative files, not a fidelity benchmark or exhaustive coverage of every codec, document feature, font, animation or damaged-file variant. Complex Office layout and fonts can change.
- Physical disk-full and ACL-denied destination tests, assistive-technology testing with a real screen reader, Windows text-scaling extremes and cross-machine performance remain manual checks.
- Native conversion engines run as the current user. Renderer isolation, protocol/policy restrictions and input validation do not constitute an OS malware sandbox.

## Reproduce

```powershell
npm ci
npm run engines
npm test
npm run test:matrix
npm run build
node scripts/verify-desktop.mjs
$env:CSC_IDENTITY_AUTO_DISCOVERY='false'
$env:ELECTRON_BUILDER_COMPRESSION_LEVEL='3'
npm run dist
$env:AIO_PACKAGED_EXE='release/win-unpacked/AIO Converter.exe'
node scripts/verify-desktop.mjs
$env:AIO_ENGINE_ROOT='release/win-unpacked/resources/engines'
npm run test:engines
node scripts/build-records.mjs
node scripts/source-archive.mjs
```
