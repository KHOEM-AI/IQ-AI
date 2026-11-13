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
const story = (body, headers = auth) =>
  fetch(`${base}/api/v1/videos/story`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const probe = (file, entries) => String(spawnSync('ffprobe', ['-v', 'error', '-show_entries', entries, '-of', 'default=nw=1', file]).stdout);
const saveOut = async (res, name) => {
  const f = path.join(dir, name);
  await fs.writeFile(f, Buffer.from(await res.arrayBuffer()));
  return f;
};

before(async () => {
  hasFfmpeg = await ffmpegAvailable();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-story-test-'));
  server = createApp({ storageDir: dir, audioStorageDir: path.join(dir, 'audio'), maxUploadBytes: 20 * 1024 * 1024, token: TOKEN, corsOrigin: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  if (hasFfmpeg) {
    ff('-f', 'lavfi', '-i', 'testsrc=s=200x300', '-frames:v', '1', path.join(dir, 'a.png'));
    ff('-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', path.join(dir, 'tone.wav'));
    ids.a = await upload(await fs.readFile(path.join(dir, 'a.png')), 'image/png');
    ids.tone = await upload(await fs.readFile(path.join(dir, 'tone.wav')), 'audio/wav');
  }
});
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

test('story needs auth', async () => {
  assert.equal((await story({ scenes: [] }, {})).status, 401);
});

test('story validates scenes and ids', async () => {
  const none = '00000000-0000-4000-8000-000000000000';
  assert.equal((await story({})).status, 400);
  assert.equal((await story({ scenes: [] })).status, 400);
  assert.equal((await story({ scenes: ['x'] })).status, 400);
  assert.equal((await story({ scenes: [{ imageId: 'nope' }] })).status, 400);
  assert.equal((await story({ scenes: [{ imageId: none }] })).status, 404);
  assert.equal((await story({ scenes: [{ text: 5 }] })).status, 400);
  assert.equal((await story({ scenes: [{}] })).status, 400); // no photo and no text
});

test('story: photo scenes with different lengths, fade, loops a stored audio track', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  const res = await story({
    scenes: [{ imageId: ids.a, seconds: 1 }, { imageId: ids.a, seconds: 2 }],
    width: 320, height: 480, effect: 'none', audioId: ids.tone,
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'video/mp4');
  const applied = JSON.parse(res.headers.get('x-applied'));
  assert.equal(applied.scenes, 2);
  assert.equal(applied.totalSec, 3);
  const f = await saveOut(res, 's1.mp4');
  assert.match(probe(f, 'stream=codec_type'), /codec_type=audio/);
  const dur = Number(/duration=([\d.]+)/.exec(probe(f, 'format=duration'))[1]);
  assert.ok(dur > 2.5 && dur < 3.6, `duration ${dur}`);
});

test('story: sfx and transition none', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  const res = await story({ scenes: [{ imageId: ids.a }], secondsPerScene: 1, width: 320, height: 320, transition: 'none', sfx: 'rain' });
  assert.equal(res.status, 200);
  const f = await saveOut(res, 's2.mp4');
  assert.match(probe(f, 'stream=codec_type'), /codec_type=audio/);
});

test('story: bad parameters', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  assert.equal((await story({ scenes: [{ imageId: ids.a }], transition: 'wipe' })).status, 400);
  assert.equal((await story({ scenes: [{ imageId: ids.a, seconds: 999 }] })).status, 400);
  assert.equal((await story({ scenes: [{ imageId: ids.a }], sfx: 'rain', audioId: ids.tone })).status, 400);
  assert.equal((await story({ scenes: [{ imageId: ids.tone }] })).status, 415);
  const many = Array.from({ length: 16 }, () => ({ imageId: ids.a, seconds: 60 }));
  assert.equal((await story({ scenes: many })).status, 400); // over 900 s in total
});

test('story: Khmer text card + captioned photo', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  if (!khmerFontAvailable()) return t.skip('Khmer font missing');
  const res = await story({
    scenes: [{ text: 'សួស្តី IQ-AI', seconds: 1 }, { imageId: ids.a, text: 'រឿងទី១', seconds: 1 }],
    width: 320, height: 480, bgColor: '#101030',
  });
  assert.equal(res.status, 200);
  const a = JSON.parse(res.headers.get('x-applied'));
  assert.equal(a.texts, 2);
  assert.equal(a.photos, 1);
});
