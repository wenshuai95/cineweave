// 流水线界面 · 分镜编辑（纯数据操作，全部经 validateProject 兼容）
// 约束来源 model.mjs：镜头不能重叠、必须在时长内、机位必须存在、至少一个机位。

const MAX_SHOT = 600;
const clampDuration = value => Math.min(MAX_SHOT, Math.max(0.2, Math.round((Number(value) || 0) * 100) / 100));
const uid = () => globalThis.crypto.randomUUID();

export function defaultCamera() {
  return {
    id: uid(), type: 'camera', name: '参考机位 A',
    position: [0, 2.2, 8], target: [0, 1, 0], rotation: 0, scale: 1,
    fov: 45, color: '#b8b8b8', pose: 'stand', keys: [], aspect: '16:9', hidden: false,
  };
}

export function ensureCamera(project) {
  project.objects = Array.isArray(project.objects) ? project.objects : [];
  if (!project.objects.some(object => object.type === 'camera')) project.objects.push(defaultCamera());
  return project.objects.filter(object => object.type === 'camera');
}

function ensureDuration(project, total) {
  const needed = Math.ceil(total * 100) / 100;
  if (!(Number(project.duration) >= needed)) project.duration = Math.max(needed, 1);
}

export function sortedShots(project) {
  return [...(project.shots || [])].sort((a, b) => a.start - b.start);
}

/** 按原顺序重排时间轴：每个镜头保留时长，从 0 开始首尾相接。 */
export function rebuildTimeline(project) {
  let cursor = 0;
  for (const shot of project.shots || []) {
    const duration = clampDuration(shot.end - shot.start);
    shot.start = Math.round(cursor * 100) / 100;
    shot.end = Math.round((cursor + duration) * 100) / 100;
    cursor += duration;
  }
  ensureDuration(project, cursor);
  return project;
}

export function addShot(project, { duration = 3, cameraId } = {}) {
  const cameras = ensureCamera(project);
  const shots = project.shots || (project.shots = []);
  const start = Math.round(shots.reduce((max, shot) => Math.max(max, shot.end), 0) * 100) / 100;
  const length = clampDuration(duration);
  const shot = {
    id: uid(),
    cameraId: cameras.some(camera => camera.id === cameraId) ? cameraId : cameras[0].id,
    start, end: Math.round((start + length) * 100) / 100,
  };
  shots.push(shot);
  ensureDuration(project, shot.end);
  return shot;
}

export function updateShot(project, id, patch = {}) {
  const shot = (project.shots || []).find(item => item.id === id);
  if (!shot) throw Error('镜头不存在');
  if (patch.cameraId !== undefined) {
    ensureCamera(project);
    const exists = project.objects.some(object => object.type === 'camera' && object.id === patch.cameraId);
    if (exists) shot.cameraId = patch.cameraId;
  }
  if (patch.duration !== undefined) {
    shot.end = shot.start + clampDuration(patch.duration);
    rebuildTimeline(project);
  }
  if (patch.description !== undefined) setShotDescription(project, id, patch.description);
  return shot;
}

export function removeShot(project, id) {
  const before = (project.shots || []).length;
  project.shots = (project.shots || []).filter(shot => shot.id !== id);
  if (project.shots.length === before) throw Error('镜头不存在');
  rebuildTimeline(project);
  return project;
}

export function moveShot(project, id, delta) {
  const shots = sortedShots(project);
  const index = shots.findIndex(shot => shot.id === id);
  if (index < 0) throw Error('镜头不存在');
  const target = index + delta;
  if (target < 0 || target >= shots.length) return project;
  const [shot] = shots.splice(index, 1);
  shots.splice(target, 0, shot);
  project.shots = shots;
  rebuildTimeline(project);
  return project;
}

/** 镜头描述存在文本节点的 storyRef 上，画布与流水线共用同一份数据。 */
export function setShotDescription(project, id, text) {
  project.nodes = Array.isArray(project.nodes) ? project.nodes : [];
  const clean = String(text || '').trim().slice(0, 6000);
  const index = sortedShots(project).findIndex(shot => shot.id === id);
  const title = `镜 ${String(index + 1).padStart(2, '0')}`;
  let node = project.nodes.find(item => item.type === 'text' && item.storyRef?.kind === 'shot' && item.storyRef.id === id);
  if (!node) {
    node = {
      id: uid(), type: 'text', title, text: clean,
      storyRef: { kind: 'shot', id }, storyStandalone: true,
      x: 60, y: 40 + Math.max(0, index) * 140, w: 300, h: 120,
    };
    project.nodes.push(node);
    return node;
  }
  node.text = clean;
  node.title = title;
  return node;
}

/** 助手分镜落地：替换全部镜头，并把描述写成文本节点。 */
export function applyStoryboard(project, shots) {
  if (!Array.isArray(shots) || !shots.length) throw Error('分镜方案为空');
  ensureCamera(project);
  const cameraId = project.objects.find(object => object.type === 'camera').id;
  project.shots = [];
  for (const item of shots.slice(0, 200)) {
    const shot = addShot(project, { duration: item.duration, cameraId });
    setShotDescription(project, shot.id, item.description || '');
  }
  rebuildTimeline(project);
  return project;
}

export function appendScript(project, text, { replace = false } = {}) {
  project.workstation = project.workstation || {};
  const current = String(project.workstation.script || '');
  const addition = String(text || '').trim();
  if (!addition) return project;
  project.workstation.script = replace ? addition.slice(0, 200000) : ((current ? current.replace(/\s+$/, '') + '\n\n' : '') + addition).slice(0, 200000);
  return project;
}
