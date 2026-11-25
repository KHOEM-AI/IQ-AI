// KHOEM-AI: put each scene's narration on its 3D clip. A clip shorter than its speech holds the last frame.
// usage: node scripts/narrate-clips.mjs --narr DIR --out DIR clip1.webm clip2.webm ...
// A clip file name must contain epN-sM (the Shot Player names them like that); the WAV is DIR/epN-sM.wav.
import { existsSync, mkdirSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join, basename } from 'node:path';

const LEAD = 0.4;
const TAIL = 0.6;
const home = homedir();
const expand = (p) => (typeof p === 'string' && p.startsWith('~/') ? home + p.slice(1) : p);
const die = (m) => { console.error('STOP: ' + m); process.exit(1); };
const argv = process.argv.slice(2);
const opt = {};
const clips = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--narr' || argv[i] === '--out') opt[argv[i]] = argv[++i];
  else if (argv[i].startsWith('--')) die('unknown option ' + argv[i]);
  else clips.push(expand(argv[i]));
}
if (!clips.length || !opt['--narr'] || !opt['--out']) die('usage: node scripts/narrate-clips.mjs --narr DIR --out DIR clip1.webm clip2.webm ...');
const narr = expand(opt['--narr']);
const out = expand(opt['--out']);
mkdirSync(out, { recursive: true });

const run = (cmd, a) => spawnSync(cmd, a, { encoding: 'utf8' });
const dur = (p) => { const n = Number(String(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).stdout).trim()); return Number.isFinite(n) && n > 0 ? n : null; };
const tmp = mkdtempSync(join(tmpdir(), 'iqai-narr-'));
try {
  for (const clip of clips) {
    if (!existsSync(clip)) die('file not found: ' + clip + ' (is the folder empty? check with ls)');
    const m = /ep\d+-s\d+/.exec(basename(clip));
    if (!m) die('no epN-sM in the file name: ' + clip);
    const key = m[0];
    const base = join(tmp, key + '.mp4');
    const r1 = run('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', clip, '-an', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=25,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-movflags', '+faststart', '-f', 'mp4', base]);
    if (r1.status !== 0) die('ffmpeg failed on ' + clip + ': ' + String(r1.stderr).slice(-300));
    const vdur = dur(base);
    if (!vdur) die('cannot read the length of ' + clip);
    const wav = join(narr, key + '.wav');
    const dest = join(out, key + '.mp4');
    if (!existsSync(wav)) { copyFileSync(base, dest); console.log(`${key}: no narration, video only (${vdur.toFixed(1)} s)`); continue; }
    const alen = dur(wav);
    if (!alen) die('cannot read the length of ' + wav);
    const target = Math.max(vdur, alen + LEAD + TAIL);
    const extra = target - vdur;
    const r2 = run('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', base, '-i', wav,
      '-filter_complex', `[0:v]tpad=stop_mode=clone:stop_duration=${extra.toFixed(3)}[v];[1:a]adelay=${Math.round(LEAD * 1000)}:all=1,apad[a]`,
      '-map', '[v]', '-map', '[a]', '-t', target.toFixed(3), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', '-f', 'mp4', dest]);
    if (r2.status !== 0) die('ffmpeg failed on ' + key + ': ' + String(r2.stderr).slice(-300));
    console.log(`${key}: video ${vdur.toFixed(1)} s | speech ${alen.toFixed(1)} s | clip ${target.toFixed(1)} s${extra > 0.05 ? ` (last frame held ${extra.toFixed(1)} s)` : ''}`);
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
console.log('OK ' + out);
