import test from 'node:test';
import assert from 'node:assert/strict';
import { getJob, listJobs, cancelJob, retryJob, waitForJob } from '../src/canvas/job-client.mjs';

const response = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });

test('getJob encodes id and returns payload', async () => {
  let url = '';
  const job = await getJob('job a/b', { fetchImpl: async (next) => { url = next; return response({ id: 'x' }); } });
  assert.equal(job.id, 'x');
  assert.match(url, /job%20a%2Fb/);
});

test('listJobs clamps limit and returns array', async () => {
  const jobs = await listJobs({ limit: 999, fetchImpl: async () => response({ jobs: [{ id: 'a' }] }) });
  assert.equal(jobs.length, 1);
});

test('cancel and retry use POST endpoints', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push([url, options?.method]); return response({ ok: true }); };
  await cancelJob('a', { fetchImpl });
  await retryJob('b', { fetchImpl });
  assert.deepEqual(calls, [['/api/generation/jobs/a/cancel', 'POST'], ['/api/generation/jobs/b/retry', 'POST']]);
});

test('waitForJob polls until terminal and emits updates', async () => {
  const states = [
    { id: 'a', status: 'running', progress: 20 },
    { id: 'a', status: 'running', progress: 60 },
    { id: 'a', status: 'success', progress: 100, result: { url: '/x' } },
  ];
  const seen = [];
  const job = await waitForJob('a', {
    intervalMs: 1,
    fetchImpl: async () => response(states.shift()),
    onUpdate: (next) => seen.push(next.status),
  });
  assert.equal(job.status, 'success');
  assert.deepEqual(seen, ['running', 'running', 'success']);
});

test('waitForJob rejects on non-ok response', async () => {
  await assert.rejects(() => waitForJob('a', { intervalMs: 1, fetchImpl: async () => response({}, false, 500) }), /HTTP 500/);
});
