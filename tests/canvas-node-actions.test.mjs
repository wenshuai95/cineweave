import test from 'node:test';
import assert from 'node:assert/strict';
import { createNodeActions } from '../src/canvas/node-actions.mjs';

function harness() {
  const calls = [];
  const run = createNodeActions({
    remove: (node) => calls.push(['remove', node.id]),
    copy: (node) => calls.push(['copy', node.id]),
    download: (node) => calls.push(['download', node.id]),
    postProcess: async (node, mode) => calls.push(['post', node.id, mode]),
    matte: async (node) => calls.push(['matte', node.id]),
    relayVSR: async (node) => calls.push(['relayVSR', node.id]),
    smartEdit: async (node) => calls.push(['smart', node.id]),
    openTimeline: (node) => calls.push(['timeline', node.id]),
    openStage: () => calls.push(['stage']),
    fallback: (tool) => calls.push(['fallback', tool]),
  });
  return { run, calls };
}

test('dispatches type-specific tools', async () => {
  const h = harness();
  await h.run({ id: 'i1', type: 'image' }, '抠图');
  await h.run({ id: 'i1', type: 'image' }, '修脸');
  await h.run({ id: 'v1', type: 'video' }, '视频超分');
  await h.run({ id: 't1', type: 'timeline' }, '打开时间线');
  assert.deepEqual(h.calls[0], ['matte', 'i1']);
  assert.deepEqual(h.calls[1], ['post', 'i1', 'detail']);
  assert.deepEqual(h.calls[2], ['relayVSR', 'v1']);
  assert.deepEqual(h.calls[3], ['timeline', 't1']);
});

test('fallback for unknown tools and wrong type', async () => {
  const h = harness();
  assert.equal(await h.run({ id: 'i1', type: 'image' }, '不存在的工具'), false);
  assert.deepEqual(h.calls[0], ['fallback', '不存在的工具']);
  assert.equal(await h.run({ id: 'a1', type: 'audio' }, '抠图'), false);
});
