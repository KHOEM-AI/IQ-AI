# IQ-AI

Standalone media service: other apps upload, store and fetch audio, image and video over an HTTP API.

## Run
    cp .env.example .env    # then set IQAI_TOKEN
    npm start
    npm test

Default port is 8799 (8787 is used by another local service).

## Status
Working: health, upload, metadata, download, list, delete, validation, bearer-token auth, tests.
Not connected yet: AI image/audio/video processing. The process endpoints return 501.
Auth is a single shared token (no per-user ownership yet).

See docs/API.md.
