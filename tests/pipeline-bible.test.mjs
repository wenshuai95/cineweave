import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBible, readBible, writeBible, bibleIsEmpty, biblePrompt, bibleStyleSuffix, bibleSummary} from '../src/pipeline/bible.mjs';
import {shotVideoPrompt} from '../src/pipeline/video-jobs.mjs';

test('normalizeBible trims, fills missing fields and caps length', () => {
  const bible = normalizeBible({characters: '  林舟：青灰长衫  ', style: 'x'.repeat(5000)});
  assert.equal(bible.characters, '林舟：青灰长衫');
  assert.equal(bible.logline, '');
  assert.equal(bible.style.length, 4000);
  assert.deepEqual(normalizeBible(null), normalizeBible({}));
});

test('writeBible stores bible on workstation and readBible reads it', () => {
  const project = {workstation: {script: 'x'}};
  writeBible(project, {logline: '雨夜重逢'});
  assert.equal(project.workstation.bible.logline, '雨夜重逢');
  assert.equal(readBible(project).logline, '雨夜重逢');
  assert.equal(readBible({}).logline, '');
});

test('biblePrompt includes filled fields only and empty bible returns empty text', () => {
  assert.equal(biblePrompt({}), '');
  const prompt = biblePrompt({characters: '林舟', style: '青灰'});
  assert.match(prompt, /项目圣经/);
  assert.match(prompt, /人物设定：林舟/);
  assert.match(prompt, /画面风格：青灰/);
  assert.doesNotMatch(prompt, /场景设定/);
});

test('bibleStyleSuffix combines style, camera and negative; summary counts fields', () => {
  const bible = {style: '青灰', camera: '低机位', negative: '卡通'};
  assert.equal(bibleStyleSuffix(bible), '画面风格：青灰；镜头语言：低机位；避免：卡通');
  assert.equal(bibleStyleSuffix({}), '');
  assert.equal(bibleSummary(bible).filled, 3);
  assert.equal(bibleIsEmpty(bible), false);
  assert.equal(bibleIsEmpty({logline: '  '}), true);
});

test('shotVideoPrompt appends the bible style suffix and keeps limits', () => {
  const project = {
    shots: [{id: 's1', start: 0, end: 3}],
    nodes: [],
    workstation: {bible: {style: '青灰胶片', negative: '卡通'}},
  };
  const shot = {id: 's1', start: 0, end: 3};
  const prompt = shotVideoPrompt(project, shot, []);
  assert.match(prompt, /镜 1/);
  assert.match(prompt, /画面风格：青灰胶片/);
  assert.match(prompt, /避免：卡通/);
  assert.ok(prompt.length <= 6000);
});

test('biblePrompt and bibleStyleSuffix cap size for model requests', () => {
  const huge = {characters: 'x'.repeat(4000), scenes: 'y'.repeat(4000), style: 'z'.repeat(4000), negative: 'n'.repeat(4000)};
  assert.ok(biblePrompt(huge).length <= 6000);
  assert.ok(bibleStyleSuffix(huge).length <= 1200);
});
