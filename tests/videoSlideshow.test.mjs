import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createApp } from '../src/server/server.mjs';
import { ffmpegAvailable } from '../src/audio/ffmpeg.mjs';
import { khmerFontAvailable } from '../src/video/textToVideo.mjs';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}` };
let server, base, dir, hasFfmpeg;
const ids = {};

const ff = (...args) => {
  const r = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...args]);
  assert.equal(r.status, 0, String(r.stderr));
};
const upload = async (buf, type) => {
  const r = await fetch(`${base}/api/v1/media`, { method: 'POST', headers: { ...auth, 'Content-Type': type, 'X-Filename': 'x' }, body: buf });
  assert.equal(r.status, 201);
  return (await r.json()).data.id;
};
const slideshow = (body, headers = auth) =>
  fetch(`${base}/api/v1/videos/slideshow`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const probe = (file, entries) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', entries, '-of', 'default=nw=1', file]);
  return String(r.stdout);
};
const saveOut = async (res, name) => {
  const f = path.join(dir, name);
  await fs.writeFile(f, Buffer.from(await res.arrayBuffer()));
  return f;
};

before(async () => {
  hasFfmpeg = await ffmpegAvailable();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-ss-test-'));
  server = createApp({ storageDir: dir, audioStorageDir: path.join(dir, 'audio'), maxUploadBytes: 20 * 1024 * 1024, token: TOKEN, corsOrigin: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  if (hasFfmpeg) {
    ff('-f', 'lavfi', '-i', 'testsrc=s=200x300', '-frames:v', '1', path.join(dir, 'a.png'));
    ff('-f', 'lavfi', '-i', 'smptebars=s=320x200', '-frames:v', '1', path.join(dir, 'b.png'));
    ff('-f', 'lavfi', '-i', 'sine=frequency=440:duration=10', path.join(dir, 'tone.wav'));
    ids.a = await upload(await fs.readFile(path.join(dir, 'a.png')), 'image/png');
    ids.b = await upload(await fs.readFile(path.join(dir, 'b.png')), 'image/png');
    ids.tone = await upload(await fs.readFile(path.join(dir, 'tone.wav')), 'audio/wav');
  }
  ids.junk = await upload(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]), 'image/png');
});
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

test('slideshow needs auth', async () => {
  assert.equal((await slideshow({ ids: [] }, {})).status, 401);
});

test('slideshow validates ids and params', async () => {
  const none = '00000000-0000-4000-8000-000000000000';
  assert.equal((await slideshow({})).status, 400);
  assert.equal((await slideshow({ ids: [] })).status, 400);
  assert.equal((await slideshow({ ids: ['nope'] })).status, 400);
  assert.equal((await slideshow({ ids: [none] })).status, 404);
  assert.equal((await slideshow({ ids: [ids.junk], audioId: 'bad' })).status, 400);
});

test('slideshow rejects a non-image id', { skip: false }, async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  assert.equal((await slideshow({ ids: [ids.tone] })).status, 415);
});

test('slideshow: two photos -> mp4 with the right length', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  const res = await slideshow({ ids: [ids.a, ids.b], secondsPerSlide: 2, width: 320, height: 480 });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'video/mp4');
  const applied = JSON.parse(res.headers.get('x-applied'));
  assert.equal(applied.slides, 2);
  assert.equal(applied.totalSec, 4);
  const f = await saveOut(res, 'out1.mp4');
  const info = probe(f, 'stream=width,height:format=duration');
  assert.match(info, /width=320/);
  assert.match(info, /height=480/);
  const dur = Number(/duration=([\d.]+)/.exec(info)[1]);
  assert.ok(dur > 3.5 && dur < 4.5, `duration ${dur}`);
});

test('slideshow: effect none, one photo, sfx adds an audio track', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  const res = await slideshow({ ids: [ids.a], secondsPerSlide: 1, effect: 'none', width: 320, height: 320, sfx: 'rain' });
  assert.equal(res.status, 200);
  const f = await saveOut(res, 'out2.mp4');
  assert.match(probe(f, 'stream=codec_type'), /codec_type=audio/);
});

test('slideshow: stored audio track is used and cut to the video length', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  const res = await slideshow({ ids: [ids.a, ids.b], secondsPerSlide: 1, width: 320, height: 320, audioId: ids.tone });
  assert.equal(res.status, 200);
  const f = await saveOut(res, 'out3.mp4');
  assert.match(probe(f, 'stream=codec_type'), /codec_type=audio/);
  const dur = Number(/duration=([\d.]+)/.exec(probe(f, 'format=duration'))[1]);
  assert.ok(dur < 3, `duration ${dur}`);
});

test('slideshow: bad parameters are 400', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  assert.equal((await slideshow({ ids: [ids.a], effect: 'spin' })).status, 400);
  assert.equal((await slideshow({ ids: [ids.a], secondsPerSlide: 99 })).status, 400);
  assert.equal((await slideshow({ ids: [ids.a], sfx: 'nope' })).status, 400);
  assert.equal((await slideshow({ ids: [ids.a], sfx: 'rain', audioId: ids.tone })).status, 400);
  assert.equal((await slideshow({ ids: [ids.a], captions: ['a', 'b'] })).status, 400);
  assert.equal((await slideshow({ ids: [ids.junk] })).status, 400);
});

test('slideshow: Khmer captions render', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  if (!khmerFontAvailable()) return t.skip('Khmer font missing');
  const res = await slideshow({ ids: [ids.a, ids.b], captions: ['សួស្តី IQ-AI', null], secondsPerSlide: 1, width: 320, height: 480 });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.headers.get('x-applied')).captions, 1);
});
