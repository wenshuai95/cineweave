// 多选对齐/堆叠：纯几何。
const snap = (value, grid) => Math.round(value / grid) * grid;

export function alignPositions(rects, mode, grid = 8) {
  if (!Array.isArray(rects) || rects.length < 2) return [];
  const left = Math.min(...rects.map((rect) => rect.x));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const top = Math.min(...rects.map((rect) => rect.y));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return rects.map((rect) => {
    let x = rect.x;
    let y = rect.y;
    if (mode === 'left') x = left;
    if (mode === 'right') x = right - rect.width;
    if (mode === 'centerX') x = (left + right) / 2 - rect.width / 2;
    if (mode === 'top') y = top;
    if (mode === 'bottom') y = bottom - rect.height;
    if (mode === 'centerY') y = (top + bottom) / 2 - rect.height / 2;
    return { x: snap(x, grid), y: snap(y, grid) };
  });
}

export function stackPositions(rects, gap = 24, grid = 8) {
  if (!Array.isArray(rects) || !rects.length) return [];
  const left = Math.min(...rects.map((rect) => rect.x));
  let top = Math.min(...rects.map((rect) => rect.y));
  return rects.map((rect) => {
    const position = { x: snap(left, grid), y: snap(top, grid) };
    top += (rect.height || 320) + gap;
    return position;
  });
}
