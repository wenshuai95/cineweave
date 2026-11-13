// 节点内容 HTML：纯函数。
import { ICONS } from './canvas-icons.mjs';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function generationOverlayHtml(node) {
  if (node?.status !== 'running' || !node.resources?.length) return '';
  const progress = Math.max(3, Math.min(100, Number(node.progress) || 0));
  return `<div class="cv-generation-overlay"><div class="cv-gen-card"><span>生成中…</span><b>${Math.round(Number(node.progress) || 0)}%</b><div class="cv-gen-bar"><i style="width:${progress}%"></i></div></div></div>`;
}

export function nodeBodyHtml(node) {
  if (node.type === 'text') return `<div class="cv-text-inner">${escapeHtml(node.text || '双击输入文本')}</div>`;
  if (node.type === 'timeline') {
    const items = node.timelineItems || [];
    const total = Math.max(1, ...items.map((item) => (Number(item.start) || 0) + (Number(item.duration) || 0)));
    const clips = items.map((item) => {
      const left = ((Number(item.start) || 0) / total) * 100;
      const width = Math.max(2, ((Number(item.duration) || 0) / total) * 100);
      return `<span class="cv-mini-clip ${item.type}" style="left:${left}%;width:${width}%" title="${escapeHtml(item.label || item.type)} · ${item.duration}s"></span>`;
    }).join('');
    return `<div class="cv-mini-timeline"><div class="cv-mini-bar"><span>▶ 00:00 / ${total.toFixed(1)}s</span><button class="cv-mini-expand">全屏编辑 ↗</button></div><div class="cv-mini-ruler">${[0, .25, .5, .75, 1].map((p) => `<i style="left:${p * 100}%"></i>`).join('')}</div><div class="cv-mini-track">${clips}<b class="cv-mini-add">${items.length ? '' : '+ 添加素材到时间线'}</b></div></div>`;
  }
  const media = node.resources?.[0];
  if (media?.url && media.type === 'image') return `<img class="cv-node-image" src="${escapeHtml(media.url)}" alt="${escapeHtml(node.title || '')}">`;
  if (media?.url && media.type === 'video') return `<video class="cv-node-media" src="${escapeHtml(media.url)}" controls playsinline preload="metadata"></video>`;
  if (media?.url && media.type === 'audio') return `<div class="cv-wave-wrap"><canvas class="cv-wave" data-audio-url="${escapeHtml(media.url)}"></canvas><audio class="cv-node-media" src="${escapeHtml(media.url)}" controls preload="metadata"></audio></div>`;
  if (node.status === 'running') return `<div class="cv-placeholder">${ICONS[node.type] || ICONS.image}<span>生成中… ${Math.round(node.progress || 0)}%</span></div>`;
  if (node.status === 'failed') return `<div class="cv-placeholder">${ICONS[node.type] || ICONS.image}<span>生成失败 · ${escapeHtml(String(node.error || '生成失败').slice(0, 80))}</span></div>`;
  const label = { image: '图片节点', video: '视频节点', audio: '音频节点', stage: '导演台', timeline: '时间线' }[node.type] || '节点';
  return `<div class="cv-placeholder">${ICONS[node.type] || ICONS.image}<span>${label} · 选中后生成</span></div>`;
}
