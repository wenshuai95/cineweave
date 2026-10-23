import test from 'node:test';
import assert from 'node:assert/strict';
import {demoProject,validateProject} from '../src/model.mjs';
import {addAssetImageVersions,selectAssetImage,removeAssetImageVersion} from '../src/workstation/asset-images.mjs';
import {hydrateAssetImages} from '../src/workstation/asset-image-handoff.mjs';
import {sendStoryPackageToCanvas} from '../src/workstation/story-canvas.mjs';
import {buildWorkstationBackup,restoreWorkstationBackup} from '../src/workstation/backup.mjs';
import {snapshotStory} from '../src/workstation/story.mjs';
import {workflowState} from '../src/workstation/workflow.mjs';
function fixture(){
 const p=demoProject();p.nodes=[];p.edges=[];
 p.workstation.story.assets=[{id:'plan',kind:'scene',name:'院落',description:'本地渲染场景',prompt:'院落提示词',negativePrompt:'',shotIds:['shot']}];
 p.workstation.story.shots=[{id:'shot',scene:'院落',characters:[],description:'推门',dialogue:'',duration:5,shotSize:'全景',cameraMovement:'固定',assetIds:['plan']}];
 const records=new Map(),store={get:async id=>records.get(id),put:async row=>{records.set(row.id,row);return row;},delete:async id=>records.delete(id)};
 return {p,asset:p.workstation.story.assets[0],records,store};
}
async function add(f,id){
 const blob=new Blob(['test-'+id],{type:'image/png'}),version={id:'version-'+id,mediaId:'media-'+id,name:id+'.png',mime:'image/png',size:blob.size,width:32,height:16,createdAt:1,prompt:'原始提示词'};
 await f.store.put({id:version.mediaId,kind:'image',name:version.name,mime:version.mime,size:blob.size,blob,createdAt:1});addAssetImageVersions(f.asset,[version]);return version;
}
test('official image handoff survives saved project and independent backup restore including historical candidates',async()=>{
 const f=fixture(),one=await add(f,'one'),two=await add(f,'two');
 snapshotStory(f.p.workstation,'两个候选');f.asset=f.p.workstation.story.assets[0];removeAssetImageVersion(f.asset,two.id);
 sendStoryPackageToCanvas(f.p,await hydrateAssetImages(f.p,['plan'],f.store));validateProject(f.p);
 assert.equal(f.p.nodes.filter(n=>n.type==='image').length,1);
 const {backup,missingCount}=await buildWorkstationBackup(f.p,f.store);
 assert.equal(missingCount,0);assert.equal(backup.media.length,2);
 const oldMedia=f.p.workstation.story.assets[0].imageVersions[0].mediaId;
 const result=await restoreWorkstationBackup(JSON.parse(JSON.stringify(backup)),f.store);
 const plan=result.project.workstation.story.assets[0],node=result.project.nodes.find(n=>n.type==='image');
 assert.notEqual(plan.imageVersions[0].mediaId,oldMedia);assert.equal(node.mediaId,plan.imageVersions[0].mediaId);
 assert.equal(result.project.workstation.story.versions[0].assets[0].imageVersions.length,2);
 assert.equal((await buildWorkstationBackup(result.project,f.store)).missingCount,0);
 assert.equal(await (await f.store.get(oldMedia)).blob.text(),'test-one');
});
test('official version change is pending until synchronized; synchronization reuses image node',async()=>{
 const f=fixture();await add(f,'one');const two=await add(f,'two');
 sendStoryPackageToCanvas(f.p,await hydrateAssetImages(f.p,['plan'],f.store));assert.equal(workflowState(f.p).pendingSync,0);
 const node=f.p.nodes.find(n=>n.type==='image');node.x=789;
 selectAssetImage(f.asset,two.id);assert.equal(workflowState(f.p).pendingSync,1);
 sendStoryPackageToCanvas(f.p,await hydrateAssetImages(f.p,['plan'],f.store));
 assert.equal(workflowState(f.p).pendingSync,0);assert.equal(f.p.nodes.find(n=>n.type==='image').id,node.id);assert.equal(node.x,789);assert.equal(node.storyImageRef.versionId,two.id);
});
test('missing or inconsistent image bytes fail before mutation, backup copies project at start',async()=>{
 const f=fixture(),one=await add(f,'one');f.records.delete(one.mediaId);
 const before=JSON.stringify(f.p);await assert.rejects(hydrateAssetImages(f.p,['plan'],f.store),/图片缺失/);assert.equal(JSON.stringify(f.p),before);
 const missing=await buildWorkstationBackup(f.p,f.store);assert.equal(missing.missingCount,1);
 f.asset.name='后来修改';assert.notEqual(missing.backup.project.workstation.story.assets[0].name,f.asset.name);
 f.records.set(one.mediaId,{kind:'image',mime:'image/png',size:1,blob:new Blob(['x'])});await assert.rejects(hydrateAssetImages(f.p,['plan'],f.store),/不一致/);
});
test('backup rejects mismatched image records before any write',async()=>{
 const f=fixture();await add(f,'one');const {backup}=await buildWorkstationBackup(f.p,f.store);
 backup.media[0].kind='video';let writes=0;await assert.rejects(restoreWorkstationBackup(backup,{put:async()=>writes++}),/类型不一致/);assert.equal(writes,0);
});
test('backup of a retained canvas picture clears orphan media IDs while retaining embedded pixels',async()=>{
 const f=fixture(),one=await add(f,'one');sendStoryPackageToCanvas(f.p,await hydrateAssetImages(f.p,['plan'],f.store));removeAssetImageVersion(f.asset,one.id);
 const {backup}=await buildWorkstationBackup(f.p,f.store);assert.equal(backup.media.length,0);
 const {project}=await restoreWorkstationBackup(backup,f.store),node=project.nodes.find(n=>n.type==='image');assert.equal(node.mediaId,undefined);assert.match(node.src,/^data:image\/png;base64,/);
});
test('hydration caps aggregate image size before reading any media',async()=>{
 const f=fixture();f.p.workstation.story.assets=Array.from({length:5},(_,i)=>({id:'a'+i,selectedImageId:'v'+i,imageVersions:[{id:'v'+i,mediaId:'m'+i,size:20*1024*1024}]}));let reads=0;
 await assert.rejects(hydrateAssetImages(f.p,f.p.workstation.story.assets.map(a=>a.id),{get:async()=>reads++}),/80 MB/);assert.equal(reads,0);
});
