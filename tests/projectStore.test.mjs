import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProjectStore, PROJECT_LIMITS } from '../src/projects/projectStore.mjs';

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'iqai-proj-'));

test('projects: create, get, list, update, remove (Khmer title works)', async () => {
  const dir = await tmp();
  const s = createProjectStore({ dir });
  const p = await s.create({ title: '  រឿងដំបូង  ', description: 'test' });
  assert.equal(p.title, 'រឿងដំបូង');
  assert.equal(p.status, 'draft');
  assert.deepEqual(await s.get(p.id), p);
  assert.equal((await s.list()).length, 1);
  const u = await s.update(p.id, { status: 'in_progress' });
  assert.equal(u.status, 'in_progress');
  assert.equal(u.title, 'រឿងដំបូង');
  assert.equal(u.createdAt, p.createdAt);
  await s.remove(p.id);
  await assert.rejects(s.get(p.id), { code: 'not_found' });
  assert.equal((await s.list()).length, 0);
});

test('projects: bad input is refused and nothing is stored', async () => {
  const s = createProjectStore({ dir: await tmp() });
  await assert.rejects(s.create({}), { code: 'bad_params' });
  await assert.rejects(s.create({ title: '   ' }), { code: 'bad_params' });
  await assert.rejects(s.create({ title: 'x'.repeat(PROJECT_LIMITS.title + 1) }), { code: 'bad_params' });
  await assert.rejects(s.create({ title: 'a', status: 'nope' }), { code: 'bad_params' });
  await assert.rejects(s.create(null), { code: 'bad_params' });
  const p = await s.create({ title: 'ok' });
  await assert.rejects(s.update(p.id, { status: 'nope' }), { code: 'bad_params' });
  assert.equal((await s.get(p.id)).status, 'draft');
  assert.equal((await s.list()).length, 1);
});

test('projects: unsafe ids are not_found, never touch the disk path', async () => {
  const s = createProjectStore({ dir: await tmp() });
  for (const id of ['../x', '..', 'a/b', '', 'not-a-uuid', 123, null]) {
    await assert.rejects(s.get(id), { code: 'not_found' });
    await assert.rejects(s.remove(id), { code: 'not_found' });
  }
});

test('projects: saved data survives a restart', async () => {
  const dir = await tmp();
  const p = await createProjectStore({ dir }).create({ title: 'keep me' });
  assert.equal((await createProjectStore({ dir }).get(p.id)).title, 'keep me');
});

test('projects: many parallel updates never corrupt the file', async () => {
  const dir = await tmp();
  const s = createProjectStore({ dir });
  const p = await s.create({ title: 'race' });
  await Promise.all(Array.from({ length: 30 }, (_, i) => s.update(p.id, { description: `d${i}` })));
  const after = await s.get(p.id);
  assert.match(after.description, /^d\d+$/);
  const left = (await fs.readdir(dir)).filter((n) => n.endsWith('.tmp'));
  assert.deepEqual(left, []);
});
