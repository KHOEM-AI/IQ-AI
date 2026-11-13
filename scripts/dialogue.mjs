// Try a dialogue without the UI: node scripts/dialogue.mjs lines.json [out.wav]
// lines.json: {"lines":[{"text":"សួស្តី","voice":"male_uncle_firm"},{"text":"សួស្តីពូ","voice":"female_nephew_soft"}]}
// Needs the online engine: IQAI_TTS=edge node scripts/dialogue.mjs ...   (pip install edge-tts)
import fs from 'node:fs/promises';
import { synthesizeDialogue } from '../src/audio/dialogue.mjs';

const [input, out = 'dialogue.wav'] = process.argv.slice(2);
if (!input) { console.error('Usage: IQAI_TTS=edge node scripts/dialogue.mjs lines.json [out.wav]'); process.exit(1); }
const r = await synthesizeDialogue(JSON.parse(await fs.readFile(input, 'utf8')));
if (!r.ok) { console.error(`${r.code}: ${r.message}`); process.exit(1); }
await fs.writeFile(out, r.buf);
for (const t of r.timings) console.log(`${String(t.index + 1).padStart(2)}  ${(t.startMs / 1000).toFixed(2)}s - ${(t.endMs / 1000).toFixed(2)}s  ${t.voice ?? '(base voice)'}${t.speaker ? '  ' + t.speaker : ''}`);
console.log(`saved ${out} (${(r.totalMs / 1000).toFixed(1)} s)`);
