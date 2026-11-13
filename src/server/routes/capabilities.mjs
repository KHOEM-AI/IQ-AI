import { ok, fail } from '../respond.mjs';
import { ffmpegAvailable } from '../../audio/ffmpeg.mjs';
import { nativeAvailable } from '../../native/cppEngine.mjs';
import { khmerFontAvailable, KHMER_FONT } from '../../video/textToVideo.mjs';
import { PRESETS } from '../../audio/voice/presets.mjs';
import { EFFECTS } from '../../video/photoToVideo.mjs';
import { SFX_TYPES } from '../../audio/sfx/synth.mjs';
import { EMOTIONS } from '../../emotion/analyze.mjs';
import { CATEGORIES } from '../../audio/validation.mjs';

// One call the UI makes on load: what is installed, what each feature needs, what is still 501.
// GET /api/v1/capabilities
export async function handleCapabilities(req, res, p, ctx) {
  if (p !== '/api/v1/capabilities') return false;
  if (req.method !== 'GET') { fail(res, 405, 'method_not_allowed', 'Method not allowed'); return true; }
  const ffmpeg = await ffmpegAvailable();
  const font = khmerFontAvailable();
  const feat = (ready, needs = []) => ({ ready, needs: ready ? [] : needs });
  ok(res, 200, {
    service: 'iq-ai',
    version: '0.2.0',
    limits: { maxUploadBytes: ctx.config.maxUploadBytes, maxVideoBytes: 50 * 1024 * 1024, maxImageBytes: 15 * 1024 * 1024 },
    system: { ffmpeg, khmerFont: font, khmerFontPath: font ? KHMER_FONT : null, nativeCpp: nativeAvailable },
    features: {
      media: feat(true),
      sounds: feat(true),
      emotion: feat(true),
      inspect: feat(true),
      audioVoice: feat(ffmpeg, ['ffmpeg']),
      audioSfx: feat(true),
      audioEdit: feat(ffmpeg, ['ffmpeg']),
      videoPhoto: feat(ffmpeg, ['ffmpeg']),
      videoText: feat(ffmpeg && font, [!ffmpeg && 'ffmpeg', !font && 'khmerFont'].filter(Boolean)),
      videoEdit: feat(ffmpeg, ['ffmpeg']),
      videoMerge: feat(ffmpeg, ['ffmpeg']),
      tts: feat(false, ['provider']),
      aiGenerate: feat(false, ['provider']),
    },
    options: {
      voicePresets: Object.keys(PRESETS),
      photoEffects: EFFECTS,
      sfxTypes: SFX_TYPES,
      emotions: EMOTIONS,
      soundCategories: CATEGORIES,
    },
  });
  return true;
}
