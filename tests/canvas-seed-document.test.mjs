import test from 'node:test';
import assert from 'node:assert/strict';
import { seedDocument } from '../src/canvas/seed-document.mjs';
import { validateCanvasDocument } from '../src/canvas/document.mjs';

test('seed document is valid and contains text/image/video nodes', () => {
  const doc = seedDocument();
  assert.deepEqual(validateCanvasDocument(doc), []);
  assert.equal(doc.nodes.length, 3);
  assert.equal(doc.edges.length, 1);
  assert.deepEqual(doc.nodes.map((node) => node.type).sort(), ['image', 'text', 'video']);
});
