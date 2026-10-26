import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server/server.mjs';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}` };
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);
let server, base, dir;

const upload = (body, type = 'image/png') =>
  fetch(`${base}/api/v1/media`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': type, 'X-Filename': '../a b.png' },
    body,
  });

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-test-'));
  server = createApp({ storageDir: dir, maxUploadBytes: 1000, token: TOKEN, corsOrigin: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

test('health is public', async () => {
  const r = await fetch(`${base}/api/v1/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).data.status, 'up');
});

test('missing or wrong token is rejected', async () => {
  assert.equal((await fetch(`${base}/api/v1/media`)).status, 401);
  const r = await fetch(`${base}/api/v1/media`, { headers: { Authorization: 'Bearer nope' } });
  assert.equal(r.status, 401);
});

test('upload, metadata, download, list, delete', async () => {
  const up = await upload(png);
  assert.equal(up.status, 201);
  const meta = (await up.json()).data;
  assert.equal(meta.type, 'image');
  assert.equal(meta.size, png.length);
  assert.equal(meta.filename, 'a_b.png');

  const m = await fetch(`${base}/api/v1/media/${meta.id}`, { headers: auth });
  assert.equal(m.status, 200);

  const c = await fetch(`${base}/api/v1/media/${meta.id}/content`, { headers: auth });
  assert.equal(c.status, 200);
  assert.equal(c.headers.get('content-type'), 'image/png');
  assert.ok(Buffer.from(await c.arrayBuffer()).equals(png));

  const l = await fetch(`${base}/api/v1/media`, { headers: auth });
  assert.ok((await l.json()).data.items.some((i) => i.id === meta.id));

  const d = await fetch(`${base}/api/v1/media/${meta.id}`, { method: 'DELETE', headers: auth });
  assert.equal(d.status, 200);
  const gone = await fetch(`${base}/api/v1/media/${meta.id}/content`, { headers: auth });
  assert.equal(gone.status, 404);
});

test('unsupported content type is rejected', async () => {
  assert.equal((await upload(png, 'text/plain')).status, 415);
});

test('content that does not match its type is rejected', async () => {
  const r = await upload(Buffer.from('this is plain text, not a png'));
  assert.equal(r.status, 415);
  assert.equal((await r.json()).error.code, 'content_mismatch');
});

test('empty body is rejected', async () => {
  assert.equal((await upload(Buffer.alloc(0))).status, 400);
});

test('oversized upload is rejected', async () => {
  const big = Buffer.concat([png, Buffer.alloc(2000, 1)]);
  assert.equal((await upload(big)).status, 413);
});

test('unknown and invalid ids return 404', async () => {
  const unknown = await fetch(`${base}/api/v1/media/00000000-0000-4000-8000-000000000000`, { headers: auth });
  assert.equal(unknown.status, 404);
  const bad = await fetch(`${base}/api/v1/media/..%2F..%2Fetc`, { headers: auth });
  assert.equal(bad.status, 404);
});

test('processing endpoints are honest about no provider', async () => {
  const r = await fetch(`${base}/api/v1/images/process`, { method: 'POST', headers: auth });
  assert.equal(r.status, 501);
  assert.equal((await r.json()).error.code, 'provider_not_configured');
});

test('unknown route returns 404', async () => {
  assert.equal((await fetch(`${base}/nothing`)).status, 404);
});
