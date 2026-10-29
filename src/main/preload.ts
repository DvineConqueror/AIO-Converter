import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AioAPI, JobEvent, DownloadJob } from '../shared/types';

const api: AioAPI = {
  state: () => ipcRenderer.invoke('aio:state'),
  download: value => ipcRenderer.invoke('aio:download', value),
  downloadAction: (id, action) => ipcRenderer.invoke('aio:download-action', id, action),
  onDownloads: callback => {
    const listener = (_event: Electron.IpcRendererEvent, jobs: DownloadJob[]) => callback(jobs);
    ipcRenderer.on('aio:downloads', listener); return () => ipcRenderer.removeListener('aio:downloads', listener);
  },
  importFiles: () => ipcRenderer.invoke('aio:import'),
  importDropped: files => ipcRenderer.invoke('aio:drop', files.map(file => webUtils.getPathForFile(file)).filter(Boolean)),
  capabilities: () => ipcRenderer.invoke('aio:capabilities'),
  chooseDestination: () => ipcRenderer.invoke('aio:destination'),
  preferences: value => ipcRenderer.invoke('aio:preferences', value),
  configure: (id, target, options) => ipcRenderer.invoke('aio:configure', id, target, options),
  start: () => ipcRenderer.invoke('aio:start'), cancel: id => ipcRenderer.invoke('aio:cancel', id),
  retry: id => ipcRenderer.invoke('aio:retry', id), remove: id => ipcRenderer.invoke('aio:remove', id),
  clearCompleted: () => ipcRenderer.invoke('aio:clear'), reveal: id => ipcRenderer.invoke('aio:reveal', id),
  onJobs: callback => {
    const listener = (_event: Electron.IpcRendererEvent, event: JobEvent) => callback(event);
    ipcRenderer.on('aio:jobs', listener); return () => ipcRenderer.removeListener('aio:jobs', listener);
  }
};
contextBridge.exposeInMainWorld('aio', api);
