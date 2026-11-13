import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineAssetsHtml, timelineRulerHtml, timelineLanesHtml } from '../src/canvas/timeline-view.mjs';

test('asset html escapes labels and marks audio/image', () => {
  const html = timelineAssetsHtml([
    { id: 'a', type: 'image', title: '<图>', resources: [{ url: '/x.png' }] },
    { id: 'b', type: 'audio', title: '声', resources: [{ url: '/x.wav' }] },
  ]);
  assert.match(html, /data-asset="a"/);
  assert.match(html, /&lt;图&gt;/);
  assert.match(html, /图片/);
  assert.match(html, /音频/);
  assert.match(html, /♫/);
});

test('empty assets show the drop hint', () => {
  assert.match(timelineAssetsHtml([]), /将文件拖至此处添加/);
});

test('ruler picks a step from total duration', () => {
  const short = timelineRulerHtml(10);
  assert.match(short, /00:00\.0/);
  assert.match(short, /00:01\.0/);
  const long = timelineRulerHtml(40);
  assert.match(long, /00:40\.0/);
});

test('lanes put images on the video track and mark selection', () => {
  const html = timelineLanesHtml([
    { id: 'v', type: 'video', label: '视频', start: 0, duration: 5 },
    { id: 'i', type: 'image', label: '图片', start: 5, duration: 3 },
    { id: 'a', type: 'audio', label: '声音', start: 0, duration: 8 },
  ], 8.5, 'i');
  assert.match(html, /cv-tl-clip video selected/);
  assert.match(html, /图<\/em>/);
  assert.match(html, /cv-tl-clip audio/);
  assert.match(html, /data-item="a"/);
});
