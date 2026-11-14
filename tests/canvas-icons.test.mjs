import test from 'node:test';
import assert from 'node:assert/strict';
import { ICONS, toolIcon, typeLabel, statusLabel } from '../src/canvas/canvas-icons.mjs';

test('node icons cover all canvas node types', () => {
  for (const type of ['text', 'image', 'video', 'audio', 'stage', 'timeline']) {
    assert.match(ICONS[type], /<svg/);
  }
});

test('node tool icons resolve known labels and fall back to empty', () => {
  assert.match(toolIcon('智能改图'), /<svg/);
  assert.match(toolIcon('版本'), /<svg/);
  assert.equal(toolIcon('不存在的工具'), '');
});

test('type and status labels are human readable', () => {
  assert.equal(typeLabel('video'), '视频');
  assert.equal(typeLabel('unknown'), 'unknown');
  assert.equal(statusLabel('running'), '生成中');
  assert.equal(statusLabel('failed'), '失败');
});
