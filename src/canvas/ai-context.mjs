// AI 助手上下文与消息 HTML：纯函数。
export function aiContextLabel(node) {
  if (!node) return 'DeepSeek · 未选中节点';
  return `DeepSeek · 上下文：${node.title || node.type}`;
}

export function buildAIContext({ doc, node, boardList = [], boardProjectId = 'local' }) {
  return {
    canvas: { nodes: doc?.nodes?.length || 0, boards: boardList.length, projectId: boardProjectId },
    selection: node ? {
      type: node.type,
      title: node.title,
      status: node.status,
      prompt: node.generation?.prompt || node.text || '',
      mode: node.generation?.mode,
      model: node.generation?.model,
      ratio: node.generation?.ratio,
      resolution: node.generation?.resolution,
      references: (node.generation?.references || []).map((ref) => ({
        type: ref.type,
        role: ref.role || '通用',
        title: doc?.nodes?.find((item) => item.id === ref.id)?.title,
      })),
    } : null,
  };
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function renderAIMessagesHtml(messages = []) {
  if (!messages.length) return '<div class="cv-ai-hint">可以问：这场戏怎么分镜？/ 帮我写一段雨夜追车的提示词 / 这个镜头用什么景别？</div>';
  return messages.map((message, index) => {
    const content = escapeHtml(message.content).replace(/\n/g, '<br>');
    const copy = `<button data-ai-copy="${index}">复制</button>`;
    const actions = message.role === 'assistant' ? `<button data-ai-insert="${index}">插入提示词</button><button data-ai-apply="${index}">应用到节点</button>` : '';
    return `<div class="cv-ai-msg ${escapeHtml(message.role)}">${content}${copy}${actions}</div>`;
  }).join('');
}
