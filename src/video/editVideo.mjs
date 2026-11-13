import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runFfmpegArgs } from './ffmpegRun.mjs';

// Edit an existing video (trim / speed / mute / resize) and grab a still frame.
// ffmpeg only: no AI model, no network. Same style as photoToVideo.mjs.

const LIMITS = { time: [0, 3600], speed: [0.5, 2], side: [160, 1920], thumbWidth: [64, 1280] };

// undefined / '' / null -> { ok:true, value:undefined }; otherwise a finite number inside [lo, hi].
function parseNum(v, [lo, hi]) {
  if (v === undefined || v === null || v === '') return { ok: true, value: undefined };
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return { ok: false };
  return { ok: true, value: n };
}

function parseBool(v) {
  if (v === undefined || v === null || v === '' || v === false) return { ok: true, value: false };
  if (v === true || v === 'true' || v === '1') return { ok: true, value: true };
  if (v === 'false' || v === '0') return { ok: true, value: false };
  return { ok: false };
}

const evenSize = (n) => Math.max(2, Math.round(n / 2) * 2);
const bad = (message, code = 'bad_params') => ({ ok: false, message, code });

async function canDecode(args) {
  try { await runFfmpegArgs(args, { timeoutMs: 15000 }); return true; } catch { return false; }
}

// videoBuf: MP4/WebM bytes. Returns { ok, buf (mp4), applied } or { ok:false, message, code }.
export async function renderVideoEdit({ videoBuf, trimStart, trimEnd, speed, mute, width, height, signal, timeoutMs } = {}) {
  const ts = parseNum(trimStart, LIMITS.time);
  const te = parseNum(trimEnd, LIMITS.time);
  const sp = parseNum(speed, LIMITS.speed);
  const w0 = parseNum(width, LIMITS.side);
  const h0 = parseNum(height, LIMITS.side);
  const mu = parseBool(mute);
  if (!ts.ok || !te.ok) return bad(`trimStart/trimEnd must be ${LIMITS.time[0]}..${LIMITS.time[1]} seconds`);
  if (!sp.ok) return bad(`speed must be ${LIMITS.speed[0]}..${LIMITS.speed[1]}`);
  if (!w0.ok || !h0.ok) return bad(`width/height must be ${LIMITS.side[0]}..${LIMITS.side[1]}`);
  if (!mu.ok) return bad('mute must be true or false');
  const start = ts.value ?? 0;
  if (te.value !== undefined && te.value <= start) return bad('trimEnd must be greater than trimStart');
  const rate = sp.value ?? 1;
  const w = w0.value === undefined ? undefined : evenSize(w0.value);
  const h = h0.value === undefined ? undefined : evenSize(h0.value);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-ve-'));
  try {
    const inFile = path.join(dir, 'in.bin');
    await fs.writeFile(inFile, videoBuf);
    if (!(await canDecode(['-nostdin', '-v', 'error', '-i', inFile, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-']))) {
      return bad('video could not be decoded', 'bad_video');
    }
    const hasAudio = await canDecode(['-nostdin', '-v', 'error', '-i', inFile, '-map', '0:a:0', '-frames:a', '1', '-f', 'null', '-']);
    const keepAudio = hasAudio && !mu.value;

    // -ss / -t before -i: both measured on the source timeline, so they stay correct when speed changes.
    const args = ['-nostdin', '-v', 'error', '-y'];
    if (start > 0) args.push('-ss', String(start));
    if (te.value !== undefined) args.push('-t', String(te.value - start));
    args.push('-i', inFile, '-map', '0:v:0');

    const vf = [];
    if (w !== undefined || h !== undefined) vf.push(`scale=${w ?? -2}:${h ?? -2}`);
    if (rate !== 1) vf.push(`setpts=PTS/${rate}`);
    vf.push('format=yuv420p');
    args.push('-vf', vf.join(','));

    if (keepAudio) {
      args.push('-map', '0:a:0');
      if (rate !== 1) args.push('-af', `atempo=${rate}`);
      args.push('-c:a', 'aac');
    } else {
      args.push('-an');
    }
    const out = path.join(dir, 'out.mp4');
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-f', 'mp4', out);
    await runFfmpegArgs(args, { signal, ...(timeoutMs ? { timeoutMs } : {}) });

    // ffmpeg exits 0 with a header-only mp4 when trimStart is past the end, so check a frame really exists.
    if (!(await canDecode(['-nostdin', '-v', 'error', '-i', out, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-']))) {
      return bad('nothing left after trimming (is trimStart past the end?)');
    }
    const buf = await fs.readFile(out);
    return {
      ok: true,
      buf,
      applied: { trimStart: start, trimEnd: te.value ?? null, speed: rate, mute: mu.value, audio: keepAudio, width: w ?? null, height: h ?? null },
    };
  } catch (e) {
    return { ok: false, message: 'ffmpeg_failed', detail: e && (e.detail || e.message) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

// One JPEG frame at `at` seconds, `width` px wide (height keeps the aspect ratio).
export async function renderThumbnail({ videoBuf, at, width } = {}) {
  const t = parseNum(at, LIMITS.time);
  const w0 = parseNum(width, LIMITS.thumbWidth);
  if (!t.ok) return bad(`at must be ${LIMITS.time[0]}..${LIMITS.time[1]} seconds`);
  if (!w0.ok) return bad(`width must be ${LIMITS.thumbWidth[0]}..${LIMITS.thumbWidth[1]}`);
  const w = evenSize(w0.value ?? 320);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-vt-'));
  const inFile = path.join(dir, 'in.bin');
  const out = path.join(dir, 'out.jpg');
  try {
    await fs.writeFile(inFile, videoBuf);
    await runFfmpegArgs([
      '-nostdin', '-v', 'error', '-y', '-ss', String(t.value ?? 0), '-i', inFile,
      '-map', '0:v:0', '-frames:v', '1', '-vf', `scale=${w}:-2`, '-q:v', '4', '-f', 'image2', out,
    ], { timeoutMs: 30000 });
    const buf = await fs.readFile(out).catch(() => Buffer.alloc(0));
    if (!buf.length) return bad('no frame at that time (is `at` past the end of the video?)');
    return { ok: true, buf, applied: { at: t.value ?? 0, width: w } };
  } catch (e) {
    // Seeking past the end: some ffmpeg builds exit 0 with no frame, others fail to open the JPEG encoder.
    // If the video itself decodes, the cause is `at`, which is the caller's mistake (400), not a processing failure.
    if (e && e.message === 'ffmpeg_failed' &&
        await canDecode(['-nostdin', '-v', 'error', '-i', inFile, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-'])) {
      return bad('no frame at that time (is `at` past the end of the video?)');
    }
    return { ok: false, message: 'ffmpeg_failed', detail: e && (e.detail || e.message) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
