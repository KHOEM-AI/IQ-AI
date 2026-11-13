import { ok, fail, readBody } from '../respond.mjs';
import { synthesizeDialogue, DIALOGUE_LIMITS } from '../../audio/dialogue.mjs';

// POST /api/v1/audio/dialogue
// JSON {"lines":[{"text":"សួស្តី","voice":"male_uncle_firm","speaker":"ពូ","pauseMs":300}, ...], "gapMs":350}
// -> one audio/wav; header X-Timings = JSON [{index,voice,startMs,endMs}] (ASCII only, so a video can follow the lines).
// GET lists the limits. Voices: GET /api/v1/audio/voices (36 natural voices have natural:true).
export async function handleAudioDialogue(req, res, p) {
  if (p !== '/api/v1/audio/dialogue') return false;
  if (req.method === 'GET') { ok(res, 200, { limits: DIALOGUE_LIMITS }); return true; }
  if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
  let body;
  try {
    const raw = (await readBody(req, 64 * 1024)).toString('utf8');
    body = raw ? JSON.parse(raw) : {};
  } catch (e) {
    if (e && e.code === 'too_large') throw e;
    fail(res, 400, 'bad_request', 'Body must be JSON: {"lines":[{"text":"...","voice":"..."}]}');
    return true;
  }
  const r = await synthesizeDialogue(body);
  if (!r.ok) { fail(res, r.status, r.code, r.message); return true; }
  const timings = r.timings.map(({ index, voice, startMs, endMs }) => ({ index, voice, startMs, endMs }));
  res.writeHead(200, {
    'Content-Type': 'audio/wav',
    'Content-Length': r.buf.length,
    'X-Content-Type-Options': 'nosniff',
    'X-Timings': JSON.stringify(timings),
  });
  res.end(r.buf);
  return true;
}
