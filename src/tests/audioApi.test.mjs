import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createAudioHandler } from '../server/audioHandler.mjs';

const wav = () => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(64, 1)]);
const auth = { authorization: 'Bearer t0k' };
let srv, base, dir;

test.before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-'));
  const h = await createAudioHandler({ dataDir: dir, token: 't0k', maxBytes: 1000 });
  srv = http.createServer(async (q, s) => { if (!(await h(q, s))) { s.writeHead(404); s.end(); } });
  await new Promise((r) => srv.listen(0, r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
test.after(async () => { srv.close(); await fs.rm(dir, { recursive: true, force: true }); });

const up = (body, type = 'audio/wav', headers = auth) =>
  fetch(base + '/api/v1/sounds/upload', { method: 'POST', body, headers: { 'content-type': type, ...headers } });

test('health + not configured', async () => {
  assert.equal((await fetch(base + '/api/v1/audio/health')).status, 200);
  assert.equal((await fetch(base + '/api/v1/audio/generate', { method: 'POST' })).status, 501);
});
test('upload requires token', async () => {
  assert.equal((await up(wav(), 'audio/wav', {})).status, 401);
});
test('upload, list, content, delete', async () => {
  const r = await up(wav(), 'audio/wav', { ...auth, 'x-filename': 'rain', 'x-category': 'nature', 'x-tags': 'Rain,Storm' });
  assert.equal(r.status, 201);
  const m = await r.json();
  assert.equal(m.category, 'nature');
  assert.deepEqual(m.tags, ['rain', 'storm']);
  const l = await (await fetch(base + '/api/v1/sounds?q=storm')).json();
  assert.equal(l.total, 1);
  const c = await fetch(`${base}/api/v1/sounds/${m.id}/content`, { headers: { range: 'bytes=0-3' } });
  assert.equal(c.status, 206);
  assert.equal(Buffer.from(await c.arrayBuffer()).toString(), 'RIFF');
  assert.equal((await fetch(`${base}/api/v1/sounds/${m.id}`, { method: 'DELETE' })).status, 401);
  assert.equal((await fetch(`${base}/api/v1/sounds/${m.id}`, { method: 'DELETE', headers: auth })).status, 200);
  assert.equal((await fetch(`${base}/api/v1/sounds/${m.id}`)).status, 404);
});
test('rejects fake, wrong type, too large, bad id', async () => {
  assert.equal((await up(Buffer.from('not audio at all, plain text'))).status, 422);
  assert.equal((await up(wav(), 'text/plain')).status, 415);
  assert.equal((await up(Buffer.alloc(2000, 1))).status, 413);
  assert.equal((await fetch(base + '/api/v1/sounds/..%2F..%2Fetc')).status, 400);
});
