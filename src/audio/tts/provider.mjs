// Text-to-speech provider. OFF by default: returns 501 until IQAI_TTS=edge is set.
// Contract used by the route: { ok:true, buf } (WAV bytes) or { ok:false, status, code, message }.
import { PRESETS } from '../voice/presets.mjs';
import { changeVoice } from '../voice/changeVoice.mjs';
import { edgeTtsToWav, TTS_LANGS } from './edgeTts.mjs';

export const TTS_LIMITS = { maxChars: 1000 };
export const ttsEnabled = () => process.env.IQAI_TTS === 'edge';

const defaults = { enabled: ttsEnabled, edge: edgeTtsToWav, voice: changeVoice };
const bad = (message) => ({ ok: false, status: 400, code: 'bad_request', message });

// body: { text, lang?: 'km', voice?: <preset id from /api/v1/audio/voices> }
// deps is only for tests (inject fake engines so no network is needed).
export async function synthesizeSpeech(body = {}, deps = {}) {
  const d = { ...defaults, ...deps };
  if (!d.enabled()) {
    return {
      ok: false, status: 501, code: 'provider_not_configured',
      message: 'No text-to-speech provider is configured yet (optional online engine: set IQAI_TTS=edge)',
    };
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return bad('Field "text" is required');
  if (text.length > TTS_LIMITS.maxChars) return bad(`Field "text" is limited to ${TTS_LIMITS.maxChars} characters`);
  const lang = body.lang ?? 'km';
  if (!TTS_LANGS.includes(lang)) return bad(`Unsupported lang. Use one of: ${TTS_LANGS.join(', ')}`);
  const voice = body.voice === undefined || body.voice === null || body.voice === '' ? null : String(body.voice);
  if (voice && !Object.hasOwn(PRESETS, voice)) return bad('Unknown voice. See GET /api/v1/audio/voices');

  let wav;
  try {
    wav = await d.edge(text, lang);
  } catch (e) {
    const missing = e && e.code === 'engine_missing';
    console.error('tts error:', e && (e.detail || e.message));
    return missing
      ? { ok: false, status: 503, code: 'tts_engine_missing', message: 'Install the engine: pip install edge-tts' }
      : { ok: false, status: 502, code: 'tts_upstream_failed', message: 'The text-to-speech engine failed or is offline' };
  }
  if (voice) {
    try {
      const r = await d.voice(wav, { preset: voice });
      if (!r.ok) return bad(r.message);
      wav = r.buf;
    } catch (e) {
      console.error('tts voice error:', e && (e.detail || e.message));
      return { ok: false, status: 422, code: 'audio_processing_failed', message: 'Could not apply the voice' };
    }
  }
  return { ok: true, buf: wav };
}
