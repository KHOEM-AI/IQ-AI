import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Background job queue for work that takes longer than one HTTP request (long videos).
// - In-process queue, `concurrency` jobs at a time (1 is right for a phone), at most `maxQueue` waiting.
// - States: queued -> running -> done | failed | cancelled.
// - If `dir` is given, every state change is saved to <dir>/<id>.json (atomic rename), so finished jobs
//   survive a restart; jobs that were queued/running at shutdown are marked failed ('interrupted').
// - Finished jobs older than `ttlMs` are deleted. The job's RESULT is not stored here: handlers put it
//   in the media registry and return { mediaId }, so it can be downloaded (with Range) and chained.
// A handler is async ({ params, signal, setProgress }) => result object (JSON-serialisable).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isJobId = (id) => typeof id === 'string' && UUID_RE.test(id);
const FINISHED = new Set(['done', 'failed', 'cancelled']);

export function createJobManager({ handlers, dir, concurrency = 1, maxQueue = 20, ttlMs = 24 * 3600 * 1000 } = {}) {
  const jobs = new Map();
  const controllers = new Map();
  const queue = [];
  let running = 0;
  let closed = false;
  const idle = [];

  const file = (id) => path.join(dir, `${id}.json`);
  const view = (j) => ({ ...j });
  async function persist(j) {
    if (!dir) return;
    const tmp = `${file(j.id)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(j));
    await fs.rename(tmp, file(j.id));
  }
  const save = (j) => persist(j).catch((e) => console.error('job save error:', e && e.message));
  const now = () => new Date().toISOString();

  async function load() {
    if (!dir) return;
    await fs.mkdir(dir, { recursive: true });
    for (const n of await fs.readdir(dir)) {
      if (!n.endsWith('.json')) continue;
      try {
        const j = JSON.parse(await fs.readFile(path.join(dir, n), 'utf8'));
        if (!isJobId(j.id)) continue;
        if (!FINISHED.has(j.status)) {
          Object.assign(j, { status: 'failed', error: { code: 'interrupted', message: 'Server restarted while the job was not finished' }, finishedAt: now() });
          await persist(j);
        }
        jobs.set(j.id, j);
      } catch { /* unreadable file: ignore */ }
    }
  }
  const ready = load();

  async function sweep() {
    const cut = Date.now() - ttlMs;
    for (const j of [...jobs.values()]) {
      if (FINISHED.has(j.status) && Date.parse(j.finishedAt) < cut) {
        jobs.delete(j.id);
        if (dir) await fs.rm(file(j.id), { force: true }).catch(() => {});
      }
    }
  }
  const timer = setInterval(() => { sweep().catch(() => {}); }, Math.min(ttlMs, 3600 * 1000));
  timer.unref();

  function settle() { if (!running && !queue.length) while (idle.length) idle.shift()(); }

  async function runOne(j) {
    const ac = new AbortController();
    controllers.set(j.id, ac);
    running++;
    j.status = 'running'; j.startedAt = now();
    await save(j);
    try {
      const result = await handlers[j.type]({
        params: j.params,
        signal: ac.signal,
        setProgress: (v) => { if (Number.isFinite(v)) j.progress = Math.max(0, Math.min(1, v)); },
      });
      if (ac.signal.aborted) throw Object.assign(new Error('aborted'), { code: 'aborted' });
      Object.assign(j, { status: 'done', progress: 1, result: result ?? null });
    } catch (e) {
      if (ac.signal.aborted || (e && e.code === 'aborted')) {
        j.status = 'cancelled';
      } else {
        j.status = 'failed';
        j.error = { code: (e && e.jobCode) || 'job_failed', message: (e && e.jobMessage) || 'Job failed' };
        if (!(e && e.jobCode) || e.detail) console.error(`job ${j.id} (${j.type}) error:`, e && (e.detail || e.message)); // bad input is not a server fault
      }
    } finally {
      j.finishedAt = now();
      controllers.delete(j.id);
      running--;
      await save(j);
      pump();
      settle();
    }
  }

  function pump() {
    while (!closed && running < concurrency && queue.length) {
      const id = queue.shift();
      const j = jobs.get(id);
      if (j && j.status === 'queued') runOne(j);
    }
  }

  return {
    types: () => Object.keys(handlers),
    // -> { ok:true, job } | { ok:false, status, code, message }
    async submit(type, params) {
      await ready;
      if (closed) return { ok: false, status: 503, code: 'shutting_down', message: 'Server is shutting down' };
      if (!Object.hasOwn(handlers, type)) return { ok: false, status: 400, code: 'bad_params', message: `Unknown job type. Use one of: ${Object.keys(handlers).join(', ')}` };
      if (queue.length >= maxQueue) return { ok: false, status: 429, code: 'queue_full', message: `Too many jobs waiting (max ${maxQueue})` };
      const j = { id: crypto.randomUUID(), type, status: 'queued', progress: 0, params: params ?? {}, result: null, error: null, createdAt: now(), startedAt: null, finishedAt: null };
      jobs.set(j.id, j);
      queue.push(j.id);
      await save(j);
      pump();
      return { ok: true, job: view(j) };
    },
    async get(id) { await ready; const j = jobs.get(id); return j ? view(j) : null; },
    async list() {
      await ready;
      return [...jobs.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(view);
    },
    // queued/running -> cancelled; finished -> removed. Returns the final view or null if unknown.
    async cancelOrRemove(id) {
      await ready;
      const j = jobs.get(id);
      if (!j) return null;
      if (j.status === 'queued') {
        const i = queue.indexOf(id); if (i >= 0) queue.splice(i, 1);
        Object.assign(j, { status: 'cancelled', finishedAt: now() });
        await save(j);
        settle();
      } else if (j.status === 'running') {
        controllers.get(id)?.abort();
        // runOne() records the final state; wait for it so the caller sees 'cancelled'
        while (j.status === 'running') await new Promise((r) => setTimeout(r, 10));
      } else {
        jobs.delete(id);
        if (dir) await fs.rm(file(id), { force: true }).catch(() => {});
        return { ...view(j), removed: true };
      }
      return view(j);
    },
    // resolves when nothing is queued or running (tests / graceful shutdown)
    async whenIdle() { await ready; if (running || queue.length) await new Promise((r) => idle.push(r)); },
    async close() {
      closed = true;
      clearInterval(timer);
      for (const id of queue.splice(0)) {
        const j = jobs.get(id);
        if (j) { Object.assign(j, { status: 'cancelled', finishedAt: now() }); await save(j); }
      }
      for (const ac of controllers.values()) ac.abort();
      await this.whenIdle();
    },
  };
}
