import test from 'node:test';
import assert from 'node:assert/strict';
import {shotRows, projectSummary, durationLabel, scriptScenes} from '../src/pipeline/shot-model.mjs';

function fixture() {
  return {
    name: '测试影片', duration: 20, fps: 24,
    objects: [
      {id: 'cam-a', type: 'camera', name: '机位 A', aspect: '16:9'},
      {id: 'cam-b', type: 'camera', name: '机位 B', aspect: '2.39:1'},
      {id: 'hero', type: 'model', name: '女修'},
    ],
    shots: [
      {id: 's2', cameraId: 'cam-b', start: 8, end: 12},
      {id: 's1', cameraId: 'cam-a', start: 0, end: 8},
      {id: 's3', cameraId: 'missing', start: 12, end: 20},
    ],
    nodes: [
      {id: 't1', type: 'text', title: '镜 02', text: '第二镜的画面', storyRef: {kind: 'shot', id: 's2'}},
      {id: 't2', type: 'text', title: '01 · 开场', text: '第一镜的画面'},
    ],
    workstation: {script: '场景 1 · 雨夜\n女修坠入林间。\n\n场景 2 · 清晨\n她醒来。'},
  };
}

test('shot rows are sorted, numbered and carry camera + duration', () => {
  const rows = shotRows(fixture());
  assert.deepEqual(rows.map(r => r.id), ['s1', 's2', 's3']);
  assert.deepEqual(rows.map(r => r.number), ['01', '02', '03']);
  assert.equal(rows[0].camera, '机位 A');
  assert.equal(rows[0].duration, 8);
  assert.equal(rows[1].aspect, '2.39:1');
  assert.equal(rows[2].camera, '未指定机位', '缺失机位要有可读回退');
});

test('shot descriptions prefer story references, then numeric titles', () => {
  const rows = shotRows(fixture());
  assert.equal(rows[0].description, '第一镜的画面');
  assert.equal(rows[1].description, '第二镜的画面');
  assert.equal(rows[2].description, '');
});

test('project summary tolerates old or partial projects', () => {
  assert.deepEqual(projectSummary(fixture()), {
    name: '测试影片', duration: 20, shots: 3, cameras: 2, characters: 1, fps: 24, scriptLength: 33,
  });
  const empty = projectSummary({});
  assert.equal(empty.name, '未命名影片');
  assert.equal(empty.shots, 0);
  assert.equal(empty.fps, 24);
});

test('duration labels are readable and stable', () => {
  assert.equal(durationLabel(0), '0:00');
  assert.equal(durationLabel(9), '0:09');
  assert.equal(durationLabel(9.5), '0:09.5');
  assert.equal(durationLabel(76), '1:16');
  assert.equal(durationLabel('bad'), '0:00');
});

test('script is grouped into scenes for the outline', () => {
  const scenes = scriptScenes(fixture().workstation.script);
  assert.equal(scenes.length, 2);
  assert.equal(scenes[0].title, '场景 1 · 雨夜');
  assert.match(scenes[0].text, /女修坠入林间/);
  assert.equal(scenes[1].title, '场景 2 · 清晨');
  assert.deepEqual(scriptScenes(''), []);
});
