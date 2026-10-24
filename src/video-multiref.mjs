// Video node multi-reference model (DOM-free): ordered upstream media references,
// prompt tokens, provider limit checks and reordering.
import {normalizeReferenceLimits, referenceCounts, referenceLimitProblem} from '../providers/reference-policy.mjs';

export const VIDEO_REFERENCE_KINDS = Object.freeze(['image', 'video', 'audio']);
export const VIDEO_REFERENCE_KIND_NAMES = Object.freeze({image: '图片', video: '视频', audio: '音频'});
const TOKEN_NAMES = Object.freeze({image: 'Picture', video: 'Video', audio: 'Audio'});
const TOKEN_PATTERN = /<(Picture|Video|Audio) ([1-9][0-9]*)>/g;

function label(references) {
  const counts = {image: 0, video: 0, audio: 0};
  return references.map(reference => {
    const ordinal = ++counts[reference.kind];
    return {...reference, ordinal, alias: `<${TOKEN_NAMES[reference.kind]} ${ordinal}>`};
  });
}

/** All upstream image/video/audio nodes wired into a video node, in edge order. */
export function collectVideoReferences(project, videoNodeId) {
  const nodes = Array.isArray(project?.nodes) ? project.nodes : [];
  const edges = Array.isArray(project?.edges) ? project.edges : [];
  const seen = new Set();
  const references = [];
  for (const edge of edges) {
    if (!edge || edge.to !== videoNodeId || seen.has(edge.from)) continue;
    const node = nodes.find(item => item.id === edge.from);
    if (!node || !VIDEO_REFERENCE_KINDS.includes(node.type) || !node.src) continue;
    seen.add(node.id);
    references.push({nodeId: node.id, kind: node.type, title: node.title || '', src: node.src, fromSnapshot: false});
  }
  return label(references);
}

/** Restore a submitted reference snapshot when the source result no longer has wires. */
export function referencesFromSnapshot(project, snapshot = []) {
  const nodes = Array.isArray(project?.nodes) ? project.nodes : [];
  const references = [];
  const missing = [];
  const seen = new Set();
  for (const item of Array.isArray(snapshot) ? snapshot : []) {
    if (!item?.nodeId || !VIDEO_REFERENCE_KINDS.includes(item.kind) || seen.has(item.nodeId)) continue;
    const node = nodes.find(candidate => candidate.id === item.nodeId);
    if (!node || !node.src) {missing.push(item);continue;}
    seen.add(node.id);
    references.push({nodeId: node.id, kind: item.kind, title: node.title || '', src: node.src, fromSnapshot: true});
  }
  return {references: label(references), missing};
}

/** Group in display order while preserving the global edge order inside each type. */
export function groupVideoReferences(references = []) {
  return VIDEO_REFERENCE_KINDS.map(kind => ({
    kind,
    label: VIDEO_REFERENCE_KIND_NAMES[kind],
    references: references.filter(reference => reference.kind === kind),
  })).filter(group => group.references.length);
}

export function referenceTokens(references = []) {
  return references.map(reference => reference.alias);
}

export function validateVideoReferenceTokens(prompt, references = []) {
  const aliases = new Set(referenceTokens(references));
  const unknown = [];
  for (const match of String(prompt || '').matchAll(TOKEN_PATTERN)) {
    const alias = `<${match[1]} ${match[2]}>`;
    if (!aliases.has(alias)) unknown.push(alias);
  }
  return unknown.length ? `引用了已断开的参考 ${[...new Set(unknown)].join('、')}；请重新插入或移除该标签。` : '';
}

/** Insert `<Picture 1>` / `<Video 1>` / `<Audio 1>` at the caret with natural spacing. */
export function insertReferenceToken(prompt, caret, alias) {
  const value = String(prompt ?? '');
  const at = Number.isFinite(caret) ? Math.max(0, Math.min(value.length, caret)) : value.length;
  const before = value.slice(0, at), after = value.slice(at);
  const prefix = before && !/\s$/.test(before) ? ' ' : '';
  const suffix = after && !/^\s/.test(after) ? ' ' : '';
  return {value: before + prefix + alias + suffix + after, caret: at + prefix.length + alias.length};
}

/** Move a reference within its own media type by swapping the two wire positions. */
export function moveVideoReferenceEdge(project, videoNodeId, nodeId, direction) {
  const references = collectVideoReferences(project, videoNodeId);
  const current = references.find(reference => reference.nodeId === nodeId);
  if (!current) return null;
  const peers = references.filter(reference => reference.kind === current.kind);
  const peerIndex = peers.findIndex(reference => reference.nodeId === nodeId);
  const target = peers[peerIndex + direction];
  if (!target) return null;
  const edges = [...(project.edges || [])];
  const from = edges.findIndex(edge => edge.to === videoNodeId && edge.from === nodeId);
  const to = edges.findIndex(edge => edge.to === videoNodeId && edge.from === target.nodeId);
  if (from < 0 || to < 0) return null;
  [edges[from], edges[to]] = [edges[to], edges[from]];
  return edges;
}

export {normalizeReferenceLimits, referenceCounts, referenceLimitProblem};

/** Display state shared by the composer and canvas: counts, limits and warnings. */
export function videoReferenceSummary(references, limits) {
  const normalized = normalizeReferenceLimits(limits);
  return {
    counts: referenceCounts(references),
    limits: normalized,
    problem: referenceLimitProblem(references, normalized),
  };
}
