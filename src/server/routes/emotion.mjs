import { fail } from '../respond.mjs';
import { analyzeEmotion } from '../../emotion/analyze.mjs';

const PATH = '/api/v1/emotion/analyze';
const MAX = 64 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export async function handleEmotion(req, res, p) {
  if (p !== PATH) return false;
  if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch { fail(res, 400, 'bad_request', 'Body must be JSON: {"text":"..."}'); return true; }
  if (!body || typeof body.text !== 'string' || !body.text.trim()) {
    fail(res, 400, 'bad_request', 'Field "text" is required');
    return true;
  }
  const data = analyzeEmotion(body.text);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, data, error: null }));
  return true;
}
