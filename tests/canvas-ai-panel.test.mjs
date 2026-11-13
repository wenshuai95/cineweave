import test from 'node:test';
import assert from 'node:assert/strict';
import { createAIPanel } from '../src/canvas/ai-panel.mjs';

function fakeElement(value = '') {
  const classes = new Set();
  return {
    value, textContent: '', innerHTML: '', disabled: false, scrollTop: 0, scrollHeight: 0,
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) },
    addEventListener() {},
    focus() {},
    querySelectorAll() { return []; },
  };
}

function fakeApp() {
  const nodes = new Map([
    ['#aiPanel', fakeElement()], ['#aiContext', fakeElement()], ['#aiInput', fakeElement()],
    ['#aiMessages', fakeElement()], ['#aiSend', fakeElement()], ['#aiDockBtn', fakeElement()],
    ['#aiClose', fakeElement()],
  ]);
  return { querySelector: (selector) => nodes.get(selector) || null, nodes };
}

test('open shows panel and selected context', () => {
  const app = fakeApp();
  const panel = createAIPanel({ app, getSelectedNode: () => ({ title: '镜头 1', type: 'video' }), getContext: () => ({}), requestAssistant: async () => ({ reply: 'x' }) });
  panel.open();
  assert.equal(app.nodes.get('#aiPanel').classList.contains('open'), true);
  assert.match(app.nodes.get('#aiContext').textContent, /镜头 1/);
  assert.match(app.nodes.get('#aiMessages').innerHTML, /cv-ai-hint/);
});

test('send appends user and assistant messages through injected request', async () => {
  const app = fakeApp();
  const calls = [];
  app.nodes.get('#aiInput').value = '帮我想分镜';
  const panel = createAIPanel({
    app,
    getSelectedNode: () => null,
    getContext: () => ({ selection: null }),
    requestAssistant: async (payload) => { calls.push(payload); return { reply: '先来一个中景' }; },
  });
  await panel.send();
  assert.equal(calls.length, 1);
  assert.equal(panel.messages.length, 2);
  assert.equal(panel.messages[1].content, '先来一个中景');
  assert.match(app.nodes.get('#aiMessages').innerHTML, /先来一个中景/);
});

test('request failure becomes an assistant error message', async () => {
  const app = fakeApp();
  app.nodes.get('#aiInput').value = 'hello';
  const panel = createAIPanel({ app, requestAssistant: async () => { throw new Error('网络错误'); } });
  await panel.send();
  assert.equal(panel.messages.length, 2);
  assert.match(panel.messages[1].content, /网络错误/);
});
