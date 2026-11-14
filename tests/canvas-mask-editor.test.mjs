import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedMaskRect } from '../src/canvas/mask-editor.mjs';

test('mask rect normalizes drag direction and canvas size', () => {
  assert.deepEqual(normalizedMaskRect({ x: 100, y: 80 }, { x: 50, y: 20 }, 200, 100), { x: 0.25, y: 0.2, w: 0.25, h: 0.6 });
  assert.deepEqual(normalizedMaskRect({ x: 10, y: 10 }, { x: 60, y: 60 }, 100, 100), { x: 0.1, y: 0.1, w: 0.5, h: 0.5 });
});
