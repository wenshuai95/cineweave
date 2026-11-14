// 表演模式：把「节拍表」变成角色动作与走位（不写相机、不写镜头）。
// 纯函数，便于测试；UI 与模型调用都复用这里。
import { ALLOWED_TAGS, buildClipIndex, findClip } from './clip-tags.mjs';

const MOVES = ['hold', 'toward', 'away', 'left', 'right', 'up', 'down'];
const FACES = ['other', 'front', 'back', 'none'];

// 模型常见的写法差异：容忍同义词，而不是整份方案作废
const TAG_ALIASES = {
  '倒地': 'death', '死亡': 'death', '倒下': 'death', '受伤': 'hit', '受击': 'hit', '被打': 'hit',
  '施法': 'cast', '结印': 'cast', '法术': 'cast', '攻击': 'attack', '打斗': 'attack', '出拳': 'attack',
  '跳': 'jump', '跳跃': 'jump', '蹲': 'crouch', '蹲伏': 'crouch', '坐': 'sit', '坐下': 'sit',
  '互动': 'interact', '拾取': 'interact', '说话': 'talk', '交谈': 'talk', '跳舞': 'dance',
  '待机': 'idle', '站立': 'idle', '走': 'walk', '行走': 'walk', '跑': 'run', '跑动': 'run',
};
const MOVE_ALIASES = {
  toward_other: 'toward', towards: 'toward', forward: 'toward', approach: 'toward',
  away_other: 'away', backward: 'away', back: 'away', retreat: 'away',
  none: 'hold', still: 'hold', stay: 'hold', idle: 'hold', in_place: 'hold', inplace: 'hold',
};
const FACE_ALIASES = {
  toward: 'other', towards: 'other', target: 'other', other_character: 'other', face_other: 'other',
  forward: 'front', back: 'back', none: 'none', up: 'none', down: 'none', left: 'none', right: 'none',
};
const MAX_BEATS = 40;

const fail = message => { throw Error(message); };
const finite = v => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function resolveCharacter(list, key) {
  const text = String(key || '').trim();
  if (!text) return null;
  return list.find(c => c.id === text) || list.find(c => c.name === text) ||
    list.find(c => c.name.includes(text) || text.includes(c.name)) || null;
}

/**
 * 校验模型给出的节拍表。
 * characters: [{id, name, clips:[{name,duration}]}]
 * 返回规范化的 beats（已按角色排序、时间取到 0.05 秒）。
 */
export function validateBeatPlan(raw, { duration, characters }) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.beats)) fail('节拍表格式无效');
  if (!raw.beats.length || raw.beats.length > MAX_BEATS) fail(`节拍数量必须在 1–${MAX_BEATS} 之间`);
  if (!Array.isArray(characters) || !characters.length) fail('工程里没有可编排的角色');
  const beats = raw.beats.map((beat, index) => {
    if (!beat || typeof beat !== 'object') fail(`第 ${index + 1} 个节拍格式无效`);
    const start = Number(beat.start), end = Number(beat.end);
    if (!finite(start) || !finite(end) || start < 0 || end > duration || end <= start) {
      fail(`第 ${index + 1} 个节拍的时间无效（须在 0–${duration} 秒内且结束大于开始）`);
    }
    const character = [beat.character, beat.characterId, beat.characterName]
      .map(value => resolveCharacter(characters, value)).find(Boolean) || null;
    if (!character) fail(`第 ${index + 1} 个节拍的角色「${beat.character}」不在工程里`);
    const rawAction = String(beat.action || '').trim();
    const action = ALLOWED_TAGS.includes(rawAction) ? rawAction : TAG_ALIASES[rawAction];
    if (!action || !ALLOWED_TAGS.includes(action)) fail(`第 ${index + 1} 个节拍的动作「${rawAction}」不在允许清单里`);
    const rawMove = beat.move === undefined ? 'hold' : String(beat.move).trim().toLowerCase();
    const move = MOVES.includes(rawMove) ? rawMove : (MOVE_ALIASES[rawMove] || '');
    if (!MOVES.includes(move)) fail(`第 ${index + 1} 个节拍的位移「${rawMove}」无效`);
    const rawFace = beat.face === undefined ? 'none' : String(beat.face).trim().toLowerCase();
    const face = FACES.includes(rawFace) ? rawFace : (FACE_ALIASES[rawFace] || '');
    if (!FACES.includes(face)) fail(`第 ${index + 1} 个节拍的朝向「${rawFace}」无效`);
    const distance = beat.distance === undefined ? 1.2 : Number(beat.distance);
    if (!finite(distance) || distance < 0 || distance > 30) fail(`第 ${index + 1} 个节拍的移动距离无效`);
    return {
      start: Math.round(start * 20) / 20,
      end: Math.round(end * 20) / 20,
      characterId: character.id,
      characterName: character.name,
      action,
      move,
      face,
      distance,
      note: typeof beat.note === 'string' ? beat.note.slice(0, 200) : '',
    };
  });
  const byCharacter = new Map();
  for (const beat of beats) {
    const list = byCharacter.get(beat.characterId) || [];
    list.push(beat);
    byCharacter.set(beat.characterId, list);
  }
  for (const [id, list] of byCharacter) {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start < sorted[i - 1].end) {
        const name = sorted[i].characterName;
        fail(`角色「${name}」的节拍时间重叠：${sorted[i - 1].start}–${sorted[i - 1].end} 与 ${sorted[i].start}–${sorted[i].end}`);
      }
    }
    byCharacter.set(id, sorted);
  }
  return { beats, byCharacter, note: typeof raw.note === 'string' ? raw.note.slice(0, 600) : '' };
}

function yawTowards(from, to) {
  const dx = to[0] - from[0], dz = to[2] - from[2];
  if (Math.hypot(dx, dz) < 1e-6) return 0;
  return Math.atan2(-dx, -dz) * 180 / Math.PI;
}

function moveTarget(base, beat, anchor) {
  const d = beat.distance;
  if (beat.move === 'hold' || beat.move === 'up' || beat.move === 'down') {
    return [base[0], base[1] + (beat.move === 'up' ? d : beat.move === 'down' ? -d : 0), base[2]];
  }
  if (beat.move === 'left') return [base[0] - d, base[1], base[2]];
  if (beat.move === 'right') return [base[0] + d, base[1], base[2]];
  if (!anchor) return [...base];
  const dx = anchor[0] - base[0], dz = anchor[2] - base[2];
  const length = Math.hypot(dx, dz) || 1;
  const sign = beat.move === 'toward' ? 1 : -1;
  return [base[0] + (dx / length) * d * sign, base[1], base[2] + (dz / length) * d * sign];
}

/**
 * 应用节拍表：只改参与角色的 actions / keys / modelClip，相机与镜头保持原样。
 * 返回 {project, warnings, missing, summary}
 */
export function buildPerformance(project, plan, { clipsByCharacter = {} } = {}) {
  const next = structuredClone(project);
  const objects = next.objects || [];
  const characterIds = new Set(plan.beats.map(b => b.characterId));
  const characters = [...characterIds].map(id => objects.find(o => o.id === id)).filter(Boolean);
  const warnings = [];
  const missing = [];
  const summary = [];

  for (const object of characters) {
    const beats = plan.byCharacter.get(object.id) || [];
    const clips = clipsByCharacter[object.id] || [];
    const index = buildClipIndex(clips);
    const idle = findClip(index, 'idle');
    if (idle) object.modelClip = idle.name;
    const others = characters.filter(c => c.id !== object.id);
    const anchorObject = others[0] || null;
    const actions = [];
    const keys = [];
    let position = [...(object.position || [0, 0, 0])];
    let rotation = Number(object.rotation || 0);
    let first = true;

    beats.forEach((beat, i) => {
      const span = beat.end - beat.start;
      const preferLoop = span > (findClip(index, beat.action)?.duration || 0) * 1.15;
      const clip = findClip(index, beat.action, span, { loop: preferLoop ? true : null });
      if (!clip) {
        missing.push({ character: object.name, action: beat.action, start: beat.start, end: beat.end });
        warnings.push(`「${object.name}」没有可用的「${beat.action}」动作，该段保留原表演`);
        return;
      }
      let speed = 1;
      if (!clip.loop) speed = clamp(clip.duration / span, 0.3, 2.5);
      actions.push({
        id: `perf-${object.id}-${i}`,
        clip: clip.name,
        start: beat.start,
        end: beat.end,
        speed: Math.round(speed * 100) / 100,
      });

      const anchor = anchorObject ? anchorObject.position : null;
      const target = moveTarget(position, beat, anchor);
      const startPos = [...position];
      const startRot = rotation;
      if (beat.face === 'other' && anchor) rotation = yawTowards(startPos, anchor);
      else if (beat.face === 'front') rotation = 0;
      else if (beat.face === 'back') rotation = 180;

      keys.push({
        t: beat.start, ease: 'linear', position: startPos.map(v => Math.round(v * 1000) / 1000),
        rotation: Math.round(startRot * 1000) / 1000, rotationX: 0, rotationZ: 0, roll: 0,
        target: [0, 1, 0], scale: 1, fov: 45, pose: 'stand',
      });
      position = target;
      keys.push({
        t: beat.end, ease: 'smooth', position: position.map(v => Math.round(v * 1000) / 1000),
        rotation: Math.round(rotation * 1000) / 1000, rotationX: 0, rotationZ: 0, roll: 0,
        target: [0, 1, 0], scale: 1, fov: 45, pose: 'stand',
      });
      summary.push({ character: object.name, start: beat.start, end: beat.end, clip: clip.name, action: beat.action, move: beat.move });
      if (first) first = false;
    });

    if (actions.length) {
      object.actions = actions;
      object.keys = keys;
    }
  }

  return { project: next, warnings, missing, summary, beats: plan.beats };
}
