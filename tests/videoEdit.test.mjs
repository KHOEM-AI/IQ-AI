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
let server, base, dir, hasFfmpeg, withAudio, silent;

// Real 2 s clips made by ffmpeg itself (320x240): one with a sine audio track, one silent.
function makeClip(file, audio) {
  const args = ['-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=320x240:d=2:r=25'];
  if (audio) args.push('-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'aac');
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-shortest', file);
  const r = spawnSync('ffmpeg', args);
  assert.equal(r.status, 0, String(r.stderr));
}
const hasAudioTrack = (file) =>
  spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-i', file, '-map', '0:a:0', '-frames:a', '1', '-f', 'null', '-']).status === 0;

before(async () => {
  hasFfmpeg = await ffmpegAvailable();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-vedit-'));
  if (hasFfmpeg) {
    makeClip(path.join(dir, 'a.mp4'), true);
    makeClip(path.join(dir, 's.mp4'), false);
    withAudio = await fs.readFile(path.join(dir, 'a.mp4'));
    silent = await fs.readFile(path.join(dir, 's.mp4'));
  }
  server = createApp({ storageDir: dir, audioStorageDir: path.join(dir, 'audio'), maxUploadBytes: 20 * 1024 * 1024, token: TOKEN, corsOrigin: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

const post = (p, body) => fetch(`${base}/api/v1/videos/${p}`, { method: 'POST', headers: auth, body });
async function inspect(buf) {
  const r = await fetch(`${base}/api/v1/videos/inspect`, { method: 'POST', headers: auth, body: buf });
  return (await r.json()).data;
}
async function saveOut(r, name) {
  const buf = Buffer.from(await r.arrayBuffer());
  const f = path.join(dir, name);
  await fs.writeFile(f, buf);
  return { buf, f };
}

test('video edit routes need auth', async () => {
  for (const p of ['edit', 'thumbnail', 'audio']) {
    const r = await fetch(`${base}/api/v1/videos/${p}`, { method: 'POST', body: 'x' });
    assert.equal(r.status, 401, p);
  }
});

test('video edit: GET -> 405', async () => {
  const r = await fetch(`${base}/api/v1/videos/edit`, { headers: auth });
  assert.equal(r.status, 405);
});

test('video edit: non-video body -> 415, empty -> 400', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  assert.equal((await post('edit', Buffer.from('not a video at all, just text'))).status, 415);
  assert.equal((await post('edit', Buffer.alloc(0))).status, 400);
});

test('video edit: bad params -> 400', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  for (const q of ['speed=9', 'speed=abc', 'trimStart=-1', 'trimStart=2&trimEnd=1', 'width=10', 'mute=maybe']) {
    const r = await post(`edit?${q}`, withAudio);
    assert.equal(r.status, 400, q);
    assert.equal((await r.json()).error.code, 'bad_params', q);
  }
});

test('video edit: trim keeps the requested length', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await post('edit?trimStart=0.5&trimEnd=1.5', withAudio);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'video/mp4');
  const { buf } = await saveOut(r, 'trim.mp4');
  const info = await inspect(buf);
  assert.ok(Math.abs(info.durationSec - 1) < 0.25, `duration ${info.durationSec}`);
  assert.equal(info.width, 320);
});

test('video edit: speed 2 halves the length', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await post('edit?speed=2', withAudio);
  assert.equal(r.status, 200);
  const { buf } = await saveOut(r, 'fast.mp4');
  const info = await inspect(buf);
  assert.ok(Math.abs(info.durationSec - 1) < 0.3, `duration ${info.durationSec}`);
});

test('video edit: resize by width keeps aspect and an even height', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await post('edit?width=160', withAudio);
  assert.equal(r.status, 200);
  const { buf } = await saveOut(r, 'small.mp4');
  const info = await inspect(buf);
  assert.equal(info.width, 160);
  assert.equal(info.height, 120);
});

test('video edit: mute removes audio, default keeps it', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const kept = await saveOut(await post('edit', withAudio), 'kept.mp4');
  assert.equal(hasAudioTrack(kept.f), true);
  const muted = await post('edit?mute=true', withAudio);
  assert.equal(JSON.parse(muted.headers.get('x-applied')).audio, false);
  assert.equal(hasAudioTrack((await saveOut(muted, 'muted.mp4')).f), false);
});

test('video edit: a video without audio still works (also with speed)', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await post('edit?speed=1.5', silent);
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(r.headers.get('x-applied')).audio, false);
});

test('video edit: trimStart past the end -> 400, not an empty 200', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await post('edit?trimStart=30', withAudio);
  assert.equal(r.status, 400);
});

test('video edit: truncated video -> 400 bad_video', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await post('edit', withAudio.subarray(0, 40));
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.code, 'bad_video');
});

test('video thumbnail: returns a JPEG of the requested width', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await post('thumbnail?at=1&width=160', withAudio);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/jpeg');
  const buf = Buffer.from(await r.arrayBuffer());
  assert.deepEqual([...buf.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  const info = await (await fetch(`${base}/api/v1/images/inspect`, { method: 'POST', headers: auth, body: buf })).json();
  assert.equal(info.data.width, 160);
});

test('video thumbnail: bad at / past the end -> 400', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  assert.equal((await post('thumbnail?at=-3', withAudio)).status, 400);
  assert.equal((await post('thumbnail?at=60', withAudio)).status, 400);
});

test('video audio: extracts a WAV; a silent video -> 422', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await post('audio', withAudio);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'audio/wav');
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.toString('latin1', 0, 4), 'RIFF');
  assert.equal(buf.toString('latin1', 8, 12), 'WAVE');
  const info = await (await fetch(`${base}/api/v1/audio/inspect`, { method: 'POST', headers: auth, body: buf })).json();
  assert.ok(Math.abs(info.data.durationSec - 2) < 0.3, `duration ${info.data.durationSec}`);
  assert.equal((await post('audio', silent)).status, 422);
});
