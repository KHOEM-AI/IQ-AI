// Run from ~/IQ-AI:  node scripts/applySoundPatch.mjs
// 1) re-mounts the emotion / image-inspect / video-inspect routes in server.mjs
// 2) adds the 4 new sound categories to the upload whitelist
// Safe to run twice. Review with: git diff
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function patch(rel, steps) {
  const file = path.join(root, rel);
  let src = await fs.readFile(file, 'utf8');
  let changed = false;
  for (const { label, done, find, replace } of steps) {
    if (done.test(src)) { console.log(`skip     ${rel}: ${label} (already applied)`); continue; }
    if (!find.test(src)) { console.error(`FAILED   ${rel}: anchor not found for "${label}"`); process.exitCode = 1; continue; }
    src = src.replace(find, replace);
    changed = true;
    console.log(`patched  ${rel}: ${label}`);
  }
  if (changed) await fs.writeFile(file, src);
}

await patch('src/server/server.mjs', [
  {
    label: 'imports',
    done: /import \{ handleEmotion \}/,
    find: /^(import \{ createAudioHandler \} from ["']\.\/audioHandler\.mjs["'];)$/m,
    replace: '$1\nimport { handleEmotion } from "./routes/emotion.mjs";\nimport { handleImageInspect } from "./routes/imageInspect.mjs";\nimport { handleVideoInspect } from "./routes/videoInspect.mjs";',
  },
  {
    label: 'route calls',
    done: /await handleEmotion\(/,
    find: /^([ \t]*)(if \(await handleProcess\(req, res, p\)\) return;)$/m,
    replace: '$1$2\n$1if (await handleEmotion(req, res, p)) return;\n$1if (await handleImageInspect(req, res, p)) return;\n$1if (await handleVideoInspect(req, res, p)) return;',
  },
]);

await patch('src/audio/validation.mjs', [
  {
    label: 'new categories',
    done: /'synthetic'/,
    find: /'music', 'unknown'\]/,
    replace: "'music', 'objects', 'signals', 'ambience', 'synthetic', 'unknown']",
  },
]);
