# Background jobs

Long work (a 90-minute story is many clips + encodes) cannot fit in one HTTP request. A job is started,
returns at once with an id, and the client polls it. Foundation for the story-video phases.
Same token as every other `/api/v1/*` route.

| Method | Route | What |
|---|---|---|
| POST | `/api/v1/jobs` | `{"type":"video.edit","params":{...}}` → **202** + job |
| GET | `/api/v1/jobs` | `{ items, types }`, newest first |
| GET | `/api/v1/jobs/:id` | one job |
| DELETE | `/api/v1/jobs/:id` | queued/running → `cancelled` (ffmpeg is killed); finished → removed |

## Job object
`id`, `type`, `status` (`queued` · `running` · `done` · `failed` · `cancelled`), `progress` (0..1; coarse: 0 → 0.05 → 1,
there is no per-frame progress yet), `params`, `result`, `error {code,message}`, `createdAt`, `startedAt`, `finishedAt`.

`error.message` is always a short, clean sentence. ffmpeg output and file paths stay in the server log only.

## Types
| type | params | result |
|---|---|---|
| `video.edit` | `mediaId`, optional `trimStart` `trimEnd` `speed` `mute` `width` `height` (same rules as `/videos/edit`) | `{ mediaId, size, applied }` |
| `video.merge` | `ids` (2..20 media ids), optional `width` `height` `fps` (same rules as `/videos/merge`) | `{ mediaId, size, applied }` |
| `video.mix` | `mediaId` (video), `narrationId` and/or `musicId` (**audio** media items: wav/ogg/mp3); optional `narrationVolume` (1) `musicVolume` (0.25) `originalVolume` (0 = drop the video's own sound) `duck` (true) `fadeIn` `fadeOut` (seconds) | `{ mediaId, size, applied }` |
| `video.subtitle` | `mediaId` (video) and `cues: [{start,end,text}]` (seconds) **or** `srt` (SubRip text); optional `fontSize` `color` (#RRGGBB) `boxOpacity` (0..1) `position` (`bottom`\|`middle`\|`top`) | `{ mediaId, size, applied }` |

Inputs are **media items** (upload with `POST /api/v1/media`). The result is also a media item, so download it with
`GET /api/v1/media/:mediaId/content` (supports `Range`) or use it as the input of the next job (chaining).
Job inputs may be up to 200 MB in total (the direct routes keep their 50/150 MB limits).

## Example
```sh
J=$(curl -s -X POST -H "Authorization: Bearer $IQAI_TOKEN" -H 'Content-Type: application/json' \
  -d '{"type":"video.merge","params":{"ids":["<id1>","<id2>"]}}' http://127.0.0.1:8799/api/v1/jobs)
# poll: GET /api/v1/jobs/<id> until status is done, then GET /api/v1/media/<result.mediaId>/content
```
(Never paste the token into chat or commit it.)

## Audio mix and subtitles (Phases 3 and 4)
- `video.mix`: narration starts at 0, music loops to the video length, **ducking** lowers the music while the narration speaks,
  the result is exactly as long as the video (longer audio is cut). The picture is copied (mp4) or re-encoded (webm).
  At least one of `narrationId` / `musicId` is required.
- `video.subtitle`: burnt in with ffmpeg `drawtext` and the same Khmer font as text videos (`KHMER_FONT`, Noto Sans Khmer).
  Lines are wrapped by Khmer display cluster, at most 3 lines per cue, at most **300 cues per call**: for a long story
  add subtitles scene by scene, then merge (`video.merge`). `applied.truncatedCues` counts cues that did not fit in 3 lines.
  Khmer shaping needs ffmpeg built with harfbuzz (the same requirement as `/videos/text`).
  **Fonts:** Noto Sans Khmer has no Latin letters, so a cue that contains Khmer uses the Khmer font and any other cue uses a
  Latin font (`LATIN_FONT=/path.ttf`, else Roboto / Noto Sans / DejaVu from the usual folders). A cue that **mixes** Khmer and
  Latin uses the Khmer font, so its Latin letters do not show; `applied.mixedCues` counts them. Keep Latin names (e.g. KHOEM-AI)
  in their own cue.

## Behaviour
- **One job at a time** by default (`JOBS_CONCURRENCY=1`); others wait. More than `JOBS_MAX_QUEUE` waiting → **429 `queue_full`**.
- Jobs are saved to `JOBS_DIR` (`./data/jobs`, git-ignored). After a restart finished jobs are still there; a job that was
  queued or running is marked `failed` with code `interrupted` (it is not resumed).
- Finished jobs are forgotten after `JOBS_TTL_HOURS` (24). The result media item is **not** deleted; remove it with `DELETE /api/v1/media/:id`.
- Stopping the server cancels running jobs and kills their ffmpeg.
- The old placeholder `GET /api/v1/jobs/:id` → 404 in `process.mjs` is untouched; the jobs route is mounted before it.

## Adding a job type (next phases)
Add an `async ({ params, signal, setProgress }) => result` to `src/jobs/handlers.mjs`; pass `signal` to
`runFfmpegArgs(args, { signal })` so DELETE can stop it. Throw `jobError(message, code)` for bad input.

## Not done yet
Per-frame progress, resuming after a restart, a job screen in the AI app.

## Narrated story (`video.story`)
`params`: `scenes:[{imageId?,text?,seconds?,say?,voice?}]`, optional `voice` (default narrator), `secondsPerScene`, `width`, `height`, `effect`, `transition`, `fontSize`, `textColor`, `bgColor`, `sfx`, `audioId`, `narrationVolume`, `musicVolume`, `duck`.
- A scene is a stored photo (optional caption) or a text card. `say` is spoken by `voice` (a voice id from `GET /audio/voices`); the scene lasts at least as long as its line (+0.3 s lead, +0.8 s tail, max 60 s per scene).
- With any `say`, `sfx` / `audioId` plays as music under the voice (ducked while speaking). The speech engine is off until `IQAI_TTS=edge` (needs internet); without it the job fails with the message "No text-to-speech provider is configured yet".
