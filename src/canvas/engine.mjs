// 画布引擎的纯函数部分：视口变换、命中测试、连线几何。
// 不碰 DOM，方便单测；渲染层（node-view/edge-view）只消费这里的结果。

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const DEFAULT_NODE_WIDTH = 569;
export const DEFAULT_NODE_HEIGHT = 320;
export const CONNECTOR_RADIUS = 14;

export function createViewport(overrides = {}) {
  return {
    x: Number.isFinite(overrides.x) ? overrides.x : 0,
    y: Number.isFinite(overrides.y) ? overrides.y : 0,
    zoom: clampZoom(overrides.zoom ?? 1),
  };
}

export function clampZoom(zoom) {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** 世界坐标 -> 屏幕坐标（屏幕 = 世界 * zoom + 平移）。 */
export function worldToScreen(point, viewport) {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
}

/** 屏幕坐标 -> 世界坐标。 */
export function screenToWorld(point, viewport) {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

/** 以屏幕上某点为锚缩放：锚点下的世界坐标保持不动。 */
export function zoomAt(viewport, screenPoint, nextZoom) {
  const zoom = clampZoom(nextZoom);
  const world = screenToWorld(screenPoint, viewport);
  return {
    x: screenPoint.x - world.x * zoom,
    y: screenPoint.y - world.y * zoom,
    zoom,
  };
}

/** 按屏幕像素平移（dx/dy 是屏幕位移）。 */
export function panBy(viewport, dxScreen, dyScreen) {
  return { x: viewport.x + dxScreen, y: viewport.y + dyScreen, zoom: viewport.zoom };
}

/** 让一组节点的包围盒居中并适配到视口。 */
export function fitViewport(nodes, viewportSize, padding = 80) {
  if (!nodes.length) return createViewport();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const rect = nodeRect(node);
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const zoom = clampZoom(Math.min(
    (viewportSize.width - padding * 2) / width,
    (viewportSize.height - padding * 2) / height,
    1,
  ));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    x: viewportSize.width / 2 - cx * zoom,
    y: viewportSize.height / 2 - cy * zoom,
    zoom,
  };
}

export function nodeRect(node) {
  const layout = node.layout || {};
  return {
    x: Number(layout.x) || 0,
    y: Number(layout.y) || 0,
    width: Number(layout.width) > 0 ? Number(layout.width) : DEFAULT_NODE_WIDTH,
    height: Number(layout.height) > 0 ? Number(layout.height) : DEFAULT_NODE_HEIGHT,
  };
}

export function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width
    && point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function rectsIntersect(a, b) {
  return !(a.x + a.width < b.x || b.x + b.width < a.x
    || a.y + a.height < b.y || b.y + b.height < a.y);
}

/** 世界坐标命中测试，返回最上层的节点（nodes 顺序即 z 序，后画的在上）。 */
export function hitTestNode(nodes, worldPoint) {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    if (pointInRect(worldPoint, nodeRect(nodes[i]))) return nodes[i];
  }
  return null;
}

/** 框选：返回与矩形相交的节点。 */
export function nodesInRect(nodes, rect) {
  return nodes.filter((node) => rectsIntersect(nodeRect(node), rect));
}

/** 连线在节点上的锚点：默认右出左入；边上各缩进 CONNECTOR_RADIUS。 */
export function anchorPoints(fromNode, toNode) {
  const from = nodeRect(fromNode);
  const to = nodeRect(toNode);
  return {
    from: { x: from.x + from.width, y: from.y + from.height / 2 },
    to: { x: to.x, y: to.y + to.height / 2 },
  };
}

/** 生成 SVG path：水平方向的 cubic bezier，和即梦的蓝色连线一致。 */
export function edgePath(from, to, bend = 0.5) {
  const dx = Math.max(40, Math.abs(to.x - from.x) * bend);
  const c1 = { x: from.x + dx, y: from.y };
  const c2 = { x: to.x - dx, y: to.y };
  return `M ${round(from.x)} ${round(from.y)} C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ${round(to.x)} ${round(to.y)}`;
}

export function nodeEdgePath(fromNode, toNode) {
  const { from, to } = anchorPoints(fromNode, toNode);
  return { from, to, path: edgePath(from, to) };
}

/** 对齐吸附：把节点位置吸附到网格（网格大小按世界坐标）。 */
export function snapToGrid(value, grid = 20) {
  if (!Number.isFinite(value) || !(grid > 0)) return value;
  return Math.round(value / grid) * grid;
}

export function moveNodeBy(node, dx, dy, grid = 0) {
  const rect = nodeRect(node);
  return {
    ...node,
    layout: {
      ...node.layout,
      x: grid ? snapToGrid(rect.x + dx, grid) : rect.x + dx,
      y: grid ? snapToGrid(rect.y + dy, grid) : rect.y + dy,
      width: rect.width,
      height: rect.height,
    },
  };
}

export function viewportCenter(viewport, size) {
  return screenToWorld({ x: size.width / 2, y: size.height / 2 }, viewport);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
