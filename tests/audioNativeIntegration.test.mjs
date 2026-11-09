import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { analyzeWavPcm16 } from '../src/audio/analyzeWavPcm16.mjs';
import { nativeAvailable } from '../src/native/cppEngine.mjs';
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
