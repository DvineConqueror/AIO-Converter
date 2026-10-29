import { app, BrowserWindow, dialog, ipcMain, shell, session } from 'electron';
import { join, resolve } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Queue } from '../core/queue';
import { Engines } from '../core/engines';
import { Downloads } from '../core/downloads';
import { capabilities, targets } from '../shared/capabilities';
import type { Preferences } from '../shared/types';

let window: BrowserWindow | undefined;
let queue: Queue;
let downloads: Downloads;
let quitting = false;
let confirmingQuit = false;
let preferences: Preferences;
const devURL = !app.isPackaged ? process.env.AIO_DEV_URL : undefined;
if (devURL && devURL !== 'http://127.0.0.1:5173') throw new Error('Unexpected development origin.');
app.commandLine.appendSwitch('disable-background-networking');
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });

async function persist() {
  const dir = app.getPath('userData'); await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'preferences.json'), JSON.stringify(preferences, null, 2));
}
function register(channel: string, handler: (...args: any[]) => any) {
  ipcMain.handle(`aio:${channel}`, (event, ...args) => {
    const expectedURL = devURL ?? pathToFileURL(join(__dirname, '../dist/index.html')).href;
    if (!window || event.sender !== window.webContents || !event.senderFrame || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url.split('#')[0] !== expectedURL) throw new Error('Untrusted application frame.');
    return handler(...args);
  });
}
app.whenReady().then(async () => {
  preferences = { destination: join(app.getPath('documents'), 'AIO Converter'), theme: 'system' };
  try {
    const saved = JSON.parse(await readFile(join(app.getPath('userData'), 'preferences.json'), 'utf8'));
    if (['system', 'light', 'dark'].includes(saved.theme)) preferences.theme = saved.theme;
    if (typeof saved.destination === 'string' && resolve(saved.destination) === saved.destination) preferences.destination = saved.destination;
  } catch {}
  const engines = new Engines(app.isPackaged ? join(process.resourcesPath, 'engines') : resolve('vendor'));
  queue = new Queue(engines, () => preferences.destination);
  downloads = new Downloads(engines, () => preferences.destination);
  register('state', async () => ({ jobs: queue.snapshot(), downloads: downloads.snapshot(), downloadAvailable: await downloads.available(), preferences, engines: await engines.status() }));
  register('download', value => downloads.add(value));
  register('download-action', (id, action) => {
    if (!['cancel', 'retry', 'remove', 'reveal'].includes(action)) throw new Error('Invalid download action.');
    if (action === 'reveal') {
      const job = downloads.get(id);
      if (job.status !== 'completed' || !job.outputPath) throw new Error('No completed download.');
      shell.showItemInFolder(job.outputPath);
    } else if (action === 'cancel') downloads.cancel(id);
    else if (action === 'retry') downloads.retry(id);
    else downloads.remove(id);
  });
  downloads.on('jobs', jobs => { if (window && !window.isDestroyed()) window.webContents.send('aio:downloads', jobs); });
  register('capabilities', () => capabilities);
  register('import', async () => {
    const result = await dialog.showOpenDialog(window!, { title: 'Choose files to convert', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Convertible files', extensions: [...new Set(capabilities.map(c => c.input).filter(e => !e.includes('.'))), 'jpeg', 'tif', 'aif', 'htm', 'tgz', 'gz', 'heif', 'mpeg'] }, { name: 'All files', extensions: ['*'] }] });
    return result.canceled ? queue.snapshot() : queue.add(result.filePaths);
  });
  register('drop', (paths: unknown) => queue.add(paths));
  register('destination', async () => {
    const result = await dialog.showOpenDialog(window!, { title: 'Save converted files to', defaultPath: preferences.destination, properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled) return null;
    preferences.destination = result.filePaths[0]; await persist(); return preferences.destination;
  });
  register('preferences', async (value: unknown) => {
    if (!value || typeof value !== 'object' || !['system', 'light', 'dark'].includes((value as Preferences).theme) || Object.keys(value).some(k => k !== 'theme')) throw new Error('Invalid preferences.');
    preferences.theme = (value as Preferences).theme; await persist(); return preferences;
  });
  register('configure', (id, target, options) => queue.configure(id, target, options));
  register('start', () => queue.start()); register('cancel', id => queue.cancel(id)); register('retry', id => queue.retry(id));
  register('remove', id => queue.remove(id)); register('clear', () => queue.clearCompleted());
  register('reveal', id => { const { view } = queue.get(id); if (view.status !== 'completed' || !view.outputPath) throw new Error('No completed output for this file.'); shell.showItemInFolder(view.outputPath); });
  queue.on('jobs', event => { if (window && !window.isDestroyed()) window.webContents.send('aio:jobs', event); });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const allowed = url.protocol === 'file:' || url.protocol === 'data:' || url.protocol === 'blob:' || (devURL && ['http:', 'ws:'].includes(url.protocol) && url.host === '127.0.0.1:5173');
    callback({ cancel: !allowed });
  });
  window = new BrowserWindow({ width: 1180, height: 820, minWidth: 820, minHeight: 600, title: 'AIO Converter', backgroundColor: '#f5f6f8', autoHideMenuBar: true, show: false, webPreferences: { preload: join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.on('close', event => { if (!quitting && (queue.busy || downloads.busy)) { event.preventDefault(); void confirmQuit(); } });
  window.once('ready-to-show', () => window?.show());
  if (devURL) await window.loadURL(devURL); else await window.loadFile(join(__dirname, '../dist/index.html'));
}).catch(error => { dialog.showErrorBox('AIO Converter could not start', String(error)); app.exit(1); });

app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (quitting || !(queue?.busy || downloads?.busy)) return;
  event.preventDefault();
  void confirmQuit();
});
async function confirmQuit() {
  if (confirmingQuit) return;
  confirmingQuit = true;
  try {
    const answer = await dialog.showMessageBox({ type: 'question', title: 'Work in progress', message: 'Cancel remaining conversions and downloads, then quit?', detail: 'Your original files are preserved. Incomplete outputs will be removed.', buttons: ['Keep working', 'Cancel and quit'], defaultId: 0, cancelId: 0 });
    if (answer.response === 1) { await Promise.all([queue.close(), downloads.close()]); quitting = true; app.quit(); }
  } finally { confirmingQuit = false; }
}
