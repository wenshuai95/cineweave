import test from 'node:test';import assert from 'node:assert/strict';
import {demoProject,addParameterKey,validateProject,sampleObject} from '../src/model.mjs';
import {contentEnd,resizeProjectDuration} from '../src/project-duration.mjs';
test('duration extends beyond the previous 120-second limit without moving existing animation',()=>{
 const p=demoProject(),before=structuredClone(p),next=resizeProjectDuration(p,180);
 assert.equal(next.duration,180);assert.deepEqual(next.objects,p.objects);assert.deepEqual(next.shots,p.shots);assert.deepEqual(p,before);assert.equal(validateProject(JSON.parse(JSON.stringify(next))).duration,180);
 assert.throws(()=>resizeProjectDuration(p,6),/按比例/);assert.throws(()=>resizeProjectDuration(p,Infinity));assert.throws(()=>resizeProjectDuration(p,3601));
});
test('shortening scales legacy keys, channels, path handles, action ranges and shots without deleting content',()=>{
 const p=demoProject(),o=p.objects.find(o=>o.type==='actor');addParameterKey(o,'positionX',6,3);addParameterKey(o,'positionX',6.001,4);o.pathHandles=[{t:6,in:[-1,0,0],out:[1,0,0]}];o.actions=[{id:'walk',start:2,end:8,pose:'walk',speed:1}];
 const before=structuredClone(p),next=resizeProjectDuration(p,3,true),scaled=next.objects.find(v=>v.id===o.id);
 assert.equal(contentEnd(next),3);assert.equal(scaled.pathHandles[0].t,1.5);assert.deepEqual(scaled.pathHandles[0].out,[1,0,0]);assert.equal(scaled.channels.positionX.length,o.channels.positionX.length);assert.ok(scaled.channels.positionX.some(k=>k.t===6.001/4));assert.deepEqual(scaled.actions[0],{id:'walk',start:.5,end:2,pose:'walk',speed:1});
 assert.deepEqual(scaled.keys.map(k=>k.t),o.keys.map(k=>k.t/4));assert.deepEqual(next.shots.map(s=>s.end),p.shots.map(s=>s.end/4));assert.deepEqual(p,before);assert.doesNotThrow(()=>validateProject(JSON.parse(JSON.stringify(next))));assert.deepEqual(sampleObject(scaled,1).position,sampleObject(o,4).position);
});
