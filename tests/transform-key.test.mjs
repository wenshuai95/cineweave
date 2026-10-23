import test from 'node:test';
import assert from 'node:assert/strict';
import {object,addTransformKey,transformParameterIds,addParameterKey,sampleBaseObject,parameterValue} from '../src/model.mjs';

test('group key records sampled transform values, updates in place and preserves unrelated channels',()=>{
 const o=object('model','M',[1,2,3]);o.rotationX=20;o.rotation=45;o.rotationZ=-10;o.scale=2;
 addParameterKey(o,'positionX',0,1,'linear');addParameterKey(o,'positionX',4,9,'linear');
 addParameterKey(o,'modelTint',0,'#aabbcc');const tint=structuredClone(o.channels.modelTint),state=sampleBaseObject(o,2);
 addTransformKey(o,2,'linear');
 for(const id of transformParameterIds(o))assert.equal(o.channels[id].find(k=>k.t===2).value,parameterValue(state,id));
 assert.deepEqual(o.channels.modelTint,tint);assert.equal(o.channels.color,undefined);
 const counts=Object.fromEntries(Object.entries(o.channels).map(([id,keys])=>[id,keys.length]));addTransformKey(o,2);
 assert.deepEqual(Object.fromEntries(Object.entries(o.channels).map(([id,keys])=>[id,keys.length])),counts);
});
test('camera transform key matches position and roll controls without changing lens or icon size',()=>{
 const o=object('camera','C',[1,2,3]);o.roll=25;addTransformKey(o,2);
 assert.deepEqual(Object.keys(o.channels),['positionX','positionY','positionZ','roll']);assert.equal(o.channels.roll[0].value,25);
});
test('group refuses locked or full channels atomically; existing times remain editable',()=>{
 const o=object('model','M');o.locked=true;assert.throws(()=>addTransformKey(o,1),/锁定/);assert.equal(o.channels,undefined);
 o.locked=false;o.channels={scale:Array.from({length:1000},(_,t)=>({t,value:1,ease:'smooth'}))};const before=structuredClone(o);
 assert.throws(()=>addTransformKey(o,1001),/1000/);assert.deepEqual(o,before);
 addTransformKey(o,2);assert.equal(o.channels.scale.length,1000);assert.equal(o.channels.positionX.length,1);
});
