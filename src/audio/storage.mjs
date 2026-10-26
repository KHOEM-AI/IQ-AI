import fs from 'node:fs/promises';
import path from 'node:path';

export const ID_RE = /^[0-9a-f-]{36}$/;

export function createStorage(dir) {
  const files = path.join(dir, 'files'), meta = path.join(dir, 'meta'), tmp = path.join(dir, 'tmp');
  const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
  return {
    async init() { for (const d of [files, meta, tmp]) await fs.mkdir(d, { recursive: true }); },
    tmpPath: (id) => path.join(tmp, id),
    filePath: (id) => path.join(files, id),
    commit: (id) => fs.rename(path.join(tmp, id), path.join(files, id)),
    discard: (id) => fs.rm(path.join(tmp, id), { force: true }),
    saveMeta: (m) => fs.writeFile(path.join(meta, m.id + '.json'), JSON.stringify(m)),
    async getMeta(id) { try { return await readJson(path.join(meta, id + '.json')); } catch { return null; } },
    async listMeta() {
      const out = [];
      for (const f of await fs.readdir(meta)) {
        if (f.endsWith('.json')) { try { out.push(await readJson(path.join(meta, f))); } catch {} }
      }
      return out;
    },
    async remove(id) {
      await fs.rm(path.join(files, id), { force: true });
      await fs.rm(path.join(meta, id + '.json'), { force: true });
    },
  };
}
