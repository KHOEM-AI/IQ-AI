import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config/env.mjs';
import { createStorage } from '../media/storage.mjs';
import { createRegistry } from '../media/registry.mjs';
import { ok, fail } from './respond.mjs';
import { handleMedia } from './routes/media.mjs';
import { handleProcess } from './routes/process.mjs';

function authorized(req, token) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const a = crypto.createHash('sha256').update(m[1]).digest();
  const b = crypto.createHash('sha256').update(token).digest();
  return crypto.timingSafeEqual(a, b);
}

export function createApp(config) {
  if (!config.token) throw new Error('IQAI_TOKEN is required');
  const registry = createRegistry(createStorage(config.storageDir));
  const ctx = { config, registry };

  return http.createServer(async (req, res) => {
    try {
      if (config.corsOrigin) {
        res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Filename, Range');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
      }
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname;

      if (req.method === 'GET' && p === '/api/v1/health') {
        ok(res, 200, { status: 'up' });
        return;
      }
      if (p.startsWith('/api/v1/')) {
        if (!authorized(req, config.token)) {
          fail(res, 401, 'unauthorized', 'Missing or invalid token');
          return;
        }
        if (await handleMedia(req, res, p, ctx)) return;
        if (await handleProcess(req, res, p)) return;
      }
      fail(res, 404, 'not_found', 'Route not found');
    } catch (e) {
      if (e && e.code === 'too_large') {
        fail(res, 413, 'payload_too_large', 'Upload exceeds the size limit', { Connection: 'close' });
        return;
      }
      console.error('internal error:', e && e.message);
      if (!res.headersSent) fail(res, 500, 'internal_error', 'Internal error');
    }
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const config = loadConfig();
  if (!config.token) {
    config.token = crypto.randomBytes(24).toString('hex');
    console.log(`IQAI_TOKEN not set. Temporary token for this run: ${config.token}`);
  }
  createApp(config).listen(config.port, config.host, () => {
    console.log(`IQ-AI listening on ${config.host}:${config.port}`);
  });
}
