// 拖拽吸附与参考线：纯几何函数。
export function computeSnap({ x, y, width, height, rects = [], exclude = new Set(), zoom = 1, threshold = 6 } = {}) {
  const limit = threshold / Math.max(0.25, Number(zoom) || 1);
  const others = rects.filter((item) => !exclude.has(item.id));
  const movingX = [x, x + width / 2, x + width];
  const movingY = [y, y + height / 2, y + height];
  const candidatesX = [];
  const candidatesY = [];
  for (const rect of others) {
    candidatesX.push(rect.x, rect.x + rect.width / 2, rect.x + rect.width);
    candidatesY.push(rect.y, rect.y + rect.height / 2, rect.y + rect.height);
  }
  let bestX = null;
  let bestY = null;
  for (const mx of movingX) {
    for (const cx of candidatesX) {
      const diff = cx - mx;
      if (Math.abs(diff) <= limit && (!bestX || Math.abs(diff) < Math.abs(bestX.diff))) bestX = { diff, at: cx };
    }
  }
  for (const my of movingY) {
    for (const cy of candidatesY) {
      const diff = cy - my;
      if (Math.abs(diff) <= limit && (!bestY || Math.abs(diff) < Math.abs(bestY.diff))) bestY = { diff, at: cy };
    }
  }
  const lines = [];
  if (bestX) {
    const minY = Math.min(...others.map((rect) => rect.y), y);
    const maxY = Math.max(...others.map((rect) => rect.y + rect.height), y + height);
    lines.push({ x1: bestX.at, y1: minY - 40, x2: bestX.at, y2: maxY + 40 });
  }
  if (bestY) {
    const minX = Math.min(...others.map((rect) => rect.x), x);
    const maxX = Math.max(...others.map((rect) => rect.x + rect.width), x + width);
    lines.push({ x1: minX - 40, y1: bestY.at, x2: maxX + 40, y2: bestY.at });
  }
  return { x: x + (bestX?.diff || 0), y: y + (bestY?.diff || 0), lines };
}

export function guidesHtml(lines = []) {
  return lines.map((line) => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}"></line>`).join('');
}
