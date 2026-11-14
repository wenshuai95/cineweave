import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTaskRecords,taskCenterCounts,filterTaskRecords,taskQueryRequest,queryTaskRecord,mergeImageTaskObservation,markTaskQueryError} from '../src/task-center.mjs';

import {creativeSourceSignature} from '../src/workstation/creative-agent.mjs';
const project=()=>{const p=({id:'p',nodes:[{id:'source',type:'text'},{id:'image-result',type:'image',generatedTask:'same'},{id:'video-result',type:'video',generatedTask:'video'}],workstation:{creativeTasks:[{id:'same',projectId:'p',flow:'story-package',status:'ready',createdAt:10,sourceNodeId:'source',message:'等待采用'}],deliver:{tasks:[{id:'export',status:'running',createdAt:40,progress:.4,sourceNodeIds:['source','gone']}]}}});p.workstation.creativeTasks[0].sourceSignature=creativeSourceSignature(p);return p;};
test('projects each original task once without mutating the canonical ledgers or conflating identical engine IDs',()=>{
 const p=project(),images=[{id:'same',projectId:'p',prompt:'旧提示',status:'pending',createdAt:20,observedAt:30},{id:'same',projectId:'p',prompt:'新提示',status:'succeeded',createdAt:20,observedAt:40},{id:'foreign',projectId:'other',status:'pending'}],videos=[{id:'video',projectId:'p',status:'pending',phase:'downloading',createdAt:30,sourceId:'source',points:20}];
 const before=structuredClone({p,images,videos}),records=collectTaskRecords({project:p,imageTasks:images,videoJobs:videos});
 assert.deepEqual({p,images,videos},before);
 assert.deepEqual(records.map(r=>r.key),['export:export','video:video','image:same','creative:same']);
 assert.equal(records.find(r=>r.kind==='image').title,'新提示');
 assert.equal(records.find(r=>r.kind==='video').label,'接收视频');
 assert.equal(records.find(r=>r.kind==='video').nodeId,'video-result');
 assert.deepEqual(records[0].sourceNodeIds,['source']);assert.equal(records[0].progress,.4);
 assert.deepEqual(taskCenterCounts(records),{all:4,active:2,ready:1,attention:0,finished:1});
 assert.equal(filterTaskRecords(records,'ready')[0].kind,'creative');assert.equal(filterTaskRecords(records,'image').length,1);
});
test('legacy image pointers remain unobserved and an uncertain submission never offers a paid replay',()=>{
 const p=project(),records=collectTaskRecords({project:p,imageTasks:{old:{id:'old',projectId:'p'},unknown:{id:'unknown',projectId:'p',status:'submitting'}},videoJobs:[{id:'uncertain',projectId:'p',status:'unknown',phase:'submitting'}]});
 const old=records.find(r=>r.id==='old'),unknown=records.find(r=>r.id==='unknown'),video=records.find(r=>r.id==='uncertain');
 assert.equal(old.label,'状态待查询');assert.equal(old.group,'attention');assert.match(old.message,/旧版/);
 assert.equal(unknown.busy,false);assert.equal(unknown.submissionUncertain,true);assert.equal(unknown.actions.copySettings,false);
 assert.equal(video.submissionUncertain,true);assert.equal(video.actions.copySettings,false);
 assert.equal(records.find(r=>r.kind==='creative').actions.cancelInDetails,false);
 for(const row of [old,unknown,video]){assert.equal(row.actions.query,true);assert.equal(taskQueryRequest(row).method,'GET');assert.match(row.recoveryNote,/不重新提交/);}
});
test('only live creative tasks have genuine cancellation, platform and export tasks cannot pretend to cancel',()=>{
 const p=project();p.workstation.creativeTasks[0].status='running';
 const records=collectTaskRecords({project:p,imageTasks:[{id:'img',projectId:'p',status:'pending'}],videoJobs:[{id:'vid',projectId:'p',status:'pending'}]});
 assert.equal(records.find(r=>r.kind==='creative').actions.cancelInDetails,true);
 for(const r of records.filter(r=>r.kind!=='creative')){assert.equal(r.actions.cancelInDetails,false);assert.match(r.cancelNote,/不支持/);}
 assert.match(records.find(r=>r.kind==='creative').cost,/取消不保证/);
});
test('recovery API calls only the original GET path, validates returned IDs and never generates a new task',async()=>{
 const record=collectTaskRecords({project:project(),videoJobs:[{id:'v',projectId:'p',status:'pending'}]}).find(r=>r.kind==='video'),calls=[];
 assert.deepEqual(taskQueryRequest(record),{method:'GET',path:'/api/oiioii/video/task/v'});
 const response=await queryTaskRecord(record,async(...args)=>{calls.push(args);return {id:'v',status:'succeeded'};});
 assert.equal(response.status,'succeeded');assert.deepEqual(calls,[['/api/oiioii/video/task/v']]);
 await assert.rejects(()=>queryTaskRecord(record,async()=>({id:'different',status:'succeeded'})),/编号/);
 assert.throws(()=>taskQueryRequest({...record,kind:'creative'}),/未知任务类型/);
 assert.throws(()=>taskQueryRequest(collectTaskRecords({project:project()}).find(r=>r.kind==='creative')),/不能/);
});
test('image observations preserve identity and scope, while a query error preserves the last platform status',()=>{
 const pointer={id:'img',projectId:'p',sourceId:'source',prompt:'私有提示',createdAt:12};
 const next=mergeImageTaskObservation(pointer,{id:'img',status:'succeeded',imageUrl:'/api/oiioii/image/img',projectId:'other',prompt:'wrong',token:'NEVER_COPY',actualPoints:0},100);
 assert.equal(next.projectId,'p');assert.equal(next.prompt,pointer.prompt);assert.equal(next.observedAt,100);assert.equal(next.status,'succeeded');assert.equal(next.actualPoints,0);assert.equal(next.token,undefined);assert.equal(pointer.status,undefined);
 const error=markTaskQueryError(next,Error('网络中断'));assert.equal(error.status,'succeeded');assert.equal(error.queryError,'网络中断');
 const refreshed=mergeImageTaskObservation(error,{id:'img',status:'succeeded'},200);assert.equal(refreshed.queryError,'');
 assert.throws(()=>mergeImageTaskObservation(pointer,{id:'other',status:'pending'}),/不一致/);
 assert.throws(()=>mergeImageTaskObservation(pointer,{id:'img',status:'nonsense'}),/无法识别/);
});
test('untrusted download URLs are not exposed and existing results do not offer duplicate canvas import',()=>{
 const p=project(),records=collectTaskRecords({project:p,imageTasks:[{id:'same',projectId:'p',status:'succeeded',imageUrl:'javascript:alert(1)'}],videoJobs:[{id:'video',projectId:'p',status:'succeeded',videoUrl:'/api/oiioii/video/file/video'},{id:'huge',projectId:'p',status:'succeeded',downloadOnly:true,videoUrl:'/api/oiioii/video/file/huge'}]});
 assert.equal(records.find(r=>r.kind==='image').outputUrl,undefined);assert.equal(records.find(r=>r.kind==='image').actions.addToCanvas,false);
 assert.equal(records.find(r=>r.id==='video').outputUrl,'/api/oiioii/video/file/video');assert.equal(records.find(r=>r.id==='huge').actions.addToCanvas,false);
});

test('changed creative sources have the same stale state in task center and conversation',()=>{
 const p=project();p.workstation.script='updated source';
 const row=collectTaskRecords({project:p}).find(r=>r.kind==='creative');
 assert.equal(row.label,'来源已变化');assert.equal(row.group,'attention');assert.equal(row.status,'ready');
 assert.equal(row.actions.open,true);assert.equal(row.actions.query,false);
});
