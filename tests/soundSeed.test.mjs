import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categorySlugs } from '../src/sound/catalog.mjs';
import { validateSound } from '../src/sound/schema.mjs';
import { inspectWav } from '../src/audio/inspectWav.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'sounds', 'seed');
const catalog = JSON.parse(await fs.readFile(path.join(root, 'catalog.json'), 'utf8'));

test('seed catalog covers all 10 categories, at least 3 sounds each', () => {
  assert.equal(catalog.count, catalog.items.length);
  for (const slug of categorySlugs()) {
    assert.ok(catalog.items.filter((i) => i.category === slug).length >= 3, slug);
  }
});

test('every seed record is valid and ids are unique', () => {
  for (const it of catalog.items) assert.equal(validateSound(it).ok, true, it.id);
  assert.equal(new Set(catalog.items.map((i) => i.id)).size, catalog.items.length);
});

test('every seed file exists, is a valid WAV, and matches its duration', async () => {
  for (const it of catalog.items) {
    const info = inspectWav(await fs.readFile(path.join(root, it.storageKey)));
    assert.equal(info.ok, true, it.id);
    assert.ok(Math.abs(info.durationSec - it.durationSec) < 0.02, it.id);
  }
});
