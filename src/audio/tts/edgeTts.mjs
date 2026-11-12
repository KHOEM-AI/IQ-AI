// Optional online engine: Microsoft Edge neural voices through the Python "edge_tts" package.
// Needs internet + `pip install edge-tts`. Off by default (see provider.mjs, IQAI_TTS=edge).
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runFfmpeg } from '../ffmpeg.mjs';

// One base voice per language. Distinct characters come from the IQ-AI voice presets (DSP) applied afterwards.
const VOICES = { km: 'km-KH-SreymomNeural' };
export const TTS_LANGS = Object.keys(VOICES);

function fail(code, message, detail) {
  return Object.assign(new Error(message), { code, detail });
}

// Returns a mono 44.1 kHz 16-bit WAV Buffer. Throws Error with .code = engine_missing | timeout | upstream.
export async function edgeTtsToWav(text, lang = 'km', { timeoutMs = 60000 } = {}) {
  const voice = VOICES[lang];
  if (!voice) throw fail('upstream', 'unsupported language');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-tts-'));
  const mp3 = path.join(dir, 'out.mp3');
  try {
    await new Promise((resolve, reject) => {
      // No shell. "--text=VALUE" keeps text that starts with "-" from being read as an option.
      const p = spawn('python3', ['-m', 'edge_tts', '--voice', voice, `--text=${text}`, '--write-media', mp3],
        { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', (d) => { if (err.length < 2000) err += d; });
      const t = setTimeout(() => { p.kill('SIGKILL'); reject(fail('timeout', 'edge_tts timeout')); }, timeoutMs);
      p.on('error', () => { clearTimeout(t); reject(fail('engine_missing', 'python3 not found')); });
      p.on('exit', (code) => {
        clearTimeout(t);
        if (code === 0) return resolve();
        const missing = /No module named/i.test(err);
        reject(fail(missing ? 'engine_missing' : 'upstream', 'edge_tts failed', err.trim()));
      });
    });
    return await runFfmpeg(await fs.readFile(mp3), []);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
