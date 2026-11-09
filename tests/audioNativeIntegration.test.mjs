import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { analyzeWavPcm16 } from '../src/audio/analyzeWavPcm16.mjs';
import {
  nativeAvailable,
  nativePcm8Available,
  nativePcm24Available,
  nativePcm32Available,
  nativeFloat32Available,
  nativeFloat64Available,
} from '../src/native/cppEngine.mjs';
import { createApp } from '../src/server/server.mjs';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}` };

function makeWav(samples, { channels = 1, sampleRate = 16000 } = {}) {
  const pcm = Buffer.alloc(samples.length * 2);

  samples.forEach((sample, index) => {
    pcm.writeInt16LE(sample, index * 2);
  });

  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(sampleRate * channels * 2, 8);
  fmt.writeUInt16LE(channels * 2, 12);
  fmt.writeUInt16LE(16, 14);

  const fmtHeader = Buffer.alloc(8);
  fmtHeader.write('fmt ', 0);
  fmtHeader.writeUInt32LE(fmt.length, 4);

  const dataHeader = Buffer.alloc(8);
  dataHeader.write('data', 0);
  dataHeader.writeUInt32LE(pcm.length, 4);

  const body = Buffer.concat([
    Buffer.from('WAVE'),
    fmtHeader,
    fmt,
    dataHeader,
    pcm,
  ]);

  const header = Buffer.alloc(8);
  header.write('RIFF', 0);
  header.writeUInt32LE(body.length, 4);

  return Buffer.concat([header, body]);
}


function makeExtensibleWav(
  samples,
  { channels = 6, sampleRate = 48000, channelMask = 0x3f } = {},
) {
  const pcm = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => pcm.writeInt16LE(sample, index * 2));

  const fmt = Buffer.alloc(40);
  fmt.writeUInt16LE(0xfffe, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(sampleRate * channels * 2, 8);
  fmt.writeUInt16LE(channels * 2, 12);
  fmt.writeUInt16LE(16, 14);
  fmt.writeUInt16LE(22, 16);
  fmt.writeUInt16LE(16, 18);
  fmt.writeUInt32LE(channelMask, 20);
  Buffer.from([
    0x01, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x10, 0x00,
    0x80, 0x00, 0x00, 0xaa,
    0x00, 0x38, 0x9b, 0x71,
  ]).copy(fmt, 24);

  const fmtHeader = Buffer.alloc(8);
  fmtHeader.write("fmt ", 0);
  fmtHeader.writeUInt32LE(fmt.length, 4);

  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0);
  dataHeader.writeUInt32LE(pcm.length, 4);

  const body = Buffer.concat([
    Buffer.from("WAVE"),
    fmtHeader,
    fmt,
    dataHeader,
    pcm,
  ]);

  const header = Buffer.alloc(8);
  header.write("RIFF", 0);
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

test('analyzes mono PCM16 WAV', () => {
  const wav = makeWav([-32768, 32767, 0, 16384]);
  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, true);
  assert.equal(result.engine, nativeAvailable ? 'cpp' : 'javascript');
  assert.equal(result.sampleCount, 4);
  assert.equal(result.peak, 1);
  assert.ok(result.rms > 0 && result.rms <= 1);
});

test("falls back to JavaScript when native analysis throws", () => {
  const wav = makeWav([-32768, 32767, 0, 16384]);
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("simulated_native_runtime_failure");
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.engine, "javascript");
  assert.equal(result.sampleCount, 4);
  assert.equal(result.peak, 1);
  assert.ok(result.rms > 0 && result.rms <= 1);
});

test('analyzes interleaved stereo PCM16 samples', () => {
  const wav = makeWav([-32768, 32767, 0, 0], { channels: 2 });
  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, true);
  assert.equal(result.sampleCount, 4);
  assert.equal(result.peak, 1);
});

test("C++ and JavaScript produce matching PCM16 metrics", () => {
  const samples = [-32768, 32767, 0, 16384, -16384, 8192, -8192, 1];
  const wav = makeWav(samples);
  assert.equal(nativeAvailable, true, "native C++ module must be built for this comparison");
  const cpp = analyzeWavPcm16(wav);

  const fallback = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("force_javascript_fallback");
    },
  });

  assert.equal(cpp.available, true);
  assert.equal(fallback.available, true);
  assert.equal(fallback.engine, "javascript");
  assert.equal(cpp.sampleCount, fallback.sampleCount);

  for (const key of ["peak", "rms", "peakDbfs", "rmsDbfs"]) {
    assert.ok(
      Math.abs(cpp[key] - fallback[key]) < 1e-12,
      key + " differs: " + cpp[key] + " vs " + fallback[key],
    );
  }
});

test('does not analyze non-PCM16 WAV', () => {
  const wav = makeWav([100, 200]);
  wav.writeUInt16LE(3, 20);

  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, false);
  assert.equal(result.reason, 'unsupported_pcm_format');
});

test('rejects malformed WAV chunk size safely', () => {
  const wav = makeWav([100, 200]);
  wav.writeUInt32LE(0xffffffff, 40);

  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, false);
  assert.equal(result.reason, 'invalid_chunk_size');
});

test("rejects inconsistent WAV byteRate", () => {
  const wav = makeWav([100, 200]);
  wav.writeUInt32LE(1, 28);

  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_format");
});

test("rejects duplicate WAV fmt chunks", () => {
  const original = makeWav([100, 200]);
  const wav = Buffer.concat([
    original.subarray(0, 36),
    original.subarray(12, 36),
    original.subarray(36),
  ]);
  wav.writeUInt32LE(wav.length - 8, 4);

  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_fmt_chunk");
});

test("rejects incomplete trailing WAV chunk header", () => {
  const original = makeWav([100, 200]);
  const wav = Buffer.concat([original, Buffer.from([1, 2, 3, 4])]);
  wav.writeUInt32LE(wav.length - 8, 4);

  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_chunk_header");
});


test("analyzes 3-channel and 6-channel PCM16 WAV", () => {
  for (const channels of [3, 6]) {
    const samples = Array.from(
      { length: channels * 2 },
      (_, index) => index % 2 === 0 ? 16384 : -16384,
    );
    const result = analyzeWavPcm16(makeWav(samples, { channels }));

    assert.equal(result.available, true);
    assert.equal(result.sampleCount, channels * 2);
    assert.equal(result.peak, 0.5);
    assert.ok(Math.abs(result.rms - 0.5) < 1e-12);
  }
});

test("accepts common PCM16 sample rates", () => {
  for (const sampleRate of [8000, 16000, 22050, 44100, 48000, 96000]) {
    const result = analyzeWavPcm16(
      makeWav([100, -100], { sampleRate }),
    );

    assert.equal(result.available, true, "sample rate: " + sampleRate);
    assert.equal(result.sampleCount, 2);
  }
});

test("rejects invalid PCM16 channel and format alignment fields", () => {
  const cases = [
    { offset: 22, value: 0 },
    { offset: 24, value: 0 },
    { offset: 32, value: 1 },
  ];

  for (const item of cases) {
    const wav = makeWav([100, 200]);
    wav.writeUInt16LE(item.value, item.offset);

    const result = analyzeWavPcm16(wav);

    assert.equal(result.available, false);
    assert.equal(result.reason, "invalid_pcm_format");
  }
});

test("rejects incomplete interleaved stereo frames", () => {
  const wav = makeWav([100, 200, 300], { channels: 2 });
  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_data_alignment");
});

test("accepts unknown odd-sized chunks with RIFF padding", () => {
  const original = makeWav([100, 200]);
  const fmtChunk = original.subarray(12, 36);
  const dataChunk = original.subarray(36);
  const junk = Buffer.alloc(10);
  junk.write("JUNK", 0);
  junk.writeUInt32LE(1, 4);
  junk[8] = 0x41;
  junk[9] = 0;

  const body = Buffer.concat([
    Buffer.from("WAVE"),
    fmtChunk,
    junk,
    dataChunk,
  ]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0);
  header.writeUInt32LE(body.length, 4);

  const result = analyzeWavPcm16(Buffer.concat([header, body]));

  assert.equal(result.available, true);
  assert.equal(result.sampleCount, 2);
});

test("accepts data chunk before fmt chunk", () => {
  const original = makeWav([100, 200]);
  const reorderedBody = Buffer.concat([
    Buffer.from("WAVE"),
    original.subarray(36),
    original.subarray(12, 36),
  ]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0);
  header.writeUInt32LE(reorderedBody.length, 4);

  const result = analyzeWavPcm16(Buffer.concat([header, reorderedBody]));

  assert.equal(result.available, true);
  assert.equal(result.sampleCount, 2);
});

test("rejects truncated RIFF chunk headers of 1 to 7 bytes", () => {
  const original = makeWav([100, 200]);

  for (let length = 1; length <= 7; length += 1) {
    const wav = Buffer.concat([
      original,
      Buffer.alloc(length, 0x41),
    ]);
    wav.writeUInt32LE(wav.length - 8, 4);

    const result = analyzeWavPcm16(wav);

    assert.equal(result.available, false, "trailing bytes: " + length);
    assert.equal(result.reason, "invalid_chunk_header");
  }
});

test("rejects odd-sized chunk without required RIFF padding", () => {
  const original = makeWav([100, 200]);
  const junk = Buffer.alloc(9);
  junk.write("JUNK", 0);
  junk.writeUInt32LE(1, 4);
  junk[8] = 0x41;

  const body = Buffer.concat([
    Buffer.from("WAVE"),
    original.subarray(12),
    junk,
  ]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0);
  header.writeUInt32LE(body.length, 4);

  const result = analyzeWavPcm16(Buffer.concat([header, body]));

  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_chunk_size");
});


test("analyzes WAVE_FORMAT_EXTENSIBLE 5.1 and 7.1 PCM16", () => {
  for (const item of [
    { channels: 6, channelMask: 0x3f },
    { channels: 8, channelMask: 0x63f },
  ]) {
    const samples = Array.from(
      { length: item.channels * 2 },
      (_, index) => index % 2 === 0 ? 16384 : -16384,
    );
    const result = analyzeWavPcm16(
      makeExtensibleWav(samples, item),
    );

    assert.equal(result.available, true);
    assert.equal(result.sampleCount, item.channels * 2);
    assert.equal(result.peak, 0.5);
    assert.ok(Math.abs(result.rms - 0.5) < 1e-12);
  }
});

test("accepts extensible PCM16 with an unspecified channel mask", () => {
  const result = analyzeWavPcm16(
    makeExtensibleWav([100, -100], { channels: 2, channelMask: 0 }),
  );

  assert.equal(result.available, true);
  assert.equal(result.sampleCount, 2);
});

test("rejects WAVE_FORMAT_EXTENSIBLE with a non-PCM SubFormat GUID", () => {
  const wav = makeExtensibleWav([100, -100]);
  wav.writeUInt32LE(2, 44);

  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, false);
  assert.equal(result.reason, "unsupported_pcm_format");
});

test("rejects truncated WAVE_FORMAT_EXTENSIBLE fmt chunks", () => {
  const wav = makeExtensibleWav([100, -100]);
  wav.writeUInt32LE(39, 16);

  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_fmt_chunk");
});

test("rejects invalid extensible cbSize and valid bits", () => {
  for (const item of [
    { offset: 36, value: 21 },
    { offset: 38, value: 24 },
  ]) {
    const wav = makeExtensibleWav([100, -100]);
    wav.writeUInt16LE(item.value, item.offset);

    const result = analyzeWavPcm16(wav);

    assert.equal(result.available, false);
    assert.equal(result.reason, "invalid_pcm_format");
  }
});

test("rejects extensible channel masks with the wrong speaker count", () => {
  const wav = makeExtensibleWav([100, -100], {
    channels: 2,
    channelMask: 0x3f,
  });

  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_format");
});


test("rejects extensible cbSize larger than available extension", () => {
  const wav = makeExtensibleWav([100, -100]);
  wav.writeUInt16LE(23, 36);
  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_fmt_chunk");
});

test("rejects PCM SubFormat GUID with a single incorrect byte", () => {
  const wav = makeExtensibleWav([100, -100]);
  wav[59] ^= 1;
  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, false);
  assert.equal(result.reason, "unsupported_pcm_format");
});

test("rejects extensible valid bits other than 16", () => {
  for (const value of [0, 1, 15, 24, 32]) {
    const wav = makeExtensibleWav([100, -100]);
    wav.writeUInt16LE(value, 38);
    const result = analyzeWavPcm16(wav);
    assert.equal(result.available, false, "validBits=" + value);
    assert.equal(result.reason, "invalid_pcm_format");
  }
});

test("rejects channel masks with too few or too many speaker bits", () => {
  for (const channelMask of [0x01, 0x07, 0xffffffff]) {
    const wav = makeExtensibleWav([100, -100], {
      channels: 2,
      channelMask,
    });
    const result = analyzeWavPcm16(wav);
    assert.equal(result.available, false, "channelMask=" + channelMask);
    assert.equal(result.reason, "invalid_pcm_format");
  }
});

test('production audio route returns legacy data and native analysis', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqai-native-audio-'));
  const server = createApp({
    storageDir: dir,
    audioStorageDir: path.join(dir, 'audio'),
    maxUploadBytes: 1000,
    token: TOKEN,
    corsOrigin: '',
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });

  const wav = makeWav([-32768, 32767, 0, 16384]);

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/v1/audio/inspect`,
    {
      method: 'POST',
      headers: auth,
      body: wav,
    },
  );

  assert.equal(response.status, 200);

  const json = await response.json();
  assert.equal(json.ok, true);
  assert.equal(json.data.ok, true);
  assert.equal(json.data.audioFormat, 1);
  assert.equal(json.data.bitsPerSample, 16);
  assert.equal(json.analysis.available, true);
  assert.equal(json.analysis.engine, nativeAvailable ? 'cpp' : 'javascript');
  assert.equal(json.analysis.sampleCount, 4);
  assert.equal(json.error, null);
});


function makePcm24Wav(
  samples,
  { channels = 1, sampleRate = 48000, extensible = false, channelMask = 0 } = {},
) {
  const pcm = Buffer.alloc(samples.length * 3);

  samples.forEach((sample, index) => {
    pcm.writeUIntLE(sample & 0xffffff, index * 3, 3);
  });

  const fmt = Buffer.alloc(extensible ? 40 : 16);
  fmt.writeUInt16LE(extensible ? 0xfffe : 1, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(sampleRate * channels * 3, 8);
  fmt.writeUInt16LE(channels * 3, 12);
  fmt.writeUInt16LE(24, 14);

  if (extensible) {
    fmt.writeUInt16LE(22, 16);
    fmt.writeUInt16LE(24, 18);
    fmt.writeUInt32LE(channelMask, 20);
    Buffer.from([
      0x01, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x10, 0x00,
      0x80, 0x00, 0x00, 0xaa,
      0x00, 0x38, 0x9b, 0x71,
    ]).copy(fmt, 24);
  }

  const fmtHeader = Buffer.alloc(8);
  fmtHeader.write("fmt ", 0);
  fmtHeader.writeUInt32LE(fmt.length, 4);

  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0);
  dataHeader.writeUInt32LE(pcm.length, 4);

  const body = Buffer.concat([
    Buffer.from("WAVE"),
    fmtHeader,
    fmt,
    dataHeader,
    pcm,
  ]);

  const header = Buffer.alloc(8);
  header.write("RIFF", 0);
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}


function makeFloat32Wav(
  samples,
  { channels = 1, sampleRate = 48000, extensible = false, channelMask = 0 } = {},
) {
  const pcm = Buffer.alloc(samples.length * 4);
  samples.forEach((sample, index) => pcm.writeFloatLE(sample, index * 4));

  const fmt = Buffer.alloc(extensible ? 40 : 16);
  fmt.writeUInt16LE(extensible ? 0xfffe : 3, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(sampleRate * channels * 4, 8);
  fmt.writeUInt16LE(channels * 4, 12);
  fmt.writeUInt16LE(32, 14);

  if (extensible) {
    fmt.writeUInt16LE(22, 16);
    fmt.writeUInt16LE(32, 18);
    fmt.writeUInt32LE(channelMask, 20);
    Buffer.from([
      3, 0, 0, 0, 0, 0, 16, 0,
      128, 0, 0, 170, 0, 56, 155, 113,
    ]).copy(fmt, 24);
  }

  const fmtHeader = Buffer.alloc(8);
  fmtHeader.write("fmt ", 0);
  fmtHeader.writeUInt32LE(fmt.length, 4);

  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0);
  dataHeader.writeUInt32LE(pcm.length, 4);

  const body = Buffer.concat([
    Buffer.from("WAVE"), fmtHeader, fmt, dataHeader, pcm,
  ]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0);
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

test("analyzes mono PCM24 WAV with signed minimum and maximum samples", () => {
  const wav = makePcm24Wav([-8388608, 8388607, 0, 4194304]);
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("force_javascript_fallback");
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.engine, "javascript");
  assert.equal(result.sampleCount, 4);
  assert.equal(result.peak, 1);
  assert.ok(result.rms > 0 && result.rms <= 1);
});

test("analyzes interleaved multichannel PCM24 WAV", () => {
  const wav = makePcm24Wav(
    [-8388608, 8388607, 0, 4194304, -4194304, 1],
    { channels: 2 },
  );
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("force_javascript_fallback");
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.engine, "javascript");
  assert.equal(result.sampleCount, 6);
  assert.equal(result.peak, 1);
});

test("analyzes extensible 24-bit PCM WAV with a 5.1 channel mask", () => {
  const wav = makePcm24Wav(
    [-8388608, 8388607, 0, 4194304, -4194304, 1],
    { channels: 6, extensible: true, channelMask: 0x3f },
  );
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("force_javascript_fallback");
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.engine, "javascript");
  assert.equal(result.sampleCount, 6);
  assert.equal(result.peak, 1);
});

test("accepts extensible 24-bit PCM WAV with zero channel mask", () => {
  const wav = makePcm24Wav([0, 1], {
    channels: 2,
    extensible: true,
    channelMask: 0,
  });
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("force_javascript_fallback");
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.sampleCount, 2);
});

test("rejects extensible PCM24 when valid bits do not match", () => {
  const wav = makePcm24Wav([0, 1], {
    extensible: true,
    channelMask: 0,
  });
  wav.writeUInt16LE(20, 38);

  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_format");
});

test("rejects PCM24 WAV with invalid block alignment", () => {
  const wav = makePcm24Wav([0, 1, 2, 3], { channels: 2 });
  wav.writeUInt16LE(5, 32);

  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_format");
});

test("rejects PCM24 WAV with inconsistent byte rate", () => {
  const wav = makePcm24Wav([0, 1, 2, 3], { channels: 2 });
  wav.writeUInt32LE(1, 28);

  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_format");
});

test("C++ and JavaScript produce matching PCM24 metrics", {
  skip: !nativePcm24Available,
}, () => {
  const wav = makePcm24Wav([
    -8388608, 8388607, 0, 4194304,
    -4194304, 2097152, -2097152, 1,
  ]);

  const cpp = analyzeWavPcm16(wav);
  const fallback = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("force_javascript_fallback");
    },
  });

  assert.equal(cpp.available, true);
  assert.equal(cpp.engine, "cpp");
  assert.equal(fallback.available, true);
  assert.equal(fallback.engine, "javascript");
  assert.equal(cpp.sampleCount, fallback.sampleCount);

  for (const key of ["peak", "rms", "peakDbfs", "rmsDbfs"]) {
    assert.ok(
      Math.abs(cpp[key] - fallback[key]) < 1e-12,
      key + " differs: " + cpp[key] + " vs " + fallback[key],
    );
  }
});


function makeFloat64Wav(
  samples,
  { channels = 1, sampleRate = 48000, extensible = false, channelMask = 0 } = {},
) {
  const pcm = Buffer.alloc(samples.length * 8);
  samples.forEach((sample, index) => pcm.writeDoubleLE(sample, index * 8));

  const fmt = Buffer.alloc(extensible ? 40 : 16);
  fmt.writeUInt16LE(extensible ? 0xfffe : 3, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(sampleRate * channels * 8, 8);
  fmt.writeUInt16LE(channels * 8, 12);
  fmt.writeUInt16LE(64, 14);

  if (extensible) {
    fmt.writeUInt16LE(22, 16);
    fmt.writeUInt16LE(64, 18);
    fmt.writeUInt32LE(channelMask, 20);
    Buffer.from([
      3, 0, 0, 0, 0, 0, 16, 0,
      128, 0, 0, 170, 0, 56, 155, 113,
    ]).copy(fmt, 24);
  }

  const fmtHeader = Buffer.alloc(8);
  fmtHeader.write("fmt ", 0);
  fmtHeader.writeUInt32LE(fmt.length, 4);

  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0);
  dataHeader.writeUInt32LE(pcm.length, 4);

  const body = Buffer.concat([
    Buffer.from("WAVE"), fmtHeader, fmt, dataHeader, pcm,
  ]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0);
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

test("analyzes classic Float32 WAV using JavaScript fallback", () => {
  const wav = makeFloat32Wav([-1, -0.5, 0, 0.5, 1]);
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() { throw new Error("force_javascript_fallback"); },
  });

  assert.equal(result.available, true);
  assert.equal(result.engine, "javascript");
  assert.equal(result.sampleCount, 5);
  assert.equal(result.peak, 1);
  assert.ok(Math.abs(result.rms - Math.sqrt(0.5)) < 1e-12);
  assert.equal(result.peakDbfs, 0);
});

test("preserves Float32 values above full scale", () => {
  const wav = makeFloat32Wav([0, 2, -0.5]);
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() { throw new Error("force_javascript_fallback"); },
  });

  assert.equal(result.available, true);
  assert.equal(result.peak, 2);
  assert.ok(result.peakDbfs > 6);
});

test("analyzes extensible multichannel Float32 WAV", () => {
  const wav = makeFloat32Wav(
    [-1, 1, 0.5, -0.5, 0.25, -0.25],
    { channels: 6, extensible: true, channelMask: 0x3f },
  );
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() { throw new Error("force_javascript_fallback"); },
  });

  assert.equal(result.available, true);
  assert.equal(result.sampleCount, 6);
  assert.equal(result.peak, 1);
});

test("accepts extensible Float32 WAV with zero channel mask", () => {
  const wav = makeFloat32Wav([0, 0.5], {
    channels: 2, extensible: true, channelMask: 0,
  });
  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, true);
  assert.equal(result.sampleCount, 2);
});

test("rejects extensible Float32 WAV with invalid valid bits", () => {
  const wav = makeFloat32Wav([0, 0.5], { extensible: true });
  wav.writeUInt16LE(24, 38);
  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_format");
});

test("C++ and JavaScript produce matching Float32 WAV metrics", {
  skip: !nativeFloat32Available,
}, () => {
  const wav = makeFloat32Wav([-1, 0.75, 0, 0.5, -0.25, 0.125, 2, -1.5]);
  const cpp = analyzeWavPcm16(wav);
  const fallback = analyzeWavPcm16(wav, {
    nativeAnalyzer() { throw new Error("force_javascript_fallback"); },
  });

  assert.equal(cpp.available, true);
  assert.equal(cpp.engine, "cpp");
  assert.equal(fallback.available, true);
  assert.equal(fallback.engine, "javascript");
  assert.equal(cpp.sampleCount, fallback.sampleCount);

  for (const key of ["peak", "rms", "peakDbfs", "rmsDbfs"]) {
    assert.ok(
      Math.abs(cpp[key] - fallback[key]) < 1e-12,
      key + " differs: " + cpp[key] + " vs " + fallback[key],
    );
  }
});

test("rejects non-finite Float32 WAV samples", () => {
  for (const sample of [NaN, Infinity, -Infinity]) {
    const wav = makeFloat32Wav([0, sample, 1]);
    assert.throws(
      () => analyzeWavPcm16(wav),
      /Float32 samples must be finite/,
    );
  }
});


test("analyzes classic Float64 WAV using JavaScript fallback", () => {
  const wav = makeFloat64Wav([-1, -0.5, 0, 0.5, 1]);
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() { throw new Error("force_javascript_fallback"); },
  });

  assert.equal(result.available, true);
  assert.equal(result.engine, "javascript");
  assert.equal(result.sampleCount, 5);
  assert.equal(result.peak, 1);
  assert.ok(Math.abs(result.rms - Math.sqrt(0.5)) < 1e-12);
  assert.equal(result.peakDbfs, 0);
});

test("preserves Float64 values above full scale", () => {
  const wav = makeFloat64Wav([0, 2, -0.5]);
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() { throw new Error("force_javascript_fallback"); },
  });

  assert.equal(result.available, true);
  assert.equal(result.engine, "javascript");
  assert.equal(result.peak, 2);
  assert.ok(result.peakDbfs > 6);
});

test("analyzes extensible multichannel Float64 WAV", () => {
  const wav = makeFloat64Wav(
    [-1, 1, 0.5, -0.5, 0.25, -0.25],
    { channels: 6, extensible: true, channelMask: 0x3f },
  );
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() { throw new Error("force_javascript_fallback"); },
  });

  assert.equal(result.available, true);
  assert.equal(result.sampleCount, 6);
  assert.equal(result.peak, 1);
});

test("accepts extensible Float64 WAV with zero channel mask", () => {
  const wav = makeFloat64Wav([0, 0.5], {
    channels: 2, extensible: true, channelMask: 0,
  });
  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, true);
  assert.equal(result.sampleCount, 2);
});

test("rejects extensible Float64 WAV with invalid valid bits", () => {
  const wav = makeFloat64Wav([0, 0.5], { extensible: true });
  wav.writeUInt16LE(32, 38);
  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_format");
});

test("C++ and JavaScript produce matching Float64 WAV metrics", {
  skip: !nativeFloat64Available,
}, () => {
  const wav = makeFloat64Wav([-1, 0.75, 0, 0.5, -0.25, 0.125, 2, -1.5]);
  const cpp = analyzeWavPcm16(wav);
  const fallback = analyzeWavPcm16(wav, {
    nativeAnalyzer() { throw new Error("force_javascript_fallback"); },
  });

  assert.equal(cpp.available, true);
  assert.equal(cpp.engine, "cpp");
  assert.equal(fallback.available, true);
  assert.equal(fallback.engine, "javascript");
  assert.equal(cpp.sampleCount, fallback.sampleCount);

  for (const key of ["peak", "rms", "peakDbfs", "rmsDbfs"]) {
    assert.ok(
      Math.abs(cpp[key] - fallback[key]) < 1e-12,
      key + " differs: " + cpp[key] + " vs " + fallback[key],
    );
  }
});

test("rejects non-finite Float64 WAV samples", () => {
  for (const sample of [NaN, Infinity, -Infinity]) {
    const wav = makeFloat64Wav([0, sample, 1]);
    assert.throws(
      () => analyzeWavPcm16(wav),
      /Float64 samples must be finite/,
    );
  }
});


function makePcmIntegerWav(
  samples,
  { bits = 8, channels = 1, sampleRate = 48000, extensible = false, channelMask = 0 } = {},
) {
  if (bits !== 8 && bits !== 32) {
    throw new RangeError("PCM integer helper supports only 8-bit and 32-bit");
  }

  const bytesPerSample = bits / 8;
  const pcm = Buffer.alloc(samples.length * bytesPerSample);

  samples.forEach((sample, index) => {
    if (bits === 8) {
      pcm.writeUInt8(sample, index);
    } else {
      pcm.writeInt32LE(sample, index * 4);
    }
  });

  const fmt = Buffer.alloc(extensible ? 40 : 16);
  fmt.writeUInt16LE(extensible ? 0xfffe : 1, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(sampleRate * channels * bytesPerSample, 8);
  fmt.writeUInt16LE(channels * bytesPerSample, 12);
  fmt.writeUInt16LE(bits, 14);

  if (extensible) {
    fmt.writeUInt16LE(22, 16);
    fmt.writeUInt16LE(bits, 18);
    fmt.writeUInt32LE(channelMask, 20);
    Buffer.from([
      1, 0, 0, 0, 0, 0, 16, 0,
      128, 0, 0, 170, 0, 56, 155, 113,
    ]).copy(fmt, 24);
  }

  const fmtHeader = Buffer.alloc(8);
  fmtHeader.write("fmt ", 0);
  fmtHeader.writeUInt32LE(fmt.length, 4);

  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0);
  dataHeader.writeUInt32LE(pcm.length, 4);

  const body = Buffer.concat([
    Buffer.from("WAVE"),
    fmtHeader,
    fmt,
    dataHeader,
    pcm,
  ]);

  const header = Buffer.alloc(8);
  header.write("RIFF", 0);
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

test("analyzes classic PCM8 WAV using JavaScript fallback", () => {
  const wav = makePcmIntegerWav([0, 128, 255, 192]);
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("force_javascript_fallback");
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.engine, "javascript");
  assert.equal(result.sampleCount, 4);
  assert.equal(result.peak, 1);
  assert.ok(result.rms > 0 && result.rms <= 1);
  assert.equal(result.peakDbfs, 0);
});

test("analyzes extensible multichannel PCM8 WAV", () => {
  const wav = makePcmIntegerWav(
    [0, 128, 255, 64, 192, 128],
    { bits: 8, channels: 6, extensible: true, channelMask: 0x3f },
  );
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("force_javascript_fallback");
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.engine, "javascript");
  assert.equal(result.sampleCount, 6);
  assert.equal(result.peak, 1);
});

test("accepts extensible PCM8 WAV with zero channel mask", () => {
  const wav = makePcmIntegerWav(
    [128, 192],
    { bits: 8, channels: 2, extensible: true, channelMask: 0 },
  );
  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, true);
  assert.equal(result.sampleCount, 2);
});

test("rejects extensible PCM8 WAV with invalid valid bits", () => {
  const wav = makePcmIntegerWav(
    [0, 128],
    { bits: 8, extensible: true },
  );
  wav.writeUInt16LE(7, 38);

  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_format");
});

test("rejects PCM8 WAV with invalid block alignment", () => {
  const wav = makePcmIntegerWav([0, 128, 255, 64], { channels: 2 });
  wav.writeUInt16LE(1, 32);

  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_format");
});

test("analyzes classic PCM32 WAV using JavaScript fallback", () => {
  const wav = makePcmIntegerWav(
    [-2147483648, -1073741824, 0, 2147483647],
    { bits: 32 },
  );
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("force_javascript_fallback");
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.engine, "javascript");
  assert.equal(result.sampleCount, 4);
  assert.equal(result.peak, 1);
  assert.ok(result.rms > 0 && result.rms <= 1);
  assert.equal(result.peakDbfs, 0);
});

test("analyzes extensible multichannel PCM32 WAV", () => {
  const wav = makePcmIntegerWav(
    [-2147483648, 2147483647, 0, 1073741824, -1073741824, 1],
    { bits: 32, channels: 6, extensible: true, channelMask: 0x3f },
  );
  const result = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("force_javascript_fallback");
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.engine, "javascript");
  assert.equal(result.sampleCount, 6);
  assert.equal(result.peak, 1);
});

test("accepts extensible PCM32 WAV with zero channel mask", () => {
  const wav = makePcmIntegerWav(
    [0, 1073741824],
    { bits: 32, channels: 2, extensible: true, channelMask: 0 },
  );
  const result = analyzeWavPcm16(wav);

  assert.equal(result.available, true);
  assert.equal(result.sampleCount, 2);
});

test("rejects extensible PCM32 WAV with invalid valid bits", () => {
  const wav = makePcmIntegerWav(
    [0, 1073741824],
    { bits: 32, extensible: true },
  );
  wav.writeUInt16LE(24, 38);

  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_format");
});

test("rejects PCM32 WAV with invalid block alignment", () => {
  const wav = makePcmIntegerWav(
    [0, 1073741824, -1073741824, 1],
    { bits: 32, channels: 2 },
  );
  wav.writeUInt16LE(4, 32);

  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_format");
});

test("rejects PCM32 WAV with inconsistent byte rate", () => {
  const wav = makePcmIntegerWav(
    [0, 1073741824],
    { bits: 32, channels: 2 },
  );
  wav.writeUInt32LE(1, 28);

  const result = analyzeWavPcm16(wav);
  assert.equal(result.available, false);
  assert.equal(result.reason, "invalid_pcm_format");
});

test("C++ and JavaScript produce matching PCM8 WAV metrics", {
  skip: !nativePcm8Available,
}, () => {
  const wav = makePcmIntegerWav([0, 128, 255, 64, 192, 128]);
  const cpp = analyzeWavPcm16(wav);
  const fallback = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("force_javascript_fallback");
    },
  });

  assert.equal(cpp.available, true);
  assert.equal(cpp.engine, "cpp");
  assert.equal(fallback.available, true);
  assert.equal(fallback.engine, "javascript");
  assert.equal(cpp.sampleCount, fallback.sampleCount);

  for (const key of ["peak", "rms", "peakDbfs", "rmsDbfs"]) {
    assert.ok(Math.abs(cpp[key] - fallback[key]) < 1e-12);
  }
});

test("C++ and JavaScript produce matching PCM32 WAV metrics", {
  skip: !nativePcm32Available,
}, () => {
  const wav = makePcmIntegerWav(
    [-2147483648, 2147483647, 0, 1073741824, -1073741824, 1],
    { bits: 32 },
  );
  const cpp = analyzeWavPcm16(wav);
  const fallback = analyzeWavPcm16(wav, {
    nativeAnalyzer() {
      throw new Error("force_javascript_fallback");
    },
  });

  assert.equal(cpp.available, true);
  assert.equal(cpp.engine, "cpp");
  assert.equal(fallback.available, true);
  assert.equal(fallback.engine, "javascript");
  assert.equal(cpp.sampleCount, fallback.sampleCount);

  for (const key of ["peak", "rms", "peakDbfs", "rmsDbfs"]) {
    assert.ok(Math.abs(cpp[key] - fallback[key]) < 1e-12);
  }
});
