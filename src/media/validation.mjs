const ALLOWED = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'audio/wav', 'audio/ogg', 'audio/mpeg',
  'video/mp4', 'video/webm',
]);

export function sniffMime(buf) {
  if (buf.length < 12) return null;
  const ascii = (a, b) => buf.subarray(a, b).toString('latin1');
  const starts = (...bytes) => bytes.every((v, i) => buf[i] === v);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'audio/wav';
  if (ascii(0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (ascii(4, 8) === 'ftyp') return 'video/mp4';
  if (starts(0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm';
  return null;
}

export function validateUpload(buf, declaredMime) {
  if (!buf || buf.length === 0) {
    return { ok: false, status: 400, code: 'empty_body', message: 'Request body is empty' };
  }
  const mime = String(declaredMime || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED.has(mime)) {
    return { ok: false, status: 415, code: 'unsupported_type', message: 'Unsupported Content-Type' };
  }
  if (sniffMime(buf) !== mime) {
    return { ok: false, status: 415, code: 'content_mismatch', message: 'File content does not match Content-Type' };
  }
  return { ok: true, mime, type: mime.split('/')[0] };
}

// Keeps letters, marks and digits from any language (Khmer included); everything else becomes "_".
export function safeFilename(name) {
  if (typeof name !== 'string' || !name) return 'upload';
  const base = name.split(/[\\/]/).pop();
  const clean = base.replace(/[^\p{L}\p{M}\p{N}._-]/gu, '_').replace(/^\.+/, '');
  const trimmed = Array.from(clean).slice(0, 100).join('');
  return trimmed || 'upload';
}
