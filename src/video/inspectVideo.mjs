function readUInt(buf, s, e) {
  let v = 0;
  for (let i = s; i < e; i++) v = v * 256 + buf[i];
  return v;
}

function readId(buf, pos) {
  const b = buf[pos];
  if (b === undefined) return null;
  let len = 1, mask = 0x80;
  while (len <= 4 && !(b & mask)) { len++; mask >>= 1; }
  if (len > 4 || pos + len > buf.length) return null;
  return { id: readUInt(buf, pos, pos + len), len };
}

function readSize(buf, pos) {
  const b = buf[pos];
  if (b === undefined) return null;
  let len = 1, mask = 0x80;
  while (len <= 8 && !(b & mask)) { len++; mask >>= 1; }
  if (len > 8 || pos + len > buf.length) return null;
  let val = b & (mask - 1);
  let ones = val === mask - 1;
  for (let i = 1; i < len; i++) {
    val = val * 256 + buf[pos + i];
    if (buf[pos + i] !== 0xff) ones = false;
  }
  return { size: ones ? -1 : val, len };
}

const MASTER = new Set([0x18538067, 0x1549a966, 0x1654ae6b, 0xae, 0xe0]);

function walkWebm(buf, start, end, ctx) {
  let pos = start;
  while (pos < end) {
    const id = readId(buf, pos);
    if (!id) break;
    const sz = readSize(buf, pos + id.len);
    if (!sz) break;
    const ds = pos + id.len + sz.len;
    const de = sz.size < 0 ? end : Math.min(end, ds + sz.size);
    if (MASTER.has(id.id)) walkWebm(buf, ds, de, ctx);
    else if (id.id === 0x2ad7b1) ctx.scale = readUInt(buf, ds, de);
    else if (id.id === 0x4489) {
      if (de - ds === 4) ctx.duration = buf.readFloatBE(ds);
      else if (de - ds === 8) ctx.duration = buf.readDoubleBE(ds);
    } else if (id.id === 0xb0 && !ctx.width) ctx.width = readUInt(buf, ds, de);
    else if (id.id === 0xba && !ctx.height) ctx.height = readUInt(buf, ds, de);
    pos = de;
  }
}

function walkBoxes(buf, start, end, visit) {
  let pos = start;
  while (pos + 8 <= end) {
    let size = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    let hdr = 8;
    if (size === 1) {
      if (pos + 16 > end) break;
      size = Number(buf.readBigUInt64BE(pos + 8));
      hdr = 16;
    } else if (size === 0) size = end - pos;
    if (size < hdr) break;
    const boxEnd = Math.min(end, pos + size);
    visit(type, pos + hdr, boxEnd);
    pos = boxEnd;
  }
}

function inspectMp4(buf) {
  const ctx = {};
  walkBoxes(buf, 0, buf.length, (type, s, e) => {
    if (type !== 'moov') return;
    walkBoxes(buf, s, e, (t2, s2, e2) => {
      if (t2 === 'mvhd' && s2 + 20 <= e2) {
        if (buf[s2] === 1 && s2 + 32 <= e2) {
          ctx.timescale = buf.readUInt32BE(s2 + 20);
          ctx.duration = Number(buf.readBigUInt64BE(s2 + 24));
        } else {
          ctx.timescale = buf.readUInt32BE(s2 + 12);
          ctx.duration = buf.readUInt32BE(s2 + 16);
        }
      } else if (t2 === 'trak') {
        walkBoxes(buf, s2, e2, (t3, s3, e3) => {
          if (t3 !== 'tkhd' || ctx.width) return;
          const off = buf[s3] === 1 ? 88 : 76;
          if (s3 + off + 8 > e3) return;
          const w = buf.readUInt32BE(s3 + off) / 65536;
          const h = buf.readUInt32BE(s3 + off + 4) / 65536;
          if (w > 0 && h > 0) { ctx.width = Math.round(w); ctx.height = Math.round(h); }
        });
      }
    });
  });
  if (!ctx.timescale) return { ok: false, reason: 'no_moov' };
  return {
    ok: true,
    format: 'mp4',
    width: ctx.width || 0,
    height: ctx.height || 0,
    durationSec: Math.round((ctx.duration / ctx.timescale) * 1000) / 1000,
    bytes: buf.length,
  };
}

function inspectWebm(buf) {
  const ctx = {};
  walkWebm(buf, 0, buf.length, ctx);
  if (!ctx.duration) return { ok: false, reason: 'no_duration' };
  const scale = ctx.scale || 1000000;
  return {
    ok: true,
    format: 'webm',
    width: ctx.width || 0,
    height: ctx.height || 0,
    durationSec: Math.round(((ctx.duration * scale) / 1e9) * 1000) / 1000,
    bytes: buf.length,
  };
}

export function inspectVideo(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return { ok: false, reason: 'too_short' };
  if (buf.toString('ascii', 4, 8) === 'ftyp') return inspectMp4(buf);
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return inspectWebm(buf);
  return { ok: false, reason: 'unsupported_video' };
}
