import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { runFfmpegArgs } from './ffmpegRun.mjs';
import { synthSfx, SFX_TYPES } from '../audio/sfx/synth.mjs';

// Font lookup: $KHMER_FONT first, then common Android/Termux/Linux locations.
const FONT_CANDIDATES = [
  process.env.KHMER_FONT,
  '/system/fonts/NotoSansKhmer-Regular.ttf',
  '/system/fonts/NotoSansKhmerUI-Regular.ttf',
  process.env.PREFIX && `${process.env.PREFIX}/share/fonts/NotoSansKhmer-Regular.ttf`,
  '/usr/share/fonts/truetype/noto/NotoSansKhmer-Regular.ttf',
  '/usr/share/fonts/noto/NotoSansKhmer-Regular.ttf',
].filter(Boolean);
export const KHMER_FONT = FONT_CANDIDATES.find((f) => existsSync(f)) || FONT_CANDIDATES.find(Boolean);
export const khmerFontAvailable = () => existsSync(KHMER_FONT);
const LIMITS = { durationSec: [1, 20], side: [320, 1280], fontSize: [16, 120], text: [1, 2000] };
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function clampNum(v, def, [lo, hi]) {
  if (v === undefined || v === null || v === '') return { ok: true, value: def };
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return { ok: false };
  return { ok: true, value: n };
}
const evenSize = (n) => Math.max(2, Math.round(n / 2) * 2);

// Split text into display clusters: a base character plus its combining marks,
// and the Khmer coeng (U+17D2) plus the consonant it subscripts. A line break
// must never fall inside one cluster, or the Khmer text renders corrupted.
const COMBINING = /^[\p{M}\u200C\u200D]$/u;
function clusters(s) {
  const out = [];
  let prev = '';
  for (const c of Array.from(s)) {
    if (out.length && (COMBINING.test(c) || prev === '\u17D2')) out[out.length - 1] += c;
    else out.push(c);
    prev = c;
  }
  return out;
}

// Word-wrap that also hard-splits a single "word" longer than the line width
// (Khmer text often has no spaces, so whole sentences can arrive as one token).
export function wrapText(text, maxCharsPerLine, maxLines) {
  const chars = (s) => clusters(s).length;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  const pushHardSplit = (word) => {
    let chunk = '';
    for (const c of clusters(word)) {
      if (chars(chunk) >= maxCharsPerLine) { lines.push(chunk); chunk = ''; }
      chunk += c;
    }
    return chunk;
  };
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (chars(candidate) <= maxCharsPerLine) { cur = candidate; continue; }
    if (cur) lines.push(cur);
    cur = chars(w) > maxCharsPerLine ? pushHardSplit(w) : w;
  }
  if (cur) lines.push(cur);
  const truncated = lines.length > maxLines;
  return { lines: lines.slice(0, maxLines), truncated };
}

// Returns { ok, buf (mp4), applied } or { ok:false, message }.
export async function renderTextVideo({
  text, durationSec, width, height, fontSize, bgColor = '#000000', textColor = '#ffffff', sfxType = null,
} = {}) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, message: 'text is required' };
  if (Array.from(text).length > LIMITS.text[1]) return { ok: false, message: `text must be at most ${LIMITS.text[1]} characters` };
  const dur = clampNum(durationSec, 5, LIMITS.durationSec);
  const w0 = clampNum(width, 720, LIMITS.side);
  const h0 = clampNum(height, 1280, LIMITS.side);
  const fs0 = clampNum(fontSize, 48, LIMITS.fontSize);
  if (!dur.ok) return { ok: false, message: `durationSec must be ${LIMITS.durationSec[0]}..${LIMITS.durationSec[1]}` };
  if (!w0.ok || !h0.ok) return { ok: false, message: `width/height must be ${LIMITS.side[0]}..${LIMITS.side[1]}` };
  if (!fs0.ok) return { ok: false, message: `fontSize must be ${LIMITS.fontSize[0]}..${LIMITS.fontSize[1]}` };
  if (!HEX_COLOR.test(bgColor) || !HEX_COLOR.test(textColor)) return { ok: false, message: 'bgColor/textColor must be #RRGGBB' };
  if (sfxType !== null && !SFX_TYPES.includes(sfxType)) return { ok: false, message: `sfx must be one of: ${SFX_TYPES.join(', ')}` };

  try { await fs.access(KHMER_FONT); }
  catch { return { ok: false, status: 503, message: `Khmer font not found: ${KHMER_FONT}` }; }

  const w = evenSize(w0.value);
  const h = evenSize(h0.value);
  const fontSizePx = Math.round(fs0.value);
  const fps = 25;

  const margin = Math.round(w * 0.08);
  const usableW = w - margin * 2;
  const approxCharW = fontSizePx * 0.62;
  const maxCharsPerLine = Math.max(4, Math.floor(usableW / approxCharW));
  const usableH = h - margin * 2;
  const lineHeight = fontSizePx * 1.3;
  const maxLines = Math.max(1, Math.floor(usableH / lineHeight));
  const { lines, truncated } = wrapText(text, maxCharsPerLine, maxLines);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-tv-'));
  try {
    const txtPath = path.join(dir, 'text.txt');
    await fs.writeFile(txtPath, lines.join('\n'), 'utf8');
    const silentMp4 = path.join(dir, 'silent.mp4');
    const lineSpacing = Math.round(fontSizePx * 0.3);
    const vf = `drawtext=fontfile=${KHMER_FONT}:textfile=${txtPath}:expansion=none:fontcolor=${textColor}:fontsize=${fontSizePx}:line_spacing=${lineSpacing}:x=(w-text_w)/2:y=(h-text_h)/2`;
    await runFfmpegArgs([
      '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${bgColor}:s=${w}x${h}:d=${dur.value}`,
      '-vf', vf, '-r', String(fps), '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mp4', silentMp4,
    ]);

    let finalPath = silentMp4;
    if (sfxType) {
      const sfx = synthSfx({ type: sfxType, durationSec: dur.value });
      if (!sfx.ok) return sfx;
      const wavPath = path.join(dir, 'sfx.wav');
      await fs.writeFile(wavPath, sfx.buf);
      const muxed = path.join(dir, 'out.mp4');
      await runFfmpegArgs([
        '-nostdin', '-v', 'error', '-y', '-i', silentMp4, '-i', wavPath,
        '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-f', 'mp4', muxed,
      ]);
      finalPath = muxed;
    }
    const buf = await fs.readFile(finalPath);
    return {
      ok: true, buf,
      applied: { durationSec: dur.value, width: w, height: h, fontSize: fontSizePx, bgColor, textColor, sfx: sfxType, lines: lines.length, truncated },
    };
  } catch (e) {
    return { ok: false, message: 'ffmpeg_failed', detail: e && (e.detail || e.message) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
