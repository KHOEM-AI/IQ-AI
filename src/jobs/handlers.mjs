import { renderVideoEdit } from '../video/editVideo.mjs';
import { renderMerge, MERGE_LIMITS } from '../video/mergeVideos.mjs';
import { renderMix } from '../video/mixAudio.mjs';
import { renderSubtitles } from '../video/subtitles.mjs';
import { isValidId } from '../media/registry.mjs';

// Job handlers: they reuse the existing renderers (no duplicated logic) and store the finished video in
// the media registry, so the result is one { mediaId } that can be played, downloaded or used as an input
// of the next job. New phases (subtitles, audio mix, TTS, story) add their handler here.

const MAX_JOB_VIDEO = 200 * 1024 * 1024;
const jobError = (message, code = 'bad_params') => Object.assign(new Error(message), { jobCode: code, jobMessage: message });

async function loadVideo(registry, id) {
  if (typeof id !== 'string' || !isValidId(id)) throw jobError('mediaId must be a media id (UUID)');
  const meta = await registry.get(id);
  if (!meta) throw jobError(`Media not found: ${id}`, 'not_found');
  if (meta.type !== 'video') throw jobError(`Media is not a video: ${id}`, 'unsupported_type');
  const buf = await registry.content(id);
  if (!buf) throw jobError(`Media content missing: ${id}`, 'not_found');
  return { meta, buf };
}

async function loadAudio(registry, id, what) {
  if (typeof id !== 'string' || !isValidId(id)) throw jobError(`${what} must be a media id (UUID)`);
  const meta = await registry.get(id);
  if (!meta) throw jobError(`Media not found: ${id}`, 'not_found');
  if (meta.type !== 'audio') throw jobError(`${what} is not an audio item: ${id}`, 'unsupported_type');
  const buf = await registry.content(id);
  if (!buf) throw jobError(`Media content missing: ${id}`, 'not_found');
  return buf;
}

// Renderer result -> thrown job error (clean message for the client, ffmpeg text only in the server log).
function check(r, failMessage) {
  if (r.ok) return r;
  if (r.message === 'ffmpeg_failed') throw Object.assign(new Error('ffmpeg_failed'), { detail: r.detail, jobCode: 'video_processing_failed', jobMessage: failMessage });
  throw jobError(r.message, r.code || 'bad_params');
}

async function saveVideo(registry, buf, filename) {
  const r = await registry.create({ buf, mime: 'video/mp4', filename });
  if (!r.ok) throw jobError(r.message || 'Could not store the result', 'store_failed');
  return { mediaId: r.data.id, size: r.data.size };
}

// ctx: { registry }
export function createHandlers({ registry }) {
  return {
    // params: { mediaId, trimStart?, trimEnd?, speed?, mute?, width?, height? }
    async 'video.edit'({ params, signal, setProgress }) {
      const { buf } = await loadVideo(registry, params.mediaId);
      setProgress(0.05);
      const r = await renderVideoEdit({
        videoBuf: buf, signal, timeoutMs: 3600 * 1000,
        trimStart: params.trimStart, trimEnd: params.trimEnd, speed: params.speed,
        mute: params.mute, width: params.width, height: params.height,
      });
      if (!r.ok && r.message === 'ffmpeg_failed') throw Object.assign(new Error('ffmpeg_failed'), { detail: r.detail, jobCode: 'video_processing_failed', jobMessage: 'Could not edit this video' });
      if (!r.ok) throw jobError(r.message, r.code || 'bad_params');
      return { ...(await saveVideo(registry, r.buf, 'edit.mp4')), applied: r.applied };
    },

    // params: { ids: [mediaId, ...], width?, height?, fps? }
    async 'video.merge'({ params, signal, setProgress }) {
      const [min, max] = MERGE_LIMITS.clips;
      const ids = params.ids;
      if (!Array.isArray(ids) || ids.length < min || ids.length > max) throw jobError(`ids must be an array of ${min}..${max} media ids`);
      const clips = [];
      let first = null;
      let bytes = 0;
      for (const id of ids) {
        const v = await loadVideo(registry, id);
        bytes += v.buf.length;
        if (bytes > MAX_JOB_VIDEO) throw jobError('clips are too large to merge together', 'too_large');
        first = first || v.meta;
        clips.push(v.buf);
      }
      setProgress(0.05);
      const info = (first && first.info) || {};
      const defaultSize = info.width && info.height ? { width: info.width, height: info.height } : undefined;
      const r = await renderMerge({ clips, width: params.width, height: params.height, fps: params.fps, defaultSize, signal });
      if (!r.ok && r.message === 'ffmpeg_failed') throw Object.assign(new Error('ffmpeg_failed'), { detail: r.detail, jobCode: 'video_processing_failed', jobMessage: 'Could not merge these videos' });
      if (!r.ok) throw jobError(r.message, r.code || 'bad_params');
      return { ...(await saveVideo(registry, r.buf, 'merged.mp4')), applied: r.applied };
    },

    // params: { mediaId (video), narrationId?, musicId? (audio media ids), originalVolume?, narrationVolume?, musicVolume?, duck?, fadeIn?, fadeOut? }
    // Needs a narrationId and/or a musicId.
    async 'video.mix'({ params, signal, setProgress }) {
      const { buf } = await loadVideo(registry, params.mediaId);
      const narrationBuf = params.narrationId ? await loadAudio(registry, params.narrationId, 'narrationId') : undefined;
      const musicBuf = params.musicId ? await loadAudio(registry, params.musicId, 'musicId') : undefined;
      setProgress(0.05);
      const r = check(await renderMix({
        videoBuf: buf, narrationBuf, musicBuf, signal,
        originalVolume: params.originalVolume, narrationVolume: params.narrationVolume, musicVolume: params.musicVolume,
        duck: params.duck, fadeIn: params.fadeIn, fadeOut: params.fadeOut,
      }), 'Could not mix the audio into this video');
      return { ...(await saveVideo(registry, r.buf, 'mixed.mp4')), applied: r.applied };
    },

    // params: { mediaId (video), cues: [{start,end,text}] or srt: "<SubRip text>", fontSize?, color?, boxOpacity?, position? }
    async 'video.subtitle'({ params, signal, setProgress }) {
      const { buf } = await loadVideo(registry, params.mediaId);
      setProgress(0.05);
      const r = check(await renderSubtitles({
        videoBuf: buf, signal, cues: params.cues, srt: params.srt,
        fontSize: params.fontSize, color: params.color, boxOpacity: params.boxOpacity, position: params.position,
      }), 'Could not add subtitles to this video');
      return { ...(await saveVideo(registry, r.buf, 'subtitled.mp4')), applied: r.applied };
    },
  };
}
