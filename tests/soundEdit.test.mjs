import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createAudioHandler } from '../src/server/audioHandler.mjs';

const wav = () => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(64, 1)]);
const auth = { authorization: 'Bearer t0k' };
let srv, base, dir;

test.before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'soundedit-'));
  const h = await createAudioHandler({ dataDir: dir, token: 't0k', maxBytes: 1000 });
  srv = http.createServer(async (q, s) => { if (!(await h(q, s))) { s.writeHead(404); s.end(); } });
  await new Promise((r) => srv.listen(0, r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
test.after(async () => {
  srv.closeAllConnections();
  await new Promise((r) => srv.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

const up = async (extra = {}) => {
  const r = await fetch(base + '/api/v1/sounds/upload', {
    method: 'POST', body: wav(), headers: { 'content-type': 'audio/wav', ...auth, ...extra },
  });
  assert.equal(r.status, 201);
  return r.json();
};
const patch = (id, body, headers = auth, raw = false) =>
  fetch(`${base}/api/v1/sounds/${id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', ...headers },
    body: raw ? body : JSON.stringify(body),
  });
const get = async (p) => (await fetch(base + p)).json();

test('PATCH needs the token', async () => {
  const m = await up({ 'x-filename': 'a' });
  assert.equal((await patch(m.id, { favorite: true }, {})).status, 401);
  assert.equal((await get(`/api/v1/sounds/${m.id}`)).favorite, false);
});

test('PATCH edits fields, keeps immutable ones, Khmer name works', async () => {
  const m = await up({ 'x-filename': 'rain', 'x-category': 'nature', 'x-tags': 'rain' });
  const r = await patch(m.id, {
    name: ' ភ្លៀងធ្លាក់ ', category: 'Ambience', tags: ['Storm', ' storm ', 'Night', ''],
    source: 'self', license: 'CC0', favorite: true,
    id: 'x', mime: 'video/mp4', size: 1, format: 'mp4', createdAt: 'old',
  });
  assert.equal(r.status, 200);
  const n = await r.json();
  assert.equal(n.name, 'ភ្លៀងធ្លាក់');
  assert.equal(n.category, 'ambience');
  assert.deepEqual(n.tags, ['storm', 'night']);
  assert.equal(n.favorite, true);
  assert.equal(n.license, 'CC0');
  for (const k of ['id', 'mime', 'size', 'format', 'createdAt']) assert.equal(n[k], m[k], k);
  assert.ok(n.updatedAt);
  assert.deepEqual(await get(`/api/v1/sounds/${m.id}`), n);
  assert.equal((await get('/api/v1/sounds?q=storm')).total >= 1, true);
});

test('PATCH rejects bad input and changes nothing', async () => {
  const m = await up({ 'x-filename': 'keep', 'x-category': 'city' });
  const bad = [
    { category: 'nope' }, { favorite: 'yes' }, { name: '  ' }, { name: 5 },
    { tags: 5 }, { tags: [1] }, { source: 3 }, {}, { id: 'x' },
  ];
  for (const b of bad) assert.equal((await patch(m.id, b)).status, 400, JSON.stringify(b));
  assert.equal((await patch(m.id, '{not json', auth, true)).status, 400);
  assert.equal((await patch(m.id, '[1]', auth, true)).status, 400);
  const after = await get(`/api/v1/sounds/${m.id}`);
  assert.equal(after.name, 'keep');
  assert.equal(after.category, 'city');
});

test('PATCH unknown and invalid ids', async () => {
  assert.equal((await patch('00000000-0000-4000-8000-000000000000', { favorite: true })).status, 404);
  assert.equal((await patch('not-an-id', { favorite: true })).status, 400);
});

test('PATCH body over 64 KB is rejected', async () => {
  const m = await up({ 'x-filename': 'big' });
  const r = await patch(m.id, JSON.stringify({ name: 'a'.repeat(70 * 1024) }), auth, true).catch(() => null);
  if (r) assert.equal(r.status, 413);
  assert.equal((await get(`/api/v1/sounds/${m.id}`)).name, 'big');
});

test('favorite filter', async () => {
  const a = await up({ 'x-filename': 'fav-one', 'x-tags': 'zzfav' });
  await up({ 'x-filename': 'fav-two', 'x-tags': 'zzfav' });
  assert.equal((await get('/api/v1/sounds?tag=zzfav')).total, 2);
  await patch(a.id, { favorite: true });
  const f = await get('/api/v1/sounds?tag=zzfav&favorite=true');
  assert.equal(f.total, 1);
  assert.equal(f.items[0].id, a.id);
  await patch(a.id, { favorite: false });
  assert.equal((await get('/api/v1/sounds?tag=zzfav&favorite=true')).total, 0);
});

test('categories list', async () => {
  const r = await fetch(base + '/api/v1/sounds/categories');
  assert.equal(r.status, 200);
  const { items } = await r.json();
  assert.ok(items.includes('nature') && items.includes('unknown') && items.includes('human'));
});

test('old behaviour intact: list, content range, delete, 405', async () => {
  const m = await up({ 'x-filename': 'old' });
  const c = await fetch(`${base}/api/v1/sounds/${m.id}/content`, { headers: { range: 'bytes=0-3' } });
  assert.equal(c.status, 206);
  assert.equal(Buffer.from(await c.arrayBuffer()).toString(), 'RIFF');
  assert.equal((await fetch(`${base}/api/v1/sounds/${m.id}`, { method: 'PUT', headers: auth })).status, 405);
  assert.equal((await fetch(`${base}/api/v1/sounds/${m.id}`, { method: 'DELETE', headers: auth })).status, 200);
  assert.equal((await fetch(`${base}/api/v1/sounds/${m.id}`)).status, 404);
});
