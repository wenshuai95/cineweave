// Display-only graph focus. Never mutates project nodes, groups, wires or view.
export function canvasRelations(project, selection = []) {
  const nodes = new Set((project.nodes || []).map(node => node.id));
  const selectedIds = [...new Set(selection)].filter(id => nodes.has(id));
  const selected = new Set(selectedIds), related = new Set(selectedIds), edgeIndices = [];
  for (const [index, edge] of (project.edges || []).entries()) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) continue;
    if (selected.has(edge.from) || selected.has(edge.to)) {
      edgeIndices.push(index); related.add(edge.from); related.add(edge.to);
    }
  }
  return { selectedIds, relatedIds: [...related], edgeIndices };
}

// A collapsed group may aggregate related and unrelated edges. Its visible wire
// stays clear whenever at least one actual edge touches the selected nodes.
export function wireRelationState(wire, relations) {
  if (!relations.selectedIds.length) return 'neutral';
  const related = new Set(relations.edgeIndices);
  return (wire.indices || []).some(index => related.has(index)) ? 'related' : 'muted';
}

export function relationTargets(project, selection, direction = 'both') {
  const relation = canvasRelations(project, selection), selected = new Set(relation.selectedIds);
  const found = new Set();
  for (const edge of project.edges || []) {
    if (direction !== 'out' && selected.has(edge.to) && !selected.has(edge.from)) found.add(edge.from);
    if (direction !== 'in' && selected.has(edge.from) && !selected.has(edge.to)) found.add(edge.to);
  }
  // Project ordering is stable; missing endpoints and repeated edges are omitted.
  return (project.nodes || []).filter(node => found.has(node.id)).map(node => node.id);
}

export function fitRelationView(items, relations, viewport, options = {}) {
  const related = new Set(relations.relatedIds);
  const rects = (items || []).filter(item =>
    (item.memberIds || [item.id]).some(id => related.has(id)) &&
    [item.x, item.y, item.w, item.h].every(Number.isFinite) && item.w > 0 && item.h > 0);
  if (!relations.selectedIds.length || !rects.length || !(viewport.width > 0) || !(viewport.height > 0)) return null;
  const left = Math.min(...rects.map(rect => rect.x)), top = Math.min(...rects.map(rect => rect.y));
  const right = Math.max(...rects.map(rect => rect.x + rect.w)), bottom = Math.max(...rects.map(rect => rect.y + rect.h));
  const pad = { left: 40, right: 40, top: 80, bottom: 90, ...options.padding };
  const width = Math.max(1, viewport.width - pad.left - pad.right);
  const height = Math.max(1, viewport.height - pad.top - pad.bottom);
  const zoom = Math.max(options.minZoom ?? .2, Math.min(options.maxZoom ?? 1.15, width / (right - left), height / (bottom - top)));
  return {
    x: pad.left + (width - (right - left) * zoom) / 2 - left * zoom,
    y: pad.top + (height - (bottom - top) * zoom) / 2 - top * zoom,
    zoom
  };
}

// Plain value snapshot prevents subsequent pan/zoom from corrupting return view.
export function snapshotCanvasView(view) {
  if (!view || ![view.x, view.y, view.zoom].every(Number.isFinite) || view.zoom <= 0) return null;
  return { x: view.x, y: view.y, zoom: view.zoom };
}
