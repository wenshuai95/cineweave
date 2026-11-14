import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeToolActions, nodeToolsHtml, multiToolLabels, multiToolsHtml } from '../src/canvas/node-tools.mjs';

test('node tool actions differ by node type', () => {
  assert.ok(nodeToolActions('image').includes('智能改图'));
  assert.ok(nodeToolActions('video').includes('分离音频'));
  assert.ok(nodeToolActions('timeline').includes('打开时间线'));
  assert.deepEqual(nodeToolActions('unknown'), ['下载']);
});

test('node tools html includes labels and data attributes', () => {
  const html = nodeToolsHtml({ type: 'text' });
  assert.match(html, /data-tool="复制"/);
  assert.match(html, /data-tool="删除"/);
});

test('multi tool labels switch group action', () => {
  assert.deepEqual(multiToolLabels(true), ['解组', '堆叠', '布局', '下载']);
  assert.deepEqual(multiToolLabels(false), ['编组', '堆叠', '布局', '下载']);
  assert.match(multiToolsHtml(multiToolLabels(false)), /data-tool="编组"/);
});
