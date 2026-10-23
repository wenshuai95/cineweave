import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeliverPage} from '../src/workstation/deliver-page.mjs';
import {starterProject,validateProject} from '../src/model.mjs';

function fixture(t,{job,failPoll=false,failCanvas=false,health={ffmpeg:true,ffprobe:true}}={}){
 const p=validateProject(starterProject()),ws=p.workstation;
 ws.assets=[{id:'media',kind:'video',name:'测试镜头',mime:'video/mp4',size:4,durationSec:1,width:1280,height:720,createdAt:1}];
 ws.sequence.video=[{id:'clip',assetId:'media',start:0,in:0,out:24,volume:1,muted:false}];
 const controls=new Map(),root={innerHTML:'',querySelector:id=>{if(!controls.has(id))controls.set(id,{style:{},textContent:'',open:false});return controls.get(id)},querySelectorAll:()=>[]};
 const downloads=[],messages=[],requests=[],canvasResults=[];
 const priorDoc=globalThis.document;
 globalThis.document={createElement:()=>({click(){downloads.push(this.download)}})};
 t.after(()=>{globalThis.document=priorDoc});
 const timer=globalThis.setTimeout;t.mock.method(globalThis,'setTimeout',(fn,ms,...rest)=>ms===30000?0:timer(fn,ms,...rest));
 t.mock.method(globalThis,'fetch',async path=>{
  requests.push(path);
  if(path==='/api/workstation/health')return {ok:true,json:async()=>health};
  if(path.startsWith('/api/workstation/media?'))return {ok:true,json:async()=>({id:'uploaded'})};
  if(path==='/api/workstation/export')return {ok:true,json:async()=>({id:'job',frames:24,fps:24,height:720})};
  if(path==='/api/workstation/export/job'&&failPoll)throw Error('测试连接中断');
  if(path==='/api/workstation/export/job')return {ok:true,json:job||(async()=>({status:'done',progress:1,frames:24,fps:24,height:720}))};
  if(path.endsWith('/file'))return {ok:true,blob:async()=>new Blob(['mp4'])};
  throw Error('Unexpected request '+path);
 });
 const page=createDeliverPage(root,{embedded:true,project:()=>p,toast:m=>messages.push(m),persist(){},addCutToCanvas:async(blob,info)=>{if(failCanvas)throw Error('画布已满');canvasResults.push({blob,info});return 'cut-result';},mediaStore:{blob:async()=>new Blob(['media'])},updateExportTask:async(_pid,patch)=>{
  const task=ws.deliver.tasks.find(t=>t.id===patch.id);if(task)Object.assign(task,patch);else ws.deliver.tasks.push(patch);
 }});
 return {page,root,controls,p,downloads,messages,requests,canvasResults};
}
test('reopening export while a task is pending keeps one poll and automatic download',async t=>{
 let resolve;const gate=new Promise(r=>resolve=r);
 const f=fixture(t,{job:()=>gate});await f.page.onShow();
 const exporting=f.controls.get('#wsDlExport').onclick();
 await new Promise(setImmediate);
 assert.equal(f.requests.filter(p=>p==='/api/workstation/export/job').length,1);
 f.page.onHide();await f.page.onShow();
 assert.equal(f.requests.filter(p=>p==='/api/workstation/export/job').length,1,'opening the panel does not replace the live poll');
 resolve({status:'done',progress:1,frames:24,fps:24,height:720});await exporting;
 assert.equal(f.downloads.length,1);assert.match(f.downloads[0],/\.mp4$/);assert.equal(f.p.workstation.deliver.tasks[0].status,'done');
 assert.match(f.root.innerHTML,/<details class="ws-deliver-tasks"/);assert.doesNotMatch(f.root.innerHTML,/<h2>交付/);
});
test('a failed status request stays recoverable and reports the error without a scope crash',async t=>{
 const f=fixture(t,{failPoll:true});await f.page.onShow();
 await assert.doesNotReject(()=>f.controls.get('#wsDlExport').onclick());
 assert.match(f.controls.get('#wsDlStatus').textContent,/测试连接中断/);
 assert.match(f.controls.get('#wsDlStatus').textContent,/刷新状态/);
 assert.equal(f.p.workstation.deliver.tasks[0].status,'running');assert.equal(f.downloads.length,0);
 assert.match(f.root.innerHTML,/开始导出 MP4/);
});

 test('export to canvas retains its original target while reopened and does not download a duplicate file',async t=>{
  let resolve;const gate=new Promise(r=>resolve=r),f=fixture(t,{job:()=>gate});
  f.p.nodes=[{id:'source-node',mediaId:'media'}];
  await f.page.onShow({destination:'canvas'});
  const exporting=f.controls.get('#wsDlExport').onclick();await new Promise(setImmediate);
  await f.page.onShow({destination:'file'});
  resolve({status:'done',progress:1,frames:24,fps:24,height:720});await exporting;
  assert.equal(f.canvasResults.length,1);assert.equal(f.downloads.length,0);
  assert.equal(f.canvasResults[0].info.projectId,f.p.id);assert.deepEqual(f.canvasResults[0].info.sourceNodeIds,['source-node']);
  assert.equal(f.canvasResults[0].info.frames,24);assert.equal(f.p.workstation.deliver.tasks[0].canvasNodeId,'cut-result');
 });
 test('failed canvas handoff keeps the completed export available for retry',async t=>{
  const f=fixture(t,{failCanvas:true});await f.page.onShow({destination:'canvas'});await f.controls.get('#wsDlExport').onclick();
  assert.equal(f.p.workstation.deliver.tasks[0].status,'done');assert.match(f.p.workstation.deliver.tasks[0].message,/画布已满/);
  assert.equal(f.downloads.length,0);assert.match(f.messages.join(' '),/导出记录重试/);
 });

test('empty export explains the missing step, destination and local cost without starting a job',async t=>{
 const f=fixture(t);f.p.workstation.sequence.video=[];
 await f.page.onShow({destination:'canvas'});
 assert.match(f.root.innerHTML,/时间线还没有片段/);
 assert.match(f.root.innerHTML,/不消耗模型积分/);
 assert.match(f.root.innerHTML,/不会额外下载文件/);
 assert.match(f.root.innerHTML,/<button id="wsDlExport"[^>]*disabled/);
 await f.controls.get('#wsDlExport').onclick();
 assert.equal(f.requests.some(path=>path==='/api/workstation/export'),false);
});
test('missing ffprobe disables export even when ffmpeg exists',async t=>{
 const f=fixture(t,{health:{ffmpeg:true,ffprobe:false}});await f.page.onShow();
 assert.match(f.root.innerHTML,/<button id="wsDlExport"[^>]*disabled/);
 await f.controls.get('#wsDlExport').onclick();
 assert.equal(f.requests.some(path=>path==='/api/workstation/export'),false);
 assert.match(f.messages.join(' '),/ffprobe/);
});
