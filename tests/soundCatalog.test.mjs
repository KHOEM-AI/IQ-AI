import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, STAGES, categorySlugs } from '../src/sound/catalog.mjs';
import { validateSound } from '../src/sound/schema.mjs';

const good = {
  category: 'animals', label: 'សំឡេងឆ្កែព្រុស', source: 'own recording', license: 'CC0',
  format: 'WAV', durationSec: 2.5, tags: ['Dog', 'dog', ' bark '], storageKey: 'animals/dog-001.wav',
};

test('catalog has 10 unique categories and 4 stages', () => {
  assert.equal(CATEGORIES.length, 10);
  assert.equal(new Set(categorySlugs()).size, 10);
  assert.deepEqual(STAGES.map((s) => s.targetFiles), [10_000, 100_000, 1_000_000, 10_000_000]);
});

test('valid record is normalised', () => {
  const r = validateSound(good);
  assert.equal(r.ok, true);
  assert.equal(r.value.format, 'wav');
  assert.deepEqual(r.value.tags, ['dog', 'bark']);
  assert.match(r.value.id, /^[0-9a-f-]{36}$/);
});

test('missing and invalid fields are reported', () => {
  const r = validateSound({ category: 'nope', format: 'flac', durationSec: -1 });
  assert.equal(r.ok, false);
  const fields = r.errors.map((e) => e.field);
  for (const f of ['category', 'label', 'source', 'license', 'format', 'durationSec', 'storageKey']) {
    assert.ok(fields.includes(f), f);
  }
});

test('path traversal in storageKey is rejected', () => {
  assert.equal(validateSound({ ...good, storageKey: '../x.wav' }).ok, false);
  assert.equal(validateSound({ ...good, storageKey: '/etc/x.wav' }).ok, false);
});

test('non-object input is rejected', () => {
  assert.equal(validateSound(null).ok, false);
  assert.equal(validateSound([]).ok, false);
});
