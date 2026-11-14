import test from 'node:test';
import assert from 'node:assert/strict';
import {demoProject} from '../src/model.mjs';
import {trackObjects, keyTimes, moveKey, deleteKey, addAction, moveAction, resizeAction, deleteAction, clipOptions} from '../src/pipeline/timeline-model.mjs';

function project() {
  const p = demoProject();
  p.objects.forEach(object => { object.keys = []; if (['actor', 'model'].includes(object.type)) object.actions = []; else delete object.actions; });
  p.duration = 20;
  return p;
}

test('timeline tracks include actors, models and cameras', () => {
  const p = project();
  const tracks = trackObjects(p);
  assert.ok(tracks.some(object => object.type === 'actor'));
  assert.ok(tracks.some(object => object.type === 'camera'));
  assert.equal(keyTimes({keys: [{t: 5}, {t: 1}]}).join(','), '1,5');
});

test('keys move within duration and reject duplicates', () => {
  const object = {keys: [{t: 0}, {t: 2}, {t: 5}]};
  moveKey(object, 2, 8, 10);
  assert.equal(object.keys[2].t, 8);
  assert.throws(() => moveKey(object, 2, 2, 10), /已有关键帧/);
  assert.equal(moveKey(object, 0, -1, 10)[0].t, 0, '负时间被夹到 0');
  deleteKey(object, 1);
  assert.equal(object.keys.length, 2);
});

test('actions add, move, resize and never overlap', () => {
  const object = {type: 'model', actions: [], keys: []};
  const a = addAction(object, {clip: 'Idle', start: 2, duration: 3});
  assert.equal(a.start, 2);
  assert.equal(a.end, 5);
  assert.throws(() => addAction(object, {clip: 'Walk', start: 4, duration: 2}), /已有动作/);
  const b = addAction(object, {clip: 'Walk', start: 6, duration: 2});
  moveAction(object, b.id, 8, 20);
  assert.equal(b.start, 8);
  resizeAction(object, b.id, 11, 20);
  assert.equal(b.end, 11);
  assert.throws(() => moveAction(object, b.id, 2, 20), /已有动作/);
  deleteAction(object, a.id);
  assert.equal(object.actions.length, 1);
});

test('clip options come from the asset manifest or fixed poses', () => {
  const actor = {type: 'actor'};
  assert.equal(clipOptions(actor).length, 7);
  const model = {type: 'model', modelSrc: '/assets/models/adult-female-casual-actions.glb'};
  const manifest = [{file: 'models/adult-female-casual-actions.glb', animations: [{name: 'Adult_Idle', duration: 2}]}];
  assert.deepEqual(clipOptions(model, manifest), [{clip: 'Adult_Idle', label: 'Adult_Idle', duration: 2}]);
});

test('parameter tracks expose channels with labels and editable keys', async () => {
  const {parameterTracks, moveChannelKey, deleteChannelKey} = await import('../src/pipeline/timeline-model.mjs');
  const object = {channels: {positionX: [{t: 0, value: 0}, {t: 2, value: 3}], fov: [{t: 0, value: 45}]}};
  const tracks = parameterTracks(object);
  assert.deepEqual(tracks.map(track => track.id).sort(), ['fov', 'positionX']);
  assert.equal(tracks.find(track => track.id === 'positionX').label, '位置 X');
  moveChannelKey(object, 'positionX', 1, 4, 10);
  assert.equal(object.channels.positionX[1].t, 4);
  deleteChannelKey(object, 'fov', 0);
  assert.equal(object.channels.fov.length, 0);
});
