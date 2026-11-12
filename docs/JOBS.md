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
