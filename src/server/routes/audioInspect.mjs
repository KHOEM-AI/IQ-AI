import { fail } from '../respond.mjs';
import { inspectWav } from '../../audio/inspectWav.mjs';

const PATH = '/api/v1/audio/inspect';
const MAX = 20 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function handleAudioInspect(req, res, p) {
  if (p !== PATH) return false;
  if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
  let buf;
  try { buf = await readBody(req); }
  catch { fail(res, 413, 'too_large', 'Audio is larger than 20 MB'); return true; }
  const info = inspectWav(buf);
  if (!info.ok) { fail(res, 400, 'bad_audio', `Not a valid WAV file (${info.reason})`); return true; }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, data: info, error: null }));
  return true;
}
