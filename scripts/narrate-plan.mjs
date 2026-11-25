// KHOEM-AI: series.json -> one narration WAV per scene (IQ-AI TTS) + timed shot list for the 3D Shot Player
// usage: node scripts/narrate-plan.mjs series.json [--scenes FILE] [--out FILE] [--narr DIR]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* token may come from the environment */ }
const API = (process.env.IQAI_BASE_URL || 'http://127.0.0.1:8799').replace(/\/+$/, '') + '/api/v1';
const TOKEN = process.env.IQAI_TOKEN || '';
const home = homedir();
const expand = (p) => (typeof p === 'string' && p.startsWith('~/') ? home + p.slice(1) : p);
const die = (m) => { console.error('STOP: ' + m); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const file = args[0];
if (!file || file.startsWith('--')) die('usage: node scripts/narrate-plan.mjs series.json [--scenes FILE] [--out FILE] [--narr DIR]');
if (!TOKEN) die('IQAI_TOKEN is missing (set it in ~/IQ-AI/.env)');

let series, shots;
try { series = JSON.parse(readFileSync(expand(file), 'utf8')); } catch (e) { die('cannot read ' + file + ': ' + e.message); }
const scenesFile = expand(val('--scenes', '~/scenes-story.json'));
try { shots = JSON.parse(readFileSync(scenesFile, 'utf8')); } catch (e) { die('cannot read ' + scenesFile + ': ' + e.message); }
if (!Array.isArray(series.episodes) || !Array.isArray(shots.scenes)) die('need series.json "episodes" and scenes file "scenes"');
const outFile = expand(val('--out', '~/MI-K-VISION-3D/public/shots/story-timed.json'));
const narrDir = expand(val('--narr', '~/series-out/narr'));
mkdirSync(narrDir, { recursive: true });
mkdirSync(dirname(outFile), { recursive: true });
const byId = new Map(shots.scenes.map((s) => [s.id, s]));

async function speak(text, voice) {
  for (let attempt = 1; ; attempt++) {
    let res;
    let buf;
    try {
      res = await fetch(API + '/audio/dialogue', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' },
        body: JSON.stringify({ lines: [{ text, voice }] }),
      });
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= 4) die('network error: ' + ((e && e.cause && e.cause.code) || (e && e.message)));
      await sleep(500 * attempt);
      continue;
    }
    if (!res.ok) die(`POST /audio/dialogue -> ${res.status} ${buf.toString('utf8').slice(0, 300)}`);
    if (buf.subarray(0, 4).toString('latin1') !== 'RIFF') die('dialogue did not return a WAV (content-type ' + res.headers.get('content-type') + '): ' + buf.subarray(0, 200).toString('utf8'));
    return buf;
  }
}

function seconds(p) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' });
  const n = Number(String(r.stdout).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

let spoken = 0;
for (let ei = 0; ei < series.episodes.length; ei++) {
  const scenes = series.episodes[ei].scenes || [];
  for (let si = 0; si < scenes.length; si++) {
    const sc = scenes[si];
    const id = `ep${ei + 1}-s${si + 1}`;
    const shot = byId.get(id);
    const say = typeof sc.say === 'string' ? sc.say.trim() : '';
    if (!shot) { console.log(id + ': no shot in ' + scenesFile + ', skipped'); continue; }
    if (!say) { console.log(id + ': no speech'); continue; }
    const voice = sc.voice || series.voice || 'male';
    const wav = join(narrDir, id + '.wav');
    writeFileSync(wav, await speak(say, voice));
    const len = seconds(wav);
    if (!len) die('cannot read the length of ' + wav);
    const need = Math.ceil((len + 1.0) * 10) / 10; // 0.4 s lead + 0.6 s tail
    const planned = Number(shot.shot && shot.shot.seconds) || 4;
    const sec = Math.min(25, Math.max(planned, need));
    if (need > 25) console.log('  warning: ' + id + ' needs ' + need + ' s, the Shot Player records at most 25 s (the clip will be extended later)');
    shot.shot = { ...shot.shot, seconds: sec, narrationSec: Number(len.toFixed(2)) };
    console.log(`${id} | voice ${voice} | speech ${len.toFixed(1)} s | shot ${planned} -> ${sec} s`);
    spoken++;
  }
}
if (!spoken) die('no spoken scenes found');
writeFileSync(outFile, JSON.stringify(shots, null, 2));
console.log(`OK ${outFile} | WAVs in ${narrDir}`);
