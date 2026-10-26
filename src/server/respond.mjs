export function sendJson(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  });
  res.end(body);
}

export const ok = (res, status, data) => sendJson(res, status, { ok: true, data, error: null });

export const fail = (res, status, code, message, extra = {}) =>
  sendJson(res, status, { ok: false, data: null, error: { code, message } }, extra);

export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const tooLarge = () => Object.assign(new Error('too_large'), { code: 'too_large' });
    const declared = Number(req.headers['content-length']);
    if (declared > limit) return reject(tooLarge());
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        chunks.length = 0;
        req.removeAllListeners('data');
        reject(tooLarge());
        req.resume();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
