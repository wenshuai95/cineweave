// 即梦模型目录：模式/参数/默认值，纯函数。
export function dreaminaSpecFor(node, catalog = {}) {
  const model = node?.generation?.model;
  if (!model) return null;
  const type = node.type === 'image' ? 'image' : node.type === 'video' ? 'video' : node.type === 'audio' ? 'audio' : null;
  return (catalog[type] || []).find((item) => item.model === model) || null;
}

export function dreaminaModeFor(node, catalog = {}, frameCount = 0) {
  const spec = dreaminaSpecFor(node, catalog);
  if (!spec) return null;
  if (node.type === 'image') return spec.modes?.find((mode) => mode.name === 't2i') || spec.modes?.[0] || null;
  if (node.type === 'video') {
    return (spec.modes || []).find((mode) => mode.name === (frameCount ? 'first_last_frame' : 't2v') && (mode.references?.max ?? 0) >= frameCount) || spec.modes?.[0] || null;
  }
  return spec.modes?.[0] || null;
}

export function dreaminaValues(node, flag, catalog = {}, frameCount = 0) {
  const mode = dreaminaModeFor(node, catalog, frameCount);
  return (mode?.flags || []).find((item) => item.flag === flag)?.values || [];
}

export function dreaminaRange(node, flag, fallbackMin, fallbackMax, catalog = {}, frameCount = 0) {
  const mode = dreaminaModeFor(node, catalog, frameCount);
  const item = (mode?.flags || []).find((entry) => entry.flag === flag);
  return {
    min: Number.isFinite(Number(item?.min)) ? Number(item.min) : fallbackMin,
    max: Number.isFinite(Number(item?.max)) ? Number(item.max) : fallbackMax,
  };
}

export function dreaminaModelLabel(node, catalog = {}) {
  return dreaminaSpecFor(node, catalog)?.displayName || '';
}

export function chooseDreaminaPatch(spec, type) {
  const t2i = spec.modes?.find((mode) => mode.name === (type === 'video' ? 't2v' : 't2i')) || spec.modes?.[0] || null;
  const resolutions = (t2i?.flags || []).find((flag) => flag.flag === '--resolution')?.values || [];
  const duration = (t2i?.flags || []).find((flag) => flag.flag === '--duration');
  const count = (t2i?.flags || []).find((flag) => flag.flag === '--count');
  const patch = { model: spec.model };
  if (resolutions.length) patch.resolution = resolutions[0];
  if (type === 'video') patch.durationSeconds = Number(duration?.min) >= 4 ? Math.min(5, Number(duration.max) || 5) : 5;
  if (count) patch.outputCount = Math.min(Number(count.max) || 1, 4);
  return patch;
}
