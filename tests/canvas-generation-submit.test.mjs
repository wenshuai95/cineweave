import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenerationSubmit } from '../src/canvas/generation-submit.mjs';

function harness(overrides = {}) {
  const calls = [];
  const nodes = new Map();
  const submit = createGenerationSubmit({
    getNodeById: () => null,
    getPrompt: () => '一只猫',
    setNode: (id, patch) => { calls.push(['set', id, patch]); nodes.set(id, { ...(nodes.get(id) || {}), ...patch }); },
    render: () => calls.push(['render']),
    toast: (message) => calls.push(['toast', message]),
    submitJob: async (body) => { calls.push(['submit', body]); return { id: 'job1' }; },
    pollJob: async (id, nodeId) => calls.push(['poll', id, nodeId]),
    probeProviders: () => calls.push(['probe']),
    setSendDisabled: (value) => calls.push(['send', value]),
    frameRefs: () => ({}),
    comfyImageSize: () => ({ width: 1024, height: 768 }),
    rememberModelParams: () => calls.push(['remember']),
    startImageQuote: async (node) => calls.push(['quote', node.id]),
    startVideoQuote: async (node) => calls.push(['videoQuote', node.id]),
    startComfyVideo: async (node) => calls.push(['comfyVideo', node.id]),
    startAudioQuote: async (node) => calls.push(['audioQuote', node.id]),
    ...overrides,
  });
  return { submit, calls, nodes };
}

test('comfy image submits with size and polls', async () => {
  const h = harness();
  const node = { id: 'i1', type: 'image', generation: { imageWorkflow: 'qwen21-t2i' } };
  assert.equal(await h.submit.generate(node), true);
  assert.equal(h.calls.find((call) => call[0] === 'submit')[1].kind, 'comfyui-image');
  assert.equal(h.calls.find((call) => call[0] === 'submit')[1].width, 1024);
  assert.ok(h.calls.some((call) => call[0] === 'poll'));
});

test('dispatches audio/video backends', async () => {
  const h = harness();
  await h.submit.generate({ id: 'a1', type: 'audio', generation: {} });
  await h.submit.generate({ id: 'v1', type: 'video', generation: { backend: { provider: 'comfyui' } } });
  await h.submit.generate({ id: 'v2', type: 'video', generation: { backend: { provider: 'dreamina' } } });
  assert.deepEqual(h.calls.filter((call) => call[0].includes('Quote') || call[0] === 'comfyVideo').map((call) => call[0]), ['audioQuote', 'comfyVideo', 'videoQuote']);
});

test('dreamina image with refs is blocked', async () => {
  const h = harness({ getNodeById: () => ({ type: 'image' }) });
  const node = { id: 'i1', type: 'image', generation: { backend: { provider: 'dreamina' }, references: [{ id: 'r1' }] } };
  assert.equal(await h.submit.generate(node), false);
  assert.ok(h.calls.some((call) => call[1] === '即梦 API 图片暂不支持本地参考图，请切回 ComfyUI'));
});
