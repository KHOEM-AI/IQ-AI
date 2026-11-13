# Video: photo and text to mp4 (ffmpeg only, no AI model)

No neural network, no network call, no cost — built on ffmpeg's `zoompan` and `drawtext` filters,
the same way the audio voice changer uses ffmpeg's audio filters.

| Method | Path | Purpose |
|---|---|---|
| GET | /api/v1/videos/effects | List photo effects and sfx types |
| POST | /api/v1/videos/photo?effect=&durationSec=&width=&height=&sfx= | Raw PNG/JPEG/WEBP/GIF in -> mp4 out |
| POST | /api/v1/videos/text | JSON `{"text","durationSec","width","height","fontSize","bgColor","textColor","sfx"}` -> mp4 |

## Photo -> video
`effect`: `zoom-in` (default) or `zoom-out`. `durationSec` 1..20 (default 5). `width`/`height` 320..1280
(default 720x720, rounded to even). `sfx` optional, one of the sound-effect types (see `/audio/sfx`).

## Text -> video
Khmer and other Unicode text is word-wrapped automatically and centered, using the system's
Noto Sans Khmer font, rendered through ffmpeg's drawtext (libfreetype/libfribidi/libharfbuzz —
needed for correct Khmer glyph shaping). `durationSec` 1..20 (default 5), `width`/`height` 320..1280
(default 720x1280), `fontSize` 16..120 (default 48), `bgColor`/`textColor` as `#RRGGBB`, `sfx` optional.
Text over the available space is truncated (not scrolled) — `applied.truncated` in the response headers
notes this.

## Examples
    curl -X POST -H "Authorization: Bearer $IQAI_TOKEN" -H "Content-Type: image/png" \
      --data-binary @photo.png "http://localhost:8799/api/v1/videos/photo?effect=zoom-in&sfx=wind" -o out.mp4

    curl -X POST -H "Authorization: Bearer $IQAI_TOKEN" -H "Content-Type: application/json" \
      -d '{"text":"សួស្តី","durationSec":5,"sfx":"rain"}' \
      http://localhost:8799/api/v1/videos/text -o out.mp4

## Connecting a real AI video model later
This is intentionally simple and free. For actual generative video (text/image -> AI-generated
motion), a cloud provider (paid, needs network) or a very large local model (impractical on a
phone) would be required — out of scope here. These endpoints can stay as a free fallback either way.

## Edit an existing video
Raw MP4 or WebM in (max 50 MB), ffmpeg only. All routes need the token and ffmpeg.

| Method | Path | Result |
|---|---|---|
| POST | /api/v1/videos/edit?trimStart=&trimEnd=&speed=&mute=&width=&height= | mp4 (H.264 + AAC) |
| POST | /api/v1/videos/thumbnail?at=&width= | JPEG |
| POST | /api/v1/videos/audio | WAV, mono 44.1 kHz |

`edit` parameters (all optional, combine freely; with none it just re-encodes to H.264/AAC mp4):
- `trimStart`, `trimEnd` — seconds on the **source** timeline (0..3600, `trimEnd` > `trimStart`).
- `speed` — 0.5..2 (audio is tempo-adjusted too).
- `mute` — `true` drops the audio track. A video with no audio simply stays silent.
- `width`, `height` — 160..1920, rounded to even. Give one and the other keeps the aspect ratio.

`thumbnail`: `at` seconds (default 0), `width` 64..1280 (default 320). `audio` returns 422 when the video has no audio track.

The `X-Applied` response header lists what was applied. Errors: 400 `bad_params`, 400 `bad_video`
(cannot be decoded; also when `trimStart` is past the end), 415 not MP4/WebM, 422 `video_processing_failed`, 503 `ffmpeg_missing`.

    curl -X POST -H "Authorization: Bearer $IQAI_TOKEN" --data-binary @in.mp4 \
      "http://localhost:8799/api/v1/videos/edit?trimStart=1&trimEnd=4&speed=1.5&width=480" -o out.mp4
    curl -X POST -H "Authorization: Bearer $IQAI_TOKEN" --data-binary @in.mp4 \
      "http://localhost:8799/api/v1/videos/thumbnail?at=2&width=320" -o thumb.jpg

## Story video from scenes
`POST /api/v1/videos/story` JSON `{"scenes":[{"imageId"?,"text"?,"seconds"?}, ...],"secondsPerScene"?,"width"?,"height"?,"effect"?,"transition"?:"fade|none","fontSize"?,"textColor"?,"bgColor"?,"sfx"?,"audioId"?}` -> mp4. `GET` lists the limits.
- A scene is a stored photo (with an optional caption) or a text card. 1..30 scenes, 1..60 s each, 900 s in total.
- `transition` `fade` fades each scene in and out through black. One sound (`sfx`, or a stored `audioId` that is looped) plays under the whole video with a fade in/out.
- Errors: 400 `bad_params`/`bad_image`/`bad_audio`/`too_long`, 404, 413, 415, 422 `video_processing_failed`, 503 `ffmpeg_missing`/`font_missing`.
