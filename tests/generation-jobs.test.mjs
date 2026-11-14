import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJobStore } from '../generation/jobs.mjs';

function tempStore() {
  const dir = mkdtempSync(join(tmpdir(), 'zaomeng-jobs-'));
  const store = createJobStore({ path: join(dir, 'jobs.json') });
  return { store, dir };
}

test('jobs are persisted and reloaded after a store restart', () => {
  const { store, dir } = tempStore();
  try {
    const job = store.create('comfyui-video', { prompt: 'p', request: { kind: 'comfyui-video', prompt: 'p' } });
    store.update(job.id, { status: 'running', progress: 40, message: '生成中…' });
    const reloaded = createJobStore({ path: join(dir, 'jobs.json') }).get(job.id);
    assert.equal(reloaded.id, job.id);
    assert.equal(reloaded.status, 'failed');
    assert.equal(reloaded.error.code, 'JOB_INTERRUPTED');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a canceled job cannot be overwritten by a late failure', () => {
  const { store, dir } = tempStore();
  try {
    const job = store.create('comfyui-video', {});
    store.update(job.id, { status: 'canceled', message: '已取消' });
    store.update(job.id, { status: 'failed', message: 'late failure' });
    assert.equal(store.get(job.id).status, 'canceled');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('running jobs expose stage and eta, terminal jobs clear eta', () => {
  const { store, dir } = tempStore();
  try {
    const job = store.create('comfyui-video', {});
    store.update(job.id, { status: 'running', progress: 50, message: '生成中…' });
    const running = store.get(job.id);
    assert.equal(running.stage, 'sampling');
    assert.ok(running.etaSeconds >= 0);
    store.update(job.id, { status: 'success', progress: 100, message: '完成' });
    assert.equal(store.get(job.id).etaSeconds, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('list returns newest jobs first and respects limit', () => {
  const { store, dir } = tempStore();
  try {
    const first = store.create('comfyui-image', {});
    const second = store.create('comfyui-image', {});
    const list = store.list({ limit: 1 });
    assert.equal(list.length, 1);
    assert.equal(list[0].id, second.id);
    assert.ok(list[0].createdAt >= first.createdAt);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
