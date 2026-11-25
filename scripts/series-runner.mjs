// KHOEM-AI Series Runner
// series.json -> one video.story job per episode -> video.merge into the full video.
// usage: node scripts/series-runner.mjs series.json [--dry] [--only N] [--out DIR]
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* token may come from the environment */ }

const API = (process.env.IQAI_BASE_URL || 'http://127.0.0.1:8799').replace(/\/+$/, '') + '/api/v1';
const TOKEN = process.env.IQAI_TOKEN || '';
const MAX_SCENES = 30;
const MAX_IMAGE_BYTES = 80 * 1024 * 1024;
const MERGE_GROUP = 10;
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
const home = homedir();
const expand = (p) => (typeof p === 'string' && p.startsWith('~/') ? home + p.slice(1) : p);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const die = (m) => { console.error('STOP: ' + m); process.exit(1); };
const pick = (j) => (j && j.data !== undefined ? j.data : j);

const args = process.argv.slice(2);
const file = args[0];
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (!file || file.startsWith('--')) die('usage: node scripts/series-runner.mjs series.json [--dry] [--only N] [--out DIR]');

let series;
try { series = JSON.parse(readFileSync(expand(file), 'utf8')); } catch (e) { die('cannot read ' + file + ': ' + e.message); }

function validate(s) {
  const errs = [];
  if (!s || typeof s !== 'object' || Array.isArray(s)) return ['series.json must be an object'];
  if (!Array.isArray(s.episodes) || !s.episodes.length) return ['episodes must be a non-empty array'];
  s.episodes.forEach((ep, i) => {
    const tag = `episode ${i + 1}`;
    if (!ep || !Array.isArray(ep.scenes) || !ep.scenes.length) { errs.push(`${tag}: scenes must be a non-empty array`); return; }
    if (ep.scenes.length > MAX_SCENES) errs.push(`${tag}: ${ep.scenes.length} scenes (max ${MAX_SCENES}), split it into two episodes`);
    let bytes = 0;
    ep.scenes.forEach((sc, k) => {
      const t = `${tag} scene ${k + 1}`;
      if (!sc || (!sc.image && !sc.text)) { errs.push(`${t}: needs an image or text`); return; }
      if (sc.seconds !== undefined && !(sc.seconds >= 1 && sc.seconds <= 60)) errs.push(`${t}: seconds must be 1..60`);
      if (sc.image) {
        const f = expand(sc.image);
        if (!MIME[extname(f).toLowerCase()]) errs.push(`${t}: image must be jpg, png, webp or gif`);
        else if (!existsSync(f)) errs.push(`${t}: file not found: ${sc.image}`);
        else bytes += statSync(f).size;
      }
    });
    if (bytes > MAX_IMAGE_BYTES) errs.push(`${tag}: photos total ${(bytes / 1048576).toFixed(0)} MB (max 80 MB)`);
  });
  return errs;
}

const errs = validate(series);
if (errs.length) die('\n' + errs.join('\n'));
const only = Number(val('--only')) || 0;
const episodes = series.episodes.map((ep, i) => ({ ep, n: i + 1 })).filter((x) => !only || x.n === only);
if (!episodes.length) die(`no episode ${only}`);

if (flag('--dry')) {
  for (const { ep, n } of episodes) {
    const sec = ep.scenes.reduce((a, s) => a + (s.seconds || 4), 0);
    const imgs = ep.scenes.filter((s) => s.image).length;
    const voiced = ep.scenes.filter((s) => s.say).length;
    console.log(`ep ${n}: ${ep.title || ''} | ${ep.scenes.length} scenes | ~${sec}s | ${imgs} photos | ${voiced} voiced`);
  }
  if (episodes.some((x) => x.ep.scenes.some((s) => s.say))) console.log('note: spoken lines need IQAI_TTS=edge in IQ-AI');
  console.log('DRY OK (nothing was sent)');
  process.exit(0);
}

if (!TOKEN) die('IQAI_TOKEN is missing (set it in ~/IQ-AI/.env)');

async function call(method, path, { body, headers } = {}) {
  const res = await fetch(API + path, { method, body, headers: { authorization: 'Bearer ' + TOKEN, ...headers } });
  const isJson = (res.headers.get('content-type') || '').includes('json');
  const data = isJson ? await res.json() : Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    const e = isJson ? (data.error ?? data) : '(binary)';
    die(`${method} ${path} -> ${res.status} ${typeof e === 'string' ? e : JSON.stringify(e)}`);
  }
  return data;
}

async function upload(f) {
  const buf = readFileSync(f);
  const r = pick(await call('POST', '/media', {
    body: buf,
    headers: { 'content-type': MIME[extname(f).toLowerCase()], 'x-filename': encodeURIComponent(basename(f)) },
  }));
  if (!r || !r.id) die('upload returned no id: ' + f);
  return r.id;
}

async function job(type, params, label) {
  const j = pick(await call('POST', '/jobs', { body: JSON.stringify({ type, params }), headers: { 'content-type': 'application/json' } }));
  if (!j || !j.id) die(label + ': job was not created');
  let last = -1;
  for (;;) {
    await sleep(3000);
    const s = pick(await call('GET', '/jobs/' + j.id));
    const pct = Math.round((s.progress || 0) * 100);
    if (pct !== last) { console.log(`  ${label}: ${s.status} ${pct}%`); last = pct; }
    if (s.status === 'done') return s.result;
    if (s.status === 'failed' || s.status === 'cancelled') die(`${label} ${s.status}: ${s.error ? s.error.message : ''}`);
  }
}

async function download(id, dest) { writeFileSync(dest, await call('GET', `/media/${id}/content`)); }

async function mergeAll(ids) {
  let level = ids;
  let round = 1;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += MERGE_GROUP) {
      const group = level.slice(i, i + MERGE_GROUP);
      if (group.length === 1) { next.push(group[0]); continue; }
      const r = await job('video.merge', { ids: group, width: series.width, height: series.height }, `merge ${round}.${next.length + 1}`);
      next.push(r.mediaId);
    }
    level = next;
    round++;
  }
  return level[0];
}

const out = expand(val('--out') || '~/series-out');
mkdirSync(out, { recursive: true });
const stateFile = `${out}/${basename(file)}.state.json`;
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));
const sig = (ep) => createHash('sha1').update(JSON.stringify([
  ep, series.voice, series.width, series.height, series.story,
  ep.scenes.map((s) => { if (!s.image) return 0; const st = statSync(expand(s.image)); return [st.size, st.mtimeMs]; }),
])).digest('hex');

const uploaded = new Map();
const ids = [];
for (const { ep, n } of episodes) {
  const key = sig(ep);
  if (state[key]) { console.log(`ep ${n}: already rendered, reusing`); ids.push(state[key]); continue; }
  console.log(`ep ${n}: ${ep.title || ''} (${ep.scenes.length} scenes)`);
  const scenes = [];
  for (const s of ep.scenes) {
    const sc = {};
    if (s.image) {
      const f = expand(s.image);
      if (!uploaded.has(f)) uploaded.set(f, await upload(f));
      sc.imageId = uploaded.get(f);
    }
    if (s.text) sc.text = s.text;
    if (s.seconds) sc.seconds = s.seconds;
    if (s.say) { sc.say = s.say; if (s.voice) sc.voice = s.voice; }
    scenes.push(sc);
  }
  const r = await job('video.story', { scenes, voice: series.voice, width: series.width, height: series.height, ...(series.story || {}) }, `ep ${n}`);
  state[key] = r.mediaId;
  save();
  ids.push(r.mediaId);
  await download(r.mediaId, `${out}/ep${String(n).padStart(2, '0')}.mp4`);
}

const finalId = await mergeAll(ids);
const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, '');
const dest = `${out}/series-${stamp}.mp4`;
await download(finalId, dest);
console.log('DONE ' + dest);
