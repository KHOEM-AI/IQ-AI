// One recording in -> 36 natural voices out.
// Usage: node scripts/voiceAll.mjs input.wav [outDir]     (needs ffmpeg; rubberband gives the best quality)
import fs from 'node:fs/promises';
import path from 'node:path';
import { PRESETS, NATURAL_VOICES } from '../src/audio/voice/presets.mjs';
import { changeVoice } from '../src/audio/voice/changeVoice.mjs';
import { runFfmpeg, ffmpegAvailable, ffmpegHasFilter } from '../src/audio/ffmpeg.mjs';
import { estimateF0 } from '../src/audio/voice/estimatePitch.mjs';

const [input, outDir = 'voices36'] = process.argv.slice(2);
if (!input) { console.error('Usage: node scripts/voiceAll.mjs input.wav [outDir]'); process.exit(1); }
if (!(await ffmpegAvailable())) { console.error('ffmpeg is not installed (Termux: pkg install ffmpeg)'); process.exit(1); }
if (!(await ffmpegHasFilter('rubberband'))) console.warn('! ffmpeg has no rubberband filter: voices will sound less natural (Termux: pkg install ffmpeg, then check "ffmpeg -filters | grep rubberband")');

const buf = await fs.readFile(input);
const probe = await runFfmpeg(buf, ['-af', 'aresample=44100']);
const hz = estimateF0(probe);
if (!hz) { console.error('Could not measure the pitch of the input. Use a clear recording of one voice, at least 1-2 seconds.'); process.exit(1); }
console.log(`input pitch ~${Math.round(hz)} Hz`);

await fs.mkdir(outDir, { recursive: true });
const index = [];
for (const [i, id] of NATURAL_VOICES.entries()) {
  const r = await changeVoice(buf, { preset: id, sourceF0: hz });
  if (!r.ok) { console.error(id, r.message); process.exit(1); }
  const name = `${String(i + 1).padStart(2, '0')}_${id}.wav`;
  await fs.writeFile(path.join(outDir, name), r.buf);
  index.push({ n: i + 1, id, file: name, label: PRESETS[id].label, targetF0: PRESETS[id].f0 });
  console.log(name, '-', PRESETS[id].label);
}
await fs.writeFile(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2));
console.log(`done: ${index.length} voices in ${outDir}/`);
