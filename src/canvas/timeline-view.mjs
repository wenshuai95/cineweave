// 时间线视图层：只生成 HTML 字符串，不碰 DOM。
import { formatTimelineTime } from './timeline-model.mjs';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function timelineAssetsHtml(assets = []) {
  if (!assets.length) return '<div class="cv-timeline-asset-empty">将文件拖至此处添加</div>';
  return assets.map((node) => {
    const label = escapeHtml(node.title || node.type);
    const type = node.type === 'video' ? '视频' : node.type === 'audio' ? '音频' : '图片';
    const media = node.type !== 'audio' && node.resources?.[0]?.url
      ? `<img src="${escapeHtml(node.resources[0].url)}" alt="">`
      : '<span class="cv-timeline-asset-audio">♫</span>';
    return `<button class="cv-timeline-asset" data-asset="${escapeHtml(node.id)}">${media}<b>${label}</b><em>${type}</em></button>`;
  }).join('');
}

export function timelineRulerHtml(total) {
  const duration = Math.max(1, Number(total) || 1);
  const step = duration > 30 ? 5 : duration > 12 ? 2 : 1;
  const ticks = [];
  for (let t = 0; t <= duration; t += step) ticks.push(`<span style="left:${(t / duration) * 100}%">${formatTimelineTime(t)}</span>`);
  return ticks.join('');
}

export function timelineLanesHtml(items = [], total, selected = null) {
  const duration = Math.max(1, Number(total) || 1);
  return ['video', 'audio'].map((type) => {
    const clips = items.filter((item) => (type === 'video' ? (item.type === 'video' || item.type === 'image') : item.type === 'audio')).map((item) => {
      const left = ((Number(item.start) || 0) / duration) * 100;
      const width = Math.max(1, ((Number(item.duration) || 0) / duration) * 100);
      const selectedClass = selected === item.id ? ' selected' : '';
      const badge = item.type === 'image' ? ' <em>图</em>' : '';
      return `<div class="cv-tl-clip ${type}${selectedClass}" data-item="${escapeHtml(item.id)}" style="left:${left}%;width:${width}%"><span class="handle left" data-edge="start"></span><b>${escapeHtml(item.label || item.type)}${badge}</b><span class="handle right" data-edge="end"></span></div>`;
    }).join('');
    return `<div class="cv-timeline-lane"><div class="cv-timeline-lane-label">${type === 'video' ? '视频' : '音频'}</div><div class="cv-timeline-lane-track">${clips}<button class="cv-timeline-add" title="添加素材">+</button></div></div>`;
  }).join('');
}
