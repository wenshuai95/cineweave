import test from 'node:test';
import assert from 'node:assert/strict';
import { createShortcuts } from '../src/canvas/shortcuts.mjs';

test('escape clears selection and edge', () => {
  const calls = [];
  const shortcuts = createShortcuts({
    getSelection: () => new Set(['a']),
    setSelection: (value) => calls.push(['selection', value.size]),
    getSelectedEdge: () => 'e1',
    setSelectedEdge: (value) => calls.push(['edge', value]),
    render: () => calls.push(['render']),
  });
  const event = { key: 'Escape', preventDefault() {}, code: 'Escape' };
  globalThis.document = { activeElement: null };
  globalThis.window = { getSelection: () => ({ toString: () => '' }) };
  shortcuts.onKeyDown(event);
  assert.deepEqual(calls, [['selection', 0], ['edge', null], ['render']]);
});

test('editing targets ignore shortcuts', () => {
  let called = false;
  const shortcuts = createShortcuts({ render: () => { called = true; } });
  globalThis.document = { activeElement: { tagName: 'INPUT' } };
  shortcuts.onKeyDown({ key: 'Escape', preventDefault() {} });
  assert.equal(called, false);
});
