import fs from 'node:fs/promises';
import path from 'node:path';

export const ID_RE = /^[0-9a-f-]{36}$/;

export function createStorage(dir) {
  const files = path.join(dir, 'files');
  const meta = path.join(dir, 'meta');
  const tmp = path.join(dir, 'tmp');

  const readJson = async (p) =>
    JSON.parse(await fs.readFile(p, 'utf8'));

  return {
    async init() {
      for (const d of [files, meta, tmp]) {
        await fs.mkdir(d, { recursive: true });
      }
    },

    async recover() {
      const fileEntries = await fs.readdir(files, {
        withFileTypes: true,
      });
      const metaEntries = await fs.readdir(meta, {
        withFileTypes: true,
      });
      const tmpEntries = await fs.readdir(tmp, {
        withFileTypes: true,
      });

      const regularFiles = new Set(
        fileEntries.filter((e) => e.isFile()).map((e) => e.name)
      );

      const validMetaIds = new Set();

      for (const entry of metaEntries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) {
          continue;
        }

        const filename = entry.name;
        const id = filename.slice(0, -5);

        let valid = false;

        if (ID_RE.test(id) && regularFiles.has(id)) {
          try {
            const data = await readJson(path.join(meta, filename));
            valid = data && data.id === id;
          } catch {
            valid = false;
          }
        }

        if (valid) {
          validMetaIds.add(id);
        } else {
          await fs.rm(path.join(meta, filename), { force: true });
        }
      }

      for (const entry of fileEntries) {
        if (
          entry.isFile() &&
          ID_RE.test(entry.name) &&
          !validMetaIds.has(entry.name)
        ) {
          await fs.rm(path.join(files, entry.name), { force: true });
        }
      }

      for (const entry of tmpEntries) {
        if (entry.isFile()) {
          await fs.rm(path.join(tmp, entry.name), { force: true });
        }
      }

      return {
        valid: validMetaIds.size,
        removedFiles: fileEntries.filter(
          (e) => e.isFile() && ID_RE.test(e.name) &&
            !validMetaIds.has(e.name)
        ).length,
        removedTempFiles: tmpEntries.filter((e) => e.isFile()).length,
      };
    },

    tmpPath: (id) => path.join(tmp, id),
    filePath: (id) => path.join(files, id),

    commit: (id) =>
      fs.rename(path.join(tmp, id), path.join(files, id)),

    discard: (id) =>
      fs.rm(path.join(tmp, id), { force: true }),

    saveMeta: (m) =>
      fs.writeFile(
        path.join(meta, m.id + '.json'),
        JSON.stringify(m)
      ),

    async getMeta(id) {
      try {
        return await readJson(path.join(meta, id + '.json'));
      } catch {
        return null;
      }
    },

    async listMeta() {
      const out = [];

      for (const f of await fs.readdir(meta)) {
        if (f.endsWith('.json')) {
          try {
            out.push(await readJson(path.join(meta, f)));
          } catch {}
        }
      }

      return out;
    },

    async remove(id) {
      await fs.rm(path.join(files, id), { force: true });
      await fs.rm(path.join(meta, id + '.json'), { force: true });
    },
  };
}
