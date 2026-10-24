import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSeedanceProvider,SEEDANCE25_DEFAULT_MODEL,SEEDANCE25_REFERENCE_LIMITS,SEEDANCE25_DURATIONS,SEEDANCE25_RESOLUTIONS} from '../providers/seedance.mjs';
import {createVideoService} from '../video-service.mjs';

const IMAGE='data:image/png;base64,AAAA';
const REF_URL='https://example.com/ref.mp4';
function mockFetch(){
 const calls=[];
 const fetchImpl=async (url,options={})=>{
  calls.push({url,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  if(/\/tasks\/[^/]+$/.test(url)&&(!options.method||options.method==='GET'))return new Response(JSON.stringify({status:'succeeded',content:{video_url:'https://example.com/out.mp4'},duration:5}),{status:200,headers:{'Content-Type':'application/json'}});
  return new Response(JSON.stringify({id:'cgt-remote-1'}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 return {fetchImpl,calls};
}
const references=[
 {nodeId:'i1',kind:'image',alias:'<Picture 1>',title:'角色',data:IMAGE},
 {nodeId:'i2',kind:'image',alias:'<Picture 2>',title:'场景',data:IMAGE},
 {nodeId:'v1',kind:'video',alias:'<Video 1>',title:'运镜',url:REF_URL},
 {nodeId:'a1',kind:'audio',alias:'<Audio 1>',title:'配音',url:'https://example.com/ref.mp3'},
];

test('Seedance 2.5 declares its own model catalog and 30/10/10/50 limits',async()=>{
 const provider=createSeedanceProvider({enabled:true,apiKey:'k',seedance25Enabled:true});
 const models=await provider.listModels();
 const model=models.find(item=>item.id===SEEDANCE25_DEFAULT_MODEL);
 assert.ok(model);
 assert.equal(model.available,true);
 assert.deepEqual(model.referenceLimits,SEEDANCE25_REFERENCE_LIMITS);
 assert.deepEqual(model.durations,SEEDANCE25_DURATIONS);
 assert.deepEqual(model.resolutions,SEEDANCE25_RESOLUTIONS);
 assert.ok(model.durations.includes(4)&&model.durations.includes(30));
 assert.ok(model.resolutions.includes('480p')&&model.resolutions.includes('1080p'));
 const one=models.find(item=>item.id==='doubao-seedance-1-0-pro-250528');
 assert.deepEqual(one.referenceLimits,{images:1,videos:0,audios:0,total:1});
});

test('Seedance 2.5 quote/submit maps typed references in wire order to official request fields',async()=>{
 const {fetchImpl,calls}=mockFetch();
 const provider=createSeedanceProvider({enabled:true,apiKey:'k',seedance25Enabled:true,fetchImpl});
 const quote=await provider.quote({modelId:SEEDANCE25_DEFAULT_MODEL,prompt:'以 <Picture 1> 的角色在雨夜行走，参考 <Video 1> 运镜',duration:12,resolution:'1080p',references});
 assert.equal(quote.duration,12);
 assert.equal(quote.resolution,'1080p');
 assert.equal(quote.referenceCount,4);
 const submitted=await provider.submit({quoteId:quote.quoteId,projectId:'p',sourceId:'gen'});
 assert.ok(submitted.taskId);
 assert.equal(calls.length,1);
 const body=calls[0].body;
 assert.equal(body.model,SEEDANCE25_DEFAULT_MODEL);
 assert.equal(body.duration,12);
 assert.equal(body.resolution,'1080p');
 assert.deepEqual(body.content.map(item=>[item.type,item.role]),[
  ['text',undefined],['image_url','reference_image'],['image_url','reference_image'],['video_url','reference_video'],['audio_url','reference_audio'],
 ]);
 assert.equal(body.content[1].image_url.url,IMAGE);
 assert.equal(body.content[3].video_url.url,REF_URL);
 assert.equal(body.content[4].audio_url.url,'https://example.com/ref.mp3');
});

test('Seedance 2.5 without references stays text-to-video and supports a configurable endpoint',async()=>{
 const {fetchImpl,calls}=mockFetch();
 const provider=createSeedanceProvider({enabled:true,apiKey:'k',seedance25Enabled:true,seedance25Endpoint:'/custom/seedance/tasks',fetchImpl});
 const quote=await provider.quote({modelId:SEEDANCE25_DEFAULT_MODEL,prompt:'城市夜景延时',duration:5,resolution:'480p'});
 await provider.submit({quoteId:quote.quoteId,projectId:'p'});
 assert.match(calls[0].url,/\/custom\/seedance\/tasks$/);
 assert.deepEqual(calls[0].body.content,[{type:'text',text:'城市夜景延时'}]);
 assert.equal(calls[0].body.duration,5);
 assert.equal(calls[0].body.resolution,'480p');
});

test('Seedance 2.5 rejects over-limit references, local video/audio data and invalid durations',async()=>{
 const provider=createSeedanceProvider({enabled:true,apiKey:'k',seedance25Enabled:true});
 const tooMany=Array.from({length:31},(_,i)=>({nodeId:'i'+i,kind:'image',alias:'<Picture '+(i+1)+'>',data:IMAGE}));
 await assert.rejects(()=>provider.quote({modelId:SEEDANCE25_DEFAULT_MODEL,prompt:'x',references:tooMany}),/最多 30 张图片参考/);
 await assert.rejects(()=>provider.quote({modelId:SEEDANCE25_DEFAULT_MODEL,prompt:'x',duration:12,references:[{nodeId:'v1',kind:'video',alias:'<Video 1>',data:'data:video/webm;base64,AAAA'}]}),/可访问的 http\(s\) URL/);
 assert.equal((await provider.quote({modelId:SEEDANCE25_DEFAULT_MODEL,prompt:'x',duration:31})).duration,5);
 assert.equal((await provider.quote({modelId:SEEDANCE25_DEFAULT_MODEL,prompt:'x',duration:4,resolution:'4k'})).resolution,'720p');
});

test('Seedance 2.5 is disabled unless explicitly enabled, and 1.0 never pretends to be 2.5',async()=>{
 const disabled=createSeedanceProvider({enabled:true,apiKey:'k',seedance25Enabled:false});
 const models=await disabled.listModels();
 const model=models.find(item=>item.id===SEEDANCE25_DEFAULT_MODEL);
 assert.equal(model.available,false);
 assert.match(model.unavailableReason,/ARK_SEEDANCE_25_ENABLED=1/);
 await assert.rejects(()=>disabled.quote({modelId:SEEDANCE25_DEFAULT_MODEL,prompt:'x'}),/Seedance 2\.5 未启用/);
 const one=createSeedanceProvider({enabled:true,apiKey:'k'});
 await assert.rejects(()=>one.quote({modelId:'doubao-seedance-1-0-pro-250528',prompt:'x',references:[{nodeId:'a',kind:'image',data:IMAGE},{nodeId:'b',kind:'image',data:IMAGE}]}),/只支持 1 张图片参考/);
});

test('video service exposes disabled Seedance clearly and an enabled 2.5 descriptor',()=>{
 const disabled=createVideoService({env:{}});
 const off=disabled.descriptors().find(item=>item.id==='seedance');
 assert.equal(off.enabled,false);
 assert.match(off.unavailableReason,/Seedance 2\.5/);
 assert.equal(off.seedance25.enabled,false);
 const {fetchImpl}=mockFetch();
 const enabled=createVideoService({env:{ARK_API_KEY:'k',ARK_SEEDANCE_ENABLED:'1',ARK_SEEDANCE_25_ENABLED:'1',ARK_SEEDANCE_25_MODEL:'custom-2-5'},fetchImpl});
 const on=enabled.descriptors().find(item=>item.id==='seedance');
 assert.equal(on.enabled,true);
 assert.equal(on.seedance25.enabled,true);
 assert.equal(on.seedance25.model,'custom-2-5');
 assert.deepEqual(on.capabilities.video.referenceLimits,SEEDANCE25_REFERENCE_LIMITS);
 assert.ok(on.capabilities.video.durations.includes(4)&&on.capabilities.video.resolutions.includes('480p'));
});

test('UI exposes Seedance 2.5 model availability and typed reference payload',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/id="genModelNote"/);
 assert.match(source,/model\.available===false\?'disabled':''/);
 assert.match(source,/Seedance 2\.5':provider\.label/);
 assert.match(source,/provider\.unavailableReason/);
 assert.match(source,/videoModelLimits/);
 assert.match(source,/data:src\}\)\)/);
 assert.match(source,/resolution,kind:'video'/);
});
