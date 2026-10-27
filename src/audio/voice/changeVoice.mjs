import { PRESETS, LIMITS } from './presets.mjs';
import { runFfmpeg } from '../ffmpeg.mjs';

const SR = 44100;

function tempoChain(f) {
  const out = [];
  while (f > 2) { out.push(2); f /= 2; }
  while (f < 0.5) { out.push(0.5); f /= 0.5; }
  if (Math.abs(f - 1) > 1e-6) out.push(f);
  return out.map((v) => `atempo=${v.toFixed(5)}`);
}

const blank = (v) => v === undefined || v === null || v === '';
function num(v, [lo, hi], fallback) {
  if (blank(v)) return { ok: true, value: fallback };
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return { ok: false };
  return { ok: true, value: n };
}
function bool(v) {
  if (blank(v)) return { ok: true, value: false };
  if (v === true || v === 'true' || v === '1') return { ok: true, value: true };
  if (v === false || v === 'false' || v === '0') return { ok: true, value: false };
  return { ok: false };
}

// Returns { ok, filters, applied } or { ok:false, message }.
export function buildVoicePlan(o = {}) {
  let base = { pitch: 0, speed: 1, fx: [] };
  if (o.preset) {
    if (!Object.hasOwn(PRESETS, o.preset)) return { ok: false, message: `Unknown preset "${o.preset}"` };
    base = PRESETS[o.preset];
  }
  const p = num(o.pitch, LIMITS.pitch, base.pitch);
  const s = num(o.speed, LIMITS.speed, base.speed);
  const v = num(o.volume, LIMITS.volume, 1);
  const ts = num(o.trimStart, [0, 3600], 0);
  const te = num(o.trimEnd, [0, 3600], null);
  const fi = num(o.fadeIn, [0, 30], 0);
  const fo = num(o.fadeOut, [0, 30], 0);
  const rev = bool(o.reverse), nor = bool(o.normalize), den = bool(o.denoise), sil = bool(o.removeSilence);
  if (!p.ok) return { ok: false, message: `pitch must be ${LIMITS.pitch[0]}..${LIMITS.pitch[1]} semitones` };
  if (!s.ok) return { ok: false, message: `speed must be ${LIMITS.speed[0]}..${LIMITS.speed[1]}` };
  if (!v.ok) return { ok: false, message: `volume must be ${LIMITS.volume[0]}..${LIMITS.volume[1]}` };
  if (!ts.ok || !te.ok) return { ok: false, message: 'trimStart/trimEnd must be seconds 0..3600' };
  if (te.value !== null && te.value <= ts.value) return { ok: false, message: 'trimEnd must be greater than trimStart' };
  if (!fi.ok || !fo.ok) return { ok: false, message: 'fadeIn/fadeOut must be seconds 0..30' };
  if (![rev, nor, den, sil].every((b) => b.ok)) return { ok: false, message: 'reverse/normalize/denoise/removeSilence must be true or false' };

  const f = [`aresample=${SR}`];
  if (ts.value > 0 || te.value !== null) {
    f.push(`atrim=start=${ts.value}${te.value !== null ? `:end=${te.value}` : ''}`, 'asetpts=PTS-STARTPTS');
  }
  if (den.value) f.push('afftdn=nf=-25');
  if (sil.value) f.push('silenceremove=start_periods=1:start_threshold=-50dB');
  if (p.value !== 0) {
    const r = 2 ** (p.value / 12);
    f.push(`asetrate=${Math.round(SR * r)}`, `aresample=${SR}`, ...tempoChain(1 / r));
  }
  if (s.value !== 1) f.push(...tempoChain(s.value));
  f.push(...base.fx);
  if (rev.value) f.push('areverse');
  if (fi.value > 0) f.push(`afade=t=in:d=${fi.value}`);
  if (fo.value > 0) f.push('areverse', `afade=t=in:d=${fo.value}`, 'areverse'); // fade-out without knowing length
  if (nor.value) f.push('dynaudnorm');
  if (v.value !== 1) f.push(`volume=${v.value}`);
  f.push('alimiter=limit=0.95');
  return {
    ok: true,
    filters: f,
    applied: {
      preset: o.preset || null, pitch: p.value, speed: s.value, volume: v.value,
      trimStart: ts.value, trimEnd: te.value, fadeIn: fi.value, fadeOut: fo.value,
      reverse: rev.value, normalize: nor.value, denoise: den.value, removeSilence: sil.value,
    },
  };
}

export async function changeVoice(buf, options) {
  const plan = buildVoicePlan(options);
  if (!plan.ok) return plan;
  const out = await runFfmpeg(buf, ['-af', plan.filters.join(',')]);
  return { ok: true, buf: out, applied: plan.applied };
}
