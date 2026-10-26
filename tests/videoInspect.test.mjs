import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectVideo } from '../src/video/inspectVideo.mjs';
import { makeMp4, makeWebm } from './videoFixtures.mjs';

test('mp4', () => {
  const r = inspectVideo(makeMp4(1280, 720, 1000, 5000));
  assert.equal(r.ok, true);
  assert.equal(r.format, 'mp4');
  assert.equal(r.width, 1280);
  assert.equal(r.height, 720);
  assert.equal(r.durationSec, 5);
});
test('webm', () => {
  const r = inspectVideo(makeWebm(640, 480, 5000));
  assert.equal(r.ok, true);
  assert.equal(r.format, 'webm');
  assert.equal(r.width, 640);
  assert.equal(r.height, 480);
  assert.equal(r.durationSec, 5);
});
test('not video', () => assert.equal(inspectVideo(Buffer.from('hello world, not a video')).ok, false));
test('too short', () => assert.equal(inspectVideo(Buffer.alloc(3)).ok, false));
