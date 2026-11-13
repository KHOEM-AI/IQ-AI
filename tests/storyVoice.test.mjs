import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createStorage } from '../src/media/storage.mjs';
import { createRegistry } from '../src/media/registry.mjs';
import { createHandlers } from '../src/jobs/handlers.mjs';
import { wavSeconds, buildNarrationTrack } from '../src/video/narration.mjs';
import { ffmpegAvailable } from '../src/audio/ffmpeg.mjs';

// A narrated story. The speech engine is replaced by a fake that makes a tone 0.5 s long per character,
// so no internet is needed here (the real engine is off until IQAI_TTS=edge).
function toneWav(seconds, rate = 16000) {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / rate)), 44 + i * 2);
  return b;
}
const fakeTts = (calls = []) => ({
  async synthesizeDialogue({ lines }) {
    calls.push(lines);
    const seconds = lines[0].text.length * 0.5;
    return { ok: true, buf: toneWav(seconds), timings: [{ index: 0, voice: lines[0].voice, startMs: 0, endMs: seconds * 1000 }] };
  },
});

let dir, registry, hasFfmpeg, imageId;
const mk = (tts) => createHandlers({ registry, tts });
const run = (handlers, params, signal = new AbortController().signal) => {
  const progress = [];
  return { p: handlers['video.story']({ params, signal, setProgress: (v) => progress.push(v) }), progress };
};
const rejects = (promise) => promise.then(() => assert.fail('should have failed'), (e) => e);
const probe = (file, entries) => String(spawnSync('ffprobe', ['-v', 'error', '-show_entries', entries, '-of', 'default=nw=1', file]).stdout);

before(async () => {
  hasFfmpeg = await ffmpegAvailable();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-storyvoice-'));
  registry = createRegistry(createStorage(dir));
  if (hasFfmpeg) {
    const png = path.join(dir, 'a.png');
    assert.equal(spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=200x300', '-frames:v', '1', png]).status, 0);
    const up = await registry.create({ buf: await fs.readFile(png), mime: 'image/png', filename: 'a.png' });
    assert.equal(up.ok, true);
    imageId = up.data.id;
  }
});
after(async () => { await fs.rm(dir, { recursive: true, force: true }); });

test('wavSeconds reads the length of a WAV and refuses anything else', () => {
  assert.ok(Math.abs(wavSeconds(toneWav(1.5)) - 1.5) < 0.001);
  assert.equal(wavSeconds(Buffer.from('not a wav at all, just some text that is long enough to try')), null);
  assert.equal(wavSeconds(Buffer.alloc(10)), null);
  assert.equal(wavSeconds('x'), null);
});

test('narration track is as long as the scenes (speech first, silence after)', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  const wav = await buildNarrationTrack({ clips: [{ buf: toneWav(1), seconds: 2 }, { buf: null, seconds: 1 }, { buf: toneWav(0.5), seconds: 1.5 }] });
  const f = path.join(dir, 'narr.wav');
  await fs.writeFile(f, wav);
  assert.ok(Math.abs(wavSeconds(wav) - 4.5) < 0.05, `length ${wavSeconds(wav)}`);
  assert.match(probe(f, 'stream=sample_rate,channels'), /sample_rate=44100/);
});

test('video.story: bad speech settings are clean job errors', async () => {
  const h = mk(fakeTts());
  let e = await rejects(run(h, { scenes: [{ text: 'x' }], secondsPerScene: 0 }).p);
  assert.equal(e.jobCode, 'bad_params');
  e = await rejects(run(h, { scenes: [{ text: 'x', seconds: 99 }] }).p);
  assert.equal(e.jobCode, 'bad_params');
});

test('video.story: when the speech engine is off the job fails with its message', async () => {
  const off = { async synthesizeDialogue() { return { ok: false, status: 501, code: 'no_provider', message: 'No text-to-speech provider is configured yet' }; } };
  const e = await rejects(run(mk(off), { scenes: [{ text: 'សួស្តី', say: 'សួស្តី' }] }).p);
  assert.equal(e.jobCode, 'no_provider');
  assert.match(e.jobMessage, /text-to-speech/i);
});

test('video.story: a spoken line that does not fit in one scene is refused', async () => {
  const e = await rejects(run(mk(fakeTts()), { scenes: [{ text: 'x', say: 'a'.repeat(125) }] }).p); // 62.5 s of speech
  assert.equal(e.jobCode, 'bad_params');
  assert.match(e.jobMessage, /too long/);
});

test('video.story: scenes grow to fit their speech, and the video has a voice track', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  const calls = [];
  const { p, progress } = run(mk(fakeTts(calls)), {
    scenes: [{ imageId, seconds: 1, say: 'aaaa', voice: 'female' }, { imageId, seconds: 1 }, { imageId, seconds: 1, say: 'bb' }],
    voice: 'deep', width: 320, height: 480, effect: 'none',
  });
  const r = await p;
  assert.equal(r.applied.narrated, 2);
  // scene 1: 2.0 s speech + 0.3 + 0.8 = 3.1 s; scene 2 stays 1 s; scene 3: 1.0 + 1.1 = 2.1 s
  assert.ok(Math.abs(r.applied.totalSec - 6.2) < 0.05, `totalSec ${r.applied.totalSec}`);
  assert.equal(calls[0][0].voice, 'female');
  assert.equal(calls[1][0].voice, 'deep'); // the default voice
  assert.ok(progress.every((v, i) => i === 0 || v >= progress[i - 1]), 'progress never goes back');
  const f = path.join(dir, 'voiced.mp4');
  await fs.writeFile(f, await registry.content(r.mediaId));
  assert.match(probe(f, 'stream=codec_type'), /codec_type=audio/);
  const dur = Number(/duration=([\d.]+)/.exec(probe(f, 'format=duration'))[1]);
  assert.ok(Math.abs(dur - 6.2) < 0.7, `duration ${dur}`);
});

test('video.story: a sound effect becomes music under the voice', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  const r = await run(mk(fakeTts()), { scenes: [{ imageId, say: 'ab' }], width: 320, height: 480, effect: 'none', sfx: 'rain', transition: 'none' }).p;
  assert.ok(r.mediaId);
});

test('video.story: without any spoken scene the old behaviour is unchanged (no speech engine call)', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg missing');
  const calls = [];
  const r = await run(mk(fakeTts(calls)), { scenes: [{ imageId, seconds: 1 }], width: 320, height: 480, effect: 'none' }).p;
  assert.equal(calls.length, 0);
  assert.equal(r.applied.scenes, 1);
  assert.equal(r.applied.narrated, undefined);
});

test('video.story: an abort while speaking stops the job', async () => {
  const ac = new AbortController();
  const slow = { async synthesizeDialogue() { await new Promise((r) => setTimeout(r, 300)); ac.abort(); return { ok: true, buf: toneWav(1) }; } };
  const e = await rejects(run(mk(slow), { scenes: [{ text: 'a', say: 'a' }, { text: 'b', say: 'b' }] }, ac.signal).p);
  assert.equal(e.code, 'aborted');
});
