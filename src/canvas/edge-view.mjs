// 连线 SVG：纯函数，positions 为 id -> {x,y,width,height}。
import { edgePath } from './engine.mjs';

export function edgePathsHtml({ edges = [], positions = new Map(), selectedEdge = null, tempLink = null } = {}) {
  const paths = [];
  const pointOf = (id) => {
    const rect = positions.get?.(id);
    if (!rect) return null;
    return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
  };
  for (const edge of edges) {
    const from = pointOf(edge.from);
    const to = pointOf(edge.to);
    if (!from || !to) continue;
    const selected = selectedEdge === edge.id ? ' class="selected"' : '';
    paths.push(`<path${selected} d="${edgePath(from, { x: to.x - (positions.get(edge.to)?.width || 0), y: to.y })}" data-edge="${edge.id}"></path>`);
  }
  if (tempLink) {
    const from = pointOf(tempLink.from);
    if (from) paths.push(`<path class="cv-edge-temp" d="${edgePath(from, tempLink.to)}"></path>`);
  }
  return paths.join('');
}
