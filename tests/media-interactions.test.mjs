import test from 'node:test';
import assert from 'node:assert/strict';
import {removeMediaWithConsent,mediaRemovalImpact,parseClipTime,displayClipTime} from '../src/workstation/media-interactions.mjs';
import {createEditPage} from '../src/workstation/edit-page.mjs';
const fixture=()=>({assets:[{id:'used',name:'白模参考.mp4'},{id:'other',name:'另一段.mp4'}],sequence:{fps:24,video:[{id:'v1',assetId:'used'},{id:'v2',assetId:'used'},{id:'keep',assetId:'other'}],audio:[{id:'a1',assetId:'used'}]}});
test('canceling referenced media removal does not checkpoint or mutate the project',()=>{
 const ws=fixture(),before=structuredClone(ws),calls=[];
 assert.deepEqual(mediaRemovalImpact(ws,'used'),{video:2,audio:1,total:3});
 const removed=removeMediaWithConsent(ws,'used',{confirm:message=>{assert.match(message,/3 个片段/);assert.match(message,/视频 2 段、音频 1 段/);return false;},checkpoint:()=>calls.push('checkpoint'),commit:()=>calls.push('commit'),persist:()=>calls.push('persist')});
 assert.equal(removed,false);assert.deepEqual(ws,before);assert.deepEqual(calls,[]);
});
test('accepted removal checkpoints the complete original state once and preserves unrelated clips',()=>{
 const ws=fixture(),before=structuredClone(ws),calls=[];
 assert.equal(removeMediaWithConsent(ws,'used',{confirm:()=>true,checkpoint:()=>{calls.push('checkpoint');assert.deepEqual(ws,before);},commit:()=>calls.push('commit'),persist:()=>calls.push('persist')}),true);
 assert.deepEqual(calls,['checkpoint','commit','persist']);assert.deepEqual(ws.assets,[{id:'other',name:'另一段.mp4'}]);assert.deepEqual(ws.sequence.video,[{id:'keep',assetId:'other'}]);assert.deepEqual(ws.sequence.audio,[]);
});
test('unreferenced media deletes without an unnecessary confirmation, missing IDs do nothing',()=>{
 const ws=fixture();ws.assets.push({id:'unused',name:'空闲.mp4'});let checkpoints=0;
 assert.equal(removeMediaWithConsent(ws,'unused',{confirm(){throw Error('unnecessary confirmation')},checkpoint(){checkpoints++}}),true);
 assert.equal(removeMediaWithConsent(ws,'missing',{checkpoint(){checkpoints++}}),false);assert.equal(checkpoints,1);
});
test('seconds, frames and timecode round-trip to the exact same stored frames at supported frame rates',()=>{
 for(const fps of [24,25,30])for(const frame of [0,1,23,24,100,1799,3600*fps-1,3600*fps])for(const unit of ['seconds','frames','timecode'])assert.equal(parseClipTime(displayClipTime(frame,unit,fps),unit,fps),frame,`${frame} / ${fps} / ${unit}`);
 assert.equal(parseClipTime('01:02.12','timecode',24),1500);
 for(const [value,unit]of [['','seconds'],['-1','frames'],['1.5','frames'],['NaN','seconds'],['1e308','seconds'],['999999999999999999999999999999:00:00:00','timecode'],['00:60:00','timecode'],['00:00:00:24','timecode']])assert.throws(()=>parseClipTime(value,unit,24));
});
test('edit keyboard delegates Space and Enter to native controls while background Space remains playback shortcut',t=>{
 const priorElement=globalThis.Element,priorDocument=globalThis.document;
 class Target {constructor(native=false,field=false){this.native=native;this.field=field;}matches(){return this.field;}closest(selector){return selector.includes('button')?this.native:false;}}
 globalThis.Element=Target;globalThis.document={querySelector:()=>null};t.after(()=>{globalThis.Element=priorElement;globalThis.document=priorDocument});
 const messages=[],project={workstation:{assets:[],sequence:{fps:24,video:[],audio:[]}}};
 const page=createEditPage({}, {project:()=>project,toast:message=>messages.push(message)});
 for(const code of ['Space','Enter','NumpadEnter'])page.handleKey({code,target:new Target(true),preventDefault(){throw Error('native activation intercepted')}});
 assert.equal(messages.length,0);
 let prevented=0;page.handleKey({code:'Space',target:new Target(),preventDefault(){prevented++}});
 assert.equal(prevented,1);assert.match(messages[0],/时间线为空/);
 page.handleKey({code:'Space',target:new Target(false,true),preventDefault(){throw Error('field keyboard intercepted')}});
 assert.equal(messages.length,1);
});
