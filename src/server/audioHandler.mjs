import { createStorage } from '../audio/storage.mjs';
import { soundsRoutes, json } from './routes/sounds.routes.mjs';
import { audioRoutes } from './routes/audio.routes.mjs';

// Mount into an existing server: if (await audio(req, res)) return;
export async function createAudioHandler({
  dataDir = process.env.AUDIO_DATA_DIR || './data/audio',
  token = process.env.AUDIO_API_TOKEN || '',
  maxBytes = Number(process.env.AUDIO_MAX_BYTES) || 25 * 1024 * 1024,
} = {}) {
  const storage = createStorage(dataDir);
  await storage.init();
  const sounds = soundsRoutes({ storage, token, maxBytes });
  const audio = audioRoutes();
  return async function audioHandler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    const isSounds = p.startsWith('/api/v1/sounds');
    if (!isSounds && !p.startsWith('/api/v1/audio')) return false;
    try { await (isSounds ? sounds : audio)(req, res, url); }
    catch { if (!res.headersSent) json(res, 500, { error: 'internal_error' }); else res.destroy(); }
    return true;
  };
}
