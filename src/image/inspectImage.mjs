const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export function inspectImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return { ok: false, reason: 'too_short' };

  if (buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a && buf.length >= 24) {
    return { ok: true, format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length };
  }

  const head = buf.toString('ascii', 0, 6);
  if ((head === 'GIF87a' || head === 'GIF89a') && buf.length >= 10) {
    return { ok: true, format: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), bytes: buf.length };
  }

  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let pos = 2;
    while (pos + 9 <= buf.length) {
      if (buf[pos] !== 0xff) { pos++; continue; }
      const m = buf[pos + 1];
      if (m === 0xff) { pos++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { pos += 2; continue; }
      if (SOF.has(m)) {
        return { ok: true, format: 'jpeg', width: buf.readUInt16BE(pos + 7), height: buf.readUInt16BE(pos + 5), bytes: buf.length };
      }
      pos += 2 + buf.readUInt16BE(pos + 2);
    }
    return { ok: false, reason: 'jpeg_no_size' };
  }

  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP' && buf.length >= 30) {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8 ') {
      return { ok: true, format: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, bytes: buf.length };
    }
    if (kind === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { ok: true, format: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1, bytes: buf.length };
    }
    if (kind === 'VP8X') {
      return { ok: true, format: 'webp', width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1, bytes: buf.length };
    }
  }
  return { ok: false, reason: 'unsupported_image' };
}
