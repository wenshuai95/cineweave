import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComfyVideoRequest, comfyVideoValidation, comfyVideoSpecs } from '../src/canvas/comfy-video.mjs';

const node = { id: 'v1', generation: { model: 'h3-ultimate', megapixels: 0.3 } };
const frames = { first: { resource: { url: '/first.png' } }, last: { resource: { url: '/last.png' } } };

test('h3 specs vary by size', () => {
  assert.deepEqual(comfyVideoSpecs({ generation: { h3Size: '480P', durationSeconds: 5 } }).h3, { width: 848, height: 480, fps: 24, duration: 5 });
  assert.equal(comfyVideoSpecs({ generation: {} }).h3.width, 640);
});

test('h3 ultimate request includes first/last and megapixels', () => {
  const built = buildComfyVideoRequest({
    node, prompt: 'p', model: 'h3-ultimate', frames,
    referenceAssets: [{ nodeType: 'image', type: 'image', url: '/a.png' }],
    imageRefEntries: [],
  });
  assert.equal(built.request.firstFrameUrl, '/first.png');
  assert.equal(built.request.lastFrameUrl, undefined);
  assert.equal(built.request.megapixels, 0.3);
  const explicit = buildComfyVideoRequest({ node, prompt: 'p', model: 'h3-ultimate', frames: {}, referenceAssets: [], imageRefEntries: [{ ref: { role: '尾帧' }, node: { resources: [{ url: '/tail.png' }] } }] });
  assert.equal(explicit.request.lastFrameUrl, '/tail.png');
  assert.equal(built.request.width, 640);
});

test('ref2v limits references and validation catches missing assets', () => {
  const built = buildComfyVideoRequest({
    node, prompt: 'p', model: 'h3-ref2v', frames: {}, referenceAssets: [{ nodeType: 'video', type: 'video', url: '/v.mp4', id: 'vid' }], imageRefEntries: [],
  });
  assert.equal(built.request.refVideos.length, 1);
  assert.equal(comfyVideoValidation({ node, model: 'h3-ref2v', frames: {}, refImages: [], refVideos: [], refAudios: [] }), 'H3 多模态参考：先连接参考图 / 视频 / 音频节点');
  assert.equal(comfyVideoValidation({ node, model: 'h3-ref2v', frames: {}, refImages: [{}], refVideos: [], refAudios: [] }), '');
});
