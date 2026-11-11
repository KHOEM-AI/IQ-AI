// Estimates the speaking pitch (Hz) of a mono 16-bit WAV, so each voice can aim at an absolute pitch
// whatever the input voice is. Median over voiced frames (autocorrelation). Returns null if unclear.
const DECIMATE = 2;
const FRAME = 1024;
const HOP = 512;
const F_MIN = 55;
const F_MAX = 600;

function pcmFromWav(buf) {
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'data') {
      const end = Math.min(buf.length, pos + 8 + size);
      const n = Math.floor((end - pos - 8) / 2);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(pos + 8 + i * 2) / 32768;
      return out;
    }
    pos += 8 + size + (size & 1);
  }
  return null;
}

export function estimateF0(wav, { sampleRate = 44100, maxSeconds = 30 } = {}) {
  const pcm = pcmFromWav(wav);
  if (!pcm) return null;
  const sr = sampleRate / DECIMATE;
  const n = Math.min(Math.floor(pcm.length / DECIMATE), Math.floor(sr * maxSeconds));
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let a = 0;
    for (let k = 0; k < DECIMATE; k++) a += pcm[i * DECIMATE + k];
    x[i] = a / DECIMATE;
  }
  const minLag = Math.floor(sr / F_MAX);
  const maxLag = Math.floor(sr / F_MIN);
  const frames = [];
  let peakRms = 0;
  for (let s = 0; s + FRAME + maxLag < n; s += HOP) {
    let e = 0;
    for (let i = 0; i < FRAME; i++) e += x[s + i] * x[s + i];
    const rms = Math.sqrt(e / FRAME);
    frames.push({ s, rms });
    if (rms > peakRms) peakRms = rms;
  }
  const f0s = [];
  for (const { s, rms } of frames) {
    if (rms < 0.01 || rms < peakRms * 0.15) continue;
    let e0 = 0;
    for (let i = 0; i < FRAME; i++) e0 += x[s + i] * x[s + i];
    const r = new Float32Array(maxLag + 2);
    let best = 0;
    for (let l = minLag; l <= maxLag + 1; l++) {
      let c = 0;
      let e1 = 0;
      for (let i = 0; i < FRAME; i++) { c += x[s + i] * x[s + i + l]; e1 += x[s + i + l] * x[s + i + l]; }
      r[l] = c / Math.sqrt(e0 * e1 + 1e-12);
      if (r[l] > best) best = r[l];
    }
    if (best < 0.6) continue;
    // first strong peak (avoids picking an octave below)
    let lag = 0;
    for (let l = minLag + 1; l <= maxLag; l++) {
      if (r[l] >= best * 0.85 && r[l] >= r[l - 1] && r[l] >= r[l + 1]) { lag = l; break; }
    }
    if (!lag) continue;
    const a = r[lag - 1], b = r[lag], c = r[lag + 1];
    const d = a - 2 * b + c;
    const shift = d !== 0 ? (0.5 * (a - c)) / d : 0;
    f0s.push(sr / (lag + shift));
  }
  if (f0s.length < 5) return null;
  f0s.sort((p, q) => p - q);
  return f0s[Math.floor(f0s.length / 2)];
}
