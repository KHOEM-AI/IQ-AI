# IQ-AI on Termux · ការដំឡើងលើ Termux

## 1. Requirements

```bash
pkg update
pkg install nodejs git curl ffmpeg
node -v          # needs Node 22+ (uses --env-file-if-exists)
ffmpeg -version | head -n 1
```

`ffmpeg` is needed for the voice changer, audio edit and video generation.
Without it those routes return `503 ffmpeg_missing`; everything else still works.

## 2. Configure

```bash
cd ~/IQ-AI
cp .env.example .env
# generate a token and put it in .env (value is not printed to the screen)
sed -i "s/^IQAI_TOKEN=.*/IQAI_TOKEN=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')/" .env
grep -c '^IQAI_TOKEN=' .env     # should print 1
```

The same token must be set in `~/ai-project/AI/.env` (the Vite `/iqai` proxy reads it).
Never paste the token into chat or commit `.env`.

| Variable | Default | Meaning |
|---|---|---|
| `HOST` | `127.0.0.1` | bind address |
| `PORT` | `8799` | port |
| `IQAI_TOKEN` | — | required bearer token |
| `MEDIA_STORAGE_DIR` | `./data/media` | uploaded media |
| `AUDIO_DATA_DIR` | `./data/audio` | sound library |
| `MAX_UPLOAD_BYTES` | `52428800` | 50 MB upload limit |
| `CORS_ORIGIN` | empty | allowed browser origin |

## 3. Run

```bash
./ai.sh start      # background, waits until healthy
./ai.sh status     # port, ffmpeg, token, log path
./ai.sh logs 40
./ai.sh stop
./ai.sh run        # foreground (Ctrl+C stops)
```

Health check (public):

```bash
curl -s http://127.0.0.1:8799/api/v1/health
```

## 4. Seed sounds

Seed `.wav` files are generated, not committed:

```bash
node scripts/generateSeedSounds.mjs     # writes 209 sounds into sounds/seed/
./ai.sh start                           # the importer needs the server running
node scripts/importSeedSounds.mjs       # uploads them to the library, skips ones already imported
```

The importer reads the token from `IQAI_TOKEN` or from `~/.iqai-token`
(`IQAI_URL` overrides the default `http://127.0.0.1:8799`). See [SOUND_SEED.md](SOUND_SEED.md).

Run this before `npm test` on a fresh clone, otherwise `soundSeed.test.mjs` fails.

## 5. Khmer text video

`/api/v1/videos/text` needs the **Noto Sans Khmer** font and an ffmpeg built with
libfreetype + libharfbuzz (for correct Khmer glyph shaping).
If you get `font_missing`, check the font path in `src/video/textToVideo.mjs` (`KHMER_FONT`).

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401 unauthorized` | missing/wrong token | send `Authorization: Bearer <IQAI_TOKEN>` |
| `503 ffmpeg_missing` | ffmpeg not installed | `pkg install ffmpeg` |
| `501 provider_not_configured` | TTS / generative AI not connected | expected, see [STATUS](STATUS.md) |
| `font_missing` | Khmer font not found | install Noto Sans Khmer, check `KHMER_FONT` |
| port in use | another service on 8799 | `./ai.sh stop` or set `IQAI_PORT` |
| no `/tmp` | Termux | use `$PREFIX/tmp` |

## 7. Safe push checklist

```bash
cd ~/IQ-AI
git status -sb                  # what changed?
git diff --check                # whitespace errors
npm test                        # all tests
git diff                        # read the whole diff
git add README.md docs/         # add by file name, never `git add .`
git commit -m "docs: status, termux guide, complete API"
git log origin/main..main --oneline    # what will be pushed
git push origin main
```

Do not bypass Git hooks. If a check fails, fix the cause first.
