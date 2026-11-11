import test from 'node:test';
import assert from 'node:assert/strict';
import {planVideoResult,submittedReferenceSnapshot,createVideoGeneration} from '../src/video-generation.mjs';
import {referenceSnapshotFor,sourceFingerprint} from '../src/workstation/asset-image-context.mjs';
import {pendingVideoReferenceChanges} from '../src/shot-production.mjs';
import {collectVideoVersions} from '../src/video-versions.mjs';

test('a bundled empty generator stays an input and its output joins a separate version group',()=>{
 const source={id:'generator',type:'video',title:'镜头一',text:'原始描述',videoDraft:{prompt:'参考 @图片1 缓慢推进'},x:400,y:100,w:280};
 const bundle={id:'shot-1',name:'镜头一',shotBundle:true,shotSourceId:source.id,collapsed:true,memberIds:['text','image',source.id]};
 const project={nodes:[{id:'text',type:'text',title:'分镜',x:0,y:0,w:280},{id:'image',type:'image',title:'场景',src:'scene',x:0,y:300,w:280},source],edges:[{from:'text',to:source.id},{from:'image',to:source.id}],boardGroups:[bundle]};
 const job={id:'job-1',sourceId:source.id,sourceText:source.text,prompt:source.videoDraft.prompt,referenceIds:['image'],references:[{nodeId:'image',kind:'image',alias:'图片1',purpose:'scene'}],referenceSnapshot:[{nodeId:'image',kind:'image',srcHash:sourceFingerprint('scene')}]};
 const before=structuredClone(project);
 const plan=planVideoResult(project,job,'data:video/mp4;base64,AAAA',extra=>({id:'result',type:'video',w:280,...extra}));
 assert.equal(plan.replace,false);
 assert.deepEqual(project,before,'planning must not modify the bundle or generator');
 assert.equal(plan.node.id,'result');
 assert.equal(plan.node.generatedSource,source.id);
 assert.equal(plan.node.referenceSnapshot.length,1);assert.equal(plan.node.referenceSnapshot[0].nodeId,'image');assert.match(plan.node.referenceSnapshot[0].srcHash,/^[a-f0-9]{16}$/);
 assert.deepEqual(plan.edges,[{from:source.id,to:'result'},{from:'image',to:'result'}]);
 project.nodes.push(plan.node);project.edges.push(...plan.edges);
 const versions=collectVideoVersions(project,plan.node.id,()=> 'versions-1');
 assert.ok(versions,'the result must not be claimed by the shot bundle');
 assert.equal(versions.sourceNodeId,source.id);
 assert.deepEqual(versions.memberIds,['result']);
 assert.deepEqual(bundle.memberIds,['text','image',source.id]);
 assert.equal(project.nodes.find(n=>n.id===source.id),source);
 assert.equal(source.src,undefined);
 assert.equal(source.generatedTask,undefined);
});


test('task center reads the video engine ledger and receives changes without a second store or paid requests',async()=>{
 const previousDocument=globalThis.document;
 globalThis.document={querySelectorAll:()=>[]};
 try{
  let current={id:'p',nodes:[],edges:[]},changed=0;
  const calls=[],generation=createVideoGeneration({project:()=>current,api:async(...args)=>{calls.push(args);return {jobs:[{id:'j',projectId:'p',status:'failed',prompt:'测试',createdAt:1}]};},onTasksChanged:id=>{assert.equal(id,'p');changed++;}});
  assert.deepEqual(generation.getTasks(),[]);
  await generation.syncBoard(true);
  assert.equal(changed,1);assert.equal(generation.getTasks()[0].status,'failed');
  const snapshot=generation.getTasks();snapshot[0].status='succeeded';snapshot.push({id:'not-real'});
  assert.equal(generation.getTasks().length,1);assert.equal(generation.getTasks()[0].status,'failed');
  assert.deepEqual(calls,[['/api/oiioii/video/tasks?projectId=p']]);
  current={id:'other',nodes:[],edges:[]};assert.deepEqual(generation.getTasks(),[],'never display another project ledger');
 }finally{globalThis.document=previousDocument;}
});

test('a result keeps the submission snapshot after the project image changes to B and flags it for review',()=>{
 const version=(id)=>({id,mediaId:'m-'+id,mime:'image/png',size:10,width:160,height:90,createdAt:id==='v1'?1:2,name:id+'.png'});
 const project={nodes:[{id:'generator',type:'video',title:'镜头',text:''},{id:'img',type:'image',title:'A',src:'data:image/png;base64,AAAA',storyImageRef:{assetId:'a1',versionId:'v1'}}],edges:[],
  workstation:{story:{shots:[],assets:[{id:'a1',kind:'scene',name:'场景',imageVersions:[version('v1'),version('v2')],selectedImageId:'v1'}]}}};
 const snapshot=referenceSnapshotFor(project,[{nodeId:'img'}]);
 const job={id:'snap-job',sourceId:'generator',sourceText:'',prompt:'镜头',referenceIds:['img'],references:[{nodeId:'img',kind:'image'}],referenceSnapshot:snapshot};
 const image=project.nodes.find(node=>node.id==='img');
 image.src='data:image/png;base64,BBBB';image.storyImageRef={assetId:'a1',versionId:'v2'};
 project.workstation.story.assets[0].selectedImageId='v2';
 const plan=planVideoResult(project,job,'data:video/mp4;base64,AAAA',extra=>({id:'result',type:'video',...extra}));
 assert.deepEqual(plan.node.referenceSnapshot,snapshot);
 assert.deepEqual(plan.node.referenceSnapshot,[{nodeId:'img',kind:'image',assetId:'a1',versionId:'v1'}]);
 const pending=pendingVideoReferenceChanges(project,plan.node);
 assert.equal(pending.length,1);assert.equal(pending[0].assetId,'a1');assert.equal(pending[0].versionId,'v1');assert.equal(pending[0].currentVersionId,'v2');
});
test('an old job without a snapshot is marked unknown instead of reading the current image',()=>{
 const job={id:'old',sourceId:'generator',references:[{nodeId:'img',kind:'image'}]};
 assert.deepEqual(submittedReferenceSnapshot(job),[{nodeId:'img',kind:'image',legacy:true,unknown:true}]);
 const project={nodes:[{id:'generator',type:'video'},{id:'img',type:'image',src:'B',storyImageRef:{assetId:'a1',versionId:'v2'}}],edges:[],workstation:{story:{assets:[]}}};
 const plan=planVideoResult(project,job,'generated',extra=>({id:'result',type:'video',...extra}));
 assert.deepEqual(plan.node.referenceSnapshot,[{nodeId:'img',kind:'image',legacy:true,unknown:true}]);
 assert.equal(plan.node.referenceSnapshot[0].versionId,undefined);
});
