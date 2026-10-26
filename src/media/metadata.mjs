// Dependency-free media metadata readers.
// A reader returns only what it could really parse; anything unknown is simply left out.
const round3 = (n) => Math.round(n * 1000) / 1000;
const ascii = (buf, a, b) => buf.toString('latin1', a, b);

function png(buf) {
  if (buf.length < 24 || ascii(buf, 12, 16) !== 'IHDR') return {};
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpeg(buf) {
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) return {};
    const len = buf.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (i + 9 > buf.length) return {};
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (len < 2) return {};
    i += 2 + len;
  }
  return {};
}

function gif(buf) {
  if (buf.length < 10) return {};
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function webp(buf) {
  if (buf.length < 30) return {};
  const kind = ascii(buf, 12, 16);
  if (kind === 'VP8X') {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  if (kind === 'VP8L') {
    if (buf[20] !== 0x2f) return {};
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return {};
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  return {};
}

function wav(buf) {
  const out = {};
  let byteRate = 0;
  let p = 12;
  while (p + 8 <= buf.length) {
    const id = ascii(buf, p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    const body = p + 8;
    if (id === 'fmt ' && body + 16 <= buf.length) {
      out.channels = buf.readUInt16LE(body + 2);
      out.sampleRate = buf.readUInt32LE(body + 4);
      byteRate = buf.readUInt32LE(body + 8);
      out.bitsPerSample = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      const bytes = Math.min(size, buf.length - body);
      if (byteRate > 0) out.durationSec = round3(bytes / byteRate);
      break;
    }
    p = body + size + (size % 2);
  }
  return out;
}

function* boxes(buf, start, end) {
  let p = start;
  while (p + 8 <= end) {
    let size = buf.readUInt32BE(p);
    const type = ascii(buf, p + 4, p + 8);
    let header = 8;
    if (size === 1) {
      if (p + 16 > end) return;
      size = Number(buf.readBigUInt64BE(p + 8));
      header = 16;
    } else if (size === 0) {
      size = end - p;
    }
    if (size < header || p + size > end) return;
    yield { type, start: p + header, end: p + size };
    p += size;
  }
}

function mp4(buf) {
  const out = {};
  for (const moov of boxes(buf, 0, buf.length)) {
    if (moov.type !== 'moov') continue;
    for (const b of boxes(buf, moov.start, moov.end)) {
      if (b.type === 'mvhd') {
        const v1 = buf[b.start] === 1;
        const timescale = buf.readUInt32BE(b.start + (v1 ? 20 : 12));
        const duration = v1 ? Number(buf.readBigUInt64BE(b.start + 24)) : buf.readUInt32BE(b.start + 16);
        if (timescale > 0) out.durationSec = round3(duration / timescale);
      } else if (b.type === 'trak' && out.width === undefined) {
        for (const t of boxes(buf, b.start, b.end)) {
          if (t.type !== 'tkhd') continue;
          const off = buf[t.start] === 1 ? 88 : 76;
          if (t.start + off + 8 > t.end) continue;
          const w = buf.readUInt32BE(t.start + off) / 65536;
          const h = buf.readUInt32BE(t.start + off + 4) / 65536;
          if (w > 0 && h > 0) {
            out.width = Math.round(w);
            out.height = Math.round(h);
          }
        }
      }
    }
  }
  return out;
}

const READERS = {
  'image/png': png,
  'image/jpeg': jpeg,
  'image/gif': gif,
  'image/webp': webp,
  'audio/wav': wav,
  'video/mp4': mp4,
};

// ogg, mp3 and webm are accepted for upload but their duration is not read yet (info stays empty).
export function readMetadata(buf, mime) {
  let raw = {};
  try {
    const reader = READERS[mime];
    raw = reader ? reader(buf) : {};
  } catch {
    raw = {};
  }
  const info = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Number.isFinite(value) && value > 0) info[key] = value;
  }
  return info;
}
