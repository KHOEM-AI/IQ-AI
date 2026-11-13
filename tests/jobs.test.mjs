import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createApp } from '../src/server/server.mjs';
import { createJobManager } from '../src/jobs/jobManager.mjs';
import { ffmpegAvailable } from '../src/audio/ffmpeg.mjs';
import { runFfmpegArgs } from '../src/video/ffmpegRun.mjs';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- manager unit tests (no ffmpeg, fake handlers) ----------
test('manager: runs jobs one at a time, in order, and keeps the result', async () => {
  const order = [];
  let active = 0, maxActive = 0;
  const m = createJobManager({
    handlers: { work: async ({ params }) => { active++; maxActive = Math.max(maxActive, active); order.push(params.n); await sleep(20); active--; return { n: params.n }; } },
    concurrency: 1,
  });
  const a = (await m.submit('work', { n: 1 })).job;
  await m.submit('work', { n: 2 });
  await m.submit('work', { n: 3 });
  await m.whenIdle();
  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(maxActive, 1);
  const got = await m.get(a.id);
  assert.equal(got.status, 'done');
  assert.deepEqual(got.result, { n: 1 });
  assert.equal(got.progress, 1);
  await m.close();
});

test('manager: unknown type / full queue are refused; a throwing handler -> failed', async () => {
  const gate = {};
  gate.p = new Promise((r) => { gate.open = r; });
  const m = createJobManager({
    handlers: { slow: async () => { await gate.p; }, boom: async () => { throw new Error('secret internal detail'); } },
    concurrency: 1, maxQueue: 1,
  });
  assert.equal((await m.submit('nope', {})).status, 400);
  await m.submit('slow', {});          // running
  await m.submit('slow', {});          // queued (1/1)
  const full = await m.submit('slow', {});
  assert.equal(full.status, 429);
  gate.open();
  await m.whenIdle();
  const b = (await m.submit('boom', {})).job;
  await m.whenIdle();
  const got = await m.get(b.id);
  assert.equal(got.status, 'failed');
  assert.equal(got.error.code, 'job_failed');
  assert.ok(!JSON.stringify(got).includes('secret'), 'internal error text must not leak');
  await m.close();
});

test('manager: cancel a running job (signal fires) and a queued job; finished job is removed', async () => {
  let sawAbort = false;
  const m = createJobManager({
    handlers: {
      hang: async ({ signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => { sawAbort = true; rej(Object.assign(new Error('x'), { code: 'aborted' })); })),
      quick: async () => ({ v: 1 }),
    },
    concurrency: 1,
  });
  const r = (await m.submit('hang', {})).job;
  const q = (await m.submit('quick', {})).job;
  await sleep(20);
  assert.equal((await m.get(r.id)).status, 'running');
  assert.equal((await m.cancelOrRemove(q.id)).status, 'cancelled');   // queued
  assert.equal((await m.cancelOrRemove(r.id)).status, 'cancelled');   // running
  assert.equal(sawAbort, true);
  const d = (await m.submit('quick', {})).job;
  await m.whenIdle();
  assert.equal((await m.cancelOrRemove(d.id)).removed, true);
  assert.equal(await m.get(d.id), null);
  assert.equal(await m.cancelOrRemove(d.id), null);
  await m.close();
});

test('manager: finished jobs survive a restart, unfinished ones become failed(interrupted)', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-jobs-'));
  try {
    const gate = {};
    gate.p = new Promise((r) => { gate.open = r; });
    const m1 = createJobManager({ handlers: { quick: async () => ({ v: 7 }), slow: async () => { await gate.p; } }, dir });
    const done = (await m1.submit('quick', {})).job;
    await m1.whenIdle();
    const stuck = (await m1.submit('slow', {})).job;
    await sleep(30);
    // simulate a crash: no close(); a second manager reads the same directory
    const m2 = createJobManager({ handlers: { quick: async () => ({}) }, dir });
    assert.equal((await m2.get(done.id)).status, 'done');
    assert.deepEqual((await m2.get(done.id)).result, { v: 7 });
    const s = await m2.get(stuck.id);
    assert.equal(s.status, 'failed');
    assert.equal(s.error.code, 'interrupted');
    await m2.close();
    gate.open();
    await m1.close();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('manager: finished jobs expire after the ttl (and their file is deleted)', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-jobsttl-'));
  try {
    const m = createJobManager({ handlers: { quick: async () => 1 }, dir, ttlMs: 60 });
    const j = (await m.submit('quick', {})).job;
    await m.whenIdle();
    assert.equal((await m.get(j.id)).status, 'done');
    await sleep(250);
    assert.equal(await m.get(j.id), null);
    assert.deepEqual((await fs.readdir(dir)).filter((n) => n.endsWith('.json')), []);
    await m.close();
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('runFfmpegArgs: an abort signal kills a long ffmpeg quickly with code "aborted"', async (t) => {
  if (!(await ffmpegAvailable())) return t.skip('ffmpeg not installed');
  const ac = new AbortController();
  const started = Date.now();
  setTimeout(() => ac.abort(), 200);
  await assert.rejects(
    runFfmpegArgs(['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=s=1280x720:d=600:r=30', '-f', 'null', '-'], { signal: ac.signal, timeoutMs: 60000 }),
    (e) => e.code === 'aborted',
  );
  assert.ok(Date.now() - started < 5000);
  // an already-aborted signal never starts ffmpeg
  await assert.rejects(runFfmpegArgs(['-version'], { signal: ac.signal }), (e) => e.code === 'aborted');
});

// ---------- HTTP + real ffmpeg ----------
let server, base, dir, hasFfmpeg, clipId;
function makeClip(file) {
  const r = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=320x240:d=2:r=25',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'aac', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-shortest', file]);
  assert.equal(r.status, 0, String(r.stderr));
}
const api = (p, opt = {}) => fetch(`${base}/api/v1${p}`, { ...opt, headers: { ...auth, ...(opt.headers || {}) } });
const postJob = (body) => api('/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function waitJob(id, ms = 60000) {
  const end = Date.now() + ms;
  for (;;) {
    const j = (await (await api(`/jobs/${id}`)).json()).data;
    if (['done', 'failed', 'cancelled'].includes(j.status)) return j;
    assert.ok(Date.now() < end, 'job did not finish in time');
    await sleep(100);
  }
}

before(async () => {
  hasFfmpeg = await ffmpegAvailable();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-jobsapi-'));
  server = createApp({ storageDir: path.join(dir, 'media'), audioStorageDir: path.join(dir, 'audio'), jobsDir: path.join(dir, 'jobs'),
    maxUploadBytes: 20 * 1024 * 1024, token: TOKEN, corsOrigin: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  if (hasFfmpeg) {
    makeClip(path.join(dir, 'a.mp4'));
    const r = await api('/media', { method: 'POST', headers: { 'Content-Type': 'video/mp4', 'X-Filename': 'a.mp4' }, body: await fs.readFile(path.join(dir, 'a.mp4')) });
    assert.equal(r.status, 201);
    clipId = (await r.json()).data.id;
  }
});
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

test('jobs routes need auth', async () => {
  assert.equal((await fetch(`${base}/api/v1/jobs`)).status, 401);
  assert.equal((await fetch(`${base}/api/v1/jobs`, { method: 'POST', body: '{}' })).status, 401);
});

test('jobs: bad requests -> 400/404/405', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  assert.equal((await api('/jobs', { method: 'POST', body: 'not json' })).status, 400);
  assert.equal((await postJob({})).status, 400);
  assert.equal((await postJob({ type: 'nope' })).status, 400);
  assert.equal((await postJob({ type: 'video.edit', params: [] })).status, 400);
  assert.equal((await api('/jobs/not-a-uuid')).status, 404);
  assert.equal((await api('/jobs/00000000-0000-4000-8000-000000000000')).status, 404);
  assert.equal((await api('/jobs', { method: 'PUT' })).status, 405);
  assert.equal((await api('/jobs/00000000-0000-4000-8000-000000000000', { method: 'POST' })).status, 405);
});

test('jobs: video.edit runs in the background and the result is a playable media item', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await postJob({ type: 'video.edit', params: { mediaId: clipId, trimStart: 0.5, trimEnd: 1.5, width: 160 } });
  assert.equal(r.status, 202);
  const job = (await r.json()).data;
  assert.ok(['queued', 'running'].includes(job.status));
  const done = await waitJob(job.id);
  assert.equal(done.status, 'done', JSON.stringify(done.error));
  const out = await api(`/media/${done.result.mediaId}`);
  assert.equal(out.status, 200);
  const meta = (await out.json()).data;
  assert.equal(meta.type, 'video');
  assert.equal(meta.info.width, 160);
  const content = await api(`/media/${done.result.mediaId}/content`, { headers: { Range: 'bytes=0-99' } });
  assert.equal(content.status, 206);
});

test('jobs: video.merge of two stored clips; result can be merged again (chaining)', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const a = await waitJob((await (await postJob({ type: 'video.merge', params: { ids: [clipId, clipId] } })).json()).data.id);
  assert.equal(a.status, 'done', JSON.stringify(a.error));
  assert.equal(a.result.applied.clips, 2);
  const b = await waitJob((await (await postJob({ type: 'video.merge', params: { ids: [a.result.mediaId, clipId] } })).json()).data.id);
  assert.equal(b.status, 'done', JSON.stringify(b.error));
  const info = (await (await api(`/media/${b.result.mediaId}`)).json()).data.info;
  assert.ok(Math.abs(info.durationSec - 6) < 0.6, `duration ${info.durationSec}`);
});

test('jobs: bad input is reported as a failed job with a clean message (no paths/ffmpeg text)', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const missing = await waitJob((await (await postJob({ type: 'video.edit', params: { mediaId: '00000000-0000-4000-8000-000000000000' } })).json()).data.id);
  assert.equal(missing.status, 'failed');
  assert.equal(missing.error.code, 'not_found');
  const badParams = await waitJob((await (await postJob({ type: 'video.edit', params: { mediaId: clipId, speed: 9 } })).json()).data.id);
  assert.equal(badParams.status, 'failed');
  assert.equal(badParams.error.code, 'bad_params');
  const one = await waitJob((await (await postJob({ type: 'video.merge', params: { ids: [clipId] } })).json()).data.id);
  assert.equal(one.error.code, 'bad_params');
});

test('jobs: list shows jobs; DELETE removes a finished job; a long job can be cancelled', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const j = await waitJob((await (await postJob({ type: 'video.edit', params: { mediaId: clipId, mute: true } })).json()).data.id);
  const list = (await (await api('/jobs')).json()).data;
  assert.ok(list.items.some((x) => x.id === j.id));
  assert.deepEqual(list.types.sort(), ['video.edit', 'video.merge', 'video.mix', 'video.story', 'video.subtitle']);
  assert.equal((await api(`/jobs/${j.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await api(`/jobs/${j.id}`)).status, 404);

  // queue 3 merges (concurrency 1): cancel the last while it waits
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push((await (await postJob({ type: 'video.merge', params: { ids: [clipId, clipId, clipId] } })).json()).data.id);
  const c = await api(`/jobs/${ids[2]}`, { method: 'DELETE' });
  assert.equal(c.status, 200);
  assert.equal((await c.json()).data.status, 'cancelled');
  await waitJob(ids[0]); await waitJob(ids[1]);
});
