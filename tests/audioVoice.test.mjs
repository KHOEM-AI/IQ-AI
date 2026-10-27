import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server/server.mjs';
import { synthSfx, SFX_TYPES } from '../src/audio/sfx/synth.mjs';
import { PRESETS } from '../src/audio/voice/presets.mjs';
import { buildVoicePlan } from '../src/audio/voice/changeVoice.mjs';
import { ffmpegAvailable } from '../src/audio/ffmpeg.mjs';
import { inspectWav } from '../src/audio/inspectWav.mjs';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}` };
let server, base, dir, hasFfmpeg;

before(async () => {
  hasFfmpeg = await ffmpegAvailable();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-audio-'));
  server = createApp({ storageDir: dir, audioStorageDir: path.join(dir, 'audio'), maxUploadBytes: 1000, token: TOKEN, corsOrigin: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

test('every sfx type makes a valid wav of the right length', () => {
  for (const type of SFX_TYPES) {
    const r = synthSfx({ type, durationSec: 0.5 });
    assert.equal(r.ok, true, type);
    const i = inspectWav(r.buf);
    assert.equal(i.ok, true, type);
    assert.ok(Math.abs(i.durationSec - 0.5) < 0.01, type);
  }
});
test('sfx rejects bad input', () => {
  assert.equal(synthSfx({ type: 'nope' }).ok, false);
  assert.equal(synthSfx({ type: 'horn', durationSec: 999 }).ok, false);
});
test('voice plan validates params', () => {
  assert.equal(buildVoicePlan({ preset: 'nope' }).ok, false);
  assert.equal(buildVoicePlan({ pitch: 99 }).ok, false);
  assert.equal(buildVoicePlan({ speed: 'abc' }).ok, false);
  const p = buildVoicePlan({ preset: 'male', speed: 2 });
  assert.equal(p.ok, true);
  assert.equal(p.applied.pitch, -4);
  assert.equal(p.applied.speed, 2);
});

test('voices list', async () => {
  const r = await fetch(`${base}/api/v1/audio/voices`, { headers: auth });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.ok(j.data.presets.some((p) => p.id === 'female'));
});
test('audio routes need auth', async () => {
  assert.equal((await fetch(`${base}/api/v1/audio/voices`)).status, 401);
});
test('sfx over http', async () => {
  const r = await fetch(`${base}/api/v1/audio/sfx`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'siren', durationSec: 1 }),
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'audio/wav');
  assert.equal(inspectWav(Buffer.from(await r.arrayBuffer())).ok, true);
});
test('sfx bad type -> 400', async () => {
  const r = await fetch(`${base}/api/v1/audio/sfx`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'nope' }),
  });
  assert.equal(r.status, 400);
});
test('tts is 501 until a provider exists', async () => {
  const r = await fetch(`${base}/api/v1/audio/tts`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'សួស្តី' }),
  });
  assert.equal(r.status, 501);
  const empty = await fetch(`${base}/api/v1/audio/tts`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(empty.status, 400);
});
test('voice: non-audio body -> 415', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await fetch(`${base}/api/v1/audio/voice?preset=male`, { method: 'POST', headers: auth, body: Buffer.alloc(64, 1) });
  assert.equal(r.status, 415);
});
test('voice: bad preset -> 400', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const wav = synthSfx({ type: 'beep', durationSec: 0.5 }).buf;
  const r = await fetch(`${base}/api/v1/audio/voice?preset=nope`, { method: 'POST', headers: auth, body: wav });
  assert.equal(r.status, 400);
});
test('voice: pitch keeps length, speed changes it', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const wav = synthSfx({ type: 'siren', durationSec: 1 }).buf;
  const run = async (qs) => {
    const r = await fetch(`${base}/api/v1/audio/voice?${qs}`, { method: 'POST', headers: auth, body: wav });
    assert.equal(r.status, 200);
    return inspectWav(Buffer.from(await r.arrayBuffer()));
  };
  const male = await run('preset=male');
  assert.equal(male.ok, true);
  assert.ok(Math.abs(male.durationSec - 1) < 0.1, `male ${male.durationSec}`);
  const fast = await run('speed=2');
  assert.ok(Math.abs(fast.durationSec - 0.5) < 0.1, `fast ${fast.durationSec}`);
  for (const preset of Object.keys(PRESETS)) {
    const r = await run(`preset=${preset}`);
    assert.equal(r.ok, true, preset);
  }
});

test('edit: trim, reverse, fades, normalize, denoise, removeSilence', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const wav = synthSfx({ type: 'siren', durationSec: 1 }).buf;
  const run = async (qs, route = 'edit') => {
    const r = await fetch(`${base}/api/v1/audio/${route}?${qs}`, { method: 'POST', headers: auth, body: wav });
    assert.equal(r.status, 200, qs);
    return inspectWav(Buffer.from(await r.arrayBuffer()));
  };
  const cut = await run('trimStart=0.2&trimEnd=0.7');
  assert.ok(Math.abs(cut.durationSec - 0.5) < 0.05, `trim ${cut.durationSec}`);
  for (const qs of ['reverse=true', 'fadeIn=0.2&fadeOut=0.3', 'normalize=true', 'denoise=true', 'removeSilence=true', 'preset=ghost&fadeOut=0.5&reverse=1']) {
    assert.equal((await run(qs)).ok, true, qs);
  }
});
test('edit: bad values -> 400', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const wav = synthSfx({ type: 'beep', durationSec: 0.5 }).buf;
  for (const qs of ['trimStart=2&trimEnd=1', 'fadeIn=999', 'reverse=maybe', 'trimStart=abc']) {
    const r = await fetch(`${base}/api/v1/audio/edit?${qs}`, { method: 'POST', headers: auth, body: wav });
    assert.equal(r.status, 400, qs);
  }
});
