import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/canvas-simple.css',import.meta.url),'utf8');

test('A1 shell uses transparent floating topbar, 48x444 rail and 164x36 bottom dock',()=>{
 assert.match(css,/body\[data-canvas-mode=board\] \.topbar\{position:absolute/);
 assert.match(css,/body\[data-canvas-mode=board\] \.app\{grid-template-rows:0 minmax\(0,1fr\) 27px\}/);
 assert.match(css,/background:transparent!important;border-bottom:0!important/);
 assert.match(css,/\.canvas-title-block \.canvas-hud-meta/);
 assert.match(css,/width:287px/);
 assert.match(css,/height:36px/);
 assert.match(css,/body\[data-canvas-mode=board\] \.canvas-create-rail\{[^}]*width:48px;height:444px/);
 assert.match(css,/body\[data-canvas-mode=board\] \.canvas-bottom-dock\{[^}]*width:164px;height:36px/);
 assert.match(css,/body\[data-canvas-mode=board\] \.canvas-ai-entry\{[^}]*width:120px;height:36px/);
 assert.match(main,/id="canvasBottomDock"/);
 assert.match(main,/id="dockZoom"/);
});

test('A2 nodes use measured sizes, external 13px labels, 42x85 handle hit areas and blue edges',()=>{
 assert.match(css,/\.node\.node-image,body\[data-canvas-mode=board\] #board \.node\.node-video\{width:433\.4px!important;height:243\.8px!important\}/);
 assert.match(css,/\.node\.node-text,body\[data-canvas-mode=board\] #board \.node\.node-audio\{width:243\.8px!important;height:243\.8px!important\}/);
 assert.match(css,/\.node \.node-tag\{[^}]*top:-32px[^}]*font-size:13px/);
 assert.match(css,/rgba\(255,255,255,\.35\)/);
 assert.match(css,/width:42px;height:85px/);
 assert.match(css,/\.edge-line\{stroke:rgb\(0,142,229\)!important;stroke-width:1px!important/);
});

test('A4 composer attaches below the selected empty node and result images get a toolbar',()=>{
 assert.match(main,/classList\.add\('gen-attached-composer'\)/);
 assert.match(main,/r\.bottom\+80/);
 assert.match(main,/height=206/);
 assert.match(main,/width=Math\.min\(680/);
 assert.match(css,/\.modal\.gen-attached-composer\{height:206px/);
 assert.match(css,/\.modal\.gen-attached-composer\{border-radius:20px!important;background:rgba\(34,34,34,\.72\)!important\}/);
 assert.match(main,/id="imageResultToolbar"/);
 assert.match(main,/\['smart','智能改图'\]/);
});
