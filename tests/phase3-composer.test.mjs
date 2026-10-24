import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/canvas-simple.css',import.meta.url),'utf8');

test('generation composer is docked to the bottom for selected image/video nodes', () => {
  assert.match(main,/const dockComposer=document\.body\.dataset\.canvasMode==='board'&&!!sourceId;/);
  assert.match(main,/dockComposer\?\{dock:true\}:\{\}\);/);
  assert.match(main,/panel\.classList\.add\('gen-bottom-dock'\)/);
  assert.match(main,/document\.body\.classList\.add\('gen-dock-open'\)/);
  assert.match(main,/document\.body\.classList\.remove\('gen-dock-open'\)/);
  assert.match(css,/\.modal\.gen-bottom-dock\{/);
  assert.match(css,/position:fixed;left:50%;bottom:64px/);
  assert.match(css,/width:min\(840px,calc\(100vw - 40px\)\)/);
  assert.match(css,/max-height:40vh/);
  assert.match(css,/\.gen-bottom-dock \.gen-preview\{width:220px;height:140px/);
  assert.match(css,/backdrop-filter:none/);
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
