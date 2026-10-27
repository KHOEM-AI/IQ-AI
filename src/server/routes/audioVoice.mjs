import { ok, fail, readBody } from '../respond.mjs';
import { PRESETS, LIMITS, EDIT_OPTIONS } from '../../audio/voice/presets.mjs';
import { changeVoice } from '../../audio/voice/changeVoice.mjs';
import { ffmpegAvailable } from '../../audio/ffmpeg.mjs';
import { sniffMime } from '../../media/validation.mjs';
import { SFX_TYPES, SFX_LIMITS, synthSfx } from '../../audio/sfx/synth.mjs';
import { synthesizeSpeech } from '../../audio/tts/provider.mjs';

const MAX_AUDIO = 20 * 1024 * 1024;
const AUDIO_MIMES = new Set(['audio/wav', 'audio/ogg', 'audio/mpeg']);

function sendWav(res, buf, extra = {}) {
  res.writeHead(200, {
    'Content-Type': 'audio/wav',
    'Content-Length': buf.length,
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  });
  res.end(buf);
}

async function jsonBody(req) {
  const raw = (await readBody(req, 64 * 1024)).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export async function handleAudioVoice(req, res, p) {
  if (p === '/api/v1/audio/voices') {
    if (req.method !== 'GET') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
    const presets = Object.entries(PRESETS).map(([id, v]) => ({ id, label: v.label, pitch: v.pitch, speed: v.speed }));
    ok(res, 200, { presets, limits: LIMITS, editOptions: EDIT_OPTIONS, note: 'DSP effects (pitch/tempo/filters), not neural voice cloning' });
    return true;
  }

  if (p === '/api/v1/audio/voice' || p === '/api/v1/audio/edit') {
    if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
    if (!(await ffmpegAvailable())) { fail(res, 503, 'ffmpeg_missing', 'ffmpeg is not installed (Termux: pkg install ffmpeg)'); return true; }
    const q = new URL(req.url, 'http://localhost').searchParams;
    const buf = await readBody(req, MAX_AUDIO);
    if (!buf.length) { fail(res, 400, 'empty_body', 'Request body is empty'); return true; }
    if (!AUDIO_MIMES.has(sniffMime(buf))) { fail(res, 415, 'unsupported_type', 'Body must be WAV, OGG or MP3 audio'); return true; }
    try {
      const opts = {};
      for (const k of ['preset', 'pitch', 'speed', 'volume', 'trimStart', 'trimEnd', 'fadeIn', 'fadeOut', 'reverse', 'normalize', 'denoise', 'removeSilence']) {
        if (q.has(k)) opts[k] = q.get(k);
      }
      const r = await changeVoice(buf, opts);
      if (!r.ok) { fail(res, 400, 'bad_params', r.message); return true; }
      sendWav(res, r.buf, { 'X-Applied': JSON.stringify(r.applied) });
    } catch (e) {
      console.error('voice error:', e && (e.detail || e.message));
      fail(res, 422, 'audio_processing_failed', 'Could not process this audio');
    }
    return true;
  }

  if (p === '/api/v1/audio/sfx') {
    if (req.method === 'GET') { ok(res, 200, { types: SFX_TYPES, limits: SFX_LIMITS }); return true; }
    if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
    let body;
    try { body = await jsonBody(req); }
    catch (e) {
      if (e && e.code === 'too_large') throw e;
      fail(res, 400, 'bad_request', 'Body must be JSON: {"type":"engine","durationSec":3}'); return true;
    }
    const r = synthSfx(body);
    if (!r.ok) { fail(res, 400, 'bad_params', r.message); return true; }
    sendWav(res, r.buf);
    return true;
  }

  if (p === '/api/v1/audio/tts') {
    if (req.method !== 'POST') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
    let body;
    try { body = await jsonBody(req); }
    catch (e) {
      if (e && e.code === 'too_large') throw e;
      fail(res, 400, 'bad_request', 'Body must be JSON: {"text":"..."}'); return true;
    }
    if (typeof body.text !== 'string' || !body.text.trim()) { fail(res, 400, 'bad_request', 'Field "text" is required'); return true; }
    const r = await synthesizeSpeech(body);
    if (!r.ok) { fail(res, r.status, r.code, r.message); return true; }
    sendWav(res, r.buf);
    return true;
  }
  return false;
}
