// Usage: node scripts/importRealSounds.mjs [dir] [--dry]
// Default dir: ~/storage/downloads/iqai-sounds
// Layout: <dir>/<category>/<file>.(wav|mp3|ogg|flac|m4a|webm) and optional <dir>/sources.json:
//   { "default": { "source": "...", "license": "CC0-1.0", "tags": [] },
//     "files": { "nature/rain.wav": { "name": "...", "tags": ["rain"], "source": "...", "license": "..." } } }
// Files without both a source and a license are skipped. Env: IQAI_URL, IQAI_TOKEN (or ~/.iqai-token).
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const dir = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(os.homedir(), 'storage', 'downloads', 'iqai-sounds'));
const base = process.env.IQAI_URL || 'http://127.0.0.1:8799';
const token = (process.env.IQAI_TOKEN || (await fs.readFile(path.join(os.homedir(), '.iqai-token'), 'utf8').catch(() => ''))).trim();
const die = (m) => { console.error(m); process.exit(1); };
if (!token) die('No token. Set IQAI_TOKEN or create ~/.iqai-token');

const MIME = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.webm': 'audio/webm' };
const E = encodeURIComponent;
const api = (p, init = {}) => fetch(`${base}/api/v1${p}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });

const cr = await api('/sounds/categories').catch((e) => die(`Cannot reach ${base}: ${e.message}`));
if (!cr.ok) die(`Categories failed (${cr.status}). Is the token right?`);
const cats = new Set((await cr.json()).items);

let info = {};
try { info = JSON.parse(await fs.readFile(path.join(dir, 'sources.json'), 'utf8')); }
catch (e) { if (e.code !== 'ENOENT') die(`sources.json: ${e.message}`); }
const def = info.default || {};
const per = info.files || {};

let entries;
try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { die(`Folder not found: ${dir}`); }

const n = { added: 0, exists: 0, noLicense: 0, failed: 0 };
for (const d of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!cats.has(d.name)) { console.warn(`SKIP folder "${d.name}": not a known category`); continue; }
  for (const f of (await fs.readdir(path.join(dir, d.name))).sort()) {
    const ext = path.extname(f).toLowerCase();
    if (!MIME[ext]) continue;
    const rel = `${d.name}/${f}`;
    const o = per[rel] || {};
    const name = (o.name || path.basename(f, ext).replace(/[-_]+/g, ' ')).trim();
    const source = o.source || def.source || '';
    const license = o.license || def.license || '';
    if (!source || !license) { n.noLicense++; console.warn(`NO SOURCE/LICENSE  ${rel}`); continue; }

    const q = await api(`/sounds?category=${d.name}&q=${E(name)}&limit=200`);
    if (!q.ok) { n.failed++; console.error(`FAIL ${rel}: lookup HTTP ${q.status}`); continue; }
    if ((await q.json()).items.some((m) => m.name === name)) { n.exists++; continue; }

    const tags = [...new Set(['real', ...(o.tags || def.tags || [])])];
    if (dry) { console.log(`WOULD ADD ${rel} -> "${name}" [${license}]`); n.added++; continue; }
    const r = await api('/sounds/upload', {
      method: 'POST',
      headers: {
        'Content-Type': MIME[ext],
        'X-Filename': E(name), 'X-Category': E(d.name), 'X-Tags': E(tags.join(',')),
        'X-Source': E(source), 'X-License': E(license),
      },
      body: await fs.readFile(path.join(dir, d.name, f)),
    });
    if (r.status !== 201) { n.failed++; console.error(`FAIL ${rel}: HTTP ${r.status} ${(await r.text()).slice(0, 80)}`); continue; }
    n.added++; console.log(`added ${rel}`);
  }
}
console.log(`${dry ? '[dry] ' : ''}added ${n.added}, already there ${n.exists}, no license ${n.noLicense}, failed ${n.failed}`);
process.exit(n.failed ? 1 : 0);
