# IQ-AI

Standalone media service: other apps upload, store and fetch audio, image and video over an HTTP API.

## Run
    cp .env.example .env    # then set IQAI_TOKEN
    npm start
    npm test

Default port is 8799 (8787 is used by another local service).

## Status
Working: health, upload, download (with Range for audio/video seeking), list, rename, delete,
type and size validation, bearer-token auth, Khmer/Unicode filenames, tests.
Metadata read on upload: image width/height (png, jpeg, gif, webp), wav duration/format, mp4 duration/size.
Not done yet: thumbnails, ogg/mp3/webm duration, job queue, neural image/audio/video generation
(the /process endpoints return 501), per-user ownership (auth is one shared token), TTS (still 501).

## Video generation (no AI model, ffmpeg only — free, fully offline)
`/api/v1/videos/photo` (image -> zoom-in/zoom-out mp4, optional sfx) and `/api/v1/videos/text`
(Khmer/Unicode text, word-wrapped, -> mp4, optional sfx). See docs/VIDEO.md.

See docs/API.md.

## Audio tools
Voice changer (`/api/v1/audio/voice`), generated sound effects (`/api/v1/audio/sfx`) and a TTS stub
(`/api/v1/audio/tts`, 501). Voice changer needs ffmpeg. See docs/AUDIO.md.
Other endpoints: `emotion/analyze` and `audio|images|videos/inspect` (see docs/API.md).
