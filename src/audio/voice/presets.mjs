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
