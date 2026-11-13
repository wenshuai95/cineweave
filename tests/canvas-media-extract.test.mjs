import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaExtract } from '../src/canvas/media-extract.mjs';

test('extracts frame and audio into resource nodes', async () => {
  const added = [];
  const extract = createMediaExtract({
    addResourceNode: async (_node, type, data, title) => added.push([type, title, data.filename]),
    requestFrame: async () => ({ filename: 'f.png', url: '/f.png' }),
    requestAudio: async () => ({ filename: 'a.mp3', url: '/a.mp3' }),
  });
  assert.equal(await extract.frame({ resources: [{ url: '/v.mp4' }] }), true);
  assert.equal(await extract.audio({ resources: [{ url: '/v.mp4' }] }), true);
  assert.deepEqual(added, [['image', '截取帧', 'f.png'], ['audio', '分离音频', 'a.mp3']]);
});

test('missing video does not call the API', async () => {
  const extract = createMediaExtract({ addResourceNode: async () => {}, toast: () => {} });
  assert.equal(await extract.frame({ resources: [] }), false);
});
