import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/canvas-simple.css',import.meta.url),'utf8');

test('generation composer attaches below the selected node instead of a fixed bottom dock', () => {
  assert.match(main,/const dockComposer=document\.body\.dataset\.canvasMode==='board'&&!!sourceId;/);
  assert.match(main,/dockComposer\?\{dock:true\}:\{\}\);/);
  assert.match(main,/panel\.classList\.add\('gen-attached-composer'\)/);
  assert.doesNotMatch(main,/panel\.classList\.add\('gen-bottom-dock'\)/);
  assert.match(css,/\.modal\.gen-attached-composer\{height:206px/);
  assert.match(css,/\.modal\.gen-attached-composer\{border-radius:20px!important;background:rgba\(34,34,34,\.72\)!important\}/);
  assert.match(css,/\.gen-attached-composer \.gen-preview\{display:none!important\}/);
  assert.match(main,/r\.bottom\+80/);
});

test('navigation is one compact workspace/stage switch', () => {
  assert.match(main,/id="workspaceSwitch"/);
  assert.doesNotMatch(main,/id="stageBreadcrumb"/);
  assert.doesNotMatch(main,/class="stage-nav"/);
  assert.match(main,/STAGE_ITEMS\.map/);
});

test('docked composer still closes on blank canvas, Esc, selection changes and keeps Phase 2 references', () => {
  assert.match(main,/function dismissNodeUI\(\)/);
  assert.match(main,/if\(\$\('\.node-tool-panel'\)\)closeModal\(\{restoreFocus:false\}\)/);
  assert.match(main,/if\(action==='dismiss'\)dismissComposer\(\)/);
  assert.match(main,/id="genVideoRefs"/);
  assert.match(main,/multiReferenceMode/);
});
