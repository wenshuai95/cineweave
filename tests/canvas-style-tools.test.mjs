import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraOptionsHtml, paletteGridHtml, styleListHtml, CAMERA_MOVES, createStyleTools } from '../src/canvas/style-tools.mjs';

test('camera/palette/style html marks current selection', () => {
  assert.match(cameraOptionsHtml('camera', 'RED Komodo'), /selected>RED Komodo/);
  assert.match(paletteGridHtml(2), /data-index="2"/);
  assert.match(paletteGridHtml(2), /cv-palette active/);
  assert.match(styleListHtml(1), /电影胶片/);
  assert.equal(Object.keys(CAMERA_MOVES).length, 7);
});

function fakeApp() {
  const nodes = new Map();
  const make = () => ({ value: '', innerHTML: '', textContent: '', dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll: () => [], addEventListener() {} });
  for (const id of ['#cameraModal', '#camCamera', '#camLens', '#camFocal', '#camAperture', '#paletteModal', '#paletteGrid', '#styleModal', '#styleList']) nodes.set(id, make());
  return { querySelector: (id) => nodes.get(id), nodes };
}

test('apply camera composes prompt and updates node', () => {
  const app = fakeApp();
  const updates = [];
  let prompt = '';
  const tools = createStyleTools({
    app,
    getNode: () => ({ id: 'n1', generation: {} }),
    updateNode: (id, patch) => updates.push([id, patch]),
    appendPrompt: (text) => { prompt += text; },
    render: () => {},
    toast: () => {},
  });
  app.nodes.get('#camCamera').value = 'RED Komodo';
  app.nodes.get('#camLens').value = '定焦 35mm';
  app.nodes.get('#camFocal').value = '自动';
  app.nodes.get('#camAperture').value = '自动';
  assert.equal(tools.applyCamera(), true);
  assert.equal(updates[0][1].generation.camera.camera, 'RED Komodo');
  assert.match(prompt, /镜头语言：相机 RED Komodo/);
});
