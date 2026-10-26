export function loadConfig(env = process.env) {
  return {
    host: env.HOST || '127.0.0.1',
    port: Number(env.PORT) || 8799,
    storageDir: env.MEDIA_STORAGE_DIR || './data/media',
    maxUploadBytes: Number(env.MAX_UPLOAD_BYTES) || 52428800,
    token: env.IQAI_TOKEN || '',
    corsOrigin: env.CORS_ORIGIN || '',
  };
}
