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
Not done yet: thumbnails, ogg/mp3/webm duration, job queue, AI image/audio/video processing
(the process endpoints return 501), per-user ownership (auth is one shared token).

See docs/API.md.
