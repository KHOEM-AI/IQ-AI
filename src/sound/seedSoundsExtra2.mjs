// Extra synthetic sounds, batch 2: loopable nature beds, animals, Khmer instruments, beats.
import { SR, noise, osc, lp, hp, bp, mul, mix, place, buf, voice } from './synth.mjs';

const TAU = 2 * Math.PI;
const dec = (k) => (t) => Math.exp(-k * t);
const win = (d) => (t) => Math.sin((Math.PI * Math.min(t, d)) / d);
const swell = (p, lo = 0.3) => (t) => lo + (1 - lo) * 0.5 * (1 + Math.sin((TAU * t) / p));
const lcg = (s) => { let x = s >>> 0; return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296; };

const D = 10, XF = 0.6, T = D + XF;
// Crossfade the tail into the head so the end joins the start with no click.
const loopable = (x) => {
  const n = Math.round(XF * SR), L = x.length - n, out = new Float32Array(L);
  for (let i = 0; i < L; i++) out[i] = x[i];
  for (let i = 0; i < n; i++) { const w = i / n; out[i] = x[i] * w + x[L + i] * (1 - w); }
  return out;
};
const wind = (r, p = 6) => mul(lp(noise(T, r), 500), swell(p, 0.4));
const chirps = (out, q, n, g) => {
  for (let k = 0; k < n; k++) {
    const f = 2300 + q() * 1600;
    place(out, mul(osc(0.15, (t) => f + 1800 * (t / 0.15)), win(0.15)), q() * (T - 0.3), g * (0.5 + 0.5 * q()));
  }
};
const crickets = (out, g) => {
  for (let k = 0; k * 0.25 < T - 0.2; k++) for (let j = 0; j < 3; j++) place(out, mul(osc(0.025, 4300), win(0.025)), k * 0.25 + j * 0.045, g);
};
const frogs = (out, q, r, n, g) => {
  for (let k = 0; k < n; k++) {
    const at = q() * (T - 0.8);
    for (let j = 0; j < 3; j++) place(out, mul(voice(0.12, 110, [[400, 6, 1], [1200, 8, 0.4]], r, 0.2), win(0.12)), at + j * 0.2, g);
  }
};
const pluck = (f, d, k = 5) => mul(mix([osc(d, f), 0.6], [osc(d, f * 2), 0.3], [osc(d, f * 3), 0.15]), dec(k));
const NASAL = [[1000, 5, 1], [1800, 6, 0.6]];

export const EXTRA2_SOUNDS = [
  // nature: loopable beds
  { cat: 'nature', name: 'rain-drops', km: 'សំឡេងដំណក់ទឹកភ្លៀង', tags: ['rain', 'drops', 'loop', 'bed'], seed: 2001, loop: true, gen(r) {
    const out = buf(T), q = lcg(2001);
    place(out, lp(noise(T, r), 2500), 0, 0.04);
    for (let k = 0; k < 55; k++) {
      const f = 900 + q() * 1800;
      place(out, mul(osc(0.07, (t) => f * (1 + 2.5 * t)), dec(55)), q() * (T - 0.1), 0.3 + 0.7 * q());
    }
    return loopable(out);
  } },
  { cat: 'nature', name: 'rain-roof', km: 'សំឡេងភ្លៀងលើដំបូល', tags: ['rain', 'roof', 'loop', 'bed'], seed: 2002, loop: true, gen(r) {
    const out = buf(T), q = lcg(2002);
    place(out, hp(lp(noise(T, r), 7000), 900), 0, 0.5);
    for (let k = 0; k < 350; k++) place(out, mul(bp(noise(0.012, r), 2800, 2), dec(200)), q() * (T - 0.02), 0.2 + 0.5 * q());
    return loopable(out);
  } },
  { cat: 'nature', name: 'river-flow', km: 'សំឡេងទឹកស្ទឹងហូរ', tags: ['river', 'water', 'loop', 'bed'], seed: 2003, loop: true, gen(r) {
    return loopable(mix(
      [mul(bp(noise(T, r), 700, 0.8), swell(3.1, 0.6)), 0.6],
      [mul(bp(noise(T, r), 1500, 1.2), swell(1.7, 0.5)), 0.4],
      [mul(hp(noise(T, r), 3000), swell(0.9, 0.6)), 0.15],
    ));
  } },
  { cat: 'nature', name: 'mountain-wind', km: 'សំឡេងខ្យល់តំបន់ភ្នំ', tags: ['wind', 'mountain', 'loop', 'bed'], seed: 2004, loop: true, gen(r) {
    return loopable(mix(
      [mul(bp(noise(T, r), 350, 1.5), swell(5, 0.2)), 0.9],
      [mul(osc(T, (t) => 520 + 60 * Math.sin(TAU * 0.2 * t)), swell(7, 0)), 0.04],
    ));
  } },
  { cat: 'nature', name: 'forest-day', km: 'បរិយាកាសព្រៃពេលថ្ងៃ', tags: ['forest', 'day', 'birds', 'loop', 'bed'], seed: 2005, loop: true, gen(r) {
    const out = buf(T), q = lcg(2005);
    place(out, wind(r), 0, 0.5);
    chirps(out, q, 26, 0.45);
    place(out, mul(osc(T, 5200), (t) => 0.5 + 0.5 * Math.sin(TAU * 80 * t)), 0, 0.02);
    return loopable(out);
  } },
  { cat: 'nature', name: 'forest-night', km: 'បរិយាកាសព្រៃពេលយប់', tags: ['forest', 'night', 'crickets', 'frogs', 'loop', 'bed'], seed: 2006, loop: true, gen(r) {
    const out = buf(T), q = lcg(2006);
    place(out, wind(r), 0, 0.35);
    crickets(out, 0.35);
    frogs(out, q, r, 6, 0.35);
    return loopable(out);
  } },
  { cat: 'nature', name: 'jungle-deep', km: 'បរិយាកាសព្រៃជ្រៅ', tags: ['jungle', 'forest', 'insects', 'loop', 'bed'], seed: 2007, loop: true, gen(r) {
    const out = buf(T), q = lcg(2007);
    place(out, wind(r, 8), 0, 0.4);
    place(out, mul(osc(T, 5000), (t) => (0.5 + 0.5 * Math.sin(TAU * 95 * t)) * swell(4, 0.3)(t)), 0, 0.05);
    frogs(out, q, r, 8, 0.3);
    chirps(out, q, 10, 0.35);
    crickets(out, 0.15);
    return loopable(out);
  } },

  // animals
  { cat: 'animals', name: 'pig-oink', km: 'សំឡេងជ្រូកយំ', tags: ['pig', 'oink', 'farm'], seed: 2011, gen(r) {
    const out = buf(1.4);
    for (const at of [0.1, 0.7]) place(out, mul(voice(0.35, (t) => 180 - 70 * (t / 0.35), [[600, 5, 1], [1500, 6, 0.7], [2500, 7, 0.3]], r, 0.15), win(0.35)), at);
    return out;
  } },
  { cat: 'animals', name: 'horse-neigh', km: 'សំឡេងសេះស្រែក', tags: ['horse', 'neigh', 'farm'], seed: 2012, gen(r) {
    const d = 1.8;
    return mul(voice(d, (t) => 700 + 500 * Math.sin(Math.PI * Math.min(1, t / 0.4)) - 350 * (t / d) + 25 * Math.sin(TAU * 18 * t), [[1100, 5, 1], [2800, 6, 0.6]], r, 0.15), win(d));
  } },
  { cat: 'animals', name: 'goat-bleat', km: 'សំឡេងពពែយំ', tags: ['goat', 'bleat', 'farm'], seed: 2013, gen(r) {
    return mul(voice(1.1, (t) => 380 + 30 * Math.sin(TAU * 32 * t), [[900, 5, 1], [1800, 6, 0.5]], r, 0.2), win(1.1));
  } },
  { cat: 'animals', name: 'crow-caw', km: 'សំឡេងក្អែកយំ', tags: ['crow', 'caw', 'bird'], seed: 2014, gen(r) {
    const out = buf(2);
    for (const at of [0.1, 0.8, 1.4]) place(out, mul(voice(0.4, (t) => 420 - 120 * (t / 0.4), [[1000, 5, 1], [1800, 6, 0.8]], r, 0.4), win(0.4)), at);
    return out;
  } },
  { cat: 'animals', name: 'dove-coo', km: 'សំឡេងព្រាបយំ', tags: ['dove', 'coo', 'bird'], seed: 2015, gen(r) {
    const out = buf(2.2);
    [[0.1, 0.35], [0.55, 0.35], [1.0, 0.8]].forEach(([at, d]) => place(out, mul(voice(d, (t) => 330 + 25 * Math.sin((Math.PI * t) / d), [[500, 8, 1], [1000, 8, 0.2]], r, 0.02), win(d)), at));
    return out;
  } },
  { cat: 'animals', name: 'forest-insects', km: 'សំឡេងសត្វល្អិតព្រៃ', tags: ['insect', 'forest', 'buzz'], seed: 2016, gen() {
    return mul(osc(3, 5200), (t) => (0.5 + 0.5 * Math.sin(TAU * 95 * t)) * Math.sin((Math.PI * t) / 3));
  } },
  { cat: 'animals', name: 'gecko-call', km: 'សំឡេងទុក្កែយំ', tags: ['gecko', 'call', 'night'], seed: 2017, gen(r) {
    const out = buf(2.4);
    [0.1, 0.3, 0.5, 0.75, 1.05, 1.4, 1.85].forEach((at) => place(out, mul(voice(0.07, (t) => 1200 - 300 * (t / 0.07), [[1500, 6, 1], [3000, 8, 0.4]], r, 0.3), win(0.07)), at));
    return out;
  } },

  // music: Khmer instruments and beats
  { cat: 'music', name: 'chapei', km: 'ចាប៉ី', tags: ['instrument', 'khmer', 'traditional', 'string'], seed: 2021, gen() {
    const out = buf(3.4);
    [294, 330, 392, 330, 294, 262, 294].forEach((f, k) => place(out, pluck(f, 1.2, 4), 0.1 + k * 0.4, 0.8));
    return out;
  } },
  { cat: 'music', name: 'khse-diev', km: 'ខ្សែដៀវ', tags: ['instrument', 'khmer', 'traditional', 'string'], seed: 2022, gen() {
    const v = (f) => (t) => f * (1 + 0.015 * Math.sin(TAU * 5 * t));
    return mul(mix([osc(2.5, v(196)), 0.7], [osc(2.5, v(392)), 0.2]), dec(1.6));
  } },
  { cat: 'music', name: 'roneat-dek', km: 'រនាតដែក', tags: ['instrument', 'khmer', 'traditional', 'percussion'], seed: 2023, gen() {
    const out = buf(2.4);
    [523, 587, 659, 784, 880, 784, 659, 587].forEach((f, k) => place(out, mul(mix([osc(0.8, f), 0.8], [osc(0.8, f * 3.9), 0.2]), dec(7)), 0.05 + k * 0.2));
    return out;
  } },
  { cat: 'music', name: 'skor-arak', km: 'ស្គរអារាក់', tags: ['instrument', 'khmer', 'traditional', 'drum'], seed: 2024, gen(r) {
    const out = buf(2.4);
    const dum = mul(osc(0.3, (t) => 130 - 60 * Math.min(1, t / 0.08)), dec(12));
    const tak = mul(bp(noise(0.05, r), 2000, 2), dec(70));
    for (const at of [0, 0.6, 1.2, 1.5, 1.8]) place(out, dum, at);
    for (const at of [0.3, 0.9, 2.1]) place(out, tak, at, 0.8);
    return out;
  } },
  { cat: 'music', name: 'chhap', km: 'ឆាប', tags: ['instrument', 'khmer', 'traditional', 'cymbals'], seed: 2025, gen(r) {
    const out = buf(2.6);
    const clang = mul(mix([hp(noise(0.5, r), 3000), 0.6], [osc(0.5, 3100), 0.2], [osc(0.5, 4700), 0.15]), dec(10));
    for (const at of [0.1, 0.5, 0.9, 1.4, 1.8]) place(out, clang, at);
    return out;
  } },
  { cat: 'music', name: 'krap', km: 'ក្រាប់', tags: ['instrument', 'khmer', 'traditional', 'wood'], seed: 2026, gen(r) {
    const out = buf(2);
    for (let k = 0; k < 8; k++) place(out, mul(bp(noise(0.03, r), 1400, 4), dec(110)), 0.1 + k * 0.22, k % 2 ? 0.6 : 1);
    return out;
  } },
  { cat: 'music', name: 'beat-120bpm', km: 'ចង្វាក់អេឡិចត្រូនិក ១២០ BPM', tags: ['beat', 'electronic', 'drums', '120bpm', 'loop'], seed: 2027, loop: true, gen(r) {
    const out = buf(8);
    const kick = mul(osc(0.35, (t) => 150 * Math.exp(-18 * t) + 45), dec(12));
    const snare = mix([mul(bp(noise(0.2, r), 1800, 0.8), dec(18)), 0.6], [mul(osc(0.2, 190), dec(25)), 0.5]);
    const hat = mul(hp(noise(0.06, r), 6000), dec(70));
    for (let k = 0; k < 16; k++) {
      place(out, kick, k * 0.5);
      place(out, hat, k * 0.5 + 0.25, 0.4);
      if (k % 2) place(out, snare, k * 0.5, 0.7);
    }
    return out;
  } },
  { cat: 'music', name: 'bass-drop', km: 'បាសធ្លាក់', tags: ['bass', 'drop', 'electronic', 'impact'], seed: 2028, gen(r) {
    return mix(
      [mul(osc(2.5, (t) => Math.max(32, 120 * Math.exp(-1.2 * t))), dec(0.8)), 0.9],
      [mul(lp(noise(2.5, r), 400), dec(6)), 0.4],
    );
  } },
];
