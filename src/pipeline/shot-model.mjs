// 流水线新界面的纯数据层：把工程转成“故事/分镜”视图需要的行数据。
// 不碰 DOM，方便测试；旧工程（缺字段）也要能安全显示。

export function durationLabel(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const whole = Math.round(value * 10) / 10;
  const minutes = Math.floor(whole / 60);
  const rest = whole - minutes * 60;
  const text = Number.isInteger(rest) ? String(rest) : rest.toFixed(1);
  return `${minutes}:${rest < 10 ? '0' : ''}${text}`;
}

export function projectSummary(project) {
  const shots = Array.isArray(project?.shots) ? project.shots : [];
  const objects = Array.isArray(project?.objects) ? project.objects : [];
  const characters = objects.filter(o => o.type === 'model' || o.type === 'actor');
  const cameras = objects.filter(o => o.type === 'camera');
  return {
    name: project?.name || '未命名影片',
    duration: Number(project?.duration) || 0,
    shots: shots.length,
    cameras: cameras.length,
    characters: characters.length,
    fps: Number(project?.fps) || 24,
    scriptLength: String(project?.workstation?.script || '').length,
  };
}

function cameraMap(project) {
  const map = new Map();
  for (const object of project?.objects || []) {
    if (object?.type === 'camera') map.set(object.id, object);
  }
  return map;
}

function textNodes(project) {
  return (project?.nodes || []).filter(node => node?.type === 'text');
}

function looksLikeShotTitle(title, index) {
  const number = String(index + 1).padStart(2, '0');
  return new RegExp(`^(镜\\s*)?${number}\\b|^${index + 1}\\s*[·.、]`).test(String(title || ''));
}

/** 镜头描述：优先 storyRef 指向该镜头的文本节点，其次按标题里的镜号匹配。 */
export function shotDescription(project, shot, index) {
  const nodes = textNodes(project);
  const byRef = nodes.find(node => node.storyRef?.kind === 'shot' && node.storyRef.id === shot.id);
  const clean = value => String(value || '').trim();
  if (byRef && (clean(byRef.text) || clean(byRef.title))) return clean(byRef.text) || clean(byRef.title).replace(/^\d{2}\s*[·.、]\s*/, '');
  const byTitle = nodes.find(node => looksLikeShotTitle(node.title, index));
  if (byTitle) return clean(byTitle.text) || clean(byTitle.title).replace(/^\d{2}\s*[·.、]\s*/, '');
  return '';
}

/** 分镜表行：按开始时间排序，镜头号连续编号。 */
export function shotRows(project) {
  const shots = [...(project?.shots || [])].sort((a, b) => a.start - b.start);
  const cameras = cameraMap(project);
  return shots.map((shot, index) => {
    const camera = cameras.get(shot.cameraId);
    const start = Number(shot.start) || 0;
    const end = Number(shot.end) || start;
    return {
      id: shot.id,
      index: index + 1,
      number: String(index + 1).padStart(2, '0'),
      cameraId: shot.cameraId,
      camera: camera?.name || '未指定机位',
      aspect: camera?.aspect || '16:9',
      start,
      end,
      duration: Math.max(0, Math.round((end - start) * 100) / 100),
      description: shotDescription(project, shot, index),
    };
  });
}

/** 把工程里的剧本拆成场次（“场景 N”/空行分块），给故事页做大纲。 */
export function scriptScenes(script) {
  const lines = String(script || '').split(/\r?\n/);
  const scenes = [];
  let current = null;
  for (const line of lines) {
    const heading = /^\s*(场景|场次|第[一二三四五六七八九十0-9]+场)[^\n]{0,60}$/.exec(line);
    if (heading) {
      current = { title: line.trim(), lines: [] };
      scenes.push(current);
    } else if (line.trim()) {
      if (!current) { current = { title: '未命名场景', lines: [] }; scenes.push(current); }
      current.lines.push(line);
    }
  }
  return scenes.map(scene => ({ title: scene.title, text: scene.lines.join('\n'), chars: scene.lines.join('').length }));
}
