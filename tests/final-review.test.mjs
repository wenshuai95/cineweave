import {planCanvasImageResult} from '../src/canvas-image-result.mjs';
import {mergeImageTaskObservation,markTaskQueryError} from '../src/task-center.mjs';
import {recordingFormat} from '../src/video-format.mjs';
import {appendDirectorVideo} from '../src/director-output.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {starterProject,validateProject,activeCamera,sampleObject,object} from '../src/model.mjs';
import * as shotReference from '../src/shot-reference.mjs';
import {imageAssetContext} from '../src/workstation/asset-image-context.mjs';

// Exercise the shipped handlers, substituting only browser/IO boundaries.
// No network, real renderer, user projects or desktop interactions are used.
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function handler(first,next){
 const start=source.indexOf(first),end=source.indexOf(next,start+first.length);
 assert.ok(start>=0&&end>start,'handler boundaries exist');
 return source.slice(start,end);
}
const snippets={
 importMediaBatch:handler('async function importMediaBatch(',"$('#mediaFile').onchange=async"),
 referencePackModal:handler('function referencePackModal(','function aiTaskModal('),
 watchImage:handler('async function watchImage(','async function textPlanModal('),
 capture:handler('async function capture(options','async function exportModal('),
 captureDepth:handler('async function captureDepth(','async function capture(options'),
 addAsset:handler('function addAsset(type)','function addAssetModal('),
 exportModal:handler('async function exportModal(','let aiToken=null;'),
};
function fixture(count=1){
 const p=starterProject();p.edges=[];
 p.nodes=Array.from({length:count},(_,i)=>({id:'node'+i,type:'image',title:'fixture',text:'',src:'data:image/png;base64,AA==',x:0,y:0,w:280}));
 return validateProject(p);
}
function environment(p=fixture()){
 const elements=new Map(),messages=[],effects={checkpoints:0,commits:0,closed:0,downloads:0,renders:0};
 const $=key=>{if(!elements.has(key))elements.set(key,{value:'',checked:false,disabled:false,textContent:'',innerHTML:'',style:{},isConnected:true,addEventListener(){}});return elements.get(key)};
 const imageTasks={};const c={p,loadImageTaskStore:()=>imageTasks,saveImageTaskStore:()=>{},renderTaskCenter:()=>{},mergeImageTaskObservation,markTaskQueryError,planCanvasImageResult,imageAssetContext,activeDirectorId:null,selected:null,modeMemory:{board:null},recordingFormat,appendDirectorVideo,managerOpen:false,transitioning:false,mode:'board',filter:'all',time:2,override:null,exporting:false,localWork:0,assetCatalog:[{}],watchingImages:new Set(),AbortController,DOMException,Blob,
 $, $$:()=>[],document:{hidden:false,addEventListener(){},removeEventListener(){}},
 toast:m=>messages.push(m),checkpoint:()=>effects.checkpoints++,commit:()=>effects.commits++,closeModal:()=>effects.closed++,modal(){},stop(){},select(){},fitBoard(){},renderPreviewSelect(){},setTime:t=>c.time=t,setMode:m=>c.mode=m,
 esc:String,download:()=>effects.downloads++,classifyImportFile:()=>({ok:true,kind:'image',mime:'image/png'}),labels:{image:'图片'},
 asset:(type,extra)=>({id:'new-node',type,title:'fixture',text:'',x:0,y:0,w:280,...extra}),
 activeCamera:()=>p.objects.find(o=>o.type==='camera'),formatFor:()=>({width:1280,height:720}),formats:{'16:9':{width:1280,height:720}},exportCharacterCandidates:()=>[],
 shotReferencePlan:()=>[{name:'fixture'}],
 stage:{readyAssets:async()=>{},screenshot:()=>{effects.renders++;return 'data:image/png;base64,AA=='},depthShot:()=>{effects.renders++;return 'data:image/png;base64,AA=='},render(){},exportVideo:async()=>new Blob(['mock webm'],{type:'video/webm'})},
 readDataURL:async()=> 'data:image/png;base64,AA==',withLocalWork:async fn=>fn(),
 };
 vm.createContext(c);for(const snippet of Object.values(snippets))vm.runInContext(snippet,c);
 return {c,$,effects,messages};
}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}

test('media replacement resolves current node after undo replaces project snapshot',async()=>{
 const {c,effects}=environment(),old=c.p.nodes[0],gate=deferred();c.readMediaFile=()=>gate.promise;
 const pending=c.importMediaBatch([{name:'replacement.png'}],{target:old});
 c.p=structuredClone(c.p);gate.resolve('data:image/png;base64,AQ==');
 assert.equal(await pending,1);assert.equal(c.p.nodes[0].src,'data:image/png;base64,AQ==');
 assert.equal(old.src,'data:image/png;base64,AA==');assert.equal(effects.checkpoints,1);validateProject(c.p);
});
test('media replacement cancels if target was deleted during file reading',async()=>{
 const {c,effects,messages}=environment(),target=c.p.nodes[0],gate=deferred();c.readMediaFile=()=>gate.promise;
 const pending=c.importMediaBatch([{name:'replacement.png'}],{target});c.p.nodes=[];gate.resolve('data:image/png;base64,AQ==');
 assert.equal(await pending,0);assert.equal(c.p.nodes.length,0);assert.equal(effects.checkpoints,0);assert.equal(effects.commits,0);assert.match(messages.at(-1),/已删除|取消/);validateProject(c.p);
});
test('media replacement does not write image data into a target whose type changed',async()=>{
 const {c,effects}=environment(),target=c.p.nodes[0],gate=deferred();c.readMediaFile=()=>gate.promise;
 const pending=c.importMediaBatch([{name:'replacement.png'}],{target});c.p.nodes[0].type='text';delete c.p.nodes[0].src;
 gate.resolve('data:image/png;base64,AQ==');assert.equal(await pending,0);assert.equal(c.p.nodes[0].src,undefined);assert.equal(effects.checkpoints,0);validateProject(c.p);
});
test('reference pack cancel before export immediately closes without disabling button',()=>{
 const {c,$,effects}=environment();c.referencePackModal();$('#referenceCancel').onclick();
 assert.equal(effects.closed,1);assert.equal($('#referenceCancel').disabled,false);assert.equal(c.exporting,false);
});
test('full canvas defers generated image and the same task can be recovered after freeing capacity',async()=>{
 const {c,$,effects,messages}=environment(fixture(500));let queries=0;
 c.api=async()=>{queries++;return {status:'succeeded',imageUrl:'mock-only'}};
 c.fetch=async()=>({ok:true,blob:async()=>new Blob(['fixture'])});
 await c.watchImage('saved-task',c.p.id,null,'fixture');
 assert.equal(c.p.nodes.length,500);assert.equal(effects.checkpoints,0);assert.equal(c.watchingImages.has('saved-task'),false);assert.match(messages.at(-1),/恢复/);assert.match($('#imageStatus').textContent,/恢复/);validateProject(c.p);
 c.p.nodes.pop();await c.watchImage('saved-task',c.p.id,null,'fixture');
 assert.equal(c.p.nodes.length,500);assert.equal(c.p.nodes.at(-1).generatedTask,'saved-task');assert.equal(effects.checkpoints,1);assert.equal(queries,2);validateProject(c.p);
});
test('shipped image handler fills a template picture at capacity and keeps its wires',async()=>{
 const p=fixture(500);delete p.nodes[0].src;p.boardGroups=[{id:'template',name:'参考',collapsed:true,memberIds:['node0','node1']}];p.edges=[{from:'node1',to:'node0'}];
 const {c,effects}=environment(p);c.api=async()=>({status:'succeeded',imageUrl:'mock-only'});c.fetch=async()=>({ok:true,blob:async()=>new Blob(['fixture'])});
 await c.watchImage('template-result',p.id,'node0','角色设定');
 assert.equal(p.nodes.length,500);assert.equal(p.nodes[0].generatedTask,'template-result');assert.equal(p.nodes[0].src,'data:image/png;base64,AA==');
 assert.deepEqual(p.boardGroups[0].memberIds,['node0','node1']);assert.deepEqual(p.edges,[{from:'node1',to:'node0'}]);assert.equal(effects.checkpoints,1);validateProject(p);
});
for(const name of ['capture','captureDepth'])test(`${name} at capacity preserves a valid project without rendering or checkpoint`,async()=>{
 const {c,effects,messages}=environment(fixture(500)),before=JSON.stringify(c.p);await c[name]();
 assert.equal(JSON.stringify(c.p),before);assert.equal(effects.renders,0);assert.equal(effects.checkpoints,0);assert.match(messages.at(-1),/上限/);validateProject(c.p);
});
for(const name of ['capture','captureDepth'])test(`${name} rechecks capacity after awaiting model readiness`,async()=>{
 const {c,effects}=environment(fixture(499)),gate=deferred();c.stage.readyAssets=()=>gate.promise;
 const pending=c[name]();c.p.nodes.push({...c.p.nodes[0],id:'last-node'});gate.resolve();await pending;
 assert.equal(c.p.nodes.length,500);assert.equal(effects.renders,0);assert.equal(effects.checkpoints,0);validateProject(c.p);
});
test('quick creation at capacity does not add text or actor scene objects',()=>{
 const {c,effects,messages}=environment(fixture(500)),before=JSON.stringify(c.p);
 c.addAsset('text');c.addAsset('actor');assert.equal(JSON.stringify(c.p),before);assert.equal(effects.checkpoints,0);assert.match(messages.at(-1),/上限/);validateProject(c.p);
});
test('video export on full canvas still downloads but does not create an invalid 501st node',async()=>{
 const {c,$,effects,messages}=environment(fixture(500)),before=JSON.stringify(c.p),originalTime=c.time;
 $('#exportStart').value='0';$('#exportEnd').value='1';$('#exportAspect').value='16:9';
 await c.exportModal();await $('#startExport').onclick();
 assert.equal(effects.downloads,1);assert.equal(JSON.stringify(c.p),before);assert.equal(effects.checkpoints,0);assert.equal(c.exporting,false);assert.equal(c.time,originalTime);assert.match(messages.at(-1),/已下载.*未添加/);validateProject(c.p);
});

// Use the real Stage method; fake only WebGL/media capture and clock scheduling.
// The frame at an exclusive interval end belongs to the next shot/action.
const stageSource=fs.readFileSync(new URL('../src/stage.js',import.meta.url),'utf8');
const exportMethod=stageSource.slice(stageSource.indexOf(' async exportVideo('),stageSource.lastIndexOf('\n}'));
async function recordBoundary(start,end,fps){
 const first=object('camera','first'),second=object('camera','second'),actor=object('actor','actor');
 actor.actions=[{id:'walk',pose:'walk',start:0,end,speed:1},{id:'wave',pose:'wave',start:end,end:end+1,speed:1}];
 const p={duration:end+1,fps,objects:[first,second,actor],shots:[{cameraId:first.id,start:0,end},{cameraId:second.id,start:end,end:end+1}]};
 assert.equal(activeCamera(p,end).id,second.id);assert.equal(sampleObject(actor,end).pose,'wave');
 const samples=[],progress=[],cleanup={renderer:0,track:0,proxies:0};let now=0,frames=0;
 class Renderer{
  constructor(){this.shadowMap={};this.domElement={captureStream:()=>({getTracks:()=>[{stop:()=>cleanup.track++}]})}}
  setSize(){}setScissorTest(){}setViewport(){}setClearColor(){}clear(){}setScissor(){}dispose(){cleanup.renderer++}
 }
 class Recorder{
  static isTypeSupported(){return true}
  constructor(){this.state='inactive'}start(){this.state='recording'}
  stop(){this.state='inactive';this.ondataavailable({data:new Blob(['webm-frame'])});this.onstop()}
 }
 const c={recordingFormat,window:{MediaRecorder:Recorder},HTMLCanvasElement:{prototype:{captureStream(){}}},MediaRecorder:Recorder,THREE:{WebGLRenderer:Renderer,SRGBColorSpace:'srgb'},Blob,DOMException,
  formatFor:()=>({width:640,height:360}),activeCamera,lastFrameTime:shotReference.lastFrameTime,
  disposeSimplifiedCharacters:()=>cleanup.proxies++,performance:{now:()=>now},
  requestAnimationFrame:callback=>{queueMicrotask(()=>{now=++frames===1?(end-start)*500:(end-start)*1000+10;callback(now)})},
 };
 vm.createContext(c);const exported=vm.runInContext(`({${exportMethod}}).exportVideo`,c);
 const stage={readyAssets:async()=>{},createExportCharacters:()=>new Map(),apply(t){samples.push({t,pose:sampleObject(actor,t).pose})},setShotCamera(t){const camera=activeCamera(p,t);samples.at(-1).camera=camera.id;return camera},cleanRender(){},shotCamera:{}};
 const blob=await exported.call(stage,p,v=>progress.push(v),new AbortController().signal,{start,end});
 assert.ok(blob.size>0);assert.equal(progress.at(-1),1);assert.ok(samples.length>=3);
 assert.ok(samples.every(s=>s.t>=start&&s.t<end),'export draws only inside [start, end)');
 assert.ok(samples.every(s=>s.camera===first.id),'end must not render next camera');
 assert.ok(samples.every(s=>s.pose==='walk'),'end must not render next action');
 assert.equal(samples.at(-1).t,shotReference.lastFrameTime(start,end,fps));
 assert.deepEqual(cleanup,{renderer:1,track:1,proxies:1});
}
for(const [start,end,fps] of [[0,1,24],[.2,.925,25],[.2,.225,24]]){
 test(`real video exporter keeps tail before next shot/action: ${start}–${end}s at ${fps}fps`,()=>recordBoundary(start,end,fps));
}
