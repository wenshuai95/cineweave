import test from 'node:test';
import assert from 'node:assert/strict';
import {object,addParameterKey,sampleObject,sampleBaseObject,starterProject,validateProject} from '../src/model.mjs';
import {pathWalkRange,pathWalkActions,pathTravel,preferredWalkClip} from '../src/path-walk.mjs';
import {actionTiming} from '../src/timeline-edit.mjs';
const route=()=>{const o=object('actor','Walker');addParameterKey(o,'positionX',0,0,'linear');addParameterKey(o,'positionX',4,4,'linear');return o;};
const action=()=>({id:crypto.randomUUID(),pose:'walk',start:0,end:4,speed:1,followPath:true,headingOffset:0});
test('walk follows existing position curve, faces travel and holds final heading without changing keys',()=>{
 const o=route(),keys=structuredClone(o.channels);o.actions=[action()];
 for(const t of [0,1,3,4,6]){assert.deepEqual(sampleObject(o,t).position,sampleBaseObject(o,t).position);assert.equal(sampleObject(o,t).rotation,90);}
 assert.equal(sampleObject(o,1).pose,'walk');assert.equal(sampleObject(o,4).pose,'stand');assert.deepEqual(o.channels,keys);
 o.actions[0].headingOffset=180;assert.equal(sampleObject(o,1).rotation,270);
});
test('Bezier tangents turn with the curve; seek order is deterministic',()=>{
 const o=route();o.pathHandles=[{t:0,out:[0,0,3]},{t:4,in:[0,0,3]}];o.actions=[action()];
 assert.ok(sampleObject(o,.1).rotation<30);assert.ok(sampleObject(o,3.9).rotation>150);
 const middle=sampleObject(o,2);sampleObject(o,3);assert.deepEqual(sampleObject(o,2),middle);
});
test('stationary and hold segments stop footsteps and preserve previous heading',()=>{
 const o=route();addParameterKey(o,'positionX',6,4,'hold');addParameterKey(o,'positionX',8,8);o.actions=[{...action(),end:8}];
 assert.equal(sampleObject(o,5).pose,'stand');assert.equal(sampleObject(o,7).pose,'stand');assert.equal(sampleObject(o,7).rotation,90);
 const jump=object('actor','Jump');addParameterKey(jump,'positionX',0,0,'hold');addParameterKey(jump,'positionX',4,4);
 assert.equal(pathTravel(jump,3,0,4).moving,false);assert.throws(()=>pathWalkRange(jump),/连续位移/);
});
test('model walk selects skeletal clip and idle, and manual animations retain their semantics',()=>{
 const o=route();o.type='model';o.modelClip='wave';o.actions=[{...action(),clip:'walk',idleClip:'idle'}];
 assert.equal(sampleObject(o,2).modelClip,'walk');assert.equal(sampleObject(o,2).actionTime,2);assert.equal(sampleObject(o,5).modelClip,'idle');
 o.actions[0].followPath=false;assert.equal(sampleObject(o,2).rotation,0);assert.equal(sampleObject(o,5).modelClip,'wave');
 assert.equal(preferredWalkClip([{name:'Walk_Back'},{name:'Walk_RM'},{name:'Walk_Loop'}]).name,'Walk_Loop');
});
test('replace requires opt-in, splits outside actions, obeys locks, and drag preserves path settings',()=>{
 const o=route(),a={...action(),start:1,end:3};o.actions=[{id:crypto.randomUUID(),pose:'wave',start:0,end:4,speed:1}];const before=structuredClone(o);
 assert.throws(()=>pathWalkActions(o,a,12),/已有动作/);assert.deepEqual(o,before);
 o.actions=pathWalkActions(o,a,12,true);assert.deepEqual(o.actions.map(a=>[a.start,a.end]),[[0,1],[1,3],[3,4]]);assert.equal(new Set(o.actions.map(a=>a.id)).size,3);
 assert.equal(actionTiming(o,a.id,'end',-.5,12,24).followPath,true);
 o.locked=true;assert.throws(()=>pathWalkActions(o,a,12,true),/锁定/);
});
test('path settings roundtrip and reject invalid imported data',()=>{
 const p=starterProject(),o=route();o.actions=[action()];p.objects.push(o);
 const round=validateProject(structuredClone(p));assert.equal(round.objects.at(-1).actions[0].followPath,true);
 for(const fields of [{followPath:'yes'},{headingOffset:181},{idleClip:23}]){const bad=structuredClone(p);Object.assign(bad.objects.at(-1).actions[0],fields);assert.throws(()=>validateProject(bad),/行走设置/);}
});

test('running picks a forward run clip, supports older projects, and retains path timing',async()=>{
 const {preferredRunClip,pathMotionKind}=await import('../src/path-walk.mjs');
 assert.equal(preferredRunClip([{name:'Adult_Run_Back'},{name:'Sprint_Loop'},{name:'Adult_Run'}]).name,'Adult_Run');
 assert.equal(preferredRunClip([{name:'Run_RM'},{name:'run_left'},{name:'Idle_Loop'}]),undefined);
 assert.equal(preferredRunClip([{name:'Jog_Fwd_Loop'}]).name,'Jog_Fwd_Loop');
 assert.equal(pathMotionKind({followPath:true,clip:'Adult_Run'}),'run');assert.equal(pathMotionKind({pose:'run'}),'run');assert.equal(pathMotionKind({clip:'Adult_Walk'}),'walk');
 const o=route();o.actions=[{...action(),pose:'run',gait:'run'}];
 assert.equal(sampleObject(o,2).pose,'run');assert.deepEqual(sampleObject(o,2).position,[2,0,0]);assert.equal(sampleObject(o,2).rotation,90);assert.equal(sampleObject(o,4).pose,'stand');
 o.type='model';o.actions[0].clip='Adult_Run';assert.equal(sampleObject(o,2).modelClip,'Adult_Run');
 const p=starterProject(),actor=route();actor.actions=[{...action(),pose:'run',gait:'run'}];p.objects.push(actor);assert.equal(validateProject(structuredClone(p)).objects.at(-1).actions[0].gait,'run');
 actor.actions[0].gait='fly';assert.throws(()=>validateProject(p),/行走设置/);
});
test('conflict list excludes the edited action and touching ranges, matching replacement targets',async()=>{
 const {overlappingPathActions}=await import('../src/path-walk.mjs');
 const o=route();o.actions=[{...action(),id:'before',start:0,end:1},{...action(),id:'edit',start:1,end:3},{...action(),id:'other',start:3,end:4}];
 assert.deepEqual(overlappingPathActions(o,{id:'edit',start:1,end:3}),[]);
 assert.deepEqual(overlappingPathActions(o,{id:'edit',start:1,end:3.5}).map(a=>a.id),['other']);
 assert.deepEqual(overlappingPathActions(o,{start:0,end:4}).map(a=>a.id),['before','edit','other']);
});
