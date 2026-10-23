import test from 'node:test';import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {object,sampleObject,frame,addKey,validateProject,demoProject,clone} from '../src/model.mjs';
import {motions,motionDraft,actionRange} from '../src/presets.mjs';
import {scrubValue} from '../src/number-scrub.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const camera=()=>{const o=object('camera','C',[0,2,10]);o.target=[0,2,0];return o};
test('action clips override pose only during their interval and preserve independent position keys',()=>{
 const o=object('actor','A');addKey(o,frame(o,0));const end=frame(o,10);end.position=[10,0,0];addKey(o,end);
 o.actions=[{id:'wave',start:2,end:4,pose:'wave',speed:2}];
 assert.equal(sampleObject(o,1).pose,'stand');assert.equal(sampleObject(o,2).pose,'wave');assert.equal(sampleObject(o,4).pose,'stand');
 near(sampleObject(o,3).actionTime,2);near(sampleObject(o,3).position[0],2.16);
 assert.equal(frame(o,3).pose,'stand','moving within a clip must not bake the clip into base pose keys');
});
test('action clips survive JSON save/load; overlap, invalid speed and duration are rejected',()=>{
 const p=demoProject(),o=p.objects[0];o.actions=[{id:'action',start:1,end:3,pose:'cheer',speed:1.2}];
 assert.equal(validateProject(JSON.parse(JSON.stringify(p))).objects[0].actions[0].pose,'cheer');
 assert.throws(()=>actionRange(o,{id:'next',start:2,end:4},p.duration),/重叠/);
 assert.doesNotThrow(()=>actionRange(o,{id:'next',start:3,end:4},p.duration));
 const bad=clone(p);bad.objects[0].actions[0].speed=0;assert.throws(()=>validateProject(bad),/动作/);
 bad.objects[0].actions[0].speed=1;bad.duration=2;assert.throws(()=>validateProject(bad));
});
test('push keeps the aim fixed; trucking moves position and aim together; zoom keeps position fixed',()=>{
 const o=camera(),push=motionDraft(o,'push',0,3,2,12,24),end=sampleObject(push,3);
 assert.deepEqual(end.position,[0,2,8]);assert.deepEqual(end.target,o.target);assert.equal(o.keys.length,0);
 const truck=sampleObject(motionDraft(o,'truckRight',0,3,2,12,24),3);assert.deepEqual(truck.position,[2,2,10]);assert.deepEqual(truck.target,[2,2,0]);
 const zoom=sampleObject(motionDraft(o,'zoomIn',0,3,15,12,24),3);near(zoom.fov,30);assert.deepEqual(zoom.position,o.position);
});
test('orbit retains radius at samples and pan turns the aim without moving the camera',()=>{
 const o=camera(),orbit=motionDraft(o,'orbitLeft',0,3,90,12,24,'linear');
 for(const k of orbit.keys)near(new Vector3(...k.position).distanceTo(new Vector3(...k.target)),10);
 near(sampleObject(orbit,3).position[0],-10);near(sampleObject(orbit,3).position[2],0);
 const pan=sampleObject(motionDraft(o,'panRight',0,3,90,12,24),3);assert.deepEqual(pan.position,o.position);near(pan.target[0],10);
});
test('presets keep earlier holds and later source keys, validate every preset, handle a one-frame span',()=>{
 const o=camera();addKey(o,frame(o,0));const last=frame(o,10);last.position=[2,2,10];addKey(o,last);
 const draft=motionDraft(o,'rise',3,6,1,12,24);assert.deepEqual(draft.keys.at(-1),last);assert.deepEqual(sampleObject(draft,0).position,o.position);
 for(const [kind,m] of Object.entries(motions)){const p=demoProject();p.objects=[motionDraft(camera(),kind,0,3,m.value,12,24)];p.shots=[];p.nodes=[];p.edges=[];assert.doesNotThrow(()=>validateProject(p));}
 const short=motionDraft(camera(),'push',0,1/24,1,12,24);assert.equal(short.keys.length,2);near(short.keys[0].t,0);near(short.keys[1].position[2],9);
});
test('rejects unsafe distances and invalid motion intervals before changing source data',()=>{
 const o=camera();assert.throws(()=>motionDraft(o,'push',0,3,10,12,24),/推进/);
 assert.throws(()=>motionDraft(o,'zoomIn',0,3,80,12,24),/FOV/);
 assert.throws(()=>motionDraft(o,'pull',3,3,2,12,24),/区间/);assert.equal(o.keys.length,0);
});
test('numeric scrubbing handles direction, precision modifier and bounds',()=>{
 near(scrubValue(7,60,.1/6,-1000,1000),8);near(scrubValue(7,-60,.1/6,-1000,1000),6);
 near(scrubValue(7,60,.1/6,-1000,1000,true),7.1);near(scrubValue(119,60,1/6,10,120),120);
 near(scrubValue(.1,-60,.1/6,.1,20),.1);
});
