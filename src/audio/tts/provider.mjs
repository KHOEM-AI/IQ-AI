// Text-to-speech and neural voice cloning need a real provider (cloud API or local model).
// Connect one here: return { ok:true, buf } (WAV bytes) or { ok:false, status, code, message }.
export async function synthesizeSpeech(/* { text, voice, lang } */) {
  return {
    ok: false,
    status: 501,
    code: 'provider_not_configured',
    message: 'No text-to-speech provider is configured yet',
  };
}
