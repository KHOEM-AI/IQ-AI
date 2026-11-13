import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runFfmpegArgs } from './ffmpegRun.mjs';
import { KHMER_FONT, wrapText } from './textToVideo.mjs';
import { synthSfx, SFX_TYPES } from '../audio/sfx/synth.mjs';

// Story video: a list of scenes (photo with optional caption, or a text card), each with its own
// length, joined with fade-through-black transitions and one music/sound track over the whole video.
// ffmpeg only: no AI model, no network.

export const STORY_LIMITS = {
  scenes: [1, 30], sceneSeconds: [1, 60], totalSeconds: 900, side: [320, 1280], fontSize: [16, 96], text: 600,
  totalImageBytes: 80 * 1024 * 1024,
};
export const STORY_EFFECTS = ['zoom-in', 'zoom-out', 'none'];
export const STORY_TRANSITIONS = ['fade', 'none'];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const evenSize = (n) => Math.max(2, Math.round(n / 2) * 2);
const bad = (message, code = 'bad_params') => ({ ok: false, message, code });
const inRange = (v, [lo, hi]) => Number.isFinite(v) && v >= lo && v <= hi;
const q = (s) => String(s).replace(/'/g, "'\\''");

function motion(effect, frames, fps, w, h) {
  if (effect === 'none') return `scale=${w}:${h}`;
  const z = effect === 'zoom-out' ? 'if(eq(on,1),1.5,max(1.001,zoom-0.0015))' : 'min(zoom+0.0015,1.5)';
  return `zoompan=z='${z}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=${fps}`;
}

// scenes: [{ image?: Buffer, text?: string, seconds?: number }]
// audioBuf: optional stored audio (looped / cut to the video length) instead of sfx.
export async function renderStory({
  scenes, secondsPerScene = 4, width, height, effect = 'zoom-in', transition = 'fade',
  fontSize, textColor = '#ffffff', bgColor = '#000000', sfxType = null, audioBuf = null,
} = {}) {
  const [smin, smax] = STORY_LIMITS.scenes;
  if (!Array.isArray(scenes) || scenes.length < smin || scenes.length > smax) return bad(`story needs ${smin}..${smax} scenes`);
  if (!STORY_EFFECTS.includes(effect)) return bad(`effect must be one of: ${STORY_EFFECTS.join(', ')}`);
  if (!STORY_TRANSITIONS.includes(transition)) return bad(`transition must be one of: ${STORY_TRANSITIONS.join(', ')}`);
  if (!HEX_COLOR.test(textColor) || !HEX_COLOR.test(bgColor)) return bad('textColor and bgColor must be #RRGGBB');
  if (sfxType !== null && !SFX_TYPES.includes(sfxType)) return bad(`sfx must be one of: ${SFX_TYPES.join(', ')}`);
  if (sfxType && audioBuf) return bad('use either sfx or audioId, not both');
  const dflt = Number(secondsPerScene);
  if (!inRange(dflt, STORY_LIMITS.sceneSeconds)) return bad(`secondsPerScene must be ${STORY_LIMITS.sceneSeconds.join('..')}`);
  const w0 = width === undefined ? 720 : Number(width);
  const h0 = height === undefined ? 1280 : Number(height);
  if (!inRange(w0, STORY_LIMITS.side) || !inRange(h0, STORY_LIMITS.side)) return bad(`width/height must be ${STORY_LIMITS.side.join('..')}`);
  const fs0 = fontSize === undefined ? 44 : Number(fontSize);
  if (!inRange(fs0, STORY_LIMITS.fontSize)) return bad(`fontSize must be ${STORY_LIMITS.fontSize.join('..')}`);

  let imageBytes = 0;
  const list = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i] || {};
    const text = typeof s.text === 'string' && s.text.trim() ? s.text.trim() : null;
    const image = s.image || null;
    if (!image && !text) return bad(`scene ${i + 1} needs a photo or some text`);
    if (text && Array.from(text).length > STORY_LIMITS.text) return bad(`scene ${i + 1}: text must be at most ${STORY_LIMITS.text} characters`);
    const sec = s.seconds === undefined || s.seconds === null ? dflt : Number(s.seconds);
    if (!inRange(sec, STORY_LIMITS.sceneSeconds)) return bad(`scene ${i + 1}: seconds must be ${STORY_LIMITS.sceneSeconds.join('..')}`);
    if (image) imageBytes += image.length;
    list.push({ image, text, sec });
  }
  if (imageBytes > STORY_LIMITS.totalImageBytes) return bad('images are too large together', 'too_large');
  const total = list.reduce((n, s) => n + s.sec, 0);
  if (total > STORY_LIMITS.totalSeconds) return bad(`the whole story must be at most ${STORY_LIMITS.totalSeconds} seconds`, 'too_long');
  if (list.some((s) => s.text)) {
    try { await fs.access(KHMER_FONT); }
    catch { return { ok: false, code: 'font_missing', status: 503, message: `Khmer font not found: ${KHMER_FONT}` }; }
  }

  const w = evenSize(w0);
  const h = evenSize(h0);
  const fontPx = Math.round(fs0);
  const fps = 25;
  const margin = Math.round(w * 0.08);
  const maxChars = Math.max(4, Math.floor((w - margin * 2) / (fontPx * 0.62)));
  const spacing = Math.round(fontPx * 0.3);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-story-'));
  try {
    const parts = [];
    for (let i = 0; i < list.length; i++) {
      const { image, text, sec } = list[i];
      const frames = Math.round(sec * fps);
      let vf;
      let input;
      if (image) {
        const img = path.join(dir, `img${i}.bin`);
        await fs.writeFile(img, image);
        try {
          await runFfmpegArgs(['-nostdin', '-v', 'error', '-i', img, '-frames:v', '1', '-f', 'null', '-'], { timeoutMs: 15000 });
        } catch {
          return bad(`scene ${i + 1}: the photo could not be decoded`, 'bad_image');
        }
        input = ['-loop', '1', '-i', img];
        vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},${motion(effect, frames, fps, w, h)}`;
      } else {
        input = ['-f', 'lavfi', '-i', `color=c=${bgColor}:s=${w}x${h}:r=${fps}`];
        vf = 'null';
      }
      if (text) {
        // photo: caption near the bottom; text card: centred
        const maxLines = Math.max(1, Math.floor((h * (image ? 0.3 : 0.7)) / (fontPx * 1.3)));
        const { lines } = wrapText(text, maxChars, maxLines);
        const txt = path.join(dir, `t${i}.txt`);
        await fs.writeFile(txt, lines.join('\n'), 'utf8');
        const box = image ? ':box=1:boxcolor=black@0.55:boxborderw=16' : '';
        const y = image ? `h-text_h-${margin * 2}` : '(h-text_h)/2';
        vf += `,drawtext=fontfile=${KHMER_FONT}:textfile=${txt}:expansion=none:fontcolor=${textColor}:fontsize=${fontPx}`
          + `:line_spacing=${spacing}${box}:x=(w-text_w)/2:y=${y}`;
      }
      if (transition === 'fade') {
        const f = Math.min(0.5, sec / 3).toFixed(2);
        vf += `,fade=t=in:st=0:d=${f},fade=t=out:st=${(sec - Number(f)).toFixed(2)}:d=${f}`;
      }
      vf += ',setsar=1,format=yuv420p';
      const out = path.join(dir, `part${i}.mp4`);
      await runFfmpegArgs([
        '-nostdin', '-v', 'error', '-y', ...input, '-vf', vf, '-t', String(sec), '-r', String(fps),
        '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-f', 'mp4', out,
      ], { timeoutMs: 60000 + sec * 6000 });
      parts.push(out);
    }

    const listFile = path.join(dir, 'list.txt');
    await fs.writeFile(listFile, parts.map((p) => `file '${q(p)}'`).join('\n'), 'utf8');
    const joined = path.join(dir, 'joined.mp4');
    await runFfmpegArgs(['-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-c', 'copy', '-movflags', '+faststart', '-f', 'mp4', joined], { timeoutMs: 180000 });

    let finalPath = joined;
    let audioFile = null;
    let loop = false;
    if (sfxType) {
      const sfx = synthSfx({ type: sfxType, durationSec: Math.min(total, 60) });
      if (!sfx.ok) return bad(sfx.message || 'sfx failed');
      audioFile = path.join(dir, 'sfx.wav');
      await fs.writeFile(audioFile, sfx.buf);
      loop = total > 60; // synthesized sound is capped at 60 s: repeat it
    } else if (audioBuf) {
      audioFile = path.join(dir, 'track.bin');
      await fs.writeFile(audioFile, audioBuf);
      loop = true;
    }
    if (audioFile) {
      const muxed = path.join(dir, 'out.mp4');
      try {
        await runFfmpegArgs([
          '-nostdin', '-v', 'error', '-y', '-i', joined, ...(loop ? ['-stream_loop', '-1'] : []), '-i', audioFile,
          '-map', '0:v:0', '-map', '1:a:0',
          '-af', `afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, total - 1.5)}:d=1.5`,
          '-c:v', 'copy', '-c:a', 'aac', '-t', String(total), '-movflags', '+faststart', '-f', 'mp4', muxed,
        ], { timeoutMs: 180000 });
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
        scenes: list.length, totalSec: total, width: w, height: h, effect, transition,
        photos: list.filter((s) => s.image).length, texts: list.filter((s) => s.text).length,
        sfx: sfxType, audio: Boolean(audioBuf),
      },
    };
  } catch (e) {
    return { ok: false, message: 'ffmpeg_failed', detail: e && (e.detail || e.message) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
