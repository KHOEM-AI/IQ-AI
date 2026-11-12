import { spawn } from 'node:child_process';

// Runs ffmpeg with an args array (no shell). Caller manages its own temp files.
// Optional `signal` (AbortSignal): aborting kills ffmpeg and rejects with code 'aborted' (used by background jobs).
export function runFfmpegArgs(args, { timeoutMs = 120000, signal } = {}) {
  return new Promise((resolve, reject) => {
    const aborted = () => Object.assign(new Error('ffmpeg_aborted'), { code: 'aborted' });
    if (signal && signal.aborted) return reject(aborted());
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    let onAbort;
    const done = () => { clearTimeout(t); if (signal && onAbort) signal.removeEventListener('abort', onAbort); };
    p.stderr.on('data', (d) => { if (err.length < 4000) err += d; });
    const t = setTimeout(() => { p.kill('SIGKILL'); done(); reject(new Error('ffmpeg_timeout')); }, timeoutMs);
    if (signal) {
      onAbort = () => { p.kill('SIGKILL'); done(); reject(aborted()); };
      signal.addEventListener('abort', onAbort, { once: true });
    }
    p.on('error', (e) => { done(); reject(e); });
    p.on('exit', (code) => {
      done();
      if (code === 0) resolve();
      else reject(Object.assign(new Error('ffmpeg_failed'), { detail: err.trim() }));
    });
  });
}
