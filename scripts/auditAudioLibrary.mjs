import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILES = path.join(ROOT, "data/audio/files");
const META = path.join(ROOT, "data/audio/meta");

const listFiles = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) =>
        fs.statSync(path.join(dir, name)).isFile()
      )
    : [];

const audioFiles = listFiles(FILES);
const metaFiles = listFiles(META).filter((name) => name.endsWith(".json"));

const audioByName = new Map(
  audioFiles.map((name) => [name.toLowerCase(), name])
);

const categories = new Map();
const issues = [];
let validMetadata = 0;
let missingAudio = 0;
let sizeMismatch = 0;
let synthetic = 0;

for (const filename of metaFiles) {
  const fullPath = path.join(META, filename);
  let item;

  try {
    item = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    issues.push(`JSON មិនត្រឹមត្រូវ: ${filename}`);
    continue;
  }

  if (!item.id || !item.name || !item.category) {
    issues.push(`ខ្វះ id/name/category: ${filename}`);
  } else {
    validMetadata++;
  }

  const category = item.category || "(គ្មាន category)";
  categories.set(category, (categories.get(category) || 0) + 1);

  if (
    item.source?.toLowerCase().includes("synthetic") ||
    item.tags?.includes("synthetic")
  ) {
    synthetic++;
  }

  const id = String(item.id || "");
  const candidates = [
    id,
    `${id}.wav`,
    `${id}.mp3`,
    `${id}.ogg`,
    `${id}.m4a`,
    `${id}.flac`,
    `${id}.webm`,
  ];

  const matchedName = candidates
    .map((name) => audioByName.get(name.toLowerCase()))
    .find(Boolean);

  if (!matchedName) {
    missingAudio++;
    issues.push(`រកមិនឃើញ audio សម្រាប់ metadata: ${filename} (id=${id})`);
    continue;
  }

  const actualSize = fs.statSync(path.join(FILES, matchedName)).size;

  if (Number.isFinite(item.size) && item.size !== actualSize) {
    sizeMismatch++;
    issues.push(
      `ទំហំមិនត្រូវគ្នា: ${matchedName}; metadata=${item.size}; actual=${actualSize}`
    );
  }
}

console.log("\n=== IQ-AI AUDIO LIBRARY AUDIT ===");
console.log(`Audio files:             ${audioFiles.length}`);
console.log(`Metadata JSON files:     ${metaFiles.length}`);
console.log(`Metadata with core fields: ${validMetadata}`);
console.log(`Synthetic-tagged/source: ${synthetic}`);
console.log(`Metadata without audio:  ${missingAudio}`);
console.log(`Size mismatches:         ${sizeMismatch}`);

console.log("\n=== COUNTS BY CATEGORY ===");
for (const [category, count] of [...categories].sort()) {
  console.log(`${category}: ${count}`);
}

const metadataIds = new Set();
for (const filename of metaFiles) {
  try {
    const item = JSON.parse(
      fs.readFileSync(path.join(META, filename), "utf8")
    );
    if (item.id) metadataIds.add(String(item.id).toLowerCase());
  } catch {}
}

const unmatchedAudio = audioFiles.filter((filename) => {
  const base = path.parse(filename).name.toLowerCase();
  return !metadataIds.has(base);
});

console.log(`\nAudio files without matching ID-named metadata: ${unmatchedAudio.length}`);

console.log("\n=== ISSUES ===");
if (issues.length === 0) {
  console.log("មិនរកឃើញបញ្ហាតាមការត្រួតពិនិត្យមូលដ្ឋាននេះទេ។");
} else {
  for (const issue of issues) console.log(`- ${issue}`);
}

if (unmatchedAudio.length) {
  for (const name of unmatchedAudio) console.log(`- Audio គ្មាន metadata ID match: ${name}`);
}

console.log("\nចំណាំ៖ ស្គ្រីបនេះមិនសាកល្បងចាក់សំឡេង និងមិនផ្ទៀងផ្ទាត់អាជ្ញាបណ្ណទេ។");
