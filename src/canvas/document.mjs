// 画布文档模型：节点、连线、视口。
// 与即梦画布同构（node + edge + layout + generation + resources），纯函数、可单测。
// 渲染层与生成层都只通过这里改文档，不直接拼对象。

export const CANVAS_VERSION = 1;
export const MAX_NODES = 300;
export const MAX_EDGES = 600;

export const NODE_TYPES = ['text', 'image', 'video', 'audio', 'element', 'timeline', 'stage'];
export const GENERATION_MODES = ['t2i', 'i2i', 't2v', 'i2v', 'm2v', 'tts', 'music', 'sfx'];
export const NODE_STATUSES = ['empty', 'running', 'success', 'partial_success', 'failed', 'canceled'];

const MODE_INPUTS = {
  t2i: [],
  i2i: ['image'],
  t2v: [],
  i2v: ['image'],
  m2v: ['image', 'video', 'audio'],
  tts: ['audio'],
  music: ['audio'],
  sfx: ['audio'],
};

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

export function newId(prefix = 'node') {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

export function createCanvasDocument(overrides = {}) {
  return {
    version: CANVAS_VERSION,
    viewport: { x: 0, y: 0, zoom: 1, ...(overrides.viewport || {}) },
    nodes: [],
    edges: [],
    groups: [],
  };
}

export function allowedInputTypes(mode) {
  return MODE_INPUTS[mode] ? [...MODE_INPUTS[mode]] : [];
}

export function createNode({
  id, type, title = '', layout = {}, generation = null, text = '', status = 'empty', resources = [], tags = [], versions = [],
} = {}) {
  if (!NODE_TYPES.includes(type)) throw canvasError('CANVAS_NODE_TYPE', `unknown node type: ${type}`);
  const nodeId = id || newId();
  if (!ID_RE.test(nodeId)) throw canvasError('CANVAS_NODE_ID', `invalid node id: ${nodeId}`);
  const node = {
    id: nodeId,
    type,
    title: String(title),
    status: NODE_STATUSES.includes(status) ? status : 'empty',
    tags: Array.isArray(tags) ? tags : [],
    layout: {
      x: finite(layout.x, 0),
      y: finite(layout.y, 0),
      width: positive(layout.width, type === 'audio' ? 320 : 569),
      height: positive(layout.height, type === 'audio' ? 320 : 320),
    },
    resources: Array.isArray(resources) ? resources : [],
    versions: Array.isArray(versions) ? versions : [],
  };
  if (type === 'text') node.text = String(text);
  if (generation) {
    node.generation = normalizeGeneration(generation);
    // 默认后端按节点类型：图像走 ComfyUI，视频/音频走即梦 CLI；显式指定 backend 时尊重调用方。
    if (!generation.backend) {
      const remote = type === 'video' || type === 'audio';
      node.generation.backend = { provider: remote ? 'dreamina' : 'comfyui', instance: remote ? 'dreamina' : 'local' };
    }
  }
  return node;
}

export function normalizeGeneration(generation = {}) {
  const mode = GENERATION_MODES.includes(generation.mode) ? generation.mode : null;
  if (!mode) throw canvasError('CANVAS_GENERATION_MODE', `unknown generation mode: ${generation.mode}`);
  return {
    backend: generation.backend || { provider: 'comfyui', instance: 'local' },
    mode,
    prompt: String(generation.prompt || ''),
    model: String(generation.model || ''),
    ratio: String(generation.ratio || '16:9'),
    resolution: String(generation.resolution || ''),
    durationSeconds: Number.isFinite(generation.durationSeconds) ? generation.durationSeconds : null,
    outputCount: Number.isFinite(generation.outputCount) ? generation.outputCount : 1,
    references: Array.isArray(generation.references) ? generation.references.map((ref) => ({ ...ref })) : [],
    voiceName: String(generation.voiceName || ''),
    voiceId: String(generation.voiceId || ''),
    h3Size: String(generation.h3Size || ''),
    imageWorkflow: String(generation.imageWorkflow || ''),
    refMode: String(generation.refMode || ''),
    camera: generation.camera && typeof generation.camera === 'object' ? { ...generation.camera } : null,
    palette: String(generation.palette || ''),
    style: String(generation.style || ''),
  };
}

export function addNode(doc, nodeInput) {
  const node = createNode(nodeInput);
  if (doc.nodes.some((item) => item.id === node.id)) {
    throw canvasError('CANVAS_NODE_DUPLICATE', `node already exists: ${node.id}`);
  }
  if (doc.nodes.length >= MAX_NODES) throw canvasError('CANVAS_TOO_MANY_NODES', 'node limit reached');
  return { ...doc, nodes: [...doc.nodes, node] };
}

export function removeNode(doc, nodeId) {
  const nodes = doc.nodes.filter((node) => node.id !== nodeId);
  if (nodes.length === doc.nodes.length) return doc;
  return {
    ...doc,
    nodes,
    edges: doc.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
  };
}

export function updateNode(doc, nodeId, patch = {}) {
  let found = false;
  const nodes = doc.nodes.map((node) => {
    if (node.id !== nodeId) return node;
    found = true;
    const next = { ...node, ...patch };
    if (patch.layout) next.layout = { ...node.layout, ...patch.layout };
    if (patch.generation) next.generation = normalizeGeneration({ ...node.generation, ...patch.generation });
    if (!NODE_STATUSES.includes(next.status)) next.status = node.status;
    return next;
  });
  if (!found) throw canvasError('CANVAS_NODE_MISSING', `node not found: ${nodeId}`);
  return { ...doc, nodes };
}

export function moveNode(doc, nodeId, x, y) {
  return updateNode(doc, nodeId, { layout: { x: finite(x, 0), y: finite(y, 0) } });
}

export function findNode(doc, nodeId) {
  return doc.nodes.find((node) => node.id === nodeId) || null;
}

export function addGroup(doc, nodeIds, name = '分组') {
  const next = structuredClone(doc);
  const ids = [...new Set((nodeIds || []).filter((id) => next.nodes.some((node) => node.id === id)))];
  if (!ids.length) return next;
  const group = { id: newId('group'), name, nodeIds: ids };
  next.groups = (next.groups || []).filter((item) => !item.nodeIds.some((id) => ids.includes(id)));
  next.groups.push(group);
  return next;
}

export function removeGroup(doc, groupId) {
  const next = structuredClone(doc);
  next.groups = (next.groups || []).filter((group) => group.id !== groupId);
  return next;
}

export function groupOf(doc, nodeId) {
  return (doc.groups || []).find((group) => group.nodeIds.includes(nodeId)) || null;
}

export function connect(doc, fromId, toId, slot) {
  const from = findNode(doc, fromId);
  const to = findNode(doc, toId);
  if (!from || !to) throw canvasError('CANVAS_EDGE_MISSING_NODE', 'from or to node missing');
  if (fromId === toId) throw canvasError('CANVAS_EDGE_SELF', 'a node cannot connect to itself');
  const inputs = allowedInputTypes(to.generation?.mode);
  if (!inputs.includes(from.type)) {
    throw canvasError('CANVAS_EDGE_TYPE', `${from.type} is not an input of ${to.generation?.mode || to.type}`);
  }
  if (doc.edges.some((edge) => edge.from === fromId && edge.to === toId)) {
    throw canvasError('CANVAS_EDGE_DUPLICATE', 'edge already exists');
  }
  if (doc.edges.length >= MAX_EDGES) throw canvasError('CANVAS_TOO_MANY_EDGES', 'edge limit reached');
  if (createsCycle(doc, fromId, toId)) throw canvasError('CANVAS_EDGE_CYCLE', 'connection would create a cycle');
  const edge = { id: newId('edge'), from: fromId, to: toId, slot: slot || inputs.find((type) => type === from.type) || from.type };
  return { doc: { ...doc, edges: [...doc.edges, edge] }, edge };
}

export function addReference(doc, targetId, reference) {
  const target = findNode(doc, targetId);
  if (!target?.generation) throw canvasError('CANVAS_REFERENCE_TARGET', 'target node has no generation config');
  const refs = target.generation.references || [];
  if (refs.some((ref) => ref.id === reference.id)) return doc;
  const next = { kind: reference.kind || 'node', id: reference.id, type: reference.type, index: refs.length, role: String(reference.role || '通用') };
  return updateNode(doc, targetId, { generation: { references: [...refs, next] } });
}

export function removeReference(doc, targetId, referenceId) {
  const target = findNode(doc, targetId);
  if (!target?.generation) return doc;
  const refs = (target.generation.references || []).filter((ref) => ref.id !== referenceId);
  const reindexed = refs.map((ref, index) => ({ ...ref, index }));
  return updateNode(doc, targetId, { generation: { references: reindexed } });
}

export function referenceLabel(index, type) {
  const names = { image: 'Picture', video: 'Video', audio: 'Audio', text: 'Text', stage: 'Stage' };
  return `<${names[type] || 'Ref'} ${index + 1}>`;
}

export function disconnect(doc, edgeId) {
  const edges = doc.edges.filter((edge) => edge.id !== edgeId);
  if (edges.length === doc.edges.length) return doc;
  return { ...doc, edges };
}

export function upstreamOf(doc, nodeId) {
  return doc.edges.filter((edge) => edge.to === nodeId).map((edge) => edge.from);
}

export function downstreamOf(doc, nodeId) {
  return doc.edges.filter((edge) => edge.from === nodeId).map((edge) => edge.to);
}

export function setViewport(doc, viewport) {
  return {
    ...doc,
    viewport: {
      x: finite(viewport.x, 0),
      y: finite(viewport.y, 0),
      zoom: Math.min(4, Math.max(0.1, finite(viewport.zoom, 1))),
    },
  };
}

export function validateCanvasDocument(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object') return ['document is not an object'];
  if (doc.version !== CANVAS_VERSION) errors.push(`unsupported version: ${doc.version}`);
  if (!Array.isArray(doc.nodes) || doc.nodes.length > MAX_NODES) errors.push('nodes invalid or too many');
  if (!Array.isArray(doc.edges) || doc.edges.length > MAX_EDGES) errors.push('edges invalid or too many');
  const ids = new Set();
  for (const node of doc.nodes || []) {
    if (!ID_RE.test(node.id || '')) errors.push(`bad node id: ${node.id}`);
    if (ids.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    ids.add(node.id);
    if (!NODE_TYPES.includes(node.type)) errors.push(`bad node type: ${node.type}`);
    for (const key of ['x', 'y', 'width', 'height']) {
      if (!Number.isFinite(node.layout?.[key])) errors.push(`bad layout.${key} on ${node.id}`);
    }
  }
  for (const edge of doc.edges || []) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) errors.push(`edge references missing node: ${edge.id}`);
    if (edge.from === edge.to) errors.push(`self edge: ${edge.id}`);
  }
  if (doc.groups != null && !Array.isArray(doc.groups)) errors.push('groups invalid');
  for (const group of doc.groups || []) {
    if (!ID_RE.test(group.id || '')) errors.push(`bad group id: ${group.id}`);
    if (!Array.isArray(group.nodeIds) || !group.nodeIds.length) errors.push(`bad group nodes: ${group.id}`);
    for (const id of group.nodeIds || []) if (!ids.has(id)) errors.push(`group references missing node: ${id}`);
  }
  return errors;
}

export function serializeCanvas(doc) {
  const errors = validateCanvasDocument(doc);
  if (errors.length) throw canvasError('CANVAS_INVALID', errors.join('; '));
  return JSON.stringify(doc);
}

export function parseCanvas(raw) {
  const doc = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const errors = validateCanvasDocument(doc);
  if (errors.length) throw canvasError('CANVAS_INVALID', errors.join('; '));
  return doc;
}

function createsCycle(doc, fromId, toId) {
  const adjacency = new Map();
  for (const edge of doc.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }
  const stack = [toId];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (current === fromId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of adjacency.get(current) || []) stack.push(next);
  }
  return false;
}

function canvasError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function finite(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
