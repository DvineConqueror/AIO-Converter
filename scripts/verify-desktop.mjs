import { _electron as electron } from 'playwright';
import { resolve, join } from 'node:path';
import { mkdir, writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const output = resolve('output/playwright'); await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'aio-desktop-check-'));
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const packaged = process.env.AIO_PACKAGED_EXE;
const app = await electron.launch({ executablePath: packaged ? resolve(packaged) : resolve('node_modules/electron/dist/electron.exe'), args: packaged ? [`--user-data-dir=${profile}`] : [resolve('.'), `--user-data-dir=${profile}`], env, timeout: 60000 });
const applicationPath = await app.evaluate(({ app }) => app.getAppPath());
const report = { packaged: !!packaged, executable: packaged ? resolve(packaged) : resolve('node_modules/electron/dist/electron.exe'), applicationSha256: packaged ? createHash('sha256').update(await readFile(applicationPath)).digest('hex') : null, checks: [], errors: [] };
try {
  const page = await app.firstWindow(); await page.waitForSelector('.dropzone');
  page.on('pageerror', error => report.errors.push(String(error)));
  const state = await page.evaluate(() => window.aio.state());
  assert.equal(state.jobs.length, 0); report.checks.push('trusted preload IPC state works');
  const settings = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]; const p = w.webContents.getLastWebPreferences(); return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration };
  });
  assert.deepEqual(settings, { sandbox: true, contextIsolation: true, nodeIntegration: false }); report.checks.push('renderer isolation enabled');
  await page.getByRole('button', { name: 'Supported formats', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search supported formats' }).fill('epub');
  assert.ok(await page.locator('#format-table tbody tr').count()); report.checks.push('format search works');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark'); report.checks.push('theme preference saved');
  await page.getByRole('button', { name: 'Convert files', exact: true }).first().click();
  await page.screenshot({ path: join(output, packaged ? 'packaged-dark.png' : 'electron-dark.png') });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.getByRole('button', { name: 'Convert files', exact: true }).first().click();
  const fixture = resolve('output/fixtures/sample.png');
  try { await readFile(fixture); } catch { throw new Error('Run test:engines before desktop conversion checks.'); }
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, fixture);
  await page.getByRole('button', { name: 'Add files', exact: true }).click();
  await page.waitForSelector('.file-row');
  assert.match(await page.locator('.file-identity strong').textContent(), /sample.png/); report.checks.push('native import bridge imports actual fixture');
  const destination = join(profile, 'converted');
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, destination);
  await page.locator('.destination').click();
  await page.getByRole('button', { name: /Target format for/ }).click();
  await page.getByRole('searchbox', { name: 'Search target formats' }).fill('webp');
  await page.getByRole('button', { name: 'Convert to WEBP', exact: true }).click();
  await page.getByRole('button', { name: 'Convert 1 file', exact: true }).click();
  await page.waitForSelector('.file-row.completed', { timeout: 60000 });
  const completed = (await page.evaluate(() => window.aio.state())).jobs[0];
  assert.equal(completed.status, 'completed'); assert.ok((await readFile(completed.outputPath)).length > 0); report.checks.push('real desktop PNG → WebP conversion');
  await page.getByRole('button', { name: /Show converted/ }).click(); report.checks.push('output reveal request succeeds');
  await page.screenshot({ path: join(output, packaged ? 'packaged-light.png' : 'electron-light.png') });
  await page.getByRole('button', { name: 'Clear completed', exact: true }).click();
  await page.evaluate(() => { const input = document.createElement('input'); input.type = 'file'; input.id = 'native-drop-fixture'; input.hidden = true; document.body.append(input); });
  await page.locator('#native-drop-fixture').setInputFiles(fixture);
  await page.evaluate(() => {
    const input = document.querySelector('#native-drop-fixture'); const transfer = new DataTransfer(); transfer.items.add(input.files[0]);
    document.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer })); input.remove();
  });
  await page.waitForSelector('.file-row.ready'); report.checks.push('actual File drag/drop bridge works');
  await page.getByRole('button', { name: /Settings for/ }).click();
  await page.locator('#width').fill('32'); await page.locator('#height').fill('24'); await page.locator('#height').press('Tab');
  await page.screenshot({ path: join(output, packaged ? 'packaged-settings.png' : 'electron-settings.png') });
  await page.getByRole('button', { name: 'Close settings', exact: true }).click(); report.checks.push('per-file resize settings saved');
  await page.getByRole('button', { name: /Target format for/ }).click();
  await page.getByRole('searchbox', { name: 'Search target formats' }).fill('webp');
  await page.getByRole('button', { name: 'Convert to WEBP', exact: true }).click();
  await page.getByRole('button', { name: 'Convert 1 file', exact: true }).click();
  await page.waitForSelector('.file-row.completed', { timeout: 60000 });
  const second = (await page.evaluate(() => window.aio.state())).jobs[0];
  assert.notEqual(second.outputPath, completed.outputPath); assert.match(second.outputPath, /\(1\)/); report.checks.push('existing result preserved with numeric suffix');
  await page.getByRole('button', { name: 'Clear completed', exact: true }).click();
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, fixture);
  await page.getByRole('button', { name: 'Add files', exact: true }).click();
  await page.evaluate(async () => { await window.aio.start(); const job = (await window.aio.state()).jobs[0]; await window.aio.cancel(job.id); });
  await page.waitForSelector('.file-row.cancelled');
  await page.getByRole('button', { name: /Retry / }).click(); await page.waitForSelector('.file-row.ready'); report.checks.push('cancel and retry operate through desktop IPC');
  await page.evaluate(async () => {
    for (const value of [{ theme: 'invalid' }, { theme: 'light', destination: 'C:\\forbidden' }]) {
      let rejected = false; try { await window.aio.preferences(value); } catch { rejected = true; } if (!rejected) throw new Error('Invalid preference accepted');
    }
  }); report.checks.push('invalid IPC preferences rejected');
  const untrusted = await app.evaluate(async ({ BrowserWindow, app }) => {
    const other = new BrowserWindow({ show: false, webPreferences: { preload: `${app.getAppPath()}/dist-electron/preload.cjs`, sandbox: true, contextIsolation: true, nodeIntegration: false } });
    try { await other.loadURL('data:text/html,<html><body>Untrusted frame</body></html>'); return await other.webContents.executeJavaScript('Promise.resolve().then(() => window.aio.state()).then(() => "accepted", error => String(error))'); }
    finally { other.destroy(); }
  }); assert.match(untrusted, /Untrusted application frame/); report.checks.push('untrusted window IPC rejected');
  const window = await app.browserWindow(page); await window.evaluate(w => w.setSize(820, 600));
  await page.screenshot({ path: join(output, packaged ? 'packaged-small.png' : 'electron-small.png') });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Add files', exact: true }).focus();
  await page.screenshot({ path: join(output, packaged ? 'packaged-accessibility.png' : 'electron-accessibility.png') }); report.checks.push('minimum window and high contrast captures');
  assert.equal(report.errors.length, 0); report.checks.push('no renderer exceptions');
} finally {
  await app.close();
  await writeFile(join(output, packaged ? 'packaged-checks.json' : 'electron-checks.json'), JSON.stringify(report, null, 2));
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
console.log(JSON.stringify(report, null, 2));
