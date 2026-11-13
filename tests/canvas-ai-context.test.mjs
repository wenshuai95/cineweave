import test from 'node:test';
import assert from 'node:assert/strict';
import { aiContextLabel, buildAIContext, renderAIMessagesHtml } from '../src/canvas/ai-context.mjs';

test('ai context label reflects selected node', () => {
  assert.equal(aiContextLabel(null), 'DeepSeek · 未选中节点');
  assert.equal(aiContextLabel({ title: '镜头 1', type: 'video' }), 'DeepSeek · 上下文：镜头 1');
});

test('ai context includes canvas and selected node', () => {
  const node = { id: 'n1', type: 'video', title: '镜头', status: 'success', generation: { prompt: '雨夜', model: 'h3', references: [{ id: 'r1', type: 'image', role: '首帧' }] } };
  const context = buildAIContext({ doc: { nodes: [node, { id: 'r1', title: '参考图' }] }, node, boardList: [{}, {}], boardProjectId: 'p1' });
  assert.equal(context.canvas.nodes, 2);
  assert.equal(context.canvas.boards, 2);
  assert.equal(context.selection.model, 'h3');
  assert.equal(context.selection.references[0].title, '参考图');
});

test('ai messages html escapes and offers assistant actions', () => {
  const html = renderAIMessagesHtml([
    { role: 'user', content: '<script>' },
    { role: 'assistant', content: '第一行\n第二行' },
  ]);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /data-ai-insert="1"/);
  assert.match(html, /第一行<br>第二行/);
  assert.match(renderAIMessagesHtml([]), /cv-ai-hint/);
});
