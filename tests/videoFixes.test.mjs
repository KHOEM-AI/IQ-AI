import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { wrapText, renderTextVideo, KHMER_FONT } from '../src/video/textToVideo.mjs';
import { renderPhotoVideo } from '../src/video/photoToVideo.mjs';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const hasFont = fs.existsSync(KHMER_FONT);
const skipFfmpeg = hasFfmpeg ? false : 'ffmpeg is not installed';
const skipFont = !hasFfmpeg ? 'ffmpeg is not installed' : hasFont ? false : `font not found: ${KHMER_FONT}`;

// Khmer sentence written as escapes so the file stays ASCII (safe to paste on a phone)
const KHMER = '\u1781\u17D2\u1789\u17BB\u17C6\u179F\u17D2\u179A\u179B\u17B6\u1789\u17CB\u1794\u17D2\u179A\u1791\u17C1\u179F\u1780\u1798\u17D2\u1796\u17BB\u1787\u17B6\u178E\u17B6\u179F\u17CB\u17A0\u17BE\u1799\u1781\u17D2\u1789\u17BB\u17C6\u179A\u17C0\u1793\u1797\u17B6\u179F\u17B6\u1781\u17D2\u1798\u17C2\u179A\u1787\u17B6\u179A\u17C0\u1784\u179A\u17B6\u179B\u17CB\u1790\u17D2\u1784\u17C3';

test('wrapText never breaks inside a Khmer cluster', () => {
  for (let width = 4; width <= 14; width++) {
    const { lines, truncated } = wrapText(KHMER, width, 100);
    assert.equal(truncated, false);
    assert.equal(lines.join(''), KHMER, `no character lost or changed (width ${width})`);
    for (const line of lines) {
      const chars = Array.from(line);
      assert.ok(!/^\p{M}$/u.test(chars[0]), `line starts with a combining mark (width ${width})`);
      assert.notEqual(chars.at(-1), '\u17D2', `line ends with a coeng (width ${width})`);
    }
  }
});

test('wrapText still wraps normal spaced text at word boundaries', () => {
  const { lines } = wrapText('hello world foo bar baz', 11, 10);
  assert.deepEqual(lines, ['hello world', 'foo bar baz']);
});

// First frame as raw grayscale; a video that drew no text on a black background is all zeros.
function firstFrameHasInk(buf) {
  const file = path.join(os.tmpdir(), 'iqai-test-frame.mp4');
  fs.writeFileSync(file, buf);
  const r = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-i', file,
    '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0);
  return r.stdout.some((v) => v > 128);
}

test('text video draws a literal % (drawtext must not expand it)', { skip: skipFont, timeout: 60000 }, async () => {
  // The Android Khmer font has no Latin letters, so every sample contains a short Khmer word
  // (the text must still draw ink); a lone % before or after it must not blank the text.
  const SHORT = KHMER.slice(0, 5);
  for (const text of [SHORT + ' 50%', '50% ' + SHORT, SHORT + ' 100% 50%']) {
    const r = await renderTextVideo({ text, durationSec: 1, width: 480, height: 320, textColor: '#ffffff' });
    assert.equal(r.ok, true, text);
    assert.equal(firstFrameHasInk(r.buf), true, `text was drawn: ${text}`);
  }
});

function makePng() {
  const r = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=s=320x240',
    '-frames:v', '1', '-f', 'image2', '-c:v', 'png', '-'], { maxBuffer: 16 * 1024 * 1024 });
  assert.equal(r.status, 0);
  return r.stdout;
}

test('photo video accepts a valid image', { skip: skipFfmpeg, timeout: 60000 }, async () => {
  const r = await renderPhotoVideo({ imageBuf: makePng(), durationSec: 1, width: 320, height: 320 });
  assert.equal(r.ok, true);
});

test('photo video rejects a truncated image quickly instead of hanging', { skip: skipFfmpeg, timeout: 30000 }, async () => {
  const png = makePng();
  const t = Date.now();
  const r = await renderPhotoVideo({ imageBuf: png.subarray(0, Math.floor(png.length / 2)), durationSec: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.message, 'image could not be decoded');
  assert.ok(Date.now() - t < 15000, 'must not wait for the 120 s ffmpeg timeout');
});
