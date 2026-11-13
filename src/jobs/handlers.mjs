import { renderVideoEdit } from '../video/editVideo.mjs';
import { renderMerge, MERGE_LIMITS } from '../video/mergeVideos.mjs';
import { renderMix } from '../video/mixAudio.mjs';
import { renderSubtitles } from '../video/subtitles.mjs';
import { renderStory, STORY_LIMITS } from '../video/story.mjs';
import { buildNarrationTrack, wavSeconds, NARRATION_LEAD_SEC, NARRATION_TAIL_SEC } from '../video/narration.mjs';
import { synthesizeDialogue } from '../audio/dialogue.mjs';
import { synthSfx } from '../audio/sfx/synth.mjs';
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

async function loadImage(registry, id) {
  if (typeof id !== 'string' || !isValidId(id)) throw jobError('imageId must be a media id (UUID)');
  const meta = await registry.get(id);
  if (!meta) throw jobError(`Media not found: ${id}`, 'not_found');
  if (meta.type !== 'image') throw jobError(`Media is not an image: ${id}`, 'unsupported_type');
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
// tts: { synthesizeDialogue } (injected in tests; the real engine is off until IQAI_TTS=edge)
export function createHandlers({ registry, tts = { synthesizeDialogue } }) {
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

    // params: { scenes: [{ imageId?, text?, seconds?, say?, voice? }, ...], voice?, secondsPerScene?, width?, height?, effect?,
    //           transition?, fontSize?, textColor?, bgColor?, sfx?, audioId?, narrationVolume?, musicVolume?, duck? }
    // A scene is a stored photo (optional caption) or a text card. `say` is spoken (text-to-speech) by `voice`:
    // the scene lasts at least as long as its line. Sound effect / stored audio then plays as music under the voice.
    async 'video.story'({ params, signal, setProgress }) {
      const [min, max] = STORY_LIMITS.scenes;
      const [smin, smax] = STORY_LIMITS.sceneSeconds;
      const raw = params.scenes;
      if (!Array.isArray(raw) || raw.length < min || raw.length > max || !raw.every((s) => s && typeof s === 'object' && !Array.isArray(s))) {
        throw jobError(`scenes must be an array of ${min}..${max} objects`);
      }
      const base = params.secondsPerScene === undefined || params.secondsPerScene === null ? 4 : Number(params.secondsPerScene);
      if (!Number.isFinite(base) || base < smin || base > smax) throw jobError(`secondsPerScene must be ${smin}..${smax}`);
      const aborted = () => Object.assign(new Error('aborted'), { code: 'aborted' });
      const scenes = [];
      const says = [];
      let bytes = 0;
      for (let i = 0; i < raw.length; i++) {
        const s = raw[i];
        const image = s.imageId ? await loadImage(registry, s.imageId) : null;
        if (image) bytes += image.length;
        if (bytes > MAX_JOB_VIDEO) throw jobError('the photos are too large together', 'too_large');
        const sec = s.seconds === undefined || s.seconds === null ? base : Number(s.seconds);
        if (!Number.isFinite(sec) || sec < smin || sec > smax) throw jobError(`scene ${i + 1}: seconds must be ${smin}..${smax}`);
        const say = typeof s.say === 'string' && s.say.trim() ? s.say.trim() : null;
        scenes.push({ image, text: s.text, seconds: sec });
        says.push(say ? { text: say, voice: typeof s.voice === 'string' && s.voice ? s.voice : (typeof params.voice === 'string' && params.voice ? params.voice : 'male') } : null);
      }
      const audioBuf = params.audioId ? await loadAudio(registry, params.audioId, 'audioId') : null;
      const voiced = says.some(Boolean);
      setProgress(0.02);

      // 1) speak the lines; a scene lasts at least as long as its line (+ a short lead and tail)
      const clips = [];
      if (voiced) {
        let spoken = 0;
        const total = says.filter(Boolean).length;
        for (let i = 0; i < scenes.length; i++) {
          if (!says[i]) { clips.push({ buf: null, seconds: scenes[i].seconds }); continue; }
          if (signal && signal.aborted) throw aborted();
          const r = await tts.synthesizeDialogue({ lines: [{ text: says[i].text, voice: says[i].voice }] });
          if (!r || !r.ok) throw jobError((r && r.message) || 'Text-to-speech failed', (r && r.code) || 'tts_failed');
          let len = wavSeconds(r.buf);
          if (len === null && Array.isArray(r.timings) && r.timings.length) len = r.timings[r.timings.length - 1].endMs / 1000;
          if (!Number.isFinite(len) || len <= 0) throw jobError(`scene ${i + 1}: the speech could not be read`, 'tts_failed');
          const need = Math.ceil((len + NARRATION_LEAD_SEC + NARRATION_TAIL_SEC) * 10) / 10;
          const seconds = Math.max(scenes[i].seconds, need);
          if (seconds > smax) throw jobError(`scene ${i + 1}: the spoken text is too long for one scene (max ${smax} s)`);
          scenes[i].seconds = seconds;
          clips.push({ buf: r.buf, seconds });
          spoken++;
          setProgress(0.02 + 0.2 * (spoken / total));
        }
      }

      // 2) the picture
      const r = check(await renderStory({
        scenes, secondsPerScene: base, width: params.width, height: params.height,
        effect: params.effect, transition: params.transition, fontSize: params.fontSize,
        textColor: params.textColor, bgColor: params.bgColor,
        sfxType: voiced ? null : (params.sfx ?? null), audioBuf: voiced ? null : audioBuf,
        signal, onProgress: (v) => setProgress(voiced ? 0.22 + 0.68 * v : v),
      }), 'Could not create this story');
      if (!voiced) return { ...(await saveVideo(registry, r.buf, 'story.mp4')), applied: r.applied };

      // 3) the voice (and music) on top
      const narrationBuf = await buildNarrationTrack({ clips, signal });
      let musicBuf = audioBuf || undefined;
      if (!musicBuf && params.sfx) {
        const sfx = synthSfx({ type: params.sfx, durationSec: Math.min(r.applied.totalSec, 60) });
        if (!sfx.ok) throw jobError(sfx.message || 'sfx failed');
        musicBuf = sfx.buf;
      }
      setProgress(0.93);
      const mixed = check(await renderMix({
        videoBuf: r.buf, narrationBuf, musicBuf, signal, originalVolume: 0,
        narrationVolume: params.narrationVolume, musicVolume: params.musicVolume, duck: params.duck,
      }), 'Could not add the voice to this story');
      return { ...(await saveVideo(registry, mixed.buf, 'story.mp4')), applied: { ...r.applied, narrated: says.filter(Boolean).length } };
    },
  };
}
