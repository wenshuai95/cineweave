import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSnap, guidesHtml } from '../src/canvas/snap-view.mjs';

const rects = [{ id: 'a', x: 100, y: 100, width: 200, height: 100 }];

test('snaps moving edge to nearby guide and returns guide line', () => {
  const result = computeSnap({ x: 102, y: 300, width: 100, height: 50, rects, exclude: new Set(['b']), zoom: 1 });
  assert.equal(result.x, 100);
  assert.equal(result.lines.length, 1);
  assert.match(guidesHtml(result.lines), /<line/);
});

test('does not snap beyond threshold and ignores excluded nodes', () => {
  const result = computeSnap({ x: 300, y: 300, width: 100, height: 50, rects, exclude: new Set(['a']) });
  assert.equal(result.x, 300);
  assert.deepEqual(result.lines, []);
});

test('zoom scales the snap threshold', () => {
  const result = computeSnap({ x: 110, y: 300, width: 100, height: 50, rects, exclude: new Set(['b']), zoom: 0.25 });
  assert.equal(result.x, 100);
});
