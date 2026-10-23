// English-first i18n. en-US is the source of truth; zh-CN is a translation pack.
// Sprint 1 provides the runtime and tests; screens migrate progressively.

import en from './en-US.json' with {type: 'json'};
import zh from './zh-CN.json' with {type: 'json'};

export const LOCALES = Object.freeze({en: 'en-US', zh: 'zh-CN'});
const PACKS = Object.freeze({'en-US': en, 'zh-CN': zh});
const FALLBACK = 'en-US';
const STORAGE_KEY = 'cineweave.locale';

const listeners = new Set();
const missing = new Set();
let current = FALLBACK;

const normalizeLocale = value => {
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('en')) return 'en-US';
  return null;
};

function readStored(storage) {
  try {
    return normalizeLocale(storage?.getItem?.(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function detectLocale({storage, languages} = {}) {
  const stored = readStored(storage ?? globalThis.localStorage);
  if (stored) return stored;
  const list = languages ?? globalThis.navigator?.languages ?? (globalThis.navigator?.language ? [globalThis.navigator.language] : []);
  for (const language of Array.isArray(list) ? list : []) {
    const locale = normalizeLocale(language);
    if (locale) return locale;
  }
  return FALLBACK;
}

export function getLocale() {
  return current;
}

export function setLocale(locale, {persist = true, storage} = {}) {
  const next = normalizeLocale(locale) || FALLBACK;
  current = next;
  if (persist) {
    try { (storage ?? globalThis.localStorage)?.setItem?.(STORAGE_KEY, next); } catch {}
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  for (const listener of listeners) listener(next);
  return next;
}

export function onLocaleChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const read = (pack, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), pack);

export function t(key, params = {}) {
  if (typeof key !== 'string' || !key) return '';
  let text = read(PACKS[current], key);
  if (typeof text !== 'string') {
    missing.add(current + ':' + key);
    text = read(PACKS[FALLBACK], key);
  }
  if (typeof text !== 'string') {
    missing.add('key:' + key);
    return key;
  }
  return String(text).replace(/\{(\w+)\}/g, (_, name) => (params[name] == null ? '{' + name + '}' : String(params[name])));
}

export function hasKey(key, locale = current) {
  return typeof read(PACKS[locale] || {}, key) === 'string';
}

export function missingKeys() {
  return [...missing];
}

export function resetMissingKeys() {
  missing.clear();
}

export function messagesFor(locale = current) {
  return PACKS[normalizeLocale(locale) || FALLBACK];
}

export function formatNumber(value, options) {
  return new Intl.NumberFormat(current, options).format(value);
}

export function formatDate(value, options = {dateStyle: 'medium'}) {
  return new Intl.DateTimeFormat(current, options).format(value instanceof Date ? value : new Date(value));
}

// 初始化：存储中的选择优先，否则按系统语言；英文为默认。
current = detectLocale();
