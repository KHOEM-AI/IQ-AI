// IQ-AI client for the AI (Vite) UI. Copy to AI/src/lib/iqaiClient.ts
// Base '/iqai' is the Vite proxy -> http://127.0.0.1:8799/api/v1 (the proxy adds the token; never put it in the browser).

export type Envelope<T> = { ok: boolean; data: T | null; error: { code: string; message: string } | null };

export class IqaiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export type Capabilities = {
  service: string; version: string;
  limits: { maxUploadBytes: number; maxVideoBytes: number; maxImageBytes: number };
  system: { ffmpeg: boolean; khmerFont: boolean; khmerFontPath: string | null; nativeCpp: boolean };
  features: Record<string, { ready: boolean; needs: string[] }>;
  options: { voicePresets: string[]; photoEffects: string[]; sfxTypes: string[]; emotions: string[]; soundCategories: string[] };
};
export type Emotion = { emotion: string; [k: string]: unknown };
export type Applied = Record<string, unknown>;
export type BinaryResult = { blob: Blob; url: string; applied: Applied | null };
export type VideoEditOpts = { trimStart?: number; trimEnd?: number; speed?: number; mute?: boolean; width?: number; height?: number };
export type TextVideoOpts = { text: string; durationSec?: number; width?: number; height?: number; fontSize?: number; bgColor?: string; textColor?: string; sfx?: string };

export function createIqai(base = '/iqai') {
  const qs = (o: Record<string, unknown>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  async function fail(r: Response): Promise<never> {
    let code = 'http_' + r.status, msg = r.statusText;
    try {
      const j = await r.json();
      code = j?.error?.code ?? (typeof j?.error === 'string' ? j.error : code);
      msg = j?.error?.message ?? msg;
    } catch { /* body was not JSON */ }
    throw new IqaiError(r.status, code, msg);
  }
  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    const r = await fetch(base + path, init);
    if (!r.ok) await fail(r);
    const j = await r.json();
    return (j && 'data' in j && 'ok' in j ? (j as Envelope<T>).data : j) as T; // sounds routes return bare JSON
  }
  async function binary(path: string, body: BodyInit | null, type?: string, headers: Record<string, string> = {}): Promise<BinaryResult> {
    const r = await fetch(base + path, { method: 'POST', body, headers: { ...(type ? { 'Content-Type': type } : {}), ...headers } });
    if (!r.ok) await fail(r);
    const blob = await r.blob();
    let applied: Applied | null = null;
    try { applied = JSON.parse(r.headers.get('X-Applied') || 'null'); } catch { /* optional header */ }
    return { blob, url: URL.createObjectURL(blob), applied };
  }
  const post = (path: string, o: unknown) => json<unknown>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });

  return {
    health: () => fetch(base + '/health').then((r) => r.ok).catch(() => false),
    capabilities: () => json<Capabilities>('/capabilities'),

    emotion: (text: string) => post('/emotion/analyze', { text }) as Promise<Emotion>,
    inspectAudio: (f: Blob) => json<Applied>('/audio/inspect', { method: 'POST', body: f }),
    inspectImage: (f: Blob) => json<Applied>('/images/inspect', { method: 'POST', body: f }),
    inspectVideo: (f: Blob) => json<Applied>('/videos/inspect', { method: 'POST', body: f }),

    // video (ffmpeg, no AI model)
    videoFromPhoto: (img: Blob, o: { effect?: string; durationSec?: number; width?: number; height?: number; sfx?: string } = {}) =>
      binary('/videos/photo' + qs(o), img),
    videoFromText: (o: TextVideoOpts) => binary('/videos/text', JSON.stringify(o), 'application/json'),
    videoEdit: (v: Blob, o: VideoEditOpts = {}) => binary('/videos/edit' + qs(o), v),
    videoThumbnail: (v: Blob, o: { at?: number; width?: number } = {}) => binary('/videos/thumbnail' + qs(o), v),
    videoAudio: (v: Blob) => binary('/videos/audio', v),

    // audio
    voicePresets: () => json<Applied>('/audio/voices'),
    changeVoice: (a: Blob, o: { preset?: string; pitch?: number; speed?: number; volume?: number } = {}) => binary('/audio/voice' + qs(o), a),
    sfx: (type: string, durationSec?: number) => binary('/audio/sfx', JSON.stringify({ type, durationSec }), 'application/json'),

    // sound library
    sounds: (o: { q?: string; category?: string; tag?: string; favorite?: boolean; limit?: number } = {}) =>
      json<{ items: Array<{ id: string; name: string; category: string; tags: string[]; favorite?: boolean }> }>('/sounds' + qs(o)),
    soundUrl: (id: string, download = false) => `${base}/sounds/${id}/content${download ? '?download=1' : ''}`,
    patchSound: (id: string, patch: Record<string, unknown>) =>
      json<unknown>(`/sounds/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
    uploadSound: (f: File, meta: { name?: string; category?: string; tags?: string; source?: string; license?: string } = {}) =>
      json<unknown>('/sounds/upload', {
        method: 'POST', body: f,
        headers: {
          'Content-Type': f.type, 'X-Filename': encodeURIComponent(meta.name || f.name), 'X-Category': meta.category || 'unknown',
          'X-Tags': encodeURIComponent(meta.tags || ''), 'X-Source': encodeURIComponent(meta.source || ''), 'X-License': encodeURIComponent(meta.license || ''),
        },
      }),
  };
}

export const iqai = createIqai();
export const downloadBlob = (b: BinaryResult, name: string) => {
  const a = document.createElement('a'); a.href = b.url; a.download = name; a.click();
};
