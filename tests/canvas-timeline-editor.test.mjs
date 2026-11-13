import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimelineDragController } from '../src/canvas/timeline-editor.mjs';

test('move drag updates item through controller', () => {
  const item = { id: 'a', start: 2, duration: 4, sourceStart: 0 };
  let changes = 0;
  const controller = createTimelineDragController({ getItem: () => item, onChange: () => { changes += 1; } });
  assert.equal(controller.start({ id: 'a', mode: 'move', startX: 100, origin: item, pxPerSecond: 50 }), true);
  controller.move(200);
  assert.equal(item.start, 4);
  assert.equal(changes, 1);
  assert.equal(controller.end(), true);
  assert.equal(controller.active, false);
});

test('trim start updates sourceStart and duration', () => {
  const item = { id: 'a', start: 2, duration: 4, sourceStart: 1 };
  const controller = createTimelineDragController({ getItem: () => item });
  controller.start({ id: 'a', mode: 'trim-start', startX: 0, origin: item, pxPerSecond: 10 });
  controller.move(10);
  assert.equal(item.start, 3);
  assert.equal(item.duration, 3);
  assert.equal(item.sourceStart, 2);
});

test('invalid start and missing item are safe', () => {
  const controller = createTimelineDragController({ getItem: () => null });
  assert.equal(controller.start({ id: 'a', mode: 'move', startX: 0, origin: { start: 0, duration: 1 }, pxPerSecond: 0 }), false);
  assert.equal(controller.move(10), null);
});
