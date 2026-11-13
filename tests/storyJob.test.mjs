import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createStorage } from '../src/media/storage.mjs';
import { createRegistry } from '../src/media/registry.mjs';
import { createHandlers } from '../src/jobs/handlers.mjs';
import { ffmpegAvailable } from '../src/audio/ffmpeg.mjs';
import { khmerFontAvailable } from '../src/video/textToVideo.mjs';

// The video.story job handler (the HTTP job queue itself is covered by jobs.test.mjs).
let dir, registry, handlers, hasFfmpeg, imageId;

const run = (params, opts = {}) => {
  const progress = [];
  const p = handlers['video.story']({ params, signal: opts.signal ?? new AbortController().signal, setProgress: (v) => progress.push(v) });
  return { p, progress };
};
const rejects = (promise) => promise.then(() => assert.fail('should have failed'), (e) => e);

before(async () => {
  hasFfmpeg = await ffmpegAvailable();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-storyjob-'));
  registry = createRegistry(createStorage(dir));
  handlers = createHandlers({ registry });
  if (hasFfmpeg) {
    const png = path.join(dir, 'a.png');
    const r = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=200x300', '-frames:v', '1', png]);
    assert.equal(r.status, 0);
    const up = await registry.create({ buf: await fs.readFile(png), mime: 'image/png', filename: 'a.png' });
    assert.equal(up.ok, true);
    imageId = up.data.id;
  }
});
after(async () => { await fs.rm(dir, { recursive: true, force: true }); });

test('video.story is registered as a job type', () => {
  assert.equal(typeof handlers['video.story'], 'function');
});

test('video.story: bad scenes are clean job errors (no ffmpeg needed)', async () => {
  let e = await rejects(run({}).p);
  assert.equal(e.jobCode, 'bad_params');
  e = await rejects(run({ scenes: [] }).p);
  assert.equal(e.jobCode, 'bad_params');
  e = await rejects(run({ scenes: [{ imageId: 'nope' }] }).p);
  assert.equal(e.jobCode, 'bad_params');
  e = await rejects(run({ scenes: [{ imageId: '00000000-0000-4000-8000-000000000000' }] }).p);
  assert.equal(e.jobCode, 'not_found');
});

test('video.story: renders scenes, reports progress and stores a playable video', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  const { p, progress } = run({ scenes: [{ imageId, seconds: 1 }, { imageId, seconds: 1 }], width: 320, height: 480, effect: 'none' });
  const r = await p;
  assert.ok(r.mediaId && r.size > 0);
  assert.equal(r.applied.scenes, 2);
  assert.ok(progress.length >= 3, `progress calls: ${progress.length}`);
  assert.ok(progress.every((v, i) => i === 0 || v >= progress[i - 1]), 'progress never goes back');
  assert.ok(progress[progress.length - 1] <= 1);
  const meta = await registry.get(r.mediaId);
  assert.equal(meta.type, 'video');
});

test('video.story: Khmer text card', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  if (!khmerFontAvailable()) return t.skip('Khmer font missing');
  const r = await run({ scenes: [{ text: 'សួស្តី IQ-AI', seconds: 1 }], width: 320, height: 480 }).p;
  assert.equal(r.applied.texts, 1);
});

test('video.story: an abort kills the render and rejects with code aborted', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  const ac = new AbortController();
  const { p } = run({ scenes: [{ imageId, seconds: 30 }, { imageId, seconds: 30 }], width: 720, height: 1280 }, { signal: ac.signal });
  setTimeout(() => ac.abort(), 400);
  const started = Date.now();
  const e = await rejects(p);
  assert.equal(e.code, 'aborted');
  assert.ok(Date.now() - started < 15000, 'abort should be quick');
});
