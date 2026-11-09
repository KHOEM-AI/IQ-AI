import { fail, readBody } from '../respond.mjs';
import { ffmpegAvailable, runFfmpeg } from '../../audio/ffmpeg.mjs';
import { renderVideoEdit, renderThumbnail } from '../../video/editVideo.mjs';
import { sniffMime } from '../../media/validation.mjs';

const MAX_VIDEO = 50 * 1024 * 1024;
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);
const PATHS = new Set(['/api/v1/videos/edit', '/api/v1/videos/thumbnail', '/api/v1/videos/audio']);

function send(res, contentType, buf, extra = {}) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': buf.length,
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  });
  res.end(buf);
}

// Edit an existing video: POST /videos/edit (mp4), /videos/thumbnail (jpeg), /videos/audio (wav).
export async function handleVideoEdit(req, res, p) {
  if (!PATHS.has(p)) return false;
  if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
  if (!(await ffmpegAvailable())) { fail(res, 503, 'ffmpeg_missing', 'ffmpeg is not installed (Termux: pkg install ffmpeg)'); return true; }
  const q = new URL(req.url, 'http://localhost').searchParams;
  const buf = await readBody(req, MAX_VIDEO); // too_large is turned into 413 by the server
  if (!buf.length) { fail(res, 400, 'empty_body', 'Request body is empty'); return true; }
  if (!VIDEO_MIMES.has(sniffMime(buf))) { fail(res, 415, 'unsupported_type', 'Body must be an MP4 or WebM video'); return true; }

  const processingFailed = (e, what) => {
    console.error(`video ${what} error:`, e && (e.detail || e.message));
    fail(res, 422, 'video_processing_failed', `Could not ${what} this video`);
  };

  try {
    if (p === '/api/v1/videos/audio') {
      const wav = await runFfmpeg(buf, ['-vn'], { timeoutMs: 120000 });
      if (!wav.length) { fail(res, 422, 'video_processing_failed', 'This video has no audio track'); return true; }
      send(res, 'audio/wav', wav);
      return true;
    }

    const r = p === '/api/v1/videos/edit'
      ? await renderVideoEdit({
        videoBuf: buf,
        trimStart: q.get('trimStart'), trimEnd: q.get('trimEnd'), speed: q.get('speed'),
        mute: q.get('mute'), width: q.get('width'), height: q.get('height'),
      })
      : await renderThumbnail({ videoBuf: buf, at: q.get('at'), width: q.get('width') });
    if (!r.ok && r.message === 'ffmpeg_failed') { processingFailed(r, 'process'); return true; }
    if (!r.ok) { fail(res, 400, r.code || 'bad_params', r.message); return true; }
    send(res, p === '/api/v1/videos/edit' ? 'video/mp4' : 'image/jpeg', r.buf, { 'X-Applied': JSON.stringify(r.applied) });
  } catch (e) {
    processingFailed(e, p === '/api/v1/videos/audio' ? 'extract audio from' : 'process');
  }
  return true;
}
