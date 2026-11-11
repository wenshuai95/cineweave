// 项目圣经：全片共享的人物、场景、风格与镜头约定。助手和生成任务都读它，
// 用来保证同一角色/场景在不同镜头里的外观一致。

export const EMPTY_BIBLE = {
  logline: '',
  characters: '',
  scenes: '',
  style: '',
  camera: '',
  negative: '',
};

const FIELDS = Object.keys(EMPTY_BIBLE);
const LIMIT = 4000;

export function normalizeBible(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const bible = {};
  for (const field of FIELDS) {
    const value = typeof source[field] === 'string' ? source[field].trim() : '';
    bible[field] = value.slice(0, LIMIT);
  }
  return bible;
}

export function readBible(project) {
  return normalizeBible(project?.workstation?.bible);
}

export function writeBible(project, raw) {
  if (!project || typeof project !== 'object') throw Error('没有可写入的工程');
  project.workstation = project.workstation || {};
  const bible = normalizeBible(raw);
  project.workstation.bible = bible;
  return bible;
}

export function bibleIsEmpty(bible) {
  return !FIELDS.some(field => String(bible?.[field] || '').trim());
}

const LABELS = {
  logline: '一句话故事',
  characters: '人物设定',
  scenes: '场景设定',
  style: '画面风格',
  camera: '镜头语言',
  negative: '负面提示词',
};

/** 给文字模型的项目约束文本；空圣经返回空字符串。 */
export function biblePrompt(raw) {
  const bible = normalizeBible(raw);
  const lines = FIELDS.filter(field => bible[field]).map(field => `${LABELS[field]}：${bible[field]}`);
  if (!lines.length) return '';
  return (`【项目圣经（全片必须遵守）】\n${lines.join('\n')}`).slice(0, 6000);
}

/** 叠加到图片/视频提示词末尾的风格与负面约束。 */
export function bibleStyleSuffix(raw) {
  const bible = normalizeBible(raw);
  const parts = [];
  if (bible.style) parts.push('画面风格：' + bible.style);
  if (bible.camera) parts.push('镜头语言：' + bible.camera);
  if (bible.negative) parts.push('避免：' + bible.negative);
  return parts.join('；').slice(0, 1200);
}

export function bibleSummary(raw) {
  const bible = normalizeBible(raw);
  return {
    fields: LABELS,
    filled: FIELDS.filter(field => bible[field]).length,
    total: FIELDS.length,
    logline: bible.logline,
  };
}
