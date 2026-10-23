import test from 'node:test';import assert from 'node:assert/strict';
import {Vector3} from 'three';import {Stage} from '../src/stage.js';import {object} from '../src/model.mjs';
test('live target drag affects only the selected shot camera without mutating saved target',()=>{
 const o=object('camera','C'),other=object('camera','D');
 const stage={selectedId:o.id,targetDrag:{},targetTransform:{dragging:false},targetDot:{position:new Vector3(2,3,4)}};
 assert.deepEqual(Stage.prototype.stateFor.call(stage,o,0).target,[2,3,4]);
 assert.deepEqual(Stage.prototype.stateFor.call(stage,other,0).target,[0,1,0]);
 assert.deepEqual(o.target,[0,1,0]);
});
test('preview rendering hides red target, handles, paths and camera helpers, then restores their visibility',()=>{
 const helper={visible:true},targetHelper={visible:false},cameraMesh={visible:true};
 const stage={transform:{getHelper:()=>helper},targetTransform:{getHelper:()=>targetHelper},targetVisual:{visible:true},grid:{visible:false},paths:{visible:true},p:{objects:[{id:'c',type:'camera'}]},meshes:new Map([['c',cameraMesh]]),scene:{}};
 const objects=[helper,targetHelper,stage.targetVisual,stage.grid,stage.paths,cameraMesh],before=objects.map(o=>o.visible);
 const renderer={render(){assert.ok(objects.every(o=>!o.visible))}};
 Stage.prototype.cleanRender.call(stage,renderer,{});assert.deepEqual(objects.map(o=>o.visible),before);
 assert.throws(()=>Stage.prototype.cleanRender.call(stage,{render(){throw new Error('render failed')}},{}));assert.deepEqual(objects.map(o=>o.visible),before);
});
