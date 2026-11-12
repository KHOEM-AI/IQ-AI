export function loadConfig(env = process.env) {
  return {
    host: env.HOST || '127.0.0.1',
    port: Number(env.PORT) || 8799,
    storageDir: env.MEDIA_STORAGE_DIR || './data/media',
    audioStorageDir: env.AUDIO_DATA_DIR || './data/audio',
    maxUploadBytes: Number(env.MAX_UPLOAD_BYTES) || 52428800,
    token: env.IQAI_TOKEN || '',
    corsOrigin: env.CORS_ORIGIN || '',
    jobsDir: env.JOBS_DIR || './data/jobs',
    jobsConcurrency: Math.max(1, Number(env.JOBS_CONCURRENCY) || 1),
    jobsTtlHours: Number(env.JOBS_TTL_HOURS) || 24,
    jobsMaxQueue: Number(env.JOBS_MAX_QUEUE) || 20,
  };
}
