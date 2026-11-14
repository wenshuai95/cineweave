import test from 'node:test';
import assert from 'node:assert/strict';
import { applyNodeSelection, marqueeWorldBox, selectionAfterMarquee } from '../src/canvas/selection-model.mjs';

test('node selection handles shift toggle and group expansion', () => {
  const base = new Set(['a']);
  assert.deepEqual([...applyNodeSelection(base, 'a', { shift: true })], []);
  assert.deepEqual([...applyNodeSelection(base, 'b', { shift: true })], ['a', 'b']);
  assert.deepEqual([...applyNodeSelection(base, 'b', {})], ['b']);
  assert.deepEqual([...applyNodeSelection(base, 'b', { groupIds: ['g1', 'g2'] })], ['g1', 'g2']);
});

test('marquee box converts screen space to world space', () => {
  const box = marqueeWorldBox({ startX: 100, startY: 100, currentX: 300, currentY: 200, stageLeft: 50, stageTop: 50, viewport: { x: 10, y: 20, zoom: 2 } });
  assert.deepEqual(box, { x: 20, y: 15, width: 100, height: 50 });
});

test('marquee selection is additive when shift held', () => {
  assert.deepEqual([...selectionAfterMarquee(new Set(['a']), ['b'], true)], ['a', 'b']);
  assert.deepEqual([...selectionAfterMarquee(new Set(['a']), ['b'], false)], ['b']);
});
