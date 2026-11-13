import test from 'node:test';
import assert from 'node:assert/strict';
import { createClipboardActions } from '../src/canvas/clipboard-actions.mjs';

function harness(node = { id: 'n1', type: 'image', layout: { x: 10, y: 20 }, resources: [] }) {
  let clipboard = null;
  let doc = { nodes: [] };
  let selected = node;
  const calls = { history: 0, rendered: 0 };
  const actions = createClipboardActions({
    getSelectedNode: () => selected,
    getClipboard: () => clipboard,
    setClipboard: (value) => { clipboard = value; },
    pushHistory: () => { calls.history += 1; },
    addNodeToDoc: (copy) => { doc = { nodes: [...doc.nodes, { ...copy, id: `copy${doc.nodes.length + 1}` }] }; return doc; },
    render: () => { calls.rendered += 1; },
    onPasted: (pasted) => { selected = pasted; },
  });
  return { actions, calls, get clipboard() { return clipboard; }, get selected() { return selected; }, get doc() { return doc; } };
}

test('copy deep clones selected node', () => {
  const h = harness();
  const copied = h.actions.copy();
  assert.equal(copied.id, 'n1');
  assert.notEqual(copied, h.selected);
  assert.equal(h.clipboard.layout.x, 10);
});

test('paste offsets layout, clears id and selects new node', () => {
  const h = harness();
  h.actions.copy();
  const pasted = h.actions.paste();
  assert.equal(pasted.layout.x, 50);
  assert.equal(pasted.layout.y, 60);
  assert.notEqual(pasted.id, 'n1');
  assert.equal(h.selected.id, pasted.id);
  assert.equal(h.calls.history, 1);
  assert.equal(h.calls.rendered, 1);
});

test('empty clipboard and no selection are handled', () => {
  const h = harness(null);
  assert.equal(h.actions.paste(), null);
  assert.equal(h.actions.copy(), null);
});
