// 选择与框选几何：纯函数。
export function applyNodeSelection(selection, nodeId, { shift = false, groupIds = [] } = {}) {
  const next = new Set(selection);
  if (shift) {
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    return next;
  }
  if (groupIds.length) return new Set(groupIds);
  if (!next.has(nodeId)) return new Set([nodeId]);
  return next;
}

export function marqueeWorldBox({ startX, startY, currentX, currentY, stageLeft = 0, stageTop = 0, viewport }) {
  const toWorld = (x, y) => ({
    x: (x - stageLeft - viewport.x) / viewport.zoom,
    y: (y - stageTop - viewport.y) / viewport.zoom,
  });
  const a = toWorld(startX, startY);
  const b = toWorld(currentX, currentY);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function selectionAfterMarquee(selection, hitIds, additive = false) {
  return additive ? new Set([...selection, ...hitIds]) : new Set(hitIds);
}
