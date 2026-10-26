// Usage: node scripts/generateSeedSounds.mjs
// Writes sounds/seed/<category>/<name>.wav and sounds/seed/catalog.json
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng, fade, normalize, toWav, SR } from '../src/sound/synth.mjs';
import { SEED_SOUNDS } from '../src/sound/seedSounds.mjs';
import { validateSound } from '../src/sound/schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'sounds', 'seed');
await fs.rm(root, { recursive: true, force: true });

const items = [];
for (const s of SEED_SOUNDS) {
  const samples = normalize(fade(s.gen(rng(s.seed))));
  const key = `${s.cat}/${s.name}.wav`;
  await fs.mkdir(path.join(root, s.cat), { recursive: true });
  await fs.writeFile(path.join(root, key), toWav(samples));
  const rec = validateSound({
    id: `seed-${s.cat}-${s.name}`,
    category: s.cat,
    label: `${s.km} (សំយោគ)`,
    source: 'IQ-AI synthetic generator (scripts/generateSeedSounds.mjs)',
    license: 'CC0-1.0',
    format: 'wav',
    durationSec: Math.round((samples.length / SR) * 100) / 100,
    tags: ['synthetic', 'seed', ...s.tags],
    storageKey: key,
  });
  if (!rec.ok) throw new Error(`${key}: ${JSON.stringify(rec.errors)}`);
  items.push(rec.value);
}
await fs.writeFile(
  path.join(root, 'catalog.json'),
  JSON.stringify({ version: 1, sampleRate: SR, note: 'Synthetic approximations, not real recordings. storageKey is relative to this folder.', count: items.length, items }, null, 2) + '\n',
);
console.log(`Wrote ${items.length} sounds to ${root}`);
