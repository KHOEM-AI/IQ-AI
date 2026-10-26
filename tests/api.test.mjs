import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server/server.mjs';
import { readMetadata } from '../src/media/metadata.mjs';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}` };
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);

const be32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const le32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const le16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };

function makePng(w, h) {
  const ihdr = Buffer.concat([be32(w), be32(h), Buffer.from([8, 2, 0, 0, 0])]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    be32(13), Buffer.from('IHDR'), ihdr, be32(0),
  ]);
}

function makeJpeg(w, h) {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}

function makeGif(w, h) {
  return Buffer.concat([Buffer.from('GIF89a'), le16(w), le16(h), Buffer.alloc(8)]);
}

function makeWebpX(w, h) {
  const chunk = Buffer.alloc(10);
  chunk.writeUIntLE(w - 1, 4, 3);
  chunk.writeUIntLE(h - 1, 7, 3);
  const body = Buffer.concat([Buffer.from('WEBP'), Buffer.from('VP8X'), le32(10), chunk]);
  return Buffer.concat([Buffer.from('RIFF'), le32(body.length), body]);
}

function makeWav(rate, seconds) {
  const data = Buffer.alloc(rate * seconds, 128);
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate, 8);
  fmt.writeUInt16LE(1, 12);
  fmt.writeUInt16LE(8, 14);
  const body = Buffer.concat([Buffer.from('WAVE'), Buffer.from('fmt '), le32(16), fmt, Buffer.from('data'), le32(data.length), data]);
  return Buffer.concat([Buffer.from('RIFF'), le32(body.length), body]);
}

const box = (type, ...parts) => {
  const p = Buffer.concat(parts);
  return Buffer.concat([be32(8 + p.length), Buffer.from(type), p]);
};

function makeMp4(durationUnits, timescale, w, h) {
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(timescale, 12);
  mvhd.writeUInt32BE(durationUnits, 16);
  const tkhd = Buffer.alloc(84);
  tkhd.writeUInt32BE(w * 65536, 76);
  tkhd.writeUInt32BE(h * 65536, 80);
  return Buffer.concat([
    box('ftyp', Buffer.from('isom'), be32(0), Buffer.from('isom')),
    box('moov', box('mvhd', mvhd), box('trak', box('tkhd', tkhd))),
  ]);
}

let server, base, dir;

const upload = (body, type = 'image/png', filename = '../a b.png') =>
  fetch(`${base}/api/v1/media`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': type, 'X-Filename': filename },
    body,
  });

const uploadOk = async (body, type, filename) => {
  const r = await upload(body, type, filename);
  assert.equal(r.status, 201);
  return (await r.json()).data;
};

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-test-'));
  server = createApp({ storageDir: dir, maxUploadBytes: 20000, token: TOKEN, corsOrigin: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

test('health is public', async () => {
  const r = await fetch(`${base}/api/v1/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).data.status, 'up');
});

test('missing or wrong token is rejected', async () => {
  assert.equal((await fetch(`${base}/api/v1/media`)).status, 401);
  const r = await fetch(`${base}/api/v1/media`, { headers: { Authorization: 'Bearer nope' } });
  assert.equal(r.status, 401);
});

test('upload, metadata, download, list, delete', async () => {
  const up = await upload(png);
  assert.equal(up.status, 201);
  const meta = (await up.json()).data;
  assert.equal(meta.type, 'image');
  assert.equal(meta.size, png.length);
  assert.equal(meta.filename, 'a_b.png');

  const m = await fetch(`${base}/api/v1/media/${meta.id}`, { headers: auth });
  assert.equal(m.status, 200);

  const c = await fetch(`${base}/api/v1/media/${meta.id}/content`, { headers: auth });
  assert.equal(c.status, 200);
  assert.equal(c.headers.get('content-type'), 'image/png');
  assert.ok(Buffer.from(await c.arrayBuffer()).equals(png));

  const l = await fetch(`${base}/api/v1/media`, { headers: auth });
  assert.ok((await l.json()).data.items.some((i) => i.id === meta.id));

  const d = await fetch(`${base}/api/v1/media/${meta.id}`, { method: 'DELETE', headers: auth });
  assert.equal(d.status, 200);
  const gone = await fetch(`${base}/api/v1/media/${meta.id}/content`, { headers: auth });
  assert.equal(gone.status, 404);
});

test('unsupported content type is rejected', async () => {
  assert.equal((await upload(png, 'text/plain')).status, 415);
});

test('content that does not match its type is rejected', async () => {
  const r = await upload(Buffer.from('this is plain text, not a png'));
  assert.equal(r.status, 415);
  assert.equal((await r.json()).error.code, 'content_mismatch');
});

test('empty body is rejected', async () => {
  assert.equal((await upload(Buffer.alloc(0))).status, 400);
});

test('oversized upload is rejected', async () => {
  const big = Buffer.concat([png, Buffer.alloc(25000, 1)]);
  assert.equal((await upload(big)).status, 413);
});

test('unknown and invalid ids return 404', async () => {
  const unknown = await fetch(`${base}/api/v1/media/00000000-0000-4000-8000-000000000000`, { headers: auth });
  assert.equal(unknown.status, 404);
  const bad = await fetch(`${base}/api/v1/media/..%2F..%2Fetc`, { headers: auth });
  assert.equal(bad.status, 404);
});

test('processing endpoints are honest about no provider', async () => {
  const r = await fetch(`${base}/api/v1/images/process`, { method: 'POST', headers: auth });
  assert.equal(r.status, 501);
  assert.equal((await r.json()).error.code, 'provider_not_configured');
});

test('unknown route returns 404', async () => {
  assert.equal((await fetch(`${base}/nothing`)).status, 404);
});

test('image metadata: dimensions for png, jpeg, gif and webp', async () => {
  const cases = [
    [makePng(3, 2), 'image/png', 3, 2],
    [makeJpeg(640, 480), 'image/jpeg', 640, 480],
    [makeGif(32, 16), 'image/gif', 32, 16],
    [makeWebpX(100, 50), 'image/webp', 100, 50],
  ];
  for (const [buf, type, w, h] of cases) {
    const meta = await uploadOk(buf, type);
    assert.deepEqual(meta.info, { width: w, height: h }, type);
    const again = await fetch(`${base}/api/v1/media/${meta.id}`, { headers: auth });
    assert.deepEqual((await again.json()).data.info, { width: w, height: h }, `${type} persisted`);
  }
});

test('audio metadata: wav duration and format', async () => {
  const meta = await uploadOk(makeWav(8000, 2), 'audio/wav');
  assert.deepEqual(meta.info, { channels: 1, sampleRate: 8000, bitsPerSample: 8, durationSec: 2 });
});

test('video metadata: mp4 duration and size', async () => {
  const meta = await uploadOk(makeMp4(2500, 1000, 640, 360), 'video/mp4');
  assert.deepEqual(meta.info, { durationSec: 2.5, width: 640, height: 360 });
});

test('media with no readable header still uploads, with empty info', async () => {
  const meta = await uploadOk(png);
  assert.deepEqual(meta.info, {});
});

test('metadata readers never throw on garbage or truncated input', () => {
  const mimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'audio/wav', 'audio/ogg', 'audio/mpeg', 'video/mp4', 'video/webm'];
  const inputs = [
    Buffer.alloc(0),
    Buffer.alloc(5, 1),
    Buffer.alloc(200, 0),
    Buffer.alloc(200, 0xff),
    makeMp4(1, 1, 1, 1).subarray(0, 40),
    makeWav(8000, 1).subarray(0, 30),
    makeJpeg(1, 1).subarray(0, 10),
  ];
  for (const mime of mimes) {
    for (const buf of inputs) {
      assert.equal(typeof readMetadata(buf, mime), 'object');
    }
  }
});

test('range requests: partial, suffix, open-ended, clamped and unsatisfiable', async () => {
  const wav = makeWav(8000, 2);
  const meta = await uploadOk(wav, 'audio/wav');
  const url = `${base}/api/v1/media/${meta.id}/content`;
  const get = (range) => fetch(url, { headers: range ? { ...auth, Range: range } : auth });

  const full = await get();
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  await full.arrayBuffer();

  const part = await get('bytes=0-9');
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), `bytes 0-9/${wav.length}`);
  assert.ok(Buffer.from(await part.arrayBuffer()).equals(wav.subarray(0, 10)));

  const tail = await get('bytes=-5');
  assert.equal(tail.status, 206);
  assert.ok(Buffer.from(await tail.arrayBuffer()).equals(wav.subarray(wav.length - 5)));

  const open = await get(`bytes=${wav.length - 3}-`);
  assert.equal(open.status, 206);
  assert.equal(open.headers.get('content-length'), '3');
  await open.arrayBuffer();

  const clamped = await get(`bytes=${wav.length - 2}-999999`);
  assert.equal(clamped.status, 206);
  assert.equal(clamped.headers.get('content-range'), `bytes ${wav.length - 2}-${wav.length - 1}/${wav.length}`);
  await clamped.arrayBuffer();

  const bad = await get('bytes=999999-');
  assert.equal(bad.status, 416);
  assert.equal(bad.headers.get('content-range'), `bytes */${wav.length}`);
  await bad.arrayBuffer();
});

test('rename via PATCH, with validation and auth', async () => {
  const meta = await uploadOk(makeGif(2, 2), 'image/gif');
  const url = `${base}/api/v1/media/${meta.id}`;
  const patch = (body, headers = auth) =>
    fetch(url, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body });

  const r = await patch(JSON.stringify({ filename: '../new name.gif' }));
  assert.equal(r.status, 200);
  const renamed = (await r.json()).data;
  assert.equal(renamed.filename, 'new_name.gif');
  assert.equal(renamed.id, meta.id);
  assert.ok(renamed.updatedAt);
  assert.deepEqual(renamed.info, meta.info);

  const again = await fetch(url, { headers: auth });
  assert.equal((await again.json()).data.filename, 'new_name.gif');

  assert.equal((await patch('not json')).status, 400);
  assert.equal((await patch('{}')).status, 400);
  assert.equal((await patch(JSON.stringify({ filename: '   ' }))).status, 400);
  assert.equal((await patch(JSON.stringify({ filename: 'x.gif' }), {})).status, 401);

  const unknown = await fetch(`${base}/api/v1/media/00000000-0000-4000-8000-000000000000`, {
    method: 'PATCH',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'x' }),
  });
  assert.equal(unknown.status, 404);
});

test('non-ascii (Khmer) filename survives upload and download', async () => {
  const name = 'រូបភាព 1.gif';
  const meta = await uploadOk(makeGif(2, 2), 'image/gif', encodeURIComponent(name));
  assert.equal(meta.filename, 'រូបភាព_1.gif');

  const c = await fetch(`${base}/api/v1/media/${meta.id}/content`, { headers: auth });
  assert.equal(c.status, 200);
  const cd = c.headers.get('content-disposition');
  assert.ok(cd.includes(`filename*=UTF-8''${encodeURIComponent('រូបភាព_1.gif')}`));
  assert.ok(/^[\x20-\x7e]*$/.test(cd), 'header must be plain ASCII');
  await c.arrayBuffer();

  const weird = await uploadOk(makeGif(2, 2), 'image/gif', '%E0%A4%A.gif');
  assert.equal(weird.filename, '_E0_A4_A.gif');
});

test('cors preflight allows PATCH when configured', async () => {
  const s = createApp({ storageDir: dir, maxUploadBytes: 1000, token: TOKEN, corsOrigin: 'http://localhost:5175' });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  try {
    const r = await fetch(`http://127.0.0.1:${s.address().port}/api/v1/media/x`, { method: 'OPTIONS' });
    assert.equal(r.status, 204);
    assert.ok(r.headers.get('access-control-allow-methods').includes('PATCH'));
    assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5175');
  } finally {
    s.closeAllConnections();
    await new Promise((r) => s.close(r));
  }
});
