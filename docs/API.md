# IQ-AI API v1

All routes except health need: `Authorization: Bearer <IQAI_TOKEN>`.
Responses: `{ "ok": bool, "data": ..., "error": null | { "code", "message" } }`

| Method | Path | Purpose |
|---|---|---|
| GET | /api/v1/health | Service status (public) |
| GET | /api/v1/capabilities | What is installed (ffmpeg, Khmer font, C++), which features are ready, option lists for the UI |
| GET | /ui | Sound Studio page (`public/`, no token needed to load; the page asks for one) |
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

## Sound library: core routes
| Method | Path | Purpose |
|---|---|---|
| GET | /api/v1/sounds?q=&category=&tag=&favorite=&limit= | Search the library |
| POST | /api/v1/sounds/upload | Raw audio body; metadata in `X-Filename`, `X-Category`, `X-Tags`, `X-Source`, `X-License` (percent-encoded) |
| GET | /api/v1/sounds/:id | Metadata |
| GET | /api/v1/sounds/:id/content | Audio bytes (`?download=1` forces download) |
| DELETE | /api/v1/sounds/:id | Delete (token) |
| GET | /api/v1/audio/health | Audio feature flags |

## Audio edit
`POST /api/v1/audio/edit` is documented in docs/AUDIO.md (trim, fade, reverse, normalize, denoise, removeSilence).

## Inspect (read file info, nothing is stored)
| Method | Path | Body -> result |
|---|---|---|
| POST | /api/v1/audio/inspect | WAV (max 20 MB) -> sample rate, channels, duration |
| POST | /api/v1/images/inspect | PNG/JPEG/GIF/WebP -> width, height |
| POST | /api/v1/videos/inspect | MP4/WebM -> width, height, duration |

## Emotion
| Method | Path | Purpose |
|---|---|---|
| POST | /api/v1/emotion/analyze | JSON `{"text":"..."}` -> emotion. Rule-based (Khmer keywords, negation, emoji); body max 64 KB |

## Video generation (ffmpeg, no AI model)
Full details in docs/VIDEO.md.

| Method | Path | Purpose |
|---|---|---|
| GET | /api/v1/videos/effects | Photo effects and sfx types |
| POST | /api/v1/videos/photo?effect=&durationSec=&width=&height=&sfx= | Raw image -> mp4 (`X-Applied` header lists applied settings) |
| POST | /api/v1/videos/text | JSON `{"text",...}` -> mp4 |

| POST | /api/v1/videos/edit?trimStart=&trimEnd=&speed=&mute=&width=&height= | Raw MP4/WebM -> mp4 (trim, speed, mute, resize) |
| POST | /api/v1/videos/thumbnail?at=&width= | Raw MP4/WebM -> JPEG frame |
| POST | /api/v1/videos/audio | Raw MP4/WebM -> WAV (mono 44.1 kHz) |

Extra error codes: 415 wrong image/video type, 400 `bad_video` (cannot be decoded), 422 `video_processing_failed`, 503 `ffmpeg_missing`.
The `/images|audio|videos/process` routes stay 501 (reserved for a future AI provider).

## Background jobs
`POST/GET /api/v1/jobs`, `GET/DELETE /api/v1/jobs/:id` run `video.edit` and `video.merge` in the background (queue, cancel, survives restart). See [JOBS.md](JOBS.md).
