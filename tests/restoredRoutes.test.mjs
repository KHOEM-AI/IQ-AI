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
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-routes-'));
  server = createApp({ storageDir: dir, audioStorageDir: path.join(dir, 'audio'), maxUploadBytes: 1000, token: TOKEN, corsOrigin: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

test('emotion route is mounted on the main server', async () => {
  const r = await fetch(`${base}/api/v1/emotion/analyze`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'សប្បាយចិត្ត' }),
  });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(typeof j.data.emotion, 'string');
});

test('image and video inspect are mounted (400 for garbage, not 404)', async () => {
  for (const p of ['images/inspect', 'videos/inspect']) {
    const r = await fetch(`${base}/api/v1/${p}`, { method: 'POST', headers: auth, body: Buffer.alloc(64, 1) });
    assert.equal(r.status, 400, p);
  }
});


test('audio inspect is mounted on the main server', async () => {
  const r = await fetch(`${base}/api/v1/audio/inspect`, {
    method: 'POST',
    headers: auth,
    body: Buffer.alloc(64, 1),
  });
  assert.equal(r.status, 400);
  const j = await r.json();
  assert.equal(j.error.code, 'bad_audio');
});

test('audio upload uses configured storage directory', async () => {
  const audioDir = path.join(dir, 'audio');
  const wav = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.alloc(4),
    Buffer.from('WAVE'),
    Buffer.alloc(64, 1),
  ]);

  const r = await fetch(`${base}/api/v1/sounds/upload`, {
    method: 'POST',
    headers: {
      ...auth,
      'Content-Type': 'audio/wav',
      'x-filename': 'storage-test',
    },
    body: wav,
  });

  assert.equal(r.status, 201);

  const meta = await r.json();

  const storedFile = path.join(audioDir, 'files', meta.id);
  const storedMeta = path.join(audioDir, 'meta', `${meta.id}.json`);

  const fileContent = await fs.readFile(storedFile);
  const savedMeta = JSON.parse(await fs.readFile(storedMeta, 'utf8'));

  assert.deepEqual(fileContent, wav);
  assert.equal(savedMeta.id, meta.id);
  assert.equal(savedMeta.size, wav.length);

  const tmpFiles = await fs.readdir(path.join(audioDir, 'tmp'));
  assert.deepEqual(tmpFiles, []);
});
