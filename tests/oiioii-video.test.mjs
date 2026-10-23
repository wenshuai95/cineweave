import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm,rename,truncate} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createOiioiiVideoService,videoModels,durationAllowed} from '../oiioii-video-service.mjs';
import {planVideoResult,videoDurations} from '../src/video-generation.mjs';
import {referenceSnapshotFor} from '../src/workstation/asset-image-context.mjs';
import {pendingVideoReferenceChanges} from '../src/shot-production.mjs';
const models={models:[{id:63,name:'Video Model',sizes:['768p'],aspect_ratios:['16:9'],durations:['5','4-15'],generation_input_contract:{media:{video:true,image:true},prompt_only_supported:true}}]};
const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom000000000000')]);
const input={projectId:'project-a',sourceId:'whitebox',prompt:'cinematic scene',modelId:'63',duration:5,resolution:'768p',aspect:'16:9',references:[{nodeId:'whitebox',kind:'video',duration:5,data:'data:video/mp4;base64,'+mp4.toString('base64')}]};
const wait=async f=>{for(let i=0;i<100;i++){if(await f())return;await new Promise(r=>setTimeout(r,10));}throw Error('state timeout');};
test('mixed image, whitebox video and audio reach dry-run and paid request once, with resolved mentions',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-mixed-')),calls=[];
 const mixedModels=structuredClone(models);mixedModels.models[0].generation_input_contract.media.audio=true;
 const png=Buffer.from([137,80,78,71,13,10,26,10]);const wav=Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(32)]);
 const b={...input,prompt:'@图片1 的庭院，用 @视频1 的运镜，以 @音频1 的节奏推进',references:[{nodeId:'i',kind:'image',alias:'图片1',data:'data:image/png;base64,'+png.toString('base64')},{...input.references[0],alias:'视频1'},{nodeId:'a',kind:'audio',alias:'音频1',data:'data:audio/wav;base64,'+wav.toString('base64')}]};
 const run=async a=>{calls.push(a);if(a[0]==='inspect')return mixedModels;if(a[0]==='points')return {estimated_points:10,sufficient:true};if(a[0]==='workspace')return {workspace_id:'work'};if(a[0]==='upload')return {uri:'hogi://'+(a[2].endsWith('.wav')?'audio':a[2].endsWith('.png')?'image':'video')+'/test'};if(a.includes('--dry-run'))return {valid:true};if(a[0]==='video')return {local_task_id:'mixed-task'};};
 try{const s=createOiioiiVideoService({folder,run,probe:async()=>5}),q=await s.quote(b),j=await s.generate({quoteId:q.quoteId});await wait(async()=>(await s.list(b.projectId))[0].status==='pending');
  const submissions=calls.filter(a=>a[0]==='video');assert.equal(submissions.length,2);
  for(const a of submissions){assert.ok(a.includes('--image'));assert.ok(a.includes('--video'));assert.ok(a.includes('--audio'));assert.match(a[a.indexOf('--prompt')+1],/第1段参考音频/);}
  assert.deepEqual(j.referenceIds,['i','whitebox','a']);assert.equal(j.references[2].alias,'音频1');
  assert.equal((await s.generate({quoteId:q.quoteId})).id,j.id);
  await assert.rejects(s.quote({...b,references:[...b.references,b.references[2]]}),/重复/);
  await assert.rejects(s.quote({...b,prompt:'@音频2'}),/已移除/);
  await assert.rejects(s.quote({...b,prompt:'@音频1',references:[{...b.references[2],data:'data:audio/wav;base64,AAAA'}]}),/不匹配/);
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('video catalog constraints include duration ranges',()=>{assert.equal(durationAllowed(4,['5','4-15']),true);assert.equal(durationAllowed(16,['4-15']),false);assert.deepEqual(videoDurations(['5','4-6']),[4,5,6]);assert.equal(videoModels(models)[0].media.video,true);});
test('video uploads, dry-runs, submits once and recovers persisted output',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-adapter-'));let submitted=0,uploads=0;const calls=[];
 const run=async args=>{calls.push(args);if(args[0]==='inspect')return models;if(args[0]==='points')return {estimated_points:20,sufficient:true};if(args[0]==='workspace')return {workspace_id:'work'};if(args[0]==='upload'){uploads++;return {uri:'hogi://video/test'};}if(args[0]==='video'){if(args.includes('--dry-run'))return {valid:true};submitted++;return {local_task_id:'task-id'};}if(args[0]==='task')return {task:{status:'succeeded',resourceUris:['hogi://video/output'],credentialFingerprint:'SECRET'}};if(args[0]==='record'){const path=args[args.indexOf('--output')+1];await writeFile(path,mp4);return {path};}};
 try{const service=createOiioiiVideoService({folder,run,probe:async()=>5}),q=await service.quote(input);assert.equal(q.points,20);const [a,b]=await Promise.all([service.generate({quoteId:q.quoteId}),service.generate({quoteId:q.quoteId})]);assert.equal(a.id,b.id);await wait(async()=>(await service.list(input.projectId))[0].status==='pending');const requote=await service.quote({...input,aspect:'16:9'});assert.equal((await service.generate({quoteId:requote.quoteId})).id,a.id);assert.equal(submitted,1);assert.equal(uploads,1);assert.ok(calls.find(a=>a[0]==='video'&&a.includes('--dry-run')));const job=await service.poll(a.id);assert.equal(job.status,'succeeded');assert.ok(!JSON.stringify(job).includes('SECRET'));assert.deepEqual(job.referenceIds,['whitebox']);assert.deepEqual(await service.file(a.id),mp4);assert.equal((await service.list('other')).length,0);const restored=createOiioiiVideoService({folder,run});assert.equal((await restored.list(input.projectId))[0].status,'succeeded');assert.deepEqual(await restored.file(a.id),mp4);assert.ok(!(await readFile(join(folder,'jobs.json'),'utf8')).includes('data:video'));}finally{await rm(folder,{recursive:true,force:true});}
});
test('invalid references and insufficient balance never submit',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-invalid-'));let submitted=0;const run=async a=>{if(a[0]==='inspect')return models;if(a[0]==='points')return {estimated_points:20,sufficient:false};submitted++;};try{const s=createOiioiiVideoService({folder,run});await assert.rejects(s.quote({...input,references:[{...input.references[0],kind:'audio'}]}),/不支持/);await assert.rejects(s.quote({...input,duration:50}),/参数/);await assert.rejects(s.quote({...input,references:[{...input.references[0],data:'data:video/mp4;base64,AAAA'}]}),/不匹配/);const q=await s.quote(input);await assert.rejects(s.generate({quoteId:q.quoteId}),/不足/);assert.equal(submitted,0);}finally{await rm(folder,{recursive:true,force:true});}
});
test('ambiguous submission is persisted and never submitted twice',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-unknown-'));let submits=0;const run=async a=>{if(a[0]==='inspect')return models;if(a[0]==='points')return {estimated_points:20};if(a[0]==='workspace')return {workspace_id:'w'};if(a[0]==='video'&&a.includes('--dry-run'))return {valid:true};if(a[0]==='video'){submits++;throw Error('network lost');}};
 try{const s=createOiioiiVideoService({folder,run}),q=await s.quote({...input,references:[]}),j=await s.generate({quoteId:q.quoteId});await wait(async()=>(await s.list(input.projectId))[0].status==='unknown');assert.equal((await s.poll(j.id)).status,'unknown');assert.equal((await s.generate({quoteId:q.quoteId})).id,j.id);const again=createOiioiiVideoService({folder,run});assert.equal((await again.poll(j.id)).status,'unknown');const requote=await again.quote({...input,references:[]});assert.equal((await again.generate({quoteId:requote.quoteId})).id,j.id);assert.equal(submits,1);}finally{await rm(folder,{recursive:true,force:true});}
});
test('unfinished submission becomes unknown on restart',async()=>{const folder=await mkdtemp(join(tmpdir(),'video-restart-'));try{await writeFile(join(folder,'jobs.json'),JSON.stringify([{id:'task',projectId:'p',status:'submitting'}]));const s=createOiioiiVideoService({folder,run:async()=>{throw Error('must not run')}});assert.equal((await s.list('p'))[0].status,'unknown');}finally{await rm(folder,{recursive:true,force:true});}});
test('video result keeps whitebox and reference wires; empty target reused; repeat idempotent',()=>{const p={nodes:[{id:'whitebox',type:'video',src:'original'},{id:'ref',type:'image'}],edges:[]},job={id:'t',sourceId:'whitebox',prompt:'scene',referenceIds:['whitebox','ref']};const r=planVideoResult(p,job,'generated',e=>({id:'result',type:'video',...e}));assert.equal(r.replace,false);assert.equal(p.nodes[0].src,'original');assert.deepEqual(r.edges,[{from:'whitebox',to:'result'},{from:'ref',to:'result'}]);p.nodes.push(r.node);assert.equal(planVideoResult(p,job,'generated',()=>{}).already,true);const empty={nodes:[{id:'empty',type:'video'}],edges:[]};assert.equal(planVideoResult(empty,{...job,sourceId:'empty'},'gen',()=>{}).replace,true);});

test('an unavailable task ledger prevents paid submission',async()=>{
 const root=await mkdtemp(join(tmpdir(),'video-disk-')),folder=join(root,'blocked');await writeFile(folder,'blocked');let submits=0;
 const run=async a=>{if(a[0]==='inspect')return models;if(a[0]==='points')return {estimated_points:20};submits++;};
 try{const service=createOiioiiVideoService({folder,run}),quote=await service.quote(input);await assert.rejects(service.generate({quoteId:quote.quoteId}),/尚未提交/);assert.equal(submits,0);await assert.rejects(service.list(input.projectId),/任务记录无法读取/);}finally{await rm(root,{recursive:true,force:true});}
});
test('a post-submission disk failure is contained without duplicate charge',async()=>{
 const root=await mkdtemp(join(tmpdir(),'video-final-save-')),folder=join(root,'ledger');let submits=0;
 const run=async a=>{if(a[0]==='inspect')return models;if(a[0]==='points')return {estimated_points:20};if(a[0]==='workspace')return {workspace_id:'w'};if(a[0]==='video'&&a.includes('--dry-run'))return {valid:true};if(a[0]==='video'){submits++;await rename(folder,folder+'-backup');await writeFile(folder,'blocked');return {local_task_id:'known-task'};}};
 try{const service=createOiioiiVideoService({folder,run}),q=await service.quote({...input,references:[]}),job=await service.generate({quoteId:q.quoteId});await wait(async()=>(await service.list(input.projectId))[0].message?.includes('记录保存失败'));const q2=await service.quote({...input,references:[]});assert.equal((await service.generate({quoteId:q2.quoteId})).id,job.id);assert.equal(submits,1);}finally{await rm(root,{recursive:true,force:true});}
});
test('large generated files stay downloadable without inflating the project',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-large-'));let submits=0;
 const run=async a=>{if(a[0]==='inspect')return models;if(a[0]==='points')return {estimated_points:20};if(a[0]==='workspace')return {workspace_id:'w'};if(a[0]==='video'&&a.includes('--dry-run'))return {valid:true};if(a[0]==='video'){submits++;return {local_task_id:'large-task'};}if(a[0]==='task')return {task:{status:'succeeded',resourceUris:['hogi://video/large']}};if(a[0]==='record'){const path=a[a.indexOf('--output')+1];await writeFile(path,mp4);await truncate(path,26*1024*1024);return {path};}};
 try{const service=createOiioiiVideoService({folder,run}),q=await service.quote({...input,references:[]}),job=await service.generate({quoteId:q.quoteId});await wait(async()=>(await service.list(input.projectId))[0].status==='pending');const done=await service.poll(job.id);assert.equal(done.status,'succeeded');assert.equal(done.downloadOnly,true);assert.equal(done.bytes,26*1024*1024);assert.ok(done.videoUrl);assert.equal(submits,1);}finally{await rm(folder,{recursive:true,force:true});}
});
test('quote probes real reference duration, bills the rounded-up value and cleans temp files',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-probe-'));const calls=[];let uploads=0;
 const run=async a=>{calls.push(a);if(a[0]==='inspect')return models;if(a[0]==='points')return {estimated_points:20,sufficient:true};if(a[0]==='workspace')return {workspace_id:'w'};if(a[0]==='upload'){uploads++;return {uri:'hogi://video/test'};}if(a[0]==='video')return a.includes('--dry-run')?{valid:true}:{local_task_id:'probe-task'};};
 try{const s=createOiioiiVideoService({folder,run,probe:async()=>5.4}),q=await s.quote(input);
  assert.equal(q.referenceDuration,5.4);assert.equal(q.billableReferenceDuration,6);
  const points=calls.find(a=>a[0]==='points');assert.equal(points[points.indexOf('--reference-video-duration')+1],'6');
  assert.equal(uploads,0);assert.deepEqual(await readdir(folder),[]);
  const j=await s.generate({quoteId:q.quoteId});await wait(async()=>(await s.list(input.projectId))[0].status==='pending');
  const job=(await s.list(input.projectId))[0];
  assert.deepEqual(job.references,[{nodeId:'whitebox',kind:'video',alias:null,duration:5.4}]);
  assert.equal(job.actualPoints,undefined);
  const requote=await s.quote(input);assert.equal((await s.generate({quoteId:requote.quoteId})).id,j.id);
  const broken=createOiioiiVideoService({folder,run,probe:async()=>{throw Error('ffprobe missing');}});
  await assert.rejects(broken.quote(input),/时长/);
  assert.deepEqual((await readdir(folder)).filter(f=>f.includes('.probe.')),[]);
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('a corrupted task ledger blocks paid submission instead of resetting',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-corrupt-'));await writeFile(join(folder,'jobs.json'),'{not json');
 let submits=0;const run=async a=>{if(a[0]==='inspect')return models;if(a[0]==='points')return {estimated_points:20};submits++;};
 try{const s=createOiioiiVideoService({folder,run}),q=await s.quote(input);
  await assert.rejects(s.generate({quoteId:q.quoteId}),/尚未提交/);
  assert.equal(submits,0);
  await assert.rejects(s.list(input.projectId),/任务记录无法读取/);
  assert.equal(await readFile(join(folder,'jobs.json'),'utf8'),'{not json');
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('reference purposes and generation snapshot persist across restart',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-purpose-'));const calls=[];
 const png=Buffer.from([137,80,78,71,13,10,26,10]);
 const b={...input,references:[{nodeId:'i',kind:'image',alias:'图片1',purpose:'style',data:'data:image/png;base64,'+png.toString('base64')},{nodeId:'whitebox',kind:'video',alias:'视频1',purpose:'camera',duration:5,data:input.references[0].data}]};
 const run=async a=>{calls.push(a);if(a[0]==='inspect')return models;if(a[0]==='points')return {estimated_points:20,sufficient:true};if(a[0]==='workspace')return {workspace_id:'w'};if(a[0]==='upload')return {uri:'hogi://'+(a[2].endsWith('.png')?'image':'video')+'/test'};if(a[0]==='video')return a.includes('--dry-run')?{valid:true}:{local_task_id:'purpose-task',actual_points:33,verbose_dump:'RAW-SECRET'};};
 try{const s=createOiioiiVideoService({folder,run}),q=await s.quote(b),j=await s.generate({quoteId:q.quoteId});
  await wait(async()=>(await s.list(b.projectId))[0].status==='pending');
  const job=(await s.list(b.projectId))[0];
  assert.deepEqual(job.references,[{nodeId:'i',kind:'image',alias:'图片1',purpose:'style'},{nodeId:'whitebox',kind:'video',alias:'视频1',purpose:'camera',duration:5}]);
  assert.equal(job.modelId,'63');assert.equal(job.modelName,'Video Model');assert.equal(job.duration,5);assert.equal(job.resolution,'768p');assert.equal(job.aspect,'16:9');
  assert.equal(job.points,20);assert.equal(job.actualPoints,undefined);
  assert.ok(!JSON.stringify(job).includes('RAW-SECRET'));
  assert.ok(!(await readFile(join(folder,'jobs.json'),'utf8')).includes('RAW-SECRET'));
  const submit=calls.find(a=>a[0]==='video'&&!a.includes('--dry-run'));assert.match(submit[submit.indexOf('--prompt')+1],/画面风格|镜头运动/);
  const again=createOiioiiVideoService({folder,run});const restored=(await again.list(b.projectId))[0];
  assert.deepEqual(restored.references,job.references);assert.equal(restored.actualPoints,undefined);assert.equal(restored.modelId,'63');assert.equal(restored.aspect,'16:9');
  await assert.rejects(again.quote({...b,references:[{...b.references[0],purpose:'motion'}]}),/用途/);
  await assert.rejects(again.quote({...b,references:[{...b.references[1],purpose:'bogus'}]}),/用途/);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('actual cost comes from the matching charged resource receipt, never submission estimates',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-receipt-'));let costCalls=0;
 const run=async a=>{if(a[0]==='inspect')return models;if(a[0]==='points'&&a[1]==='quote')return {estimated_points:20};if(a[0]==='points'&&a[1]==='cost'){costCalls++;return {entries:[{uri:'hogi://video/unrelated',status:'charged',consumed_points:999},{uri:'hogi://video/receipt',status:'charged',consumed_points:26}]};}if(a[0]==='workspace')return {workspace_id:'w'};if(a[0]==='video')return a.includes('--dry-run')?{valid:true}:{local_task_id:'receipt-task',actual_points:888};if(a[0]==='task')return {task:{status:'succeeded',resourceUris:['hogi://video/receipt']}};if(a[0]==='record'){const path=a[a.indexOf('--output')+1];await writeFile(path,mp4);return {path};}};
 try{const s=createOiioiiVideoService({folder,run}),q=await s.quote({...input,references:[]}),j=await s.generate({quoteId:q.quoteId});await wait(async()=>(await s.list(input.projectId))[0].status==='pending');assert.equal((await s.list(input.projectId))[0].actualPoints,undefined);const done=await s.poll(j.id);assert.equal(done.points,20);assert.equal(done.actualPoints,26);assert.equal(costCalls,1);const restored=createOiioiiVideoService({folder,run});assert.equal((await restored.list(input.projectId))[0].actualPoints,26);}finally{await rm(folder,{recursive:true,force:true});}
});

test('valid JSON of the wrong ledger shape also blocks paid work without rewriting',async()=>{
 for(const raw of ['"wrong"','{}','[null]','[{"id":"good","projectId":"p"},null]']){
 const folder=await mkdtemp(join(tmpdir(),'video-ledger-shape-'));await writeFile(join(folder,'jobs.json'),raw);let submits=0;
 const run=async a=>{if(a[0]==='inspect')return models;if(a[0]==='points')return {estimated_points:20};submits++;};
 try{const s=createOiioiiVideoService({folder,run}),q=await s.quote({...input,references:[]});await assert.rejects(s.generate({quoteId:q.quoteId}),/尚未提交/);await assert.rejects(s.list('p'),/无法读取/);assert.equal(submits,0);assert.equal(await readFile(join(folder,'jobs.json'),'utf8'),raw);}finally{await rm(folder,{recursive:true,force:true});}
 }
});

test('audio is probed from real bytes before quoting; invalid audio cannot upload or submit',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-audio-preflight-')),calls=[];
 const catalog=structuredClone(models);catalog.models[0].generation_input_contract.media.audio=true;
 const wav=Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(32)]);
 const b={...input,references:[{nodeId:'audio',kind:'audio',alias:'音频1',duration:99,data:'data:audio/wav;base64,'+wav.toString('base64')}]};
 const run=async a=>{calls.push(a);if(a[0]==='inspect')return catalog;if(a[0]==='points')return {estimated_points:20,sufficient:true};throw Error('must never upload during quote');};
 try{const service=createOiioiiVideoService({folder,run,probe:async file=>{assert.match(file,/\.wav$/);assert.deepEqual(await readFile(file),wav);return 1.8;}});
  const quote=await service.quote(b);assert.equal(quote.references[0].duration,1.8);assert.equal(calls.filter(a=>a[0]==='upload'||a[0]==='video').length,0);
  assert.deepEqual(await readdir(folder),[]);
  const bad=createOiioiiVideoService({folder,run,probe:async()=>0});await assert.rejects(bad.quote(b),/音频时长/);
  assert.equal(calls.filter(a=>a[0]==='points').length,1,'invalid audio must not reach quoting');
  assert.deepEqual(await readdir(folder),[]);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('real upload and validation stages survive task-list queries and do not imply a paid retry',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-stages-'));let releaseUpload,releaseValidation;
 const uploadGate=new Promise(r=>releaseUpload=r),validationGate=new Promise(r=>releaseValidation=r);let paid=0;
 const run=async a=>{if(a[0]==='inspect')return models;if(a[0]==='points')return {estimated_points:20};if(a[0]==='workspace')return {workspace_id:'w'};if(a[0]==='upload'){await uploadGate;return {uri:'hogi://video/ref'};}if(a.includes('--dry-run')){await validationGate;return {valid:false};}if(a[0]==='video'){paid++;return {local_task_id:'bad'};}};
 try{const s=createOiioiiVideoService({folder,run,probe:async()=>5}),q=await s.quote(input),job=await s.generate({quoteId:q.quoteId});
  await wait(async()=>(await s.list(input.projectId))[0]?.phase==='uploading');
  const uploading=(await s.list(input.projectId))[0];assert.equal(uploading.totalReferences,1);assert.equal(uploading.completedReferences,0);assert.match(uploading.message,/1 \/ 1/);
  releaseUpload();await wait(async()=>(await s.list(input.projectId))[0]?.phase==='validating');
  assert.equal((await s.list(input.projectId))[0].completedReferences,1);
  releaseValidation();await wait(async()=>(await s.list(input.projectId))[0]?.status==='failed');
  const failed=await s.poll(job.id);assert.equal(failed.phase,'failed');assert.equal(failed.references[0].duration,5);assert.equal(paid,0);
  const restored=createOiioiiVideoService({folder,run});assert.equal((await restored.list(input.projectId))[0].phase,'failed');
 }finally{releaseUpload?.();releaseValidation?.();await rm(folder,{recursive:true,force:true});}
});

test('submission reference snapshot persists across restart and is not replaced by a later image change',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-snapshot-')),png=Buffer.from([137,80,78,71,13,10,26,10]);
 const version=(id)=>({id,mediaId:'m-'+id,name:id+'.png',mime:'image/png',size:12,width:320,height:180,createdAt:id==='v1'?1:2});
 const project={nodes:[{id:'whitebox',type:'video',title:'镜头',text:''},{id:'img',type:'image',title:'A',src:'data:image/png;base64,AAAA',storyImageRef:{assetId:'a1',versionId:'v1'}}],edges:[],
  workstation:{story:{shots:[],assets:[{id:'a1',kind:'scene',name:'场景',imageVersions:[version('v1'),version('v2')],selectedImageId:'v1'}]}}};
 const snapshot=referenceSnapshotFor(project,[{nodeId:'img'}]);
 const b={...input,prompt:'镜头',references:[{nodeId:'img',kind:'image',alias:'图片1',data:'data:image/png;base64,'+png.toString('base64')}],referenceSnapshot:snapshot};
 const run=async a=>{if(a[0]==='inspect')return models;if(a[0]==='points')return {estimated_points:20,sufficient:true};if(a[0]==='workspace')return {workspace_id:'w'};if(a[0]==='upload')return {uri:'hogi://image/ref'};if(a[0]==='video')return a.includes('--dry-run')?{valid:true}:{local_task_id:'snapshot-task'};};
 try{
  const service=createOiioiiVideoService({folder,run}),q=await service.quote(b),job=await service.generate({quoteId:q.quoteId});
  await wait(async()=>(await service.list(b.projectId))[0].status==='pending');
  const submitted=(await service.list(b.projectId))[0];
  assert.deepEqual(submitted.referenceSnapshot,snapshot);
  const ledger=await readFile(join(folder,'jobs.json'),'utf8');
  assert.ok(ledger.includes('"referenceSnapshot"'));assert.ok(ledger.includes('"versionId":"v1"'));assert.ok(!ledger.includes('data:image'));
  const restored=createOiioiiVideoService({folder,run}),restoredJob=(await restored.list(b.projectId))[0];
  assert.equal(restoredJob.id,job.id);assert.deepEqual(restoredJob.referenceSnapshot,snapshot);
  const image=project.nodes.find(node=>node.id==='img');
  image.src='data:image/png;base64,BBBB';image.storyImageRef={assetId:'a1',versionId:'v2'};
  project.workstation.story.assets[0].selectedImageId='v2';
  const planned=planVideoResult(project,restoredJob,'data:video/mp4;base64,AAAA',extra=>({id:'result',type:'video',...extra}));
  assert.deepEqual(planned.node.referenceSnapshot,[{nodeId:'img',kind:'image',assetId:'a1',versionId:'v1'}]);
  const pending=pendingVideoReferenceChanges(project,planned.node);
  assert.equal(pending.length,1);assert.equal(pending[0].versionId,'v1');assert.equal(pending[0].currentVersionId,'v2');assert.match(pending[0].reason,/正式图/);
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('an old task without a snapshot reports unknown instead of today\'s image version',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-no-snapshot-'));
 try{
  await writeFile(join(folder,'jobs.json'),JSON.stringify([{id:'old-task',projectId:'p',status:'succeeded',references:[{nodeId:'img',kind:'image'}]}]));
  const service=createOiioiiVideoService({folder,run:async()=>{throw Error('must not run')}});
  const job=(await service.list('p'))[0];
  assert.deepEqual(job.referenceSnapshot,[{nodeId:'img',kind:'image',legacy:true,unknown:true}]);
  assert.equal(job.referenceSnapshot[0].assetId,undefined);assert.equal(job.referenceSnapshot[0].versionId,undefined);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('a plain reference fingerprint survives quote, job persistence and restart and detects replaced pixels',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'video-plain-snapshot-')),png=Buffer.from([137,80,78,71,13,10,26,10]);
 const original='data:image/png;base64,'+png.toString('base64');
 const project={nodes:[{id:'whitebox',type:'video',title:'镜头',text:''},{id:'plain-image',type:'image',title:'外部图片',src:original}],edges:[]};
 const snapshot=referenceSnapshotFor(project,[{nodeId:'plain-image'}]);
 assert.match(snapshot[0].srcHash,/^[a-f0-9]{16}$/);
 assert.equal(Object.hasOwn(snapshot[0],'assetId'),false);
 assert.equal(Object.hasOwn(snapshot[0],'versionId'),false);
 const b={...input,prompt:'外部图片参考',references:[{nodeId:'plain-image',kind:'image',alias:'图片1',data:original}],referenceSnapshot:snapshot};
 const run=async a=>{if(a[0]==='inspect')return models;if(a[0]==='points')return {estimated_points:20,sufficient:true};if(a[0]==='workspace')return {workspace_id:'w'};if(a[0]==='upload')return {uri:'hogi://image/plain-ref'};if(a[0]==='video')return a.includes('--dry-run')?{valid:true}:{local_task_id:'plain-snapshot-task'};throw Error('Unexpected mock call: '+a[0]);};
 try{
  const service=createOiioiiVideoService({folder,run}),q=await service.quote(b),job=await service.generate({quoteId:q.quoteId});
  await wait(async()=>(await service.list(b.projectId))[0].status==='pending');
  assert.deepEqual(job.referenceSnapshot,snapshot);
  const ledger=await readFile(join(folder,'jobs.json'),'utf8');
  assert.equal(JSON.parse(ledger)[0].referenceSnapshot[0].srcHash,snapshot[0].srcHash);
  assert.ok(!ledger.includes('data:image'),'the ledger must retain identity without embedding reference bytes');
  const restored=createOiioiiVideoService({folder,run}),restoredJob=(await restored.list(b.projectId))[0];
  assert.deepEqual(restoredJob.referenceSnapshot,snapshot);
  project.nodes.find(node=>node.id==='plain-image').src='data:image/png;base64,BBBB';
  const planned=planVideoResult(project,restoredJob,'data:video/mp4;base64,AAAA',extra=>({id:'plain-result',type:'video',...extra}));
  assert.deepEqual(planned.node.referenceSnapshot,snapshot);
  const pending=pendingVideoReferenceChanges(project,planned.node);
  assert.equal(pending.length,1);assert.equal(pending[0].refNodeId,'plain-image');assert.match(pending[0].reason,/参考素材已更换/);
 }finally{await rm(folder,{recursive:true,force:true});}
});
