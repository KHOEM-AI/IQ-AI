import { ok, fail, readBody } from '../respond.mjs';
import { PROJECT_STATUSES, PROJECT_LIMITS } from '../../projects/projectStore.mjs';

// GET    /api/v1/projects        -> { items, statuses, limits }
// POST   /api/v1/projects        JSON {"title", "description"?, "status"?} -> 201 project
// GET    /api/v1/projects/:id    -> project
// PATCH  /api/v1/projects/:id    (PUT also accepted) JSON with any of title, description, status
// DELETE /api/v1/projects/:id    -> { id }
const HTTP = { bad_params: 400, not_found: 404, too_many: 409 };

async function jsonBody(req, res) {
  try {
    const raw = (await readBody(req, 64 * 1024)).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    if (e && e.code === 'too_large') throw e;
    fail(res, 400, 'bad_request', 'Body must be JSON');
    return undefined;
  }
}

export async function handleProjects(req, res, p, ctx) {
  const m = /^\/api\/v1\/projects(?:\/([^/]+))?$/.exec(p);
  if (!m) return false;
  const id = m[1];
  const store = ctx.projects;
  try {
    if (!id) {
      if (req.method === 'GET') {
        ok(res, 200, { items: await store.list(), statuses: PROJECT_STATUSES, limits: PROJECT_LIMITS });
        return true;
      }
      if (req.method === 'POST') {
        const body = await jsonBody(req, res);
        if (body === undefined) return true;
        ok(res, 201, await store.create(body));
        return true;
      }
    } else {
      if (req.method === 'GET') { ok(res, 200, await store.get(id)); return true; }
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const body = await jsonBody(req, res);
        if (body === undefined) return true;
        ok(res, 200, await store.update(id, body));
        return true;
      }
      if (req.method === 'DELETE') { await store.remove(id); ok(res, 200, { id }); return true; }
    }
    fail(res, 405, 'method_not_allowed', 'Method not allowed');
    return true;
  } catch (e) {
    if (e && HTTP[e.code]) { fail(res, HTTP[e.code], e.code, e.message); return true; }
    throw e;
  }
}
