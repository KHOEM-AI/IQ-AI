import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server/server.mjs';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}` };
let server, base, dir;

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-cap-'));
  server = createApp({ host: '127.0.0.1', port: 0, storageDir: path.join(dir, 'm'), audioStorageDir: path.join(dir, 'a'), maxUploadBytes: 1e6, token: TOKEN, corsOrigin: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await fs.rm(dir, { recursive: true, force: true }); });

test('capabilities needs a token', async () => {
  assert.equal((await fetch(`${base}/api/v1/capabilities`)).status, 401);
});
test('capabilities lists system, features and options', async () => {
  const r = await fetch(`${base}/api/v1/capabilities`, { headers: auth });
  assert.equal(r.status, 200);
  const { data } = await r.json();
  assert.equal(typeof data.system.ffmpeg, 'boolean');
  assert.equal(data.features.tts.ready, false);
  assert.ok(data.options.voicePresets.includes('male'));
  assert.ok(data.options.photoEffects.includes('zoom-in'));
  assert.ok(data.features.media.ready);
});
test('capabilities: POST -> 405', async () => {
  assert.equal((await fetch(`${base}/api/v1/capabilities`, { method: 'POST', headers: auth })).status, 405);
});
test('/ui serves sound studio without a token; blocks traversal and unknown types', async () => {
  const r = await fetch(`${base}/ui`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.equal((await fetch(`${base}/ui/..%2Fpackage.json`)).status, 404);
  assert.equal((await fetch(`${base}/ui/nope.html`)).status, 404);
});
