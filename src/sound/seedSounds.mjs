// 30 synthetic seed sounds, 3 per category. Approximations, not recordings.
import { SR, noise, osc, lp, hp, bp, mul, mix, place, buf, voice } from './synth.mjs';

const TAU = 2 * Math.PI;
const dec = (k) => (t) => Math.exp(-k * t);
const win = (d) => (t) => Math.sin((Math.PI * Math.min(t, d)) / d);
const AH = [[800, 5, 1], [1150, 6, 0.6], [2900, 8, 0.2]];

export const SEED_SOUNDS = [
  // 1 animals
  { cat: 'animals', name: 'bird-chirp', km: 'សំឡេងបក្សីយំ', tags: ['bird', 'chirp'], seed: 1, gen() {
    const out = buf(2);
    for (const at of [0.1, 0.45, 0.8, 1.2, 1.5]) {
      const d = 0.18;
      place(out, mul(osc(d, (t) => 2800 + 2200 * (t / d) + 400 * Math.sin(TAU * 30 * t)), win(d)), at);
    }
    return out;
  } },
  { cat: 'animals', name: 'cricket', km: 'សំឡេងចង្រិត', tags: ['cricket', 'insect', 'night'], seed: 2, gen() {
    const out = buf(2.5);
    for (let k = 0; k < 10; k++) for (let j = 0; j < 3; j++) {
      place(out, mul(osc(0.025, 4200), win(0.025)), k * 0.25 + j * 0.045);
    }
    return out;
  } },
  { cat: 'animals', name: 'dog-bark', km: 'សំឡេងឆ្កែព្រុស', tags: ['dog', 'bark'], seed: 3, gen(r) {
    const out = buf(1.6);
    for (const at of [0.1, 0.7]) {
      const d = 0.3;
      place(out, mul(voice(d, (t) => 210 - 90 * (t / d), [[700, 4, 1], [1100, 4, 0.7], [2200, 6, 0.2]], r, 0.3), dec(9)), at);
    }
    return out;
  } },
  // 2 human
  { cat: 'human', name: 'vowel-ah', km: 'សំឡេងស្រៈ អា', tags: ['voice', 'vowel', 'speech'], seed: 4, gen(r) {
    return mul(voice(1.5, (t) => 140 + 3 * Math.sin(TAU * 5 * t), AH, r), win(1.5));
  } },
  { cat: 'human', name: 'laugh', km: 'សំឡេងសើច', tags: ['laugh', 'voice'], seed: 5, gen(r) {
    const out = buf(1.4);
    for (let k = 0; k < 5; k++) {
      const d = 0.13;
      place(out, mul(voice(d, 230 - 12 * k, AH, r, 0.25), win(d)), 0.1 + k * 0.22, 1 - k * 0.1);
    }
    return out;
  } },
  { cat: 'human', name: 'hum-melody', km: 'សំឡេងទ្រហ៊ឹមបទភ្លេង', tags: ['hum', 'singing', 'melody'], seed: 6, gen(r) {
    const out = buf(2);
    [196, 220, 262, 220, 196].forEach((f, k) => {
      place(out, mul(voice(0.38, f, [[250, 6, 1], [2100, 8, 0.15]], r, 0.02), win(0.38)), 0.05 + k * 0.38);
    });
    return out;
  } },
  // 3 vehicles
  { cat: 'vehicles', name: 'engine-idle', km: 'ម៉ាស៊ីនរថយន្តរត់ទំនេរ', tags: ['engine', 'car', 'idle'], seed: 7, gen(r) {
    const body = lp(osc(3, (t) => 28 + 2 * Math.sin(TAU * 0.5 * t), 'saw'), 500);
    return mix([mul(body, (t) => 0.8 + 0.2 * Math.sin(TAU * 7 * t)), 1], [lp(noise(3, r), 300), 0.3]);
  } },
  { cat: 'vehicles', name: 'car-horn', km: 'សំឡេងស៊ីផ្លេរថយន្ត', tags: ['horn', 'car'], seed: 8, gen() {
    const x = lp(mix([osc(1.2, 400, 'square'), 1], [osc(1.2, 500, 'square'), 1]), 3000);
    return mul(x, (t) => Math.min(t / 0.02, 1) * Math.min((1.2 - t) / 0.05, 1));
  } },
  { cat: 'vehicles', name: 'siren', km: 'សំឡេងស៊ីផ្លេសង្គ្រោះ', tags: ['siren', 'emergency'], seed: 9, gen() {
    const f = (t) => 900 + 400 * Math.sin(TAU * t / 1.5);
    return mix([osc(3, f), 1], [osc(3, (t) => 2 * f(t)), 0.3]);
  } },
  // 4 machines
  { cat: 'machines', name: 'fan-hum', km: 'សំឡេងកង្ហារ', tags: ['fan', 'hum'], seed: 10, gen(r) {
    return mix([lp(noise(3, r), 800), 0.5], [osc(3, 120), 0.15], [bp(noise(3, r), 2000, 1), 0.1]);
  } },
  { cat: 'machines', name: 'motor-whine', km: 'សំឡេងម៉ូទ័រ', tags: ['motor', 'whine'], seed: 11, gen() {
    return mix([lp(osc(2.5, (t) => 100 + 350 * (t / 2.5), 'saw'), 3000), 0.6], [osc(2.5, (t) => 200 + 700 * (t / 2.5)), 0.3]);
  } },
  { cat: 'machines', name: 'water-pump', km: 'សំឡេងម៉ាស៊ីនបូមទឹក', tags: ['pump', 'water', 'machine'], seed: 12, gen(r) {
    return mix([mul(lp(noise(3, r), 600), (t) => 0.6 + 0.4 * Math.sin(TAU * 7 * t)), 1], [osc(3, 90), 0.2]);
  } },
  // 5 nature
  { cat: 'nature', name: 'rain', km: 'សំឡេងភ្លៀង', tags: ['rain', 'weather'], seed: 13, gen(r) {
    const out = mix([hp(noise(4, r), 1500), 0.35]);
    for (let k = 0; k < 70; k++) {
      const f = 1500 + r() * 2000;
      place(out, mul(osc(0.012, f), dec(250)), r() * 3.95, 0.15 + r() * 0.2);
    }
    return out;
  } },
  { cat: 'nature', name: 'thunder', km: 'សំឡេងផ្គរ', tags: ['thunder', 'storm'], seed: 14, gen(r) {
    const crack = mul(hp(noise(0.15, r), 800), dec(25));
    const rumble = mul(lp(noise(4, r), 140), (t) => Math.exp(-t / 1.5) * (0.6 + 0.4 * Math.sin(TAU * 0.9 * t)));
    return place(mix([rumble, 1.5]), crack, 0, 0.8);
  } },
  { cat: 'nature', name: 'wind', km: 'សំឡេងខ្យល់', tags: ['wind', 'weather'], seed: 15, gen(r) {
    const n = noise(4, r);
    return mix([mul(bp(n, 500, 1.2), (t) => 0.5 + 0.5 * Math.sin(TAU * 0.3 * t)), 1], [mul(bp(n, 900, 1.5), (t) => 0.5 + 0.5 * Math.sin(TAU * 0.23 * t + 1)), 0.6]);
  } },
  // 6 music
  { cat: 'music', name: 'piano-scale', km: 'សំឡេងស្គេលព្យាណូ', tags: ['piano', 'scale', 'instrument'], seed: 16, gen() {
    const out = buf(3);
    [261.63, 293.66, 329.63, 392, 523.25].forEach((f, k) => {
      for (let h = 1; h <= 6; h++) place(out, mul(osc(1, f * h), dec(3 + h)), k * 0.5, 0.5 / h);
    });
    return out;
  } },
  { cat: 'music', name: 'drum-beat', km: 'ចង្វាក់ស្គរ', tags: ['drum', 'beat', 'rhythm'], seed: 17, gen(r) {
    const out = buf(4.8);
    const kick = mul(osc(0.25, (t) => 150 * Math.exp(-t * 12) + 45), dec(14));
    const snare = mix([mul(bp(noise(0.2, r), 1800, 1), dec(22)), 1], [mul(osc(0.2, 190), dec(30)), 0.6]);
    const hat = mul(hp(noise(0.06, r), 6000), dec(60));
    for (let b = 0; b < 8; b++) {
      place(out, b % 2 ? snare : kick, b * 0.6);
      place(out, hat, b * 0.6, 0.5);
      place(out, hat, b * 0.6 + 0.3, 0.35);
    }
    return out;
  } },
  { cat: 'music', name: 'chord-pad', km: 'សំឡេងអាកូតតន្ត្រី', tags: ['chord', 'pad', 'music'], seed: 18, gen() {
    const notes = [261.63, 329.63, 392];
    const x = mix(...notes.flatMap((f) => [[osc(3, f), 0.4], [lp(osc(3, f * 1.004, 'saw'), 1200), 0.25]]));
    return mul(x, win(3));
  } },
  // 7 objects
  { cat: 'objects', name: 'door-knock', km: 'សំឡេងគោះទ្វារ', tags: ['door', 'knock'], seed: 19, gen(r) {
    const out = buf(1.8);
    const k = mix([mul(osc(0.15, (t) => 140 - 300 * t), dec(30)), 1], [mul(lp(noise(0.15, r), 600), dec(60)), 0.6]);
    for (const at of [0.1, 0.5, 0.9]) place(out, k, at);
    return out;
  } },
  { cat: 'objects', name: 'falling-object', km: 'សំឡេងវត្ថុធ្លាក់', tags: ['fall', 'impact', 'bounce'], seed: 20, gen(r) {
    const out = buf(1.6);
    [[0.1, 1], [0.55, 0.6], [0.9, 0.35], [1.15, 0.2], [1.3, 0.1]].forEach(([at, g]) => {
      place(out, mix([mul(osc(0.2, 300), dec(30)), 1], [mul(bp(noise(0.2, r), 1500, 1), dec(25)), 0.7]), at, g);
    });
    return out;
  } },
  { cat: 'objects', name: 'door-creak', km: 'សំឡេងទ្វារស្រែក', tags: ['door', 'creak'], seed: 21, gen(r) {
    const src = osc(2, (t) => 150 + 80 * Math.sin(TAU * 0.6 * t), 'saw');
    const rough = mul(bp(src, 600, 3), (t) => 0.5 + 0.5 * Math.sin(TAU * 35 * t));
    return mul(mix([rough, 1], [bp(noise(2, r), 1200, 4), 0.15]), win(2));
  } },
  // 8 signals
  { cat: 'signals', name: 'alarm-beep', km: 'សំឡេងរោទ៍ព្រមាន', tags: ['alarm', 'beep', 'warning'], seed: 22, gen() {
    const out = buf(2.4);
    const b = mul(mix([osc(0.3, 1000), 1], [osc(0.3, 2000), 0.3]), (t) => Math.min(t / 0.01, 1) * Math.min((0.3 - t) / 0.01, 1));
    for (let k = 0; k < 4; k++) place(out, b, k * 0.6);
    return out;
  } },
  { cat: 'signals', name: 'notification-chime', km: 'សំឡេងជូនដំណឹង', tags: ['notification', 'chime', 'ui'], seed: 23, gen() {
    const out = buf(1.6);
    place(out, mul(mix([osc(0.8, 880), 1], [osc(0.8, 1760), 0.3]), dec(5)), 0);
    place(out, mul(mix([osc(0.8, 1318.5), 1], [osc(0.8, 2637), 0.3]), dec(5)), 0.25);
    return out;
  } },
  { cat: 'signals', name: 'ui-click', km: 'សំឡេងចុច UI', tags: ['click', 'ui', 'system'], seed: 24, gen(r) {
    const out = buf(1);
    const c = mix([mul(bp(noise(0.03, r), 3000, 2), dec(200)), 1], [mul(osc(0.03, 1200), dec(150)), 0.3]);
    for (const at of [0.1, 0.5, 0.8]) place(out, c, at);
    return out;
  } },
  // 9 ambience
  { cat: 'ambience', name: 'market-crowd', km: 'បរិយាកាសផ្សារ', tags: ['market', 'crowd', 'babble'], seed: 25, gen(r) {
    const vowels = [AH, [[400, 5, 1], [2000, 7, 0.5], [2800, 8, 0.2]], [[500, 5, 1], [1500, 6, 0.6], [2500, 8, 0.2]]];
    const parts = [];
    for (let k = 0; k < 12; k++) {
      const v = voice(4, 100 + r() * 150, vowels[k % 3], r, 0.15);
      const lf = 2 + r() * 4, ph = r() * TAU;
      parts.push([mul(v, (t) => Math.max(0, Math.sin(TAU * lf * t + ph))), 0.3]);
    }
    parts.push([lp(noise(4, r), 1500), 0.1]);
    return mix(...parts);
  } },
  { cat: 'ambience', name: 'office-hum', km: 'បរិយាកាសការិយាល័យ', tags: ['office', 'keyboard', 'hum'], seed: 26, gen(r) {
    const out = mix([osc(4, 100), 0.1], [osc(4, 200), 0.05], [lp(noise(4, r), 400), 0.1]);
    for (let k = 0; k < 18; k++) {
      place(out, mix([mul(bp(noise(0.03, r), 2500, 2), dec(150)), 1], [mul(osc(0.03, 180), dec(120)), 0.4]), 0.1 + r() * 3.8, 0.5 + r() * 0.5);
    }
    return out;
  } },
  { cat: 'ambience', name: 'city-traffic', km: 'បរិយាកាសទីក្រុង', tags: ['city', 'traffic', 'street'], seed: 27, gen(r) {
    const base = mul(lp(noise(4, r), 300), (t) => 0.5 + 0.2 * Math.sin(TAU * 0.4 * t));
    const swells = [0.8, 2.0, 3.2].map((c) => [mul(lp(noise(4, r), 800), (t) => Math.exp(-((t - c) ** 2) / 0.18)), 0.8]);
    return mix([base, 1], ...swells);
  } },
  // 10 synthetic
  { cat: 'synthetic', name: 'laser', km: 'សំឡេងឡាស៊ែរ', tags: ['laser', 'scifi', 'effect'], seed: 28, gen() {
    const out = buf(1.6);
    const s = mul(osc(0.5, (t) => 200 + 2500 * Math.exp(-t * 6), 'saw'), dec(5));
    place(out, s, 0);
    place(out, s, 0.6, 0.8);
    return out;
  } },
  { cat: 'synthetic', name: 'computer-boot', km: 'សំឡេងកុំព្យូទ័របើក', tags: ['computer', 'boot', 'arpeggio'], seed: 29, gen() {
    const out = buf(1.4);
    [523, 659, 784, 1047, 1319, 1568].forEach((f, k) => place(out, mul(lp(osc(0.1, f, 'square'), 4000), win(0.1)), k * 0.1, 0.6));
    place(out, mul(osc(0.6, 1568), dec(5)), 0.6, 0.8);
    return out;
  } },
  { cat: 'synthetic', name: 'game-coin', km: 'សំឡេងកាក់ហ្គេម', tags: ['game', 'coin', 'retro'], seed: 30, gen() {
    const out = buf(0.6);
    place(out, mul(osc(0.08, 988, 'square'), dec(6)), 0, 0.6);
    place(out, mul(osc(0.5, 1319, 'square'), dec(7)), 0.08, 0.6);
    return out;
  } },
];
