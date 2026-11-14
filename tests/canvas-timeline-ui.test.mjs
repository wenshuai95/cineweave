import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimelineUI } from '../src/canvas/timeline-ui.mjs';

function fakeApp() {
  const nodes = new Map();
  const make = () => ({ innerHTML: '', textContent: '', hidden: false, src: '', muted: false, disabled: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, contains: () => false }, querySelectorAll: () => [], addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 100 }), load() {} });
  for (const id of ['#timelineModal', '#timelineAssets', '#timelineRuler', '#timelineLanes', '#timelineTotal', '#timelinePreview', '#timelinePreviewImage', '#timelinePreviewEmpty', '#timelinePlayhead', '#timelinePlay', '#timelineExport']) nodes.set(id, make());
  return { querySelector: (id) => nodes.get(id), nodes };
}

test('opens timeline from node items and saves back', () => {
  const app = fakeApp();
  const updates = [];
  const nodes = [{ id: 'v1', type: 'video', title: '镜头', resources: [{ url: '/v.mp4' }] }];
  const ui = createTimelineUI({
    app,
    getNodes: () => nodes,
    getNode: (id) => nodes.find((node) => node.id === id),
    updateNode: (id, patch) => updates.push([id, patch]),
    render: () => {},
    nodeRect: () => ({ x: 0, y: 0, width: 600, height: 320 }),
    embed: false,
  });
  assert.equal(ui.open({ id: 't1', timelineItems: [], type: 'timeline' }), true);
  assert.match(app.nodes.get('#timelineTotal').textContent, /1 个片段/);
  assert.equal(ui.split(), true);
  assert.equal(ui.save(), true);
  assert.equal(updates[0][0], 't1');
  assert.equal(updates[0][1].timelineItems.length, 2);
});
