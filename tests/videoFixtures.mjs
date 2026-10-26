export function box(type, ...parts) {
  const payload = Buffer.concat(parts);
  const h = Buffer.alloc(8);
  h.writeUInt32BE(8 + payload.length, 0);
  h.write(type, 4, 'ascii');
  return Buffer.concat([h, payload]);
}

export function makeMp4(w, h, timescale, duration) {
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(timescale, 12);
  mvhd.writeUInt32BE(duration, 16);
  const tkhd = Buffer.alloc(84);
  tkhd.writeUInt32BE(w * 65536, 76);
  tkhd.writeUInt32BE(h * 65536, 80);
  return Buffer.concat([
    box('ftyp', Buffer.from('isom0000isom', 'ascii')),
    box('moov', box('mvhd', mvhd), box('trak', box('tkhd', tkhd))),
  ]);
}

function el(idHex, ...parts) {
  const payload = Buffer.concat(parts);
  return Buffer.concat([Buffer.from(idHex, 'hex'), Buffer.from([0x80 | payload.length]), payload]);
}
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };

export function makeWebm(w, h, durationUnits) {
  const dur = Buffer.alloc(4);
  dur.writeFloatBE(durationUnits);
  const info = el('1549A966', el('2AD7B1', Buffer.from([0x0f, 0x42, 0x40])), el('4489', dur));
  const tracks = el('1654AE6B', el('AE', el('E0', el('B0', u16(w)), el('BA', u16(h)))));
  return Buffer.concat([el('1A45DFA3'), el('18538067', info, tracks)]);
}
