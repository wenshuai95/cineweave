// AI 助手面板：状态、渲染、发送、按钮绑定。
import { renderAIMessagesHtml, aiContextLabel } from './ai-context.mjs';
import { askAssistant } from './generation-request.mjs';

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return; } catch { /* fallback */ }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

export function createAIPanel({
  app,
  getSelectedNode,
  getContext,
  onInsertPrompt,
  onApplyPrompt,
  toast = () => {},
  requestAssistant = askAssistant,
} = {}) {
  let messages = [];
  let busy = false;
  const $ = (selector) => app.querySelector(selector);

  function open() {
    $('#aiPanel').classList.add('open');
    $('#aiContext').textContent = aiContextLabel(getSelectedNode?.() || null);
    $('#aiInput').focus();
    render();
  }

  function close() {
    $('#aiPanel').classList.remove('open');
  }

  function render() {
    const host = $('#aiMessages');
    host.innerHTML = renderAIMessagesHtml(messages);
    if (!messages.length) return;
    host.querySelectorAll('[data-ai-copy]').forEach((button) => {
      button.addEventListener('click', async () => {
        const message = messages[Number(button.dataset.aiCopy)];
        if (!message) return;
        try { await copyText(message.content); toast('已复制'); }
        catch { toast('复制失败，请手动选中复制', true); }
      });
    });
    host.querySelectorAll('[data-ai-insert]').forEach((button) => {
      button.addEventListener('click', () => {
        const message = messages[Number(button.dataset.aiInsert)];
        if (message) onInsertPrompt?.(message.content);
      });
    });
    host.querySelectorAll('[data-ai-apply]').forEach((button) => {
      button.addEventListener('click', () => {
        const message = messages[Number(button.dataset.aiApply)];
        if (message) onApplyPrompt?.(message.content);
      });
    });
    host.scrollTop = host.scrollHeight;
  }

  async function send() {
    const input = $('#aiInput');
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    messages.push({ role: 'user', content: text });
    input.value = '';
    render();
    const sendButton = $('#aiSend');
    sendButton.disabled = true;
    sendButton.textContent = '思考中…';
    try {
      const data = await requestAssistant({ messages, context: getContext?.() || null });
      messages.push({ role: 'assistant', content: data.reply });
    } catch (error) {
      messages.push({ role: 'assistant', content: `出错了：${error.message}` });
    } finally {
      busy = false;
      sendButton.disabled = false;
      sendButton.textContent = '发送';
      render();
    }
  }

  function bind() {
    $('#aiDockBtn').addEventListener('click', open);
    $('#aiClose').addEventListener('click', close);
    $('#aiSend').addEventListener('click', send);
    $('#aiInput').addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
    });
  }

  return { open, close, send, bind, get messages() { return messages; } };
}
