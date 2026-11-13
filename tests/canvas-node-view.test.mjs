import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeBodyHtml, generationOverlayHtml } from '../src/canvas/node-view.mjs';

test('node body renders media types and text', () => {
  assert.match(nodeBodyHtml({ type: 'text', text: '<剧本>' }), /cv-text-inner/);
  assert.match(nodeBodyHtml({ type: 'image', title: '图', resources: [{ type: 'image', url: '/x.png' }] }), /cv-node-image/);
  assert.match(nodeBodyHtml({ type: 'video', resources: [{ type: 'video', url: '/x.mp4' }] }), /cv-node-media/);
  assert.match(nodeBodyHtml({ type: 'audio', resources: [{ type: 'audio', url: '/x.wav' }] }), /cv-wave/);
});

test('running and failed states use placeholders', () => {
  assert.match(nodeBodyHtml({ type: 'image', status: 'running', progress: 42 }), /生成中… 42%/);
  assert.match(nodeBodyHtml({ type: 'image', status: 'failed', error: '<oom>' }), /生成失败/);
  assert.match(nodeBodyHtml({ type: 'image', status: 'failed', error: '<oom>' }), /&lt;oom&gt;/);
});

test('timeline body shows clips and fullscreen button', () => {
  const html = nodeBodyHtml({ type: 'timeline', timelineItems: [{ type: 'image', start: 0, duration: 3 }, { type: 'video', start: 3, duration: 5 }] });
  assert.match(html, /cv-mini-timeline/);
  assert.match(html, /全屏编辑/);
  assert.match(html, /cv-mini-clip/);
});

test('generation overlay only appears for running nodes with existing media', () => {
  assert.equal(generationOverlayHtml({ status: 'running' }), '');
  assert.match(generationOverlayHtml({ status: 'running', progress: 30, resources: [{}] }), /30%/);
  assert.equal(generationOverlayHtml({ status: 'success', resources: [{}] }), '');
});
