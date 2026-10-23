import test from 'node:test';
import assert from 'node:assert/strict';
import {fitToolDock} from '../src/workstation/dock-layout.mjs';
test('tool expansion keeps a usable 360px canvas on supported desktop windows',()=>{
 for(const width of [800,1080,1440,1920])for(const preferred of [300,580,1200])for(const expanded of [false,true]){
  const fit=fitToolDock(width,preferred,expanded);
  assert.ok(width-fit.width>=360);assert.ok(fit.width>=fit.minimum);assert.ok(fit.width<=fit.maximum);
 }
});
test('small-window fitting does not lose the preferred width on return',()=>{
 const preferred=900;
 assert.equal(fitToolDock(1080,preferred).width,720);
 assert.equal(fitToolDock(1920,preferred).width,900);
 assert.equal(fitToolDock(1440,580,true).width,1080);
 assert.equal(fitToolDock(1440,580,false).width,580);
});
