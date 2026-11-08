import { ok, fail, readBody } from '../respond.mjs';
import { ffmpegAvailable } from '../../audio/ffmpeg.mjs';
import { renderPhotoVideo, EFFECTS } from '../../video/photoToVideo.mjs';
import { renderTextVideo } from '../../video/textToVideo.mjs';
import { sniffMime } from '../../media/validation.mjs';
import { SFX_TYPES } from '../../audio/sfx/synth.mjs';

const MAX_IMAGE = 15 * 1024 * 1024;
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function sendMp4(res, buf, extra = {}) {
  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Content-Length': buf.length,
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  });
  res.end(buf);
}

async function jsonBody(req) {
  const raw = (await readBody(req, 64 * 1024)).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export async function handleVideoGenerate(req, res, p) {
  if (p === '/api/v1/videos/effects') {
    if (req.method !== 'GET') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
    ok(res, 200, { effects: EFFECTS, sfxTypes: SFX_TYPES, note: 'No AI model — ffmpeg zoompan/drawtext, runs fully offline' });
    return true;
  }

  if (p === '/api/v1/videos/photo') {
    if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
    if (!(await ffmpegAvailable())) { fail(res, 503, 'ffmpeg_missing', 'ffmpeg is not installed (Termux: pkg install ffmpeg)'); return true; }
    const q = new URL(req.url, 'http://localhost').searchParams;
    const buf = await readBody(req, MAX_IMAGE);
    if (!buf.length) { fail(res, 400, 'empty_body', 'Request body is empty'); return true; }
    if (!IMAGE_MIMES.has(sniffMime(buf))) { fail(res, 415, 'unsupported_type', 'Body must be PNG, JPEG, WEBP or GIF image'); return true; }
    try {
      const r = await renderPhotoVideo({
        imageBuf: buf,
        effect: q.get('effect') || 'zoom-in',
        durationSec: q.has('durationSec') ? q.get('durationSec') : undefined,
        width: q.has('width') ? q.get('width') : undefined,
        height: q.has('height') ? q.get('height') : undefined,
        sfxType: q.get('sfx') || null,
      });
      if (!r.ok && r.message === 'ffmpeg_failed') {
        console.error('photo video error:', r.detail);
        fail(res, 422, 'video_processing_failed', 'Could not create a video from this photo');
        return true;
      }
      if (!r.ok) { fail(res, 400, 'bad_params', r.message); return true; }
      sendMp4(res, r.buf, { 'X-Applied': JSON.stringify(r.applied) });
    } catch (e) {
      console.error('photo video error:', e && (e.detail || e.message));
      fail(res, 422, 'video_processing_failed', 'Could not create a video from this photo');
    }
    return true;
  }

  if (p === '/api/v1/videos/text') {
    if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
    if (!(await ffmpegAvailable())) { fail(res, 503, 'ffmpeg_missing', 'ffmpeg is not installed (Termux: pkg install ffmpeg)'); return true; }
    let body;
    try { body = await jsonBody(req); }
    catch (e) {
      if (e && e.code === 'too_large') throw e;
      fail(res, 400, 'bad_request', 'Body must be JSON: {"text":"..."}'); return true;
    }
    try {
      const b = body || {};
      const r = await renderTextVideo({
        text: b.text, durationSec: b.durationSec, width: b.width, height: b.height,
        fontSize: b.fontSize, bgColor: b.bgColor, textColor: b.textColor,
        sfxType: b.sfx ?? null,
      });
      if (!r.ok && r.message === 'ffmpeg_failed') {
        console.error('text video error:', r.detail);
        fail(res, 422, 'video_processing_failed', 'Could not create this video');
        return true;
      }
      if (!r.ok) { fail(res, r.status || 400, r.status ? 'font_missing' : 'bad_params', r.message); return true; }
      sendMp4(res, r.buf, { 'X-Applied': JSON.stringify(r.applied) });
    } catch (e) {
      console.error('text video error:', e && (e.detail || e.message));
      fail(res, 422, 'video_processing_failed', 'Could not create this video');
    }
    return true;
  }
  return false;
}
