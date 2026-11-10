import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail } from './respond.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };

// GET /ui/<file> -> public/<file> (GET /ui -> sound-studio.html). Read-only, no directory listing.
export async function serveStatic(res, p) {
  let rel = decodeURIComponent(p.replace(/^\/ui\/?/, '')) || 'sound-studio.html';
  const file = path.resolve(ROOT, rel);
  const type = TYPES[path.extname(file)];
  if (!file.startsWith(ROOT + path.sep) || !type) { fail(res, 404, 'not_found', 'Route not found'); return true; }
  try {
    const buf = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    res.end(buf);
  } catch { fail(res, 404, 'not_found', 'Route not found'); }
  return true;
}
