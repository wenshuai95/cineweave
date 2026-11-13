import test from 'node:test';
import assert from 'node:assert/strict';
import { edgePathsHtml } from '../src/canvas/edge-view.mjs';

const positions = new Map([
  ['a', { x: 0, y: 0, width: 100, height: 50 }],
  ['b', { x: 200, y: 100, width: 100, height: 50 }],
]);

test('edges render selected state and data id', () => {
  const html = edgePathsHtml({ edges: [{ id: 'e1', from: 'a', to: 'b' }], positions, selectedEdge: 'e1' });
  assert.match(html, /class="selected"/);
  assert.match(html, /data-edge="e1"/);
});

test('missing endpoints are skipped and temp link renders', () => {
  const html = edgePathsHtml({ edges: [{ id: 'e1', from: 'a', to: 'missing' }], positions, tempLink: { from: 'a', to: { x: 50, y: 60 } } });
  assert.doesNotMatch(html, /data-edge/);
  assert.match(html, /cv-edge-temp/);
});
