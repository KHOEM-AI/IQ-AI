# IQ-AI API v1

All routes except health need: `Authorization: Bearer <IQAI_TOKEN>`.
Responses: `{ "ok": bool, "data": ..., "error": null | { "code", "message" } }`

| Method | Path | Purpose |
|---|---|---|
| GET | /api/v1/health | Service status (public) |
| POST | /api/v1/media | Upload raw bytes; Content-Type must be the file type |
| GET | /api/v1/media | List media |
| GET | /api/v1/media/:id | Metadata |
| GET | /api/v1/media/:id/content | Download bytes (supports `Range: bytes=...`) |
| PATCH | /api/v1/media/:id | Rename: JSON body `{ "filename": "new.png" }` |
| DELETE | /api/v1/media/:id | Delete |
| POST | /api/v1/images/process | 501 until a provider is connected |
| POST | /api/v1/audio/process | 501 until a provider is connected |
| POST | /api/v1/videos/process | 501 until a provider is connected |

Supported types: png, jpeg, gif, webp, wav, ogg, mpeg (mp3), mp4, webm.
The file content must match the declared Content-Type.

## Metadata
Every media item has `info`, filled on upload with whatever could be read:
- images (png, jpeg, gif, webp): `width`, `height`
- wav: `durationSec`, `sampleRate`, `channels`, `bitsPerSample`
- mp4: `durationSec`, `width`, `height`
- ogg, mp3, webm: `info` is `{}` for now

## Filenames
Send `X-Filename` percent-encoded (`encodeURIComponent`). Letters and digits from any language
are kept (Khmer included); other characters become `_`. Download uses `filename*=UTF-8''...`.

## Errors
400 invalid or empty body, 401 bad token, 404 unknown id, 413 too large, 415 wrong or mismatched type,
416 bad Range, 501 no processor connected.

Upload example:

    curl -X POST -H "Authorization: Bearer $IQAI_TOKEN" -H "Content-Type: image/png" \
      -H "X-Filename: a.png" --data-binary @a.png http://localhost:8799/api/v1/media

## Audio voice / sfx / tts
Full details in docs/AUDIO.md.

| Method | Path | Purpose |
|---|---|---|
| GET | /api/v1/audio/voices | Voice presets and limits |
| POST | /api/v1/audio/voice?preset=&pitch=&speed=&volume= | Raw WAV/OGG/MP3 -> WAV |
| GET | /api/v1/audio/sfx | Sound-effect types |
| POST | /api/v1/audio/sfx | `{"type","durationSec"}` -> WAV |
| POST | /api/v1/audio/tts | 501 until a provider is connected |

## Sound library: edit, categories, favorites

| Method | Path | Purpose |
|---|---|---|
| PATCH | /api/v1/sounds/:id | JSON body with any of `name`, `category`, `tags`, `source`, `license`, `favorite`. Needs token. Returns the updated record |
| GET | /api/v1/sounds/categories | `{"items":[...]}` categories accepted by upload and PATCH |
| GET | /api/v1/sounds?favorite=true | Only favorites (combine with `q`, `category`, `tag`, `limit`) |

Errors: 400 `invalid_field` (with `message`), 400 `bad_json`, 404 `not_found`, 413 `too_large` (body over 64 KB).
`id`, `mime`, `size`, `format` and `createdAt` can not be changed.
