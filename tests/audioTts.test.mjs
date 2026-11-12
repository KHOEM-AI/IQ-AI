import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeSpeech, TTS_LIMITS, ttsEnabled } from '../src/audio/tts/provider.mjs';
import { PRESETS } from '../src/audio/voice/presets.mjs';
import { wavFromFloat } from '../src/audio/wavWrite.mjs';

// No network and no ffmpeg needed: fake engines are injected.
const wav = wavFromFloat(new Float32Array(4410).fill(0.1), 44100);
const on = () => true;
const fakeEdge = async () => wav;
const presetId = Object.keys(PRESETS)[0];

test('tts provider: off by default -> 501', async () => {
  const saved = process.env.IQAI_TTS;
  delete process.env.IQAI_TTS;
  try {
    assert.equal(ttsEnabled(), false);
    const r = await synthesizeSpeech({ text: 'សួស្តី' });
    assert.equal(r.status, 501);
    assert.equal(r.code, 'provider_not_configured');
  } finally { if (saved !== undefined) process.env.IQAI_TTS = saved; }
});

test('tts provider: input validation -> 400', async () => {
  const d = { enabled: on, edge: fakeEdge };
  assert.equal((await synthesizeSpeech({}, d)).status, 400);
  assert.equal((await synthesizeSpeech({ text: '   ' }, d)).status, 400);
  assert.equal((await synthesizeSpeech({ text: 'x'.repeat(TTS_LIMITS.maxChars + 1) }, d)).status, 400);
  assert.equal((await synthesizeSpeech({ text: 'hi', lang: 'xx' }, d)).status, 400);
  assert.equal((await synthesizeSpeech({ text: 'hi', voice: 'nope' }, d)).status, 400);
  assert.equal((await synthesizeSpeech({ text: 'hi', voice: 'constructor' }, d)).status, 400);
});

test('tts provider: returns the WAV from the engine', async () => {
  const r = await synthesizeSpeech({ text: 'សួស្តី' }, { enabled: on, edge: fakeEdge });
  assert.equal(r.ok, true);
  assert.ok(r.buf.equals(wav));
});

test('tts provider: applies a voice preset after synthesis', async () => {
  const seen = [];
  const voice = async (buf, o) => { seen.push(o.preset); return { ok: true, buf: Buffer.from('changed') }; };
  const r = await synthesizeSpeech({ text: 'hi', voice: presetId }, { enabled: on, edge: fakeEdge, voice });
  assert.equal(r.ok, true);
  assert.deepEqual(seen, [presetId]);
  assert.equal(r.buf.toString(), 'changed');
});

test('tts provider: engine problems map to 503 / 502 / 422', async () => {
  const missing = async () => { throw Object.assign(new Error('x'), { code: 'engine_missing' }); };
  const offline = async () => { throw Object.assign(new Error('x'), { code: 'upstream' }); };
  assert.equal((await synthesizeSpeech({ text: 'hi' }, { enabled: on, edge: missing })).status, 503);
  assert.equal((await synthesizeSpeech({ text: 'hi' }, { enabled: on, edge: offline })).status, 502);
  const boom = async () => { throw new Error('ffmpeg_failed'); };
  assert.equal((await synthesizeSpeech({ text: 'hi', voice: presetId }, { enabled: on, edge: fakeEdge, voice: boom })).status, 422);
});

// Real round trip: only when asked (needs internet + edge-tts + ffmpeg).
//   IQAI_TTS=edge IQAI_TTS_LIVE=1 node --test tests/audioTts.test.mjs
test('tts provider: LIVE round trip (opt-in)', async (t) => {
  if (process.env.IQAI_TTS_LIVE !== '1' || !ttsEnabled()) return t.skip('set IQAI_TTS=edge IQAI_TTS_LIVE=1 to run');
  const { inspectWav } = await import('../src/audio/inspectWav.mjs');
  const r = await synthesizeSpeech({ text: 'សួស្តី' });
  assert.equal(r.ok, true, r.message);
  const i = inspectWav(r.buf);
  assert.equal(i.ok, true);
  assert.ok(i.durationSec > 0.3);
});
