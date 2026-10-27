import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { MIME, sniff, CATEGORIES } from '../../audio/validation.mjs';
import { buildMeta, applyPatch } from '../../audio/metadata.mjs';
import { searchLibrary } from '../../audio/library.mjs';
import { ID_RE } from '../../audio/storage.mjs';

export const json = (res, status, obj) => {
  res.writeHead(status, { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(obj));
};

async function readJsonBody(req, limit = 64 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const ch of req) {
    size += ch.length;
    if (size > limit) throw Object.assign(new Error('too_large'), { code: 'TOO_LARGE' });
    chunks.push(ch);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function soundsRoutes({ storage, token, maxBytes }) {
  const needAuth = (req, res) => {
    if (!token) { json(res, 503, { error: 'auth_not_configured' }); return false; }
    if (req.headers.authorization !== `Bearer ${token}`) { json(res, 401, { error: 'unauthorized' }); return false; }
    return true;
  };

  async function upload(req, res) {
    if (!needAuth(req, res)) return;
    const ct = (req.headers['content-type'] || '').split(';')[0].trim();
    if (!MIME[ct]) return json(res, 415, { error: 'unsupported_type' });
    if (Number(req.headers['content-length'] || 0) > maxBytes) {
      res.setHeader('connection', 'close');
      return json(res, 413, { error: 'too_large' });
    }
    const id = randomUUID();
    let size = 0, head = Buffer.alloc(0);
    try {
      await pipeline(
        req,
        async function* (src) {
          for await (const c of src) {
            size += c.length;
            if (size > maxBytes) throw Object.assign(new Error('too_large'), { code: 'TOO_LARGE' });
            if (head.length < 16) head = Buffer.concat([head, c]).subarray(0, 16);
            yield c;
          }
        },
        createWriteStream(storage.tmpPath(id)),
      );
    } catch (e) {
      await storage.discard(id);
      res.setHeader('connection', 'close');
      return e.code === 'TOO_LARGE' ? json(res, 413, { error: 'too_large' }) : json(res, 400, { error: 'upload_failed' });
    }
    const kind = sniff(head);
    if (!size || kind !== MIME[ct]) {
      await storage.discard(id);
      return json(res, 422, { error: 'invalid_or_corrupt_audio' });
    }
    await storage.commit(id);
    const meta = buildMeta({ id, headers: req.headers, mime: ct, size, kind });
    await storage.saveMeta(meta);
    json(res, 201, meta);
  }

  async function content(req, res, id, download) {
    const m = await storage.getMeta(id);
    if (!m) return json(res, 404, { error: 'not_found' });
    const p = storage.filePath(id);
    const st = await fs.stat(p);
    let s = 0, e = st.size - 1, status = 200;
    const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (r) {
      if (r[1] !== '') { s = +r[1]; if (r[2] !== '') e = Math.min(+r[2], e); }
      else if (r[2] !== '') s = Math.max(0, st.size - +r[2]);
      if (s > e || s >= st.size) { res.writeHead(416, { 'content-range': `bytes */${st.size}` }); return res.end(); }
      status = 206;
    }
    const h = {
      'content-type': m.mime, 'accept-ranges': 'bytes', 'content-length': e - s + 1,
      'x-content-type-options': 'nosniff',
    };
    if (status === 206) h['content-range'] = `bytes ${s}-${e}/${st.size}`;
    if (download) h['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(m.name)}.${m.format}`;
    res.writeHead(status, h);
    createReadStream(p, { start: s, end: e }).pipe(res);
  }

  return async function handle(req, res, url) {
    const p = url.pathname;
    if (p === '/api/v1/sounds' && req.method === 'GET') {
      const q = Object.fromEntries(url.searchParams);
      return json(res, 200, searchLibrary(await storage.listMeta(), q));
    }
    if (p === '/api/v1/sounds/upload' && req.method === 'POST') return upload(req, res);
    if (p === '/api/v1/sounds/categories' && req.method === 'GET') return json(res, 200, { items: [...CATEGORIES] });
    const m = /^\/api\/v1\/sounds\/([^/]+)(\/content)?$/.exec(p);
    if (!m) return json(res, 404, { error: 'not_found' });
    const id = m[1];
    if (!ID_RE.test(id)) return json(res, 400, { error: 'invalid_id' });
    if (m[2] && req.method === 'GET') return content(req, res, id, url.searchParams.get('download') === '1');
    if (!m[2] && req.method === 'GET') {
      const meta = await storage.getMeta(id);
      return meta ? json(res, 200, meta) : json(res, 404, { error: 'not_found' });
    }
    if (!m[2] && req.method === 'PATCH') {
      if (!needAuth(req, res)) return;
      const meta = await storage.getMeta(id);
      if (!meta) return json(res, 404, { error: 'not_found' });
      let body;
      try { body = await readJsonBody(req); }
      catch (err) {
        if (err.code === 'TOO_LARGE') { res.setHeader('connection', 'close'); return json(res, 413, { error: 'too_large' }); }
        return json(res, 400, { error: 'bad_json' });
      }
      const r = applyPatch(body);
      if (!r.ok) return json(res, 400, { error: 'invalid_field', message: r.message });
      const next = { ...meta, ...r.value, id: meta.id, updatedAt: new Date().toISOString() };
      await storage.saveMeta(next);
      return json(res, 200, next);
    }
    if (!m[2] && req.method === 'DELETE') {
      if (!needAuth(req, res)) return;
      if (!(await storage.getMeta(id))) return json(res, 404, { error: 'not_found' });
      await storage.remove(id);
      return json(res, 200, { deleted: id });
    }
    return json(res, 405, { error: 'method_not_allowed' });
  };
}
