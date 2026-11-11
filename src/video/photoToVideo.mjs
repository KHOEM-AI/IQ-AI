import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runFfmpegArgs } from './ffmpegRun.mjs';
import { synthSfx, SFX_TYPES } from '../audio/sfx/synth.mjs';

export const EFFECTS = ['zoom-in', 'zoom-out'];
const LIMITS = { durationSec: [1, 120], side: [320, 1280] };

function clampNum(v, def, [lo, hi]) {
  if (v === undefined || v === null || v === '') return { ok: true, value: def };
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return { ok: false };
  return { ok: true, value: n };
}
const evenSize = (n) => Math.max(2, Math.round(n / 2) * 2);

function zoompanFilter(effect, durationSec, fps, w, h) {
  const frames = Math.round(durationSec * fps);
  const z = effect === 'zoom-out'
    ? "if(eq(on,1),1.5,max(1.001,zoom-0.0015))"
    : "min(zoom+0.0015,1.5)";
  return `zoompan=z='${z}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=${fps}`;
}

// imageBuf: PNG/JPEG/WEBP/GIF bytes. Returns { ok, buf (mp4), applied } or { ok:false, message }.
export async function renderPhotoVideo({ imageBuf, effect = 'zoom-in', durationSec, width, height, sfxType = null } = {}) {
  if (!EFFECTS.includes(effect)) return { ok: false, message: `effect must be one of: ${EFFECTS.join(', ')}` };
  const dur = clampNum(durationSec, 5, LIMITS.durationSec);
  const w0 = clampNum(width, 720, LIMITS.side);
  const h0 = clampNum(height, 720, LIMITS.side);
  if (!dur.ok) return { ok: false, message: `durationSec must be ${LIMITS.durationSec[0]}..${LIMITS.durationSec[1]}` };
  if (!w0.ok || !h0.ok) return { ok: false, message: `width/height must be ${LIMITS.side[0]}..${LIMITS.side[1]}` };
  if (sfxType !== null && !SFX_TYPES.includes(sfxType)) {
    return { ok: false, message: `sfx must be one of: ${SFX_TYPES.join(', ')}` };
  }
  const w = evenSize(w0.value);
  const h = evenSize(h0.value);
  const fps = 25;
  const ffTimeout = 120000 + Math.round(dur.value * 3000);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-pv-'));
  try {
    const inImg = path.join(dir, 'in.img');
    await fs.writeFile(inImg, imageBuf);
    try {
      await runFfmpegArgs(['-nostdin', '-v', 'error', '-i', inImg, '-frames:v', '1', '-f', 'null', '-'], { timeoutMs: 15000 });
    } catch {
      return { ok: false, message: 'image could not be decoded' };
    }
    const silentMp4 = path.join(dir, 'silent.mp4');
    const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},${zoompanFilter(effect, dur.value, fps, w, h)},format=yuv420p`;
    await runFfmpegArgs([
      '-nostdin', '-v', 'error', '-y', '-loop', '1', '-i', inImg,
      '-vf', vf, '-t', String(dur.value), '-r', String(fps),
      '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mp4', silentMp4,
    ], { timeoutMs: ffTimeout });

    let finalPath = silentMp4;
    if (sfxType) {
      const sfx = synthSfx({ type: sfxType, durationSec: Math.min(dur.value, 20) });
      if (!sfx.ok) return sfx;
      const wavPath = path.join(dir, 'sfx.wav');
      await fs.writeFile(wavPath, sfx.buf);
      const muxed = path.join(dir, 'out.mp4');
      await runFfmpegArgs([
        '-nostdin', '-v', 'error', '-y', '-i', silentMp4, '-stream_loop', '-1', '-i', wavPath,
        '-c:v', 'copy', '-c:a', 'aac', '-t', String(dur.value), '-shortest', '-f', 'mp4', muxed,
      ], { timeoutMs: ffTimeout });
      finalPath = muxed;
    }
    const buf = await fs.readFile(finalPath);
    return { ok: true, buf, applied: { effect, durationSec: dur.value, width: w, height: h, sfx: sfxType } };
  } catch (e) {
    return { ok: false, message: 'ffmpeg_failed', detail: e && (e.detail || e.message) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
