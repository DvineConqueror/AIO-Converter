$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $workspace
$installTarget = [IO.Path]::GetFullPath((Join-Path $workspace '.cache/install-check'))
if (-not $installTarget.StartsWith($workspace + '\')) { throw 'Install target outside workspace' }
if (Test-Path -LiteralPath $installTarget) { throw 'Install test target already exists' }
$registered = Get-ItemProperty HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/* -ErrorAction SilentlyContinue | Where-Object DisplayName -EQ 'AIO Converter'
if ($registered) { throw 'An existing AIO Converter installation must be preserved' }
$releaseVersion = (Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json).version
$setup = Join-Path $workspace "release/AIO-Converter-Setup-$releaseVersion.exe"
$setupHash = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant()
$checks = [Collections.Generic.List[string]]::new()
try {
  $installer = Start-Process -FilePath $setup -ArgumentList @('/S', '--no-desktop-shortcut', "/D=$installTarget") -WindowStyle Hidden -Wait -PassThru
  if ($installer.ExitCode -ne 0) { throw "Installer exit $($installer.ExitCode)" }
  $appExe = Join-Path $installTarget 'AIO Converter.exe'
  if (-not (Test-Path -LiteralPath $appExe)) { throw 'Installed executable missing' }
  $checks.Add('Per-user full installer succeeds in a local test directory')
  $env:AIO_PACKAGED_EXE = $appExe
  & node scripts/verify-desktop.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Installed desktop checks failed' }
  $checks.Add('Installed app launches and passes all desktop checks')
  $env:AIO_ENGINE_ROOT = Join-Path $installTarget 'resources/engines'
  & npm run test:engines
  if ($LASTEXITCODE -ne 0) { throw 'Installed engine checks failed' }
  $checks.Add('All six installed engines perform real conversions')
} finally {
  $uninstaller = Join-Path $installTarget 'Uninstall AIO Converter.exe'
  if (Test-Path -LiteralPath $uninstaller) {
    $removed = Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
    for ($attempt = 0; $attempt -lt 100 -and (Test-Path -LiteralPath (Join-Path $installTarget 'AIO Converter.exe')); $attempt++) { Start-Sleep -Milliseconds 100 }
    if ($removed.ExitCode -ne 0 -or (Test-Path -LiteralPath (Join-Path $installTarget 'AIO Converter.exe'))) { throw 'Uninstaller did not remove application' }
    $checks.Add('Local silent uninstall removes installed application')
  }
  New-Item -ItemType Directory -Force output | Out-Null
  @{ environment = 'Current Windows host; network available; not a clean VM'; installerSha256 = $setupHash; checks = $checks.ToArray() } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath output/installer-checks.json
  Remove-Item Env:AIO_PACKAGED_EXE,Env:AIO_ENGINE_ROOT -ErrorAction SilentlyContinue
}
$checks
