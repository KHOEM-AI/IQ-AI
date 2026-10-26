import { CATEGORIES } from './validation.mjs';

const dec = (v) => { try { return decodeURIComponent(v || ''); } catch { return ''; } };

export function buildMeta({ id, headers, mime, size, kind }) {
  const category = dec(headers['x-category']).toLowerCase();
  return {
    id,
    name: dec(headers['x-filename']).slice(0, 120) || 'untitled',
    category: CATEGORIES.includes(category) ? category : 'unknown',
    tags: dec(headers['x-tags']).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 20),
    source: dec(headers['x-source']).slice(0, 200),
    license: dec(headers['x-license']).slice(0, 200),
    mime, format: kind, size,
    favorite: false,
    createdAt: new Date().toISOString(),
  };
}
