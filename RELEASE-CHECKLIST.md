# Release acceptance

- [x] All 319 advertised conversion pairs pass real fixtures using pinned engines. Packaged engine smoke checks recorded separately.
- [x] Packaged application passes file-dialog bridge, drag/drop, cancel, retry and output reveal (15 checks).
- [ ] Clean Windows 11 x64 VM: networking disabled, no Office/dev tools; install, convert every family, relaunch, uninstall.
- [x] Archive traversal, links, encryption and expansion budget verified by automated checks.
- [ ] Exact corresponding engine/dependency sources and build records archived with public release; include component notices and required offers/materials.
- [x] Installer SHA-256 recorded on final bytes; local prior-candidate install/launch/conversion/uninstall passed (scope in VERIFICATION.md).
- [ ] Physical disk-full, ACL-denied destinations, real screen reader and Windows text-scaling checks.
- [ ] Signing credentials and public distribution decision provided by maintainer. Unsigned candidate may show Windows reputation warnings.

Unchecked gates mean a local test candidate, not a public release.

## 0.2.0 download extension

- [x] yt-dlp and Deno are pinned by official release-asset SHA-256, included in application resources, with core and yt-dlp dependency notices.
- [x] Real YouTube and independent direct-media MP4/MP3 exports, duration/stream/resolution checks, failure isolation, cancel and retry.
- [x] Packaged app: nine native download checks and 15 converter checks pass; app.asar hash recorded.
- [x] Fresh design review fix resolved; incumbent design-system records preserved.
- [ ] Reinstall/uninstall the exact 0.2.0 installer on a clean Windows VM. Prior 0.1.0 installation evidence is not a new installer test.
- [ ] Complete exact corresponding source/dependency materials for the added download tools before public distribution, alongside the existing engine gate.
