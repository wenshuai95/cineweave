import test from 'node:test';
import assert from 'node:assert/strict';
import { ratioButtonsHtml, countButtonsHtml, PICTURE_RATIOS } from '../src/canvas/picture-popover.mjs';

test('ratio buttons mark current ratio and render shapes', () => {
  const html = ratioButtonsHtml('16:9');
  for (const ratio of PICTURE_RATIOS) assert.match(html, new RegExp(`data-ratio="${ratio}"`));
  assert.match(html, /cv-pic-ratio active[^>]*><span class="cv-ratio-shape"/);
  assert.match(html, /height:17px/);
});

test('count buttons respect min/max and active selection', () => {
  const html = countButtonsHtml(4, 1, 4);
  assert.match(html, /data-count="1"/);
  assert.match(html, /data-count="4"/);
  assert.match(html, /cv-pic-count active/);
  assert.doesNotMatch(countButtonsHtml(1, 1, 1), /data-count="2"/);
});
