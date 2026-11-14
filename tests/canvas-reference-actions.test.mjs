import test from 'node:test';
import assert from 'node:assert/strict';
import { reorderReferences, applyReferenceRole, findReferenceEdge, mentionMode } from '../src/canvas/reference-actions.mjs';

test('reorders references and reindexes', () => {
  const refs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const moved = reorderReferences(refs, 'c', -1);
  assert.deepEqual(moved.map((ref) => ref.id), ['a', 'c', 'b']);
  assert.equal(moved[1].index, 1);
  assert.equal(reorderReferences(refs, 'a', -1), null);
});

test('role, edge lookup and mention mode', () => {
  assert.equal(applyReferenceRole([{ id: 'a', role: '通用' }], 'a', '人物')[0].role, '人物');
  assert.equal(findReferenceEdge([{ id: 'e', from: 'a', to: 'b' }], 'a', 'b')?.id, 'e');
  assert.equal(mentionMode({ currentType: 'image', currentMode: 't2i', sourceType: 'image' }), 'i2i');
  assert.equal(mentionMode({ currentType: 'video', currentMode: 't2v', sourceType: 'audio' }), 'm2v');
});
