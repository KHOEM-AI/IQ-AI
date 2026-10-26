export function inspectWav(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return { ok: false, reason: 'too_short' };
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return { ok: false, reason: 'not_wav' };
  }
  let pos = 12;
  let fmt = null;
  let dataBytes = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ' && body + 16 <= buf.length) {
      fmt = {
        audioFormat: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        byteRate: buf.readUInt32LE(body + 8),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      dataBytes = Math.min(size, buf.length - body);
      break;
    }
    pos = body + size + (size & 1);
  }
  if (!fmt) return { ok: false, reason: 'no_fmt_chunk' };
  if (dataBytes === null) return { ok: false, reason: 'no_data_chunk' };
  const durationSec = fmt.byteRate > 0 ? Math.round((dataBytes / fmt.byteRate) * 1000) / 1000 : 0;
  return { ok: true, ...fmt, dataBytes, durationSec };
}
