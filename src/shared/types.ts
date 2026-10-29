export type EngineId = 'imagemagick' | 'ffmpeg' | 'libreoffice' | 'poppler' | 'pandoc' | 'sevenzip';
export type Family = 'Images' | 'Audio' | 'Video' | 'Documents' | 'Spreadsheets' | 'Presentations' | 'PDF' | 'Ebooks' | 'Archives';
export interface ConversionCapability { id: string; input: string; output: string; family: Family; engine: EngineId; }
export interface ConversionOptions { quality: number; width?: number; height?: number; preset: 'balanced' | 'small' | 'quality'; bitrate: number; acknowledgeLoss: boolean; }
export type JobStatus = 'ready' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface ConversionJob { id: string; name: string; extension: string; size: number; family: Family; targets: string[]; target: string; options: ConversionOptions; status: JobStatus; progress?: number; message?: string; outputPath?: string; }
export interface JobEvent { jobs: ConversionJob[]; }
export const downloadFormats = { Video: ['mp4', 'mkv', 'webm', 'mov'], Audio: ['mp3', 'm4a', 'wav', 'flac', 'opus', 'ogg'] } as const;
export interface DownloadRequest { url: string; kind: 'Video' | 'Audio'; format: string; quality: 'best' | '1080' | '720' | '480'; }
export interface DownloadJob extends DownloadRequest { id: string; name: string; status: JobStatus; progress?: number; message?: string; outputPath?: string; }
export interface Preferences { destination: string; theme: 'system' | 'light' | 'dark'; }
export interface EngineStatus { id: EngineId; available: boolean; }
export interface AppState { jobs: ConversionJob[]; downloads: DownloadJob[]; downloadAvailable: boolean; preferences: Preferences; engines: EngineStatus[]; }
export interface AioAPI {
  state(): Promise<AppState>;
  download(request: DownloadRequest): Promise<void>;
  downloadAction(id: string, action: 'cancel' | 'retry' | 'remove' | 'reveal'): Promise<void>;
  onDownloads(callback: (jobs: DownloadJob[]) => void): () => void;
  importFiles(): Promise<ConversionJob[]>;
  importDropped(files: File[]): Promise<ConversionJob[]>;
  capabilities(): Promise<ConversionCapability[]>;
  chooseDestination(): Promise<string | null>;
  preferences(value: Partial<Pick<Preferences, 'theme'>>): Promise<Preferences>;
  configure(id: string, target: string, options: ConversionOptions): Promise<void>;
  start(): Promise<void>;
  cancel(id: string): Promise<void>;
  retry(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  clearCompleted(): Promise<void>;
  reveal(id: string): Promise<void>;
  onJobs(callback: (event: JobEvent) => void): () => void;
}
declare global { interface Window { aio: AioAPI; } }
