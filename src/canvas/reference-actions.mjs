// 引用排序/角色/连线查找：纯函数。
export function reorderReferences(references = [], referenceId, direction) {
  const refs = [...references];
  const index = refs.findIndex((ref) => ref.id === referenceId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= refs.length) return null;
  const [item] = refs.splice(index, 1);
  refs.splice(target, 0, item);
  return refs.map((ref, i) => ({ ...ref, index: i }));
}

export function applyReferenceRole(references = [], referenceId, role) {
  return references.map((ref) => (ref.id === referenceId ? { ...ref, role } : ref));
}

export function findReferenceEdge(edges = [], fromId, toId) {
  return edges.find((edge) => edge.from === fromId && edge.to === toId) || null;
}

export function mentionMode({ currentType, currentMode, sourceType }) {
  let mode = currentMode;
  if (currentType === 'image' && sourceType === 'image') mode = 'i2i';
  if (currentType === 'video') mode = sourceType === 'image' ? 'i2v' : 'm2v';
  return mode;
}
