// 给现有 DOM 模板用的轻量 i18n：元素加 data-i18n 即可翻译。
// 迁移期允许中英混排；后续逐屏把硬编码文案换成 key。

import {t as translate, getLocale, onLocaleChange} from './index.mjs';

const ATTRS = [
  ['data-i18n-title', 'title'],
  ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-aria-label', 'aria-label'],
];

export function applyI18n(root = document) {
  if (!root?.querySelectorAll) return;
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const key = el.dataset.i18n;
    if (!key) continue;
    el.textContent = translate(key);
  }
  for (const [data, attr] of ATTRS) {
    for (const el of root.querySelectorAll(`[${data}]`)) {
      el.setAttribute(attr, translate(el.getAttribute(data)));
    }
  }
}

let observer = null;
export function startI18nDom(root = document) {
  if (typeof document === 'undefined') return;
  applyI18n(root);
  if (observer) return;
  observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) applyI18n(node);
      }
    }
  });
  observer.observe(document.body, {childList: true, subtree: true});
  onLocaleChange(() => applyI18n(document));
  document.documentElement.lang = getLocale();
}
