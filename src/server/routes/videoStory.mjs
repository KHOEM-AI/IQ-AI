import { fail, readBody } from '../respond.mjs';
import { ffmpegAvailable } from '../../audio/ffmpeg.mjs';
import { renderStory, STORY_LIMITS, STORY_EFFECTS, STORY_TRANSITIONS } from '../../video/story.mjs';
import { isValidId } from '../../media/registry.mjs';

// POST /api/v1/videos/story
// JSON {"scenes":[{"imageId"?:"<image id>","text"?:"...","seconds"?:4}, ...], "secondsPerScene"?, "width"?, "height"?,
//       "effect"?, "transition"?:"fade|none", "fontSize"?, "textColor"?, "bgColor"?, "sfx"?, "audioId"?:"<audio id>"}
// A scene is a stored photo (optional caption) or a text card. GET lists the limits.
export async function handleVideoStory(req, res, p, ctx) {
  if (p !== '/api/v1/videos/story') return false;
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, data: { limits: STORY_LIMITS, effects: STORY_EFFECTS, transitions: STORY_TRANSITIONS } }));
    return true;
  }
  if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
  if (!(await ffmpegAvailable())) { fail(res, 503, 'ffmpeg_missing', 'ffmpeg is not installed (Termux: pkg install ffmpeg)'); return true; }

  let body;
  try {
    const raw = (await readBody(req, 256 * 1024)).toString('utf8');
    body = raw ? JSON.parse(raw) : {};
  } catch (e) {
    if (e && e.code === 'too_large') throw e;
    fail(res, 400, 'bad_request', 'Body must be JSON: {"scenes":[{"imageId":"...","text":"..."}]}');
    return true;
  }
  const raw = body && body.scenes;
  const [min, max] = STORY_LIMITS.scenes;
  if (!Array.isArray(raw) || raw.length < min || raw.length > max || !raw.every((s) => s && typeof s === 'object' && !Array.isArray(s))) {
    fail(res, 400, 'bad_params', `scenes must be an array of ${min}..${max} objects`);
    return true;
  }
  for (const s of raw) {
    if (s.imageId !== undefined && s.imageId !== null && (typeof s.imageId !== 'string' || !isValidId(s.imageId))) {
      fail(res, 400, 'bad_params', 'imageId must be a media id (UUID)');
      return true;
    }
    if (s.text !== undefined && s.text !== null && typeof s.text !== 'string') { fail(res, 400, 'bad_params', 'text must be a string'); return true; }
  }
  if (body.audioId !== undefined && (typeof body.audioId !== 'string' || !isValidId(body.audioId))) {
    fail(res, 400, 'bad_params', 'audioId must be a media id (UUID)');
    return true;
  }

  const scenes = [];
  for (const s of raw) {
    let image = null;
    if (s.imageId) {
      const meta = await ctx.registry.get(s.imageId);
      if (!meta) { fail(res, 404, 'not_found', `Media not found: ${s.imageId}`); return true; }
      if (meta.type !== 'image') { fail(res, 415, 'unsupported_type', `Media is not an image: ${s.imageId}`); return true; }
      image = await ctx.registry.content(s.imageId);
      if (!image) { fail(res, 404, 'not_found', `Media content missing: ${s.imageId}`); return true; }
    }
    scenes.push({ image, text: s.text, seconds: s.seconds });
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
    const r = await renderStory({
      scenes, secondsPerScene: body.secondsPerScene, width: body.width, height: body.height, effect: body.effect,
      transition: body.transition, fontSize: body.fontSize, textColor: body.textColor, bgColor: body.bgColor,
      sfxType: body.sfx ?? null, audioBuf,
    });
    if (!r.ok && r.message === 'ffmpeg_failed') {
      console.error('story error:', r.detail);
      fail(res, 422, 'video_processing_failed', 'Could not create this story');
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
    console.error('story error:', e && (e.detail || e.message));
    fail(res, 422, 'video_processing_failed', 'Could not create this story');
  }
  return true;
}
