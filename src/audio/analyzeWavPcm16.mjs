import {
  analyzePcm16,
  nativeAvailable,
} from '../native/cppEngine.mjs';

function parsePcm16Data(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) {
    return { ok: false, reason: 'invalid_wav' };
  }

  if (
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    return { ok: false, reason: 'not_wav' };
  }

  const riffEnd = 8 + buf.readUInt32LE(4);

  if (riffEnd < 12 || riffEnd > buf.length) {
    return { ok: false, reason: 'invalid_riff_size' };
  }

  let pos = 12;
  let fmt = null;
  let data = null;

  while (pos + 8 <= riffEnd) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    const end = body + size;
    const paddedEnd = end + (size & 1);

    if (
      !Number.isSafeInteger(end) ||
      end > riffEnd ||
      paddedEnd > riffEnd
    ) {
      return { ok: false, reason: 'invalid_chunk_size' };
    }

    if (id === 'fmt ') {
      if (size < 16) {
        return { ok: false, reason: 'invalid_fmt_chunk' };
      }

      fmt = {
        audioFormat: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        byteRate: buf.readUInt32LE(body + 8),
        blockAlign: buf.readUInt16LE(body + 12),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data' && data === null) {
      data = buf.subarray(body, end);
    }

    pos = paddedEnd;
  }

  if (!fmt) return { ok: false, reason: 'no_fmt_chunk' };
  if (!data) return { ok: false, reason: 'no_data_chunk' };

  if (fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) {
    return { ok: false, reason: 'unsupported_pcm_format' };
  }

  if (
    fmt.channels < 1 ||
    fmt.sampleRate < 1 ||
    fmt.blockAlign !== fmt.channels * 2
  ) {
    return { ok: false, reason: 'invalid_pcm_format' };
  }

  if (data.length === 0 || data.length % fmt.blockAlign !== 0) {
    return { ok: false, reason: 'invalid_pcm_data_alignment' };
  }

  return { ok: true, fmt, data };
}

function analyzePcm16JavaScript(buffer) {
  const sampleCount = buffer.length / 2;
  let peak = 0;
  let sumSquares = 0;

  for (let offset = 0; offset < buffer.length; offset += 2) {
    const sample = buffer.readInt16LE(offset);
    const normalized = sample / 32768;
    const magnitude = Math.abs(normalized);

    if (magnitude > peak) peak = magnitude;
    sumSquares += normalized * normalized;
  }

  const rms = Math.sqrt(sumSquares / sampleCount);

  return {
    sampleCount,
    peak,
    rms,
    peakDbfs: peak > 0 ? 20 * Math.log10(peak) : -160,
    rmsDbfs: rms > 0 ? 20 * Math.log10(rms) : -160,
  };
}

export function analyzeWavPcm16(buf) {
  const parsed = parsePcm16Data(buf);

  if (!parsed.ok) {
    return {
      available: false,
      reason: parsed.reason,
    };
  }

  const metrics = nativeAvailable
    ? analyzePcm16(parsed.data)
    : analyzePcm16JavaScript(parsed.data);

  return {
    available: true,
    engine: nativeAvailable ? 'cpp' : 'javascript',
    ...metrics,
  };
}
