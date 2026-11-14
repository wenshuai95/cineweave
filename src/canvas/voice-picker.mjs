// 即梦音色选择器。
import { listVoicesRequest } from './generation-request.mjs';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function voiceListHtml(voices = [], current = '') {
  if (!voices.length) return '<div class="cv-status">没有可用音色（请确认即梦 CLI 已登录）</div>';
  return voices.map((voice, index) => {
    const tags = [voice.tags?.gender, voice.tags?.age, voice.tags?.accent].filter(Boolean).join(' · ');
    const active = voice.voiceName === current ? ' active' : '';
    return `<button class="cv-voice-item${active}" data-index="${index}"><b>${escapeHtml(voice.voiceName || voice.voiceId)}</b><span>${escapeHtml(tags)}</span></button>`;
  }).join('');
}

export function createVoicePicker({ app, getNode, setNode, render, toast = () => {}, listVoices = listVoicesRequest } = {}) {
  let cache = null;
  let nodeId = null;

  async function open(nextNodeId) {
    nodeId = nextNodeId;
    const modal = app.querySelector('#voiceModal');
    const list = app.querySelector('#voiceList');
    modal.classList.add('open');
    list.innerHTML = '<div class="cv-status">读取音色库…</div>';
    try {
      if (!cache) cache = await listVoices();
      const node = getNode?.(nodeId);
      const current = node?.generation?.voiceName || '';
      list.innerHTML = voiceListHtml(cache, current);
      list.querySelectorAll('[data-index]').forEach((button) => {
        button.addEventListener('click', () => {
          const voice = cache[Number(button.dataset.index)];
          const target = getNode?.(nodeId);
          if (!voice || !target) return;
          setNode?.(target.id, { generation: { voiceName: voice.voiceName, voiceId: voice.voiceId } });
          app.querySelector('#voiceModal').classList.remove('open');
          render?.();
          toast(`已选择音色：${voice.voiceName}`);
        });
      });
      return true;
    } catch (error) {
      list.innerHTML = `<div class="cv-status bad">${escapeHtml(error.message || '读取失败')}</div>`;
      return false;
    }
  }

  return { open, get cache() { return cache; } };
}
