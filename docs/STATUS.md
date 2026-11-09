# IQ-AI · ស្ថានភាព និងភាគរយ (Status)

_Updated: 2026-11-09 · based on repo `main` @ `b72e74e` (114 tests)_

## 🎯 Overall progress

> ### ≈ 53 % of the planned IQ-AI scope
>
> `█████████████░░░░░░░░░░░░` 53 / 100

This is an **estimate**, not a measurement. The weights below are a judgement of how much
each part matters; change them if your priorities differ and recompute.

| # | Area | Weight | Done | Score | Evidence |
|---|---|---:|---:|---:|---|
| 1 | Media storage + API + auth | 15 | 95 % | 14.25 | upload/list/Range/rename/delete, validation, tests |
| 2 | Sound library (CRUD, search, edit, favorites) | 15 | 90 % | 13.5 | `/api/v1/sounds*`, `soundEdit` tests |
| 3 | Real sound content | 15 | 5 % | 0.75 | 209 **synthetic** seed sounds vs 10,000 stage‑1 goal |
| 4 | Audio tools (voice, edit, sfx) | 10 | 90 % | 9.0 | 22 presets, `audioVoice` tests |
| 5 | Video (photo/text → mp4, ffmpeg) | 10 | 80 % | 8.0 | `videoGenerate`, `videoFixes` tests |
| 6 | Emotion + inspect | 5 | 70 % | 3.5 | text only; no audio/image emotion |
| 7 | UI | 10 | 40 % | 4.0 | `public/sound-studio.html`; Create panel lives in `AI` repo |
| 8 | AI providers (TTS, recognition, generative) | 15 | 0 % | 0 | all `501` |
| 9 | Jobs, thumbnails, multi-user | 5 | 0 % | 0 | not started |
| | **Total** | **100** | | **53.0** | |

Reading the number: the **offline, no-AI core is mostly finished (≈ 85–90 %)**.
What holds the total down is real content (area 3) and AI providers (area 8) — both need
data or paid/cloud services, not just code.

## ✅ Verified

- `npm test` on `main`: **114 pass, 0 fail** (Termux, from your log).
- Routes mounted on the main server: audio voice/inspect/sfx, sounds, media, emotion,
  image/video inspect, video photo/text.
- `main` pushed to `origin/main` (`745e127..b72e74e`).

## ⚠️ Known issues / things to check

| Item | Detail | Status |
|---|---|---|
| Fresh clone: seed test fails | Seed `.wav` files are git-ignored; `tests/soundSeed.test.mjs` needs them. Run `node scripts/generateSeedSounds.mjs` first. | verified (reproduced) |
| Khmer text-video tests need a font | `text: renders a Khmer-text mp4` fails without Noto Sans Khmer + ffmpeg `drawtext` with harfbuzz. Passes on your Termux. | verified (reproduced) |
| `docs/NOTES.md` is stale in places | still says video "❌ 501"; that is only true for `/videos/process`. Generation is at `/videos/photo` and `/videos/text`. | verified |
| `docs/API.md` was incomplete | missing video, emotion, inspect, sound CRUD routes — fixed in this update. | fixed |
| `.bak*` and `IQ-AI-FILES.txt` clutter | `.bak*` is git-ignored; `IQ-AI-FILES.txt` is untracked — delete it or add it to `.gitignore`. | verified |
| Sound Studio page auth | `public/sound-studio.html` lists sounds without an `Authorization` header, but the server requires one. It presumably works through the Vite `/iqai` proxy that adds the token. | **assumption — not verified** |
| No `tsconfig`/typecheck | Not needed (plain `.mjs`); only the `AI` repo has `typecheck`. | verified |

## 🧭 Next steps (suggested order)

1. **Real sounds** — use `scripts/importRealSounds.mjs` (needs `source` + `license` per file); first 100 recordings.
2. **UI hook** — finish wiring the `AI` UI to emotion, inspect and sound edit endpoints.
3. **Thumbnails + ogg/mp3/webm duration** (ffmpeg is already a dependency).
4. **TTS** — implement `synthesizeSpeech` in `src/audio/tts/provider.mjs` (one function; contract in [AUDIO.md](AUDIO.md)).
5. **Jobs + per-user ownership** — only when more than one app/user needs it.

## 🔁 How to update this page

1. Run `npm test` and note pass/fail.
2. Change the **Done** column of the table above.
3. Recompute `Score = Weight × Done` and the total.
4. Update the date and commit hash in the header.
