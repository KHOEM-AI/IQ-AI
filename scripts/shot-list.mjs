// KHOEM-AI: series.json -> shot list for the filming day (what to film, how long, what file name to save it as).
// usage: node scripts/shot-list.mjs series.json [--narr DIR] [--out FILE] [--dir CLIPS_DIR]
// The narration lengths come from the WAV files made by narrate-plan.mjs (DIR/epN-sM.wav); without them the planned seconds are used.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, basename } from 'node:path';

const LEAD = 0.4;
const TAIL = 0.6; // same margins as narrate-clips.mjs
const home = homedir();
const expand = (p) => (typeof p === 'string' && p.startsWith('~/') ? home + p.slice(1) : p);
const die = (m) => { console.error('STOP: ' + m); process.exit(1); };
const args = process.argv.slice(2);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const file = args[0];
if (!file || file.startsWith('--')) die('usage: node scripts/shot-list.mjs series.json [--narr DIR] [--out FILE] [--dir CLIPS_DIR]');
let series;
try { series = JSON.parse(readFileSync(expand(file), 'utf8')); } catch (e) { die('cannot read ' + file + ': ' + e.message); }
if (!Array.isArray(series.episodes)) die('series.json needs "episodes"');
const narr = expand(val('--narr', '~/series-out/narr'));
const clipDir = val('--dir', '~/real-clips');
const outFile = expand(val('--out', '~/series-out/shotlist.md'));

function seconds(p) {
  if (!existsSync(p)) return null;
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' });
  const n = Number(String(r.stdout).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}
const fmt = (n) => (Math.round(n * 10) / 10).toFixed(1);

const L = [];
let total = 0, count = 0, missingNarr = 0;
const rows = [];
series.episodes.forEach((ep, ei) => (ep.scenes || []).forEach((sc, si) => {
  const id = `ep${ei + 1}-s${si + 1}`;
  const planned = Number(sc.seconds) || 4;
  const len = seconds(`${narr}/${id}.wav`);
  const need = len ? len + LEAD + TAIL : null;
  const film = need ? Math.max(planned, Math.ceil(need * 10) / 10) : planned;
  if (!len && sc.say) missingNarr++;
  total += film; count++;
  rows.push({ id, ep: ep.title || `Episode ${ei + 1}`, say: sc.say || '', voice: sc.voice || series.voice || 'male', planned, len, film, image: sc.image });
}));
if (!count) die('no scenes in ' + file);

L.push(`# ${series.title || 'KHOEM-AI story'} · បញ្ជីឈុតសម្រាប់ថ្ងៃថត`, '');
L.push(`${count} ឈុត · ថតសរុបយ៉ាងតិច ${fmt(total)} វិនាទី`, '');
L.push('## មុនថត');
L.push('- [ ] អ្នកដើរតួទាំងអស់បានយល់ព្រមជាលាយលក្ខណ៍អក្សរ (ឈ្មោះ កាលបរិច្ឆេទ ការប្រើក្នុងវីដេអូអាជីវកម្ម)');
L.push('- [ ] អ្នកដើរតួអាយុក្រោម 18 ឆ្នាំ៖ មានការយល់ព្រមពីអាណាព្យាបាល');
L.push('- [ ] ទីតាំងថតមានការអនុញ្ញាត');
L.push('- [ ] តន្ត្រី និងសំឡេងបន្ថែមមានអាជ្ញាប័ណ្ណសម្រាប់ប្រើពាណិជ្ជកម្ម');
L.push('- [ ] ទូរស័ព្ទថតបញ្ឈរ នៅនឹង (ទ្រ ឬកន្លែងរឹង) ពន្លឺធម្មជាតិ កែវថតស្អាត');
L.push('- [ ] ចំណាំ៖ សំឡេងដើមរបស់វីដេអូត្រូវបានលុប ហើយប្រើសំឡេងនិទានជំនួស', '');
for (const r of rows) {
  L.push(`## ${r.id} · ${r.ep}`);
  L.push(`- ប្រយោគ: ${r.say || '(គ្មាន)'}`);
  L.push(`- សំឡេង: ${r.voice}`);
  L.push(r.len
    ? `- សំឡេងនិទាន: ${fmt(r.len)} វិ → ថតយ៉ាងតិច ${fmt(r.film)} វិ (កុំឱ្យរូបគាំងចុងឈុត)`
    : `- សំឡេងនិទាន: មិនទាន់មាន (ដំណើរការ narrate-plan.mjs) · ផែនការ ${fmt(r.planned)} វិ`);
  L.push(`- រូបយោង: ${r.image ? basename(r.image) + (existsSync(r.image) ? '' : ' (រកមិនឃើញឯកសារ)') : '(គ្មាន)'}`);
  L.push(`- រក្សាទុកជា: ${clipDir}/${r.id}.mp4`);
  L.push('- [ ] ថតរួច', '');
}
const text = L.join('\n');
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, text);
console.log(text);
if (missingNarr) console.log(`\nចំណាំ: ${missingNarr} ឈុតមិនទាន់មានសំឡេងនិទាន ដូច្នេះរយៈពេលជាផែនការប៉ុណ្ណោះ។`);
console.log('\nOK ' + outFile);
