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

  // 11 new sounds
  { cat: 'objects', name: 'gravel-footsteps', km: 'សំឡេងជំហានដើរលើក្រួស', tags: ['footsteps', 'gravel', 'walking'], seed: 31, gen(r) {
    const out = buf(3.2);
    for (let k = 0; k < 7; k++) {
      const at = 0.12 + k * 0.43;
      const d = 0.16;
      const crunch = mix(
        [mul(hp(noise(d, r), 900), dec(18)), 0.8],
        [mul(lp(noise(d, r), 500), dec(25)), 0.45],
        [mul(osc(d, (t) => 90 + 30 * Math.sin(TAU * 18 * t)), dec(22)), 0.3]
      );
      place(out, crunch, at, 0.65 + 0.05 * (k % 3));
    }
    return out;
  } },
  { cat: 'objects', name: 'paper-crumple', km: 'សំឡេងក្រដាសជ្រួញ', tags: ['paper', 'crumple', 'rustle'], seed: 32, gen(r) {
    const out = buf(2.8);
    for (let k = 0; k < 24; k++) {
      const d = 0.035 + r() * 0.09;
      const burst = mul(hp(noise(d, r), 1200 + r() * 2500), dec(18 + r() * 30));
      place(out, burst, r() * 2.5, 0.2 + r() * 0.45);
    }
    return out;
  } },
  { cat: 'objects', name: 'glass-clink', km: 'សំឡេងកែវប៉ះគ្នា', tags: ['glass', 'clink', 'impact'], seed: 33, gen(r) {
    const out = buf(2);
    for (const at of [0.15, 0.72, 1.25]) {
      const d = 0.7;
      const tone = mix(
        [osc(d, 1850 + r() * 250), 0.65],
        [osc(d, 2780 + r() * 300), 0.35],
        [osc(d, 3650 + r() * 350), 0.18]
      );
      place(out, mul(tone, dec(7)), at, 0.7);
      place(out, mul(hp(noise(0.025, r), 3000), dec(100)), at, 0.15);
    }
    return out;
  } },
  { cat: 'nature', name: 'water-drip', km: 'សំឡេងទឹកតំណក់', tags: ['water', 'drip', 'droplet'], seed: 34, gen(r) {
    const out = buf(3);
    for (const at of [0.2, 0.65, 1.45, 1.8, 2.55]) {
      const d = 0.22;
      const drop = mul(
        osc(d, (t) => 900 - 520 * (t / d)),
        dec(15)
      );
      const splash = mul(hp(noise(0.08, r), 1800), dec(35));
      place(out, drop, at, 0.65);
      place(out, splash, at, 0.18);
    }
    return out;
  } },
  { cat: 'machines', name: 'keyboard-typing', km: 'សំឡេងវាយក្ដារចុច', tags: ['keyboard', 'typing', 'computer'], seed: 35, gen(r) {
    const out = buf(3.2);
    for (let k = 0; k < 28; k++) {
      const at = 0.08 + k * 0.105 + r() * 0.045;
      const d = 0.035 + r() * 0.025;
      const click = mix(
        [mul(hp(noise(d, r), 1700), dec(100)), 0.8],
        [mul(osc(d, 700 + r() * 500), dec(90)), 0.3]
      );
      place(out, click, at, 0.35 + r() * 0.4);
    }
    return out;
  } },
  { cat: 'nature', name: 'rustling-leaves', km: 'សំឡេងស្លឹកឈើរវិលតាមខ្យល់', tags: ['leaves', 'rustling', 'wind', 'nature'], seed: 36, gen(r) {
    const n = noise(4, r);
    const sway1 = mul(bp(n, 1400, 1.2), (t) => 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(TAU * 0.45 * t)));
    const sway2 = mul(hp(noise(4, r), 2600), (t) => 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(TAU * 0.8 * t + 1)));
    return mix([sway1, 0.8], [sway2, 0.5]);
  } },

  { cat: 'nature', name: 'ocean-waves', km: 'រលកសមុទ្រ', tags: ['ocean', 'waves', 'water'], seed: 37, gen(r) {
    const out = buf(4);
    for (let k = 0; k < 5; k++) {
      const at = k * 0.72;
      const d = 1.8;
      const surf = mul(lp(noise(d, r), 700 + r() * 500), (t) => Math.pow(Math.max(0, Math.sin(Math.PI * t / d)), 1.4));
      place(out, surf, at, 0.65);
    }
    return out;
  } },
  { cat: 'nature', name: 'forest-breeze', km: 'ខ្យល់បក់ក្នុងព្រៃ', tags: ['forest', 'breeze', 'wind'], seed: 38, gen(r) {
    const n = noise(4, r);
    return mix(
      [mul(lp(n, 650), (t) => 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(TAU * 0.3 * t))), 0.8],
      [mul(hp(noise(4, r), 1800), (t) => 0.08 + 0.22 * Math.sin(TAU * 0.6 * t) ** 2), 0.35]
    );
  } },
  { cat: 'nature', name: 'stream-flow', km: 'ទឹកហូរក្នុងអូរ', tags: ['stream', 'flowing-water', 'nature'], seed: 39, gen(r) {
    const out = buf(4);
    place(out, mul(bp(noise(4, r), 900, 0.8), (t) => 0.3 + 0.2 * Math.sin(TAU * 1.7 * t)), 0, 0.7);
    for (let k = 0; k < 18; k++) {
      const d = 0.08 + r() * 0.12;
      place(out, mul(hp(noise(d, r), 2200 + r() * 1200), dec(20 + r() * 25)), r() * 3.7, 0.12 + r() * 0.2);
    }
    return out;
  } },
  { cat: 'animals', name: 'frog-croak', km: 'សំឡេងកង្កែប', tags: ['frog', 'croak', 'animal'], seed: 40, gen(r) {
    const out = buf(3);
    for (let k = 0; k < 5; k++) {
      const d = 0.32;
      const tone = mul(osc(d, (t) => 170 + 35 * Math.sin(TAU * 7 * t)), (t) => Math.sin(Math.PI * t / d) ** 2);
      place(out, tone, k * 0.52, 0.55);
    }
    return out;
  } },
  { cat: 'animals', name: 'owl-hoot', km: 'សំឡេងសត្វទីទុយ', tags: ['owl', 'hoot', 'bird'], seed: 41, gen(r) {
    const out = buf(3);
    for (const at of [0.15, 1.15]) {
      const d = 0.75;
      const tone = mul(osc(d, (t) => 420 - 100 * t), (t) => Math.sin(Math.PI * t / d) ** 1.5);
      place(out, tone, at, 0.6);
    }
    return out;
  } },
  { cat: 'animals', name: 'cat-meow', km: 'សំឡេងឆ្មាយំ', tags: ['cat', 'meow', 'animal'], seed: 42, gen(r) {
    const out = buf(2.2);
    const d = 1.1;
    const tone = mul(osc(d, (t) => 520 + 170 * Math.sin(TAU * 1.2 * t) - 100 * t), (t) => Math.sin(Math.PI * t / d) ** 0.7);
    place(out, tone, 0.25, 0.6);
    return out;
  } },
  { cat: 'human', name: 'soft-cough', km: 'សំឡេងក្អកស្រាល', tags: ['human', 'cough', 'voice'], seed: 43, gen(r) {
    const out = buf(1.8);
    for (const at of [0.25, 0.72]) {
      const d = 0.18;
      place(out, mul(bp(noise(d, r), 1100, 0.9), dec(18)), at, 0.48);
    }
    return out;
  } },
  { cat: 'objects', name: 'keys-jingling', km: 'សំឡេងកូនសោប៉ះគ្នា', tags: ['keys', 'metal', 'jingle'], seed: 44, gen(r) {
    const out = buf(2.4);
    for (let k = 0; k < 18; k++) {
      const d = 0.12 + r() * 0.15;
      const f = 1800 + r() * 2400;
      place(out, mul(osc(d, f), dec(30 + r() * 30)), r() * 2.1, 0.12 + r() * 0.22);
    }
    return out;
  } },
  { cat: 'objects', name: 'bottle-tap', km: 'សំឡេងគោះដប', tags: ['bottle', 'tap', 'impact'], seed: 45, gen(r) {
    const out = buf(2);
    for (const at of [0.2, 0.85, 1.35]) {
      const d = 0.35;
      const tone = mul(osc(d, 780 + r() * 220), dec(12));
      place(out, tone, at, 0.45);
      place(out, mul(hp(noise(0.025, r), 1800), dec(100)), at, 0.15);
    }
    return out;
  } },
  { cat: 'machines', name: 'printer-running', km: 'សំឡេងម៉ាស៊ីនបោះពុម្ព', tags: ['printer', 'machine', 'office'], seed: 46, gen(r) {
    const out = buf(3.5);
    place(out, mul(osc(3.5, 125), (t) => 0.12 + 0.08 * Math.sin(TAU * 9 * t)), 0, 0.4);
    for (let k = 0; k < 14; k++) {
      const d = 0.055;
      place(out, mul(hp(noise(d, r), 1400), dec(70)), 0.15 + k * 0.22, 0.18 + r() * 0.18);
    }
    return out;
  } },
  { cat: 'machines', name: 'clock-ticking', km: 'សំឡេងនាឡិកាដើរ', tags: ['clock', 'tick', 'time'], seed: 47, gen(r) {
    const out = buf(3);
    for (let k = 0; k < 6; k++) {
      const at = k * 0.48;
      const tick = mul(hp(noise(0.035, r), 1800), dec(90));
      place(out, tick, at, 0.5);
      place(out, mul(osc(0.04, 1300), dec(80)), at + 0.12, 0.35);
    }
    return out;
  } },
  { cat: 'signals', name: 'microwave-beeps', km: 'សំឡេងប៊ីបរបស់មីក្រូវ៉េវ', tags: ['microwave', 'beep', 'appliance'], seed: 48, gen(r) {
    const out = buf(2.8);
    for (const at of [0.2, 0.65, 1.1, 1.9, 2.35]) {
      place(out, mul(osc(0.18, 1000), dec(12)), at, 0.45);
    }
    return out;
  } },


  { cat: 'objects', name: 'house-door-open', km: 'ទ្វារផ្ទះបើក', tags: ['door', 'house', 'open', 'hinge'], seed: 49, gen(r) {
    const out = buf(2.2);
    place(out, mul(hp(noise(0.65, r), 450), dec(3)), 0.12, 0.45);
    place(out, mul(osc(0.8, (t) => 180 - 65 * t), dec(2)), 0.35, 0.4);
    place(out, mul(hp(noise(0.12, r), 900), dec(15)), 1.05, 0.5);
    return out;
  } },
  { cat: 'objects', name: 'house-door-close', km: 'ទ្វារផ្ទះបិទ', tags: ['door', 'house', 'close', 'slam'], seed: 50, gen(r) {
    const out = buf(1.8);
    place(out, mul(lp(noise(0.16, r), 650), dec(12)), 0.25, 0.75);
    place(out, mul(osc(0.12, 95), dec(18)), 0.28, 0.65);
    place(out, mul(hp(noise(0.06, r), 1300), dec(45)), 0.38, 0.35);
    return out;
  } },
  { cat: 'objects', name: 'door-handle-rattle', km: 'ដៃទ្វារកក្រើក', tags: ['door', 'handle', 'rattle'], seed: 51, gen(r) {
    const out = buf(2.1);
    for (let k = 0; k < 9; k++) {
      const d = 0.045 + r() * 0.045;
      place(out, mul(hp(noise(d, r), 1200), dec(65)), 0.15 + k * 0.16, 0.25 + r() * 0.3);
    }
    place(out, mul(osc(0.18, 720), dec(20)), 1.55, 0.3);
    return out;
  } },
  { cat: 'objects', name: 'car-door-open', km: 'ទ្វាររថយន្តបើក', tags: ['car', 'door', 'open', 'vehicle'], seed: 52, gen(r) {
    const out = buf(1.8);
    place(out, mul(lp(noise(0.18, r), 500), dec(12)), 0.12, 0.55);
    place(out, mul(osc(0.5, (t) => 150 - 45 * t), dec(3)), 0.25, 0.45);
    place(out, mul(hp(noise(0.08, r), 850), dec(20)), 0.8, 0.45);
    return out;
  } },
  { cat: 'objects', name: 'car-door-close', km: 'ទ្វាររថយន្តបិទ', tags: ['car', 'door', 'close', 'vehicle'], seed: 53, gen(r) {
    const out = buf(1.5);
    place(out, mul(lp(noise(0.2, r), 420), dec(10)), 0.2, 0.8);
    place(out, mul(osc(0.14, 78), dec(15)), 0.23, 0.8);
    place(out, mul(hp(noise(0.04, r), 1600), dec(60)), 0.3, 0.35);
    return out;
  } },
  { cat: 'objects', name: 'window-slide-open', km: 'បង្អួចរអិលបើក', tags: ['window', 'slide', 'open'], seed: 54, gen(r) {
    const out = buf(2.4);
    const n = noise(1.25, r);
    place(out, mul(bp(n, 900, 0.8), (t) => 0.12 + 0.25 * t), 0.2, 0.6);
    place(out, mul(hp(noise(0.1, r), 1800), dec(25)), 1.45, 0.3);
    return out;
  } },
  { cat: 'objects', name: 'window-slide-close', km: 'បង្អួចរអិលបិទ', tags: ['window', 'slide', 'close'], seed: 55, gen(r) {
    const out = buf(2.2);
    place(out, mul(bp(noise(1.1, r), 1050, 0.9), (t) => 0.35 - 0.18 * t), 0.15, 0.55);
    place(out, mul(lp(noise(0.12, r), 700), dec(15)), 1.25, 0.55);
    place(out, mul(hp(noise(0.04, r), 1900), dec(65)), 1.32, 0.3);
    return out;
  } },
  { cat: 'objects', name: 'window-knock', km: 'គោះបង្អួច', tags: ['window', 'knock', 'tap'], seed: 56, gen(r) {
    const out = buf(1.8);
    for (const at of [0.2, 0.48, 0.9, 1.18]) {
      place(out, mul(osc(0.1, 480 + r() * 180), dec(18)), at, 0.45);
      place(out, mul(hp(noise(0.025, r), 1700), dec(100)), at, 0.2);
    }
    return out;
  } },
  { cat: 'objects', name: 'door-latch-click', km: 'សំឡេងគន្លឹះទ្វារចុច', tags: ['door', 'latch', 'click', 'lock'], seed: 57, gen(r) {
    const out = buf(1.4);
    for (const at of [0.22, 0.55, 0.82]) {
      place(out, mul(hp(noise(0.035, r), 1400), dec(80)), at, 0.4);
      place(out, mul(osc(0.06, 950), dec(45)), at + 0.025, 0.25);
    }
    return out;
  } },
  { cat: 'signals', name: 'car-lock-beep', km: 'ប៊ីបចាក់សោរថយន្ត', tags: ['car', 'lock', 'beep', 'signal'], seed: 58, gen(r) {
    const out = buf(2);
    for (const at of [0.25, 0.62]) {
      place(out, mul(osc(0.16, 1450), dec(12)), at, 0.45);
    }
    return out;
  } },
  { cat: 'objects', name: 'key-turn-lock', km: 'សោបង្វិលចាក់សោ', tags: ['key', 'lock', 'turn', 'metal'], seed: 59, gen(r) {
    const out = buf(1.8);
    for (let k = 0; k < 5; k++) {
      place(out, mul(hp(noise(0.045, r), 2000), dec(70)), 0.18 + k * 0.07, 0.18 + r() * 0.16);
    }
    place(out, mul(osc(0.16, 620), dec(18)), 0.75, 0.4);
    place(out, mul(hp(noise(0.035, r), 1600), dec(70)), 0.92, 0.3);
    return out;
  } },
  { cat: 'machines', name: 'garage-door-motor', km: 'ម៉ូទ័រទ្វារយានដ្ឋាន', tags: ['garage', 'door', 'motor', 'mechanical'], seed: 60, gen(r) {
    const out = buf(4);
    place(out, mul(lp(noise(4, r), 500), (t) => 0.15 + 0.22 * (0.5 + 0.5 * Math.sin(TAU * 7 * t))), 0, 0.65);
    place(out, mul(osc(3.6, (t) => 95 + 12 * Math.sin(TAU * 5 * t)), (t) => 0.15 + 0.12 * t), 0.1, 0.45);
    place(out, mul(hp(noise(0.14, r), 1300), dec(20)), 3.55, 0.4);
    return out;
  } },


  { cat: 'objects', name: 'key-insertion', km: 'សំឡេងដាក់សោចូលរន្ធ', tags: ['key', 'lock', 'insert'], seed: 61, gen(r) {
    const out = buf(1.5);
    place(out, mul(hp(noise(0.045, r), 2200), dec(65)), 0.2, 0.3);
    place(out, mul(osc(0.12, 1150), dec(20)), 0.28, 0.35);
    return out;
  } },
  { cat: 'objects', name: 'key-removal', km: 'សំឡេងដកសោចេញ', tags: ['key', 'lock', 'remove'], seed: 62, gen(r) {
    const out = buf(1.5);
    place(out, mul(hp(noise(0.055, r), 1900), dec(55)), 0.22, 0.3);
    place(out, mul(osc(0.15, 820), dec(22)), 0.3, 0.3);
    return out;
  } },
  { cat: 'objects', name: 'deadbolt-lock', km: 'សំឡេងរុញគន្លឹះសោទ្វារ', tags: ['deadbolt', 'lock', 'metal'], seed: 63, gen(r) {
    const out = buf(1.6);
    for (const at of [0.2, 0.52]) {
      place(out, mul(hp(noise(0.045, r), 1300), dec(65)), at, 0.35);
    }
    place(out, mul(osc(0.1, 540), dec(20)), 0.65, 0.4);
    return out;
  } },
  { cat: 'objects', name: 'unlock-click', km: 'សំឡេងដោះសោ', tags: ['unlock', 'lock', 'click'], seed: 64, gen(r) {
    const out = buf(1.3);
    place(out, mul(hp(noise(0.035, r), 1700), dec(85)), 0.25, 0.4);
    place(out, mul(osc(0.09, 760), dec(25)), 0.3, 0.3);
    return out;
  } },
  { cat: 'objects', name: 'wooden-door-creak-long', km: 'ទ្វារឈើស្រែកអូសយូរ', tags: ['wood', 'door', 'creak', 'hinge'], seed: 65, gen(r) {
    const out = buf(3);
    const n = noise(1.8, r);
    place(out, mul(bp(n, 650, 1.3), (t) => 0.08 + 0.35 * Math.sin(Math.PI * t / 1.8)), 0.3, 0.65);
    place(out, mul(osc(1.4, (t) => 230 - 90 * t), (t) => 0.05 + 0.18 * Math.sin(Math.PI * t / 1.4)), 0.5, 0.3);
    return out;
  } },
  { cat: 'objects', name: 'metal-door-open', km: 'ទ្វារដែកបើក', tags: ['metal', 'door', 'open', 'hinge'], seed: 66, gen(r) {
    const out = buf(2.3);
    place(out, mul(bp(noise(1.1, r), 1250, 1.1), (t) => 0.08 + 0.3 * t), 0.2, 0.55);
    place(out, mul(hp(noise(0.08, r), 2100), dec(30)), 1.35, 0.4);
    return out;
  } },
  { cat: 'objects', name: 'door-gentle-close', km: 'ទ្វារបិទថ្នមៗ', tags: ['door', 'gentle', 'close'], seed: 67, gen(r) {
    const out = buf(2);
    place(out, mul(lp(noise(0.22, r), 520), dec(8)), 0.65, 0.35);
    place(out, mul(hp(noise(0.04, r), 1250), dec(70)), 0.88, 0.2);
    return out;
  } },
  { cat: 'objects', name: 'door-hinge-squeak', km: 'សំឡេងហ៊ីងទ្វារច្រេះ', tags: ['hinge', 'squeak', 'door'], seed: 68, gen(r) {
    const out = buf(2.2);
    const d = 1.05;
    const squeak = mul(osc(d, (t) => 720 + 110 * Math.sin(TAU * 2.5 * t)), (t) => Math.sin(Math.PI * t / d) ** 1.5);
    place(out, squeak, 0.3, 0.45);
    place(out, mul(hp(noise(0.08, r), 1700), dec(30)), 1.4, 0.25);
    return out;
  } },
  { cat: 'objects', name: 'glass-window-rattle', km: 'កញ្ចក់បង្អួចញ័រ', tags: ['glass', 'window', 'rattle'], seed: 69, gen(r) {
    const out = buf(2);
    for (let k = 0; k < 12; k++) {
      const d = 0.07 + r() * 0.08;
      place(out, mul(osc(d, 1100 + r() * 1300), dec(35)), 0.12 + k * 0.12, 0.12 + r() * 0.18);
    }
    return out;
  } },
  { cat: 'objects', name: 'glass-tap', km: 'សំឡេងគោះកញ្ចក់', tags: ['glass', 'tap', 'window'], seed: 70, gen(r) {
    const out = buf(1.8);
    for (const at of [0.25, 0.7, 1.15]) {
      place(out, mul(osc(0.24, 1450 + r() * 250), dec(12)), at, 0.35);
      place(out, mul(hp(noise(0.025, r), 2800), dec(100)), at, 0.12);
    }
    return out;
  } },
  { cat: 'signals', name: 'remote-car-unlock', km: 'សំឡេងបញ្ជាដោះសោរថយន្ត', tags: ['car', 'remote', 'unlock', 'beep'], seed: 71, gen(r) {
    const out = buf(1.8);
    place(out, mul(osc(0.13, 1250), dec(12)), 0.2, 0.4);
    place(out, mul(osc(0.2, 1650), dec(10)), 0.42, 0.4);
    return out;
  } },
  { cat: 'machines', name: 'garage-door-rattle', km: 'សំឡេងទ្វារយានដ្ឋានកក្រើក', tags: ['garage', 'door', 'rattle', 'metal'], seed: 72, gen(r) {
    const out = buf(3.2);
    place(out, mul(lp(noise(3, r), 850), (t) => 0.1 + 0.22 * (0.5 + 0.5 * Math.sin(TAU * 6 * t))), 0.1, 0.55);
    for (let k = 0; k < 8; k++) {
      place(out, mul(hp(noise(0.05, r), 1600), dec(60)), 0.25 + k * 0.32, 0.15 + r() * 0.16);
    }
    return out;
  } },



  { cat: 'signals', name: 'phone-key-1', km: 'សំឡេងចុចលេខ 1', tags: ['phone', 'keypad', 'dtmf', 'digit-1'], seed: 73, gen(r) {
    const out = buf(0.8);
    const tone = mix(
      [osc(0.24, 697), 0.5],
      [osc(0.24, 1209), 0.5]
    );
    place(out, tone, 0.15, 0.7);
    return out;
  } },

  { cat: 'signals', name: 'phone-key-2', km: 'សំឡេងចុចលេខ 2', tags: ['phone', 'keypad', 'dtmf', 'digit-2'], seed: 74, gen(r) {
    const out = buf(0.8);
    const tone = mix(
      [osc(0.24, 697), 0.5],
      [osc(0.24, 1336), 0.5]
    );
    place(out, tone, 0.15, 0.7);
    return out;
  } },

  { cat: 'signals', name: 'phone-key-3', km: 'សំឡេងចុចលេខ 3', tags: ['phone', 'keypad', 'dtmf', 'digit-3'], seed: 75, gen(r) {
    const out = buf(0.8);
    const tone = mix(
      [osc(0.24, 697), 0.5],
      [osc(0.24, 1477), 0.5]
    );
    place(out, tone, 0.15, 0.7);
    return out;
  } },

  { cat: 'signals', name: 'phone-key-4', km: 'សំឡេងចុចលេខ 4', tags: ['phone', 'keypad', 'dtmf', 'digit-4'], seed: 76, gen(r) {
    const out = buf(0.8);
    const tone = mix(
      [osc(0.24, 770), 0.5],
      [osc(0.24, 1209), 0.5]
    );
    place(out, tone, 0.15, 0.7);
    return out;
  } },

  { cat: 'signals', name: 'phone-key-5', km: 'សំឡេងចុចលេខ 5', tags: ['phone', 'keypad', 'dtmf', 'digit-5'], seed: 77, gen(r) {
    const out = buf(0.8);
    const tone = mix(
      [osc(0.24, 770), 0.5],
      [osc(0.24, 1336), 0.5]
    );
    place(out, tone, 0.15, 0.7);
    return out;
  } },

  { cat: 'signals', name: 'phone-key-6', km: 'សំឡេងចុចលេខ 6', tags: ['phone', 'keypad', 'dtmf', 'digit-6'], seed: 78, gen(r) {
    const out = buf(0.8);
    const tone = mix(
      [osc(0.24, 770), 0.5],
      [osc(0.24, 1477), 0.5]
    );
    place(out, tone, 0.15, 0.7);
    return out;
  } },

  { cat: 'signals', name: 'phone-key-7', km: 'សំឡេងចុចលេខ 7', tags: ['phone', 'keypad', 'dtmf', 'digit-7'], seed: 79, gen(r) {
    const out = buf(0.8);
    const tone = mix(
      [osc(0.24, 852), 0.5],
      [osc(0.24, 1209), 0.5]
    );
    place(out, tone, 0.15, 0.7);
    return out;
  } },

  { cat: 'signals', name: 'phone-key-8', km: 'សំឡេងចុចលេខ 8', tags: ['phone', 'keypad', 'dtmf', 'digit-8'], seed: 80, gen(r) {
    const out = buf(0.8);
    const tone = mix(
      [osc(0.24, 852), 0.5],
      [osc(0.24, 1336), 0.5]
    );
    place(out, tone, 0.15, 0.7);
    return out;
  } },

  { cat: 'signals', name: 'phone-key-9', km: 'សំឡេងចុចលេខ 9', tags: ['phone', 'keypad', 'dtmf', 'digit-9'], seed: 81, gen(r) {
    const out = buf(0.8);
    const tone = mix(
      [osc(0.24, 852), 0.5],
      [osc(0.24, 1477), 0.5]
    );
    place(out, tone, 0.15, 0.7);
    return out;
  } },

  { cat: 'signals', name: 'phone-incoming-ring', km: 'សំឡេងទូរសព្ទហៅចូល', tags: ['phone', 'incoming', 'ringtone'], seed: 82, gen(r) {
    const out = buf(3.5);
    for (const at of [0.15, 0.75, 1.75, 2.35]) {
      const d = 0.42;
      const tone = mix([osc(d, 880), 0.55], [osc(d, 1320), 0.35]);
      place(out, mul(tone, (t) => Math.min(1, t * 18) * Math.min(1, (d - t) * 18)), at, 0.65);
    }
    return out;
  } },
  { cat: 'signals', name: 'phone-outgoing-ringback', km: 'សំឡេងរង់ចាំពេលហៅចេញ', tags: ['phone', 'outgoing', 'ringback'], seed: 83, gen(r) {
    const out = buf(4);
    for (const at of [0.2, 2.2]) {
      const d = 1.15;
      const tone = mix([osc(d, 440), 0.5], [osc(d, 480), 0.5]);
      place(out, tone, at, 0.6);
    }
    return out;
  } },
  { cat: 'signals', name: 'phone-busy-tone', km: 'សំឡេងខ្សែទូរសព្ទរវល់', tags: ['phone', 'busy', 'call-tone'], seed: 84, gen(r) {
    const out = buf(3);
    for (const at of [0.15, 0.75, 1.35, 1.95, 2.55]) {
      place(out, osc(0.28, 480), at, 0.5);
    }
    return out;
  } },
  { cat: 'signals', name: 'phone-call-ended', km: 'សំឡេងបញ្ចប់ការហៅ', tags: ['phone', 'call-ended', 'disconnect'], seed: 85, gen(r) {
    const out = buf(1.4);
    const tone = mix([osc(0.42, 480), 0.5], [osc(0.42, 620), 0.4]);
    place(out, tone, 0.2, 0.55);
    return out;
  } },
  { cat: 'signals', name: 'phone-call-waiting', km: 'សំឡេងការហៅចូលរង់ចាំ', tags: ['phone', 'call-waiting', 'alert'], seed: 86, gen(r) {
    const out = buf(2.2);
    place(out, osc(0.12, 1000), 0.2, 0.45);
    place(out, osc(0.12, 1000), 0.48, 0.45);
    return out;
  } },



  { cat: 'music', name: 'piano-soft', km: 'ព្យាណូសូរស្រាល',
    tags: ['instrument', 'keyboard', 'music'], seed: 87, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 261.63), 0.7],
        [osc(0.9, 523.26), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'piano-bright', km: 'ព្យាណូសូរភ្លឺ',
    tags: ['instrument', 'keyboard', 'music'], seed: 88, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 329.63), 0.7],
        [osc(0.9, 659.26), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'electric-guitar', km: 'ហ្គីតាអគ្គិសនី',
    tags: ['instrument', 'guitar', 'music'], seed: 89, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 196.0), 0.7],
        [osc(0.9, 392.00), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'acoustic-guitar', km: 'ហ្គីតាអាគូស្ទិក',
    tags: ['instrument', 'guitar', 'music'], seed: 90, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 220.0), 0.7],
        [osc(0.9, 440.00), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'bass-guitar', km: 'ហ្គីតាបាស',
    tags: ['instrument', 'bass', 'music'], seed: 91, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 110.0), 0.7],
        [osc(0.9, 220.00), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'drum-kick', km: 'ស្គរបាស',
    tags: ['instrument', 'drums', 'music'], seed: 92, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 65.41), 0.7],
        [osc(0.9, 130.82), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'drum-snare', km: 'ស្គរស្នែរ',
    tags: ['instrument', 'drums', 'music'], seed: 93, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 180.0), 0.7],
        [osc(0.9, 360.00), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'drum-cymbal', km: 'ស៊ីមបាល់',
    tags: ['instrument', 'drums', 'music'], seed: 94, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 880.0), 0.7],
        [osc(0.9, 1760.00), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'flute', km: 'ខ្លុយ',
    tags: ['instrument', 'wind', 'music'], seed: 95, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 523.25), 0.7],
        [osc(0.9, 1046.50), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'pan-flute', km: 'ខ្លុយច្រើនបំពង់',
    tags: ['instrument', 'wind', 'music'], seed: 96, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 587.33), 0.7],
        [osc(0.9, 1174.66), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'violin', km: 'វីយូឡុង',
    tags: ['instrument', 'strings', 'music'], seed: 97, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 440.0), 0.7],
        [osc(0.9, 880.00), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'viola', km: 'វីយូឡា',
    tags: ['instrument', 'strings', 'music'], seed: 98, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 349.23), 0.7],
        [osc(0.9, 698.46), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'cello', km: 'សែលឡូ',
    tags: ['instrument', 'strings', 'music'], seed: 99, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 220.0), 0.7],
        [osc(0.9, 440.00), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'harp', km: 'ពិណហាប',
    tags: ['instrument', 'strings', 'music'], seed: 100, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 392.0), 0.7],
        [osc(0.9, 784.00), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'trumpet', km: 'ត្រែ',
    tags: ['instrument', 'brass', 'music'], seed: 101, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 466.16), 0.7],
        [osc(0.9, 932.32), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'trombone', km: 'ត្រែត្រូំបូន',
    tags: ['instrument', 'brass', 'music'], seed: 102, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 146.83), 0.7],
        [osc(0.9, 293.66), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'saxophone', km: 'សាក់សូហ្វូន',
    tags: ['instrument', 'wind', 'music'], seed: 103, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 311.13), 0.7],
        [osc(0.9, 622.26), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'clarinet', km: 'ក្លារីណែត',
    tags: ['instrument', 'wind', 'music'], seed: 104, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 293.66), 0.7],
        [osc(0.9, 587.32), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'guzheng', km: 'គូចេងចិន',
    tags: ['instrument', 'asian', 'music'], seed: 105, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 392.0), 0.7],
        [osc(0.9, 784.00), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'erhu', km: 'អឺហ៊ូចិន',
    tags: ['instrument', 'asian', 'music'], seed: 106, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 440.0), 0.7],
        [osc(0.9, 880.00), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'koto', km: 'កូតូជប៉ុន',
    tags: ['instrument', 'asian', 'music'], seed: 107, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 369.99), 0.7],
        [osc(0.9, 739.98), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'sitar', km: 'ស៊ីតារឥណ្ឌា',
    tags: ['instrument', 'south-asian', 'music'], seed: 108, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 246.94), 0.7],
        [osc(0.9, 493.88), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'oud', km: 'អ៊ូដមជ្ឈិមបូព៌ា',
    tags: ['instrument', 'middle-east', 'music'], seed: 109, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 196.0), 0.7],
        [osc(0.9, 392.00), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'gong', km: 'គងប្រពៃណី',
    tags: ['instrument', 'percussion', 'music'], seed: 110, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 130.81), 0.7],
        [osc(0.9, 261.62), 0.2]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },


  { cat: 'music', name: 'khim', km: 'ឃឹមខ្មែរ',
    tags: ['instrument', 'world-music', 'cambodian'], seed: 111, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 392), 0.65],
        [osc(0.9, 784), 0.25],
        [osc(0.9, 1176), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'roneat-ek', km: 'រនាតឯក',
    tags: ['instrument', 'world-music', 'cambodian'], seed: 112, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 523), 0.65],
        [osc(0.9, 1046), 0.25],
        [osc(0.9, 1569), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'roneat-thung', km: 'រនាតធុង',
    tags: ['instrument', 'world-music', 'cambodian'], seed: 113, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 294), 0.65],
        [osc(0.9, 588), 0.25],
        [osc(0.9, 882), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'tro-khmer', km: 'ទ្រខ្មែរ',
    tags: ['instrument', 'world-music', 'cambodian'], seed: 114, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 330), 0.65],
        [osc(0.9, 660), 0.25],
        [osc(0.9, 990), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'khloy-khmer', km: 'ខ្លុយខ្មែរ',
    tags: ['instrument', 'world-music', 'cambodian'], seed: 115, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 440), 0.65],
        [osc(0.9, 880), 0.25],
        [osc(0.9, 1320), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'chhing', km: 'ឈឹងខ្មែរ',
    tags: ['instrument', 'world-music', 'cambodian'], seed: 116, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 880), 0.65],
        [osc(0.9, 1760), 0.25],
        [osc(0.9, 2640), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'skor-thom', km: 'ស្គរធំខ្មែរ',
    tags: ['instrument', 'world-music', 'cambodian'], seed: 117, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 110), 0.65],
        [osc(0.9, 220), 0.25],
        [osc(0.9, 330), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'sralai', km: 'ស្រឡៃខ្មែរ',
    tags: ['instrument', 'world-music', 'cambodian'], seed: 118, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 587), 0.65],
        [osc(0.9, 1174), 0.25],
        [osc(0.9, 1761), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'sampho', km: 'សម្ភោរ',
    tags: ['instrument', 'world-music', 'cambodian'], seed: 119, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 147), 0.65],
        [osc(0.9, 294), 0.25],
        [osc(0.9, 441), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'takhe', km: 'តាខេថៃ',
    tags: ['instrument', 'world-music', 'thai'], seed: 120, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 392), 0.65],
        [osc(0.9, 784), 0.25],
        [osc(0.9, 1176), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'ranat-thai', km: 'រនាតថៃ',
    tags: ['instrument', 'world-music', 'thai'], seed: 121, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 523), 0.65],
        [osc(0.9, 1046), 0.25],
        [osc(0.9, 1569), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'khene', km: 'ខែនឡាវ',
    tags: ['instrument', 'world-music', 'lao'], seed: 122, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 330), 0.65],
        [osc(0.9, 660), 0.25],
        [osc(0.9, 990), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'dan-bau', km: 'ដាន់បៅវៀតណាម',
    tags: ['instrument', 'world-music', 'vietnamese'], seed: 123, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 440), 0.65],
        [osc(0.9, 880), 0.25],
        [osc(0.9, 1320), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'gayageum', km: 'កាយ៉ាគឹមកូរ៉េ',
    tags: ['instrument', 'world-music', 'korean'], seed: 124, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 392), 0.65],
        [osc(0.9, 784), 0.25],
        [osc(0.9, 1176), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'geomungo', km: 'គូមុងហ្គោកូរ៉េ',
    tags: ['instrument', 'world-music', 'korean'], seed: 125, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 294), 0.65],
        [osc(0.9, 588), 0.25],
        [osc(0.9, 882), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'shamisen', km: 'សាមីសែនជប៉ុន',
    tags: ['instrument', 'world-music', 'japanese'], seed: 126, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 440), 0.65],
        [osc(0.9, 880), 0.25],
        [osc(0.9, 1320), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'shakuhachi', km: 'សាគូហាជិជប៉ុន',
    tags: ['instrument', 'world-music', 'japanese'], seed: 127, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 523), 0.65],
        [osc(0.9, 1046), 0.25],
        [osc(0.9, 1569), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'taiko', km: 'ស្គរតៃកូជប៉ុន',
    tags: ['instrument', 'world-music', 'japanese'], seed: 128, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 100), 0.65],
        [osc(0.9, 200), 0.25],
        [osc(0.9, 300), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'sheng', km: 'សេងចិន',
    tags: ['instrument', 'world-music', 'chinese'], seed: 129, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 587), 0.65],
        [osc(0.9, 1174), 0.25],
        [osc(0.9, 1761), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'dizi', km: 'ឌីជីខ្លុយចិន',
    tags: ['instrument', 'world-music', 'chinese'], seed: 130, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 659), 0.65],
        [osc(0.9, 1318), 0.25],
        [osc(0.9, 1977), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'yangqin', km: 'យ៉ាងឈីនចិន',
    tags: ['instrument', 'world-music', 'chinese'], seed: 131, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 392), 0.65],
        [osc(0.9, 784), 0.25],
        [osc(0.9, 1176), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'pipa', km: 'ពីប៉ាចិន',
    tags: ['instrument', 'world-music', 'chinese'], seed: 132, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 494), 0.65],
        [osc(0.9, 988), 0.25],
        [osc(0.9, 1482), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'bansuri', km: 'បាន់សូរីឥណ្ឌា',
    tags: ['instrument', 'world-music', 'indian'], seed: 133, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 523), 0.65],
        [osc(0.9, 1046), 0.25],
        [osc(0.9, 1569), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'tabla', km: 'តាប្លាឥណ្ឌា',
    tags: ['instrument', 'world-music', 'indian'], seed: 134, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 160), 0.65],
        [osc(0.9, 320), 0.25],
        [osc(0.9, 480), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'tanpura', km: 'តានពូរ៉ាឥណ្ឌា',
    tags: ['instrument', 'world-music', 'indian'], seed: 135, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 146), 0.65],
        [osc(0.9, 292), 0.25],
        [osc(0.9, 438), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'mridangam', km: 'ម្រីដាំងហ្គាំ',
    tags: ['instrument', 'world-music', 'indian'], seed: 136, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 180), 0.65],
        [osc(0.9, 360), 0.25],
        [osc(0.9, 540), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'sarod', km: 'សារ៉ូដឥណ្ឌា',
    tags: ['instrument', 'world-music', 'indian'], seed: 137, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 330), 0.65],
        [osc(0.9, 660), 0.25],
        [osc(0.9, 990), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'veena', km: 'វីណាឥណ្ឌា',
    tags: ['instrument', 'world-music', 'indian'], seed: 138, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 392), 0.65],
        [osc(0.9, 784), 0.25],
        [osc(0.9, 1176), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'rebab', km: 'រេបាប',
    tags: ['instrument', 'world-music', 'middle-east'], seed: 139, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 294), 0.65],
        [osc(0.9, 588), 0.25],
        [osc(0.9, 882), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'ney-flute', km: 'ខ្លុយនេយ',
    tags: ['instrument', 'world-music', 'middle-east'], seed: 140, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 440), 0.65],
        [osc(0.9, 880), 0.25],
        [osc(0.9, 1320), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'qanun', km: 'កានូន',
    tags: ['instrument', 'world-music', 'middle-east'], seed: 141, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 523), 0.65],
        [osc(0.9, 1046), 0.25],
        [osc(0.9, 1569), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'darbuka', km: 'ដារប៊ូកា',
    tags: ['instrument', 'world-music', 'middle-east'], seed: 142, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 180), 0.65],
        [osc(0.9, 360), 0.25],
        [osc(0.9, 540), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'kora', km: 'កូរ៉ាអាហ្វ្រិក',
    tags: ['instrument', 'world-music', 'african'], seed: 143, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 392), 0.65],
        [osc(0.9, 784), 0.25],
        [osc(0.9, 1176), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'mbira', km: 'មប៊ីរ៉ា',
    tags: ['instrument', 'world-music', 'african'], seed: 144, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 587), 0.65],
        [osc(0.9, 1174), 0.25],
        [osc(0.9, 1761), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'djembe', km: 'ស្គរជេមបេ',
    tags: ['instrument', 'world-music', 'african'], seed: 145, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 120), 0.65],
        [osc(0.9, 240), 0.25],
        [osc(0.9, 360), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'talking-drum', km: 'ស្គរនិយាយអាហ្វ្រិក',
    tags: ['instrument', 'world-music', 'african'], seed: 146, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 160), 0.65],
        [osc(0.9, 320), 0.25],
        [osc(0.9, 480), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'balafon', km: 'បាឡាហ្វុន',
    tags: ['instrument', 'world-music', 'african'], seed: 147, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 494), 0.65],
        [osc(0.9, 988), 0.25],
        [osc(0.9, 1482), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'udu-drum', km: 'ស្គរអ៊ូឌូ',
    tags: ['instrument', 'world-music', 'african'], seed: 148, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 100), 0.65],
        [osc(0.9, 200), 0.25],
        [osc(0.9, 300), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'berimbau', km: 'បេរីមបៅ',
    tags: ['instrument', 'world-music', 'brazilian'], seed: 149, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 220), 0.65],
        [osc(0.9, 440), 0.25],
        [osc(0.9, 660), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'cuatro', km: 'គួត្រូ',
    tags: ['instrument', 'world-music', 'latin'], seed: 150, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 392), 0.65],
        [osc(0.9, 784), 0.25],
        [osc(0.9, 1176), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'charango', km: 'ឆារ៉ង់ហ្គោ',
    tags: ['instrument', 'world-music', 'latin'], seed: 151, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 440), 0.65],
        [osc(0.9, 880), 0.25],
        [osc(0.9, 1320), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'bandoneon', km: 'បង់ដូនេអុង',
    tags: ['instrument', 'world-music', 'latin'], seed: 152, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 330), 0.65],
        [osc(0.9, 660), 0.25],
        [osc(0.9, 990), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'steelpan', km: 'ស្គរដែកស្ទីលផែន',
    tags: ['instrument', 'world-music', 'caribbean'], seed: 153, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 523), 0.65],
        [osc(0.9, 1046), 0.25],
        [osc(0.9, 1569), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'marimba', km: 'ម៉ារីមបា',
    tags: ['instrument', 'world-music', 'percussion'], seed: 154, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 392), 0.65],
        [osc(0.9, 784), 0.25],
        [osc(0.9, 1176), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'vibraphone', km: 'វីប្រាហ្វូន',
    tags: ['instrument', 'world-music', 'percussion'], seed: 155, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 587), 0.65],
        [osc(0.9, 1174), 0.25],
        [osc(0.9, 1761), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'xylophone', km: 'ស៊ីឡូហ្វូន',
    tags: ['instrument', 'world-music', 'percussion'], seed: 156, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 659), 0.65],
        [osc(0.9, 1318), 0.25],
        [osc(0.9, 1977), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'harmonica', km: 'ហាម៉ូនីកា',
    tags: ['instrument', 'world-music', 'modern'], seed: 157, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 440), 0.65],
        [osc(0.9, 880), 0.25],
        [osc(0.9, 1320), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'accordion', km: 'អាក់ខ័រឌីអុង',
    tags: ['instrument', 'world-music', 'modern'], seed: 158, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 392), 0.65],
        [osc(0.9, 784), 0.25],
        [osc(0.9, 1176), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'synth-lead', km: 'សំឡេងស៊ីនធីសាយស័រលីដ',
    tags: ['instrument', 'world-music', 'electronic'], seed: 159, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 659), 0.65],
        [osc(0.9, 1318), 0.25],
        [osc(0.9, 1977), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },

  { cat: 'music', name: 'synth-pad', km: 'សំឡេងស៊ីនធីសាយស័រផេដ',
    tags: ['instrument', 'world-music', 'electronic'], seed: 160, gen(r) {
      const out = buf(1.8);
      const tone = mix(
        [osc(0.9, 220), 0.65],
        [osc(0.9, 440), 0.25],
        [osc(0.9, 660), 0.10]
      );
      place(out, tone, 0.25, 0.65);
      return out;
    }
  },
];
