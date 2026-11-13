import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { synthesizeDialogue, DIALOGUE_LIMITS } from '../src/audio/dialogue.mjs';
import { synthesizeSpeech } from '../src/audio/tts/provider.mjs';
import { estimateF0 } from '../src/audio/voice/estimatePitch.mjs';
import { wavFromFloat } from '../src/audio/wavWrite.mjs';
import { handleAudioDialogue } from '../src/server/routes/audioDialogue.mjs';

const SR = 44100;
// Fake speech: a pulse train through vowel resonances, pitch chosen by the voice, length by the text, plus silence around it.
const PITCH = { male_uncle_firm: 100, female_nephew_soft: 280, male_toddler_soft: 340 };
function vowel(f0, sec, lead = 0.2, tail = 0.2, amp = 0.5) {
  const n = Math.round(SR * sec);
  let x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) { ph += f0 / SR; if (ph >= 1) { ph -= 1; x[i] = 1; } }
  for (const [fc, bw] of [[500, 80], [1500, 100], [2500, 120]]) {
    const r = Math.exp((-Math.PI * bw) / SR), a1 = 2 * r * Math.cos((2 * Math.PI * fc) / SR), a2 = -r * r, y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = x[i] + a1 * (y[i - 1] || 0) + a2 * (y[i - 2] || 0);
    x = y;
  }
  let pk = 0;
  for (const v of x) pk = Math.max(pk, Math.abs(v));
  const L = Math.round(SR * lead), T = Math.round(SR * tail);
  const out = new Float32Array(L + n + T);
  for (let i = 0; i < n; i++) out[L + i] = (x[i] / pk) * amp;
  return wavFromFloat(out, SR);
}
const fake = (log = []) => async (b) => {
  log.push(b);
  return { ok: true, buf: vowel(PITCH[b.voice] ?? 150, Math.max(0.5, b.text.length * 0.1), 0.2, 0.2, b.voice === 'male_toddler_soft' ? 0.15 : 0.5) };
};
const segPitch = (r, t) => {
  // slice the joined wav between two times and measure its pitch
  const a = 44 + Math.round((t.startMs / 1000) * SR) * 2;
  const b = 44 + Math.round((t.endMs / 1000) * SR) * 2;
  return estimateF0(wavFromFloatFrom(r.buf.subarray(a, b)));
};
function wavFromFloatFrom(pcm) {
  const f = new Float32Array(pcm.length / 2);
  for (let i = 0; i < f.length; i++) f[i] = pcm.readInt16LE(i * 2) / 32768;
  return wavFromFloat(f, SR);
}
const lines3 = [
  { text: 'abcde', voice: 'male_uncle_firm', speaker: 'ពូ' },
  { text: 'abcdefgh', voice: 'female_nephew_soft', speaker: 'ក្មួយ' },
  { text: 'abcdef', voice: 'male_toddler_soft' },
];

test('lines are spoken by their own voice, in order, with correct start/end times', async () => {
  const log = [];
  const r = await synthesizeDialogue({ lines: lines3 }, { synth: fake(log) });
  assert.equal(r.ok, true);
  assert.deepEqual(log.map((b) => b.voice), ['male_uncle_firm', 'female_nephew_soft', 'male_toddler_soft']);
  assert.equal(r.timings.length, 3);
  for (let i = 0; i < 3; i++) {
    assert.equal(r.timings[i].index, i);
    assert.ok(r.timings[i].endMs > r.timings[i].startMs);
    if (i) assert.ok(r.timings[i].startMs >= r.timings[i - 1].endMs + DIALOGUE_LIMITS.defaultGapMs - 2, 'default gap kept');
  }
  assert.equal(r.timings[0].startMs, 0, 'leading silence is trimmed');
  assert.ok(Math.abs(r.totalMs - r.timings[2].endMs) <= 1, 'no trailing gap');
  // the right voice is really audible in the right time slot
  for (const [i, f] of [[0, 100], [1, 280], [2, 340]]) {
    const hz = segPitch(r, r.timings[i]);
    assert.ok(hz && Math.abs(12 * Math.log2(hz / f)) < 0.7, `line ${i + 1}: wanted ${f}, heard ${hz}`);
  }
  assert.equal(r.sampleRate, SR);
});

test('speech is trimmed and levelled: a very quiet voice is as loud as a normal one', async () => {
  const r = await synthesizeDialogue({ lines: [lines3[0], lines3[2]] }, { synth: fake() });
  const rms = (t) => {
    const a = 44 + Math.round((t.startMs / 1000) * SR) * 2, b = 44 + Math.round((t.endMs / 1000) * SR) * 2;
    let e = 0, n = 0;
    for (let i = a; i + 1 < b; i += 2) { const v = r.buf.readInt16LE(i) / 32768; e += v * v; n++; }
    return Math.sqrt(e / n);
  };
  const ratio = rms(r.timings[0]) / rms(r.timings[1]);
  assert.ok(ratio > 0.7 && ratio < 1.4, `loudness ratio ${ratio.toFixed(2)}`);
});

test('gapMs and pauseMs control the silence after a line', async () => {
  const r = await synthesizeDialogue({ gapMs: 1000, lines: [{ ...lines3[0], pauseMs: 0 }, lines3[1], lines3[2]] }, { synth: fake() });
  assert.ok(Math.abs(r.timings[1].startMs - r.timings[0].endMs) <= 2, 'pauseMs 0');
  assert.ok(Math.abs(r.timings[2].startMs - r.timings[1].endMs - 1000) <= 2, 'gapMs 1000');
});

test('bad input is refused before any speech is made', async () => {
  const log = [];
  const run = (body) => synthesizeDialogue(body, { synth: fake(log) });
  const many = Array.from({ length: DIALOGUE_LIMITS.lines[1] + 1 }, () => ({ text: 'a' }));
  for (const [body, re] of [
    [{}, /lines/], [{ lines: [] }, /lines/], [{ lines: many }, /lines/],
    [{ lines: [{ text: '  ' }] }, /line 1.*text/], [{ lines: [{ text: 'a' }, { text: 'a', voice: 'nobody' }] }, /line 2.*unknown voice/],
    [{ lines: [{ text: 'x'.repeat(1001) }] }, /line 1.*limited/], [{ lines: [{ text: 'a', pauseMs: -5 }] }, /pauseMs/],
    [{ lines: [{ text: 'a' }], gapMs: 99999 }, /gapMs/], [{ lines: ['hello'] }, /line 1/],
    [{ lines: Array.from({ length: 4 }, () => ({ text: 'x'.repeat(900) })) }, /Total text/],
  ]) {
    const r = await run(body);
    assert.equal(r.ok, false, JSON.stringify(body).slice(0, 60));
    assert.equal(r.status, 400);
    assert.match(r.message, re);
  }
  assert.equal(log.length, 0, 'the speech engine was never called');
});

test('engine errors name the failing line and keep their status', async () => {
  const synth = async (b) => (b.text === 'bad' ? { ok: false, status: 502, code: 'tts_upstream_failed', message: 'offline' } : fake()(b));
  const r = await synthesizeDialogue({ lines: [{ text: 'ok' }, { text: 'bad' }] }, { synth });
  assert.equal(r.ok, false);
  assert.equal(r.status, 502);
  assert.equal(r.code, 'tts_upstream_failed');
  assert.match(r.message, /line 2/);
  const r2 = await synthesizeDialogue({ lines: [{ text: 'a' }] }, { synth: async () => ({ ok: true, buf: Buffer.from('not a wav') }) });
  assert.equal(r2.code, 'tts_bad_audio');
});

test('through the real provider contract: voice ids are passed on, and a disabled engine says so', async () => {
  const seen = [];
  const tts = { enabled: () => true, edge: async (text) => { seen.push(['edge', text]); return vowel(150, 0.6); }, voice: async (wav, o) => { seen.push(['voice', o.preset]); return { ok: true, buf: wav }; } };
  const r = await synthesizeDialogue({ lines: [{ text: 'សួស្តី', voice: 'female_young_firm' }, { text: 'ជម្រាបសួរ' }] }, { tts });
  assert.equal(r.ok, true);
  assert.deepEqual(seen, [['edge', 'សួស្តី'], ['voice', 'female_young_firm'], ['edge', 'ជម្រាបសួរ']]);
  delete process.env.IQAI_TTS;
  const off = await synthesizeDialogue({ lines: [{ text: 'a' }] });
  assert.equal(off.status, 501);
  assert.equal(off.code, 'provider_not_configured');
  assert.equal(typeof synthesizeSpeech, 'function');
});

function call(method, body) {
  return new Promise((resolve) => {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]);
    req.method = method;
    req.url = '/api/v1/audio/dialogue';
    req.headers = {};
    const out = { chunks: [] };
    const res = { writeHead(c, h) { out.status = c; out.headers = h; }, setHeader() {}, end(d) { if (d) out.chunks.push(Buffer.from(d)); out.body = Buffer.concat(out.chunks).toString('utf8'); resolve(out); }, write(d) { out.chunks.push(Buffer.from(d)); } };
    handleAudioDialogue(req, res, '/api/v1/audio/dialogue').then((handled) => { if (!handled) resolve({ handled }); });
  });
}
test('route: other paths are ignored, GET lists limits, POST errors are clean (no engine here)', async () => {
  assert.equal(await handleAudioDialogue({ method: 'GET' }, {}, '/api/v1/audio/voice'), false);
  const g = await call('GET');
  assert.equal(g.status, 200);
  assert.deepEqual(JSON.parse(g.body).data.limits.lines, DIALOGUE_LIMITS.lines);
  assert.equal((await call('DELETE')).status, 405);
  assert.equal((await call('POST', '{not json')).status, 400);
  assert.equal((await call('POST', { lines: [] })).status, 400);
  delete process.env.IQAI_TTS;
  const off = await call('POST', { lines: [{ text: 'សួស្តី' }] });
  assert.equal(off.status, 501);
});
