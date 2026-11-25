// KHOEM-AI: 3D Studio clips (webm/mp4) -> one mp4 through IQ-AI video.merge
// usage: node scripts/clips-to-video.mjs clip1.webm clip2.mp4 ... [--out FILE] [--width N] [--height N]
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';

try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* token may come from the environment */ }

const API = (process.env.IQAI_BASE_URL || 'http://127.0.0.1:8799').replace(/\/+$/, '') + '/api/v1';
const TOKEN = process.env.IQAI_TOKEN || '';
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MERGE_GROUP = 10;
const home = homedir();
const expand = (p) => (typeof p === 'string' && p.startsWith('~/') ? home + p.slice(1) : p);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const die = (m) => { console.error('STOP: ' + m); process.exit(1); };
const pick = (j) => (j && j.data !== undefined ? j.data : j);

const VALUE_FLAGS = ['--out', '--width', '--height'];
const clips = [];
const opt = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (VALUE_FLAGS.includes(argv[i])) { opt[argv[i]] = argv[++i]; }
  else if (argv[i].startsWith('--')) die('unknown option ' + argv[i]);
  else clips.push(expand(argv[i]));
}
if (!clips.length) die('usage: node scripts/clips-to-video.mjs clip1.webm clip2.mp4 ... [--out FILE] [--width N] [--height N]');
const width = Number(opt['--width']) || 1280;
const height = Number(opt['--height']) || 720;
for (const c of clips) if (!existsSync(c)) die('file not found: ' + c);
if (!TOKEN) die('IQAI_TOKEN is missing (set it in ~/IQ-AI/.env)');

async function call(method, path, { body, headers } = {}) {
  const res = await fetch(API + path, { method, body, headers: { authorization: 'Bearer ' + TOKEN, ...headers } });
  const isJson = (res.headers.get('content-type') || '').includes('json');
  const data = isJson ? await res.json() : Buffer.from(await res.arrayBuffer());
  if (!res.ok) die(`${method} ${path} -> ${res.status} ${isJson ? JSON.stringify(data.error ?? data) : '(binary)'}`);
  return data;
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

// MediaRecorder webm has no duration/index: re-encode every clip to the same size and fps as an mp4.
const tmp = mkdtempSync(join(tmpdir(), 'iqai-clips-'));
const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=25,setsar=1,format=yuv420p`;
const ids = [];
try {
  for (let i = 0; i < clips.length; i++) {
    const out = join(tmp, `clip${i}.mp4`);
    console.log(`clip ${i + 1}/${clips.length}: ${basename(clips[i])}`);
    const r = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', clips[i], '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-c:a', 'aac', '-movflags', '+faststart', '-f', 'mp4', out],
    { encoding: 'utf8' });
    if (r.status !== 0) die('ffmpeg failed on ' + clips[i] + ': ' + (r.stderr || r.error || '').toString().slice(-300));
    const size = statSync(out).size;
    if (size > MAX_VIDEO_BYTES) die(`clip ${i + 1} is ${(size / 1048576).toFixed(0)} MB after conversion (max 50 MB): record it shorter`);
    const up = pick(await call('POST', '/media', {
      body: readFileSync(out),
      headers: { 'content-type': 'video/mp4', 'x-filename': encodeURIComponent(basename(clips[i]).replace(/\.\w+$/, '') + '.mp4') },
    }));
    if (!up || !up.id) die('upload returned no id for ' + clips[i]);
    ids.push(up.id);
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }

let level = ids;
let round = 1;
while (level.length > 1) {
  const next = [];
  for (let i = 0; i < level.length; i += MERGE_GROUP) {
    const group = level.slice(i, i + MERGE_GROUP);
    if (group.length === 1) { next.push(group[0]); continue; }
    const r = await job('video.merge', { ids: group, width, height }, `merge ${round}.${next.length + 1}`);
    next.push(r.mediaId);
  }
  level = next;
  round++;
}

const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, '');
const dest = expand(opt['--out'] || `~/series-out/clips-${stamp}.mp4`);
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, await call('GET', `/media/${level[0]}/content`));
console.log('DONE ' + dest);
