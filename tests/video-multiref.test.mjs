import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCapabilities} from '../providers/contracts.mjs';
import {normalizeReferenceLimits, referenceLimitProblem, sanitizeReferenceList} from '../providers/reference-policy.mjs';
import {createFakeProvider} from '../providers/fake.mjs';
import {createSeedanceProvider} from '../providers/seedance.mjs';
import {createKlingProvider} from '../providers/kling.mjs';
import {createComfyH3Provider} from '../providers/comfy-h3.mjs';
import {createVideoService} from '../video-service.mjs';
import {createTaskStore} from '../providers/task-store.mjs';
import {readFileSync} from 'node:fs';
import {collectVideoReferences,referencesFromSnapshot,groupVideoReferences,referenceTokens,insertReferenceToken,validateVideoReferenceTokens,moveVideoReferenceEdge,videoReferenceSummary} from '../src/video-multiref.mjs';

const PNG='data:image/png;base64,AAAA';
const WEBM='data:video/webm;base64,AAAA';
const WAV='data:audio/wav;base64,AAAA';
function project(){
 const nodes=[
  {id:'i1',type:'image',title:'角色',src:PNG},
  {id:'v1',type:'video',title:'运镜',src:WEBM},
  {id:'i2',type:'image',title:'场景',src:PNG},
  {id:'a1',type:'audio',title:'配音',src:WAV},
  {id:'t1',type:'text',title:'文字',src:'data:image/png;base64,AAAA'},
  {id:'empty',type:'image',title:'空图',src:''},
  {id:'gen',type:'video',title:'生成器',text:''},
 ];
 const edges=[
  {from:'i1',to:'gen'},{from:'v1',to:'gen'},{from:'i2',to:'gen'},{from:'a1',to:'gen'},{from:'empty',to:'gen'},{from:'t1',to:'gen'},{from:'gen',to:'i1'},
 ];
 return {id:'p',nodes,edges};
}

test('video references keep wire order, media types and per-kind <Picture/Video/Audio> aliases',()=>{
 const refs=collectVideoReferences(project(),'gen');
 assert.deepEqual(refs.map(ref=>[ref.nodeId,ref.kind,ref.alias]),[
  ['i1','image','<Picture 1>'],['v1','video','<Video 1>'],['i2','image','<Picture 2>'],['a1','audio','<Audio 1>'],
 ]);
 assert.deepEqual(groupVideoReferences(refs).map(group=>[group.kind,group.references.length]),[['image',2],['video',1],['audio',1]]);
 assert.deepEqual(referenceTokens(refs),['<Picture 1>','<Video 1>','<Picture 2>','<Audio 1>']);
});

test('reference limits use provider-declared caps and explain over-limit and unsupported kinds',()=>{
 const refs=collectVideoReferences(project(),'gen');
 const summary=videoReferenceSummary(refs,{images:2,videos:1,audios:1,total:4});
 assert.equal(summary.problem,'');
 const overImages=videoReferenceSummary([...refs,{nodeId:'i3',kind:'image',alias:'<Picture 3>'}],{images:2,videos:1,audios:1,total:4});
 assert.match(overImages.problem,/最多 2 张图片参考/);
 assert.match(videoReferenceSummary([refs[1]],{images:1,videos:0,audios:0,total:1}).problem,/不支持视频参考/);
 assert.match(videoReferenceSummary([...refs,{nodeId:'a2',kind:'audio'}],{images:9,videos:9,audios:9,total:4}).problem,/最多 4 个参考素材/);
 assert.equal(normalizeReferenceLimits({images:2,videos:1}).total,3);
 assert.equal(referenceLimitProblem([],{images:0,videos:0,audios:0}),'');
 assert.deepEqual(sanitizeReferenceList([{nodeId:'i1',kind:'image',alias:'<Picture 1>',title:'角色',src:PNG}]),[{nodeId:'i1',kind:'image',alias:'<Picture 1>',title:'角色'}]);
});

test('providers must declare their own reference limits instead of pretending',()=>{
 const fake=normalizeCapabilities(createFakeProvider().capabilities).video.referenceLimits;
 assert.deepEqual(fake,{images:2,videos:1,audios:1,total:4});
 const seedanceProvider=createSeedanceProvider({enabled:false});
 assert.deepEqual(normalizeCapabilities(seedanceProvider.capabilities).video.referenceLimits,{images:30,videos:10,audios:10,total:50});

 const kling=normalizeCapabilities(createKlingProvider({enabled:false}).capabilities).video.referenceLimits;
 assert.deepEqual(kling,{images:1,videos:0,audios:0,total:1});
 const h3=normalizeCapabilities(createComfyH3Provider({baseUrl:'http://127.0.0.1:8188'}).descriptor().capabilities).video.referenceLimits;
 assert.deepEqual(h3,{images:30,videos:10,audios:10,total:50});
 const none=normalizeCapabilities({video:{textToVideo:true}}).video.referenceLimits;
 assert.deepEqual(none,{images:0,videos:0,audios:0,total:0});
});

test('reordering swaps wires inside the same media type and keeps other references stable',()=>{
 const data=project();
 const edges=moveVideoReferenceEdge(data,'gen','i2',-1);
 assert.ok(edges);
 const moved={...data,edges};
 assert.deepEqual(collectVideoReferences(moved,'gen').map(ref=>ref.alias),['<Picture 1>','<Video 1>','<Picture 2>','<Audio 1>']);
 assert.equal(moveVideoReferenceEdge(data,'gen','i1',-1),null);
 assert.equal(moveVideoReferenceEdge(data,'gen','v1',1),null);
});

test('reference tokens insert at the caret and block dangling <Picture n> mentions',()=>{
 assert.deepEqual(insertReferenceToken('用参考构图',3,'<Picture 1>'),{value:'用参考 <Picture 1> 构图',caret:15});
 assert.deepEqual(insertReferenceToken('',0,'<Video 1>'),{value:'<Video 1>',caret:9});
 const refs=collectVideoReferences(project(),'gen');
 assert.equal(validateVideoReferenceTokens('用 <Picture 1> 和 <Audio 1>',refs),'');
 assert.match(validateVideoReferenceTokens('用 <Picture 3>',refs),/已断开/);
 assert.match(validateVideoReferenceTokens('用 <Video 2>',refs),/已断开/);
});

test('snapshot restores the submitted order and flags removed references',()=>{
 const snapshot=[{nodeId:'a1',kind:'audio'},{nodeId:'i1',kind:'image'},{nodeId:'gone',kind:'image'}];
 const restored=referencesFromSnapshot(project(),snapshot);
 assert.deepEqual(restored.references.map(ref=>[ref.nodeId,ref.kind,ref.alias,ref.fromSnapshot]),[
  ['a1','audio','<Audio 1>',true],['i1','image','<Picture 1>',true],
 ]);
 assert.equal(restored.missing.length,1);
});

test('video service enforces provider reference limits and records the snapshot metadata',async()=>{
 const service=createVideoService({folder:null,env:{}});
 const references=[
  {nodeId:'i1',kind:'image',alias:'<Picture 1>',title:'角色'},
  {nodeId:'i2',kind:'image',alias:'<Picture 2>',title:'场景'},
  {nodeId:'v1',kind:'video',alias:'<Video 1>',title:'运镜'},
  {nodeId:'a1',kind:'audio',alias:'<Audio 1>',title:'配音'},
 ];
 const quote=await service.quote({providerId:'fake',modelId:'fake-video',prompt:'用 <Picture 1> 的构图',duration:2,references});
 assert.equal(quote.kind,'video');
 const submitted=await service.submit({quoteId:quote.quoteId,projectId:'p',sourceId:'gen'});
 assert.ok(submitted.taskId);
 const tasks=service.tasks('p');
 assert.equal(tasks[0].references.length,4);
 assert.deepEqual(tasks[0].references[0],{nodeId:'i1',kind:'image',alias:'<Picture 1>',title:'角色'});
 await assert.rejects(()=>service.quote({providerId:'fake',modelId:'fake-video',prompt:'too many',duration:2,references:[...references,{nodeId:'i3',kind:'image',alias:'<Picture 3>'}]}),/最多 2 张图片参考/);
});

test('task store keeps reference metadata through snapshot and hydrate',()=>{
 const store=createTaskStore({idFactory:()=>'t'});
 store.create({providerId:'fake',modelId:'fake-video',kind:'video',references:[{nodeId:'i1',kind:'image',alias:'<Picture 1>'}]});
 const snapshot=store.snapshot();
 const restored=createTaskStore();restored.hydrate(snapshot);
 assert.deepEqual(restored.get('t').references,[{nodeId:'i1',kind:'image',alias:'<Picture 1>'}]);
});

test('video composer and canvas wire grouped references, limits, token hints and snapshots',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/id="genVideoRefs"/);
 assert.match(source,/multiReferenceMode/);
 assert.match(source,/videoReferenceSummary\(videoRefs/);
 assert.match(source,/validateVideoReferenceTokens\(composePrompt\(\),videoRefs\)/);
 assert.match(source,/data-ref-remove/);
 assert.match(source,/data-ref-move/);
 assert.match(source,/insertReferenceToken\(/);
 assert.match(source,/source\.referenceSnapshot=referenceSnapshot/);
 assert.match(source,/referenceSnapshot:referenceSnapshot\|\|\[\]/);
 assert.match(source,/node-ref-stack/);
 assert.match(source,/collectVideoReferences\(p,n\.id\)/);
});
