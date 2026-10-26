import crypto from 'node:crypto';
import { validateUpload, safeFilename } from './validation.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isValidId = (id) => UUID_RE.test(id);

export function createRegistry(storage) {
  return {
    async create({ buf, mime, filename }) {
      const v = validateUpload(buf, mime);
      if (!v.ok) return v;
      const id = crypto.randomUUID();
      const meta = {
        id,
        type: v.type,
        mime: v.mime,
        size: buf.length,
        filename: safeFilename(filename),
        status: 'ready',
        createdAt: new Date().toISOString(),
      };
      await storage.save(id, buf, meta);
      return { ok: true, data: meta };
    },
    get: (id) => storage.getMeta(id),
    content: (id) => storage.readContent(id),
    remove: (id) => storage.remove(id),
    async list() {
      const items = await storage.listMeta();
      return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
  };
}
