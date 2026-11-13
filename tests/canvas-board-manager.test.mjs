import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardManager } from '../src/canvas/board-manager.mjs';

function harness() {
  const storageMap = new Map();
  const docs = new Map([['a', { nodes: [{ id: 'a1' }] }], ['b', { nodes: [{ id: 'b1' }] }]]);
  const state = { boards: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], currentId: 'a', doc: docs.get('a') };
  const calls = [];
  const manager = createBoardManager({
    state: Object.assign(state, { currentKey: () => 'current' }),
    storage: { setItem: (k, v) => storageMap.set(k, v), getItem: (k) => storageMap.get(k) },
    app: { querySelector: () => ({ value: '', focus() {}, select() {}, classList: { add() {}, remove() {} } }) },
    readDoc: (id) => docs.get(id),
    removeDoc: (id) => docs.delete(id),
    saveState: () => calls.push('save'),
    updateButton: () => calls.push('button'),
    render: () => calls.push('render'),
    persist: () => calls.push('persist'),
    postBoards: () => calls.push('post'),
    createDocument: () => ({ nodes: [] }),
    resetView: () => calls.push('reset'),
    toast: () => {},
  });
  return { manager, state, docs, storageMap, calls };
}

test('switch board loads doc and resets view', () => {
  const h = harness();
  assert.equal(h.manager.switchBoard('b'), true);
  assert.equal(h.state.currentId, 'b');
  assert.deepEqual(h.state.doc, { nodes: [{ id: 'b1' }] });
  assert.equal(h.storageMap.get('current'), 'b');
  assert.ok(h.calls.includes('reset'));
});

test('make board appends and switches', () => {
  const h = harness();
  const id = h.manager.makeBoard('新');
  assert.equal(h.state.currentId, id);
  assert.equal(h.state.boards.length, 3);
  assert.equal(h.state.boards[2].name, '新');
});

test('duplicate copies doc and delete keeps one board', () => {
  const h = harness();
  const id = h.manager.duplicateBoard();
  assert.notEqual(h.state.doc, h.docs.get('a'));
  assert.equal(h.state.boards.length, 3);
  assert.equal(h.manager.deleteBoard(), true);
  assert.equal(h.state.boards.length, 2);
  h.state.boards = [{ id: 'x' }];
  assert.equal(h.manager.deleteBoard(), false);
});
