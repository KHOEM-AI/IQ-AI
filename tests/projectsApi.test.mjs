import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server/server.mjs';

const TOKEN = 'test-token';
async function start() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-projapi-'));
  const server = createApp({
    token: TOKEN, maxUploadBytes: 1024 * 1024,
    storageDir: path.join(base, 'media'), audioStorageDir: path.join(base, 'audio'),
    jobsDir: path.join(base, 'jobs'), projectsDir: path.join(base, 'projects'),
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/projects`;
  const stop = () => new Promise((r) => { server.close(r); server.closeAllConnections?.(); });
  const call = (p, method = 'GET', body, auth = true) => fetch(url + p, {
    method,
    headers: { ...(auth ? { Authorization: `Bearer ${TOKEN}` } : {}), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  return { call, stop };
}

test('projects API: needs the token', async () => {
  const { call, stop } = await start();
  try { assert.equal((await call('', 'GET', undefined, false)).status, 401); } finally { await stop(); }
});

test('projects API: create, get, list, patch, delete', async () => {
  const { call, stop } = await start();
  try {
    let r = await call('', 'POST', { title: 'រឿងទី១', description: 'x' });
    assert.equal(r.status, 201);
    const p = (await r.json()).data;
    assert.equal(p.status, 'draft');
    r = await call(`/${p.id}`);
    assert.equal((await r.json()).data.title, 'រឿងទី១');
    r = await call('');
    assert.equal((await r.json()).data.items.length, 1);
    r = await call(`/${p.id}`, 'PATCH', { status: 'done' });
    assert.equal((await r.json()).data.status, 'done');
    r = await call(`/${p.id}`, 'DELETE');
    assert.equal(r.status, 200);
    assert.equal((await call(`/${p.id}`)).status, 404);
  } finally { await stop(); }
});

test('projects API: bad input -> 400, unknown/unsafe id -> 404, wrong method -> 405', async () => {
  const { call, stop } = await start();
  try {
    assert.equal((await call('', 'POST', {})).status, 400);
    assert.equal((await call('', 'POST', 'not json')).status, 400);
    assert.equal((await call('', 'POST', { title: 'a', status: 'nope' })).status, 400);
    assert.equal((await call('/not-a-uuid')).status, 404);
    assert.equal((await call('/00000000-0000-4000-8000-000000000000')).status, 404);
    assert.equal((await call('', 'DELETE')).status, 405);
    assert.equal((await call('/00000000-0000-4000-8000-000000000000', 'POST', {})).status, 405);
  } finally { await stop(); }
});

test('projects API: body over 64 KB -> 413', async () => {
  const { call, stop } = await start();
  try { assert.equal((await call('', 'POST', { title: 'a', description: 'x'.repeat(70000) })).status, 413); } finally { await stop(); }
});
