import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('canvas nodes render a floating type tag instead of a title bar, badge or status row', () => {
  assert.match(source,/nodeCanvasTag\(n\)/);
  assert.match(source,/class="node-tag"/);
  assert.doesNotMatch(source,/class="node-head"/);
  assert.doesNotMatch(source,/class="node-meta"/);
  assert.doesNotMatch(source,/class="node-type"/);
});

test('empty and failed nodes keep the Jimeng-style information hierarchy', () => {
  assert.match(source,/node-empty-icon/);
  assert.match(source,/data-node-retry/);
  assert.match(source,/node-gen-progress \$\{failed\?'failed':''\}/);
  // Only failures keep a text block; running work is a slim progress line.
  assert.match(source,/failed\?'<button type="button" class="node-retry" data-node-retry>重新生成<\/button>':''/);
});

test('canvas exposes the left creation rail, empty hint, HUD and local assistant entry', () => {
  assert.match(source,/id="canvasCreateRail"/);
  assert.match(source,/data-create-node="text"/);
  assert.match(source,/data-create-node="image"/);
  assert.match(source,/data-create-node="video"/);
  assert.match(source,/data-create-node="audio"/);
  assert.match(source,/data-create-tool="shot"/);
  assert.match(source,/data-create-node="director"/);
  assert.match(source,/data-create-tool="upload"/);
  assert.match(source,/id="canvasEmptyHint"/);
  assert.match(source,/双击画布/);
  assert.match(source,/id="canvasHudName"/);
  assert.match(source,/id="canvasSearchBtn"/);
  assert.match(source,/id="canvasAiEntry"/);
  assert.match(source,/与 AI 对话/);
  // Double-click on empty canvas opens the create menu; the assistant is local-only.
  assert.match(source,/addEventListener\('dblclick'/);
  assert.match(source,/AI 助手 · 本地工作流/);
});
