import test from 'node:test';
import assert from 'node:assert/strict';
import {demoProject} from '../src/model.mjs';
import {buildGraph, canConnect, addEdge, removeEdge, inputsFor, sanitizeSavedGraph, NODE_SIZE} from '../src/pipeline/generation-graph.mjs';

function project() {
  const p = demoProject();
  p.shots = p.shots.slice(0, 2);
  p.duration = 20;
  return p;
}

const assets = [
  {id: 'a1', kind: 'character', name: '女修', imageVersions: [{id: 'v1', mediaId: 'm1'}], selectedImageId: 'v1', shotIds: []},
  {id: 'a2', kind: 'character', name: '男修', shotIds: []},
  {id: 'a3', kind: 'scene', name: '庭院', imageVersions: [{id: 'v2', mediaId: 'm2'}], selectedImageId: 'v2', shotIds: []},
];

test('graph derives shot, asset, generate and previz nodes with default edges', () => {
  const graph = buildGraph(project(), {assets});
  const kinds = graph.nodes.map(node => node.kind);
  assert.ok(kinds.includes('shot'));
  assert.ok(kinds.includes('generate'));
  assert.ok(kinds.includes('asset'));
  assert.ok(kinds.includes('previz'));
  assert.equal(graph.nodes.filter(node => node.kind === 'asset').length, 3, '没有图片的资产以占位节点出现');
  assert.ok(graph.edges.some(edge => edge.kind === 'video'));
  const gen = graph.nodes.find(node => node.kind === 'generate');
  assert.equal(gen.w, NODE_SIZE.generate[0]);
});

test('connections are typed, deduped and only allowed into generate nodes', () => {
  const graph = buildGraph(project(), {assets});
  const asset = graph.nodes.find(node => node.kind === 'asset');
  const gen = graph.nodes.find(node => node.kind === 'generate');
  const shot = graph.nodes.find(node => node.kind === 'shot');
  assert.equal(canConnect(asset, gen, graph.edges).kind, 'image');
  const withoutShot = graph.edges.filter(edge => !(edge.from === shot.id && edge.to === gen.id));
  assert.equal(canConnect(shot, gen, withoutShot).kind, 'video');
  assert.match(canConnect(gen, asset, graph.edges).reason, /只能连到生成节点/);
  const base = graph.edges.filter(edge => !(edge.from === asset.id && edge.to === gen.id));
  const added = addEdge(base, asset, gen);
  assert.equal(added.error, undefined);
  assert.ok(added.edges.some(edge => edge.from === asset.id && edge.to === gen.id));
  assert.ok(addEdge(added.edges, asset, gen).error, '重复连线要被拒绝');
});

test('saved layout overrides positions and sanitizes bad values', () => {
  const saved = sanitizeSavedGraph({nodes: {'gen:x': {x: 10, y: 20}, bad: {x: 'no'}}, edges: [{from: 'a', to: 'b', kind: 'image'}, {from: 'a', to: 'b', kind: 'image'}]});
  assert.deepEqual(saved.nodes, {'gen:x': {x: 10, y: 20}});
  assert.equal(saved.edges.length, 1);
  const p = project();
  p.shots[0].id = 'x';
  const graph = buildGraph(p, {assets}, saved);
  const gen = graph.nodes.find(node => node.id === 'gen:x');
  assert.equal(gen.x, 10);
  assert.equal(gen.y, 20);
});

test('inputsFor returns connected source nodes', () => {
  const graph = buildGraph(project(), {assets});
  const gen = graph.nodes.find(node => node.kind === 'generate');
  const inputs = inputsFor(gen, graph.nodes, graph.edges);
  assert.ok(inputs.some(node => node.kind === 'shot'));
});
