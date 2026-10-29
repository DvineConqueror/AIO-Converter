import './style.css';
import { renderDownloads } from './downloads';
import { icon } from './icons';
import { audio, capabilities, capability, images, lossWarning } from '../shared/capabilities';
import type { AppState, ConversionJob, ConversionOptions } from '../shared/types';

const api = window.aio;
let state: AppState = { jobs: [], downloads: [], downloadAvailable: false, preferences: { destination: '', theme: 'system' }, engines: [] };
let page: 'convert' | 'downloads' | 'formats' | 'settings' = 'convert';
let selected: string | undefined;
let pickerJob: string | undefined;
let pending = false;
const root = document.querySelector<HTMLDivElement>('#app')!;
const esc = (v: unknown) => String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const bytes = (n: number) => n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(1)} GB`;
const familyIcon = (j: ConversionJob) => (({ Images: 'image', Audio: 'audio', Video: 'video', Archives: 'archive' } as Record<string, string>)[j.family] ?? 'file');
function toast(message: string, error = false) {
  const el = document.querySelector<HTMLDivElement>('#toast')!;
  el.textContent = message.replace(/^Error invoking remote method '[^']+': Error: /, ''); el.classList.toggle('error', error); el.hidden = false;
}
async function action(work: () => Promise<unknown>) {
  if (!api) { toast('Open the installed desktop app to convert files. Browser preview is for design review only.', true); return; }
  try { await work(); } catch (error) { toast((error as Error).message, true); }
}
function button(label: string, actionName: string, glyph: string, cls = '') { return `<button class="${cls}" data-action="${actionName}" aria-label="${esc(label)}" title="${esc(label)}">${icon(glyph)}<span>${esc(label)}</span></button>`; }

function shell() {
  root.innerHTML = `<aside class="sidebar">
    <a class="brand" href="#convert" aria-label="AIO Converter">${icon('convert')}<span>AIO<span class="brand-detail">Converter</span></span></a>
    <nav aria-label="Application"><button data-page="convert" class="nav-item">${icon('convert')}<span>Convert files</span><span id="nav-count" class="count" hidden>0</span></button><button data-page="downloads" class="nav-item">${icon('video')}<span>Download links</span></button><button data-page="formats" class="nav-item">${icon('grid')}<span>Supported formats</span></button><button data-page="settings" class="nav-item">${icon('settings')}<span>Settings</span></button></nav>
    <div class="sidebar-bottom"><div class="privacy-mark">${icon('shield')}<div>Local files stay local<small>Links use the internet.</small></div></div><div class="version"><span>AIO Converter</span><span>0.2.0</span></div></div>
  </aside>
  <main><header class="toolbar"><div class="breadcrumb">AIO Converter<span>/</span><strong id="page-name">Convert files</strong></div><span class="local-status"><i></i> Offline & local</span></header><div id="content"></div><div id="bottom-bar"></div></main>
  <aside id="drawer" class="drawer" aria-label="Conversion settings" hidden></aside>
  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  <div id="picker" class="target-picker" popover="auto"><label class="search-box">${icon('search')}<input id="target-search" type="search" placeholder="Find a format…" aria-label="Search target formats" autocomplete="off"></label><div id="target-results" class="target-results"></div></div>
  <dialog id="loss-dialog"><div class="dialog-icon">${icon('info')}</div><h2>Before you convert</h2><p>These format changes may remove information. Your originals will stay unchanged.</p><ul id="loss-list"></ul><div class="dialog-actions"><button data-action="close-loss">Review files</button><button class="primary" data-action="accept-loss">Convert anyway</button></div></dialog>
  <div id="announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>`;
  root.addEventListener('click', onClick);
  document.querySelector<HTMLInputElement>('#target-search')!.addEventListener('input', renderPicker);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'o') { event.preventDefault(); void action(() => api.importFiles()); }
    if (event.key === 'Escape') { document.querySelector<HTMLElement>('#toast')!.hidden = true; if (selected) { selected = undefined; renderDrawer(); } }
  });
  document.addEventListener('dragover', event => { event.preventDefault(); document.querySelector('#dropzone')?.classList.add('drag-over'); });
  document.addEventListener('dragleave', event => { if (!event.relatedTarget) document.querySelector('#dropzone')?.classList.remove('drag-over'); });
  document.addEventListener('drop', event => {
    event.preventDefault(); document.querySelector('#dropzone')?.classList.remove('drag-over');
    if (event.dataTransfer?.files.length) void action(() => api.importDropped([...event.dataTransfer!.files]));
  });
  document.querySelector('#drawer')!.addEventListener('change', saveDrawer);
}

function render() {
  document.documentElement.dataset.theme = state.preferences.theme;
  document.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(el => { const active = el.dataset.page === page; el.classList.toggle('active', active); if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
  const title = page === 'convert' ? 'Convert files' : page === 'downloads' ? 'Download links' : page === 'formats' ? 'Supported formats' : 'Settings';
  document.querySelector('#page-name')!.textContent = title;
  document.querySelector('.local-status')!.innerHTML = page === 'downloads' ? '<i></i> Internet required' : '<i></i> Offline & local';
  const count = document.querySelector<HTMLElement>('#nav-count')!; count.hidden = !state.jobs.length; count.textContent = String(state.jobs.length);
  const content = document.querySelector('#content')!;
  const scroll = content.scrollTop;
  if (page === 'convert') renderConvert(content);
  else if (page === 'downloads') renderDownloads(content, state, action);
  else if (page === 'formats') renderFormats(content);
  else renderSettings(content);
  content.scrollTop = scroll;
  renderBar(); renderDrawer();
}
function renderConvert(content: Element) {
  const missing = state.engines.filter(e => !e.available);
  content.innerHTML = `<section class="workspace"><div class="page-heading"><div><h1>Change the format.<br><span>Keep the possibilities.</span></h1><p>One place for your everyday file conversions.</p></div><div class="heading-symbol">${icon('convert')}</div></div>
    ${!api ? '<div class="notice">Design preview · Open the desktop app for real conversions.</div>' : missing.length ? `<div class="notice error">Missing engine: ${esc(missing.map(e => e.id).join(', '))}. Reinstall the full offline package.</div>` : ''}
    <button id="dropzone" class="dropzone ${state.jobs.length ? 'compact' : ''}" data-action="import"><span class="drop-symbol">${icon('upload')}</span><span class="drop-copy"><strong>Drop your files here</strong><span>or <u>browse files</u> to get started</span></span><span class="drop-hint">Multiple files. Mixed formats. All welcome.</span></button>
    <div class="family-strip" aria-label="Conversion families">${[['image', 'Images'], ['video', 'Video'], ['audio', 'Audio'], ['file', 'Documents'], ['archive', 'Archives']].map(([i, t]) => `<span>${icon(i)}${t}</span>`).join('')}<button data-page="formats">See all formats ${icon('arrow')}</button></div>
    <section class="queue-section" aria-labelledby="queue-title"><div class="section-heading"><div><h2 id="queue-title">Conversion queue</h2><span class="subtle">${state.jobs.length} ${state.jobs.length === 1 ? 'file' : 'files'}</span></div><div class="queue-tools">${state.jobs.length ? button('Apply format', 'batch-format', 'convert', 'quiet small') : ''}${button('Add files', 'import', 'plus', 'quiet small')}${state.jobs.some(j => j.status === 'completed') ? button('Clear completed', 'clear', 'check', 'quiet small') : ''}</div></div>
    ${state.jobs.length ? `<div class="queue-labels"><span>File</span><span>Convert to</span><span>Status</span><span class="sr-only">Actions</span></div><div id="queue-list">${state.jobs.map(row).join('')}</div>` : `<div class="empty-queue">${icon('file')}<div><strong>A clean slate.</strong><span>Files you add will appear here, ready to convert.</span></div><kbd>Ctrl O</kbd></div>`}</section>
    <div class="reassurance">${icon('shield')}<span>Your files stay yours. Originals are never replaced.</span></div></section>`;
}
function row(j: ConversionJob) {
  const editable = ['ready', 'failed', 'cancelled'].includes(j.status);
  const status = ({ ready: 'Ready', queued: 'Waiting', running: j.message ? 'Cancelling…' : j.progress === undefined ? 'Converting…' : `${j.progress}%`, completed: 'Done', cancelled: 'Cancelled', failed: 'Failed' })[j.status];
  return `<article class="file-row ${j.status}" data-job="${esc(j.id)}"><div class="file-identity"><span class="file-symbol ${familyIcon(j)}">${icon(familyIcon(j))}</span><div><strong title="${esc(j.name)}">${esc(j.name)}</strong><span>${esc(j.extension.toUpperCase())}<b>·</b>${bytes(j.size)}</span></div></div><button class="format-button" data-action="pick" ${editable ? '' : 'disabled'} aria-label="Target format for ${esc(j.name)}">${esc(j.target.toUpperCase())}${icon('chevron')}</button><div class="file-status"><span class="status-${j.status}">${j.status === 'completed' ? icon('check') : ''}${esc(status)}</span>${j.status === 'running' ? `<progress ${j.progress === undefined ? '' : `value="${j.progress}"`} max="100" aria-label="Converting ${esc(j.name)}"></progress>` : ''}${j.message && j.status === 'failed' ? `<button class="error-details" data-action="details">View error</button>` : ''}</div><div class="row-actions">${j.status === 'completed' ? `<button class="icon-button" data-action="reveal" title="Show converted file" aria-label="Show converted ${esc(j.name)}">${icon('folder')}</button>` : ['running', 'queued'].includes(j.status) ? `<button class="icon-button" data-action="cancel" title="Cancel conversion" aria-label="Cancel ${esc(j.name)}">${icon('stop')}</button>` : `${['failed', 'cancelled'].includes(j.status) ? `<button class="icon-button" data-action="retry" title="Retry" aria-label="Retry ${esc(j.name)}">${icon('retry')}</button>` : ''}<button class="icon-button" data-action="options" title="Conversion settings" aria-label="Settings for ${esc(j.name)}">${icon('settings')}</button>`}${!['running', 'queued'].includes(j.status) ? `<button class="icon-button" data-action="remove" title="Remove from queue" aria-label="Remove ${esc(j.name)}">${icon('close')}</button>` : ''}</div></article>`;
}
function renderBar() {
  const bar = document.querySelector('#bottom-bar')!;
  if (page === 'downloads') { bar.innerHTML = `<footer class="conversion-bar"><button class="destination" data-action="destination" title="${esc(state.preferences.destination)}">${icon('folder')}<span><small>Save downloads to</small><strong>${esc(state.preferences.destination || 'Documents / AIO Converter')}</strong></span>${icon('chevron')}</button><span class="subtle download-local-note">${icon('shield')} Converted on this device</span></footer>`; return; }
  if (page !== 'convert') { bar.innerHTML = ''; return; }
  const ready = state.jobs.filter(j => j.status === 'ready').length;
  const running = state.jobs.some(j => ['running', 'queued'].includes(j.status));
  bar.innerHTML = `<footer class="conversion-bar"><button class="destination" data-action="destination" title="${esc(state.preferences.destination)}">${icon('folder')}<span><small>Save converted files to</small><strong>${esc(state.preferences.destination || 'Documents / AIO Converter')}</strong></span>${icon('chevron')}</button><button class="primary convert-button" data-action="start" ${!ready || pending ? 'disabled' : ''}><span>${ready ? `Convert ${ready} ${ready === 1 ? 'file' : 'files'}` : running ? 'Converting…' : 'Convert files'}</span>${icon('arrow')}</button></footer>`;
}
function renderFormats(content: Element) {
  content.innerHTML = `<section class="workspace detail-page"><h1>Find your format.</h1><p class="intro">Supported inputs and their output formats. Every conversion happens locally.</p><label class="search-box format-search">${icon('search')}<input id="format-filter" type="search" aria-label="Search supported formats" placeholder="Search a format, like PNG or EPUB"></label><div id="format-table"></div><div class="notice">No OCR, DRM, encrypted files, CAD/3D, or PDF to editable Word. Layout and font fidelity can vary between document formats.</div></section>`;
  const table = () => {
    const q = document.querySelector<HTMLInputElement>('#format-filter')!.value.toLowerCase().replace(/^\./, '');
    const inputs = [...new Set(capabilities.map(c => c.input))].filter(input => input.includes(q) || capabilities.some(c => c.input === input && (c.output.includes(q) || c.family.toLowerCase().includes(q))));
    document.querySelector('#format-table')!.innerHTML = `<table><thead><tr><th>Input</th><th>Convert to</th></tr></thead><tbody>${inputs.map(input => `<tr><th>${esc(input.toUpperCase())}</th><td>${[...new Set(capabilities.filter(c => c.input === input).map(c => c.output))].map(t => `<span class="format-tag">${esc(t.toUpperCase())}</span>`).join('')}</td></tr>`).join('')}</tbody></table>${inputs.length ? '' : '<p>No matching formats.</p>'}`;
  };
  document.querySelector('#format-filter')!.addEventListener('input', table); table();
}
function renderSettings(content: Element) {
  content.innerHTML = `<section class="workspace detail-page"><h1>A little more you.</h1><p class="intro">Set up your workspace. Everything is saved on this device.</p><section class="setting-group"><h2>Appearance</h2><p>Choose how AIO Converter looks.</p><div class="theme-options">${(['system', 'light', 'dark'] as const).map(theme => `<button data-theme-choice="${theme}" class="theme-option ${state.preferences.theme === theme ? 'chosen' : ''}" aria-pressed="${state.preferences.theme === theme}">${icon(theme === 'system' ? 'monitor' : theme === 'light' ? 'sun' : 'moon')}<span>${theme[0].toUpperCase() + theme.slice(1)}</span>${state.preferences.theme === theme ? icon('check') : ''}</button>`).join('')}</div></section><section class="setting-group"><h2>Output folder</h2><p class="path-text">${esc(state.preferences.destination || 'Documents / AIO Converter')}</p>${button('Choose folder', 'destination', 'folder', 'secondary')}</section><section class="setting-group"><h2>Conversion engines</h2><p>Bundled with the app. No downloads needed during conversion.</p><div class="engine-list">${state.engines.length ? state.engines.map(e => `<div><span>${esc(({ imagemagick: 'ImageMagick', ffmpeg: 'FFmpeg', libreoffice: 'LibreOffice', poppler: 'Poppler', pandoc: 'Pandoc', sevenzip: '7-Zip' })[e.id])}</span><span class="${e.available ? 'engine-ready' : 'engine-missing'}">${icon(e.available ? 'check' : 'close')}${e.available ? 'Ready offline' : 'Missing — reinstall app'}</span></div>`).join('') : '<p>Engine availability is shown in the desktop app.</p>'}</div></section><section class="setting-group about"><h2>Private by design.</h2><p>No accounts, uploads, analytics, or conversion history. Only your appearance and output folder preferences are saved.</p><p>AIO Converter 0.2.0 · MIT application source<br>Bundled engines retain their own licenses. Notices are included in the installation resources.</p></section></section>`;
}
function renderDrawer() {
  const drawer = document.querySelector<HTMLElement>('#drawer')!;
  const job = state.jobs.find(j => j.id === selected);
  if (!job || !['ready', 'failed', 'cancelled'].includes(job.status) || page !== 'convert') { drawer.hidden = true; return; }
  if (drawer.contains(document.activeElement) && drawer.dataset.job === job.id) return;
  drawer.hidden = false; drawer.dataset.job = job.id;
  const route = capability(job.extension, job.target);
  const dims = route.engine === 'imagemagick' || route.engine === 'ffmpeg' && !audio.includes(job.target);
  const warning = lossWarning(job.extension, job.target);
  drawer.innerHTML = `<header><div><h2>Conversion settings</h2><p title="${esc(job.name)}">${esc(job.name)}</p></div><button class="icon-button" data-action="close-drawer" aria-label="Close settings">${icon('close')}</button></header><div class="drawer-content"><div class="conversion-summary"><span>${esc(job.extension.toUpperCase())}</span>${icon('arrow')}<strong>${esc(job.target.toUpperCase())}</strong></div>${route.engine === 'imagemagick' ? `<label class="field">Image quality <span><input id="quality" type="range" min="1" max="100" value="${job.options.quality}"><output id="quality-value">${job.options.quality}</output></span><small>Higher quality usually means a larger file.</small></label>` : ''}${route.engine === 'ffmpeg' && !audio.includes(job.target) ? `<label class="field">Compression<select id="preset"><option value="balanced">Balanced</option><option value="small">Smaller file</option><option value="quality">Higher quality</option></select></label>` : ''}${route.engine === 'ffmpeg' ? `<label class="field">Audio bitrate<select id="bitrate">${[64, 96, 128, 192, 256, 320].map(n => `<option value="${n}" ${job.options.bitrate === n ? 'selected' : ''}>${n} kbps</option>`).join('')}</select><small>Applies to lossy audio encoding.</small></label>` : ''}${dims ? `<fieldset><legend>Resize to fit</legend><div class="dimension-fields"><label>Width<input id="width" type="number" min="1" max="16384" placeholder="Original" value="${job.options.width ?? ''}"></label><span>×</span><label>Height<input id="height" type="number" min="1" max="16384" placeholder="Original" value="${job.options.height ?? ''}"></label></div><p class="subtle">Pixels. Aspect ratio is preserved.</p></fieldset>` : '<p class="subtle">This conversion uses standard format settings.</p>'}${warning ? `<div class="format-warning">${icon('info')}<p>${esc(warning)}</p><label><input id="acknowledge" type="checkbox" ${job.options.acknowledgeLoss ? 'checked' : ''}>I understand this format change.</label></div>` : ''}<button class="secondary full" data-action="apply-options">Apply settings to compatible files</button><p class="subtle">Only idle files with the same conversion route are changed.</p></div>`;
  const preset = drawer.querySelector<HTMLSelectElement>('#preset'); if (preset) preset.value = job.options.preset;
  drawer.querySelector<HTMLInputElement>('#quality')?.addEventListener('input', e => { drawer.querySelector('#quality-value')!.textContent = (e.target as HTMLInputElement).value; });
}
async function saveDrawer() {
  const job = state.jobs.find(j => j.id === selected); if (!job) return;
  const drawer = document.querySelector('#drawer')!;
  const value = (id: string) => drawer.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.value;
  const options: ConversionOptions = { ...job.options, quality: Number(value('quality') ?? job.options.quality), preset: (value('preset') ?? job.options.preset) as ConversionOptions['preset'], bitrate: Number(value('bitrate') ?? job.options.bitrate), width: value('width') ? Number(value('width')) : undefined, height: value('height') ? Number(value('height')) : undefined, acknowledgeLoss: drawer.querySelector<HTMLInputElement>('#acknowledge')?.checked ?? false };
  await action(() => api.configure(job.id, job.target, options));
}
function renderPicker() {
  const job = state.jobs.find(j => j.id === pickerJob);
  const choices = job ? job.targets : [...new Set(state.jobs.filter(j => j.status === 'ready').flatMap(j => j.targets))];
  const query = document.querySelector<HTMLInputElement>('#target-search')!.value.toLowerCase().replace(/^\./, '');
  const filtered = choices.filter(t => t.includes(query));
  document.querySelector('#target-results')!.innerHTML = filtered.length ? filtered.map(t => `<button data-target="${t}" aria-label="Convert to ${esc(t.toUpperCase())}"><span>${esc(t.toUpperCase())}</span>${t === job?.target ? icon('check') : icon('arrow')}</button>`).join('') : '<p>No matching formats.</p>';
}
function openPicker(id?: string) {
  pickerJob = id; document.querySelector<HTMLInputElement>('#target-search')!.value = ''; renderPicker();
  document.querySelector<HTMLElement>('#picker')!.showPopover(); document.querySelector<HTMLInputElement>('#target-search')!.focus();
}
async function startConversions(acknowledge = false) {
  const warnings = state.jobs.filter(j => j.status === 'ready' && lossWarning(j.extension, j.target) && !j.options.acknowledgeLoss);
  if (warnings.length && !acknowledge) {
    document.querySelector('#loss-list')!.innerHTML = warnings.map(j => `<li><strong>${esc(j.name)}</strong><span>${esc(lossWarning(j.extension, j.target))}</span></li>`).join('');
    document.querySelector<HTMLDialogElement>('#loss-dialog')!.showModal(); return;
  }
  await action(async () => {
    pending = true; renderBar();
    try {
      if (acknowledge) for (const j of warnings) await api.configure(j.id, j.target, { ...j.options, acknowledgeLoss: true });
      await api.start();
    } finally { pending = false; renderBar(); }
  });
}
async function onClick(event: MouseEvent) {
  const el = (event.target as Element).closest<HTMLElement>('button, a[data-page]'); if (!el) return;
  const job = state.jobs.find(j => j.id === el.closest<HTMLElement>('[data-job]')?.dataset.job);
  if (el.dataset.page) { page = el.dataset.page as typeof page; selected = undefined; render(); return; }
  if (el.dataset.themeChoice) { await action(async () => { state.preferences = await api.preferences({ theme: el.dataset.themeChoice as 'light' }); render(); }); return; }
  if (el.dataset.target) {
    const target = el.dataset.target; document.querySelector<HTMLElement>('#picker')!.hidePopover();
    await action(async () => {
      const idle = pickerJob ? state.jobs.filter(j => j.id === pickerJob) : state.jobs.filter(j => j.status === 'ready');
      const compatible = idle.filter(j => j.targets.includes(target));
      for (const j of compatible) await api.configure(j.id, target, { ...j.options, acknowledgeLoss: false });
      if (!pickerJob) toast(`Format set for ${compatible.length} file(s). ${idle.length - compatible.length} incompatible file(s) skipped.`);
    }); return;
  }
  switch (el.dataset.action) {
    case 'import': await action(() => api.importFiles()); break;
    case 'destination': await action(async () => { const path = await api.chooseDestination(); if (path) { state.preferences.destination = path; render(); } }); break;
    case 'start': await startConversions(); break;
    case 'accept-loss': document.querySelector<HTMLDialogElement>('#loss-dialog')!.close(); await startConversions(true); break;
    case 'close-loss': document.querySelector<HTMLDialogElement>('#loss-dialog')!.close(); break;
    case 'clear': await action(() => api.clearCompleted()); break;
    case 'batch-format': openPicker(); break;
    case 'pick': if (job) openPicker(job.id); break;
    case 'options': selected = job?.id; renderDrawer(); break;
    case 'close-drawer': selected = undefined; renderDrawer(); break;
    case 'cancel': if (job) await action(() => api.cancel(job.id)); break;
    case 'retry': if (job) await action(() => api.retry(job.id)); break;
    case 'remove': if (job) await action(() => api.remove(job.id)); break;
    case 'reveal': if (job) await action(() => api.reveal(job.id)); break;
    case 'details': if (job) toast(job.message ?? 'Conversion failed. Try another format.', true); break;
    case 'apply-options': {
      const current = state.jobs.find(j => j.id === selected); if (!current) break;
      await action(async () => {
        const candidates = state.jobs.filter(j => j.status === 'ready' && j.extension === current.extension && j.target === current.target);
        for (const j of candidates) await api.configure(j.id, j.target, { ...current.options, acknowledgeLoss: false });
        toast(`Settings applied to ${candidates.length} compatible file(s).`);
      }); break;
    }
  }
}
shell(); render();
if (api) {
  api.onDownloads(jobs => {
    const previous = new Map(state.downloads.map(j => [j.id, j.status]));
    state.downloads = jobs;
    const changes = jobs.filter(j => previous.get(j.id) !== j.status && ['completed', 'failed', 'cancelled'].includes(j.status));
    if (changes.length) document.querySelector('#announcer')!.textContent = changes.map(j => `${j.name}: ${j.status}`).join('. ');
    if (page === 'downloads') renderDownloads(document.querySelector('#content')!, state, action);
  });
  api.onJobs(event => {
    const previous = new Map(state.jobs.map(j => [j.id, j.status]));
    state.jobs = event.jobs;
    const changes = event.jobs.filter(j => previous.has(j.id) && previous.get(j.id) !== j.status && ['completed', 'failed', 'cancelled'].includes(j.status));
    if (changes.length) document.querySelector('#announcer')!.textContent = changes.map(j => `${j.name}: ${j.status}`).join('. ');
    const focused = document.activeElement as HTMLElement | null;
    const focusedJob = focused?.closest<HTMLElement>('[data-job]')?.dataset.job;
    const focusedAction = focused?.dataset.action;
    render();
    if (focusedJob && focusedAction) document.querySelector<HTMLElement>(`[data-job="${CSS.escape(focusedJob)}"] [data-action="${CSS.escape(focusedAction)}"]`)?.focus({ preventScroll: true });
  });
  void action(async () => { state = await api.state(); render(); });
}
