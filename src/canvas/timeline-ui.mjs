// 全屏时间线编辑器：状态、渲染、拖拽、导出。
import { normalizeTimelineItems, scanTimelineItems, timelineTotalDuration, formatTimelineTime, splitTimelineItem } from './timeline-model.mjs';
import { timelineAssetsHtml, timelineRulerHtml, timelineLanesHtml } from './timeline-view.mjs';
import { createTimelineDragController } from './timeline-editor.mjs';
import { exportTimelineRequest } from './generation-request.mjs';

export function createTimelineUI({
  app,
  getNodes,
  getNode,
  updateNode,
  render,
  toast = () => {},
  showContextMenu,
  pushHistory,
  addNodeToDoc,
  setSelection,
  nodeRect,
  requestExport = exportTimelineRequest,
  parentWindow = (typeof parent !== 'undefined' ? parent : null),
  embed = false,
} = {}) {
  let node = null;
  let draft = [];
  let selected = null;
  let filter = 'all';
  let playTimer = null;
  const $ = (selector) => app.querySelector(selector);

  const dragController = createTimelineDragController({
    getItem: (id) => draft.find((entry) => entry.id === id),
    onChange: () => renderRows(),
  });

  function assetNodes() {
    return (getNodes?.() || []).filter((item) => item.resources?.[0]?.url && ['image', 'video', 'audio'].includes(item.type));
  }

  function open(target) {
    try {
      node = target;
      const items = target.timelineItems;
      draft = Array.isArray(items) && items.length ? normalizeTimelineItems(items) : scanTimelineItems(getNodes?.() || []);
      selected = draft[0]?.id || null;
      renderRows();
      $('#timelineModal').classList.add('open');
      return true;
    } catch (error) {
      toast(error.message || String(error), true);
      return false;
    }
  }

  function addAsset(target) {
    if (!target) return;
    if (draft.some((item) => item.id === target.id)) { selected = target.id; renderRows(); return; }
    const end = draft.reduce((max, item) => Math.max(max, (Number(item.start) || 0) + (Number(item.duration) || 0)), 0);
    draft.push({
      id: target.id, label: target.title || target.type, type: target.type, start: end,
      duration: target.type === 'image' ? 3 : (Number(target.generation?.durationSeconds) || 5),
      sourceStart: 0, transition: 'none',
    });
    selected = target.id;
    renderRows();
  }

  function updatePreview(item) {
    const preview = $('#timelinePreview');
    const image = $('#timelinePreviewImage');
    const empty = $('#timelinePreviewEmpty');
    const url = getNode?.(item.id)?.resources?.[0]?.url;
    const isImage = item.type === 'image';
    preview.hidden = !url || isImage;
    image.hidden = !url || !isImage;
    empty.hidden = Boolean(url);
    if (url && image.dataset.clip !== item.id) {
      image.dataset.clip = item.id;
      if (isImage) image.src = url;
    }
    if (!isImage && url && preview.dataset.clip !== item.id) {
      preview.dataset.clip = item.id;
      preview.src = url;
      preview.load();
    }
    $('#timelinePlayhead').textContent = `${formatTimelineTime(item.start)} / ${formatTimelineTime((Number(item.start) || 0) + (Number(item.duration) || 0))}`;
  }

  function startDrag(event, item, mode) {
    event.preventDefault();
    event.stopPropagation();
    const lane = $('#timelineLanes');
    const width = lane.getBoundingClientRect().width || 1;
    selected = item.id;
    const started = dragController.start({ id: item.id, mode, startX: event.clientX, origin: item, pxPerSecond: width / timelineTotalDuration(draft) });
    if (!started) return;
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragUp, { once: true });
    updatePreview(item);
  }
  function onDragMove(event) { dragController.move(event.clientX); }
  function onDragUp() {
    document.removeEventListener('pointermove', onDragMove);
    dragController.end();
    renderRows();
  }

  function renderRows() {
    const total = timelineTotalDuration(draft);
    const assets = assetNodes().filter((item) => filter === 'all' || item.type === filter);
    const assetHost = $('#timelineAssets');
    assetHost.innerHTML = timelineAssetsHtml(assets);
    assetHost.querySelectorAll('[data-asset]').forEach((button) => button.addEventListener('click', () => addAsset(getNode?.(button.dataset.asset))));
    $('#timelineRuler').innerHTML = timelineRulerHtml(total);
    const host = $('#timelineLanes');
    host.innerHTML = timelineLanesHtml(draft, total, selected);
    const totalSeconds = draft.reduce((max, item) => Math.max(max, (Number(item.start) || 0) + (Number(item.duration) || 0)), 0);
    $('#timelineTotal').textContent = `${draft.length} 个片段 · ${totalSeconds.toFixed(1)}s`;
    host.querySelectorAll('.cv-timeline-add').forEach((button) => button.addEventListener('click', () => {
      const first = assetNodes()[0];
      if (first) addAsset(first);
    }));
    host.querySelectorAll('.cv-tl-clip').forEach((clip) => {
      const item = draft.find((entry) => entry.id === clip.dataset.item);
      if (!item) return;
      clip.addEventListener('click', (event) => {
        event.stopPropagation();
        selected = item.id;
        updatePreview(item);
        renderRows();
      });
      clip.addEventListener('pointerdown', (event) => {
        if (event.target.closest('.handle')) return;
        startDrag(event, item, 'move');
      });
      clip.querySelectorAll('.handle').forEach((handle) => {
        handle.addEventListener('pointerdown', (event) => startDrag(event, item, handle.dataset.edge === 'start' ? 'trim-start' : 'trim-end'));
      });
      clip.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        showContextMenu?.([
          [item.transition === 'fade' ? '✓ 淡入淡出' : '淡入淡出', () => { item.transition = item.transition === 'fade' ? 'none' : 'fade'; renderRows(); }],
          [item.transition === 'black' ? '✓ 黑场' : '黑场', () => { item.transition = item.transition === 'black' ? 'none' : 'black'; renderRows(); }],
          ['无转场', () => { item.transition = 'none'; renderRows(); }],
          ['移除片段', () => { draft = draft.filter((entry) => entry.id !== item.id); selected = draft[0]?.id || null; renderRows(); }],
        ], event.clientX, event.clientY);
      });
    });
    if (selected) {
      const item = draft.find((entry) => entry.id === selected);
      if (item) updatePreview(item);
    }
  }

  function split() {
    const item = draft.find((entry) => entry.id === selected);
    if (!item) { toast('先选一个片段'); return false; }
    const parts = splitTimelineItem(item);
    if (!parts) return false;
    const index = draft.indexOf(item);
    draft.splice(index, 1, ...parts);
    selected = parts[0].id;
    renderRows();
    return true;
  }

  function removeSelected() {
    if (!selected) { toast('先选一个片段'); return false; }
    draft = draft.filter((entry) => entry.id !== selected);
    selected = draft[0]?.id || null;
    renderRows();
    return true;
  }

  function play() {
    const item = draft.find((entry) => entry.id === selected);
    if (!item) { toast('先选一个片段'); return false; }
    const preview = $('#timelinePreview');
    if (!preview.src) { toast('这个片段还没有素材'); return false; }
    const button = $('#timelinePlay');
    if (!preview.paused) { preview.pause(); button.textContent = '▶'; return true; }
    try {
      if (Math.abs(preview.currentTime - (Number(item.sourceStart) || 0)) > 0.2) preview.currentTime = Number(item.sourceStart) || 0;
      preview.play();
      button.textContent = '❚❚';
      window.clearTimeout(playTimer);
      playTimer = window.setTimeout(() => { preview.pause(); button.textContent = '▶'; }, Math.max(300, (Number(item.duration) || 1) * 1000));
      return true;
    } catch {
      toast('预览失败');
      return false;
    }
  }

  function openExportMenu() {
    const button = $('#timelineExport');
    const rect = button.getBoundingClientRect();
    showContextMenu?.([
      ['横屏 1080p（1920×1080）', () => exportMovie('landscape')],
      ['竖屏 1080p（1080×1920）', () => exportMovie('portrait')],
      ['草稿 720p（1280×720）', () => exportMovie('draft')],
    ], rect.left, rect.bottom + 6);
  }

  async function exportMovie(preset = 'landscape') {
    const items = draft.filter((item) => item.type === 'video' || item.type === 'image').map((item) => ({
      type: item.type,
      videoUrl: item.type === 'video' ? getNode?.(item.id)?.resources?.[0]?.url : undefined,
      imageUrl: item.type === 'image' ? getNode?.(item.id)?.resources?.[0]?.url : undefined,
      sourceStart: Number(item.sourceStart) || 0,
      duration: Number(item.duration) || (item.type === 'image' ? 3 : 5),
      transition: item.transition || 'none',
    })).filter((item) => item.videoUrl || item.imageUrl);
    if (!items.length) { toast('时间线里没有可导出的片段'); return false; }
    const button = $('#timelineExport');
    button.disabled = true;
    button.textContent = '导出中…';
    try {
      const data = await requestExport({ items, preset });
      showExportChoice(data);
      return true;
    } catch (error) {
      toast(error.message || String(error), true);
      return false;
    } finally {
      button.disabled = false;
      button.textContent = '导出 MP4';
    }
  }

  function showExportChoice(data) {
    const button = $('#timelineExport');
    const rect = button.getBoundingClientRect();
    showContextMenu?.([
      ['加入画布（生成视频节点）', () => addExportedVideoToCanvas(data)],
      ['导出到文件夹…', () => saveExportedVideoToFolder(data)],
      ['直接下载', () => { const link = document.createElement('a'); link.href = data.url; link.download = data.filename || 'timeline.mp4'; link.click(); }],
    ], rect.left, rect.bottom + 6);
  }

  function addExportedVideoToCanvas(data) {
    save();
    $('#timelineModal').classList.remove('open');
    if (typeof document !== 'undefined') document.body.classList.remove('timeline-open');
    const rect = node ? nodeRect(node) : { x: 0, y: 0, width: 600, height: 320 };
    const addedId = addNodeToDoc?.({
      type: 'video', title: '时间线成片',
      layout: { x: Math.round(rect.x + rect.width + 48), y: Math.round(rect.y), width: 569, height: 320 },
      resources: [{ id: data.filename, type: 'video', url: data.url, source: 'timeline' }],
      generation: { mode: 't2v', prompt: '时间线成片', model: 'h3', ratio: '16:9', resolution: '480P', durationSeconds: 5, outputCount: 1 },
    });
    setSelection?.(addedId);
    render?.();
    toast('时间线成片已加入画布');
  }

  function saveExportedVideoToFolder(data) {
    if (embed) {
      try {
        parentWindow?.postMessage({ type: 'canvas-save-file', url: data.url, filename: data.filename || 'timeline.mp4' }, location.origin);
        toast('请选择保存文件夹');
        return;
      } catch { /* fall through */ }
    }
    const link = document.createElement('a');
    link.href = data.url;
    link.download = data.filename || 'timeline.mp4';
    link.click();
  }

  function close() {
    save();
    $('#timelineModal').classList.remove('open');
    if (typeof document !== 'undefined') document.body.classList.remove('timeline-open');
  }

  function save() {
    if (!node) return false;
    updateNode?.(node.id, { timelineItems: draft, status: 'success' });
    $('#timelineModal').classList.remove('open');
    if (typeof document !== 'undefined') document.body.classList.remove('timeline-open');
    render?.();
    toast('时间线已保存');
    return true;
  }

  function setFilter(next) { filter = next; renderRows(); }

  return { open, close, save, renderRows, setFilter, split, removeSelected, play, openExportMenu, exportMovie, addAsset };
}
