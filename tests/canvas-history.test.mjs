import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../src/canvas/history.mjs';

function harness(initial = { nodes: [] }) {
  let doc = initial;
  let restores = 0;
  const history = createHistory({
    limit: 2,
    getDoc: () => doc,
    setDoc: (next) => { doc = next; },
    onRestore: () => { restores += 1; },
  });
  return { history, get doc() { return doc; }, set doc(value) { doc = value; }, get restores() { return restores; } };
}

test('push snapshots current doc and allows undo', () => {
  const h = harness();
  h.doc = { nodes: [1] };
  h.history.push();
  h.doc = { nodes: [2] };
  assert.equal(h.history.canUndo, true);
  assert.equal(h.history.undo(), true);
  assert.deepEqual(h.doc, { nodes: [1] });
  assert.equal(h.restores, 1);
});

test('redo restores undone doc and clears on new push', () => {
  const h = harness();
  h.doc = { nodes: [1] };
  h.history.push();
  h.doc = { nodes: [2] };
  h.history.undo();
  assert.equal(h.history.redo(), true);
  assert.deepEqual(h.doc, { nodes: [2] });
  h.history.push();
  assert.equal(h.history.canRedo, false);
});

test('limit drops oldest snapshots and empty undo is safe', () => {
  const h = harness();
  h.doc = { nodes: [0] };
  for (let i = 1; i <= 3; i += 1) { h.history.push(); h.doc = { nodes: [i] }; }
  assert.equal(h.history.undoCount, 2);
  assert.equal(h.history.undo(), true);
  assert.deepEqual(h.doc, { nodes: [2] });
  assert.equal(h.history.redo(), true);
  assert.deepEqual(h.doc, { nodes: [3] });
  const empty = createHistory({ getDoc: () => ({}) });
  assert.equal(empty.undo(), false);
  assert.equal(empty.redo(), false);
});
