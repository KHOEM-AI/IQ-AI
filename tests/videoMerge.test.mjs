import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createApp } from '../src/server/server.mjs';
import { ffmpegAvailable } from '../src/audio/ffmpeg.mjs';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}` };
let server, base, dir, hasFfmpeg;
const ids = {};

// Real 2 s clips made by ffmpeg itself: one 320x240 with sine audio, one 160x320 silent.
function makeClip(file, size, audio) {
  const args = ['-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc=s=${size}:d=2:r=25`];
  if (audio) args.push('-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'aac');
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-shortest', file);
  const r = spawnSync('ffmpeg', args);
  assert.equal(r.status, 0, String(r.stderr));
}
const hasAudioTrack = (file) =>
  spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-i', file, '-map', '0:a:0', '-frames:a', '1', '-f', 'null', '-']).status === 0;

const upload = async (buf, type) => {
  const r = await fetch(`${base}/api/v1/media`, { method: 'POST', headers: { ...auth, 'Content-Type': type, 'X-Filename': 'x' }, body: buf });
  assert.equal(r.status, 201);
  return (await r.json()).data.id;
};
const merge = (body, headers = auth) =>
  fetch(`${base}/api/v1/videos/merge`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

before(async () => {
  hasFfmpeg = await ffmpegAvailable();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-vmerge-'));
  server = createApp({ storageDir: dir, audioStorageDir: path.join(dir, 'audio'), maxUploadBytes: 20 * 1024 * 1024, token: TOKEN, corsOrigin: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  if (hasFfmpeg) {
    makeClip(path.join(dir, 'a.mp4'), '320x240', true);
    makeClip(path.join(dir, 's.mp4'), '160x320', false);
    ids.a = await upload(await fs.readFile(path.join(dir, 'a.mp4')), 'video/mp4');
    ids.s = await upload(await fs.readFile(path.join(dir, 's.mp4')), 'video/mp4');
  }
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
  ids.img = await upload(png, 'image/png');
});
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

test('merge needs auth', async () => {
  assert.equal((await merge({ ids: [] }, {})).status, 401);
});

test('merge validates ids', async () => {
  const none = '00000000-0000-4000-8000-000000000000';
  assert.equal((await merge({})).status, 400);
  assert.equal((await merge({ ids: [none] })).status, 400);
  assert.equal((await merge({ ids: 'abc' })).status, 400);
  assert.equal((await merge({ ids: ['x', 'y'] })).status, 400);
  assert.equal((await merge({ ids: Array(21).fill(none) })).status, 400);
  const r = await fetch(`${base}/api/v1/videos/merge`, { method: 'POST', headers: auth, body: '{not json' });
  assert.equal(r.status, 400);
});

test('merge: unknown id -> 404, image -> 415, GET -> 405', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const none = '00000000-0000-4000-8000-000000000000';
  assert.equal((await merge({ ids: [none, none] })).status, 404);
  assert.equal((await merge({ ids: [ids.img, ids.img] })).status, 415);
  assert.equal((await fetch(`${base}/api/v1/videos/merge`, { headers: auth })).status, 405);
});

test('merge: joins a clip with audio and a silent clip, size from the first clip', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await merge({ ids: [ids.a, ids.s] });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'video/mp4');
  const applied = JSON.parse(r.headers.get('x-applied'));
  assert.deepEqual([applied.clips, applied.width, applied.height, applied.clipsWithAudio, applied.silentClips], [2, 320, 240, 1, 1]);
  const f = path.join(dir, 'merged.mp4');
  await fs.writeFile(f, Buffer.from(await r.arrayBuffer()));
  const info = await (await fetch(`${base}/api/v1/videos/inspect`, { method: 'POST', headers: auth, body: await fs.readFile(f) })).json();
  assert.equal(info.data.width, 320);
  assert.equal(info.data.height, 240);
  assert.ok(info.data.durationSec > 3.5 && info.data.durationSec < 4.6, `duration ${info.data.durationSec}`);
  assert.ok(hasAudioTrack(f), 'merged video keeps an audio track');
});

test('merge: explicit size and order', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await merge({ ids: [ids.s, ids.a, ids.s], width: 200, height: 200, fps: 20 });
  assert.equal(r.status, 200);
  const applied = JSON.parse(r.headers.get('x-applied'));
  assert.deepEqual([applied.clips, applied.width, applied.height, applied.fps], [3, 200, 200, 20]);
  const bad = await merge({ ids: [ids.a, ids.s], width: 99999 });
  assert.equal(bad.status, 400);
});
