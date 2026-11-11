// Voice presets. pitch = semitones, speed = tempo multiplier, fx = extra ffmpeg filters.
// These are DSP effects (pitch/tempo/filters). They are not neural voice cloning.
export const PRESETS = {
  // --- basic voices
  male:         { label: 'Male (lower)',        pitch: -4,  speed: 1,    fx: [] },
  deep:         { label: 'Deep voice',          pitch: -7,  speed: 0.97, fx: [] },
  female:       { label: 'Female (higher)',     pitch: 4,   speed: 1,    fx: [] },
  child:        { label: 'Child',               pitch: 7,   speed: 1.05, fx: [] },
  elder:        { label: 'Elder',               pitch: -2,  speed: 0.92, fx: ['vibrato=f=5:d=0.15'] },
  helium:       { label: 'Helium',              pitch: 9,   speed: 1.05, fx: [] },
  chipmunk:     { label: 'Chipmunk',            pitch: 12,  speed: 1.1,  fx: [] },
  // --- creatures / spooky
  ghost:        { label: 'Ghost',               pitch: -2,  speed: 0.9,  fx: ['highpass=f=200', 'vibrato=f=4:d=0.4', 'aecho=0.8:0.88:600|1100:0.4|0.3'] },
  demon:        { label: 'Demon',               pitch: -10, speed: 0.9,  fx: ['lowpass=f=2500', 'tremolo=f=8:d=0.3', 'aecho=0.8:0.88:30:0.5'] },
  giant:        { label: 'Giant / monster',     pitch: -9,  speed: 0.9,  fx: ['aecho=0.8:0.88:40:0.3'] },
  alien:        { label: 'Alien',               pitch: 3,   speed: 1,    fx: ['tremolo=f=50:d=0.8', 'vibrato=f=10:d=0.5'] },
  robot:        { label: 'Robot',               pitch: -1,  speed: 1,    fx: ['tremolo=f=40:d=0.7', 'aecho=0.8:0.9:8|16:0.5|0.3'] },
  small_animal: { label: 'Small animal-like',   pitch: 10,  speed: 1.12, fx: ['vibrato=f=7:d=0.25'] },
  big_animal:   { label: 'Big animal-like',     pitch: -10, speed: 0.88, fx: ['lowpass=f=3500'] },
  // --- places / devices
  underwater:   { label: 'Underwater',          pitch: 0,   speed: 1,    fx: ['lowpass=f=700', 'vibrato=f=3:d=0.3', 'aecho=0.8:0.7:20:0.3'] },
  telephone:    { label: 'Telephone',           pitch: 0,   speed: 1,    fx: ['highpass=f=400', 'lowpass=f=3400', 'acrusher=bits=8:mix=0.5'] },
  radio:        { label: 'Radio / walkie',      pitch: 0,   speed: 1,    fx: ['highpass=f=300', 'lowpass=f=3000', 'acompressor'] },
  megaphone:    { label: 'Megaphone',           pitch: 0,   speed: 1,    fx: ['highpass=f=500', 'lowpass=f=4000', 'acompressor', 'volume=1.5'] },
  hall:         { label: 'Big hall echo',       pitch: 0,   speed: 1,    fx: ['aecho=0.8:0.7:60|120:0.4|0.25'] },
  cave:         { label: 'Cave',                pitch: 0,   speed: 1,    fx: ['aecho=0.8:0.9:200|400|600:0.4|0.3|0.2'] },
  stadium:      { label: 'Stadium',             pitch: 0,   speed: 1,    fx: ['aecho=0.8:0.8:80|160|320|640:0.3|0.25|0.2|0.15'] },
  chorus:       { label: 'Chorus (many voices)', pitch: 0,  speed: 1,    fx: ['chorus=0.7:0.9:55:0.4:0.25:2'] },
};


// --- 36 natural voices: 2 genders x 9 ages/roles x 2 characters (soft / firm).
// Each aims at an absolute pitch (f0, Hz) and vocal-tract size (formant, semitones, adult male = 0), so they sound
// different from each other whatever the input voice is. Same table format as above (label, pitch, speed, fx);
// pitch here is only the fallback when the input pitch cannot be measured (assumes a 120 Hz male input).
const ASSUMED_F0 = 120;
const AGES = [
  { id: 'toddler', km: ['កូនប្រុសតូច', 'កូនស្រីតូច'], en: ['little boy', 'little girl'], f0: [380, 425], formant: [7.3, 8.3], speed: 1.08, fx: ['highpass=f=250', 'equalizer=f=3200:t=q:w=1:g=3'] },
  { id: 'child', km: ['ក្មេងប្រុស', 'ក្មេងស្រី'], en: ['boy', 'girl'], f0: [279, 347], formant: [6.1, 5.4], speed: 1.05, fx: ['highpass=f=180', 'equalizer=f=3000:t=q:w=1:g=2.5'] },
  { id: 'nephew', km: ['ក្មួយប្រុស', 'ក្មួយស្រី'], en: ['nephew', 'niece'], f0: [170, 311], formant: [4.5, 4.1], speed: 1.04, fx: ['highpass=f=120', 'equalizer=f=2800:t=q:w=1:g=1.5'] },
  { id: 'younger', km: ['ប្អូនប្រុស', 'ប្អូនស្រី'], en: ['younger brother', 'younger sister'], f0: [130, 280], formant: [2.2, 2.9], speed: 1.03, fx: ['highpass=f=90'] },
  { id: 'young', km: ['វ័យកំលោះ', 'កញ្ញា'], en: ['young man', 'young woman'], f0: [133, 219], formant: [-0.1, 3.5], speed: 1.02, fx: ['highpass=f=80', 'equalizer=f=3000:t=q:w=1:g=1'] },
  { id: 'older', km: ['បងប្រុស', 'បងស្រី'], en: ['older brother', 'older sister'], f0: [98, 194], formant: [-0.9, 3.9], speed: 1, fx: ['equalizer=f=250:t=q:w=1:g=1.5'] },
  { id: 'middle', km: ['បុរសវ័យកណ្តាល', 'ស្ត្រីវ័យកណ្តាល'], en: ['middle-aged man', 'middle-aged woman'], f0: [86, 203], formant: [-0.3, 1.9], speed: 0.98, fx: ['equalizer=f=200:t=q:w=1:g=2'] },
  { id: 'uncle', km: ['ពូ', 'មីង'], en: ['uncle', 'aunt'], f0: [75, 146], formant: [0.3, 1.7], speed: 0.95, fx: ['equalizer=f=180:t=q:w=1:g=2', 'treble=g=-1.5:f=4500', 'vibrato=f=5.2:d=0.04'] },
  { id: 'elder', km: ['តា', 'យាយ'], en: ['grandfather', 'grandmother'], f0: [157, 121], formant: [-1, 3.1], speed: 0.88, fx: ['highpass=f=100', 'equalizer=f=150:t=q:w=1:g=1', 'treble=g=-3.5:f=4000', 'vibrato=f=5.6:d=0.12'] },
];
const CHARACTERS = [
  { id: 'soft', km: 'ទន់ភ្លន់', en: 'soft', f0: 0.9, formant: -0.4, speed: 0.96, fx: ['treble=g=-2:f=5000', 'bass=g=1.5:f=250'] },
  { id: 'firm', km: 'រឹងមាំ', en: 'firm', f0: 1.1, formant: 0.4, speed: 1.05, fx: ['equalizer=f=2400:t=q:w=1:g=3', 'acompressor=threshold=0.1:ratio=3'] },
];
const round1 = (v) => Math.round(v * 10) / 10;
for (const [g, gender] of ['male', 'female'].entries()) {
  for (const age of AGES) {
    for (const ch of CHARACTERS) {
      const f0 = Math.round(age.f0[g] * ch.f0);
      PRESETS[`${gender}_${age.id}_${ch.id}`] = {
        label: `${age.km[g]} (${ch.km}) · ${age.en[g]}, ${ch.en}`,
        pitch: Math.max(-12, Math.min(12, Math.round(12 * Math.log2(f0 / ASSUMED_F0)))),
        speed: Math.round(age.speed * ch.speed * 1000) / 1000,
        fx: [...age.fx, ...ch.fx],
        f0,
        formant: round1(age.formant[g] + ch.formant),
        natural: true,
      };
    }
  }
}
export const NATURAL_VOICES = Object.keys(PRESETS).filter((k) => PRESETS[k].natural);

export const LIMITS = { pitch: [-12, 12], speed: [0.5, 2], volume: [0, 4] };

// Editing options accepted together with (or without) a preset.
export const EDIT_OPTIONS = {
  trimStart: 'seconds to cut from the start (0..3600)',
  trimEnd: 'keep audio until this second (> trimStart)',
  fadeIn: 'fade-in seconds (0..30)',
  fadeOut: 'fade-out seconds (0..30)',
  reverse: 'true = play backwards',
  normalize: 'true = even out loudness',
  denoise: 'true = reduce steady background noise',
  removeSilence: 'true = cut silence at the start',
};
