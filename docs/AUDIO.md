# Audio: voice changer, editing, sound effects, TTS

All routes need `Authorization: Bearer <IQAI_TOKEN>`. Voice changer and editing need `ffmpeg` (Termux: `pkg install ffmpeg`).

| Method | Path | Purpose |
|---|---|---|
| GET | /api/v1/audio/voices | Presets, limits and edit options |
| POST | /api/v1/audio/voice?preset=ghost&... | Raw WAV/OGG/MP3 in (max 20 MB) -> WAV out (mono, 44.1 kHz) |
| POST | /api/v1/audio/edit?trimStart=1&... | Same endpoint, for editing without a preset |
| GET | /api/v1/audio/sfx | List sound-effect types |
| POST | /api/v1/audio/sfx | JSON `{"type":"engine","durationSec":3}` -> WAV |
| POST | /api/v1/audio/tts | JSON `{"text":"..."}` -> 501 until a provider is connected |

## Voice presets
- Basic: male, deep, female, child, elder, helium, chipmunk
- Creatures: ghost, demon, giant, alien, robot, small_animal, big_animal
- Places and devices: underwater, telephone, radio, megaphone, hall, cave, stadium, chorus

Override any preset with `pitch` (semitones -12..12), `speed` (0.5..2), `volume` (0..4).

## Editing options (combine freely, with or without a preset)
`trimStart`, `trimEnd` (seconds, cut), `fadeIn`, `fadeOut` (seconds), `reverse`, `normalize`,
`denoise`, `removeSilence` (true/false). Order applied: trim, denoise, silence, pitch/speed,
preset effects, reverse, fades, normalize, volume, limiter.

These are DSP effects, not neural voice cloning. Animal and ghost voices are effect approximations.

## 36 natural voices (male/female x 9 ages/roles x soft/firm)
Ids look like `male_uncle_soft`, `female_young_firm` (list: `GET /api/v1/audio/voices`, entries with `natural: true`).
Roles: little child, child, nephew/niece, younger brother/sister, young man/woman, older brother/sister,
middle-aged, uncle/aunt (ពូ/មីង), grandfather/grandmother (តា/យាយ).

Each voice aims at its own absolute pitch (`f0`) and vocal-tract size (`formant`), so the result does not depend on who
recorded the input. The pitch of the input is measured automatically (`sourceF0` can be passed to skip that).
Pitch is moved with ffmpeg `rubberband` (voice keeps its natural tone); without it, it falls back to the older
`asetrate` method (less natural). Best input: one clear voice, no music/noise, 2+ seconds.

    # one recording in -> 36 files out (voices36/01_male_toddler_soft.wav ... + index.json)
    node scripts/voiceAll.mjs my-voice.wav voices36
    # or a single voice
    curl -X POST -H "Authorization: Bearer $IQAI_TOKEN" --data-binary @in.wav \
      "http://localhost:8799/api/v1/audio/voice?preset=female_uncle_firm" -o out.wav

Limits: these are DSP transformations of ONE recording, so pronunciation and rhythm stay the speaker's own. Shifts
larger than ~12 semitones (e.g. a low male voice -> little girl) sound less natural. Truly independent speakers need a
text-to-speech provider (`src/audio/tts/provider.mjs`), which is still not connected.

## Sound effects (generated, no model needed)
engine, horn, siren, beep, wind, rain, hammer, drill. `durationSec` 0.1..30, optional `seed`.
Your own library of recorded sounds stays under `/api/v1/sounds`.

## Examples
    curl -X POST -H "Authorization: Bearer $IQAI_TOKEN" --data-binary @in.wav \
      "http://localhost:8799/api/v1/audio/voice?preset=ghost&fadeOut=1" -o out.wav
    curl -X POST -H "Authorization: Bearer $IQAI_TOKEN" --data-binary @in.wav \
      "http://localhost:8799/api/v1/audio/edit?trimStart=2&trimEnd=8&normalize=true&denoise=true" -o cut.wav

## Connecting TTS / voice cloning later
Edit `src/audio/tts/provider.mjs` (`synthesizeSpeech`). Return `{ ok:true, buf }` with WAV bytes.
