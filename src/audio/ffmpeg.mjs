import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let available = null;

export function ffmpegAvailable() {
  if (available !== null) return available;
  available = new Promise((resolve) => {
    const p = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
    p.on('error', () => resolve(false));
    p.on('exit', (code) => resolve(code === 0));
  });
  return available;
}

// Runs ffmpeg with an args array (no shell). Input/output go through a temp dir
// (os.tmpdir() honours TMPDIR, which is $PREFIX/tmp on Termux).
export async function runFfmpeg(inputBuf, filterArgs, { timeoutMs = 60000 } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-ff-'));
  const inFile = path.join(dir, 'in.bin');
  const outFile = path.join(dir, 'out.wav');
  try {
    await fs.writeFile(inFile, inputBuf);
    const args = ['-nostdin', '-v', 'error', '-y', '-i', inFile, ...filterArgs,
      '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', '-f', 'wav', outFile];
    await new Promise((resolve, reject) => {
      const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', (d) => { if (err.length < 2000) err += d; });
      const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('ffmpeg_timeout')); }, timeoutMs);
      p.on('error', (e) => { clearTimeout(t); reject(e); });
      p.on('exit', (code) => {
        clearTimeout(t);
        if (code === 0) resolve();
        else reject(Object.assign(new Error('ffmpeg_failed'), { detail: err.trim() }));
      });
    });
    return await fs.readFile(outFile);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
