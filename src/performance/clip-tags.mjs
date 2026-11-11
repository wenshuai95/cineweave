// 动作片段的语义标签：把英文 clip 名归到可编排的动作类别，供表演模式检索。
// 纯函数，不依赖 DOM，便于测试。

const RULES = [
  { category: 'death', tags: ['death', '倒地', '死亡'], zh: '倒地/死亡', loop: false, match: /death|die/i },
  { category: 'hit', tags: ['hit', '受击', '受伤'], zh: '受击', loop: false, match: /hit|receive|impact/i },
  { category: 'cast', tags: ['cast', '施法', '结印', '法术'], zh: '施法/结印', loop: true, match: /spell|cast|magic/i },
  { category: 'attack', tags: ['attack', '攻击', '出拳', '踢', '挥剑'], zh: '攻击', loop: false, match: /punch|kick|sword|attack|shoot|slash/i },
  { category: 'jump', tags: ['jump', '跳'], zh: '跳跃', loop: false, match: /jump/i },
  { category: 'roll', tags: ['roll', '翻滚'], zh: '翻滚', loop: false, match: /roll/i },
  { category: 'crouch', tags: ['crouch', '蹲'], zh: '蹲伏', loop: true, match: /crouch/i },
  { category: 'sit', tags: ['sit', '坐', '坐下'], zh: '坐姿', loop: true, match: /sitting|sit_/i },
  { category: 'dance', tags: ['dance', '跳舞'], zh: '跳舞', loop: true, match: /dance/i },
  { category: 'talk', tags: ['talk', '说话', '交谈'], zh: '说话', loop: true, match: /talking|talk/i },
  { category: 'interact', tags: ['interact', '互动', '拾取', '推'], zh: '互动/拾取', loop: false, match: /interact|pickup|push|consume|fixing/i },
  { category: 'swim', tags: ['swim', '游泳'], zh: '游泳', loop: true, match: /swim/i },
  { category: 'drive', tags: ['drive', '驾驶'], zh: '驾驶', loop: true, match: /driving/i },
  { category: 'run', tags: ['run', '跑'], zh: '跑动', loop: true, match: /sprint|jog|run/i },
  { category: 'walk', tags: ['walk', '走'], zh: '行走', loop: true, match: /walk/i },
  { category: 'idle', tags: ['idle', '待机', '站立'], zh: '待机', loop: true, match: /idle|tpose/i },
];

// 玉印工程里的自制片段（中文命名）
const SPECIAL = [
  { match: /坐地施法|结印/, category: 'cast', tags: ['cast', '施法', '结印'], zh: '坐地施法/结印', loop: false },
  { match: /坐地抬头/, category: 'sit', tags: ['sit', '抬头', '坐'], zh: '坐地抬头', loop: false },
  { match: /巨妖抗印|投掷/, category: 'attack', tags: ['attack', '投掷'], zh: '抗印/投掷', loop: false },
];

export const ALLOWED_TAGS = ['idle', 'walk', 'run', 'sit', 'cast', 'attack', 'hit', 'death', 'jump', 'crouch', 'interact', 'talk', 'dance'];

export const TAG_LABELS = {
  idle: '待机', walk: '行走', run: '跑动', sit: '坐姿', cast: '施法/结印',
  attack: '攻击', hit: '受击', death: '倒地/死亡', jump: '跳跃',
  crouch: '蹲伏', interact: '互动/拾取', talk: '说话', dance: '跳舞',
};

/** 解析单个 clip 的类别、标签与是否循环。 */
export function classifyClip(name) {
  const raw = String(name || '');
  const base = raw.replace(/^RT_/, '');
  for (const rule of SPECIAL) {
    if (rule.match.test(base)) return { name: raw, category: rule.category, tags: rule.tags, zh: rule.zh, loop: rule.loop };
  }
  for (const rule of RULES) {
    if (rule.match.test(base)) return { name: raw, category: rule.category, tags: rule.tags, zh: rule.zh, loop: rule.loop };
  }
  return { name: raw, category: 'other', tags: [], zh: base, loop: false };
}

/** clips: [{name, duration}] → [{name, duration, ...classifyClip}] */
export function buildClipIndex(clips) {
  return (clips || []).map(clip => ({ ...clip, ...classifyClip(clip.name) }));
}

/**
 * 按动作标签挑片段：优先循环片段（循环动作可拉长），其次时长最接近目标时长。
 * 找不到返回 null。
 */
const PREFERRED = {
  idle: [/^idle_loop$/i, /^idle$/i, /^adult_idle_neutral$/i, /idle_neutral/i],
  walk: [/^walk_loop$/i, /^walk$/i, /^adult_walk$/i, /walk_formal/i],
  run: [/^sprint_loop$/i, /^run$/i, /^jog/i, /adult_run$/i],
  sit: [/^sitting_idle_loop$/i, /sitting_idle/i, /^sit$/i],
  cast: [/^spell_simple_idle_loop$/i, /spell_simple/i, /^cast$/i],
  talk: [/idle_talking_loop/i, /sitting_talking/i, /^talk$/i],
};
// 不适合当通用动作的变体：僵尸/火把/躺下/TPose 等，仅在别无选择时使用
const AVOID = /a_tpose|lay_?to|zombie|torch|driving|climb|swim|equip|dance_/i;

export function findClip(index, tag, duration = 0, { loop = null } = {}) {
  const candidates = (index || []).filter(c => c.category === tag || c.tags.includes(tag));
  if (!candidates.length) return null;
  const preferred = PREFERRED[tag] || [];
  const scored = candidates.map(c => {
    const base = c.name.replace(/^RT_/, '');
    const loopPenalty = loop === null ? 0 : (c.loop === loop ? 0 : 2);
    const lengthPenalty = duration > 0 ? Math.min(2, Math.abs(c.duration - duration)) : 0;
    const avoidPenalty = AVOID.test(base) ? 4 : 0;
    const preferBonus = preferred.some(re => re.test(base)) ? 1.5 : 0;
    return { clip: c, score: loopPenalty + lengthPenalty + avoidPenalty - preferBonus };
  }).sort((a, b) => a.score - b.score);
  return scored[0].clip;
}

/** 角色可用类别摘要，给模型看。 */
export function clipMenu(clips) {
  const index = buildClipIndex(clips);
  const byCategory = {};
  for (const clip of index) {
    if (clip.category === 'other') continue;
    byCategory[clip.category] ??= [];
    byCategory[clip.category].push({ name: clip.name, duration: Number(clip.duration || 0).toFixed(2), loop: clip.loop });
  }
  return byCategory;
}
