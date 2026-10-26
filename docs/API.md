# IQ-AI API v1

All routes except health need: `Authorization: Bearer <IQAI_TOKEN>`.
Responses: `{ "ok": bool, "data": ..., "error": null | { "code", "message" } }`

| Method | Path | Purpose |
|---|---|---|
| GET | /api/v1/health | Service status (public) |
| POST | /api/v1/media | Upload raw bytes; Content-Type must be the file type |
| GET | /api/v1/media | List media |
| GET | /api/v1/media/:id | Metadata |
| GET | /api/v1/media/:id/content | Download bytes |
| DELETE | /api/v1/media/:id | Delete |
| POST | /api/v1/images/process | 501 until a provider is connected |
| POST | /api/v1/audio/process | 501 until a provider is connected |
| POST | /api/v1/videos/process | 501 until a provider is connected |

Supported types: png, jpeg, gif, webp, wav, ogg, mpeg (mp3), mp4, webm.
The file content must match the declared Content-Type.

Upload example:

    curl -X POST -H "Authorization: Bearer $IQAI_TOKEN" -H "Content-Type: image/png" \
      -H "X-Filename: a.png" --data-binary @a.png http://localhost:8799/api/v1/media

## Emotion (rule-based, Khmer text)

| Method | Path | Purpose |
|---|---|---|
| POST | /api/v1/emotion/analyze | Body `{"text":"..."}` -> `{emotion, confidence, scores, matched}` |

Emotions: joy, sadness, anger, fear, love, surprise, neutral.

## Audio inspect

| Method | Path | Purpose |
|---|---|---|
| POST | /api/v1/audio/inspect | Raw WAV bytes (max 20 MB) -> `{sampleRate, channels, bitsPerSample, durationSec, dataBytes}` |

## Image inspect

| Method | Path | Purpose |
|---|---|---|
| POST | /api/v1/images/inspect | Raw PNG/JPEG/GIF/WebP bytes (max 20 MB) -> `{format, width, height, bytes}` |

## Video inspect

| Method | Path | Purpose |
|---|---|---|
| POST | /api/v1/videos/inspect | Raw MP4/WebM bytes (max 50 MB) -> `{format, width, height, durationSec, bytes}` |
