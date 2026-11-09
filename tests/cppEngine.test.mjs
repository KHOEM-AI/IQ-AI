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
