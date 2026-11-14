import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyClip, buildClipIndex, findClip } from '../src/performance/clip-tags.mjs';
import { validateBeatPlan, buildPerformance } from '../src/performance/performance-plan.mjs';
import { buildPerformanceRequest, validatePerformancePlan } from '../src/performance/performance-agent.mjs';
import { generateWriting } from '../text-writing.mjs';

const clips = [
  { name: 'RT_Idle_Loop', duration: 2.5 },
  { name: 'RT_Walk_Loop', duration: 1.2 },
  { name: 'RT_Spell_Simple_Idle_Loop', duration: 2.1 },
  { name: 'RT_Sitting_Idle_Loop', duration: 1.7 },
  { name: 'RT_Death01', duration: 2.4 },
  { name: 'RT_Punch_Cross', duration: 0.8 },
];

function project() {
  return {
    id: 'perf-test',
    name: '表演测试',
    duration: 10,
    fps: 24,
    objects: [
      { id: 'heroine', type: 'model', name: '女修', position: [-2, 0, 2], rotation: 0, scale: 1, modelClip: 'RT_Idle_Loop', actions: [], keys: [], color: '#f06b5c', pose: 'stand', target: [0, 1, 0], fov: 45 },
      { id: 'hero', type: 'model', name: '男修', position: [2, 0, 2], rotation: 0, scale: 1, modelClip: 'RT_Idle_Loop', actions: [], keys: [], color: '#398cff', pose: 'stand', target: [0, 1, 0], fov: 45 },
      { id: 'cam-1', type: 'camera', name: '参考机位', position: [0, 2, 8], target: [0, 1, 0], rotation: 0, scale: 1, color: '#b8b8b8', pose: 'stand', fov: 45, keys: [], aspect: '16:9' },
    ],
    nodes: [],
    edges: [],
    shots: [{ id: 'cut-1', cameraId: 'cam-1', start: 0, end: 10 }],
    board: { x: 0, y: 0, zoom: 0.8 },
  };
}

const meta = {
  duration: 10,
  characters: [
    { id: 'heroine', name: '女修', clips },
    { id: 'hero', name: '男修', clips },
  ],
};

test('clip tags classify locomotion, casting, sitting and custom Chinese clips', () => {
  assert.equal(classifyClip('RT_Spell_Simple_Idle_Loop').category, 'cast');
  assert.equal(classifyClip('Adult_Walk').category, 'walk');
  assert.equal(classifyClip('RT_Sitting_Idle_Loop').category, 'sit');
  assert.equal(classifyClip('坐地施法').category, 'cast');
  assert.equal(classifyClip('坐地抬头').category, 'sit');
  assert.equal(classifyClip('RT_Unknown_Thing').category, 'other');
  const index = buildClipIndex(clips);
  assert.equal(findClip(index, 'cast').name, 'RT_Spell_Simple_Idle_Loop');
  assert.equal(findClip(index, 'death').name, 'RT_Death01');
});

test('beat plan validation rejects bad tags, overlaps and unknown characters', () => {
  const ok = validateBeatPlan({ beats: [
    { start: 0, end: 3, character: 'heroine', action: 'death' },
    { start: 3, end: 6, character: 'heroine', action: 'sit' },
    { start: 1, end: 4, character: '男修', action: 'idle', move: 'toward', face: 'other' },
  ] }, meta);
  assert.equal(ok.beats.length, 3);
  assert.equal(ok.byCharacter.get('heroine').length, 2);
  assert.throws(() => validateBeatPlan({ beats: [{ start: 0, end: 3, character: 'heroine', action: 'fly' }] }, meta), /不在允许清单/);
  assert.throws(() => validateBeatPlan({ beats: [{ start: 0, end: 3, character: '路人', action: 'idle' }] }, meta), /不在工程里/);
  assert.throws(() => validateBeatPlan({ beats: [
    { start: 0, end: 4, character: 'heroine', action: 'idle' },
    { start: 3, end: 6, character: 'heroine', action: 'sit' },
  ] }, meta), /时间重叠/);
  assert.throws(() => validateBeatPlan({ beats: [{ start: 0, end: 30, character: 'heroine', action: 'idle' }] }, meta), /时间无效/);
});

test('choreography writes actions and keys but never touches cameras or shots', () => {
  const src = project();
  const plan = validateBeatPlan({ beats: [
    { start: 0, end: 3, character: 'heroine', action: 'death' },
    { start: 3, end: 6, character: 'heroine', action: 'cast', move: 'away', distance: 1.5 },
    { start: 1, end: 4, character: 'hero', action: 'walk', move: 'toward', face: 'other' },
    { start: 5, end: 8, character: 'hero', action: 'attack', move: 'hold' },
  ] }, meta);
  const result = buildPerformance(src, plan, {
    clipsByCharacter: { heroine: clips, hero: clips },
  });
  const next = result.project;
  assert.deepEqual(next.shots, src.shots, '镜头编排必须保持不变');
  assert.deepEqual(next.objects.find(o => o.id === 'cam-1'), src.objects.find(o => o.id === 'cam-1'), '机位必须保持不变');
  const heroine = next.objects.find(o => o.id === 'heroine');
  assert.equal(heroine.actions.length, 2);
  assert.equal(heroine.actions[0].clip, 'RT_Death01');
  assert.ok(heroine.keys.length >= 4);
  assert.ok(heroine.keys.every(k => Array.isArray(k.position) && k.position.length === 3));
  const hero = next.objects.find(o => o.id === 'hero');
  assert.ok(hero.actions.some(a => a.clip === 'RT_Walk_Loop'));
  const walkBeat = hero.actions.find(a => a.clip === 'RT_Walk_Loop');
  assert.ok(walkBeat.speed > 0);
  assert.equal(result.missing.length, 0);
});

test('missing actions fall back with a warning instead of inventing a clip', () => {
  const plan = validateBeatPlan({ beats: [{ start: 0, end: 2, character: 'heroine', action: 'attack' }] }, meta);
  const onlyIdle = { heroine: [{ name: 'RT_Idle_Loop', duration: 2.5 }] };
  const result = buildPerformance(project(), plan, { clipsByCharacter: onlyIdle });
  assert.equal(result.missing.length, 1);
  assert.match(result.warnings[0], /没有可用的/);
  const heroine = result.project.objects.find(o => o.id === 'heroine');
  assert.equal((heroine.actions || []).length, 0, '缺动作时不写入假片段');
});

test('performance request carries tags and rejects invalid input', () => {
  const request = buildPerformanceRequest({ prompt: '女修被击倒，男修跑来扶她', duration: 10, characters: meta.characters });
  assert.equal(request.structured, true);
  assert.ok(request.performance);
  assert.match(request.messages[0].content, /只输出 JSON/);
  assert.match(request.messages[1].content, /女修被击倒/);
  assert.throws(() => buildPerformanceRequest({ prompt: '', duration: 10, characters: meta.characters }), /描述/);
  assert.throws(() => buildPerformanceRequest({ prompt: 'x', duration: 10, characters: [{ id: 'a', name: 'a', clips: [] }] }), /没有加载到动作片段/);
});

test('model JSON plan is validated through generateWriting', async () => {
  const plan = {
    beats: [
      { start: 0, end: 2.5, character: 'heroine', action: 'death' },
      { start: 0, end: 2.5, character: 'hero', action: 'walk', move: 'toward', face: 'other' },
    ],
    note: '两人对位',
  };
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(plan) }, finish_reason: 'stop' }], usage: {} }),
  });
  const result = await generateWriting(
    { key: 'test-key', base: 'https://api.deepseek.com', model: 'deepseek-flash' },
    { kind: 'performance-plan', prompt: '测试剧情', duration: 10, characters: meta.characters },
    { fetchImpl },
  );
  assert.equal(result.beats.length, 2);
  assert.equal(result.beats[0].action, 'death');

  const broken = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '{"beats":[{"start":0,"end":2,"character":"heroine","action":"fly"}]}' }, finish_reason: 'stop' }], usage: {} }),
  });
  await assert.rejects(
    generateWriting({ key: 'k', base: 'https://api.deepseek.com', model: 'deepseek-flash' },
      { kind: 'performance-plan', prompt: 'x', duration: 10, characters: meta.characters }, { fetchImpl: broken }),
    /不在允许清单/,
  );
});
test('planning requests enable thinking and leave token budget for reasoning', async () => {
  let captured = null;
  const fetchImpl = async (url, options) => {
    captured = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ beats: [
        { start: 0, end: 2, character: 'heroine', action: 'idle' },
      ] }) }, finish_reason: 'stop' }], usage: {} }),
    };
  };
  await generateWriting({ key: 'k', base: 'https://api.deepseek.com', model: 'deepseek-flash' },
    { kind: 'performance-plan', prompt: 'x', duration: 10, characters: meta.characters }, { fetchImpl });
  assert.equal(captured.thinking.type, 'enabled');
  assert.ok(captured.max_tokens >= 12000, '思考 token 需要额外预算');

  const testFetch = async (url, options) => {
    captured = options?.body ? JSON.parse(options.body) : null;
    return { ok: true, json: async () => ({ data: [{ id: 'deepseek-flash' }] }) };
  };
  // 测试连接走 /models，不产生思考参数
  await generateWriting({ key: 'k', base: 'https://api.deepseek.com', model: 'deepseek-flash' },
    { kind: 'test', prompt: '', script: '' }, { fetchImpl: testFetch });
  assert.equal(captured, null, '测试连接走 GET /models，不带请求体');
});
