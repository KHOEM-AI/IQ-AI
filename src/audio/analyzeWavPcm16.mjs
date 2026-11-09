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
      if (fmt !== null || size < 16) {
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

      if (fmt.audioFormat === 0xfffe) {
        if (size < 40) {
          return { ok: false, reason: 'invalid_fmt_chunk' };
        }

        const cbSize = buf.readUInt16LE(body + 16);
        if (cbSize < 22) {
          return { ok: false, reason: 'invalid_pcm_format' };
        }
        if (cbSize > size - 18) {
          return { ok: false, reason: 'invalid_fmt_chunk' };
        }

        const validBits = buf.readUInt16LE(body + 18);
        const channelMask = buf.readUInt32LE(body + 20);
        const subFormat = buf.subarray(body + 24, body + 40);
        const pcmGuid = Buffer.from([
          1, 0, 0, 0, 0, 0, 16, 0,
          128, 0, 0, 170, 0, 56, 155, 113,
        ]);

        if (!subFormat.equals(pcmGuid)) {
          return { ok: false, reason: 'unsupported_pcm_format' };
        }

        if (validBits !== 16) {
          return { ok: false, reason: 'invalid_pcm_format' };
        }

        if (
          channelMask !== 0 &&
          channelMask.toString(2).replace(/0/g, "").length !== fmt.channels
        ) {
          return { ok: false, reason: 'invalid_pcm_format' };
        }
      }
    } else if (id === 'data' && data === null) {
      data = buf.subarray(body, end);
    }

    pos = paddedEnd;
  }

  if (pos !== riffEnd) {
    return { ok: false, reason: 'invalid_chunk_header' };
  }

  if (!fmt) return { ok: false, reason: 'no_fmt_chunk' };
  if (!data) return { ok: false, reason: 'no_data_chunk' };

  if ((fmt.audioFormat !== 1 && fmt.audioFormat !== 0xfffe) || fmt.bitsPerSample !== 16) {
    return { ok: false, reason: 'unsupported_pcm_format' };
  }

  if (
    fmt.channels < 1 ||
    fmt.sampleRate < 1 ||
    fmt.blockAlign !== fmt.channels * 2 ||
    fmt.byteRate !== fmt.sampleRate * fmt.blockAlign
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

export function analyzeWavPcm16(buf, options = {}) {
  const parsed = parsePcm16Data(buf);

  if (!parsed.ok) {
    return {
      available: false,
      reason: parsed.reason,
    };
  }

  const nativeAnalyzer =
    options?.nativeAnalyzer ?? (nativeAvailable ? analyzePcm16 : null);

  if (typeof nativeAnalyzer === "function") {
    try {
      return {
        available: true,
        engine: "cpp",
        ...nativeAnalyzer(parsed.data),
      };
    } catch {
      // Recover safely with the JavaScript implementation.
    }
  }

  return {
    available: true,
    engine: "javascript",
    ...analyzePcm16JavaScript(parsed.data),
  };
}
