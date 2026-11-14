import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrimTools } from '../src/canvas/trim-tools.mjs';

function fakeApp() {
  const nodes = new Map();
  const make = () => ({ value: '', textContent: '', src: '', max: '', width: 0, height: 0, dataset: {}, duration: 10, classList: { add() {}, remove() {} }, load() {}, getContext: () => ({}) });
  for (const id of ['#videoTrimPreview', '#videoTrimModal', '#videoTrimStart', '#videoTrimEnd', '#videoTrimInfo', '#audioTrimModal', '#trimInfo', '#trimWave', '#trimStart', '#trimEnd']) nodes.set(id, make());
  return { querySelector: (id) => nodes.get(id), nodes };
}

test('video trim confirms with start/end and commits resource', async () => {
  const app = fakeApp();
  const committed = [];
  const updates = [];
  const tools = createTrimTools({
    app,
    commitResource: (id, resource) => committed.push([id, resource]),
    setNode: (id, patch) => updates.push([id, patch]),
    render: () => {},
    requestVideoTrim: async (body) => ({ filename: 'v.mp4', url: '/v.mp4', body }),
  });
  await tools.openVideo({ id: 'n1', resources: [{ url: '/in.mp4' }] });
  app.nodes.get('#videoTrimStart').value = '1';
  app.nodes.get('#videoTrimEnd').value = '4';
  assert.equal(await tools.confirmVideo(), true);
  assert.equal(committed[0][0], 'n1');
  assert.equal(committed[0][1].source, 'trim');
  assert.equal(updates[0][1].status, 'success');
});

test('audio trim loads peaks and applies resource update', async () => {
  const app = fakeApp();
  let update;
  const tools = createTrimTools({
    app,
    setNode: (id, patch) => { update = [id, patch]; },
    render: () => {},
    peaksFor: async () => ({ peaks: [0.1, 0.5], duration: 8 }),
    drawWave: () => {},
    requestAudioTrim: async () => ({ filename: 'a.mp3', url: '/a.mp3' }),
  });
  assert.equal(await tools.openAudio({ id: 'a1', resources: [{ url: '/in.mp3' }] }), true);
  app.nodes.get('#trimStart').value = '1';
  app.nodes.get('#trimEnd').value = '5';
  assert.equal(await tools.confirmAudio(), true);
  assert.equal(update[0], 'a1');
  assert.equal(update[1].resources[0].source, 'trim');
});
