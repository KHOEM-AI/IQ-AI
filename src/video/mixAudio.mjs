import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runFfmpegArgs } from './ffmpegRun.mjs';
import { inspectVideo } from './inspectVideo.mjs';

// Put a narration track and/or background music under a video (Phase 3 of the story pipeline).
// ffmpeg only: no AI model, no network.
//   - the video picture is copied (mp4) or re-encoded (webm); the result is always an mp4
//   - narration starts at 0; music loops to the length of the video
//   - duck: while the narration speaks the music gets quieter (sidechain compressor)
//   - the output is exactly as long as the video (longer audio is cut, shorter audio is not stretched)

export const MIX_LIMITS = { volume: [0, 4], fade: [0, 30], audioBytes: 100 * 1024 * 1024 };
const bad = (message, code = 'bad_params') => ({ ok: false, message, code });

function num(v, [lo, hi], def) {
  if (v === undefined || v === null || v === '') return { ok: true, value: def };
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return { ok: false };
  return { ok: true, value: n };
}
function bool(v, def) {
  if (v === undefined || v === null || v === '') return { ok: true, value: def };
  if (v === true || v === 'true' || v === '1') return { ok: true, value: true };
  if (v === false || v === 'false' || v === '0') return { ok: true, value: false };
  return { ok: false };
}
async function canDecode(args) {
  try { await runFfmpegArgs(args, { timeoutMs: 15000 }); return true; } catch { return false; }
}

// videoBuf (MP4/WebM), narrationBuf / musicBuf (WAV/OGG/MP3), all optional except videoBuf and at least one audio source
// (the video's own sound counts when originalVolume > 0). Returns { ok, buf (mp4), applied } or { ok:false, message, code }.
export async function renderMix({
  videoBuf, narrationBuf, musicBuf, originalVolume, narrationVolume, musicVolume, duck, fadeIn, fadeOut, signal,
} = {}) {
  const ov = num(originalVolume, MIX_LIMITS.volume, 0);
  const nv = num(narrationVolume, MIX_LIMITS.volume, 1);
  const mv = num(musicVolume, MIX_LIMITS.volume, 0.25);
  const fi = num(fadeIn, MIX_LIMITS.fade, 0);
  const fo = num(fadeOut, MIX_LIMITS.fade, 0);
  const dk = bool(duck, true);
  if (!ov.ok || !nv.ok || !mv.ok) return bad(`volumes must be ${MIX_LIMITS.volume[0]}..${MIX_LIMITS.volume[1]}`);
  if (!fi.ok || !fo.ok) return bad(`fadeIn/fadeOut must be ${MIX_LIMITS.fade[0]}..${MIX_LIMITS.fade[1]} seconds`);
  if (!dk.ok) return bad('duck must be true or false');
  const hasNarr = Buffer.isBuffer(narrationBuf) && narrationBuf.length > 0;
  const hasMusic = Buffer.isBuffer(musicBuf) && musicBuf.length > 0;
  if (!hasNarr && !hasMusic) return bad('give a narration and/or a music track');
  for (const b of [narrationBuf, musicBuf]) {
    if (b && b.length > MIX_LIMITS.audioBytes) return bad('audio is too large', 'too_large');
  }

  const info = inspectVideo(videoBuf);
  if (!info.ok || !(info.durationSec > 0)) return bad('video could not be read', 'bad_video');
  const D = Math.round(info.durationSec * 1000) / 1000;
  const isMp4 = videoBuf.toString('ascii', 4, 8) === 'ftyp';

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-mix-'));
  try {
    const vFile = path.join(dir, 'video.bin');
    await fs.writeFile(vFile, videoBuf);
    if (!(await canDecode(['-nostdin', '-v', 'error', '-i', vFile, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-']))) {
      return bad('video could not be decoded', 'bad_video');
    }
    const videoHasAudio = await canDecode(['-nostdin', '-v', 'error', '-i', vFile, '-map', '0:a:0', '-frames:a', '1', '-f', 'null', '-']);
    const useOrig = videoHasAudio && ov.value > 0;

    const args = ['-nostdin', '-v', 'error', '-y', '-i', vFile];
    let nIdx = -1;
    let mIdx = -1;
    let next = 1;
    if (hasNarr) {
      const f = path.join(dir, 'narration.bin');
      await fs.writeFile(f, narrationBuf);
      if (!(await canDecode(['-nostdin', '-v', 'error', '-i', f, '-frames:a', '1', '-f', 'null', '-']))) return bad('narration could not be decoded', 'bad_audio');
      args.push('-i', f);
      nIdx = next++;
    }
    if (hasMusic) {
      const f = path.join(dir, 'music.bin');
      await fs.writeFile(f, musicBuf);
      if (!(await canDecode(['-nostdin', '-v', 'error', '-i', f, '-frames:a', '1', '-f', 'null', '-']))) return bad('music could not be decoded', 'bad_audio');
      args.push('-stream_loop', '-1', '-i', f);
      mIdx = next++;
    }

    const norm = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';
    const g = [];
    const mixIn = [];
    if (useOrig) { g.push(`[0:a:0]${norm},volume=${ov.value}[orig]`); mixIn.push('[orig]'); }
    const ducking = hasNarr && hasMusic && dk.value;
    if (hasNarr) {
      if (ducking) {
        // pad the narration with silence to the full video length: if the sidechain stream ended early,
        // the compressor would end too and the music would stop when the narration stops
        g.push(`[${nIdx}:a:0]${norm},volume=${nv.value},apad=whole_dur=${D},asplit=2[narr][nsc]`);
      } else {
        g.push(`[${nIdx}:a:0]${norm},volume=${nv.value}[narr]`);
      }
      mixIn.push('[narr]');
    }
    if (hasMusic) {
      g.push(`[${mIdx}:a:0]${norm},volume=${mv.value}[mus0]`);
      if (ducking) {
        g.push('[mus0][nsc]sidechaincompress=threshold=0.03:ratio=10:attack=30:release=500[mus]');
      } else {
        g.push('[mus0]anull[mus]');
      }
      mixIn.push('[mus]');
    }
    let last = mixIn[0];
    if (mixIn.length > 1) {
      g.push(`${mixIn.join('')}amix=inputs=${mixIn.length}:duration=longest:normalize=0[mixed]`);
      last = '[mixed]';
    }
    const post = [];
    if (fi.value > 0) post.push(`afade=t=in:st=0:d=${Math.min(fi.value, D)}`);
    if (fo.value > 0) post.push(`afade=t=out:st=${Math.max(0, D - fo.value)}:d=${Math.min(fo.value, D)}`);
    post.push('alimiter=limit=0.97');
    g.push(`${last}${post.join(',')}[aout]`);

    const out = path.join(dir, 'out.mp4');
    args.push('-filter_complex', g.join(';'), '-map', '0:v:0', '-map', '[aout]');
    if (isMp4) args.push('-c:v', 'copy');
    else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p');
    args.push('-c:a', 'aac', '-b:a', '160k', '-t', String(D), '-movflags', '+faststart', '-f', 'mp4', out);
    await runFfmpegArgs(args, { timeoutMs: 120000 + Math.round(D * 1000), signal });

    const buf = await fs.readFile(out);
    return {
      ok: true,
      buf,
      applied: {
        durationSec: D, narration: hasNarr, music: hasMusic, originalAudio: useOrig, duck: ducking,
        originalVolume: ov.value, narrationVolume: nv.value, musicVolume: mv.value, fadeIn: fi.value, fadeOut: fo.value,
      },
    };
  } catch (e) {
    if (e && e.code === 'aborted') throw e;
    return { ok: false, message: 'ffmpeg_failed', detail: e && (e.detail || e.message) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
