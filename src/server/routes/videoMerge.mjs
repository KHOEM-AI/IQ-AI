import { fail, readBody } from '../respond.mjs';
import { ffmpegAvailable } from '../../audio/ffmpeg.mjs';
import { renderMerge, MERGE_LIMITS } from '../../video/mergeVideos.mjs';
import { isValidId } from '../../media/registry.mjs';

// POST /api/v1/videos/merge  JSON {"ids":["<media id>", ...], "width"?, "height"?, "fps"?}
// Joins stored videos (from /api/v1/media) in the order given and returns one mp4.
// Size defaults to the first clip's; other clips are letterboxed into it.
export async function handleVideoMerge(req, res, p, ctx) {
  if (p !== '/api/v1/videos/merge') return false;
  if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
  if (!(await ffmpegAvailable())) { fail(res, 503, 'ffmpeg_missing', 'ffmpeg is not installed (Termux: pkg install ffmpeg)'); return true; }

  let body;
  try {
    const raw = (await readBody(req, 64 * 1024)).toString('utf8');
    body = raw ? JSON.parse(raw) : {};
  } catch (e) {
    if (e && e.code === 'too_large') throw e;
    fail(res, 400, 'bad_request', 'Body must be JSON: {"ids":["<id>","<id>"]}');
    return true;
  }
  const ids = body && body.ids;
  const [min, max] = MERGE_LIMITS.clips;
  if (!Array.isArray(ids) || ids.length < min || ids.length > max || !ids.every((x) => typeof x === 'string')) {
    fail(res, 400, 'bad_params', `ids must be an array of ${min}..${max} media ids`);
    return true;
  }
  if (!ids.every(isValidId)) { fail(res, 400, 'bad_params', 'ids must be media ids (UUID)'); return true; }

  const clips = [];
  let first = null;
  for (const id of ids) {
    const meta = await ctx.registry.get(id);
    if (!meta) { fail(res, 404, 'not_found', `Media not found: ${id}`); return true; }
    if (meta.type !== 'video') { fail(res, 415, 'unsupported_type', `Media is not a video: ${id}`); return true; }
    const buf = await ctx.registry.content(id);
    if (!buf) { fail(res, 404, 'not_found', `Media content missing: ${id}`); return true; }
    if (!first) first = meta;
    clips.push(buf);
  }
  const info = (first && first.info) || {};
  const defaultSize = info.width && info.height ? { width: info.width, height: info.height } : undefined;

  try {
    const r = await renderMerge({ clips, width: body.width, height: body.height, fps: body.fps, defaultSize });
    if (!r.ok && r.message === 'ffmpeg_failed') {
      console.error('video merge error:', r.detail);
      fail(res, 422, 'video_processing_failed', 'Could not merge these videos');
      return true;
    }
    if (!r.ok) { fail(res, r.code === 'too_large' ? 413 : 400, r.code || 'bad_params', r.message); return true; }
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': r.buf.length,
      'X-Content-Type-Options': 'nosniff',
      'X-Applied': JSON.stringify(r.applied),
    });
    res.end(r.buf);
  } catch (e) {
    console.error('video merge error:', e && (e.detail || e.message));
    fail(res, 422, 'video_processing_failed', 'Could not merge these videos');
  }
  return true;
}
