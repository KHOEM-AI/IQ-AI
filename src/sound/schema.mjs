import crypto from 'node:crypto';
import { FORMATS, getCategory } from './catalog.mjs';

const MAX_TAGS = 20;
const MAX_TAG_LEN = 40;
const MAX_TEXT = 200;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

// Validate and normalise one sound-library record.
// Returns { ok: true, value } or { ok: false, errors: [{ field, message }] }.
export function validateSound(input) {
  const errors = [];
  const bad = (field, message) => errors.push({ field, message });
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: [{ field: '_', message: 'Expected an object' }] };
  }

  const category = str(input.category);
  if (!getCategory(category)) bad('category', 'Unknown category');

  const text = (field, required) => {
    const v = str(input[field]);
    if (!v) { if (required) bad(field, 'Required'); return ''; }
    if (v.length > MAX_TEXT) bad(field, `Longer than ${MAX_TEXT} characters`);
    return v;
  };
  const label = text('label', true);
  const source = text('source', true);
  const license = text('license', true);
  const language = text('language', false);
  const storageKey = text('storageKey', true);
  if (storageKey && (storageKey.includes('..') || /^[\\/]/.test(storageKey))) {
    bad('storageKey', 'Must be a relative key without ".."');
  }

  const format = str(input.format).toLowerCase();
  if (!FORMATS.includes(format)) bad('format', `Must be one of ${FORMATS.join(', ')}`);

  const durationSec = input.durationSec;
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec < 0) {
    bad('durationSec', 'Must be a number >= 0');
  }

  let tags = [];
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) bad('tags', 'Must be an array');
    else {
      tags = [...new Set(input.tags.map((t) => str(t).toLowerCase()).filter(Boolean))];
      if (tags.length > MAX_TAGS) bad('tags', `At most ${MAX_TAGS} tags`);
      if (tags.some((t) => t.length > MAX_TAG_LEN)) bad('tags', `Each tag at most ${MAX_TAG_LEN} characters`);
    }
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id: str(input.id) || crypto.randomUUID(),
      category, label, source, license, format, durationSec, tags, storageKey,
      ...(language ? { language } : {}),
    },
  };
}
