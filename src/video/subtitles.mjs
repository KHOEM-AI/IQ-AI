import fs from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runFfmpegArgs } from './ffmpegRun.mjs';
import { inspectVideo } from './inspectVideo.mjs';
import { wrapText, KHMER_FONT } from './textToVideo.mjs';

// Burn Khmer (or any) subtitles into a video (Phase 4 of the story pipeline).
// ffmpeg drawtext only (the same Khmer font + harfbuzz path as text videos): no AI model, no network.
// Cues are { start, end, text } in seconds; or pass `srt` text (SubRip) and it is parsed into cues.
// Khmer has no spaces between words, so lines are wrapped by display cluster (wrapText), never inside one.

// Noto Sans Khmer has NO Latin letters (verified on Termux: "HELLO" renders blank), and drawtext uses one font per
// text. So a cue that contains Khmer uses the Khmer font, any other cue uses a Latin font ($LATIN_FONT first, then
// common Android/Linux fonts). A cue that MIXES Khmer and Latin uses the Khmer font: its Latin letters do not show
// (reported as applied.mixedCues).
const LATIN_DIRS = ['/system/fonts', '/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/truetype/noto', '/usr/share/fonts/noto'];
const LATIN_NAMES = [/^Roboto-Regular\.ttf$/, /^RobotoStatic-Regular\.ttf$/, /^NotoSans-Regular\.ttf$/, /^DroidSans\.ttf$/, /^DejaVuSans\.ttf$/, /^Roboto.*\.ttf$/];
function findLatinFont() {
  if (process.env.LATIN_FONT && existsSync(process.env.LATIN_FONT)) return process.env.LATIN_FONT;
  for (const re of LATIN_NAMES) {
    for (const d of LATIN_DIRS) {
      try {
        const hit = readdirSync(d).find((n) => re.test(n));
        if (hit) return `${d}/${hit}`;
      } catch { /* directory missing */ }
    }
  }
  return null;
}
export const LATIN_FONT = findLatinFont();
const HAS_KHMER = /[\u1780-\u17FF\u19E0-\u19FF]/;
const HAS_LATIN = /[A-Za-z]/;

export const SUB_LIMITS = { cues: 300, textChars: 300, fontSize: [12, 120], boxOpacity: [0, 1], seconds: [0, 86400] };
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const bad = (message, code = 'bad_params') => ({ ok: false, message, code });

// "00:01:02,500" or "00:01:02.500" or "01:02,5" -> seconds, or null
function parseTime(s) {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(s.trim());
  if (!m) return null;
  const ms = m[4] ? Number(m[4].padEnd(3, '0')) : 0;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + ms / 1000;
}

// SubRip text -> cues. Throws nothing: returns { ok, cues } or { ok:false, message }.
export function parseSrt(text) {
  if (typeof text !== 'string' || !text.trim()) return bad('srt is empty');
  const blocks = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().split(/\n{2,}/);
  const cues = [];
  for (const b of blocks) {
    const lines = b.split('\n');
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) return bad(`srt block without a time line: "${b.slice(0, 30)}"`);
    const [a, z] = lines[ti].split('-->');
    const start = parseTime(a);
    const end = parseTime(String(z).trim().split(/\s+/)[0]);
    if (start === null || end === null) return bad(`srt bad time: "${lines[ti].slice(0, 40)}"`);
    cues.push({ start, end, text: lines.slice(ti + 1).join('\n') });
  }
  return { ok: true, cues };
}

function checkCues(cues) {
  if (!Array.isArray(cues) || !cues.length) return bad('cues must be a non-empty array of {start,end,text}');
  if (cues.length > SUB_LIMITS.cues) return bad(`at most ${SUB_LIMITS.cues} cues per call (split a long story by scene)`);
  const out = [];
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    const start = Number(c && c.start);
    const end = Number(c && c.end);
    const text = typeof (c && c.text) === 'string' ? c.text.replace(/\r/g, '').trim() : '';
    const [lo, hi] = SUB_LIMITS.seconds;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < lo || end > hi || end <= start) return bad(`cue ${i + 1}: need 0 <= start < end`);
    if (!text) return bad(`cue ${i + 1}: text is empty`);
    if (Array.from(text).length > SUB_LIMITS.textChars) return bad(`cue ${i + 1}: text is longer than ${SUB_LIMITS.textChars} characters`);
    out.push({ start, end, text });
  }
  return { ok: true, cues: out };
}

// Inside a filtergraph file a path needs \ : ' escaped.
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");

// videoBuf (MP4/WebM). Returns { ok, buf (mp4), applied } or { ok:false, message, code }.
export async function renderSubtitles({
  videoBuf, cues, srt, fontSize, color = '#ffffff', boxOpacity = 0.55, position = 'bottom', signal,
} = {}) {
  let list = cues;
  if (list === undefined && srt !== undefined) {
    const p = parseSrt(srt);
    if (!p.ok) return p;
    list = p.cues;
  }
  const cc = checkCues(list);
  if (!cc.ok) return cc;
  if (!HEX_COLOR.test(color)) return bad('color must be #RRGGBB');
  const bo = Number(boxOpacity);
  if (!Number.isFinite(bo) || bo < 0 || bo > 1) return bad('boxOpacity must be 0..1');
  if (!['bottom', 'middle', 'top'].includes(position)) return bad('position must be bottom, middle or top');

  const info = inspectVideo(videoBuf);
  if (!info.ok || !info.width || !info.height) return bad('video could not be read', 'bad_video');
  const w = info.width;
  const h = info.height;
  let fs0 = fontSize === undefined || fontSize === '' ? Math.round(Math.min(w, h) * 0.06) : Number(fontSize);
  if (!Number.isFinite(fs0) || fs0 < SUB_LIMITS.fontSize[0] || fs0 > SUB_LIMITS.fontSize[1]) return bad(`fontSize must be ${SUB_LIMITS.fontSize[0]}..${SUB_LIMITS.fontSize[1]}`);
  fs0 = Math.round(fs0);
  try { await fs.access(KHMER_FONT); } catch { return { ok: false, status: 503, message: `Khmer font not found: ${KHMER_FONT}`, code: 'font_missing' }; }

  const margin = Math.round(w * 0.06);
  const maxChars = Math.max(4, Math.floor((w - margin * 2) / (fs0 * 0.62)));
  const lineSpacing = Math.round(fs0 * 0.25);
  const isMp4 = videoBuf.toString('ascii', 4, 8) === 'ftyp';

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-sub-'));
  try {
    const vFile = path.join(dir, 'video.bin');
    await fs.writeFile(vFile, videoBuf);
    const y = position === 'bottom' ? `h-text_h-${Math.round(h * 0.07)}` : position === 'top' ? `${Math.round(h * 0.07)}` : '(h-text_h)/2';
    // NOTE: no -filter_script: ffmpeg 9 removed it ("Unrecognized option 'filter_script:v'"). The chain goes in -vf;
    // textfile names are relative to the temp dir (cwd) to keep each cue's filter short, so 300 cues stay far
    // below the 128 KB single-argument limit of Linux/Android.
    const filters = [];
    let truncated = 0;
    let mixed = 0;
    let noLatinFont = 0;
    for (let i = 0; i < cc.cues.length; i++) {
      const c = cc.cues[i];
      const khmer = HAS_KHMER.test(c.text);
      if (khmer && HAS_LATIN.test(c.text)) mixed++;
      const font = khmer ? KHMER_FONT : (LATIN_FONT || KHMER_FONT);
      if (!khmer && !LATIN_FONT && HAS_LATIN.test(c.text)) noLatinFont++;
      const { lines, truncated: t } = wrapText(c.text.replace(/\n+/g, ' '), maxChars, 3);
      if (t) truncated++;
      const tf = `c${i}.txt`;
      await fs.writeFile(path.join(dir, tf), lines.join('\n'), 'utf8');
      filters.push(
        `drawtext=fontfile='${esc(font)}':textfile=${tf}:expansion=none:fontcolor=${color}:fontsize=${fs0}`
        + `:line_spacing=${lineSpacing}:box=1:boxcolor=black@${bo}:boxborderw=${Math.round(fs0 * 0.3)}`
        + `:x=(w-text_w)/2:y=${y}:enable='between(t,${c.start},${c.end})'`,
      );
    }
    const out = 'out.mp4';
    const args = ['-nostdin', '-v', 'error', '-y', '-i', 'video.bin', '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', filters.join(','), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', isMp4 ? 'copy' : 'aac', '-movflags', '+faststart', '-f', 'mp4', out];
    await runFfmpegArgs(args, { timeoutMs: 120000 + Math.round((info.durationSec || 60) * 1500), signal, cwd: dir });
    const buf = await fs.readFile(path.join(dir, out));
    return { ok: true, buf, applied: { cues: cc.cues.length, fontSize: fs0, position, color, boxOpacity: bo, truncatedCues: truncated, mixedCues: mixed, latinFont: LATIN_FONT, noLatinFontCues: noLatinFont } };
  } catch (e) {
    if (e && e.code === 'aborted') throw e;
    return { ok: false, message: 'ffmpeg_failed', detail: e && (e.detail || e.message) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
