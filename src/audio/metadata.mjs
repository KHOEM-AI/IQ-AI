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

// Validates a PATCH body. Only these fields are editable; id, mime, size, format, createdAt never change.
export function applyPatch(body) {
  const bad = (message) => ({ ok: false, message });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('Body must be a JSON object');
  const out = {};
  if ('name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim()) return bad('name must be a non-empty string');
    out.name = body.name.trim().slice(0, 120);
  }
  if ('category' in body) {
    const c = typeof body.category === 'string' ? body.category.trim().toLowerCase() : '';
    if (!CATEGORIES.includes(c)) return bad('Unknown category');
    out.category = c;
  }
  if ('tags' in body) {
    const raw = typeof body.tags === 'string' ? body.tags.split(',') : body.tags;
    if (!Array.isArray(raw) || !raw.every((t) => typeof t === 'string')) {
      return bad('tags must be an array of strings or a comma-separated string');
    }
    out.tags = [...new Set(raw.map((t) => t.trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 20);
  }
  for (const k of ['source', 'license']) {
    if (k in body) {
      if (typeof body[k] !== 'string') return bad(`${k} must be a string`);
      out[k] = body[k].trim().slice(0, 200);
    }
  }
  if ('favorite' in body) {
    if (typeof body.favorite !== 'boolean') return bad('favorite must be true or false');
    out.favorite = body.favorite;
  }
  if (!Object.keys(out).length) return bad('No editable fields given (name, category, tags, source, license, favorite)');
  return { ok: true, value: out };
}
