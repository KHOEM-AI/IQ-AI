import { fail, readBody } from '../respond.mjs';
import { ffmpegAvailable } from '../../audio/ffmpeg.mjs';
import { renderSlideshow, SLIDESHOW_LIMITS, SLIDE_EFFECTS } from '../../video/slideshow.mjs';
import { isValidId } from '../../media/registry.mjs';

// POST /api/v1/videos/slideshow
// JSON {"ids":["<image id>",...], "captions"?:[...], "secondsPerSlide"?, "width"?, "height"?,
//       "effect"?:"zoom-in|zoom-out|none", "fontSize"?, "textColor"?, "sfx"?, "audioId"?:"<audio id>",
//       "durations"?:[seconds per image, same length as ids]}
// Joins stored images into one mp4 (Khmer captions, optional sound). GET /videos/slideshow lists the limits.
export async function handleVideoSlideshow(req, res, p, ctx) {
  if (p !== '/api/v1/videos/slideshow') return false;
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, data: { limits: SLIDESHOW_LIMITS, effects: SLIDE_EFFECTS } }));
    return true;
  }
  if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
  if (!(await ffmpegAvailable())) { fail(res, 503, 'ffmpeg_missing', 'ffmpeg is not installed (Termux: pkg install ffmpeg)'); return true; }

  let body;
  try {
    const raw = (await readBody(req, 64 * 1024)).toString('utf8');
    body = raw ? JSON.parse(raw) : {};
  } catch (e) {
    if (e && e.code === 'too_large') throw e;
    fail(res, 400, 'bad_request', 'Body must be JSON: {"ids":["<image id>",...]}');
    return true;
  }
  const ids = body && body.ids;
  const [min, max] = SLIDESHOW_LIMITS.slides;
  if (!Array.isArray(ids) || ids.length < min || ids.length > max || !ids.every((x) => typeof x === 'string')) {
    fail(res, 400, 'bad_params', `ids must be an array of ${min}..${max} image ids`);
    return true;
  }
  if (!ids.every(isValidId)) { fail(res, 400, 'bad_params', 'ids must be media ids (UUID)'); return true; }
  if (body.audioId !== undefined && (typeof body.audioId !== 'string' || !isValidId(body.audioId))) {
    fail(res, 400, 'bad_params', 'audioId must be a media id (UUID)');
    return true;
  }

  const images = [];
  for (const id of ids) {
    const meta = await ctx.registry.get(id);
    if (!meta) { fail(res, 404, 'not_found', `Media not found: ${id}`); return true; }
    if (meta.type !== 'image') { fail(res, 415, 'unsupported_type', `Media is not an image: ${id}`); return true; }
    const buf = await ctx.registry.content(id);
    if (!buf) { fail(res, 404, 'not_found', `Media content missing: ${id}`); return true; }
    images.push(buf);
  }
  let audioBuf = null;
  if (body.audioId) {
    const meta = await ctx.registry.get(body.audioId);
    if (!meta) { fail(res, 404, 'not_found', `Media not found: ${body.audioId}`); return true; }
    if (meta.type !== 'audio') { fail(res, 415, 'unsupported_type', `Media is not audio: ${body.audioId}`); return true; }
    audioBuf = await ctx.registry.content(body.audioId);
    if (!audioBuf) { fail(res, 404, 'not_found', 'Media content missing'); return true; }
  }

  try {
    const r = await renderSlideshow({
      images, captions: body.captions, secondsPerSlide: body.secondsPerSlide, width: body.width, height: body.height,
      effect: body.effect, fontSize: body.fontSize, textColor: body.textColor, sfxType: body.sfx ?? null, audioBuf,
      durations: body.durations ?? null,
    });
    if (!r.ok && r.message === 'ffmpeg_failed') {
      console.error('slideshow error:', r.detail);
      fail(res, 422, 'video_processing_failed', 'Could not create this slideshow');
      return true;
    }
    if (!r.ok) {
      const status = r.status || (r.code === 'too_large' ? 413 : 400);
      fail(res, status, r.code || 'bad_params', r.message);
      return true;
    }
    res.writeHead(200, {
      'Content-Type': 'video/mp4', 'Content-Length': r.buf.length,
      'X-Content-Type-Options': 'nosniff', 'X-Applied': JSON.stringify(r.applied),
    });
    res.end(r.buf);
  } catch (e) {
    console.error('slideshow error:', e && (e.detail || e.message));
    fail(res, 422, 'video_processing_failed', 'Could not create this slideshow');
  }
  return true;
}
