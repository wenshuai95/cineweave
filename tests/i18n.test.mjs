import test from 'node:test';
import assert from 'node:assert/strict';
import en from '../src/i18n/en-US.json' with {type: 'json'};
import zh from '../src/i18n/zh-CN.json' with {type: 'json'};
import {getLocale, hasKey, messagesFor, missingKeys, resetMissingKeys, setLocale, t, detectLocale, formatNumber} from '../src/i18n/index.mjs';

const flatten = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) =>
  value && typeof value === 'object' ? flatten(value, prefix + key + '.') : [prefix + key]);

test('English and Chinese locale packs have identical keys', () => {
  const enKeys = flatten(en).sort();
  const zhKeys = flatten(zh).sort();
  assert.deepEqual(zhKeys, enKeys);
});

test('t resolves nested keys, falls back to English and interpolates', () => {
  setLocale('zh-CN', {persist: false});
  assert.equal(t('nav.canvas'), '画布');
  assert.equal(t('common.save'), '保存');
  assert.equal(t('error.network'), '网络异常，请检查连接后重试。');
  assert.equal(t('missing.key'), 'missing.key');
  assert.ok(missingKeys().includes('zh-CN:missing.key'));
  resetMissingKeys();
  assert.equal(missingKeys().length, 0);
  setLocale('en-US', {persist: false});
  assert.equal(t('nav.canvas'), 'Canvas');
  assert.equal(t('greeting', {name: 'Ada'}), 'greeting');
  assert.equal(t('task.running'), 'Running');
});

test('locale detection prefers stored value, then system languages, then English', () => {
  const storage = {getItem: key => (key === 'cineweave.locale' ? 'zh-CN' : null)};
  assert.equal(detectLocale({storage, languages: ['en-US']}), 'zh-CN');
  assert.equal(detectLocale({storage: {getItem: () => null}, languages: ['zh-CN', 'en-US']}), 'zh-CN');
  assert.equal(detectLocale({storage: {getItem: () => null}, languages: ['fr-FR']}), 'en-US');
  setLocale('en-US', {persist: false});
  assert.equal(getLocale(), 'en-US');
});

test('hasKey and messagesFor respect the active locale', () => {
  setLocale('zh-CN', {persist: false});
  assert.equal(hasKey('nav.canvas'), true);
  assert.equal(hasKey('nav.canvas', 'en-US'), true);
  assert.equal(hasKey('nav.nope'), false);
  assert.equal(messagesFor().nav.canvas, '画布');
  assert.equal(messagesFor('en-US').nav.canvas, 'Canvas');
  assert.equal(formatNumber(1234).length > 0, true);
  setLocale('en-US', {persist: false});
});
