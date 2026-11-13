import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTimelineItems, scanTimelineItems, timelineTotalDuration, formatTimelineTime, splitTimelineItem, dragTimelineItem } from '../src/canvas/timeline-model.mjs';

test('timeline items normalize defaults', () => {
  const items = normalizeTimelineItems([{ id: 'a', type: 'image' }, { id: 'b', type: 'video', duration: 2, start: 3 }]);
  assert.equal(items[0].duration, 3);
  assert.equal(items[0].label, 'image');
  assert.equal(items[1].duration, 2);
  assert.equal(items[1].start, 3);
  assert.equal(items[1].transition, 'none');
});

test('scan timeline includes images with three second clips', () => {
  const items = scanTimelineItems([
    { id: 'v', type: 'video', generation: { durationSeconds: 5 } },
    { id: 'i', type: 'image' },
    { id: 'x', type: 'text' },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].start, 0);
  assert.equal(items[0].duration, 5);
  assert.equal(items[1].start, 5);
  assert.equal(items[1].duration, 3);
});

test('timeline duration adds a small tail and formats time', () => {
  assert.equal(timelineTotalDuration([{ start: 0, duration: 2 }, { start: 2, duration: 3 }]), 5.5);
  assert.equal(formatTimelineTime(0), '00:00.0');
  assert.equal(formatTimelineTime(65.25), '01:05.3');
});

test('splitting a clip keeps source offsets', () => {
  const parts = splitTimelineItem({ id: 'a', start: 2, duration: 4, sourceStart: 1 });
  assert.equal(parts.length, 2);
  assert.equal(parts[0].duration, 2);
  assert.equal(parts[1].start, 4);
  assert.equal(parts[1].sourceStart, 3);
});

test('dragging moves and trims within bounds', () => {
  const origin = { start: 2, duration: 4, sourceStart: 1 };
  assert.equal(dragTimelineItem(origin, origin, 'move', -5).start, 0);
  const trimmed = dragTimelineItem(origin, origin, 'trim-start', 1);
  assert.equal(trimmed.start, 3);
  assert.equal(trimmed.duration, 3);
  assert.equal(trimmed.sourceStart, 2);
  assert.equal(dragTimelineItem(origin, origin, 'trim-end', -10).duration, 0.2);
});
