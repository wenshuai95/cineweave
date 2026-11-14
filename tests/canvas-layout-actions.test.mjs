import test from 'node:test';
import assert from 'node:assert/strict';
import { alignPositions, stackPositions } from '../src/canvas/layout-actions.mjs';

const rects = [
  { id: 'a', x: 10, y: 20, width: 100, height: 50 },
  { id: 'b', x: 200, y: 80, width: 80, height: 40 },
];

test('align left/right/top/bottom snaps to grid', () => {
  assert.deepEqual(alignPositions(rects, 'left'), [{ x: 8, y: 24 }, { x: 8, y: 80 }]);
  assert.deepEqual(alignPositions(rects, 'right'), [{ x: 184, y: 24 }, { x: 200, y: 80 }]);
  assert.deepEqual(alignPositions(rects, 'top'), [{ x: 8, y: 24 }, { x: 200, y: 24 }]);
  assert.deepEqual(alignPositions(rects, 'bottom'), [{ x: 8, y: 72 }, { x: 200, y: 80 }]);
});

test('center alignment and single node safety', () => {
  const centered = alignPositions(rects, 'centerX');
  assert.equal(centered[0].x, 96);
  assert.equal(centered[1].x, 104);
  assert.deepEqual(alignPositions([rects[0]], 'left'), []);
});

test('stack keeps left edge and adds gap', () => {
  assert.deepEqual(stackPositions(rects), [{ x: 8, y: 24 }, { x: 8, y: 96 }]);
});
