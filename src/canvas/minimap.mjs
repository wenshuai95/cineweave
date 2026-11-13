// 小地图：边界计算与绘制。
export function minimapBounds({ nodes = [], nodeRect, stageWidth, stageHeight, viewport }) {
  const view = {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: stageWidth / viewport.zoom,
    height: stageHeight / viewport.zoom,
  };
  const boxes = nodes.map(nodeRect).concat([view]);
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return { minX: minX - 80, minY: minY - 80, width: maxX - minX + 160, height: maxY - minY + 160, viewport: view };
}

const COLORS = { text: '#5b6b7f', image: '#4b8dff', video: '#9d7bff', audio: '#42b883', stage: '#e0a35c', timeline: '#d9d2c3' };

export function minimapTransform(bounds, width, height) {
  const scale = Math.min((width - 16) / bounds.width, (height - 16) / bounds.height);
  return {
    scale,
    offsetX: 8 - bounds.minX * scale + (width - 16 - bounds.width * scale) / 2,
    offsetY: 8 - bounds.minY * scale + (height - 16 - bounds.height * scale) / 2,
  };
}

export function paintMinimap(ctx, { width, height, nodes = [], nodeRect, bounds }) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b0e12';
  ctx.fillRect(0, 0, width, height);
  if (!nodes.length) {
    ctx.fillStyle = '#4a5360';
    ctx.font = '10px sans-serif';
    ctx.fillText('空画布', 12, 24);
    return;
  }
  const { scale, offsetX, offsetY } = minimapTransform(bounds, width, height);
  for (const node of nodes) {
    const rect = nodeRect(node);
    ctx.fillStyle = COLORS[node.type] || '#6b7280';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(offsetX + rect.x * scale, offsetY + rect.y * scale, Math.max(2, rect.width * scale), Math.max(2, rect.height * scale));
  }
  ctx.globalAlpha = 1;
  const viewport = bounds.viewport;
  ctx.strokeStyle = 'rgba(120,180,255,.95)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(offsetX + viewport.x * scale, offsetY + viewport.y * scale, Math.max(4, viewport.width * scale), Math.max(4, viewport.height * scale));
}
