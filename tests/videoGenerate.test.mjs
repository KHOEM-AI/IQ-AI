import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server/server.mjs';
import { ffmpegAvailable } from '../src/audio/ffmpeg.mjs';
import { EFFECTS } from '../src/video/photoToVideo.mjs';
import { khmerFontAvailable } from '../src/video/textToVideo.mjs';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}` };
let server, base, dir, hasFfmpeg;

import zlib from 'node:zlib';

// A genuinely decodable PNG (unlike a bare-header fixture): 4x4 solid red, 8-bit RGB.
function makeRealPng(w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit depth, color type 2 (RGB)
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 3);
    for (let x = 0; x < w; x++) {
      const px = row + 1 + x * 3;
      raw[px] = 220; raw[px + 1] = 40; raw[px + 2] = 40;
    }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const png = makeRealPng(4, 4);

before(async () => {
  hasFfmpeg = await ffmpegAvailable();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-video-'));
  server = createApp({ storageDir: dir, audioStorageDir: path.join(dir, 'audio'), maxUploadBytes: 20 * 1024 * 1024, token: TOKEN, corsOrigin: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

test('effects list (public once authed, no ffmpeg needed)', async () => {
  const r = await fetch(`${base}/api/v1/videos/effects`, { headers: auth });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(j.data.effects, EFFECTS);
  assert.ok(j.data.sfxTypes.includes('engine'));
});
test('video routes need auth', async () => {
  assert.equal((await fetch(`${base}/api/v1/videos/effects`)).status, 401);
  assert.equal((await fetch(`${base}/api/v1/videos/text`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${base}/api/v1/videos/photo`, { method: 'POST' })).status, 401);
});

test('text: empty text -> 400', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await fetch(`${base}/api/v1/videos/text`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '' }),
  });
  assert.equal(r.status, 400);
});
test('text: bad color -> 400', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await fetch(`${base}/api/v1/videos/text`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hi', bgColor: 'red' }),
  });
  assert.equal(r.status, 400);
});
test('text: renders a Khmer-text mp4', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  if (!khmerFontAvailable()) return t.skip('Khmer font not found (set KHMER_FONT)');
  const r = await fetch(`${base}/api/v1/videos/text`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'សួស្តី ពិភពលោក', durationSec: 1, width: 320, height: 320 }),
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'video/mp4');
  const buf = Buffer.from(await r.arrayBuffer());
  assert.ok(buf.length > 100);
  assert.equal(buf.subarray(4, 8).toString('ascii'), 'ftyp');
}, { timeout: 30000 });
test('text: with sfx mixes audio in', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  if (!khmerFontAvailable()) return t.skip('Khmer font not found (set KHMER_FONT)');
  const r = await fetch(`${base}/api/v1/videos/text`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'test', durationSec: 1, width: 320, height: 320, sfx: 'beep' }),
  });
  assert.equal(r.status, 200);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.ok(buf.length > 100);
}, { timeout: 30000 });
test('text: bad sfx type -> 400', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await fetch(`${base}/api/v1/videos/text`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hi', sfx: 'nope' }),
  });
  assert.equal(r.status, 400);
});

test('photo: non-image body -> 415', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await fetch(`${base}/api/v1/videos/photo`, { method: 'POST', headers: { ...auth, 'Content-Type': 'image/png' }, body: Buffer.from('not an image') });
  assert.equal(r.status, 415);
});
test('photo: bad effect -> 400', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await fetch(`${base}/api/v1/videos/photo?effect=nope`, { method: 'POST', headers: { ...auth, 'Content-Type': 'image/png' }, body: png });
  assert.equal(r.status, 400);
});
test('photo: renders a zoom mp4', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await fetch(`${base}/api/v1/videos/photo?effect=zoom-in&durationSec=1&width=320&height=320`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'image/png' }, body: png,
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'video/mp4');
  const buf = Buffer.from(await r.arrayBuffer());
  assert.ok(buf.length > 100);
  assert.equal(buf.subarray(4, 8).toString('ascii'), 'ftyp');
}, { timeout: 30000 });
test('photo: zoom-out also renders', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await fetch(`${base}/api/v1/videos/photo?effect=zoom-out&durationSec=1&width=320&height=320`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'image/png' }, body: png,
  });
  assert.equal(r.status, 200);
}, { timeout: 30000 });
