import test from 'node:test';
import assert from 'node:assert/strict';
import {object,frame,addKey,addParameterKey,editParameters,removeParameterKey,sampleObject,validateProject,demoProject,clone} from '../src/model.mjs';
import {motionDraft} from '../src/presets.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('target Y animates independently, replacing the same time without touching position, FOV or other axes',()=>{
 const o=object('camera','C',[0,2,10]);o.target=[1,1,0];
 addParameterKey(o,'targetY',0,1,'linear');addParameterKey(o,'targetY',6,4);addParameterKey(o,'targetY',6,3);
 assert.equal(o.channels.targetY.length,2);assert.deepEqual(Object.keys(o.channels),['targetY']);
 const s=sampleObject(o,3);assert.deepEqual(s.target,[1,2,0]);assert.deepEqual(s.position,[0,2,10]);assert.equal(s.fov,45);
 assert.deepEqual(o.target,[1,1,0]);assert.equal(o.keys.length,0);
});
test('first parameter key extracts the legacy curve; edits add only changed channels',()=>{
 const o=object('camera','C');addKey(o,frame(o,0,'linear'));const end=frame(o,10);end.position=[10,2,0];end.target=[2,5,0];addKey(o,end);
 const original=clone(o);editParameters(o,5,{targetY:8});
 assert.deepEqual(o.keys,original.keys);assert.deepEqual(Object.keys(o.channels),['targetY']);
 assert.deepEqual(o.channels.targetY.map(k=>k.t),[0,5,10]);
 for(const t of [0,2,5,8,10])assert.deepEqual(sampleObject(o,t).position,sampleObject(original,t).position);
 assert.equal(sampleObject(o,5).target[1],8);assert.equal(sampleObject(o,10).target[1],5);
});
test('unanimated fields edit the base while animated fields auto-key, including all-axis gizmo edits',()=>{
 const o=object('camera','C');addParameterKey(o,'targetY',0,1);editParameters(o,4,{targetX:2,targetY:3,targetZ:4});
 assert.deepEqual(o.target,[2,1,4]);assert.equal(o.channels.targetY.length,2);assert.deepEqual(Object.keys(o.channels),['targetY']);assert.deepEqual(sampleObject(o,4).target,[2,3,4]);
});
test('smooth, hold, discrete pose and color interpolation are sampled correctly',()=>{
 const o=object('actor','A');addParameterKey(o,'positionX',0,0);addParameterKey(o,'positionX',4,4);near(sampleObject(o,1).position[0],.625);
 addParameterKey(o,'positionX',0,0,'hold');near(sampleObject(o,3).position[0],0);
 addParameterKey(o,'pose',0,'stand');addParameterKey(o,'pose',2,'wave');assert.equal(sampleObject(o,1).pose,'stand');assert.equal(sampleObject(o,2).pose,'wave');
 addParameterKey(o,'color',0,'#000000','linear');addParameterKey(o,'color',4,'#ffffff');assert.equal(sampleObject(o,2).color,'#808080');
});
test('deleting the final parameter key holds its current value without resurrecting legacy animation',()=>{
 const o=object('camera','C');addKey(o,frame(o,0));const end=frame(o,10);end.target[1]=5;addKey(o,end);addParameterKey(o,'targetY',0,2);
 removeParameterKey(o,'targetY',1,0);removeParameterKey(o,'targetY',0,0);
 assert.equal(o.channels.targetY,undefined);for(const t of [0,5,10])assert.equal(sampleObject(o,t).target[1],2);
});
test('parameter channels roundtrip and reject invalid names, values, duplicate times and wrong object types',()=>{
 const p=demoProject(),o=p.objects.find(o=>o.type==='camera');addParameterKey(o,'targetY',2,4);assert.equal(validateProject(JSON.parse(JSON.stringify(p))).objects.find(x=>x.id===o.id).channels.targetY[1].value,4);
 for(const mutate of [x=>x.channels.noSuchParameter=[],x=>x.channels.targetY[0].value=NaN,x=>x.channels.targetY[1].t=0,x=>x.channels.pose=[{t:0,value:'stand',ease:'hold'}]]){const bad=clone(p);mutate(bad.objects.find(x=>x.id===o.id));assert.throws(()=>validateProject(bad),/参数/);}
});
test('motion presets update existing affected channels while preserving unrelated animations',()=>{
 const o=object('camera','C',[0,2,10]);o.target=[0,2,0];addParameterKey(o,'positionZ',0,10);addParameterKey(o,'positionZ',10,10);addParameterKey(o,'fov',0,45);addParameterKey(o,'fov',10,55,'linear');
 const push=motionDraft(o,'push',0,3,2,12,24);near(sampleObject(push,3).position[2],8);assert.deepEqual(push.channels.fov,o.channels.fov);assert.deepEqual(push.channels.positionZ.at(-1),o.channels.positionZ.at(-1));
 addParameterKey(o,'targetY',0,2);const rise=motionDraft(o,'rise',0,3,2,12,24);near(sampleObject(rise,3).target[1],4);near(sampleObject(rise,3).position[1],4);
});
