// 预演时间轴 · 纯数据操作：关键帧移动/删除、动作片段增删改。
// 约束与 validateProject 一致：关键帧在时长内、动作不重叠、开始早于结束。

const round = value => Math.round(value * 100) / 100;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function trackObjects(project) {
  return (project?.objects || []).filter(object => ['model', 'actor', 'camera'].includes(object.type));
}

export function keyTimes(object) {
  const times = new Set([...(object?.keys || [])].map(key => key.t));
  for (const keys of Object.values(object?.channels || {})) for (const key of keys || []) times.add(key.t);
  return [...times].sort((a, b) => a - b);
}

const PARAM_LABELS = {
  positionX: '位置 X', positionY: '位置 Y', positionZ: '位置 Z',
  rotationX: '旋转 X', rotation: '旋转 Y', rotationZ: '旋转 Z',
  scale: '比例', roll: '滚转', fov: '焦段',
  targetX: '看向 X', targetY: '看向 Y', targetZ: '看向 Z', pose: '姿态',
};

export function parameterTracks(object) {
  return Object.entries(object?.channels || {})
    .filter(([, keys]) => Array.isArray(keys) && keys.length)
    .map(([id, keys]) => ({id, label: PARAM_LABELS[id] || id, keys: [...keys].sort((a, b) => a.t - b.t)}))
    .filter(track => ['positionX', 'positionY', 'positionZ', 'rotationX', 'rotation', 'rotationZ', 'scale', 'roll', 'fov', 'targetX', 'targetY', 'targetZ', 'pose'].includes(track.id));
}

export function moveChannelKey(object, id, index, time, duration) {
  const keys = object?.channels?.[id];
  if (!keys?.[index]) throw Error('参数关键帧不存在');
  const next = clamp(round(time), 0, duration);
  if (keys.some((item, position) => position !== index && Math.abs(item.t - next) < 0.001)) throw Error('这个时间已有关键帧');
  keys[index].t = next;
  keys.sort((a, b) => a.t - b.t);
  return keys;
}

export function deleteChannelKey(object, id, index) {
  const keys = object?.channels?.[id];
  if (!keys?.[index]) throw Error('参数关键帧不存在');
  keys.splice(index, 1);
  return keys;
}

export function shotBars(project) {
  return [...(project?.shots || [])].sort((a, b) => a.start - b.start)
    .map((shot, index) => ({id: shot.id, index: index + 1, start: shot.start, end: shot.end}));
}

export function moveKey(object, index, time, duration) {
  const keys = [...(object.keys || [])].sort((a, b) => a.t - b.t);
  const key = keys[index];
  if (!key) throw Error('关键帧不存在');
  const next = clamp(round(time), 0, duration);
  if (keys.some((item, position) => position !== index && Math.abs(item.t - next) < 0.001)) throw Error('这个时间已有关键帧');
  key.t = next;
  object.keys = keys.sort((a, b) => a.t - b.t);
  return object.keys;
}

export function deleteKey(object, index) {
  const keys = [...(object.keys || [])].sort((a, b) => a.t - b.t);
  if (!keys[index]) throw Error('关键帧不存在');
  keys.splice(index, 1);
  object.keys = keys;
  return object.keys;
}

function actionOverlap(object, start, end, ignoreId = null) {
  return (object.actions || []).some(action => action.id !== ignoreId && start < action.end && end > action.start);
}

export function addAction(object, {clip, start, duration = 2, speed = 1}) {
  if (!['actor', 'model'].includes(object.type)) throw Error('只有人物/模型可以有动作');
  const length = Math.max(0.1, round(duration));
  const from = clamp(round(start), 0, 3600 - length);
  const to = round(from + length);
  if (!clip) throw Error('请选择动作');
  if (actionOverlap(object, from, to)) throw Error('这个时间段已有动作');
  const action = {id: crypto.randomUUID(), clip, start: from, end: to, speed: Math.min(4, Math.max(0.1, round(speed)))};
  object.actions = [...(object.actions || []), action].sort((a, b) => a.start - b.start);
  return action;
}

export function moveAction(object, id, start, duration) {
  const action = (object.actions || []).find(item => item.id === id);
  if (!action) throw Error('动作不存在');
  const length = action.end - action.start;
  const from = clamp(round(start), 0, Math.max(0, duration - length));
  const to = round(from + length);
  if (actionOverlap(object, from, to, id)) throw Error('这个时间段已有动作');
  action.start = from;
  action.end = to;
  object.actions.sort((a, b) => a.start - b.start);
  return action;
}

export function resizeAction(object, id, end, duration) {
  const action = (object.actions || []).find(item => item.id === id);
  if (!action) throw Error('动作不存在');
  const to = clamp(round(end), round(action.start + 0.1), duration);
  if (actionOverlap(object, action.start, to, id)) throw Error('与其它动作重叠');
  action.end = to;
  return action;
}

export function deleteAction(object, id) {
  const before = (object.actions || []).length;
  object.actions = (object.actions || []).filter(item => item.id !== id);
  if (object.actions.length === before) throw Error('动作不存在');
  return object.actions;
}

/** 可用动作：模型读资产清单动画，简笔人物读固定姿态。 */
export const ACTOR_POSES = ['stand', 'walk', 'run', 'sit', 'point', 'wave', 'cheer'];
export function clipOptions(object, manifest = []) {
  if (object.type === 'actor') return ACTOR_POSES.map(pose => ({clip: pose, label: pose}));
  const file = String(object.modelSrc || '').replace(/^\/assets\//, '');
  const entry = manifest.find(item => item.file === file);
  return (entry?.animations || []).map(animation => ({clip: animation.name, label: animation.name, duration: animation.duration}));
}
