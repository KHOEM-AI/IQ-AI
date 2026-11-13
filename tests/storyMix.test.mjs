import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Where no Khmer font is installed (CI/sandbox) use any TTF so the drawtext/timing logic is still tested.
// Khmer shaping itself is only checked when the real font exists (see the last test).
const realKhmer = process.env.KHMER_FONT && existsSync(process.env.KHMER_FONT)
  ? process.env.KHMER_FONT
  : ['/system/fonts/NotoSansKhmer-Regular.ttf', '/usr/share/fonts/truetype/noto/NotoSansKhmer-Regular.ttf', '/usr/share/fonts/noto/NotoSansKhmer-Regular.ttf']
    .find((f) => existsSync(f));
if (!realKhmer) {
  const fallback = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/system/fonts/Roboto-Regular.ttf'].find((f) => existsSync(f));
  if (fallback) process.env.KHMER_FONT = fallback;
}
const { createApp } = await import('../src/server/server.mjs');
const { ffmpegAvailable } = await import('../src/audio/ffmpeg.mjs');
const { renderMix } = await import('../src/video/mixAudio.mjs');
const { renderSubtitles, parseSrt, LATIN_FONT } = await import('../src/video/subtitles.mjs');
const { khmerFontAvailable } = await import('../src/video/textToVideo.mjs');

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let dir, hasFfmpeg, silentVideo, soundVideo, narr, music, fontOk;

const ff = (args) => { const r = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...args]); assert.equal(r.status, 0, String(r.stderr)); };
// mean volume (dB) of a band of the audio between ss and ss+t
function meanVolume(file, ss, t, filter = 'anull') {
  const r = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-ss', String(ss), '-t', String(t), '-i', file, '-vn', '-af', `${filter},volumedetect`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /mean_volume: (-?[\d.]+) dB/.exec(r.stderr);
  return m ? Number(m[1]) : -Infinity;
}
const probeDur = (file) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout);
const hasAudio = (file) => spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-i', file, '-map', '0:a:0', '-frames:a', '1', '-f', 'null', '-']).status === 0;

before(async () => {
  hasFfmpeg = await ffmpegAvailable();
  fontOk = khmerFontAvailable();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-story-'));
  if (hasFfmpeg) {
    ff(['-f', 'lavfi', '-i', 'testsrc=s=320x240:d=4:r=25', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(dir, 's.mp4')]);
    ff(['-f', 'lavfi', '-i', 'testsrc=s=320x240:d=4:r=25', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(dir, 'a.mp4')]);
    // narration: 1 s of 1 kHz tone, then 1 s of silence (2 s long, shorter than the 4 s video)
    ff(['-f', 'lavfi', '-i', 'sine=frequency=1000:duration=1', '-af', 'apad=whole_dur=2', '-t', '2', path.join(dir, 'n.wav')]);
    // music: 220 Hz, 3 s (shorter than the video, so it must loop)
    ff(['-f', 'lavfi', '-i', 'sine=frequency=220:duration=3', path.join(dir, 'm.wav')]);
    [silentVideo, soundVideo, narr, music] = await Promise.all(['s.mp4', 'a.mp4', 'n.wav', 'm.wav'].map((f) => fs.readFile(path.join(dir, f))));
  }
});
after(async () => { await fs.rm(dir, { recursive: true, force: true }); });

// ---------- Phase 3: audio mix ----------
test('mix: bad params / nothing to mix / bad audio are refused cleanly', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  assert.equal((await renderMix({ videoBuf: silentVideo })).code, 'bad_params');
  assert.equal((await renderMix({ videoBuf: silentVideo, musicBuf: music, musicVolume: 9 })).code, 'bad_params');
  assert.equal((await renderMix({ videoBuf: silentVideo, musicBuf: music, fadeOut: -1 })).code, 'bad_params');
  assert.equal((await renderMix({ videoBuf: silentVideo, musicBuf: music, duck: 'maybe' })).code, 'bad_params');
  assert.equal((await renderMix({ videoBuf: Buffer.from('not a video at all!!'), musicBuf: music })).code, 'bad_video');
  assert.equal((await renderMix({ videoBuf: silentVideo, musicBuf: Buffer.from('this is not audio, only text') })).code, 'bad_audio');
});

test('mix: music alone loops to the length of the video and the picture is kept', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const r = await renderMix({ videoBuf: silentVideo, musicBuf: music, musicVolume: 0.5 });
  assert.equal(r.ok, true, JSON.stringify(r));
  const f = path.join(dir, 'music-only.mp4');
  await fs.writeFile(f, r.buf);
  assert.ok(hasAudio(f));
  assert.ok(Math.abs(probeDur(f) - 4) < 0.2, `duration ${probeDur(f)}`);
  // the music was 3 s long: the last second must not be silent (it looped)
  assert.ok(meanVolume(f, 3.2, 0.7) > -50, `tail ${meanVolume(f, 3.2, 0.7)} dB`);
  assert.equal(r.applied.duck, false);
});

test('mix: narration + music; ducking makes the music quieter only while the narration speaks', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const common = { videoBuf: silentVideo, narrationBuf: narr, musicBuf: music, narrationVolume: 1, musicVolume: 0.5 };
  const on = await renderMix({ ...common, duck: true });
  const off = await renderMix({ ...common, duck: false });
  assert.equal(on.ok && off.ok, true);
  assert.equal(on.applied.duck, true);
  const fOn = path.join(dir, 'duck-on.mp4');
  const fOff = path.join(dir, 'duck-off.mp4');
  await fs.writeFile(fOn, on.buf); await fs.writeFile(fOff, off.buf);
  const band = 'bandpass=f=220:width_type=h:w=60';
  // while the narration plays (0..1 s) the 220 Hz music is lower with ducking
  const during = meanVolume(fOn, 0.1, 0.8, band) - meanVolume(fOff, 0.1, 0.8, band);
  assert.ok(during < -3, `music during narration changed by ${during.toFixed(1)} dB (expected < -3)`);
  // after the narration (1.8..3.8 s) the music comes back to about the same level
  const after = meanVolume(fOn, 2.2, 1.5, band) - meanVolume(fOff, 2.2, 1.5, band);
  assert.ok(Math.abs(after) < 2.5, `music after narration differs by ${after.toFixed(1)} dB`);
});

test('mix: fade out lowers the end; webm input becomes an mp4; original sound is dropped unless asked', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const faded = await renderMix({ videoBuf: silentVideo, musicBuf: music, musicVolume: 1, fadeOut: 1.5 });
  const f = path.join(dir, 'fade.mp4');
  await fs.writeFile(f, faded.buf);
  assert.ok(meanVolume(f, 0.5, 1) - meanVolume(f, 3.6, 0.4) > 6, 'last 0.4 s should be much quieter than the start');

  // the 330 Hz sound of the video: dropped by default, kept with originalVolume
  const band = 'bandpass=f=330:width_type=h:w=60';
  const dropped = await renderMix({ videoBuf: soundVideo, musicBuf: music });
  const kept = await renderMix({ videoBuf: soundVideo, musicBuf: music, originalVolume: 1 });
  assert.equal(dropped.applied.originalAudio, false);
  assert.equal(kept.applied.originalAudio, true);
  const fd = path.join(dir, 'drop.mp4'); const fk = path.join(dir, 'keep.mp4');
  await fs.writeFile(fd, dropped.buf); await fs.writeFile(fk, kept.buf);
  assert.ok(meanVolume(fk, 0.5, 2, band) - meanVolume(fd, 0.5, 2, band) > 10);

  ff(['-i', path.join(dir, 's.mp4'), '-c:v', 'libvpx', '-b:v', '300k', '-an', path.join(dir, 's.webm')]);
  const w = await renderMix({ videoBuf: await fs.readFile(path.join(dir, 's.webm')), narrationBuf: narr });
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.equal(w.buf.toString('ascii', 4, 8), 'ftyp');
});

// ---------- Phase 4: subtitles ----------
test('srt: parses blocks, numbers, comma and dot times, multi-line text; rejects garbage', () => {
  const r = parseSrt('﻿1\r\n00:00:01,000 --> 00:00:02,500\r\nសួស្តី\r\nពិភពលោក\r\n\r\n2\r\n00:00:03.2 --> 00:01:04,000 X1:1\r\nHello\r\n');
  assert.equal(r.ok, true);
  assert.deepEqual(r.cues.map((c) => [c.start, c.end]), [[1, 2.5], [3.2, 64]]);
  assert.equal(r.cues[0].text, 'សួស្តី\nពិភពលោក');
  assert.equal(parseSrt('').ok, false);
  assert.equal(parseSrt('hello world').ok, false);
  assert.equal(parseSrt('1\n00:00:xx --> 00:00:02\nhi').ok, false);
});

test('subtitles: bad cues / options are refused cleanly', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  const v = { videoBuf: silentVideo };
  assert.equal((await renderSubtitles({ ...v })).code, 'bad_params');
  assert.equal((await renderSubtitles({ ...v, cues: [] })).code, 'bad_params');
  assert.equal((await renderSubtitles({ ...v, cues: [{ start: 2, end: 1, text: 'x' }] })).code, 'bad_params');
  assert.equal((await renderSubtitles({ ...v, cues: [{ start: 0, end: 1, text: '  ' }] })).code, 'bad_params');
  assert.equal((await renderSubtitles({ ...v, cues: Array.from({ length: 301 }, (_, i) => ({ start: i, end: i + 1, text: 'x' })) })).code, 'bad_params');
  assert.equal((await renderSubtitles({ ...v, cues: [{ start: 0, end: 1, text: 'x' }], color: 'red' })).code, 'bad_params');
  assert.equal((await renderSubtitles({ ...v, cues: [{ start: 0, end: 1, text: 'x' }], position: 'left' })).code, 'bad_params');
  assert.equal((await renderSubtitles({ ...v, srt: 'junk' })).code, 'bad_params');
  assert.equal((await renderSubtitles({ videoBuf: Buffer.from('not a video at all!!'), cues: [{ start: 0, end: 1, text: 'x' }] })).code, 'bad_video');
});

test('subtitles: text appears only inside its time window, keeps audio and length', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  if (!LATIN_FONT) return t.skip('no Latin font found (set LATIN_FONT=/path/to/font.ttf)');
  // a plain dark video so that burnt-in white text is easy to measure
  ff(['-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=4:r=25', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(dir, 'black.mp4')]);
  const black = await fs.readFile(path.join(dir, 'black.mp4'));
  const r = await renderSubtitles({ videoBuf: black, cues: [{ start: 1, end: 2, text: 'HELLO STORY' }], position: 'bottom' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const out = path.join(dir, 'sub.mp4');
  await fs.writeFile(out, r.buf);
  assert.ok(hasAudio(out), 'audio must be kept');
  assert.ok(Math.abs(probeDur(out) - 4) < 0.2);
  // brightest pixel (YMAX) of one frame: black outside the window, white text inside
  const ymax = (at) => {
    const x = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-ss', String(at), '-i', out, '-frames:v', '1', '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YMAX', '-f', 'null', '-'], { encoding: 'utf8' });
    const m = /YMAX=(\d+)/.exec(x.stderr);
    return m ? Number(m[1]) : -1;
  };
  assert.ok(ymax(0.4) < 60, `before the cue: ${ymax(0.4)}`);
  assert.ok(ymax(1.5) > 200, `during the cue: ${ymax(1.5)}`);
  assert.ok(ymax(3.0) < 60, `after the cue: ${ymax(3.0)}`);
  assert.equal(r.applied.cues, 1);
  // an SRT gives the same result as cues
  const s = await renderSubtitles({ videoBuf: black, srt: '1\n00:00:01,000 --> 00:00:02,000\nHELLO STORY' });
  assert.equal(s.ok, true);
});

test('subtitles: Khmer text and a cue that mixes Khmer + Latin show inside their window (the Latin part needs a Latin-capable Khmer font)', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  if (!realKhmer) return t.skip('Noto Sans Khmer not installed');
  ff(['-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=4:r=25', '-pix_fmt', 'yuv420p', path.join(dir, 'black2.mp4')]);
  const black = await fs.readFile(path.join(dir, 'black2.mp4'));
  const ymax = (file, at) => {
    const x = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-ss', String(at), '-i', file, '-frames:v', '1', '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YMAX', '-f', 'null', '-'], { encoding: 'utf8' });
    const m = /YMAX=(\d+)/.exec(x.stderr + x.stdout);
    return m ? Number(m[1]) : -1;
  };
  for (const text of ['ជំរាបសួរ', 'KHOEM-AI សួស្តី']) {
    const r = await renderSubtitles({ videoBuf: black, cues: [{ start: 1, end: 2, text }] });
    assert.equal(r.ok, true, JSON.stringify(r));
    const f = path.join(dir, `k-${text.length}.mp4`);
    await fs.writeFile(f, r.buf);
    assert.ok(ymax(f, 0.4) < 60, 'before');
    assert.ok(ymax(f, 1.5) > 200, `during (${text}): ${ymax(f, 1.5)}`);
    assert.ok(ymax(f, 3.0) < 60, 'after');
    if (/[A-Za-z]/.test(text)) assert.equal(r.applied.mixedCues, 1);
  }
});

test('subtitles: 300 cues (the maximum) in one call work: the -vf chain stays within the argument limit', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  if (!existsSync(process.env.KHMER_FONT || '') && !fontOk) return t.skip('no font available');
  const cues = Array.from({ length: 300 }, (_, i) => ({ start: i * 0.012, end: i * 0.012 + 0.01, text: `a longer subtitle line number ${i + 1} to make it realistic` }));
  const r = await renderSubtitles({ videoBuf: silentVideo, cues });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.applied.cues, 300);
});

test('subtitles: real Khmer text renders (only when the Khmer font is installed)', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  if (!realKhmer) return t.skip('Noto Sans Khmer not installed');
  const r = await renderSubtitles({ videoBuf: silentVideo, cues: [{ start: 0, end: 3, text: 'ជំរាបសួរ នេះគឺជារឿងរបស់យើង ដែលមានប្រវែងវែងណាស់ ដើម្បីសាកល្បងការបំបែកបន្ទាត់' }] });
  assert.equal(r.ok, true, JSON.stringify(r));
});

// ---------- through the job API ----------
let server, base;
const api = (p, opt = {}) => fetch(`${base}/api/v1${p}`, { ...opt, headers: { ...auth, ...(opt.headers || {}) } });
const postJob = (body) => api('/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const upload = async (buf, type) => (await (await api('/media', { method: 'POST', headers: { 'Content-Type': type, 'X-Filename': 'x' }, body: buf })).json()).data.id;
async function waitJob(id) {
  for (let i = 0; i < 600; i++) {
    const j = (await (await api(`/jobs/${id}`)).json()).data;
    if (['done', 'failed', 'cancelled'].includes(j.status)) return j;
    await sleep(100);
  }
  assert.fail('job did not finish');
}

test('jobs: video.mix then video.subtitle chain through media ids', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not installed');
  server = createApp({ storageDir: path.join(dir, 'media'), audioStorageDir: path.join(dir, 'audio'), jobsDir: path.join(dir, 'jobs'),
    maxUploadBytes: 20 * 1024 * 1024, token: TOKEN, corsOrigin: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  try {
    const vId = await upload(silentVideo, 'video/mp4');
    const nId = await upload(narr, 'audio/wav');
    const mId = await upload(music, 'audio/wav');

    assert.deepEqual((await (await api('/jobs')).json()).data.types.sort(), ['video.edit', 'video.merge', 'video.mix', 'video.story', 'video.subtitle']);

    const mix = await waitJob((await (await postJob({ type: 'video.mix', params: { mediaId: vId, narrationId: nId, musicId: mId, fadeOut: 1 } })).json()).data.id);
    assert.equal(mix.status, 'done', JSON.stringify(mix.error));
    assert.equal(mix.result.applied.duck, true);

    if (existsSync(process.env.KHMER_FONT || '') || fontOk) {
      const sub = await waitJob((await (await postJob({ type: 'video.subtitle', params: { mediaId: mix.result.mediaId, cues: [{ start: 0.5, end: 2, text: 'story' }] } })).json()).data.id);
      assert.equal(sub.status, 'done', JSON.stringify(sub.error));
      const meta = (await (await api(`/media/${sub.result.mediaId}`)).json()).data;
      assert.equal(meta.type, 'video');
      assert.ok(Math.abs(meta.info.durationSec - 4) < 0.3);
    }

    // clean failures: wrong media kinds and bad input never leak ffmpeg text
    const wrongKind = await waitJob((await (await postJob({ type: 'video.mix', params: { mediaId: vId, musicId: vId } })).json()).data.id);
    assert.equal(wrongKind.error.code, 'unsupported_type');
    const none = await waitJob((await (await postJob({ type: 'video.mix', params: { mediaId: vId } })).json()).data.id);
    assert.equal(none.status, 'failed');
    assert.equal(none.error.code, 'bad_params');
    const badCue = await waitJob((await (await postJob({ type: 'video.subtitle', params: { mediaId: vId, cues: [{ start: 3, end: 1, text: 'x' }] } })).json()).data.id);
    assert.equal(badCue.error.code, 'bad_params');
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
