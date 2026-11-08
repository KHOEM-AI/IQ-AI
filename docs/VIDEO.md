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
