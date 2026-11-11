import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runFfmpegArgs } from './ffmpegRun.mjs';

// Join several videos into one mp4, in the order given. ffmpeg only: no AI model, no network.
// Every clip is first normalised (same size, frame rate, H.264 + AAC stereo; a silent clip gets
// silence of its own length), then the normalised clips are joined with ffmpeg's concat demuxer
// (stream copy), so clips with and without audio can be mixed freely.

export const MERGE_LIMITS = { clips: [2, 20], side: [160, 1920], fps: [10, 60], totalBytes: 150 * 1024 * 1024 };

const evenSize = (n) => Math.max(2, Math.round(n / 2) * 2);
const bad = (message, code = 'bad_params') => ({ ok: false, message, code });

function parseNum(v, [lo, hi], def) {
  if (v === undefined || v === null || v === '') return { ok: true, value: def };
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return { ok: false };
  return { ok: true, value: n };
}

async function canDecode(args) {
  try { await runFfmpegArgs(args, { timeoutMs: 15000 }); return true; } catch { return false; }
}

// clips: Buffer[] (MP4/WebM bytes). width/height default to `defaultSize` (usually the first clip).
// Returns { ok, buf (mp4), applied } or { ok:false, message, code }.
export async function renderMerge({ clips, width, height, fps, defaultSize } = {}) {
  if (!Array.isArray(clips) || clips.length < MERGE_LIMITS.clips[0] || clips.length > MERGE_LIMITS.clips[1]) {
    return bad(`merge needs ${MERGE_LIMITS.clips[0]}..${MERGE_LIMITS.clips[1]} clips`);
  }
  const total = clips.reduce((n, b) => n + b.length, 0);
  if (total > MERGE_LIMITS.totalBytes) return bad('clips are too large to merge together', 'too_large');
  const fb = defaultSize || { width: 720, height: 1280 };
  const w0 = parseNum(width, MERGE_LIMITS.side, fb.width);
  const h0 = parseNum(height, MERGE_LIMITS.side, fb.height);
  const f0 = parseNum(fps, MERGE_LIMITS.fps, 25);
  if (!w0.ok || !h0.ok) return bad(`width/height must be ${MERGE_LIMITS.side[0]}..${MERGE_LIMITS.side[1]}`);
  if (!f0.ok) return bad(`fps must be ${MERGE_LIMITS.fps[0]}..${MERGE_LIMITS.fps[1]}`);
  const w = evenSize(Math.min(MERGE_LIMITS.side[1], Math.max(MERGE_LIMITS.side[0], w0.value)));
  const h = evenSize(Math.min(MERGE_LIMITS.side[1], Math.max(MERGE_LIMITS.side[0], h0.value)));
  const rate = Math.round(f0.value);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-vm-'));
  try {
    const parts = [];
    let withAudio = 0;
    for (let i = 0; i < clips.length; i++) {
      const inFile = path.join(dir, `in${i}.bin`);
      await fs.writeFile(inFile, clips[i]);
      if (!(await canDecode(['-nostdin', '-v', 'error', '-i', inFile, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-']))) {
        return bad(`clip ${i + 1} could not be decoded`, 'bad_video');
      }
      const hasAudio = await canDecode(['-nostdin', '-v', 'error', '-i', inFile, '-map', '0:a:0', '-frames:a', '1', '-f', 'null', '-']);
      if (hasAudio) withAudio++;
      const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${rate},format=yuv420p`;
      const out = path.join(dir, `part${i}.mp4`);
      const args = ['-nostdin', '-v', 'error', '-y', '-i', inFile];
      if (hasAudio) {
        args.push('-map', '0:v:0', '-map', '0:a:0', '-af', 'aresample=44100,aformat=channel_layouts=stereo');
      } else {
        // silence exactly as long as the picture: -shortest stops the endless anullsrc with the video
        args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-map', '0:v:0', '-map', '1:a:0', '-shortest');
      }
      args.push('-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', '-f', 'mp4', out);
      await runFfmpegArgs(args, { timeoutMs: 120000 + Math.round(clips[i].length / 1024 / 1024) * 4000 });
      parts.push(out);
    }

    const list = path.join(dir, 'list.txt');
    await fs.writeFile(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
    const merged = path.join(dir, 'merged.mp4');
    await runFfmpegArgs(['-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
      '-c', 'copy', '-movflags', '+faststart', '-f', 'mp4', merged], { timeoutMs: 120000 });
    const buf = await fs.readFile(merged);
    return {
      ok: true,
      buf,
      applied: { clips: clips.length, width: w, height: h, fps: rate, clipsWithAudio: withAudio, silentClips: clips.length - withAudio },
    };
  } catch (e) {
    return { ok: false, message: 'ffmpeg_failed', detail: e && (e.detail || e.message) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
