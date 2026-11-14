import test from 'node:test';
import assert from 'node:assert/strict';
import { assetsGridHtml, assetNodePayload } from '../src/canvas/assets-view.mjs';

test('assets grid renders media types and escapes titles', () => {
  const html = assetsGridHtml([
    { type: 'image', url: '/x.png', nodeTitle: '<图>' },
    { type: 'video', url: '/x.mp4', nodeTitle: '视频' },
    { type: 'audio', url: '/x.wav', nodeTitle: '声' },
  ]);
  assert.match(html, /<img/);
  assert.match(html, /<video/);
  assert.match(html, /cv-version-audio/);
  assert.match(html, /&lt;图&gt;/);
  assert.match(assetsGridHtml([]), /还没有生成资产/);
});

test('asset payload centers node and chooses generation defaults', () => {
  const image = assetNodePayload({ type: 'image', url: '/x.png', nodeTitle: '图' }, { x: 500, y: 300 });
  assert.equal(image.type, 'image');
  assert.equal(image.layout.x, 216);
  assert.equal(image.layout.y, 140);
  assert.equal(image.generation.mode, 'i2i');
  const audio = assetNodePayload({ type: 'audio', url: '/x.wav' }, { x: 500, y: 300 });
  assert.equal(audio.layout.width, 320);
  assert.equal(audio.generation.mode, 'tts');
  const video = assetNodePayload({ type: 'video', url: '/x.mp4' }, { x: 500, y: 300 });
  assert.equal(video.generation.durationSeconds, 5);
});
