import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/canvas/main.mjs', import.meta.url), 'utf8');

test('startup render happens after gesture/history/popover initialization', () => {
  const topLevelRender = source.search(/^render\(\);/m);
  const gestures = source.indexOf('const gestures =');
  const history = source.indexOf('const historyState =');
  const popover = source.indexOf('const picturePopover =');
  assert.ok(gestures > 0 && history > 0 && popover > 0);
  assert.equal(topLevelRender, -1, '顶层 render() 必须在所有依赖常量初始化之后调用，否则会 TDZ 崩溃');
});

test('event-bound handlers and required state are defined', () => {
  for (const name of ['openPromptTemplateMenu', 'applyPromptTemplate', 'historyState', 'gestures', 'picturePopover', 'timelineUI']) {
    assert.match(source, new RegExp(`(?:function |const )${name}\\b`), `${name} 缺失`);
  }
  assert.doesNotMatch(source, /^\s*updateDock\(\);/m, 'updateDock 占位已删除，不能继续调用');
});
