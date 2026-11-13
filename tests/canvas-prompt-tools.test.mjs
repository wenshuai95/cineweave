import test from 'node:test';
import assert from 'node:assert/strict';
import { createPromptTools } from '../src/canvas/prompt-tools.mjs';

function fakeElement(value = '') {
  const classes = new Set();
  return {
    value, textContent: '', disabled: false,
    classList: { add: (n) => classes.add(n), remove: (n) => classes.delete(n), toggle: (n, on) => (on ? classes.add(n) : classes.delete(n)) },
    dataset: {},
  };
}

function harness() {
  const nodes = new Map([
    ['#dockOptimize', fakeElement('优化')], ['#dockTranslate', fakeElement('翻译')],
    ['#optimizeModal', fakeElement()], ['#optimizeStatus', fakeElement()], ['#optimizeText', fakeElement()],
  ]);
  const langs = [
    { dataset: { lang: 'zh' }, classList: { toggle() {} } },
    { dataset: { lang: 'en' }, classList: { toggle() {} } },
  ];
  const applied = [];
  const app = {
    querySelector: (selector) => nodes.get(selector),
    querySelectorAll: () => langs,
  };
  const tools = createPromptTools({
    app,
    getPrompt: () => '雨夜追车',
    getNodeType: () => 'video',
    toast: () => {},
    requestOptimize: async (body) => ({ optimized: `优化:${body.prompt}`, optimizedEn: 'rain chase', model: 'deepseek' }),
    requestTranslate: async () => ({ translated: 'rain chase' }),
    onApply: (text, options) => applied.push([text, options]),
  });
  return { tools, nodes, applied };
}

test('optimize opens modal and stores both language versions', async () => {
  const { tools, nodes } = harness();
  assert.equal(await tools.optimize(), true);
  assert.equal(nodes.get('#optimizeStatus').textContent.includes('deepseek'), true);
  assert.equal(tools.versions.zh, '优化:雨夜追车');
  assert.equal(tools.versions.en, 'rain chase');
  assert.equal(tools.lang, 'zh');
});

test('translate and apply forward text to onApply', async () => {
  const { tools, applied, nodes } = harness();
  assert.equal(await tools.translate(), true);
  assert.deepEqual(applied[0], ['rain chase', { translated: true }]);
  nodes.get('#optimizeText').value = 'new prompt';
  assert.equal(tools.apply(), true);
  assert.deepEqual(applied[1], ['new prompt', { optimized: true }]);
});
