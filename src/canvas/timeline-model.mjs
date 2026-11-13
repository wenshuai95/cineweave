// 时间线纯数据层：片段归一化、扫描、时长、格式化、分割、拖动。
// 不依赖 DOM，UI 由 main.mjs 负责。

export const TIMELINE_TYPES = ['video', 'audio', 'image'];

export function normalizeTimelineItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    ...item,
    start: Number(item.start) || 0,
    duration: Math.max(0.2, Number(item.duration) || (item.type === 'image' ? 3 : 5)),
    sourceStart: Number(item.sourceStart) || 0,
    label: item.label || item.type || `片段 ${index + 1}`,
    transition: item.transition || 'none',
  }));
}

export function scanTimelineItems(nodes = []) {
  let cursor = 0;
  return nodes
    .filter((node) => TIMELINE_TYPES.includes(node.type))
    .map((node) => {
      const duration = node.type === 'image' ? 3 : (Number(node.generation?.durationSeconds) || 5);
      const item = { id: node.id, label: node.title || node.type, type: node.type, start: cursor, duration, sourceStart: 0, transition: 'none' };
      cursor += duration;
      return item;
    });
}

export function timelineTotalDuration(items = []) {
  return Math.max(2, ...items.map((item) => (Number(item.start) || 0) + (Number(item.duration) || 0))) + 0.5;
}

export function formatTimelineTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
}

export function splitTimelineItem(item) {
  if (!item) return null;
  const half = Number(item.duration) / 2;
  if (!Number.isFinite(half) || half < 0.2) return null;
  const first = { ...item, duration: half };
  const second = {
    ...item,
    id: `${item.id}__split_${Date.now().toString(36)}`,
    start: (Number(item.start) || 0) + half,
    duration: half,
    sourceStart: (Number(item.sourceStart) || 0) + half,
  };
  return [first, second];
}

export function dragTimelineItem(item, origin, mode, delta) {
  if (!item || !origin) return null;
  const next = { ...item };
  if (mode === 'move') {
    next.start = Math.max(0, origin.start + delta);
  } else if (mode === 'trim-start') {
    const newStart = Math.max(0, origin.start + delta);
    const change = newStart - origin.start;
    next.start = newStart;
    next.duration = Math.max(0.2, origin.duration - change);
    next.sourceStart = Math.max(0, (origin.sourceStart || 0) + change);
  } else {
    next.duration = Math.max(0.2, origin.duration + delta);
  }
  return next;
}
