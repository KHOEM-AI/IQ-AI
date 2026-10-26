import { fail } from '../respond.mjs';
import { inspectVideo } from '../../video/inspectVideo.mjs';

const PATH = '/api/v1/videos/inspect';
const MAX = 50 * 1024 * 1024;

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

export async function handleVideoInspect(req, res, p) {
  if (p !== PATH) return false;
  if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
  let buf;
  try { buf = await readBody(req); }
  catch { fail(res, 413, 'too_large', 'Video is larger than 50 MB'); return true; }
  const info = inspectVideo(buf);
  if (!info.ok) { fail(res, 400, 'bad_video', `Not a supported video (${info.reason})`); return true; }
  const { ok, ...data } = info;
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, data, error: null }));
  return true;
}
