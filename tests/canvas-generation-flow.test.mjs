import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenerationFlow } from '../src/canvas/generation-flow.mjs';

function harness(overrides = {}) {
  const nodes = new Map();
  const calls = { quotes: [], shown: [], submitted: [], polled: [], toasts: [] };
  const flow = createGenerationFlow({
    requestQuote: async (body) => { calls.quotes.push(body); return { quoteId: 'q1', credits: 10, kind: body.kind }; },
    submitJob: async (body) => { calls.submitted.push(body); return { id: 'job1' }; },
    pollJob: async (id, nodeId) => { calls.polled.push([id, nodeId]); },
    setNode: (id, patch) => nodes.set(id, { ...(nodes.get(id) || {}), ...patch }),
    toast: (message) => calls.toasts.push(message),
    showQuote: (quote, label) => calls.shown.push([quote, label]),
    buildImagePayload: (node, prompt) => ({ prompt, resolution: '2K' }),
    buildVideoPayload: (node, prompt) => ({ prompt, duration: 5 }),
    buildAudioPayload: (node, prompt) => ({ prompt }),
    ...overrides,
  });
  return { flow, nodes, calls };
}

test('image quote sets running then empty and shows modal', async () => {
  const { flow, nodes, calls } = harness();
  const node = { id: 'n1', type: 'image', generation: {} };
  const result = await flow.startImage(node, '一只猫');
  assert.equal(result.quoteId, 'q1');
  assert.equal(nodes.get('n1').status, 'empty');
  assert.equal(calls.quotes[0].kind, 'dreamina-image');
  assert.equal(calls.shown[0][1], '即梦图片');
});

test('quote failure marks node failed and toasts', async () => {
  const { flow, nodes, calls } = harness({ requestQuote: async () => { throw new Error('额度不足'); } });
  await flow.startVideo({ id: 'n2', generation: {} }, 'p');
  assert.equal(nodes.get('n2').status, 'failed');
  assert.match(nodes.get('n2').error, /额度不足/);
  assert.match(calls.toasts[0], /额度不足/);
});

test('confirm submits and polls; cancel clears pending', async () => {
  const { flow, nodes, calls } = harness();
  const node = { id: 'n3', generation: {} };
  await flow.startAudio(node, '旁白');
  assert.equal(await flow.confirm(false), false);
  assert.equal(flow.pending, null);
  await flow.startAudio(node, '旁白');
  assert.equal(await flow.confirm(true), true);
  assert.equal(calls.submitted[0].quoteId, 'q1');
  assert.deepEqual(calls.polled[0], ['job1', 'n3']);
  assert.equal(nodes.get('n3').status, 'running');
});
