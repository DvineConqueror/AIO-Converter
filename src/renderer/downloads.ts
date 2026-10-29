import { downloadFormats, type AppState, type DownloadRequest } from '../shared/types';
import { icon } from './icons';

const esc = (v: unknown) => String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const draft: DownloadRequest = { url: '', kind: 'Video', format: 'mp4', quality: '1080' };
let submitting = false;
export function renderDownloads(content: Element, state: AppState, action: (work: () => Promise<unknown>) => Promise<void>) {
  if (!content.querySelector('#download-form')) {
    content.innerHTML = `<section class="workspace downloads-workspace"><div class="page-heading"><div><h1>From a link.<br><span>To your library.</span></h1><p>Save a video or its audio in the format you need.</p></div><div class="heading-symbol">${icon('video')}</div></div>
      <form id="download-form" class="link-form"><label for="media-link">Video or audio link</label><div class="link-input"><input id="media-link" type="url" required maxlength="4096" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" spellcheck="false" value="${esc(draft.url)}"><button class="primary" type="submit">${icon('arrow')}<span>Download</span></button></div><div class="download-options"><label class="field">Save as<select id="download-kind"><option value="Video">Video</option><option value="Audio">Audio only</option></select></label><label class="field">Extension<select id="download-format"></select></label><label class="field" id="download-quality-field">Maximum resolution<select id="download-quality"><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option><option value="best">Best available</option></select></label></div></form>
      <p class="link-help">YouTube and other sites supported by yt-dlp, including direct media links. One item per link. Site support can change.</p>
      <div class="notice">Downloads need internet access. Use media you own or have permission to save. Live streams, DRM and sign-in-only media are not supported. Audio exports use 192 kbps where applicable; converting cannot restore lost quality.</div>
      <div id="download-availability"></div><section class="queue-section" aria-labelledby="downloads-title"><div class="section-heading"><h2 id="downloads-title">Downloads</h2><span class="subtle" id="download-count"></span></div><div id="download-list"></div></section></section>`;
    const form = content.querySelector<HTMLFormElement>('#download-form')!;
    const kind = content.querySelector<HTMLSelectElement>('#download-kind')!;
    const format = content.querySelector<HTMLSelectElement>('#download-format')!;
    const quality = content.querySelector<HTMLSelectElement>('#download-quality')!;
    const url = content.querySelector<HTMLInputElement>('#media-link')!;
    const options = () => {
      kind.value = draft.kind;
      format.innerHTML = downloadFormats[draft.kind].map(f => `<option value="${f}">${f.toUpperCase()}</option>`).join(''); format.value = draft.format;
      quality.value = draft.quality;
      (content.querySelector('#download-quality-field') as HTMLElement).hidden = draft.kind === 'Audio';
    };
    options();
    url.addEventListener('input', () => { draft.url = url.value; });
    kind.addEventListener('change', () => { draft.kind = kind.value as 'Video' | 'Audio'; draft.format = downloadFormats[draft.kind][0]; options(); });
    format.addEventListener('change', () => { draft.format = format.value; });
    quality.addEventListener('change', () => { draft.quality = quality.value as DownloadRequest['quality']; });
    form.addEventListener('submit', event => {
      event.preventDefault(); if (submitting) return;
      const button = form.querySelector<HTMLButtonElement>('button')!; submitting = true; button.disabled = true;
      void action(async () => {
        try { await window.aio.download({ ...draft }); } finally { submitting = false; button.disabled = false; }
      }).finally(() => { submitting = false; button.disabled = false; });
    });
    content.querySelector('#download-list')!.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-download-action]');
      if (button) void action(() => window.aio.downloadAction(button.dataset.id!, button.dataset.downloadAction as 'cancel'));
    });
  }
  content.querySelector('#download-availability')!.innerHTML = window.aio && !state.downloadAvailable ? '<div class="notice error">Download tools are missing. Reinstall the full app.</div>' : !window.aio ? '<div class="notice">Design preview · Open the desktop app to download media.</div>' : '';
  content.querySelector<HTMLButtonElement>('#download-form button')!.disabled = submitting || !state.downloadAvailable;
  content.querySelector('#download-count')!.textContent = `${state.downloads.length} items`;
  const focused = document.activeElement as HTMLElement;
  const focusId = focused?.dataset.id, focusAction = focused?.dataset.downloadAction;
  const focusedSummary = focused?.dataset.downloadSummary;
  const openErrors = new Set([...content.querySelectorAll<HTMLDetailsElement>('[data-download-error][open]')].map(el => el.dataset.downloadError));
  content.querySelector('#download-list')!.innerHTML = state.downloads.length ? state.downloads.map(j => {
    const active = ['queued', 'running'].includes(j.status);
    const control = (action: string, name: string, glyph: string) => `<button class="icon-button" data-id="${esc(j.id)}" data-download-action="${action}" aria-label="${name} ${esc(j.name)}" title="${name}">${icon(glyph)}</button>`;
    return `<article class="download-row ${j.status}"><div class="file-identity"><span class="file-symbol ${j.kind}">${icon(j.kind === 'Audio' ? 'audio' : 'video')}</span><div><strong title="${esc(j.name)}">${esc(j.name)}</strong><span title="${esc(j.url)}">${esc(new URL(j.url).hostname)}<b>·</b>${esc(j.format.toUpperCase())}${j.kind === 'Video' ? `<b>·</b>${j.quality === 'best' ? 'Best available' : `${j.quality}p max`}` : ''}</span></div></div><div class="file-status"><span class="status-${j.status}">${j.status === 'completed' ? 'Saved' : j.status === 'running' ? esc(j.message || 'Downloading…') : j.status === 'queued' ? 'Waiting' : j.status === 'failed' ? 'Failed' : 'Cancelled'}</span>${j.status === 'running' ? `<progress max="100" ${j.progress === undefined ? '' : `value="${j.progress}"`} aria-label="Download and conversion progress for ${esc(j.name)}"></progress>` : ''}</div><div class="row-actions">${active ? control('cancel', 'Cancel', 'stop') : `${j.status === 'completed' ? control('reveal', 'Show file', 'folder') : control('retry', 'Retry', 'retry')}${control('remove', 'Remove', 'close')}`}</div>${j.status === 'failed' ? `<details class="download-error" data-download-error="${esc(j.id)}" ${openErrors.has(j.id) ? 'open' : ''}><summary data-download-summary="${esc(j.id)}">Download failed · View details</summary><p>${esc(j.message || 'Try another public link.')}</p></details>` : ''}</article>`;
  }).join('') : `<div class="empty-queue">${icon('video')}<div><strong>Your next find starts here.</strong><span>Paste a link, choose an extension, then download.</span></div></div>`;
  if (focusId && focusAction) content.querySelector<HTMLElement>(`[data-id="${CSS.escape(focusId)}"][data-download-action="${CSS.escape(focusAction)}"]`)?.focus({ preventScroll: true });
  if (focusedSummary) content.querySelector<HTMLElement>(`[data-download-summary="${CSS.escape(focusedSummary)}"]`)?.focus({ preventScroll: true });
}
