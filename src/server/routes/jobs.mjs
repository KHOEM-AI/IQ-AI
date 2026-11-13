import { ok, fail, readBody } from '../respond.mjs';
import { ffmpegAvailable } from '../../audio/ffmpeg.mjs';
import { isJobId } from '../../jobs/jobManager.mjs';

const ID_PATH = /^\/api\/v1\/jobs\/([^/]+)$/;

// Background jobs for long work.
//   POST   /api/v1/jobs        JSON {"type":"video.edit|video.merge","params":{...}} -> 202 + job
//   GET    /api/v1/jobs        -> { items, types }
//   GET    /api/v1/jobs/:id    -> job (status queued|running|done|failed|cancelled, progress, result.mediaId)
//   DELETE /api/v1/jobs/:id    -> cancels a queued/running job, removes a finished one
// The finished video is a normal media item: GET /api/v1/media/:mediaId/content (supports Range).
export async function handleJobs(req, res, p, ctx) {
  const jobs = ctx.jobs;
  if (p === '/api/v1/jobs') {
    if (req.method === 'GET') { ok(res, 200, { items: await jobs.list(), types: jobs.types() }); return true; }
    if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
    let body;
    try {
      const raw = (await readBody(req, 256 * 1024)).toString('utf8');
      body = raw ? JSON.parse(raw) : {};
    } catch (e) {
      if (e && e.code === 'too_large') throw e;
      fail(res, 400, 'bad_request', 'Body must be JSON: {"type":"video.merge","params":{...}}');
      return true;
    }
    if (!body || typeof body.type !== 'string') { fail(res, 400, 'bad_params', 'type is required'); return true; }
    const params = body.params ?? {};
    if (typeof params !== 'object' || Array.isArray(params)) { fail(res, 400, 'bad_params', 'params must be an object'); return true; }
    if (!(await ffmpegAvailable())) { fail(res, 503, 'ffmpeg_missing', 'ffmpeg is not installed (Termux: pkg install ffmpeg)'); return true; }
    const r = await jobs.submit(body.type, params);
    if (!r.ok) fail(res, r.status, r.code, r.message);
    else ok(res, 202, r.job);
    return true;
  }

  const m = ID_PATH.exec(p);
  if (!m) return false;
  const id = m[1];
  if (req.method !== 'GET' && req.method !== 'DELETE') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
  if (!isJobId(id)) { fail(res, 404, 'not_found', 'Job not found'); return true; }
  if (req.method === 'GET') {
    const j = await jobs.get(id);
    if (!j) fail(res, 404, 'not_found', 'Job not found');
    else ok(res, 200, j);
    return true;
  }
  if (req.method === 'DELETE') {
    const j = await jobs.cancelOrRemove(id);
    if (!j) fail(res, 404, 'not_found', 'Job not found');
    else ok(res, 200, j);
    return true;
  }
  fail(res, 405, 'method_not_allowed', 'Method not allowed');
  return true;
}
