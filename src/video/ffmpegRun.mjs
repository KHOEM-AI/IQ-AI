import { spawn } from 'node:child_process';

// Runs ffmpeg with an args array (no shell). Caller manages its own temp files.
export function runFfmpegArgs(args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { if (err.length < 4000) err += d; });
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('ffmpeg_timeout')); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(t); reject(e); });
    p.on('exit', (code) => {
      clearTimeout(t);
      if (code === 0) resolve();
      else reject(Object.assign(new Error('ffmpeg_failed'), { detail: err.trim() }));
    });
  });
}
