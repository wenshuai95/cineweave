import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProject, object} from '../src/model.mjs';
import {
  isStoreModelSrc, isEmbeddedModelSrc, storeHashOf,
  migrateProjectModels, embedProjectModels, uploadEmbeddedModel,
} from '../src/model-assets.mjs';

const HASH = 'a'.repeat(64);
const storeUrl = `/api/model-assets/${HASH}.glb`;
const dataUri = 'data:model/gltf-binary;base64,' + Buffer.from('tiny-glb').toString('base64');

function projectWith(models) {
  const camera = object('camera', '主机位', [0, 2, 6]);
  const p = {
    schema: 'jingchang/1', name: 'model-assets-test', duration: 4, fps: 24,
    groundColor: '#41494c', objects: [camera], nodes: [], edges: [],
    board: {x: 0, y: 0, zoom: 0.8},
    shots: [{id: 'cut-1', cameraId: camera.id, start: 0, end: 4}],
  };
  p.nodes = models.map((m, i) => ({
    id: 'model-node-' + i, type: 'model', title: 'm' + i, text: '',
    x: 0, y: 0, w: 280, modelSrc: m.src, modelSize: 2, modelKind: 'scene',
  }));
  p.objects = [camera, ...models.map((m, i) => ({
    id: 'model-obj-' + i, type: 'model', name: 'm' + i, position: [0, 0, 0], target: [0, 1, 0],
    rotation: 0, scale: 1, color: '#b8b8b8', pose: 'stand', fov: 45, keys: [],
    modelSrc: m.src, modelSize: 2, modelKind: 'scene',
  }))];
  return p;
}

test('project validation accepts asset-store references for objects and model nodes', () => {
  assert.doesNotThrow(() => validateProject(projectWith([{src: storeUrl}])));
  assert.doesNotThrow(() => validateProject(projectWith([{src: 'data:model/gltf-binary;base64,AAAA'}])));
  assert.throws(() => validateProject(projectWith([{src: `/api/model-assets/${HASH}.bin`}])), /模型/);
  assert.throws(() => validateProject(projectWith([{src: '/api/model-assets/../secret.glb'}])), /模型/);
});

test('model source helpers recognise stored, embedded and foreign sources', () => {
  assert.equal(isStoreModelSrc(storeUrl), true);
  assert.equal(isStoreModelSrc('/assets/models/x.glb'), false);
  assert.equal(isEmbeddedModelSrc(dataUri), true);
  assert.equal(isStoreModelSrc(dataUri), false);
  assert.equal(storeHashOf(storeUrl), HASH);
  assert.equal(storeHashOf('/assets/models/x.glb'), null);
});

test('migration uploads embedded models once and rewrites every reference', async () => {
  const uploads = [];
  const fetchImpl = async (path, options) => {
    uploads.push({path, body: Buffer.from(options.body).toString()});
    return {
      ok: true,
      json: async () => ({hash: HASH, url: storeUrl, size: options.body.length, deduped: uploads.length > 1}),
    };
  };
  // 同一份内嵌数据同时挂在对象和节点上：只应上传一次
  const p = projectWith([{src: dataUri}, {src: dataUri}]);
  const result = await migrateProjectModels(p, {fetchImpl});
  assert.equal(result.migrated, 4);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].path, '/api/assets');
  assert.equal(p.objects.find(o => o.type === 'model').modelSrc, storeUrl);
  assert.equal(p.nodes[1].modelSrc, storeUrl);
  assert.equal(p.objects.find(o => o.type === 'model').modelHash, HASH);
  assert.doesNotThrow(() => validateProject(p));
});

test('migration keeps embedded data when the store is unreachable', async () => {
  const failures = [];
  const fetchImpl = async () => ({ok: false, json: async () => ({error: 'store down'})});
  const p = projectWith([{src: dataUri}]);
  const result = await migrateProjectModels(p, {fetchImpl, onFail: (error, host) => failures.push(host.id)});
  assert.equal(result.migrated, 0);
  assert.equal(result.failed, 2);
  assert.equal(p.objects.find(o => o.type === 'model').modelSrc, dataUri);
  assert.deepEqual(failures.sort(), ['model-node-0', 'model-obj-0']);
  assert.doesNotThrow(() => validateProject(p));
});

test('embedding restores portable data URIs for export', async () => {
  const bytes = Buffer.from('portable-glb');
  const fetchImpl = async url => ({ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)});
  const p = projectWith([{src: storeUrl}]);
  const result = await embedProjectModels(p, {fetchImpl});
  assert.equal(result.embedded, 2);
  const expected = 'data:model/gltf-binary;base64,' + bytes.toString('base64');
  assert.equal(p.objects.find(o => o.type === 'model').modelSrc, expected);
  assert.equal(p.nodes[0].modelSrc, expected);
  assert.doesNotThrow(() => validateProject(p));
});

test('upload helper reports server errors instead of silently succeeding', async () => {
  const fetchImpl = async () => ({ok: false, json: async () => ({error: '超过上限'})});
  await assert.rejects(uploadEmbeddedModel(dataUri, {fetchImpl}), /超过上限/);
});
