import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runFfmpegArgs } from './ffmpegRun.mjs';

// Helpers for a narrated story: how long is a WAV, and one narration track that is exactly as long as the
// scenes (each spoken line starts a little after its scene starts; scenes without speech stay silent).

// Duration in seconds of a PCM WAV buffer, or null when it is not a readable WAV.
export function wavSeconds(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 44) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let off = 12;
  let byteRate = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ' && off + 20 <= buf.length) {
      byteRate = buf.readUInt32LE(off + 16);
    } else if (id === 'data') {
      const bytes = Math.min(size, buf.length - off - 8); // streamed WAVs may carry a bogus size
      return byteRate > 0 ? bytes / byteRate : null;
    }
    off += 8 + size + (size & 1);
  }
  return null;
}

export const NARRATION_LEAD_SEC = 0.3; // silence before a line starts inside its scene
export const NARRATION_TAIL_SEC = 0.8; // silence after the line before the next scene

// clips: [{ buf: Buffer|null (WAV), seconds }]  ->  WAV Buffer (mono 44.1 kHz) of sum(seconds) length.
export async function buildNarrationTrack({ clips, signal } = {}) {
  if (!Array.isArray(clips) || !clips.length) throw new Error('no clips');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-narr-'));
  try {
    const parts = [];
    for (let i = 0; i < clips.length; i++) {
      const { buf, seconds } = clips[i];
      const out = path.join(dir, `n${i}.wav`);
      const common = ['-t', String(seconds), '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', '-f', 'wav', out];
      if (buf) {
        const src = path.join(dir, `s${i}.bin`);
        await fs.writeFile(src, buf);
        const ms = Math.round(NARRATION_LEAD_SEC * 1000);
        await runFfmpegArgs(['-nostdin', '-v', 'error', '-y', '-i', src, '-af', `adelay=${ms}:all=1,apad=whole_dur=${seconds}`, ...common],
          { timeoutMs: 60000, signal });
      } else {
        await runFfmpegArgs(['-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', ...common],
          { timeoutMs: 60000, signal });
      }
      parts.push(out);
    }
    const list = path.join(dir, 'list.txt');
    await fs.writeFile(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
    const joined = path.join(dir, 'narration.wav');
    await runFfmpegArgs(['-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-f', 'wav', joined],
      { timeoutMs: 120000, signal });
    return await fs.readFile(joined);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
