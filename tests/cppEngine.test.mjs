import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzePcm16,
  nativeAvailable,
} from '../src/native/cppEngine.mjs';

test('C++ Native Module is available after build', {
  skip: !nativeAvailable,
}, () => {
  assert.equal(nativeAvailable, true);
});

test('analyzes PCM16 peak, RMS and sample count', {
  skip: !nativeAvailable,
}, () => {
  const pcm = Buffer.alloc(8);
  pcm.writeInt16LE(-32768, 0);
  pcm.writeInt16LE(32767, 2);
  pcm.writeInt16LE(0, 4);
  pcm.writeInt16LE(16384, 6);

  const result = analyzePcm16(pcm);

  assert.equal(result.sampleCount, 4);
  assert.equal(result.peak, 1);
  assert.ok(result.rms > 0 && result.rms <= 1);
  assert.ok(result.peakDbfs <= 0);
  assert.ok(result.rmsDbfs <= 0);
});

test("handles PCM16 silence correctly", { skip: !nativeAvailable }, () => {
  const result = analyzePcm16(Buffer.alloc(4096));

  assert.equal(result.sampleCount, 2048);
  assert.equal(result.peak, 0);
  assert.equal(result.rms, 0);
  assert.equal(result.peakDbfs, -160);
  assert.equal(result.rmsDbfs, -160);
});

test("handles PCM16 minimum and maximum values", { skip: !nativeAvailable }, () => {
  const pcm = Buffer.alloc(4);
  pcm.writeInt16LE(-32768, 0);
  pcm.writeInt16LE(32767, 2);

  const result = analyzePcm16(pcm);

  assert.equal(result.sampleCount, 2);
  assert.equal(result.peak, 1);
  assert.ok(result.rms <= 1);
  assert.ok(result.rms > 0.999);
});

test("handles a large PCM16 buffer", { skip: !nativeAvailable }, () => {
  const sampleCount = 1024 * 1024;
  const pcm = Buffer.alloc(sampleCount * 2);

  for (let i = 0; i < sampleCount; i += 1) {
    pcm.writeInt16LE(i % 2 === 0 ? 16384 : -16384, i * 2);
  }

  const result = analyzePcm16(pcm);

  assert.equal(result.sampleCount, sampleCount);
  assert.equal(result.peak, 0.5);
  assert.ok(Math.abs(result.rms - 0.5) < 1e-12);
});

test('rejects incomplete PCM16 samples', {
  skip: !nativeAvailable,
}, () => {
  assert.throws(
    () => analyzePcm16(Buffer.from([1, 2, 3])),
    TypeError,
  );
});

test('rejects empty PCM16 input', {
  skip: !nativeAvailable,
}, () => {
  assert.throws(
    () => analyzePcm16(Buffer.alloc(0)),
    TypeError,
  );
});

test('rejects non-Buffer input', {
  skip: !nativeAvailable,
}, () => {
  assert.throws(
    () => analyzePcm16('not a buffer'),
    TypeError,
  );
});

test('rejects extra arguments', { skip: !nativeAvailable }, () => {
  assert.throws(
    () => analyzePcm16(Buffer.alloc(2), 'extra'),
    TypeError,
  );
});
