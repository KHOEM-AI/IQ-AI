import { fail } from '../respond.mjs';

const KINDS = {
  '/api/v1/images/process': 'image',
  '/api/v1/audio/process': 'audio',
  '/api/v1/videos/process': 'video',
};

export async function handleProcess(req, res, p) {
  const kind = KINDS[p];
  if (kind) {
    if (req.method !== 'POST') fail(res, 405, 'method_not_allowed', 'Method not allowed');
    else fail(res, 501, 'provider_not_configured', `No ${kind} processor is configured yet`);
    return true;
  }
  if (/^\/api\/v1\/jobs\/[^/]+$/.test(p)) {
    fail(res, 404, 'not_found', 'Job not found');
    return true;
  }
  return false;
}
