import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
export class Cancelled extends Error { constructor() { super('Conversion cancelled.'); } }
export interface RunContext { signal: AbortSignal; onProgress?: (value: number) => void; }
export async function run(executable: string, args: string[], context: RunContext, options: { cwd?: string; env?: NodeJS.ProcessEnv; onLine?: (line: string) => void; timeout?: number; maxOutput?: number } = {}): Promise<string> {
  if (context.signal.aborted) throw new Cancelled();
  return new Promise((resolve, reject) => {
    const proc = spawn(executable, args, { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'], cwd: options.cwd, env: { ...process.env, PATH: `${dirname(executable)};${process.env.SystemRoot}\\System32`, ...options.env } });
    let stdout = '', stderr = '', line = '', problem: Error | undefined;
    const kill = () => {
      if (!proc.pid) return;
      if (process.platform === 'win32') {
        const killer = spawn(`${process.env.SystemRoot}\\System32\\taskkill.exe`, ['/PID', String(proc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.on('error', () => proc.kill());
      } else proc.kill('SIGKILL');
    };
    const abort = () => { problem = new Cancelled(); kill(); };
    context.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { problem = new Error('Operation exceeded its safety time limit.'); kill(); }, options.timeout ?? 30 * 60 * 1000);
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString(); line += chunk.toString();
      const lines = line.split(/\r?\n/); line = lines.pop() ?? ''; for (const l of lines) options.onLine?.(l);
      if (stdout.length > (options.maxOutput ?? 16 * 1024 * 1024)) { problem = new Error('Engine response exceeded safety limit.'); kill(); }
    });
    proc.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-8000); });
    proc.on('error', error => { clearTimeout(timer); context.signal.removeEventListener('abort', abort); reject(error); });
    proc.on('close', code => {
      clearTimeout(timer); context.signal.removeEventListener('abort', abort);
      if (problem) reject(problem);
      else if (code !== 0) reject(new Error(stderr.trim() || stdout.slice(-1500).trim() || `Conversion engine exited with code ${code}.`));
      else resolve(stdout);
    });
  });
}
