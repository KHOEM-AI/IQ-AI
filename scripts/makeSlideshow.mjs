// Usage: node scripts/makeSlideshow.mjs out.mp4 photo1.jpg photo2.png ... [--captions "a|b"] [--sec 3] [--sfx rain] [--w 720] [--h 1280] [--effect zoom-in]
// Uploads the photos to the running IQ-AI server, builds the slideshow and saves the mp4.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.IQAI_URL || 'http://127.0.0.1:8799/api/v1';
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

const argv = process.argv.slice(2);
const opt = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
  else pos.push(argv[i]);
}
const [out, ...photos] = pos;
if (!out || !photos.length) {
  console.error('Usage: node scripts/makeSlideshow.mjs out.mp4 photo1.jpg photo2.jpg ... [--captions "a|b"] [--sec 3] [--sfx rain]');
  process.exit(1);
}
let token = process.env.IQAI_TOKEN;
if (!token) token = (await fs.readFile(path.join(os.homedir(), '.iqai-token'), 'utf8')).trim();
const auth = { Authorization: `Bearer ${token}` };

const ids = [];
for (const f of photos) {
  const type = MIME[path.extname(f).toLowerCase()];
  if (!type) { console.error(`Not a supported image (png/jpg/webp/gif): ${f}`); process.exit(1); }
  const r = await fetch(`${BASE}/media`, {
    method: 'POST', headers: { ...auth, 'Content-Type': type, 'X-Filename': encodeURIComponent(path.basename(f)) }, body: await fs.readFile(f),
  });
  if (r.status !== 201) { console.error(`Upload failed (${r.status}) for ${f}: ${await r.text()}`); process.exit(1); }
  ids.push((await r.json()).data.id);
  console.log(`uploaded ${path.basename(f)}`);
}

const body = { ids };
if (opt.captions) body.captions = opt.captions.split('|');
if (opt.sec) body.secondsPerSlide = Number(opt.sec);
if (opt.sfx) body.sfx = opt.sfx;
if (opt.w) body.width = Number(opt.w);
if (opt.h) body.height = Number(opt.h);
if (opt.effect) body.effect = opt.effect;

const r = await fetch(`${BASE}/videos/slideshow`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
if (r.status !== 200) { console.error(`Slideshow failed (${r.status}): ${await r.text()}`); process.exit(1); }
await fs.writeFile(out, Buffer.from(await r.arrayBuffer()));
console.log(`saved ${out}  applied: ${r.headers.get('x-applied')}`);
