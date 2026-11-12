import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderTextVideo, KHMER_FONT } from '../src/video/textToVideo.mjs';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const hasProbe = spawnSync('ffprobe', ['-version']).status === 0;
const hasFont = fs.existsSync(KHMER_FONT);
const skip = !hasFfmpeg ? 'ffmpeg is not installed' : hasFont ? false : `font not found: ${KHMER_FONT}`;

// The sound-effect generator makes a short clip, so a longer video must loop it.
test('a sound effect works on a video longer than 30 s (the audio loops)', { skip, timeout: 120000 }, async () => {
  const r = await renderTextVideo({ text: 'long', durationSec: 40, width: 320, height: 320, sfxType: 'beep' });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.applied.durationSec, 40);
  assert.ok(r.buf.length > 1000);
  if (hasProbe) {
    const f = path.join(os.tmpdir(), `iqai-long-${process.pid}.mp4`);
    fs.writeFileSync(f, r.buf);
    try {
      const out = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout;
      assert.ok(Math.abs(parseFloat(out) - 40) < 1.5, `duration should be about 40 s, got ${out.trim()}`);
    } finally {
      fs.rmSync(f, { force: true });
    }
  }
});
