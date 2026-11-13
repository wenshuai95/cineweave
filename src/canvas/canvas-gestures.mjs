// 画布指针手势：节点拖拽、框选、平移、缩放、连线。
import { applyNodeSelection, marqueeWorldBox, selectionAfterMarquee } from './selection-model.mjs';
import { findTimelineDropTarget, appendTimelineItem } from './timeline-model.mjs';

export function createCanvasGestures({
  stage,
  layer,
  getDoc,
  setDoc,
  getSelection,
  setSelection,
  getSelectedEdge,
  setSelectedEdge,
  getSpaceHeld,
  render,
  renderEdges,
  updateSelectionUi,
  applyViewport,
  persist,
  pushHistory,
  toast = () => {},
  nodeRect,
  screenToWorld,
  zoomAt,
  nodesInRect,
  groupOf,
  findNode,
  connect,
  addReference,
  moveNode,
  updateNode,
  findTimelineDropTarget: findTarget = findTimelineDropTarget,
  appendTimelineItem: appendItem = appendTimelineItem,
  snapToGuides,
  drawGuides,
  clearGuides,
  includeReferences = true,
} = {}) {
  let drag = null;
  let tempLink = null;
  let dragPos = null;
  let marquee = null;
  let dragPositions = null;

  function startLink(fromId, event) {
    const doc = getDoc();
    const node = findNode(doc, fromId);
    const rect = nodeRect(node);
    tempLink = {
      from: fromId,
      to: screenToWorld({ x: event.clientX - stage.getBoundingClientRect().left, y: event.clientY - stage.getBoundingClientRect().top }, doc.viewport),
      pointerId: event.pointerId,
    };
    drag = { kind: 'link' };
    renderEdges();
  }

  function onNodePointerDown(event) {
    if (event.button !== 0) return;
    const nodeEl = event.currentTarget;
    const nodeId = nodeEl.dataset.id;
    const conn = event.target.closest('.cv-conn');
    event.stopPropagation();
    if (conn?.dataset.conn === 'out') { startLink(nodeId, event); return; }
    if (conn?.dataset.conn === 'in') return;
    const doc = getDoc();
    const group = groupOf(doc, nodeId);
    setSelection(applyNodeSelection(getSelection(), nodeId, { shift: event.shiftKey, groupIds: group ? group.nodeIds : [] }));
    updateSelectionUi();
    layer.querySelectorAll('.cv-node').forEach((el) => el.classList.toggle('selected', getSelection().has(el.dataset.id)));
    const node = findNode(doc, nodeId);
    const rect = nodeRect(node);
    if (!event.shiftKey && getSelection().has(nodeId) && getSelection().size > 1) {
      dragPositions = new Map();
      for (const id of getSelection()) {
        const item = findNode(doc, id);
        if (!item) continue;
        const r = nodeRect(item);
        dragPositions.set(id, { x: r.x, y: r.y });
      }
      drag = { kind: 'nodes', ids: [...getSelection()], startX: event.clientX, startY: event.clientY, moved: false };
    } else {
      drag = { kind: 'node', id: nodeId, startX: event.clientX, startY: event.clientY, originX: rect.x, originY: rect.y, moved: false };
      dragPos = { id: nodeId, x: rect.x, y: rect.y };
    }
    try { nodeEl.setPointerCapture?.(event.pointerId); } catch { /* 合成事件无活动指针 */ }
    stage.classList.add('panning');
  }

  function onPointerDown(event) {
    if (event.button !== 0 && event.button !== 1) return;
    const doc = getDoc();
    const edgeEl = event.target.closest('[data-edge]');
    if (edgeEl && event.button === 0) {
      setSelectedEdge(edgeEl.dataset.edge);
      setSelection(new Set());
      updateSelectionUi();
      renderEdges();
      return;
    }
    if (event.target.closest('.cv-node')) return;
    setSelectedEdge(null);
    if (event.button === 1 || getSpaceHeld()) {
      drag = { kind: 'pan', startX: event.clientX, startY: event.clientY, originX: doc.viewport.x, originY: doc.viewport.y };
      stage.classList.add('panning');
      try { stage.setPointerCapture?.(event.pointerId); } catch { /* 合成事件无活动指针 */ }
      setSelection(new Set());
      updateSelectionUi();
      layer.querySelectorAll('.cv-node').forEach((el) => el.classList.remove('selected'));
      return;
    }
    drag = { kind: 'marquee', startX: event.clientX, startY: event.clientY, additive: event.shiftKey };
    if (!event.shiftKey) {
      setSelection(new Set());
      updateSelectionUi();
      layer.querySelectorAll('.cv-node').forEach((el) => el.classList.remove('selected'));
    }
    marquee = document.createElement('div');
    marquee.className = 'cv-marquee';
    document.body.appendChild(marquee);
    positionMarquee();
    try { stage.setPointerCapture?.(event.pointerId); } catch { /* 合成事件无活动指针 */ }
  }

  function positionMarquee() {
    if (!marquee || drag?.kind !== 'marquee') return;
    const x = Math.min(drag.startX, drag.currentX ?? drag.startX);
    const y = Math.min(drag.startY, drag.currentY ?? drag.startY);
    const w = Math.abs((drag.currentX ?? drag.startX) - drag.startX);
    const h = Math.abs((drag.currentY ?? drag.startY) - drag.startY);
    Object.assign(marquee.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, display: w > 2 && h > 2 ? 'block' : 'none' });
  }

  function onPointerMove(event) {
    if (!drag) return;
    const doc = getDoc();
    const rect = stage.getBoundingClientRect();
    if (drag.kind === 'pan') {
      setDoc({ ...doc, viewport: { x: drag.originX + (event.clientX - drag.startX), y: drag.originY + (event.clientY - drag.startY), zoom: doc.viewport.zoom } });
      applyViewport();
      return;
    }
    if (drag.kind === 'marquee') {
      drag.currentX = event.clientX;
      drag.currentY = event.clientY;
      positionMarquee();
      return;
    }
    if (drag.kind === 'nodes') {
      const dx = (event.clientX - drag.startX) / doc.viewport.zoom;
      const dy = (event.clientY - drag.startY) / doc.viewport.zoom;
      drag.moved = true;
      const starts = [...drag.ids].map((id) => dragPositions?.get(id)).filter(Boolean);
      if (!starts.length) return;
      const minX = Math.min(...starts.map((p) => p.x));
      const minY = Math.min(...starts.map((p) => p.y));
      const width = Math.max(...drag.ids.map((id) => nodeRect(findNode(doc, id)).width));
      const height = Math.max(...drag.ids.map((id) => nodeRect(findNode(doc, id)).height));
      const snapped = snapToGuides(Math.round((minX + dx) / 8) * 8, Math.round((minY + dy) / 8) * 8, width, height, new Set(drag.ids));
      const offsetX = snapped.x - minX;
      const offsetY = snapped.y - minY;
      for (const id of drag.ids) {
        const start = dragPositions?.get(id);
        if (!start) continue;
        const x = Math.round((start.x + offsetX) / 8) * 8;
        const y = Math.round((start.y + offsetY) / 8) * 8;
        dragPositions.set(id, { x, y });
        const el = layer.querySelector(`.cv-node[data-id="${id}"]`);
        if (el) { el.style.left = `${x}px`; el.style.top = `${y}px`; }
      }
      drawGuides(snapped.lines);
      renderEdges();
      return;
    }
    if (drag.kind === 'node') {
      const dx = (event.clientX - drag.startX) / doc.viewport.zoom;
      const dy = (event.clientY - drag.startY) / doc.viewport.zoom;
      const node = findNode(doc, drag.id);
      if (!node) return;
      const rawX = Math.round((drag.originX + dx) / 8) * 8;
      const rawY = Math.round((drag.originY + dy) / 8) * 8;
      const snapped = snapToGuides(rawX, rawY, node.layout.width, node.layout.height, new Set([drag.id]));
      dragPos = { id: drag.id, x: snapped.x, y: snapped.y };
      drag.moved = true;
      const el = layer.querySelector(`.cv-node[data-id="${drag.id}"]`);
      if (el) { el.style.left = `${snapped.x}px`; el.style.top = `${snapped.y}px`; }
      drawGuides(snapped.lines);
      renderEdges();
      return;
    }
    if (drag.kind === 'link' && tempLink) {
      tempLink.to = screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, doc.viewport);
      renderEdges();
    }
  }

  function onPointerUp(event) {
    if (!drag) return;
    clearGuides();
    const finished = drag;
    drag = null;
    stage.classList.remove('panning');
    let doc = getDoc();
    if (finished.kind === 'marquee') {
      const currentX = finished.currentX ?? finished.startX;
      const currentY = finished.currentY ?? finished.startY;
      marquee?.remove();
      marquee = null;
      const rect = stage.getBoundingClientRect();
      const box = marqueeWorldBox({ startX: finished.startX, startY: finished.startY, currentX, currentY, stageLeft: rect.left, stageTop: rect.top, viewport: doc.viewport });
      if (box.width > 4 || box.height > 4) {
        const hit = nodesInRect(doc.nodes, box).map((node) => node.id);
        setSelection(selectionAfterMarquee(getSelection(), hit, finished.additive));
        updateSelectionUi();
        layer.querySelectorAll('.cv-node').forEach((el) => el.classList.toggle('selected', getSelection().has(el.dataset.id)));
      }
      renderEdges();
      return;
    }
    if (finished.kind === 'nodes' && dragPositions) {
      pushHistory();
      for (const id of finished.ids) {
        const pos = dragPositions.get(id);
        if (pos) doc = moveNode(doc, id, pos.x, pos.y);
      }
      dragPositions = null;
      setDoc(doc);
      render();
      return;
    }
    if (finished.kind === 'node' && dragPos) {
      const { id, x, y } = dragPos;
      dragPos = null;
      pushHistory();
      doc = moveNode(doc, id, x, y);
      const dragged = findNode(doc, id);
      if (dragged && (dragged.type === 'video' || dragged.type === 'audio')) {
        const draggedRect = nodeRect(dragged);
        const target = findTarget(doc.nodes, draggedRect, dragged.id, nodeRect);
        if (target) {
          const items = appendItem(target.timelineItems || [], dragged);
          if (items !== target.timelineItems) {
            doc = updateNode(doc, target.id, { timelineItems: items });
            setDoc(doc);
            toast('已加入时间线');
          }
        }
      }
      setDoc(doc);
      render();
      return;
    }
    if (finished.kind === 'link' && tempLink) {
      const fromId = tempLink.from;
      tempLink = null;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cv-conn.left');
      const toId = target?.dataset.id;
      if (toId && toId !== fromId) {
        try {
          const fromNode = findNode(doc, fromId);
          const targetNode = findNode(doc, toId);
          if (targetNode?.generation) {
            let mode = targetNode.generation.mode;
            if (targetNode.type === 'video') {
              mode = fromNode?.type === 'image' ? 'i2v' : fromNode?.type === 'video' || fromNode?.type === 'audio' ? 'm2v' : mode;
            } else if (targetNode.type === 'image' && fromNode?.type === 'image') {
              mode = 'i2i';
            }
            if (mode !== targetNode.generation.mode) doc = updateNode(doc, toId, { generation: { mode } });
          }
          pushHistory();
          doc = connect(doc, fromId, toId).doc;
          if (includeReferences && fromNode) doc = addReference(doc, toId, { id: fromId, type: fromNode.type });
          setDoc(doc);
          toast('已连接');
        } catch (error) {
          toast(error.message, true);
        }
        render();
        return;
      }
      renderEdges();
      return;
    }
    if (finished.kind === 'pan') {
      persist?.(false);
      return;
    }
    renderEdges();
  }

  function onWheel(event) {
    event.preventDefault();
    const doc = getDoc();
    const rect = stage.getBoundingClientRect();
    const factor = Math.exp(-event.deltaY * 0.0012);
    setDoc({ ...doc, viewport: zoomAt(doc.viewport, { x: event.clientX - rect.left, y: event.clientY - rect.top }, doc.viewport.zoom * factor) });
    applyViewport();
    persist?.(false);
  }

  return {
    onNodePointerDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    getDragPositions: () => dragPositions,
    getTempLink: () => tempLink,
    getDragPos: () => dragPos,
  };
}
