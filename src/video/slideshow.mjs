import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runFfmpegArgs } from './ffmpegRun.mjs';
import { KHMER_FONT, wrapText } from './textToVideo.mjs';
import { synthSfx, SFX_TYPES } from '../audio/sfx/synth.mjs';

// Several photos (+ optional Khmer captions, sfx or a stored audio track) -> one mp4.
// ffmpeg only: no AI model, no network. Each slide is rendered with zoompan, then the
// slides are joined with the concat demuxer (stream copy) and the audio is muxed on top.

export const SLIDESHOW_LIMITS = {
  slides: [1, 20], secondsPerSlide: [1, 15], durationEach: [1, 30], totalSec: 300, side: [320, 1280], fontSize: [16, 96], caption: 300,
  totalImageBytes: 60 * 1024 * 1024,
};
export const SLIDE_EFFECTS = ['zoom-in', 'zoom-out', 'none'];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const evenSize = (n) => Math.max(2, Math.round(n / 2) * 2);
const bad = (message, code = 'bad_params') => ({ ok: false, message, code });

function num(v, [lo, hi], def) {
  if (v === undefined || v === null || v === '') return { ok: true, value: def };
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return { ok: false };
  return { ok: true, value: n };
}

function motion(effect, frames, fps, w, h) {
  if (effect === 'none') return `scale=${w}:${h}`;
  const z = effect === 'zoom-out' ? 'if(eq(on,1),1.5,max(1.001,zoom-0.0015))' : 'min(zoom+0.0015,1.5)';
  return `zoompan=z='${z}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=${fps}`;
}

// images: Buffer[]; captions: (string|null)[] same length (optional);
// audioBuf: optional Buffer (stored audio) used instead of sfx.
// durations: optional number[] (one per image, seconds) instead of one secondsPerSlide for all,
//   so each slide can last as long as the line spoken over it.
// Returns { ok, buf, applied } or { ok:false, message, code }.
export async function renderSlideshow({
  images, captions = [], secondsPerSlide, width, height, effect = 'zoom-in',
  fontSize, textColor = '#ffffff', sfxType = null, audioBuf = null, durations = null,
} = {}) {
  const [smin, smax] = SLIDESHOW_LIMITS.slides;
  if (!Array.isArray(images) || images.length < smin || images.length > smax) return bad(`slideshow needs ${smin}..${smax} images`);
  if (images.reduce((n, b) => n + b.length, 0) > SLIDESHOW_LIMITS.totalImageBytes) return bad('images are too large together', 'too_large');
  if (!SLIDE_EFFECTS.includes(effect)) return bad(`effect must be one of: ${SLIDE_EFFECTS.join(', ')}`);
  const sec = num(secondsPerSlide, SLIDESHOW_LIMITS.secondsPerSlide, 3);
  const w0 = num(width, SLIDESHOW_LIMITS.side, 720);
  const h0 = num(height, SLIDESHOW_LIMITS.side, 1280);
  const fs0 = num(fontSize, SLIDESHOW_LIMITS.fontSize, 44);
  if (!sec.ok) return bad(`secondsPerSlide must be ${SLIDESHOW_LIMITS.secondsPerSlide.join('..')}`);
  if (!w0.ok || !h0.ok) return bad(`width/height must be ${SLIDESHOW_LIMITS.side.join('..')}`);
  if (!fs0.ok) return bad(`fontSize must be ${SLIDESHOW_LIMITS.fontSize.join('..')}`);
  if (!HEX_COLOR.test(textColor)) return bad('textColor must be #RRGGBB');
  if (durations !== null && durations !== undefined) {
    const [dlo, dhi] = SLIDESHOW_LIMITS.durationEach;
    if (!Array.isArray(durations) || durations.length !== images.length
      || !durations.every((d) => typeof d === 'number' && Number.isFinite(d) && d >= dlo && d <= dhi)) {
      return bad(`durations must be one number (${dlo}..${dhi} seconds) per image`);
    }
    if (durations.reduce((n, d) => n + d, 0) > SLIDESHOW_LIMITS.totalSec) return bad(`total duration must be at most ${SLIDESHOW_LIMITS.totalSec} seconds`);
  }
  if (sfxType !== null && !SFX_TYPES.includes(sfxType)) return bad(`sfx must be one of: ${SFX_TYPES.join(', ')}`);
  if (sfxType && audioBuf) return bad('use either sfx or audioId, not both');
  if (!Array.isArray(captions) || captions.length > images.length) return bad('captions must be an array no longer than ids');
  const caps = images.map((_, i) => {
    const c = captions[i];
    return typeof c === 'string' && c.trim() ? c.trim() : null;
  });
  if (caps.some((c) => c && Array.from(c).length > SLIDESHOW_LIMITS.caption)) return bad(`each caption must be at most ${SLIDESHOW_LIMITS.caption} characters`);
  const hasCaptions = caps.some(Boolean);
  if (hasCaptions) {
    try { await fs.access(KHMER_FONT); }
    catch { return { ok: false, code: 'font_missing', status: 503, message: `Khmer font not found: ${KHMER_FONT}` }; }
  }

  const w = evenSize(w0.value);
  const h = evenSize(h0.value);
  const fontPx = Math.round(fs0.value);
  const fps = 25;
  const secs = Array.isArray(durations) ? durations.map((d) => Math.round(d * 100) / 100) : images.map(() => sec.value);
  const margin = Math.round(w * 0.08);
  const maxChars = Math.max(4, Math.floor((w - margin * 2) / (fontPx * 0.62)));
  const maxLines = Math.max(1, Math.floor((h * 0.3) / (fontPx * 1.3)));
  const total = secs.reduce((n, d) => n + d, 0);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-ss-'));
  try {
    const parts = [];
    for (let i = 0; i < images.length; i++) {
      const img = path.join(dir, `img${i}.bin`);
      await fs.writeFile(img, images[i]);
      try {
        await runFfmpegArgs(['-nostdin', '-v', 'error', '-i', img, '-frames:v', '1', '-f', 'null', '-'], { timeoutMs: 15000 });
      } catch {
        return bad(`image ${i + 1} could not be decoded`, 'bad_image');
      }
      let vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},${motion(effect, Math.round(secs[i] * fps), fps, w, h)}`;
      if (caps[i]) {
        const { lines } = wrapText(caps[i], maxChars, maxLines);
        const txt = path.join(dir, `cap${i}.txt`);
        await fs.writeFile(txt, lines.join('\n'), 'utf8');
        const spacing = Math.round(fontPx * 0.3);
        vf += `,drawtext=fontfile=${KHMER_FONT}:textfile=${txt}:expansion=none:fontcolor=${textColor}:fontsize=${fontPx}`
          + `:line_spacing=${spacing}:box=1:boxcolor=black@0.55:boxborderw=16:x=(w-text_w)/2:y=h-text_h-${margin * 2}`;
      }
      vf += ',setsar=1,format=yuv420p';
      const out = path.join(dir, `part${i}.mp4`);
      await runFfmpegArgs([
        '-nostdin', '-v', 'error', '-y', '-loop', '1', '-i', img, '-vf', vf, '-t', String(secs[i]), '-r', String(fps),
        '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-f', 'mp4', out,
      ], { timeoutMs: 120000 });
      parts.push(out);
    }

    const list = path.join(dir, 'list.txt');
    await fs.writeFile(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
    const joined = path.join(dir, 'joined.mp4');
    await runFfmpegArgs(['-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
      '-c', 'copy', '-movflags', '+faststart', '-f', 'mp4', joined], { timeoutMs: 120000 });

    let finalPath = joined;
    let audioFile = null;
    if (sfxType) {
      const sfx = synthSfx({ type: sfxType, durationSec: Math.min(total, 60) });
      if (!sfx.ok) return bad(sfx.message || 'sfx failed');
      audioFile = path.join(dir, 'sfx.wav');
      await fs.writeFile(audioFile, sfx.buf);
    } else if (audioBuf) {
      audioFile = path.join(dir, 'track.bin');
      await fs.writeFile(audioFile, audioBuf);
    }
    if (audioFile) {
      const muxed = path.join(dir, 'out.mp4');
      try {
        await runFfmpegArgs([
          '-nostdin', '-v', 'error', '-y', '-i', joined, '-i', audioFile, '-map', '0:v:0', '-map', '1:a:0',
          '-af', `afade=t=out:st=${Math.max(0, total - 1)}:d=1`, '-c:v', 'copy', '-c:a', 'aac', '-shortest',
          '-movflags', '+faststart', '-f', 'mp4', muxed,
        ], { timeoutMs: 120000 });
      } catch (e) {
        if (audioBuf) return bad('audio could not be decoded', 'bad_audio');
        throw e;
      }
      finalPath = muxed;
    }
    const buf = await fs.readFile(finalPath);
    return {
      ok: true, buf,
      applied: {
        slides: images.length, secondsPerSlide: sec.value, durations: Array.isArray(durations) ? secs : null, totalSec: total, width: w, height: h, effect,
        captions: caps.filter(Boolean).length, sfx: sfxType, audio: Boolean(audioBuf),
      },
    };
  } catch (e) {
    return { ok: false, message: 'ffmpeg_failed', detail: e && (e.detail || e.message) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
