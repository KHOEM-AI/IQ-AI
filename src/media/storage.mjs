import fs from 'node:fs/promises';
import path from 'node:path';

export function createStorage(dir) {
  const root = path.resolve(dir);
  const ready = fs.mkdir(root, { recursive: true });
  const file = (id, ext) => path.join(root, `${id}.${ext}`);
  const missing = (e) => e && e.code === 'ENOENT';

  return {
    async save(id, buf, meta) {
      await ready;
      await fs.writeFile(file(id, 'bin'), buf);
      await fs.writeFile(file(id, 'json'), JSON.stringify(meta));
    },
    async saveMeta(id, meta) {
      await ready;
      const tmp = file(id, `json.${process.pid}.tmp`);
      await fs.writeFile(tmp, JSON.stringify(meta));
      await fs.rename(tmp, file(id, 'json'));
    },
    async getMeta(id) {
      await ready;
      try {
        return JSON.parse(await fs.readFile(file(id, 'json'), 'utf8'));
      } catch (e) {
        if (missing(e)) return null;
        throw e;
      }
    },
    async readContent(id) {
      await ready;
      try {
        return await fs.readFile(file(id, 'bin'));
      } catch (e) {
        if (missing(e)) return null;
        throw e;
      }
    },
    async remove(id) {
      await ready;
      await fs.rm(file(id, 'json'), { force: true });
      await fs.rm(file(id, 'bin'), { force: true });
    },
    async listMeta() {
      await ready;
      const names = (await fs.readdir(root)).filter((n) => n.endsWith('.json'));
      const out = [];
      for (const n of names) {
        try {
          out.push(JSON.parse(await fs.readFile(path.join(root, n), 'utf8')));
        } catch {
          /* skip unreadable metadata */
        }
      }
      return out;
    },
  };
}
