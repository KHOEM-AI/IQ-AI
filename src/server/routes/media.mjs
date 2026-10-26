import { ok, fail, readBody } from '../respond.mjs';
import { isValidId } from '../../media/registry.mjs';

const ID_PATH = /^\/api\/v1\/media\/([^/]+)(\/content)?$/;

// Clients send X-Filename percent-encoded so non-ASCII names fit in an HTTP header.
function decodeHeader(value) {
  if (typeof value !== 'string') return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// ASCII fallback plus RFC 5987 form: Node refuses header values that are not plain ASCII.
function contentDisposition(name) {
  const fallback = name.replace(/[^A-Za-z0-9._-]/g, '_');
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

// Returns null (no usable Range header: send everything), 'bad' (unsatisfiable) or { start, end }.
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    const n = Number(m[2]);
    if (n === 0) return 'bad';
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return 'bad';
  return { start, end };
}

export async function handleMedia(req, res, p, ctx) {
  const { config, registry } = ctx;

  if (p === '/api/v1/media') {
    if (req.method === 'POST') {
      const buf = await readBody(req, config.maxUploadBytes);
      const r = await registry.create({
        buf,
        mime: req.headers['content-type'],
        filename: decodeHeader(req.headers['x-filename']),
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
    const headers = {
      'Content-Type': meta.mime,
      'Content-Disposition': contentDisposition(meta.filename),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    };
    const range = parseRange(req.headers.range, buf.length);
    if (range === 'bad') {
      fail(res, 416, 'range_not_satisfiable', 'Range not satisfiable', { 'Content-Range': `bytes */${buf.length}` });
      return true;
    }
    if (range) {
      const part = buf.subarray(range.start, range.end + 1);
      res.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${range.start}-${range.end}/${buf.length}`,
        'Content-Length': part.length,
      });
      res.end(part);
      return true;
    }
    res.writeHead(200, { ...headers, 'Content-Length': buf.length });
    res.end(buf);
    return true;
  }

  if (req.method === 'PATCH' && !wantsContent) {
    const raw = await readBody(req, 4096);
    let body = null;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      body = null;
    }
    if (!body || typeof body.filename !== 'string' || body.filename.trim() === '') {
      fail(res, 400, 'invalid_body', 'Expected a JSON body with a non-empty "filename"');
      return true;
    }
    ok(res, 200, await registry.rename(id, body.filename));
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
