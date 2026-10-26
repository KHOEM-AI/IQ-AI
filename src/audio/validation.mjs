export const MIME = {
  'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/flac': 'flac',
};
export const CATEGORIES = ['human', 'effects', 'animals', 'nature', 'vehicles', 'machines', 'cinematic', 'city', 'music', 'objects', 'signals', 'ambience', 'synthetic', 'unknown'];

export function sniff(b) {
  if (b.length < 12) return null;
  const s = b.toString('latin1', 0, 4);
  if (s === 'RIFF' && b.toString('latin1', 8, 12) === 'WAVE') return 'wav';
  if (s === 'OggS') return 'ogg';
  if (s === 'fLaC') return 'flac';
  if (b.toString('latin1', 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'mp3';
  if (b.toString('latin1', 4, 8) === 'ftyp') return 'm4a';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
  return null;
}
