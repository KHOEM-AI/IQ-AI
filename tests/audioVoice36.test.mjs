import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, NATURAL_VOICES } from '../src/audio/voice/presets.mjs';
import { buildVoicePlan, changeVoice } from '../src/audio/voice/changeVoice.mjs';
import { estimateF0 } from '../src/audio/voice/estimatePitch.mjs';
import { ffmpegAvailable, ffmpegHasFilter } from '../src/audio/ffmpeg.mjs';
import { inspectWav } from '../src/audio/inspectWav.mjs';
import { wavFromFloat } from '../src/audio/wavWrite.mjs';

// A voiced test signal: pulse train at f0 through 3 vocal-tract resonances (like a vowel).
function vowel(f0, { sr = 44100, sec = 1.5, formants = [[500, 80], [1500, 100], [2500, 120]] } = {}) {
  const n = Math.round(sr * sec);
  const out = new Float32Array(n);
  let x = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) { phase += f0 / sr; if (phase >= 1) { phase -= 1; x[i] = 1; } }
  for (const [fc, bw] of formants) {
    const r = Math.exp((-Math.PI * bw) / sr);
    const a1 = 2 * r * Math.cos((2 * Math.PI * fc) / sr);
    const a2 = -r * r;
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = x[i] + a1 * (y[i - 1] || 0) + a2 * (y[i - 2] || 0);
    x = y;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(x[i]));
  for (let i = 0; i < n; i++) out[i] = (x[i] / peak) * 0.6 * Math.min(1, i / 2000, (n - i) / 2000);
  return wavFromFloat(out, sr);
}
const st = (a, b) => 12 * Math.log2(a / b);

test('exactly 36 natural voices with unique ids and Khmer labels', () => {
  assert.equal(NATURAL_VOICES.length, 36);
  assert.equal(new Set(NATURAL_VOICES).size, 36);
  assert.equal(NATURAL_VOICES.filter((k) => k.startsWith('male_')).length, 18);
  assert.equal(NATURAL_VOICES.filter((k) => k.startsWith('female_')).length, 18);
  for (const id of NATURAL_VOICES) assert.match(PRESETS[id].label, /[\u1780-\u17FF]/, id);
});

test('no two voices are alike: pitch, vocal tract and speed are far enough apart', () => {
  const v = NATURAL_VOICES.map((k) => PRESETS[k]);
  for (let i = 0; i < v.length; i++) {
    for (let j = i + 1; j < v.length; j++) {
      const d = Math.hypot(st(v[i].f0, v[j].f0), v[i].formant - v[j].formant, st(v[i].speed, v[j].speed));
      assert.ok(d >= 2, `${NATURAL_VOICES[i]} vs ${NATURAL_VOICES[j]} too close (${d.toFixed(2)})`);
    }
  }
});

test('pitch estimator finds the pitch of a voiced signal', () => {
  for (const hz of [68, 95, 120, 200, 300, 420, 480]) {
    const got = estimateF0(vowel(hz));
    assert.ok(got && Math.abs(st(got, hz)) < 0.4, `${hz} -> ${got}`);
  }
  assert.equal(estimateF0(wavFromFloat(new Float32Array(44100))), null);
});

test('plan: aims at the preset pitch, shifts the vocal tract, falls back without rubberband', () => {
  const p = buildVoicePlan({ preset: 'female_young_firm', sourceF0: 120 });
  assert.equal(p.ok, true);
  assert.equal(p.applied.engine, 'rubberband');
  assert.equal(p.applied.targetF0, PRESETS.female_young_firm.f0);
  assert.ok(p.filters.some((f) => f.startsWith('rubberband=') && f.includes('formant=shifted')));
  assert.ok(p.filters.some((f) => f.startsWith('rubberband=') && f.includes('formant=preserved')));
  const q = buildVoicePlan({ preset: 'male_uncle_soft', sourceF0: 120, hasRubberband: false });
  assert.equal(q.applied.engine, 'asetrate');
  assert.ok(q.filters.some((f) => f.startsWith('asetrate=')));
  // a female input needs less formant shift to become a female voice than a male input does
  const fromMale = buildVoicePlan({ preset: 'female_older_soft', sourceF0: 110 }).applied.formantShift;
  const fromFemale = buildVoicePlan({ preset: 'female_older_soft', sourceF0: 210 }).applied.formantShift;
  assert.ok(fromMale > fromFemale);
  assert.equal(buildVoicePlan({ preset: 'male_older_soft', sourceF0: 5 }).ok, false);
});

test('36 voices: each output is a valid wav near its own pitch, and they all differ', async (t) => {
  if (!(await ffmpegAvailable())) return t.skip('ffmpeg not installed');
  if (!(await ffmpegHasFilter('rubberband'))) return t.skip('ffmpeg has no rubberband filter');
  const src = vowel(120);
  const heard = new Map();
  for (const id of NATURAL_VOICES) {
    const r = await changeVoice(src, { preset: id });
    assert.equal(r.ok, true, id);
    assert.equal(r.applied.engine, 'rubberband', id);
    const info = inspectWav(r.buf);
    assert.equal(info.ok, true, id);
    const want = PRESETS[id].speed > 0 ? 1.5 / PRESETS[id].speed : 1.5;
    assert.ok(Math.abs(info.durationSec - want) < 0.15, `${id} length ${info.durationSec} vs ${want.toFixed(2)}`);
    const f0 = estimateF0(r.buf);
    assert.ok(f0, `${id}: no pitch heard`);
    // elders have a deliberate tremor, so allow a little more
    const tol = id.includes('elder') || id.includes('uncle') ? 2 : 1.4;
    assert.ok(Math.abs(st(f0, PRESETS[id].f0)) < tol, `${id}: wanted ${PRESETS[id].f0} Hz, heard ${Math.round(f0)} Hz`);
    heard.set(id, f0);
  }
  assert.equal(new Set([...heard.values()].map((v) => Math.round(v / 4))).size > 20, true, 'too many voices share the same pitch');
});
