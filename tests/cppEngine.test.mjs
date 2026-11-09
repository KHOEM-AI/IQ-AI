import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzePcm8,
  analyzePcm16,
  analyzePcm24,
  analyzePcm32,
  analyzeFloat32,
  analyzeFloat64,
  nativeAvailable,
  nativePcm8Available,
  nativePcm24Available,
  nativePcm32Available,
  nativeFloat32Available,
  nativeFloat64Available,
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


test("C++ Native PCM24 Module is available after build", {
  skip: !nativePcm24Available,
}, () => {
  assert.equal(nativePcm24Available, true);
});

test("analyzes PCM24 peak, RMS and sample count", {
  skip: !nativePcm24Available,
}, () => {
  const pcm = Buffer.alloc(12);
  pcm.writeIntLE(-8388608, 0, 3);
  pcm.writeIntLE(8388607, 3, 3);
  pcm.writeIntLE(0, 6, 3);
  pcm.writeIntLE(4194304, 9, 3);

  const result = analyzePcm24(pcm);

  assert.equal(result.sampleCount, 4);
  assert.equal(result.peak, 1);
  assert.ok(result.rms > 0 && result.rms <= 1);
  assert.ok(result.peakDbfs <= 0);
  assert.ok(result.rmsDbfs <= 0);
});

test("handles PCM24 silence correctly", {
  skip: !nativePcm24Available,
}, () => {
  const result = analyzePcm24(Buffer.alloc(3072));

  assert.equal(result.sampleCount, 1024);
  assert.equal(result.peak, 0);
  assert.equal(result.rms, 0);
  assert.equal(result.peakDbfs, -160);
  assert.equal(result.rmsDbfs, -160);
});

test("handles PCM24 minimum and maximum values", {
  skip: !nativePcm24Available,
}, () => {
  const pcm = Buffer.alloc(6);
  pcm.writeIntLE(-8388608, 0, 3);
  pcm.writeIntLE(8388607, 3, 3);

  const result = analyzePcm24(pcm);

  assert.equal(result.sampleCount, 2);
  assert.equal(result.peak, 1);
  assert.ok(result.rms <= 1);
  assert.ok(result.rms > 0.999);
});

test("rejects incomplete PCM24 samples", {
  skip: !nativePcm24Available,
}, () => {
  assert.throws(
    () => analyzePcm24(Buffer.from([1, 2])),
    TypeError,
  );
});

test("rejects empty PCM24 input", {
  skip: !nativePcm24Available,
}, () => {
  assert.throws(
    () => analyzePcm24(Buffer.alloc(0)),
    TypeError,
  );
});

test("rejects non-Buffer PCM24 input", {
  skip: !nativePcm24Available,
}, () => {
  assert.throws(
    () => analyzePcm24("not a buffer"),
    TypeError,
  );
});

test("rejects extra PCM24 arguments", {
  skip: !nativePcm24Available,
}, () => {
  assert.throws(
    () => analyzePcm24(Buffer.alloc(3), "extra"),
    TypeError,
  );
});


test("C++ Native Float32 Module is available after build", {
  skip: !nativeFloat32Available,
}, () => {
  assert.equal(nativeFloat32Available, true);
});

test("analyzes Float32 peak, RMS and sample count", {
  skip: !nativeFloat32Available,
}, () => {
  const pcm = Buffer.alloc(20);
  [-1, -0.5, 0, 0.5, 1].forEach((sample, index) => {
    pcm.writeFloatLE(sample, index * 4);
  });
  const result = analyzeFloat32(pcm);

  assert.equal(result.sampleCount, 5);
  assert.equal(result.peak, 1);
  assert.ok(Math.abs(result.rms - Math.sqrt(0.5)) < 1e-12);
  assert.equal(result.peakDbfs, 0);
});

test("handles Float32 silence correctly", {
  skip: !nativeFloat32Available,
}, () => {
  const result = analyzeFloat32(Buffer.alloc(4096));
  assert.equal(result.sampleCount, 1024);
  assert.equal(result.peak, 0);
  assert.equal(result.rms, 0);
  assert.equal(result.peakDbfs, -160);
  assert.equal(result.rmsDbfs, -160);
});

test("preserves finite Float32 samples above full scale", {
  skip: !nativeFloat32Available,
}, () => {
  const pcm = Buffer.alloc(8);
  pcm.writeFloatLE(2, 0);
  pcm.writeFloatLE(-0.5, 4);
  const result = analyzeFloat32(pcm);

  assert.equal(result.sampleCount, 2);
  assert.equal(result.peak, 2);
  assert.ok(result.peakDbfs > 6);
});

test("rejects incomplete Float32 samples", {
  skip: !nativeFloat32Available,
}, () => {
  assert.throws(() => analyzeFloat32(Buffer.from([1, 2, 3])), TypeError);
});

test("rejects empty Float32 input", {
  skip: !nativeFloat32Available,
}, () => {
  assert.throws(() => analyzeFloat32(Buffer.alloc(0)), TypeError);
});

test("rejects non-Buffer Float32 input", {
  skip: !nativeFloat32Available,
}, () => {
  assert.throws(() => analyzeFloat32("not a buffer"), TypeError);
});

test("rejects extra Float32 arguments", {
  skip: !nativeFloat32Available,
}, () => {
  assert.throws(() => analyzeFloat32(Buffer.alloc(4), "extra"), TypeError);
});

test("rejects NaN and infinite Float32 samples", {
  skip: !nativeFloat32Available,
}, () => {
  for (const sample of [NaN, Infinity, -Infinity]) {
    const pcm = Buffer.alloc(4);
    pcm.writeFloatLE(sample, 0);
    assert.throws(
      () => analyzeFloat32(pcm),
      /Float32 samples must be finite/,
    );
  }
});


test("C++ Native Float64 Module is available after build", {
  skip: !nativeFloat64Available,
}, () => {
  assert.equal(nativeFloat64Available, true);
});

test("analyzes Float64 peak, RMS and sample count", {
  skip: !nativeFloat64Available,
}, () => {
  const pcm = Buffer.alloc(40);
  [-1, -0.5, 0, 0.5, 1].forEach((sample, index) => {
    pcm.writeDoubleLE(sample, index * 8);
  });

  const result = analyzeFloat64(pcm);
  assert.equal(result.sampleCount, 5);
  assert.equal(result.peak, 1);
  assert.ok(Math.abs(result.rms - Math.sqrt(0.5)) < 1e-12);
  assert.equal(result.peakDbfs, 0);
});

test("handles Float64 silence correctly", {
  skip: !nativeFloat64Available,
}, () => {
  const result = analyzeFloat64(Buffer.alloc(4096));
  assert.equal(result.sampleCount, 512);
  assert.equal(result.peak, 0);
  assert.equal(result.rms, 0);
  assert.equal(result.peakDbfs, -160);
  assert.equal(result.rmsDbfs, -160);
});

test("preserves finite Float64 samples above full scale", {
  skip: !nativeFloat64Available,
}, () => {
  const pcm = Buffer.alloc(16);
  pcm.writeDoubleLE(2, 0);
  pcm.writeDoubleLE(-0.5, 8);

  const result = analyzeFloat64(pcm);
  assert.equal(result.sampleCount, 2);
  assert.equal(result.peak, 2);
  assert.ok(result.peakDbfs > 6);
});

test("rejects incomplete Float64 samples", {
  skip: !nativeFloat64Available,
}, () => {
  assert.throws(() => analyzeFloat64(Buffer.from([1, 2, 3])), TypeError);
});

test("rejects empty Float64 input", {
  skip: !nativeFloat64Available,
}, () => {
  assert.throws(() => analyzeFloat64(Buffer.alloc(0)), TypeError);
});

test("rejects non-Buffer Float64 input", {
  skip: !nativeFloat64Available,
}, () => {
  assert.throws(() => analyzeFloat64("not a buffer"), TypeError);
});

test("rejects extra Float64 arguments", {
  skip: !nativeFloat64Available,
}, () => {
  assert.throws(() => analyzeFloat64(Buffer.alloc(8), "extra"), TypeError);
});

test("rejects NaN and infinite Float64 samples", {
  skip: !nativeFloat64Available,
}, () => {
  for (const sample of [NaN, Infinity, -Infinity]) {
    const pcm = Buffer.alloc(8);
    pcm.writeDoubleLE(sample, 0);
    assert.throws(
      () => analyzeFloat64(pcm),
      /Float64 samples must be finite/,
    );
  }
});


test("C++ Native PCM8 Module is available after build", {
  skip: !nativePcm8Available,
}, () => {
  assert.equal(nativePcm8Available, true);
});

test("analyzes PCM8 peak, RMS and sample count", {
  skip: !nativePcm8Available,
}, () => {
  const pcm = Buffer.from([0, 128, 255, 192]);
  const result = analyzePcm8(pcm);

  assert.equal(result.sampleCount, 4);
  assert.equal(result.peak, 1);
  assert.ok(result.rms > 0 && result.rms <= 1);
  assert.equal(result.peakDbfs, 0);
  assert.ok(result.rmsDbfs <= 0);
});

test("handles PCM8 silence correctly", {
  skip: !nativePcm8Available,
}, () => {
  const result = analyzePcm8(Buffer.alloc(256, 128));

  assert.equal(result.sampleCount, 256);
  assert.equal(result.peak, 0);
  assert.equal(result.rms, 0);
  assert.equal(result.peakDbfs, -160);
  assert.equal(result.rmsDbfs, -160);
});

test("handles PCM8 minimum and maximum values", {
  skip: !nativePcm8Available,
}, () => {
  const result = analyzePcm8(Buffer.from([0, 255]));

  assert.equal(result.sampleCount, 2);
  assert.equal(result.peak, 1);
  assert.ok(Math.abs(result.rms - Math.sqrt((1 + (127 / 128) ** 2) / 2)) < 1e-12);
});

test("rejects empty, non-Buffer and extra PCM8 input", {
  skip: !nativePcm8Available,
}, () => {
  assert.throws(() => analyzePcm8(Buffer.alloc(0)), TypeError);
  assert.throws(() => analyzePcm8("not a buffer"), TypeError);
  assert.throws(() => analyzePcm8(Buffer.from([128]), "extra"), TypeError);
});

test("C++ Native PCM32 Module is available after build", {
  skip: !nativePcm32Available,
}, () => {
  assert.equal(nativePcm32Available, true);
});

test("analyzes PCM32 peak, RMS and sample count", {
  skip: !nativePcm32Available,
}, () => {
  const pcm = Buffer.alloc(16);
  [-2147483648, -1073741824, 0, 2147483647].forEach((sample, index) => {
    pcm.writeInt32LE(sample, index * 4);
  });

  const result = analyzePcm32(pcm);

  assert.equal(result.sampleCount, 4);
  assert.equal(result.peak, 1);
  assert.ok(result.rms > 0 && result.rms <= 1);
  assert.equal(result.peakDbfs, 0);
  assert.ok(result.rmsDbfs <= 0);
});

test("handles PCM32 silence correctly", {
  skip: !nativePcm32Available,
}, () => {
  const result = analyzePcm32(Buffer.alloc(1024));

  assert.equal(result.sampleCount, 256);
  assert.equal(result.peak, 0);
  assert.equal(result.rms, 0);
  assert.equal(result.peakDbfs, -160);
  assert.equal(result.rmsDbfs, -160);
});

test("rejects incomplete, empty, non-Buffer and extra PCM32 input", {
  skip: !nativePcm32Available,
}, () => {
  assert.throws(() => analyzePcm32(Buffer.from([1, 2, 3])), TypeError);
  assert.throws(() => analyzePcm32(Buffer.alloc(0)), TypeError);
  assert.throws(() => analyzePcm32("not a buffer"), TypeError);
  assert.throws(() => analyzePcm32(Buffer.alloc(4), "extra"), TypeError);
});
