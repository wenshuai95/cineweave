import test from 'node:test';
import assert from 'node:assert/strict';
import {imageAssetContext,generatedImageAssets,assetReferenceImpact,planGeneratedImageAdoption,applyGeneratedImageToAsset,referenceSnapshotFor,sourceFingerprint} from '../src/workstation/asset-image-context.mjs';
import {selectAssetImage} from '../src/workstation/asset-images.mjs';
import {syncAssetImageLinks} from '../src/workstation/story-canvas.mjs';
import {planCanvasImageResult} from '../src/canvas-image-result.mjs';

const version=(id)=>({id,mediaId:'m-'+id,name:id+'.png',mime:'image/png',size:12,width:320,height:180,createdAt:1});
function fixture(){
 return {
  nodes:[
   {id:'shot-node',type:'text',title:'镜头 01',text:'画面',x:0,y:0,w:280,storyRef:{kind:'shot',id:'s1'}},
   {id:'asset-node',type:'text',title:'院子',text:'场景',x:320,y:0,w:280,storyRef:{kind:'asset',id:'a1'}},
   {id:'other-node',type:'text',title:'路人',text:'',x:600,y:0,w:280,storyRef:{kind:'asset',id:'a2'}},
   {id:'official',type:'image',title:'院子 · 正式图片',text:'',x:320,y:240,w:280,src:'data:image/png;base64,AAAA',mediaId:'m-v1',storyImageRef:{assetId:'a1',versionId:'v1'}},
   {id:'candidate',type:'image',title:'院子 · 生成候选图',text:'生成描述',x:640,y:240,w:280,src:'data:image/png;base64,BBBB',imageResultContext:{kind:'asset',sourceNodeId:'asset-node',assetId:'a1',assetName:'院子'}},
   {id:'video1',type:'video',title:'Provider · 院子',text:'',x:640,y:520,w:280,src:'data:video/mp4;base64,AAAA',mediaId:'m-video1',generatedTask:'task-1',generatedInput:{references:[{nodeId:'official'}]},referenceSnapshot:[{nodeId:'official',assetId:'a1',versionId:'v1'}]}
  ],
  edges:[{from:'official',to:'asset-node'},{from:'official',to:'shot-node'},{from:'official',to:'video1'}],
  boardGroups:[{id:'versions',name:'版本',memberIds:['video1'],collapsed:true,videoVersions:true,sourceNodeId:'shot-node',adoptedNodeId:'video1'}],
  workstation:{
   story:{shots:[{id:'s1',scene:'院子',description:'推门',assetIds:['a1']},{id:'s2',scene:'门外',description:'',assetIds:['a1','a2']}],assets:[
    {id:'a1',kind:'scene',name:'院子',imageVersions:[version('v1'),version('v2')],selectedImageId:'v1',shotIds:['s1','s2']},
    {id:'a2',kind:'character',name:'路人',imageVersions:[],shotIds:['s2']}
   ]},
   sequence:{fps:24,video:[{id:'clip1',assetId:'m-video1',start:0,in:0,out:24,versionGroupId:'versions',canvasNodeId:'video1'}]}
  }
 };
}
test('asset and shot contexts point only at their real source records; blank nodes have no context',()=>{
 const p=fixture();
 const asset=imageAssetContext(p,'asset-node');assert.equal(asset.kind,'asset');assert.equal(asset.assetId,'a1');
 const shot=imageAssetContext(p,'shot-node');assert.equal(shot.kind,'shot');assert.equal(shot.shotId,'s1');assert.deepEqual(shot.assetIds,['a1']);
 assert.equal(imageAssetContext(p,'other-node').assetId,'a2');
 p.nodes.push({id:'plain',type:'text',title:'自由笔记',text:'与资产无关'});assert.equal(imageAssetContext(p,'plain'),null);
 assert.equal(imageAssetContext(p,'missing'),null);
});
test('impact summary lists related shots, old reference, videos and cut use before an official change',()=>{
 const p=fixture(),impact=assetReferenceImpact(p,'a1');
 assert.equal(impact.oldVersion.id,'v1');assert.deepEqual(impact.shots.map(shot=>shot.id),['s1','s2']);
 assert.deepEqual(impact.videos.map(video=>video.id),['video1']);assert.equal(impact.clips,1);assert.equal(impact.submittedTasksUnchanged,true);
});
test('a candidate can be added without changing the official image; official adoption keeps the old pointer as history',()=>{
 const p=fixture(),asset=p.workstation.story.assets[0],node=p.nodes.find(node=>node.id==='candidate');
 const v3={...version('v3'),mediaId:'m-v3'};
 let result=applyGeneratedImageToAsset(p,{nodeId:'candidate',assetId:'a1',version:v3,official:false});
 assert.equal(result.official,false);assert.equal(asset.selectedImageId,'v1');assert.equal(asset.imageVersions.length,3);assert.equal(node.assetImageVersionId,'v3');assert.equal(node.storyImageRef,undefined);
 result=applyGeneratedImageToAsset(p,{nodeId:'candidate',assetId:'a1',version:v3,official:true});
 syncAssetImageLinks(p);
 assert.ok(p.edges.some(edge=>edge.from==='candidate'&&edge.to==='asset-node'&&edge.assetImageLink));assert.ok(p.edges.some(edge=>edge.from==='candidate'&&edge.to==='shot-node'&&edge.assetImageLink));assert.ok(!p.edges.some(edge=>edge.from==='official'&&edge.assetImageLink));
 assert.equal(asset.selectedImageId,'v3');assert.deepEqual(node.storyImageRef,{assetId:'a1',versionId:'v3'});assert.equal(node.mediaId,'m-v3');
 const old=p.nodes.find(node=>node.id==='official');assert.deepEqual(old.storyImageRef,{assetId:'a1',versionId:'v1'});assert.match(old.src,/base64,AAAA/);
 assert.equal(asset.imageVersions.length,3);selectAssetImage(asset,'v1');assert.equal(asset.selectedImageId,'v1');
});
test('adoption refuses a different asset and non-asset results, so a picture cannot be mis-filed',()=>{
 const p=fixture(),v3={...version('v3'),mediaId:'m-v3'};
 assert.throws(()=>applyGeneratedImageToAsset(p,{nodeId:'candidate',assetId:'a2',version:v3,official:true}),/其他资产|不在这个镜头/);
 p.nodes.push({id:'free',type:'image',title:'自由生成',text:'',src:'data:image/png;base64,CCCC',x:0,y:0,w:280,imageResultContext:null});
 assert.throws(()=>applyGeneratedImageToAsset(p,{nodeId:'free',assetId:'a1',version:v3,official:true}),/不是从资产/);
});
test('generated image results keep their source context and blank generation stays unbound',()=>{
 const p=fixture();
 const bound=planCanvasImageResult(p,{sourceId:'asset-node',taskId:'job-1',src:'data:image/png;base64,DDDD',prompt:'生成',context:imageAssetContext(p,'asset-node'),createNode:extra=>({id:'new',type:'image',...extra})});
 assert.equal(bound.node.imageResultContext.assetId,'a1');
 const blank=planCanvasImageResult(p,{sourceId:'plain',taskId:'job-2',src:'data:image/png;base64,EEEE',prompt:'生成',context:null,createNode:extra=>({id:'new2',type:'image',...extra})});
 assert.equal(blank.node.imageResultContext,undefined);
 assert.deepEqual(referenceSnapshotFor(p,[{nodeId:'official'},{nodeId:'video1'}]),[{nodeId:'official',kind:'image',assetId:'a1',versionId:'v1'},{nodeId:'video1',kind:'video',srcHash:referenceSnapshotFor(p,[{nodeId:'video1'}])[0].srcHash}]);
});
test('undo is a project snapshot: old versions and bytes references stay intact',()=>{
 const p=fixture(),asset=p.workstation.story.assets[0],node=p.nodes.find(node=>node.id==='candidate');
 const before=structuredClone(p),v3={...version('v3'),mediaId:'m-v3'};
 applyGeneratedImageToAsset(p,{nodeId:'candidate',assetId:'a1',version:v3,official:true});
 assert.equal(asset.imageVersions.some(version=>version.id==='v1'),true);
 assert.equal(node.mediaId,'m-v3');
 // Simulate the existing project-level undo transaction.
 const restored=structuredClone(before),restoredAsset=restored.workstation.story.assets[0];
 assert.equal(restoredAsset.selectedImageId,'v1');assert.equal(restoredAsset.imageVersions.some(version=>version.mediaId==='m-v1'),true);
 assert.match(restored.nodes.find(item=>item.id==='official').src,/base64,AAAA/);
});

test('the adoption planner reuses a kept version for the official click and only creates one on real content change',()=>{
 const p=fixture(),asset=p.workstation.story.assets[0],node=p.nodes.find(item=>item.id==='candidate');
 // First click: the planner has no reusable version, so the caller writes one.
 const first=planGeneratedImageAdoption(p,{nodeId:'candidate',assetId:'a1',official:false});
 assert.equal(first.reuse,false);assert.equal(first.version,null);assert.match(first.srcHash,/^[a-f0-9]{16}$/);
 const v3={...version('v3'),mediaId:'m-v3',srcHash:first.srcHash};
 applyGeneratedImageToAsset(p,{nodeId:'candidate',assetId:'a1',version:v3,official:false});
 assert.equal(asset.imageVersions.length,3);assert.equal(asset.imageVersions.at(-1).srcHash,first.srcHash);
 // Second click, now official: no second media/version is needed.
 const second=planGeneratedImageAdoption(p,{nodeId:'candidate',assetId:'a1',official:true});
 assert.equal(second.reuse,true);assert.equal(second.version.id,'v3');
 applyGeneratedImageToAsset(p,{nodeId:'candidate',assetId:'a1',version:second.version,official:true});
 assert.equal(asset.imageVersions.length,3);assert.equal(asset.selectedImageId,'v3');
 assert.deepEqual(node.storyImageRef,{assetId:'a1',versionId:'v3'});
 // Repeated keep clicks still reuse v3 instead of appending duplicate versions.
 const repeated=planGeneratedImageAdoption(p,{nodeId:'candidate',assetId:'a1',official:false});
 assert.equal(repeated.reuse,true);assert.equal(asset.imageVersions.length,3);
 // A replaced image has different real content, so it may become a new version.
 node.src='data:image/png;base64,ZZZZ';
 const changed=planGeneratedImageAdoption(p,{nodeId:'candidate',assetId:'a1',official:true});
 assert.equal(changed.reuse,false);assert.equal(changed.version,null);assert.notEqual(changed.srcHash,first.srcHash);
});

test('official adoption at the 20-version limit reuses the kept version instead of failing',()=>{
 const p=fixture(),asset=p.workstation.story.assets[0],node=p.nodes.find(item=>item.id==='candidate'),hash=sourceFingerprint(node.src);
 asset.imageVersions=Array.from({length:19},(_,i)=>({...version('v'+(i+1)),mediaId:'m-v'+(i+1)}));
 asset.imageVersions.push({...version('v20'),mediaId:'m-v20',srcHash:hash});
 asset.selectedImageId='v1';
 node.assetImageRef={assetId:'a1',versionId:'v20',srcHash:hash};
 const plan=planGeneratedImageAdoption(p,{nodeId:'candidate',assetId:'a1',official:true});
 assert.equal(plan.reuse,true);assert.equal(plan.version.id,'v20');
 applyGeneratedImageToAsset(p,{nodeId:'candidate',assetId:'a1',version:plan.version,official:true});
 assert.equal(asset.imageVersions.length,20);assert.equal(asset.selectedImageId,'v20');
});
