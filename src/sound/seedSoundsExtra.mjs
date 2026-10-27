// Extra synthetic seed sounds (approximations, not recordings). Uses the 10 taxonomy slugs only.
import { noise, osc, lp, hp, bp, mul, mix, place, buf, voice } from './synth.mjs';

const TAU = 2 * Math.PI;
const dec = (k) => (t) => Math.exp(-k * t);
const win = (d) => (t) => Math.sin((Math.PI * Math.min(t, d)) / d);
const env = (d, a = 0.03, r = 0.08) => (t) => Math.max(0, Math.min(1, t / a, (d - t) / r));
const swell = (p) => (t) => 0.15 + 0.85 * Math.pow(Math.max(0, Math.sin((TAU * t) / p)), 2);
const lcg = (s) => { let x = s >>> 0; return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296; };
const AH = [[800, 5, 1], [1150, 6, 0.6], [2900, 8, 0.2]];
const RF = [[900, 5, 1], [2200, 6, 0.5]];

const crowd = (d, r, n, g = 0.25) => {
  const out = buf(d);
  for (let k = 0; k < n; k++) {
    place(out, mul(voice(d, 105 + k * 19, AH, r, 0.5), (t) => 0.5 + 0.5 * Math.sin(TAU * (1.1 + k * 0.37) * t + k)), 0, g);
  }
  return out;
};
const engine = (d, r, hz, f) => {
  const out = buf(d);
  for (let at = 0; at < d - 0.1; at += 1 / hz) {
    place(out, mul(mix([osc(0.09, f), 0.8], [lp(noise(0.09, r), 500), 0.5]), dec(28)), at, 0.8);
  }
  return out;
};

export const EXTRA_SOUNDS = [
  // animals
  { cat: 'animals', name: 'cat-meow', km: 'សំឡេងឆ្មាយំ', tags: ['cat', 'meow'], seed: 1001, gen(r) {
    const d = 0.8;
    return mul(voice(d, (t) => 420 + 380 * Math.sin((Math.PI * t) / d), [[900, 5, 1], [2400, 6, 0.5]], r, 0.04), win(d));
  } },
  { cat: 'animals', name: 'rooster-crow', km: 'សំឡេងមាន់រងាវ', tags: ['rooster', 'bird', 'morning'], seed: 1002, gen(r) {
    const out = buf(2);
    place(out, mul(voice(0.3, (t) => 480 + 500 * (t / 0.3), RF, r, 0.05), win(0.3)), 0.1);
    place(out, mul(voice(0.3, 700, RF, r, 0.05), win(0.3)), 0.45);
    place(out, mul(voice(0.9, (t) => 760 - 280 * (t / 0.9) + 18 * Math.sin(TAU * 28 * t), RF, r, 0.05), win(0.9)), 0.8);
    return out;
  } },
  { cat: 'animals', name: 'frog-croak', km: 'សំឡេងកង្កែបយំ', tags: ['frog', 'croak', 'night'], seed: 1003, gen(r) {
    const out = buf(1.6);
    for (let k = 0; k < 6; k++) place(out, mul(voice(0.12, 110, [[400, 6, 1], [1200, 8, 0.4]], r, 0.2), win(0.12)), 0.1 + k * 0.2);
    return out;
  } },
  { cat: 'animals', name: 'cow-moo', km: 'សំឡេងគោយំ', tags: ['cow', 'moo', 'farm'], seed: 1004, gen(r) {
    return mul(voice(1.5, (t) => 120 + 25 * Math.sin((Math.PI * t) / 1.5), [[500, 5, 1], [900, 6, 0.6]], r, 0.08), win(1.5));
  } },
  { cat: 'animals', name: 'duck-quack', km: 'សំឡេងទាយំ', tags: ['duck', 'quack', 'bird'], seed: 1005, gen(r) {
    const out = buf(1.2);
    for (const at of [0.1, 0.5, 0.85]) place(out, mul(voice(0.18, (t) => 400 - 90 * (t / 0.18), [[1000, 4, 1], [2000, 5, 0.6]], r, 0.25), win(0.18)), at);
    return out;
  } },
  { cat: 'animals', name: 'owl-hoot', km: 'សំឡេងទីទុយយំ', tags: ['owl', 'hoot', 'night'], seed: 1006, gen(r) {
    const out = buf(2);
    for (const at of [0.1, 0.65, 1.3]) place(out, mul(voice(0.4, (t) => 340 - 30 * (t / 0.4), [[420, 8, 1], [900, 8, 0.2]], r, 0.02), win(0.4)), at);
    return out;
  } },

  // vehicles
  { cat: 'vehicles', name: 'car-horn', km: 'សំឡេងហ៊ីនរថយន្ត', tags: ['car', 'horn'], seed: 1011, gen() {
    return mul(mix([osc(1, 440), 0.5], [osc(1, 554), 0.5]), env(1));
  } },
  { cat: 'vehicles', name: 'motorcycle-idle', km: 'សំឡេងម៉ូតូដំណើរការ', tags: ['motorcycle', 'engine', 'idle'], seed: 1012, gen(r) {
    return engine(2.2, r, 9, 75);
  } },
  { cat: 'vehicles', name: 'car-passby', km: 'សំឡេងរថយន្តបើកកាត់', tags: ['car', 'passby', 'road'], seed: 1013, gen(r) {
    return mul(mix([lp(noise(3.5, r), 900), 0.6], [osc(3.5, (t) => 150 - 50 * (t / 3.5)), 0.4]), (t) => Math.exp(-((t - 1.75) ** 2) / 0.6));
  } },
  { cat: 'vehicles', name: 'train-horn', km: 'សំឡេងស៊ីផ្លេរថភ្លើង', tags: ['train', 'horn'], seed: 1014, gen() {
    return mul(mix([osc(1.8, 311), 0.4], [osc(1.8, 370), 0.4], [osc(1.8, 466), 0.3]), env(1.8, 0.05, 0.2));
  } },
  { cat: 'vehicles', name: 'helicopter-hover', km: 'សំឡេងឧទ្ធម្ភាគចក្រ', tags: ['helicopter', 'rotor'], seed: 1015, gen(r) {
    const chop = (t) => 0.5 + 0.5 * Math.sin(TAU * 16 * t);
    return mix([mul(lp(noise(3, r), 500), chop), 0.8], [mul(osc(3, 55), chop), 0.5]);
  } },
  { cat: 'vehicles', name: 'airplane-flyby', km: 'សំឡេងយន្តហោះហោះកាត់', tags: ['airplane', 'flyby', 'jet'], seed: 1016, gen(r) {
    return mul(mix([lp(noise(4, r), 1800), 0.7], [osc(4, (t) => 260 - 120 * (t / 4)), 0.2]), (t) => Math.exp(-((t - 2) ** 2) / 1.2));
  } },

  // nature
  { cat: 'nature', name: 'ocean-waves', km: 'សំឡេងរលកសមុទ្រ', tags: ['ocean', 'waves', 'sea'], seed: 1021, gen(r) {
    return mul(lp(noise(6, r), 1000), swell(3));
  } },
  { cat: 'nature', name: 'waterfall', km: 'សំឡេងទឹកជ្រោះ', tags: ['waterfall', 'water'], seed: 1022, gen(r) {
    return hp(lp(noise(3, r), 6000), 400);
  } },
  { cat: 'nature', name: 'campfire-crackle', km: 'សំឡេងភ្លើងឆេះ', tags: ['fire', 'campfire', 'crackle'], seed: 1023, gen(r) {
    const out = buf(3), q = lcg(1023);
    place(out, lp(noise(3, r), 300), 0, 0.15);
    for (let k = 0; k < 45; k++) place(out, mul(hp(noise(0.02, r), 1500), dec(150)), q() * 2.9, 0.3 + 0.7 * q());
    return out;
  } },
  { cat: 'nature', name: 'wind-gust', km: 'សំឡេងខ្យល់បក់', tags: ['wind', 'gust'], seed: 1024, gen(r) {
    return mul(bp(noise(4, r), 450, 2), swell(4));
  } },
  { cat: 'nature', name: 'heavy-rain', km: 'សំឡេងភ្លៀងធ្លាក់ខ្លាំង', tags: ['rain', 'heavy', 'weather'], seed: 1025, gen(r) {
    return hp(lp(noise(3, r), 9000), 1500);
  } },
  { cat: 'nature', name: 'thunder-rumble', km: 'សំឡេងផ្គរលាន់', tags: ['thunder', 'storm', 'weather'], seed: 1026, gen(r) {
    return mul(lp(noise(3.5, r), 160), (t) => Math.min(1, t * 20) * Math.exp(-0.9 * t) * (0.6 + 0.4 * Math.sin(TAU * 4 * t)));
  } },

  // ambience (includes city)
  { cat: 'ambience', name: 'crowd-murmur', km: 'សំឡេងហ្វូងមនុស្សនិយាយគ្នា', tags: ['crowd', 'people', 'murmur'], seed: 1031, gen(r) {
    return crowd(3, r, 8);
  } },
  { cat: 'ambience', name: 'market-bustle', km: 'សំឡេងផ្សារ', tags: ['market', 'crowd', 'city'], seed: 1032, gen(r) {
    const out = crowd(3, r, 6, 0.2), q = lcg(1032);
    for (let k = 0; k < 12; k++) place(out, mul(bp(noise(0.03, r), 2500, 3), dec(120)), q() * 2.8, 0.4);
    return out;
  } },
  { cat: 'ambience', name: 'office-typing', km: 'សំឡេងវាយក្តារចុច', tags: ['office', 'keyboard', 'typing'], seed: 1033, gen(r) {
    const out = buf(3), q = lcg(1033);
    for (let k = 0; k < 20; k++) place(out, mul(bp(noise(0.02, r), 3200, 2), dec(180)), k * 0.14 + q() * 0.05, 0.6 + 0.4 * q());
    return out;
  } },
  { cat: 'ambience', name: 'city-traffic', km: 'សំឡេងចរាចរណ៍ទីក្រុង', tags: ['city', 'traffic', 'road'], seed: 1034, gen(r) {
    return mix([mul(lp(noise(4, r), 600), swell(2.5)), 0.7], [osc(4, 70), 0.15]);
  } },
  { cat: 'ambience', name: 'school-bell', km: 'សំឡេងកណ្តឹងសាលា', tags: ['school', 'bell'], seed: 1035, gen() {
    const out = buf(3);
    const bell = mul(mix([osc(1.2, 1200), 0.5], [osc(1.2, 1810), 0.3], [osc(1.2, 2420), 0.2]), dec(3.5));
    for (const at of [0, 0.7, 1.4]) place(out, bell, at);
    return out;
  } },

  // human
  { cat: 'human', name: 'baby-cry', km: 'សំឡេងទារកយំ', tags: ['baby', 'cry', 'voice'], seed: 1041, gen(r) {
    const out = buf(3);
    for (const at of [0.1, 1.05, 2.0]) {
      place(out, mul(voice(0.8, (t) => 480 + 160 * Math.sin((Math.PI * t) / 0.8) + 12 * Math.sin(TAU * 9 * t), [[1000, 5, 1], [3000, 6, 0.5]], r, 0.1), win(0.8)), at);
    }
    return out;
  } },
  { cat: 'human', name: 'breathing', km: 'សំឡេងដកដង្ហើម', tags: ['breath', 'breathing'], seed: 1042, gen(r) {
    const out = buf(3.2);
    place(out, mul(lp(noise(1.2, r), 1800), win(1.2)), 0.2);
    place(out, mul(lp(noise(1.4, r), 1300), win(1.4)), 1.6, 0.8);
    return out;
  } },
  { cat: 'human', name: 'sigh', km: 'សំឡេងដកដង្ហើមធំ', tags: ['sigh', 'breath'], seed: 1043, gen(r) {
    return mul(bp(noise(1.6, r), 750, 1), (t) => Math.min(1, t * 6) * Math.exp(-1.8 * t));
  } },

  // synthetic (includes cinematic)
  { cat: 'synthetic', name: 'explosion-distant', km: 'សំឡេងផ្ទុះឆ្ងាយ', tags: ['explosion', 'film', 'distant'], seed: 1051, gen(r) {
    return mix(
      [mul(lp(noise(3, r), 300), (t) => Math.min(1, t * 30) * Math.exp(-1.8 * t)), 0.8],
      [mul(osc(3, (t) => 70 - 30 * Math.min(1, t)), dec(2)), 0.5],
    );
  } },
  { cat: 'synthetic', name: 'whoosh', km: 'សំឡេងបក់កាត់លឿន', tags: ['whoosh', 'transition', 'film'], seed: 1052, gen(r) {
    return mul(lp(noise(1.4, r), 3500), win(1.4));
  } },
  { cat: 'synthetic', name: 'riser', km: 'សំឡេងឡើងកម្រិត', tags: ['riser', 'tension', 'film'], seed: 1053, gen(r) {
    return mix(
      [mul(osc(3, (t) => 200 + 1800 * (t / 3) ** 2), (t) => (t / 3) ** 2), 0.5],
      [mul(hp(noise(3, r), 2000), (t) => (t / 3) ** 2), 0.3],
    );
  } },
  { cat: 'synthetic', name: 'impact-boom', km: 'សំឡេងប៉ះទង្គិចខ្លាំង', tags: ['impact', 'boom', 'film'], seed: 1054, gen(r) {
    return mix(
      [mul(osc(1.6, (t) => 95 - 55 * Math.min(1, t / 0.3)), dec(2.5)), 0.8],
      [mul(lp(noise(1.6, r), 700), dec(9)), 0.5],
    );
  } },
  { cat: 'synthetic', name: 'laser-zap', km: 'សំឡេងឡាស៊ែរ', tags: ['laser', 'zap', 'game'], seed: 1055, gen() {
    return mul(osc(0.45, (t) => 200 + 2400 * Math.exp(-9 * t)), dec(5));
  } },
  { cat: 'synthetic', name: 'scifi-drone', km: 'សំឡេងបែបវិទ្យាសាស្ត្រប្រឌិត', tags: ['drone', 'scifi', 'ambient'], seed: 1056, gen() {
    return mul(mix([osc(4, 55), 0.5], [osc(4, 55.7), 0.5], [osc(4, 110.4), 0.25]), win(4));
  } },
  { cat: 'synthetic', name: 'magic-sparkle', km: 'សំឡេងវេទមន្តចែងចាំង', tags: ['magic', 'sparkle', 'fantasy'], seed: 1057, gen() {
    const out = buf(1.6);
    for (let k = 0; k < 14; k++) place(out, mul(osc(0.18, 1500 + ((k * 7) % 9) * 220), dec(16)), 0.05 + k * 0.085, 0.8 - k * 0.04);
    return out;
  } },
];
