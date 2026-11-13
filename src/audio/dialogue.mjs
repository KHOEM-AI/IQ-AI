// Multi-character dialogue: every line is spoken by its own voice (one of the 36 natural voices or an older preset),
// then all lines are joined into ONE wav with start/end times, so a video can show one scene per spoken line.
// The text-to-speech engine is injectable (deps) so this can be tested without the network.
import { PRESETS } from './voice/presets.mjs';
import { synthesizeSpeech, TTS_LIMITS } from './tts/provider.mjs';
import { wavFromFloat } from './wavWrite.mjs';

export const DIALOGUE_LIMITS = {
  lines: [1, 20],
  totalChars: 3000,
  gapMs: [0, 3000],
  defaultGapMs: 350,
  maxTotalSec: 300,
  speaker: 40,
};

const TARGET_RMS = 0.12; // every voice is brought to the same loudness (about -18 dBFS)
const TRIM_BELOW = 0.008; // silence at the start/end of a spoken line
const EDGE_PAD_MS = 40;

const bad = (message, status = 400, code = 'bad_request') => ({ ok: false, status, code, message });

// 16-bit PCM mono WAV -> { sr, x: Float32Array } or null
function readWav(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  let pos = 12;
  let fmt = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') fmt = { tag: buf.readUInt16LE(pos + 8), ch: buf.readUInt16LE(pos + 10), sr: buf.readUInt32LE(pos + 12), bits: buf.readUInt16LE(pos + 22) };
    if (id === 'data') {
      if (!fmt || fmt.tag !== 1 || fmt.ch !== 1 || fmt.bits !== 16) return null;
      const n = Math.floor((Math.min(buf.length, pos + 8 + size) - pos - 8) / 2);
      const x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = buf.readInt16LE(pos + 8 + i * 2) / 32768;
      return { sr: fmt.sr, x };
    }
    pos += 8 + size + (size & 1);
  }
  return null;
}

function prepare(x, sr) {
  let a = 0;
  let b = x.length;
  while (a < b && Math.abs(x[a]) < TRIM_BELOW) a++;
  while (b > a && Math.abs(x[b - 1]) < TRIM_BELOW) b--;
  const pad = Math.round((sr * EDGE_PAD_MS) / 1000);
  a = Math.max(0, a - pad);
  b = Math.min(x.length, b + pad);
  const y = x.slice(a, b);
  let e = 0;
  let peak = 0;
  for (const v of y) { e += v * v; peak = Math.max(peak, Math.abs(v)); }
  const rms = Math.sqrt(e / Math.max(1, y.length));
  if (rms > 0) {
    const gain = Math.max(0.25, Math.min(4, TARGET_RMS / rms, 0.95 / peak));
    for (let i = 0; i < y.length; i++) y[i] *= gain;
  }
  return y;
}

// body: { lines:[{ text, voice?, lang?, speaker?, pauseMs? }], gapMs? }
//   voice = preset id from GET /api/v1/audio/voices (e.g. "male_uncle_firm"); pauseMs = silence after this line
// Returns { ok:true, buf, timings:[{index,voice,startMs,endMs}], totalMs, sampleRate } or { ok:false, status, code, message }
export async function synthesizeDialogue(body = {}, deps = {}) {
  const synth = deps.synth || ((b) => synthesizeSpeech(b, deps.tts));
  const lines = body && body.lines;
  const [min, max] = DIALOGUE_LIMITS.lines;
  if (!Array.isArray(lines) || lines.length < min || lines.length > max) return bad(`"lines" must be an array of ${min}..${max} lines`);
  const [gMin, gMax] = DIALOGUE_LIMITS.gapMs;
  const gapOf = (v, what) => {
    if (v === undefined || v === null) return { ok: true, value: null };
    return Number.isInteger(v) && v >= gMin && v <= gMax ? { ok: true, value: v } : { ok: false, message: `${what} must be a whole number ${gMin}..${gMax}` };
  };
  const g = gapOf(body.gapMs, 'gapMs');
  if (!g.ok) return bad(g.message);
  const gap = g.value ?? DIALOGUE_LIMITS.defaultGapMs;

  let chars = 0;
  const plan = [];
  for (const [i, l] of lines.entries()) {
    const n = `line ${i + 1}`;
    if (!l || typeof l !== 'object') return bad(`${n}: must be an object {"text":"...","voice":"..."}`);
    const text = typeof l.text === 'string' ? l.text.trim() : '';
    if (!text) return bad(`${n}: "text" is required`);
    if (text.length > TTS_LIMITS.maxChars) return bad(`${n}: "text" is limited to ${TTS_LIMITS.maxChars} characters`);
    chars += text.length;
    const voice = l.voice === undefined || l.voice === null || l.voice === '' ? null : String(l.voice);
    if (voice && !Object.hasOwn(PRESETS, voice)) return bad(`${n}: unknown voice. See GET /api/v1/audio/voices`);
    if (l.lang !== undefined && typeof l.lang !== 'string') return bad(`${n}: "lang" must be text`);
    const p = gapOf(l.pauseMs, `${n}: pauseMs`);
    if (!p.ok) return bad(p.message);
    const speaker = typeof l.speaker === 'string' ? l.speaker.slice(0, DIALOGUE_LIMITS.speaker) : undefined;
    plan.push({ text, voice, lang: l.lang, pause: p.value ?? gap, speaker });
  }
  if (chars > DIALOGUE_LIMITS.totalChars) return bad(`Total text is limited to ${DIALOGUE_LIMITS.totalChars} characters (got ${chars})`);

  const parts = [];
  let sr = null;
  for (const [i, l] of plan.entries()) {
    const r = await synth({ text: l.text, ...(l.lang ? { lang: l.lang } : {}), ...(l.voice ? { voice: l.voice } : {}) });
    if (!r || !r.ok) return { ok: false, status: (r && r.status) || 502, code: (r && r.code) || 'tts_failed', message: `line ${i + 1}: ${(r && r.message) || 'speech failed'}` };
    const w = readWav(r.buf);
    if (!w) return bad(`line ${i + 1}: the speech engine did not return 16-bit mono WAV`, 502, 'tts_bad_audio');
    if (sr === null) sr = w.sr;
    else if (w.sr !== sr) return bad(`line ${i + 1}: sample rate differs from the previous lines (${w.sr} vs ${sr})`, 502, 'tts_bad_audio');
    parts.push(prepare(w.x, sr));
  }

  const gapSamples = plan.map((l, i) => (i === plan.length - 1 ? 0 : Math.round((sr * l.pause) / 1000)));
  const total = parts.reduce((s, p, i) => s + p.length + gapSamples[i], 0);
  if (total > sr * DIALOGUE_LIMITS.maxTotalSec) return bad(`Dialogue is longer than ${DIALOGUE_LIMITS.maxTotalSec} seconds`, 413, 'too_large');
  const out = new Float32Array(total);
  const timings = [];
  let cur = 0;
  for (const [i, p] of parts.entries()) {
    out.set(p, cur);
    timings.push({ index: i, voice: plan[i].voice, ...(plan[i].speaker ? { speaker: plan[i].speaker } : {}), startMs: Math.round((cur / sr) * 1000), endMs: Math.round(((cur + p.length) / sr) * 1000) });
    cur += p.length + gapSamples[i];
  }
  return { ok: true, buf: wavFromFloat(out, sr), timings, totalMs: Math.round((total / sr) * 1000), sampleRate: sr };
}
