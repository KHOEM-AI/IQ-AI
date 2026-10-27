import { wavFromFloat } from '../wavWrite.mjs';

// Procedural sound effects (no model, no network). Mono, 44.1 kHz, deterministic.
const SR = 44100;
const TAU = Math.PI * 2;

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

const GENERATORS = {
  engine(n, r) {
    const o = new Float32Array(n); let ph = 0; let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const rpm = 1500 + 1500 * (0.5 + 0.5 * Math.sin(TAU * t / Math.max(1, n / SR)));
      ph += TAU * (rpm / 60 * 2) / SR;
      let v = 0;
      for (let h = 1; h <= 6; h++) v += Math.sin(h * ph) / h;
      lp += 0.05 * (r() - lp);
      o[i] = (v * 0.5) * (1 + 0.25 * Math.sin(ph / 2)) + lp * 2;
    }
    return o;
  },
  horn(n) {
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      o[i] = Math.tanh(3 * Math.sin(TAU * 420 * t)) * 0.5 + Math.tanh(3 * Math.sin(TAU * 520 * t)) * 0.5;
    }
    return o;
  },
  siren(n) {
    const o = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += TAU * (900 + 300 * Math.sin(TAU * t / 1.2)) / SR;
      o[i] = Math.sin(ph);
    }
    return o;
  },
  beep(n) {
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      o[i] = (t % 0.3) < 0.15 ? Math.sin(TAU * 1000 * t) : 0;
    }
    return o;
  },
  wind(n, r) {
    const o = new Float32Array(n); let lp = 0;
    for (let i = 0; i < n; i++) {
      lp += 0.02 * (r() - lp);
      o[i] = lp * 12 * (0.6 + 0.4 * Math.sin(TAU * 0.3 * i / SR));
    }
    return o;
  },
  rain(n, r) {
    const o = new Float32Array(n); let lp = 0;
    for (let i = 0; i < n; i++) {
      const x = r();
      lp += 0.3 * (x - lp);
      o[i] = (x - lp) * 0.5 + (Math.abs(r()) > 0.9995 ? 0.8 : 0);
    }
    return o;
  },
  hammer(n, r) {
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = (i / SR) % 0.45;
      o[i] = Math.exp(-t * 30) * Math.sin(TAU * 180 * t) + Math.exp(-t * 80) * r() * 0.5;
    }
    return o;
  },
  drill(n, r) {
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let v = 0;
      for (let h = 1; h <= 10; h++) v += Math.sin(TAU * 140 * h * t) / (h ** 0.7);
      o[i] = v * (0.75 + 0.25 * Math.sin(TAU * 25 * t)) * 0.3 + r() * 0.08;
    }
    return o;
  },
};

export const SFX_TYPES = Object.keys(GENERATORS);
export const SFX_LIMITS = { durationSec: [0.1, 30] };

export function synthSfx({ type, durationSec = 2, seed = 1 } = {}) {
  if (!Object.hasOwn(GENERATORS, type)) {
    return { ok: false, message: `Unknown sfx type "${type}". Use one of: ${SFX_TYPES.join(', ')}` };
  }
  const d = Number(durationSec);
  const [lo, hi] = SFX_LIMITS.durationSec;
  if (!Number.isFinite(d) || d < lo || d > hi) return { ok: false, message: `durationSec must be ${lo}..${hi}` };
  const n = Math.round(d * SR);
  const o = GENERATORS[type](n, rng(Number(seed) || 1));
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(o[i]));
  const g = peak > 0 ? 0.8 / peak : 1;
  const fade = Math.min(Math.round(SR * 0.005), n >> 1);
  for (let i = 0; i < n; i++) {
    let e = 1;
    if (i < fade) e = i / fade; else if (n - 1 - i < fade) e = (n - 1 - i) / fade;
    o[i] *= g * e;
  }
  return { ok: true, buf: wavFromFloat(o, SR), type, durationSec: d };
}
