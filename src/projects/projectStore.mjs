import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Project store: one JSON file per project in `dir` (atomic write). No AI, no network.
// A project is { id, title, description, status, createdAt, updatedAt }.
// Errors are Error objects with .code = bad_params | not_found | too_many.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isProjectId = (id) => typeof id === 'string' && UUID_RE.test(id);
export const PROJECT_LIMITS = { title: 120, description: 2000, projects: 500 };
export const PROJECT_STATUSES = ['draft', 'in_progress', 'done', 'archived'];
const err = (code, message) => Object.assign(new Error(message), { code });

function clean(input, partial) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw err('bad_params', 'body must be a JSON object');
  const out = {};
  if (!partial || input.title !== undefined) {
    if (typeof input.title !== 'string' || !input.title.trim()) throw err('bad_params', 'title is required');
    const title = input.title.trim();
    if (Array.from(title).length > PROJECT_LIMITS.title) throw err('bad_params', `title must be at most ${PROJECT_LIMITS.title} characters`);
    out.title = title;
  }
  if (input.description !== undefined) {
    if (typeof input.description !== 'string') throw err('bad_params', 'description must be a string');
    if (Array.from(input.description).length > PROJECT_LIMITS.description) throw err('bad_params', `description must be at most ${PROJECT_LIMITS.description} characters`);
    out.description = input.description;
  }
  if (input.status !== undefined) {
    if (!PROJECT_STATUSES.includes(input.status)) throw err('bad_params', `status must be one of: ${PROJECT_STATUSES.join(', ')}`);
    out.status = input.status;
  }
  return out;
}

export function createProjectStore({ dir } = {}) {
  if (!dir) throw new Error('dir is required');
  const file = (id) => path.join(dir, `${id}.json`);
  let chain = Promise.resolve();
  const serial = (fn) => { const r = chain.then(fn); chain = r.catch(() => {}); return r; };
  const now = () => new Date().toISOString();

  async function write(p) {
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file(p.id)}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(p));
    await fs.rename(tmp, file(p.id));
  }
  async function read(id) {
    if (!isProjectId(id)) throw err('not_found', 'Project not found');
    try { return JSON.parse(await fs.readFile(file(id), 'utf8')); }
    catch (e) { throw err('not_found', 'Project not found'); }
  }
  async function all() {
    let names = [];
    try { names = await fs.readdir(dir); } catch { return []; }
    const items = [];
    for (const n of names) {
      if (!n.endsWith('.json')) continue;
      try { const p = JSON.parse(await fs.readFile(path.join(dir, n), 'utf8')); if (isProjectId(p.id)) items.push(p); } catch { /* skip unreadable */ }
    }
    return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  return {
    create: (input) => serial(async () => {
      const f = clean(input, false);
      if ((await all()).length >= PROJECT_LIMITS.projects) throw err('too_many', `at most ${PROJECT_LIMITS.projects} projects`);
      const t = now();
      const p = { id: crypto.randomUUID(), title: f.title, description: f.description ?? '', status: f.status ?? 'draft', createdAt: t, updatedAt: t };
      await write(p);
      return p;
    }),
    get: (id) => read(id),
    list: () => all(),
    update: (id, input) => serial(async () => {
      const f = clean(input, true);
      const p = { ...(await read(id)), ...f, updatedAt: now() };
      await write(p);
      return p;
    }),
    remove: (id) => serial(async () => {
      await read(id);
      await fs.rm(file(id), { force: true });
    }),
  };
}
