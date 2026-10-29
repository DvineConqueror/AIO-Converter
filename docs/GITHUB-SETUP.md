# Git and Windows release automation

Git is initialized on `main`. Source and lockfiles belong in Git; dependencies,
downloaded engines, caches, fixtures, generated installers, local environment
files and signing keys are ignored. Do not add installers with `git add -f` or Git LFS;
the release workflow uploads them as downloadable assets.

## 1. Save and push the source

Create an **empty private GitHub repository**, without a README, license or
gitignore. Private is appropriate while the third-party redistribution gates in
RELEASE-CHECKLIST.md remain open. Then run in PowerShell:

```powershell
Set-Location C:\Users\domin\Coding\AIO-Converter
git status --short
git add .
git diff --cached --stat
git commit -m "feat: initialize AIO Converter with Windows release automation"
git remote add origin https://github.com/YOUR-USERNAME/AIO-Converter.git
git push -u origin main
```

Replace `YOUR-USERNAME`. Authentication uses your Git credential manager or SSH;
never put a token into the remote URL. If Git requests an identity, set your own
name and GitHub verified/noreply email with `git config user.name` and
`git config user.email` before committing. Existing identity settings are preserved.

## 2. Enable checks

In GitHub **Settings → Actions → General**, allow GitHub Actions and the pinned
official `actions/*` actions. No repository secrets are required for unsigned
builds. The release job requests `contents: write` for the built-in GITHUB_TOKEN;
an organization policy may need to permit that permission.

In **Settings → Rules → Rulesets**, protect `main`, require pull requests and the
`Windows source checks` status after its first successful run, and block force
pushes. These server settings are manual; adding workflow YAML does not enable them.

### What runs

| Trigger | Result |
|---|---|
| Push to `main`, any PR, manual CI run | Windows `npm ci`, tests, TypeScript/production build, high/critical dependency audit |
| Actions → Windows installer → Run workflow | Full Windows x64 installer as a workflow artifact; no GitHub Release |
| Push a matching `v<package.json version>` tag | Same verified candidate, then a published GitHub Release with the Windows installer attached |

Source checks do not acquire the large native bundle; two engine-dependent archive
tests explicitly skip there. The installer job acquires it first and runs those
tests, all advertised conversion pairs, packaged engine smoke tests and packaged
local-converter desktop checks. Public-site download tests remain manual to avoid
website/network availability determining release build success:

```powershell
npm run test:downloads
npm run test:downloads -- 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
node scripts/verify-downloads.mjs 'release/win-unpacked/AIO Converter.exe'
```

The full job uses `windows-2025`, Node 22, versioned/checksummed upstream binaries,
the runner's installed 7-Zip for initial extraction, and commit-pinned actions.
Only npm downloads are cached. Engine archives are reacquired and hash-checked on
each installer run; upstream removals, rate limits or changed download endpoints
can fail acquisition. Update versions, URLs and hashes together when necessary.
GitHub Actions minutes/storage quotas apply; the installer is about 0.8 GB and the
full build can take tens of minutes. Candidate artifacts expire after 14 days;
failure diagnostics after 7. GitHub Releases retain uploaded assets separately.

### Missing Electron runtime during packaging

Electron 45's npm package does not automatically download its desktop runtime.
This project explicitly invokes its installer through the root `postinstall`,
so `npm ci` creates `node_modules/electron/dist` before packaging. Do not use
`npm ci --ignore-scripts` for desktop builds. The runtime download is needed on
the build machine; the resulting application installer remains self-contained.

If an older tag failed with `The specified electronDist does not exist`, commit
the fix on main and build a new version/tag. Re-running the old workflow uses
the old tagged source and cannot pick up a fix on main. A manual run on main
can first verify the fix without creating a release.

## 3. Build the current release candidate

After the first commit and push, version 0.2.0 is already in package.json:

```powershell
git tag -a v0.2.0 -m "AIO Converter 0.2.0 candidate"
git push origin v0.2.0
```

The tag must exactly match the package version. A tag such as `v0.3.0` while the
package is 0.2.0 fails before expensive acquisition. For the next version:

```powershell
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: prepare next patch release"
git push origin main
$releaseVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
git tag -a "v$releaseVersion" -m "AIO Converter $releaseVersion candidate"
git push origin "v$releaseVersion"
```

In **Actions → Windows installer**, download the `AIO-Converter-Windows-x64`
artifact. On tag runs, the same installer, checksums, MIT app source ZIP, binary
inventory, notices and current-run test reports appear under **Releases**.
The job validates installer/source checksums, uploads assets while the release is
still a draft, then publishes it and marks it latest. Re-running an already
published tag keeps its assets unchanged; use a new version/tag for changes.

Earlier workflow versions stopped at a draft release. A successful job named
"Attach candidate to draft release" therefore did not make a publicly visible
release. v0.2.1 was published from its existing verified draft; newer tag builds
using the updated workflow publish automatically.

Check the installer checksum after extraction:

```powershell
Get-FileHash .\AIO-Converter-Setup-0.2.0.exe -Algorithm SHA256
Get-Content .\AIO-Converter-Setup-0.2.0.exe.sha256
```

Matching version-tag pushes now authorize automatic public publication; manual
workflow runs only build artifacts. No code signing is configured. Maintainers
remain responsible for clean-machine checks and engine/dependency source
obligations before pushing release tags. The app source ZIP does not satisfy
the bundled engines' corresponding-source requirements. CI-CANDIDATE.md records
the actual CI commit/run; VERIFICATION.md contains earlier local evidence.

## Local equivalent

```powershell
npm ci
npm run engines
npm test
npm run test:matrix
$env:ELECTRON_BUILDER_COMPRESSION_LEVEL = '3'
npm run dist
$env:AIO_ENGINE_ROOT = (Resolve-Path release/win-unpacked/resources/engines).Path
npm run test:engines
$env:AIO_PACKAGED_EXE = (Resolve-Path 'release/win-unpacked/AIO Converter.exe').Path
node scripts/verify-desktop.mjs
node scripts/build-records.mjs
node scripts/source-archive.mjs
```

`npm run dist` explicitly disables electron-builder's automatic publishing. Only
the dedicated tag job publishes the GitHub Release, after build and verification
succeed and the assets have been uploaded.
