import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCanvasDocument, createNode, addNode, removeNode, updateNode, moveNode,
  connect, disconnect, upstreamOf, downstreamOf, allowedInputTypes, addReference, removeReference, referenceLabel,
  validateCanvasDocument, serializeCanvas, parseCanvas, MAX_NODES, addGroup, removeGroup, groupOf,
} from '../src/canvas/document.mjs';

function imageDoc() {
  let doc = createCanvasDocument();
  doc = addNode(doc, { id: 'img1', type: 'image', title: '图', generation: { mode: 't2i', prompt: 'a' } });
  doc = addNode(doc, { id: 'vid1', type: 'video', title: '视频', generation: { mode: 'i2v', prompt: 'b' } });
  return doc;
}

test('createNode fills defaults and validates type', () => {
  const node = createNode({ type: 'image', title: 'x' });
  assert.equal(node.layout.width, 569);
  assert.equal(node.layout.height, 320);
  assert.equal(node.status, 'empty');
  assert.throws(() => createNode({ type: 'banana' }), /unknown node type/);
});

test('audio nodes default to a square card', () => {
  const node = createNode({ type: 'audio' });
  assert.equal(node.layout.width, 320);
  assert.equal(node.layout.height, 320);
});

test('addNode rejects duplicate ids and enforces the node cap', () => {
  let doc = createCanvasDocument();
  doc = addNode(doc, { id: 'a', type: 'text', text: 'hi' });
  assert.throws(() => addNode(doc, { id: 'a', type: 'text' }), /already exists/);
  let full = createCanvasDocument();
  for (let i = 0; i < MAX_NODES; i += 1) full = addNode(full, { type: 'text', id: `n${i}` });
  assert.throws(() => addNode(full, { type: 'text', id: 'overflow' }), /node limit/);
});

test('removeNode also removes its edges', () => {
  let doc = imageDoc();
  doc = connect(doc, 'img1', 'vid1').doc;
  assert.equal(doc.edges.length, 1);
  doc = removeNode(doc, 'img1');
  assert.equal(doc.nodes.length, 1);
  assert.equal(doc.edges.length, 0);
});

test('updateNode merges generation and layout', () => {
  let doc = imageDoc();
  doc = updateNode(doc, 'img1', { generation: { prompt: 'new prompt' }, layout: { x: 10 } });
  const node = doc.nodes.find((item) => item.id === 'img1');
  assert.equal(node.generation.prompt, 'new prompt');
  assert.equal(node.generation.mode, 't2i');
  assert.equal(node.layout.x, 10);
  assert.equal(node.layout.width, 569);
});

test('moveNode keeps width and height', () => {
  let doc = imageDoc();
  doc = moveNode(doc, 'img1', 50, 60);
  const node = doc.nodes.find((item) => item.id === 'img1');
  assert.deepEqual({ x: node.layout.x, y: node.layout.y, w: node.layout.width, h: node.layout.height }, { x: 50, y: 60, w: 569, h: 320 });
});

test('allowedInputTypes reflects the generation mode', () => {
  assert.deepEqual(allowedInputTypes('t2i'), []);
  assert.deepEqual(allowedInputTypes('i2v'), ['image']);
  assert.deepEqual(allowedInputTypes('m2v'), ['image', 'video', 'audio']);
  assert.deepEqual(allowedInputTypes('unknown'), []);
});

test('connect accepts an image into i2v and records the edge', () => {
  const { doc, edge } = connect(imageDoc(), 'img1', 'vid1');
  assert.equal(doc.edges.length, 1);
  assert.equal(edge.from, 'img1');
  assert.equal(edge.to, 'vid1');
  assert.equal(edge.slot, 'image');
  assert.deepEqual(upstreamOf(doc, 'vid1'), ['img1']);
  assert.deepEqual(downstreamOf(doc, 'img1'), ['vid1']);
});

test('connect rejects type mismatch, self edges, duplicates and cycles', () => {
  let doc = imageDoc();
  doc = addNode(doc, { id: 'txt1', type: 'text', text: 'hi' });
  assert.throws(() => connect(doc, 'txt1', 'img1'), /not an input/);
  assert.throws(() => connect(doc, 'img1', 'img1'), /cannot connect to itself/);
  const connected = connect(doc, 'img1', 'vid1').doc;
  assert.throws(() => connect(connected, 'img1', 'vid1'), /already exists/);
  // vid1 -> img1 would need image input on t2i: mode rejects first; use i2i to test cycle
  let cycleDoc = createCanvasDocument();
  cycleDoc = addNode(cycleDoc, { id: 'a', type: 'image', generation: { mode: 'i2i', prompt: 'x' } });
  cycleDoc = addNode(cycleDoc, { id: 'b', type: 'image', generation: { mode: 'i2i', prompt: 'y' } });
  cycleDoc = connect(cycleDoc, 'a', 'b').doc;
  assert.throws(() => connect(cycleDoc, 'b', 'a'), /cycle/);
});

test('disconnect removes only the requested edge', () => {
  let doc = imageDoc();
  doc = addNode(doc, { id: 'vid2', type: 'video', generation: { mode: 'i2v', prompt: 'c' } });
  doc = connect(doc, 'img1', 'vid1').doc;
  doc = connect(doc, 'img1', 'vid2').doc;
  assert.equal(doc.edges.length, 2);
  doc = disconnect(doc, doc.edges[0].id);
  assert.equal(doc.edges.length, 1);
  assert.equal(doc.edges[0].to, 'vid2');
});

test('validateCanvasDocument reports broken documents', () => {
  const doc = createCanvasDocument();
  assert.deepEqual(validateCanvasDocument(doc), []);
  const bad = { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [{ id: 'has space', type: 'image', layout: { x: 0, y: 0, width: 1, height: 1 } }], edges: [] };
  const errors = validateCanvasDocument(bad);
  assert.ok(errors.some((message) => message.includes('bad node id')));
});

test('serialize and parse round-trip', () => {
  let doc = imageDoc();
  doc = connect(doc, 'img1', 'vid1').doc;
  const round = parseCanvas(serializeCanvas(doc));
  assert.equal(round.nodes.length, 2);
  assert.equal(round.edges.length, 1);
  assert.equal(round.viewport.zoom, 1);
});

test('parseCanvas rejects invalid documents', () => {
  assert.throws(() => parseCanvas({ version: 99, nodes: [], edges: [] }), /unsupported version/);
});


test('references can be added, deduplicated and removed', () => {
  let doc = imageDoc();
  doc = addReference(doc, 'vid1', { id: 'img1', type: 'image' });
  const node = doc.nodes.find((item) => item.id === 'vid1');
  assert.equal(node.generation.references.length, 1);
  assert.equal(node.generation.references[0].index, 0);
  assert.equal(referenceLabel(0, 'image'), '<Picture 1>');
  doc = addReference(doc, 'vid1', { id: 'img1', type: 'image' });
  assert.equal(doc.nodes.find((item) => item.id === 'vid1').generation.references.length, 1);
  doc = removeReference(doc, 'vid1', 'img1');
  assert.equal(doc.nodes.find((item) => item.id === 'vid1').generation.references.length, 0);
});

test('groups: add, groupOf, remove and validation', () => {
  let doc = createCanvasDocument();
  doc = addNode(doc, { type: 'text', title: 'A', layout: { x: 0, y: 0, width: 100, height: 100 } });
  doc = addNode(doc, { type: 'image', title: 'B', layout: { x: 200, y: 0, width: 100, height: 100 } });
  const [a, b] = doc.nodes;
  doc = addGroup(doc, [a.id, b.id], '一组');
  assert.equal(doc.groups.length, 1);
  assert.equal(doc.groups[0].nodeIds.length, 2);
  assert.equal(groupOf(doc, a.id)?.id, doc.groups[0].id);
  assert.deepEqual(validateCanvasDocument(doc), []);
  const groupId = doc.groups[0].id;
  doc = removeGroup(doc, groupId);
  assert.equal(doc.groups.length, 0);
  assert.equal(groupOf(doc, a.id), null);
});

test('groups: validation rejects missing nodes', () => {
  let doc = createCanvasDocument();
  doc = addNode(doc, { type: 'text', title: 'A', layout: { x: 0, y: 0, width: 100, height: 100 } });
  doc.groups = [{ id: 'group_x', name: 'bad', nodeIds: ['missing'] }];
  assert.ok(validateCanvasDocument(doc).some((message) => message.includes('group references missing node')));
});
