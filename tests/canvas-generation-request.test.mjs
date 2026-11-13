import test from 'node:test';
import assert from 'node:assert/strict';
import { submitJob, requestQuote, uploadDataUrl } from '../src/canvas/generation-request.mjs';

const response = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });

test('submitJob posts JSON and returns id', async () => {
  let seen;
  const data = await submitJob({ kind: 'comfyui-image', prompt: 'p' }, {
    fetchImpl: async (url, options) => { seen = { url, method: options.method, body: options.body }; return response({ id: 'job_1' }); },
  });
  assert.equal(data.id, 'job_1');
  assert.equal(seen.url, '/api/generation/jobs');
  assert.equal(seen.method, 'POST');
  assert.match(seen.body, /comfyui-image/);
});

test('submitJob surfaces server errors', async () => {
  await assert.rejects(() => submitJob({}, { fetchImpl: async () => response({ error: '队列已满' }, false, 429) }), /队列已满/);
});

test('requestQuote returns quote', async () => {
  const quote = await requestQuote({ kind: 'dreamina-video' }, { fetchImpl: async () => response({ quoteId: 'q', credits: 10 }) });
  assert.equal(quote.quoteId, 'q');
});

test('uploadDataUrl posts dataUrl and returns url', async () => {
  let body;
  const uploaded = await uploadDataUrl('data:image/png;base64,AA', {
    fetchImpl: async (_url, options) => { body = options.body; return response({ url: '/api/generation/assets/mask.png' }); },
  });
  assert.equal(uploaded.url, '/api/generation/assets/mask.png');
  assert.match(body, /data:image\/png/);
});

test('upload error is actionable', async () => {
  await assert.rejects(() => uploadDataUrl('x', { fetchImpl: async () => response({ error: '图片过大' }, false, 400) }), /图片过大/);
});
