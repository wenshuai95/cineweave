import test from 'node:test';
import assert from 'node:assert/strict';
import { versionItems, versionsGridHtml } from '../src/canvas/versions-view.mjs';

test('version items put current resource first', () => {
  const items = versionItems({ resources: [{ id: 'cur', type: 'image', url: '/cur.png' }], versions: [{ id: 'old', type: 'image', url: '/old.png', createdAt: 1 }] });
  assert.equal(items.length, 2);
  assert.equal(items[0].current, true);
  assert.equal(items[1].id, 'old');
});

test('grid marks current and renders media types', () => {
  const html = versionsGridHtml([
    { current: true, type: 'image', url: '/cur.png' },
    { type: 'video', url: '/v.mp4', createdAt: 1 },
    { type: 'audio', url: '/a.mp3', createdAt: 2 },
  ]);
  assert.match(html, /cv-version current/);
  assert.match(html, /<video/);
  assert.match(html, /cv-version-audio/);
  assert.match(versionsGridHtml([]), /还没有生成结果/);
});
