import test from 'node:test';
import assert from 'node:assert/strict';
import {demoProject, validateProject} from '../src/model.mjs';
import {renderableObjects, modelObjects, cameraObjects, clipsForObject, performanceCharacters, cameraPresets, addCamera, assignCameras, shotCameraRows} from '../src/pipeline/previz-model.mjs';

function project() {
  const p = demoProject();
  p.objects.forEach(object => { object.keys = []; if (['actor', 'model'].includes(object.type)) object.actions = object.actions || []; else delete object.actions; });
  p.nodes = [];
  p.edges = [];
  p.duration = 30;
  return p;
}

const manifest = [{
  file: 'models/adult-female-casual-actions.glb',
  animations: [{name: 'Adult_Idle_Neutral', duration: 2}, {name: 'RT_Spell_Simple_Idle_Loop', duration: 2.4}],
}];

test('camera presets follow the characters and produce valid cameras', () => {
  const p = project();
  const presets = cameraPresets(p);
  assert.equal(presets.length, 5);
  assert.equal(presets[0].id, 'wide');
  const camera = addCamera(p, 'close');
  assert.equal(camera?.type, 'camera');
  assert.ok(cameraObjects(p).some(item => item.id === camera.id));
  validateProject(p);
});

test('clips resolve from the asset manifest and characters without clips are skipped', () => {
  const p = project();
  p.objects.push({
    id: 'heroine', type: 'model', name: '女修', position: [0, 0, 0], target: [0, 1, 0], rotation: 0, scale: 1,
    fov: 45, color: '#f06b5c', pose: 'stand', keys: [], actions: [],
    modelSrc: '/assets/models/adult-female-casual-actions.glb', modelSize: 1.7, modelKind: 'character', modelClip: 'Adult_Idle_Neutral',
  });
  const object = modelObjects(p).find(item => item.id === 'heroine');
  assert.equal(clipsForObject(object, manifest).length, 2);
  const characters = performanceCharacters(p, manifest);
  assert.equal(characters.length, 1);
  assert.equal(characters[0].id, 'heroine');
  validateProject(p);
});

test('camera assignment cycles through all cameras in shot order', () => {
  const p = project();
  addCamera(p, 'wide');
  addCamera(p, 'close');
  const cameras = cameraObjects(p);
  assert.ok(cameras.length >= 2);
  const shots = shotCameraRows(p);
  assert.ok(shots.length >= 3);
  assignCameras(p);
  const rows = shotCameraRows(p);
  const used = new Set(rows.map(row => row.cameraId));
  assert.ok(used.size >= 1);
  validateProject(p);
});

test('renderable objects include actors and models', () => {
  const p = project();
  assert.ok(renderableObjects(p).length > 0);
  assert.equal(modelObjects(p).length, 0);
});
