// 生成画布 · 图数据层：从工程派生素材/生成节点，维护连线与本地布局。

export const NODE_SIZE = {asset: [190, 150], shot: [220, 116], previz: [210, 110], generate: [270, 230], result: [220, 170]};

const DEFAULT_EDGES = (shotId, assetIds, hasPreviz) => {
  const edges = [{from: 'shot:' + shotId, to: 'gen:' + shotId, kind: 'video'}];
  for (const assetId of assetIds) edges.push({from: 'asset:' + assetId, to: 'gen:' + shotId, kind: 'image'});
  if (hasPreviz) edges.push({from: 'previz', to: 'gen:' + shotId, kind: 'video'});
  return edges;
};

/** 工程 + 资产 + 分镜 → 节点与连线；saved 提供用户拖动后的位置与自定义连线。 */
export function buildGraph(project, { assets = [], labels = {} } = {}, saved = null) {
  const nodes = [];
  const shots = [...(project.shots || [])].sort((a, b) => a.start - b.start);
  const assetNodes = [];
  for (const [index, asset] of assets.entries()) {
    const id = 'asset:' + asset.id;
    assetNodes.push({asset, id});
    nodes.push({
      id, kind: 'asset', refId: asset.id,
      title: asset.name, subtitle: labels[asset.kind] || asset.kind,
      x: 40, y: 240 + index * 170, w: NODE_SIZE.asset[0], h: NODE_SIZE.asset[1],
      imageVersion: (asset.imageVersions || []).find(v => v.id === asset.selectedImageId) || (asset.imageVersions || [])[0],
    });
  }
  const shotNodes = [];
  for (const [index, shot] of shots.entries()) {
    const shotId = 'shot:' + shot.id;
    shotNodes.push({shot, id: shotId});
    nodes.push({
      id: shotId, kind: 'shot', refId: shot.id,
      title: '镜 ' + String(index + 1).padStart(2, '0'),
      subtitle: (shot.end - shot.start).toFixed(1) + 's',
      x: 300, y: 70 + index * 190, w: NODE_SIZE.shot[0], h: NODE_SIZE.shot[1],
    });
    nodes.push({
      id: 'gen:' + shot.id, kind: 'generate', refId: shot.id,
      title: '视频生成', subtitle: labels.model || '选择模型',
      x: 580, y: 70 + index * 190, w: NODE_SIZE.generate[0], h: NODE_SIZE.generate[1],
    });
    const resultId = shot.render?.videoMediaId;
    if (resultId) {
      nodes.push({
        id: 'result:' + shot.id, kind: 'result', refId: shot.id,
        title: '已生成', subtitle: '可预览 / 采用',
        x: 900, y: 70 + index * 190, w: NODE_SIZE.result[0], h: NODE_SIZE.result[1],
      });
    }
  }
  const hasPreviz = shots.length > 0 && project.objects?.some(object => object.type === 'camera');
  if (hasPreviz) {
    nodes.push({
      id: 'previz', kind: 'previz', refId: 'previz',
      title: '预演片段', subtitle: '来自预演页',
      x: 40, y: 40, w: NODE_SIZE.previz[0], h: NODE_SIZE.previz[1],
    });
  }
  const shotAssetIds = new Map();
  for (const asset of assets) for (const shotId of asset.shotIds || []) shotAssetIds.set(shotId, [...(shotAssetIds.get(shotId) || []), asset.id]);
  let edges = [];
  for (const shot of shots) edges.push(...DEFAULT_EDGES(shot.id, shotAssetIds.get(shot.id) || [], hasPreviz));
  if (saved && typeof saved === 'object') {
    if (saved.nodes && typeof saved.nodes === 'object') {
      for (const node of nodes) {
        const position = saved.nodes[node.id];
        if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) { node.x = position.x; node.y = position.y; }
      }
    }
    if (Array.isArray(saved.edges)) edges = normalizeEdges(saved.edges);
  }
  const byId = new Map(nodes.map(node => [node.id, node]));
  edges = edges.filter(edge => byId.has(edge.from) && byId.has(edge.to));
  return {nodes, edges};
}

export function normalizeEdges(raw) {
  const edges = [], seen = new Set();
  for (const edge of Array.isArray(raw) ? raw : []) {
    if (!edge || typeof edge.from !== 'string' || typeof edge.to !== 'string') continue;
    if (!['image', 'video', 'text'].includes(edge.kind)) continue;
    const key = edge.from + '>' + edge.to;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({from: edge.from, to: edge.to, kind: edge.kind});
    if (edges.length >= 400) break;
  }
  return edges;
}

export function edgeKey(edge) { return edge.from + '>' + edge.to; }

export function canConnect(fromNode, toNode, edges = []) {
  if (!fromNode || !toNode) return {ok: false, reason: '节点不存在'};
  if (fromNode.id === toNode.id) return {ok: false, reason: '不能连到自己'};
  if (toNode.kind !== 'generate') return {ok: false, reason: '只能连到生成节点'};
  if (!['asset', 'shot', 'previz', 'result'].includes(fromNode.kind)) return {ok: false, reason: '该节点不能作为输入'};
  if (edges.some(edge => edge.from === fromNode.id && edge.to === toNode.id)) return {ok: false, reason: '已经连过了'};
  const kind = fromNode.kind === 'asset' ? 'image' : 'video';
  return {ok: true, kind};
}

export function addEdge(edges, fromNode, toNode) {
  const check = canConnect(fromNode, toNode, edges);
  if (!check.ok) return {edges, error: check.reason};
  return {edges: [...edges, {from: fromNode.id, to: toNode.id, kind: check.kind}]};
}

export function removeEdge(edges, key) {
  return edges.filter(edge => edgeKey(edge) !== key);
}

/** 某个生成节点的输入：图片/视频素材（按连线类型）。 */
export function inputsFor(node, nodes, edges) {
  const byId = new Map(nodes.map(item => [item.id, item]));
  return edges.filter(edge => edge.to === node.id).map(edge => byId.get(edge.from)).filter(Boolean);
}

export function sanitizeSavedGraph(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nodes = {};
  if (raw.nodes && typeof raw.nodes === 'object') {
    for (const [id, position] of Object.entries(raw.nodes)) {
      if (typeof id !== 'string' || !position) continue;
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) continue;
      nodes[id] = {x: position.x, y: position.y};
    }
  }
  return {nodes, edges: Array.isArray(raw.edges) ? normalizeEdges(raw.edges) : []};
}
