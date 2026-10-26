// Tiny dependency-free audio synthesis helpers (mono, 16-bit, 22.05 kHz).
export const SR = 22050;

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const buf = (d) => new Float32Array(Math.round(d * SR));

export function noise(d, r) {
  const x = buf(d);
  for (let i = 0; i < x.length; i++) x[i] = r() * 2 - 1;
  return x;
}

export function osc(d, f, wave = 'sine') {
  const fn = typeof f === 'number' ? () => f : f;
  const x = buf(d);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    ph += fn(i / SR) / SR;
    const p = ph - Math.floor(ph);
    x[i] = wave === 'sine' ? Math.sin(2 * Math.PI * p) : wave === 'saw' ? 2 * p - 1 : p < 0.5 ? 1 : -1;
  }
  return x;
}

export function lp(x, fc) {
  const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
  const y = new Float32Array(x.length);
  let s = 0;
  for (let i = 0; i < x.length; i++) { s += a * (x[i] - s); y[i] = s; }
  return y;
}

export function hp(x, fc) {
  const l = lp(x, fc);
  return x.map((v, i) => v - l[i]);
}

export function bp(x, f0, q) {
  const w = (2 * Math.PI * Math.min(f0, SR * 0.45)) / SR;
  const al = Math.sin(w) / (2 * q);
  const a0 = 1 + al, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0, b0 = al / a0, b2 = -al / a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

// Multiply by a time-dependent gain g(t).
export const mul = (x, g) => x.map((v, i) => v * g(i / SR));

// Sum arrays (each [array, gain]); output length = longest.
export function mix(...parts) {
  const n = Math.max(...parts.map(([a]) => a.length));
  const y = new Float32Array(n);
  for (const [a, g = 1] of parts) for (let i = 0; i < a.length; i++) y[i] += a[i] * g;
  return y;
}

// Add src into out starting at `at` seconds.
export function place(out, src, at, gain = 1) {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < out.length; i++) out[o + i] += src[i] * gain;
  return out;
}

export function fade(x, sec = 0.01) {
  const n = Math.min(Math.round(sec * SR), x.length >> 1);
  for (let i = 0; i < n; i++) {
    const g = i / n;
    x[i] *= g;
    x[x.length - 1 - i] *= g;
  }
  return x;
}

export function normalize(x, peak = 0.8) {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  if (m === 0) return x;
  const g = peak / m;
  return x.map((v) => v * g);
}

// Voice-like sound: sawtooth source through formant band-pass filters.
export function voice(d, f0, formants, r, breath = 0.05) {
  const src = osc(d, f0, 'saw');
  const n = noise(d, r);
  const s = src.map((v, i) => v + n[i] * breath);
  return mix(...formants.map(([f, q, g]) => [bp(s, f, q), g]));
}

export function toWav(x) {
  const data = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) {
    const v = Math.max(-1, Math.min(1, x[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
