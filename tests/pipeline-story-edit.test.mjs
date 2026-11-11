import test from 'node:test';
import assert from 'node:assert/strict';
import {demoProject, validateProject} from '../src/model.mjs';
import {
  addShot, updateShot, removeShot, moveShot, setShotDescription,
  applyStoryboard, appendScript, sortedShots, ensureCamera, rebuildTimeline,
} from '../src/pipeline/story-edit.mjs';

function emptyProject() {
  const project = demoProject();
  project.shots = [];
  project.nodes = [];
  project.edges = [];
  project.duration = 30;
  project.objects.forEach(object => { object.keys = []; if (['actor', 'model'].includes(object.type)) object.actions = object.actions || []; else delete object.actions; });
  project.workstation = project.workstation || {};
  project.workstation.script = '';
  return project;
}

test('adding shots extends duration and keeps a valid camera', () => {
  const project = emptyProject();
  project.objects = project.objects.filter(object => object.type !== 'camera');
  const shot = addShot(project, {duration: 4});
  assert.equal(project.shots.length, 1);
  assert.ok(project.objects.some(object => object.type === 'camera' && object.id === shot.cameraId));
  addShot(project, {duration: 9});
  assert.equal(project.shots.length, 2);
  assert.ok(project.duration >= 13);
  validateProject(project);
});

test('duration changes shift the following shots and never overlap', () => {
  const project = emptyProject();
  const first = addShot(project, {duration: 3});
  const second = addShot(project, {duration: 3});
  updateShot(project, first.id, {duration: 6});
  const shots = sortedShots(project);
  assert.equal(shots[0].end, 6);
  assert.equal(shots[1].start, 6);
  assert.equal(shots[1].end, 9);
  assert.notEqual(second.id, first.id);
  validateProject(project);
});

test('removing and moving shots recompact the timeline', () => {
  const project = emptyProject();
  const a = addShot(project, {duration: 2});
  const b = addShot(project, {duration: 3});
  const c = addShot(project, {duration: 4});
  removeShot(project, b.id);
  assert.deepEqual(sortedShots(project).map(s => s.id), [a.id, c.id]);
  assert.equal(sortedShots(project)[1].start, 2);
  moveShot(project, c.id, -1);
  assert.deepEqual(sortedShots(project).map(s => s.id), [c.id, a.id]);
  assert.equal(sortedShots(project)[1].start, 4);
  validateProject(project);
  assert.ok(ensureCamera(project).length >= 1);
});

test('shot descriptions are stored once on text nodes and survive validation', () => {
  const project = emptyProject();
  const shot = addShot(project, {duration: 5});
  setShotDescription(project, shot.id, '女修坐地后退，嘴角带血');
  setShotDescription(project, shot.id, '女修坐地后退，眼神转向天空');
  const nodes = project.nodes.filter(node => node.storyRef?.kind === 'shot' && node.storyRef.id === shot.id);
  assert.equal(nodes.length, 1, '重复编辑不应产生重复节点');
  assert.match(nodes[0].text, /天空/);
  validateProject(project);
});

test('applying a storyboard replaces shots and writes descriptions', () => {
  const project = emptyProject();
  addShot(project, {duration: 9});
  applyStoryboard(project, [
    {description: '大全景：她坠入林间', duration: 3},
    {description: '近景：手诀', duration: 2.5},
    {description: '仰拍：玉印压下', duration: 4},
  ]);
  assert.equal(project.shots.length, 3);
  assert.equal(sortedShots(project)[0].start, 0);
  assert.equal(sortedShots(project)[2].end, 9.5);
  const descriptions = project.nodes.filter(node => node.storyRef?.kind === 'shot').map(node => node.text);
  assert.deepEqual(descriptions, ['大全景：她坠入林间', '近景：手诀', '仰拍：玉印压下']);
  assert.ok(project.duration >= 9.5);
  validateProject(project);
  rebuildTimeline(project);
});

test('script append and replace stay bounded', () => {
  const project = emptyProject();
  appendScript(project, '场景 1 · 雨夜\n女修坠林。');
  assert.match(project.workstation.script, /女修坠林/);
  appendScript(project, '场景 2 · 天光骤暗');
  assert.equal(project.workstation.script.split('场景').length, 3);
  appendScript(project, '只有这一句', {replace: true});
  assert.equal(project.workstation.script, '只有这一句');
});
