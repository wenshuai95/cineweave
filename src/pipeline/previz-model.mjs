// 预演 · 纯数据层：角色片段、机位预设、机位表、表演方案的输入整理。
import {defaultCamera} from './story-edit.mjs';

export function renderableObjects(project) {
  return (project?.objects || []).filter(object => object?.type === 'model' || object?.type === 'actor');
}

export function modelObjects(project) {
  return (project?.objects || []).filter(object => object?.type === 'model');
}

export function cameraObjects(project) {
  return (project?.objects || []).filter(object => object?.type === 'camera');
}

function manifestFile(manifest, object) {
  const file = String(object?.modelSrc || '').replace(/^\/assets\//, '');
  return (manifest || []).find(asset => asset.file === file) || null;
}

/** 角色可用动作片段：优先资产清单，回退到已加载片段。 */
export function clipsForObject(object, manifest) {
  const entry = manifestFile(manifest, object);
  if (entry?.animations?.length) {
    return entry.animations.map(animation => ({name: animation.name, duration: Number(animation.duration) || 0}));
  }
  return [];
}

export function performanceCharacters(project, manifest) {
  return modelObjects(project)
    .map(object => ({id: object.id, name: object.name, clips: clipsForObject(object, manifest)}))
    .filter(character => character.clips.length);
}

/** 以角色位置为中心计算一组机位：全景 / 中景 / 特写 / 侧面 / 高机位。 */
export function cameraPresets(project) {
  const characters = renderableObjects(project);
  const points = characters.map(object => object.position).filter(point => Array.isArray(point) && point.length === 3);
  const center = points.length
    ? points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]], [0, 0, 0]).map(value => value / points.length)
    : [0, 0, 0];
  const [x, , z] = center;
  const target = [Math.round(x * 100) / 100, 1, Math.round(z * 100) / 100];
  const at = (dx, y, dz) => [Math.round((x + dx) * 100) / 100, y, Math.round((z + dz) * 100) / 100];
  return [
    {id: 'wide', name: '全景', position: at(0, 2.4, 9), target, fov: 40},
    {id: 'medium', name: '中景', position: at(0, 1.7, 5), target, fov: 45},
    {id: 'close', name: '特写', position: at(0, 1.5, 2.6), target, fov: 50},
    {id: 'side', name: '侧面', position: at(5, 1.8, 4), target, fov: 45},
    {id: 'high', name: '高机位', position: at(2.5, 4.2, 7), target, fov: 40},
  ];
}

export function addCamera(project, preset = 'medium') {
  const presets = cameraPresets(project);
  const chosen = presets.find(item => item.id === preset) || presets[1];
  const camera = defaultCamera();
  camera.name = chosen.name + '机位';
  camera.position = [...chosen.position];
  camera.target = [...chosen.target];
  camera.fov = chosen.fov;
  project.objects.push(camera);
  return camera;
}

/** 把镜头按当前顺序平均分配给现有机位（多机位覆盖的默认方案）。 */
export function assignCameras(project) {
  const cameras = cameraObjects(project);
  if (!cameras.length) return 0;
  const shots = [...(project.shots || [])].sort((a, b) => a.start - b.start);
  shots.forEach((shot, index) => { shot.cameraId = cameras[index % cameras.length].id; });
  return shots.length;
}

export function shotCameraRows(project) {
  const cameras = new Map(cameraObjects(project).map(camera => [camera.id, camera]));
  return [...(project.shots || [])].sort((a, b) => a.start - b.start).map((shot, index) => ({
    id: shot.id,
    index: index + 1,
    start: shot.start,
    end: shot.end,
    camera: cameras.get(shot.cameraId)?.name || '未指定机位',
    cameraId: shot.cameraId,
  }));
}
