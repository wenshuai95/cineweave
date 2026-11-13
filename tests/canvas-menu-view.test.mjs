import test from 'node:test';
import assert from 'node:assert/strict';
import { contextMenuHtml, actionableMenuEntries } from '../src/canvas/menu-view.mjs';

test('menu html renders separators, headings, buttons and disabled state', () => {
  const html = contextMenuHtml([
    ['新建', () => {}, true],
    ['复制', () => {}],
    ['sep'],
    ['下载', () => {}, false, true],
  ]);
  assert.match(html, /cv-menu-label">新建/);
  assert.match(html, /<button data-action="复制">复制<\/button>/);
  assert.match(html, /cv-menu-sep/);
  assert.match(html, /data-action="下载" disabled/);
});

test('actionable entries exclude headings but keep disabled items aligned', () => {
  const entries = actionableMenuEntries([
    ['标题', null, true],
    ['复制', () => {}],
    ['下载', () => {}, false, true],
  ]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0][0], '复制');
  assert.equal(entries[1][0], '下载');
});
