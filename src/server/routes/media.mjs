import { ok, fail, readBody } from '../respond.mjs';
import { isValidId } from '../../media/registry.mjs';

const ID_PATH = /^\/api\/v1\/media\/([^/]+)(\/content)?$/;

export async function handleMedia(req, res, p, ctx) {
  const { config, registry } = ctx;

  if (p === '/api/v1/media') {
    if (req.method === 'POST') {
      const buf = await readBody(req, config.maxUploadBytes);
      const r = await registry.create({
        buf,
        mime: req.headers['content-type'],
        filename: req.headers['x-filename'],
      });
      if (!r.ok) fail(res, r.status, r.code, r.message);
      else ok(res, 201, r.data);
      return true;
    }
    if (req.method === 'GET') {
      ok(res, 200, { items: await registry.list() });
      return true;
    }
    fail(res, 405, 'method_not_allowed', 'Method not allowed');
    return true;
  }

  const m = ID_PATH.exec(p);
  if (!m) return false;
  const id = m[1];
  const wantsContent = Boolean(m[2]);

  if (!isValidId(id)) {
    fail(res, 404, 'not_found', 'Media not found');
    return true;
  }
  const meta = await registry.get(id);
  if (!meta) {
    fail(res, 404, 'not_found', 'Media not found');
    return true;
  }

  if (req.method === 'GET' && !wantsContent) {
    ok(res, 200, meta);
    return true;
  }
  if (req.method === 'GET' && wantsContent) {
    const buf = await registry.content(id);
    if (!buf) {
      fail(res, 404, 'not_found', 'Media content not found');
      return true;
    }
    res.writeHead(200, {
      'Content-Type': meta.mime,
      'Content-Length': buf.length,
      'Content-Disposition': `inline; filename="${meta.filename}"`,
      'Cache-Control': 'private, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(buf);
    return true;
  }
  if (req.method === 'DELETE' && !wantsContent) {
    await registry.remove(id);
    ok(res, 200, { id, deleted: true });
    return true;
  }
  fail(res, 405, 'method_not_allowed', 'Method not allowed');
  return true;
}
