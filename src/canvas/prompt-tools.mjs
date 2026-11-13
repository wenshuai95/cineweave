// 提示词优化/翻译弹窗控制。
import { optimizePromptRequest, translatePromptRequest } from './generation-request.mjs';

export function createPromptTools({
  app,
  getPrompt,
  getNodeType,
  onApply,
  toast = () => {},
  requestOptimize = optimizePromptRequest,
  requestTranslate = translatePromptRequest,
} = {}) {
  let versions = { zh: '', en: '' };
  let lang = 'zh';
  const $ = (selector) => app.querySelector(selector);

  function switchLang(next) {
    versions[lang] = $('#optimizeText').value;
    lang = next;
    $('#optimizeText').value = versions[lang] || '';
    app.querySelectorAll('#optimizeLangs [data-lang]').forEach((button) => button.classList.toggle('active', button.dataset.lang === lang));
  }

  async function optimize() {
    const prompt = String(getPrompt?.() || '').trim();
    if (!prompt) { toast('先写提示词'); return false; }
    const button = $('#dockOptimize');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = '优化中…';
    const modal = $('#optimizeModal');
    const status = $('#optimizeStatus');
    const textarea = $('#optimizeText');
    modal.classList.add('open');
    textarea.value = prompt;
    status.textContent = '正在调用 DeepSeek…';
    status.classList.remove('bad');
    try {
      const data = await requestOptimize({ prompt, mode: getNodeType?.() === 'video' ? 'video' : getNodeType?.() === 'audio' ? 'audio' : 'image' });
      versions = { zh: data.optimized || prompt, en: data.optimizedEn || '' };
      lang = /[\u3400-\u9fff]/.test(prompt) ? 'zh' : 'en';
      textarea.value = versions[lang];
      app.querySelectorAll('#optimizeLangs [data-lang]').forEach((button) => button.classList.toggle('active', button.dataset.lang === lang));
      status.textContent = `已由 ${data.model || 'DeepSeek'} 优化${versions.en ? '（中文/英文双版）' : ''}`;
      return true;
    } catch (error) {
      status.textContent = `优化失败：${error.message}`;
      status.classList.add('bad');
      return false;
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function translate() {
    const prompt = String(getPrompt?.() || '').trim();
    if (!prompt) { toast('先写提示词'); return false; }
    const button = $('#dockTranslate');
    button.disabled = true;
    try {
      const data = await requestTranslate({ prompt });
      onApply?.(data.translated, { translated: true });
      toast('已翻译成英文');
      return true;
    } catch (error) {
      toast(error.message || String(error), true);
      return false;
    } finally {
      button.disabled = false;
    }
  }

  function apply() {
    versions[lang] = $('#optimizeText').value;
    const text = $('#optimizeText').value.trim();
    if (!text) { toast('优化结果为空'); return false; }
    onApply?.(text, { optimized: true });
    $('#optimizeModal').classList.remove('open');
    toast('已应用优化后的提示词');
    return true;
  }

  return { optimize, translate, apply, switchLang, get versions() { return versions; }, get lang() { return lang; } };
}
