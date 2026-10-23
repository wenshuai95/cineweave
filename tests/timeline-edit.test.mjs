import test from 'node:test';
import assert from 'node:assert/strict';
import {object,frame,clone,demoProject,validateProject,sampleObject,addParameterKey} from '../src/model.mjs';
import {actionTiming,moveTimelineKey,deleteTimelineKey} from '../src/timeline-edit.mjs';

test('action trims and moves snap to frames, respect neighbours and retain speed',()=>{
 const o=object('actor','演员');o.actions=[{id:'a',start:0,end:2,pose:'walk',speed:1},{id:'b',start:3,end:5,pose:'run',speed:2},{id:'c',start:7,end:9,pose:'sit',speed:1}];
 assert.deepEqual(actionTiming(o,'b','end',9,12,24),{...o.actions[1],end:7});
 assert.equal(actionTiming(o,'b','start',-8,12,24).start,2);
 assert.deepEqual(actionTiming(o,'b','move',20,12,24),{...o.actions[1],start:5,end:7});
 assert.deepEqual(actionTiming(o,'b','move',-20,12,24),{...o.actions[1],start:2,end:4});
 assert.equal(actionTiming(o,'b','end',-10,12,24).end,3+1/24);
 assert.equal(actionTiming(o,'b','end',.1,12,24).end,5+2/24);
 assert.equal(o.actions[1].end,5);
});
test('key drag sorts without overwriting another key and moves its Bezier handle',()=>{
 const o=object('actor','演员');o.keys=[frame(o,0),frame(o,2),frame(o,4)];o.keys[1].position=[2,1,0];o.pathHandles=[{t:2,out:[1,0,0]}];
 const next=moveTimelineKey(o,null,1,5,12,24);
 assert.deepEqual(next.keys.map(k=>k.t),[0,4,5]);assert.equal(next.pathHandles[0].t,5);assert.deepEqual(next.keys[2].position,[2,1,0]);
 assert.throws(()=>moveTimelineKey(o,null,1,4.001,12,24),/已有关键帧/);assert.equal(o.keys[1].t,2);
});
test('parameter deletion preserves current value and clears orphaned handles without other curves',()=>{
 const o=object('actor','演员');addParameterKey(o,'positionX',2,3);addParameterKey(o,'rotation',4,90);o.pathHandles=[{t:2,out:[1,0,0]}];
 const next=deleteTimelineKey(o,'positionX',0,2);
 assert.equal(next.position[0],3);assert.equal(next.channels.positionX,undefined);assert.equal(next.channels.rotation[0].t,4);assert.deepEqual(next.pathHandles,[]);
});
test('moving one position channel retains handles used by the other axes',()=>{
 const o=object('actor','演员');for(const p of ['positionX','positionY'])addParameterKey(o,p,2,1);o.pathHandles=[{t:2,out:[1,0,0]}];
 assert.equal(moveTimelineKey(o,'positionX',0,3,12,24).pathHandles[0].t,2);
});
test('last legacy key deletion holds all keyed values, without deleting object or parameter channels',()=>{
 const o=object('actor','演员');o.keys=[{...frame(o,2),position:[3,2,1],color:'#abcdef'}];
 const next=deleteTimelineKey(o,null,0,2);assert.equal(next.id,o.id);assert.deepEqual(next.position,[3,2,1]);assert.equal(next.color,'#abcdef');assert.deepEqual(next.keys,[]);
});
test('locked objects refuse timing and key edits',()=>{
 const o=object('actor','演员');o.locked=true;o.keys=[frame(o,0)];o.actions=[{id:'a',start:0,end:3,pose:'walk',speed:1}];
 assert.throws(()=>moveTimelineKey(o,null,0,2,12,24),/锁定/);assert.throws(()=>deleteTimelineKey(o,null,0,0),/锁定/);assert.throws(()=>actionTiming(o,'a','end',2,12,24),/锁定/);
});
test('model skeletal actions roundtrip, start local time and recover legacy background loop',()=>{
 const p=demoProject(),o=object('model','骨骼人物');o.modelSrc='/assets/models/adult-male-rigged.glb';o.modelSize=1.8;o.modelClip='idle';o.actions=[{id:'walk1',clip:'Walking',start:2,end:5,speed:2},{id:'wave1',clip:'Wave',start:5,end:7,speed:1}];p.objects.push(o);
 assert.doesNotThrow(()=>validateProject(clone(p)));assert.equal(sampleObject(o,1).modelClip,'idle');assert.equal(sampleObject(o,2).actionTime,0);assert.equal(sampleObject(o,4).actionTime,4);assert.equal(sampleObject(o,5).modelClip,'Wave');assert.equal(sampleObject(o,7).modelClip,'idle');
 const bad=clone(p);bad.objects.at(-1).actions[1].start=4;assert.throws(()=>validateProject(bad),/动作片段/);
 o.actions[0].clip='';assert.throws(()=>validateProject(p),/动作片段/);
});

test('shot boundary dragging rolls shared cuts with frame snapping and one-frame minimums',async()=>{
 const {shotTiming}=await import('../src/timeline-edit.mjs');const p=demoProject(),before=clone(p),id=p.shots[0].id;
 let shots=shotTiming(p,id,'end',1.1);assert.equal(shots[0].end,7+2/24);assert.equal(shots[1].start,shots[0].end);assert.equal(shots[1].end,9);assert.doesNotThrow(()=>validateProject({...clone(p),shots}));
 shots=shotTiming(p,id,'end',100);assert.equal(shots[0].end,9-1/24);assert.ok(Math.abs(shots[1].end-shots[1].start-1/24)<1e-10);
 shots=shotTiming(p,p.shots[1].id,'start',-100);assert.equal(shots[0].end,1/24);assert.equal(shots[1].start,1/24);assert.deepEqual(p,before);
});
test('shot outer edges and gaps trim without overlapping or changing animation',async()=>{
 const {shotTiming}=await import('../src/timeline-edit.mjs');const p=demoProject();p.shots[0].end=4;
 let shots=shotTiming(p,p.shots[0].id,'end',1);assert.equal(shots[0].end,5);assert.equal(shots[1].start,6);
 shots=shotTiming(p,p.shots[0].id,'end',100);assert.equal(shots[0].end,6);
 shots=shotTiming(p,p.shots[2].id,'end',100);assert.equal(shots[2].end,12);
 shots=shotTiming(p,p.shots[0].id,'start',-100);assert.equal(shots[0].start,0);assert.doesNotThrow(()=>validateProject({...clone(p),shots}));
 p.objects.find(o=>o.id===p.shots[0].cameraId).locked=true;assert.throws(()=>shotTiming(p,p.shots[0].id,'end',1),/锁定/);
 p.shots[0].end=6;assert.throws(()=>shotTiming(p,p.shots[1].id,'start',1),/相邻机位已锁定/);
});
