import { json } from './sounds.routes.mjs';

export function audioRoutes() {
  return async function handle(req, res, url) {
    const p = url.pathname;
    if (p === '/api/v1/audio/health' && req.method === 'GET') {
      return json(res, 200, {
        ok: true,
        features: { upload: true, library: true, process: 'not_configured', generate: 'not_configured', jobs: 'not_configured' },
      });
    }
    if ((p === '/api/v1/audio/process' || p === '/api/v1/audio/generate') && req.method === 'POST') {
      return json(res, 501, { error: 'not_configured' });
    }
    if (/^\/api\/v1\/audio\/jobs\/[^/]+$/.test(p) && req.method === 'GET') {
      return json(res, 501, { error: 'not_configured' });
    }
    return json(res, 404, { error: 'not_found' });
  };
}
