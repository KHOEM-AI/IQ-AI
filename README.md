<div align="center">

# 🎧 IQ-AI

**Standalone media service — សំឡេង · រូបភាព · វីដេអូ · សញ្ញាអារម្មណ៍**

Other apps upload, store, edit and fetch audio, image and video over one HTTP API.
Runs fully offline on a phone (Termux) — no cloud, no cost.

`Node 22+` · `ffmpeg` · `port 8799` · `114 tests`

</div>

---

## ⚡ Quick start

```bash
cd ~/IQ-AI
cp .env.example .env          # then set IQAI_TOKEN to a long random string
npm start                     # or: ./ai.sh start
npm test
```

Default port is **8799** (8787 is used by another local service).
First time on Termux? See [docs/TERMUX.md](docs/TERMUX.md).

## ✅ What works today

| Area | Features | Docs |
|---|---|---|
| 📦 **Media** | upload, list, download (Range), rename, delete, type/size validation, Khmer filenames | [API](docs/API.md) |
| 🔊 **Sound library** | 10 categories, search, tags, favorites, PATCH edit, 209 synthetic seed sounds | [SOUND_SEED](docs/SOUND_SEED.md) · [TAXONOMY](docs/SOUND_TAXONOMY.md) |
| 🎙️ **Audio tools** | voice changer (22 presets), edit (trim/fade/denoise/…), generated sfx | [AUDIO](docs/AUDIO.md) |
| 🎬 **Video** | photo → zoom mp4, Khmer text → mp4, optional sfx (ffmpeg only) | [VIDEO](docs/VIDEO.md) |
| 🧠 **Emotion** | rule-based Khmer text emotion (6 emotions, negation, emoji) | [API](docs/API.md) |
| 🔍 **Inspect** | read info from audio / image / video files | [API](docs/API.md) |
| 🔐 **Auth** | bearer token on every route except health | [API](docs/API.md) |

## 🚧 Not done yet

- Real AI providers: TTS (`/audio/tts` → 501), generative image/audio/video (`/…/process` → 501)
- Real recorded sounds (library is synthetic; goal is 10,000 licensed sounds)
- Thumbnails, ogg/mp3/webm duration, job queue
- Per-user ownership (one shared token)

Progress and plan: **[docs/STATUS.md](docs/STATUS.md)**.

## 🗺️ Where it fits

IQ-AI is one part of KHOEM-AI. The UI (`AI` repo) calls it through the Vite proxy
`/iqai` → `http://127.0.0.1:8799/api/v1`. See [docs/SYSTEM_MAP.md](docs/SYSTEM_MAP.md).

## 📚 Documentation

| File | Content |
|---|---|
| [docs/STATUS.md](docs/STATUS.md) | Progress %, what is done, next steps |
| [docs/TERMUX.md](docs/TERMUX.md) | Setup, ffmpeg, Khmer font, seed sounds, troubleshooting, push checklist |
| [docs/API.md](docs/API.md) | Every HTTP route |
| [docs/AUDIO.md](docs/AUDIO.md) | Voice changer, editing, sfx, TTS hook |
| [docs/VIDEO.md](docs/VIDEO.md) | Photo/text → video |
| [docs/SOUND_LIBRARY_PLAN.md](docs/SOUND_LIBRARY_PLAN.md) · [SOUND_TAXONOMY.md](docs/SOUND_TAXONOMY.md) · [SOUND_SEED.md](docs/SOUND_SEED.md) | Sound library plan |
| [docs/SYSTEM_MAP.md](docs/SYSTEM_MAP.md) | How all KHOEM-AI repos connect |
| [docs/NOTES.md](docs/NOTES.md) | Developer notes (Khmer) |

## 🔒 Security

- `.env` and `data/` are git-ignored — never commit a token.
- Set a real `IQAI_TOKEN`; `ai.sh status` warns if it is still the placeholder.
- Server binds to `127.0.0.1` by default.
