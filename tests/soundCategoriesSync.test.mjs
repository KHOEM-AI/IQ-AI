import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES as ACCEPTED } from '../src/audio/validation.mjs';
import { categorySlugs } from '../src/sound/catalog.mjs';

test('every catalog category is accepted by the upload API', () => {
  for (const slug of categorySlugs()) assert.ok(ACCEPTED.includes(slug), `${slug} would be stored as "unknown"`);
});
