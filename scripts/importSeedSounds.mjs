// Run from ~/IQ-AI while the server is up:  node scripts/importSeedSounds.mjs
// Uploads sounds/seed/*.wav through POST /api/v1/sounds/upload. Skips sounds already imported.
// Env: IQAI_URL (default http://127.0.0.1:8799), IQAI_TOKEN (default: ~/.iqai-token)
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.IQAI_URL || 'http://127.0.0.1:8799';
const token = (process.env.IQAI_TOKEN || (await fs.readFile(path.join(os.homedir(), '.iqai-token'), 'utf8').catch(() => ''))).trim();
if (!token) { console.error('No token. Set IQAI_TOKEN or create ~/.iqai-token'); process.exit(1); }
const auth = { Authorization: `Bearer ${token}` };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'sounds', 'seed');
const catalog = JSON.parse(await fs.readFile(path.join(root, 'catalog.json'), 'utf8'));

const existing = new Set();
for (const cat of new Set(catalog.items.map((i) => i.category))) {
  const r = await fetch(`${base}/api/v1/sounds?category=${cat}&limit=200`, { headers: auth }).catch((e) => { console.error(`Cannot reach ${base}: ${e.message}`); process.exit(1); });
  if (!r.ok) { console.error(`List failed (${r.status}). Is the token right?`); process.exit(1); }
  for (const m of (await r.json()).items) existing.add(`${m.category}|${m.name}`);
}

let added = 0, skipped = 0, failed = 0, wrongCat = 0;
for (const it of catalog.items) {
  if (existing.has(`${it.category}|${it.label}`)) { skipped++; continue; }
  const r = await fetch(`${base}/api/v1/sounds/upload`, {
    method: 'POST',
    headers: {
      ...auth,
      'Content-Type': 'audio/wav',
      'X-Filename': encodeURIComponent(it.label),
      'X-Category': encodeURIComponent(it.category),
      'X-Tags': encodeURIComponent(it.tags.join(',')),
      'X-Source': encodeURIComponent(it.source),
      'X-License': encodeURIComponent(it.license),
    },
    body: await fs.readFile(path.join(root, it.storageKey)),
  });
  if (r.status !== 201) { failed++; console.error(`FAIL ${it.id}: HTTP ${r.status}`); continue; }
  const meta = await r.json();
  if (meta.category !== it.category) { wrongCat++; console.warn(`WARN ${it.id}: server stored category "${meta.category}" (run scripts/applySoundPatch.mjs and restart)`); }
  added++;
}
console.log(`added ${added}, skipped ${skipped}, failed ${failed}${wrongCat ? `, wrong category ${wrongCat}` : ''}`);
process.exit(failed || wrongCat ? 1 : 0);
