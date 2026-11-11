import { PRESETS, LIMITS } from './presets.mjs';
import { runFfmpeg, ffmpegHasFilter } from '../ffmpeg.mjs';
import { estimateF0 } from './estimatePitch.mjs';

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

// Natural voices (presets with f0): the input voice is assumed male below this pitch, female above.
const FEMALE_F0 = 165;
const FEMALE_FORMANT = 3;
const NATURAL_PITCH_LIMIT = 24; // two octaves; beyond ~12 semitones the result gets less natural
const SOURCE_F0 = [50, 600];

// Returns { ok, filters, applied } or { ok:false, message }.
// o.sourceF0 = measured pitch of the input (Hz) and o.hasRubberband = false (ffmpeg without rubberband) are
// set by changeVoice; presets with f0 use them to aim at their own absolute pitch and vocal-tract size.
export function buildVoicePlan(o = {}) {
  let base = { pitch: 0, speed: 1, fx: [] };
  if (o.preset) {
    if (!Object.hasOwn(PRESETS, o.preset)) return { ok: false, message: `Unknown preset "${o.preset}"` };
    base = PRESETS[o.preset];
  }
  const sf = num(o.sourceF0, SOURCE_F0, null);
  if (!sf.ok) return { ok: false, message: `sourceF0 must be ${SOURCE_F0[0]}..${SOURCE_F0[1]} Hz` };
  const natural = base.f0 !== undefined && sf.value !== null && blank(o.pitch);
  const srcFormant = sf.value !== null && sf.value >= FEMALE_F0 ? FEMALE_FORMANT : 0;
  const natPitch = natural
    ? Math.max(-NATURAL_PITCH_LIMIT, Math.min(NATURAL_PITCH_LIMIT, 12 * Math.log2(base.f0 / sf.value)))
    : null;
  const formant = natural ? base.formant - srcFormant : 0;
  const p = natural ? { ok: true, value: Math.round(natPitch * 100) / 100 } : num(o.pitch, LIMITS.pitch, base.pitch);
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
  const rubber = natural && o.hasRubberband !== false;
  if (rubber) {
    // 1) move pitch and vocal tract together by the formant shift, 2) fix the pitch with the tract kept as is
    if (Math.abs(formant) > 0.05) f.push(`rubberband=pitch=${(2 ** (formant / 12)).toFixed(5)}:formant=shifted`);
    const rest = p.value - formant;
    if (Math.abs(rest) > 0.05) f.push(`rubberband=pitch=${(2 ** (rest / 12)).toFixed(5)}:formant=preserved`);
  } else if (p.value !== 0) {
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
      ...(natural ? { sourceF0: Math.round(sf.value), targetF0: base.f0, formantShift: Math.round(formant * 10) / 10, engine: rubber ? 'rubberband' : 'asetrate' } : {}),
    },
  };
}

export async function changeVoice(buf, options = {}) {
  const opts = { ...options };
  const preset = opts.preset && Object.hasOwn(PRESETS, opts.preset) ? PRESETS[opts.preset] : null;
  if (preset && preset.f0 !== undefined) {
    if (blank(opts.sourceF0) && blank(opts.pitch)) {
      // measure the input voice once (callers that make many voices can pass sourceF0 themselves)
      const probe = await runFfmpeg(buf, ['-af', 'aresample=44100']);
      const hz = estimateF0(probe);
      if (hz) opts.sourceF0 = Math.round(hz * 10) / 10;
    }
    opts.hasRubberband = await ffmpegHasFilter('rubberband');
  }
  const plan = buildVoicePlan(opts);
  if (!plan.ok) return plan;
  const out = await runFfmpeg(buf, ['-af', plan.filters.join(',')]);
  return { ok: true, buf: out, applied: plan.applied };
}
