import test from 'node:test';
import assert from 'node:assert/strict';
import { minimapBounds, minimapTransform, paintMinimap } from '../src/canvas/minimap.mjs';

const nodeRect = (node) => ({ x: node.x, y: node.y, width: node.width, height: node.height });

test('bounds include nodes and viewport with padding', () => {
  const bounds = minimapBounds({ nodes: [{ x: 0, y: 0, width: 100, height: 50 }], nodeRect, stageWidth: 800, stageHeight: 600, viewport: { x: 0, y: 0, zoom: 1 } });
  assert.equal(bounds.width, 800 + 160);
  assert.equal(bounds.height, 600 + 160);
  assert.ok(bounds.viewport.width > 0);
});

test('transform centers content and paint draws empty state', () => {
  const bounds = { minX: -80, minY: -80, width: 960, height: 760, viewport: { x: 0, y: 0, width: 800, height: 600 } };
  const transform = minimapTransform(bounds, 240, 160);
  assert.ok(transform.scale > 0);
  const calls = [];
  const ctx = new Proxy({}, { get: (_t, key) => (typeof key === 'string' ? (...args) => calls.push([key, ...args]) : undefined), set: () => true });
  paintMinimap(ctx, { width: 240, height: 160, nodes: [], nodeRect, bounds });
  assert.ok(calls.some(([name]) => name === 'fillText'));
});
