import test from 'node:test';
import assert from 'node:assert/strict';
import {object,addParameterKey,frame,sampleBaseObject} from '../src/model.mjs';
import {moveTimelineKeys,deleteTimelineKeys,resolveKeyRefs,keysInBox} from '../src/timeline-multiselect.mjs';
const ref=(o,t,parameter=null)=>({objectId:o.id,t,parameter});
test('batch move across objects and channels keeps spacing, clamps as a group and does not mutate source',()=>{
 const a=object('actor','A'),b=object('camera','B');a.keys=[frame(a,1),frame(a,3)];addParameterKey(b,'fov',2,45);const before=structuredClone([a,b]),refs=[ref(a,1),ref(a,3),ref(b,2,'fov')];
 const move=moveTimelineKeys([a,b],refs,100,8,24);assert.equal(move.delta,5);assert.deepEqual(move.refs.map(r=>r.t),[6,8,7]);assert.deepEqual([a,b],before);
 assert.equal(moveTimelineKeys([a,b],refs,-100,8,24).delta,-1);assert.equal(moveTimelineKeys([a,b],refs,.1,8,24).delta,2/24);
});
test('moving to an occupied unselected time is atomic; moving into selected old times is allowed',()=>{
 const o=object('actor','A');o.keys=[frame(o,0),frame(o,1),frame(o,3)];const before=structuredClone(o);
 const result=moveTimelineKeys([o],[ref(o,0),ref(o,1)],1,8,24);assert.deepEqual(result.objects[0].keys.map(k=>k.t),[1,2,3]);
 assert.throws(()=>moveTimelineKeys([o],[ref(o,0),ref(o,1)],2,8,24),/已有关键帧/);assert.deepEqual(o,before);
});
test('Bezier handles move with all selected axes even when another selected frame occupies the old time',()=>{
 const o=object('actor','A');for(const t of [1,2])for(const id of ['positionX','positionY','positionZ'])addParameterKey(o,id,t,t);
 o.pathHandles=[{t:1,out:[1,0,0]},{t:2,in:[-1,0,0]}];
 const refs=[1,2].flatMap(t=>['positionX','positionY','positionZ'].map(id=>ref(o,t,id)));
 assert.deepEqual(moveTimelineKeys([o],refs,1,8,24).objects[0].pathHandles.map(h=>h.t),[2,3]);
 assert.equal(moveTimelineKeys([o],[ref(o,1,'positionX')],3,8,24).objects[0].pathHandles[0].t,1);
});
test('batch deletion holds original sampled values when clearing multiple last curves',()=>{
 const o=object('actor','A');o.keys=[{...frame(o,0),position:[0,0,0]},{...frame(o,4),position:[4,2,0]}];
 addParameterKey(o,'positionX',0,2,'linear');addParameterKey(o,'positionX',4,6);addParameterKey(o,'rotation',0,20);addParameterKey(o,'rotation',4,80);o.pathHandles=[{t:0,out:[1,0,0]}];
 const state=sampleBaseObject(o,2),refs=[ref(o,0),ref(o,4),ref(o,0,'positionX'),ref(o,4,'positionX'),ref(o,0,'rotation'),ref(o,4,'rotation')];
 const next=deleteTimelineKeys([o],refs,2)[0];assert.deepEqual(next.keys,[]);assert.deepEqual(next.channels,{});assert.deepEqual(next.pathHandles,[]);assert.deepEqual(sampleBaseObject(next,2).position,state.position);assert.equal(next.rotation,state.rotation);assert.equal(o.keys.length,2);
});
test('stale and duplicate refs normalize, locks reject an entire batch, rectangle intersects visible key bounds',()=>{
 const o=object('actor','A');o.keys=[frame(o,1)];assert.equal(resolveKeyRefs([o],[ref(o,1),ref(o,1),ref(o,8)]).length,1);
 o.locked=true;assert.throws(()=>moveTimelineKeys([o],[ref(o,1)],2,8,24),/锁定/);assert.throws(()=>deleteTimelineKeys([o],[ref(o,1)],0),/锁定/);
 assert.deepEqual(keysInBox([{ref:ref(o,1),left:10,right:20,top:100,bottom:110},{ref:ref(o,8),left:80,right:90,top:120,bottom:130}],{left:15,right:50,top:95,bottom:150}),[ref(o,1)]);
});
test('moving one channel cannot overwrite another curve handle at the destination',()=>{
 const o=object('actor','A');addParameterKey(o,'positionX',1,1);addParameterKey(o,'positionY',2,2);o.pathHandles=[{t:1,out:[1,0,0]},{t:2,in:[0,1,0]}];
 assert.throws(()=>moveTimelineKeys([o],[ref(o,1,'positionX')],1,8,24),/贝塞尔手柄/);assert.deepEqual(o.pathHandles.map(h=>h.t),[1,2]);
});
