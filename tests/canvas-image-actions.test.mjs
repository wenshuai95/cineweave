import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageActions } from '../src/canvas/image-actions.mjs';

function harness(overrides = {}) {
  const calls = [];
  const nodes = new Map();
  const actions = createImageActions({
    submitJob: async (body) => { calls.push(['submit', body]); return { id: 'job1' }; },
    pollJob: async (id, nodeId) => { calls.push(['poll', id, nodeId]); },
    setNode: (id, patch) => { calls.push(['set', id, patch]); nodes.set(id, { ...(nodes.get(id) || {}), ...patch }); },
    toast: (message) => calls.push(['toast', message]),
    getPrompt: () => '灯光更暖',
    translate: async (text) => `EN:${text}`,
    ...overrides,
  });
  return { actions, calls, nodes };
}

test('post process submits upscale and polls', async () => {
  const { actions, calls } = harness();
  await actions.postProcess({ id: 'n1', resources: [{ url: '/x.png' }], generation: { prompt: 'p' } }, 'upscale');
  assert.equal(calls[0][0], 'set');
  assert.match(calls[0][2].jobMessage, /放大/);
  assert.equal(calls[1][1].kind, 'comfyui-upscale');
  assert.ok(calls.some((call) => call[0] === 'poll'));
});

test('relight translates prompt and sends variant', async () => {
  const { actions, calls } = harness();
  await actions.relight({ id: 'n1', resources: [{ url: '/x.png' }], generation: { prompt: 'p' } }, 'light');
  assert.equal(calls[1][1].prompt, 'EN:灯光更暖');
  assert.equal(calls[1][1].variant, 'light');
});

test('missing media toasts and does not submit', async () => {
  const { actions, calls } = harness();
  const result = await actions.matte({ id: 'n1', resources: [] });
  assert.equal(result, false);
  assert.equal(calls.length, 1);
  assert.match(calls[0][1], /先生成一张图片/);
});

test('submit failure marks node failed', async () => {
  const { actions, nodes } = harness({ submitJob: async () => { throw new Error('OOM'); } });
  await actions.outcrop({ id: 'n1', resources: [{ url: '/x.png' }], generation: {} }, 'left');
  assert.equal(nodes.get('n1').status, 'failed');
  assert.match(nodes.get('n1').error, /OOM/);
});
