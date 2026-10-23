import test from 'node:test';import assert from 'node:assert/strict';
import {sendStoryPackageToCanvas,sendStoryToCanvas,isAssetImageCurrent} from '../src/workstation/story-canvas.mjs';
import {demoProject,validateProject} from '../src/model.mjs';
const project=()=>({nodes:[],edges:[],workstation:{story:{shots:[{id:'s1',scene:'院子',characters:[],description:'日景',dialogue:'',duration:3,shotSize:'全景',cameraMovement:'固定',assetIds:['a1']}],assets:[{id:'a1',kind:'scene',name:'院子',description:'场景',prompt:'木门',shotIds:[],imageVersions:[{id:'v1',mediaId:'m1',width:1280,height:720}],selectedImageId:'v1'}]}}});
const options=(versionId='v1',mediaId='m1')=>({imagesByAssetId:{a1:{versionId,mediaId,src:'data:image/png;base64,aGVsbG8='}}});
test('official image is a separate node with planning semantics and shot links preserved',()=>{
 const p=project(),ids=sendStoryPackageToCanvas(p,options());assert.equal(ids.length,3);assert.equal(p.nodes.length,3);
 const planning=p.nodes.find(n=>n.storyRef?.kind==='asset'),image=p.nodes.find(n=>n.storyImageRef);
 assert.equal(planning.type,'scene');assert.equal(planning.src,undefined);assert.equal(image.type,'image');assert.deepEqual(image.storyImageRef,{assetId:'a1',versionId:'v1'});
 assert.equal(p.edges.filter(e=>e.storyLink).length,1);assert.equal(p.edges.filter(e=>e.assetImageLink).length,2);
});
test('repeat send and changing official version reuse image node and retain placement/manual edges',()=>{
 const p=project();sendStoryPackageToCanvas(p,options());const image=p.nodes.find(n=>n.storyImageRef);Object.assign(image,{x:999,y:123,w:555});
 p.nodes.push({id:'manual'});p.edges.push({from:image.id,to:'manual'});const firstId=image.id;
 p.workstation.story.assets[0].imageVersions.push({id:'v2',mediaId:'m2'});p.workstation.story.assets[0].selectedImageId='v2';
 sendStoryPackageToCanvas(p,options('v2','m2'));assert.equal(p.nodes.length,4);assert.equal(image.id,firstId);assert.equal(image.mediaId,'m2');assert.equal(image.storyImageRef.versionId,'v2');
 assert.deepEqual([image.x,image.y,image.w],[999,123,555]);assert.ok(p.edges.some(e=>e.to==='manual'));assert.equal(p.edges.length,4);
});
test('image capacity and invalid hydration fail before mutating planning nodes',()=>{
 const p=project();p.nodes=Array.from({length:498},(_,i)=>({id:'filler'+i}));const before=structuredClone(p);
 assert.throws(()=>sendStoryPackageToCanvas(p,options()),/500/);assert.deepEqual(p,before);
 p.nodes=[];const empty=structuredClone(p);assert.throws(()=>sendStoryPackageToCanvas(p,options('wrong')),/尚未就绪/);assert.deepEqual(p,empty);
});
test('send image before shots links automatically on later shot send and prunes only own stale wires',()=>{
 const p=project();sendStoryToCanvas(p,'assets',['a1'],options());assert.equal(p.nodes.length,2);assert.equal(p.edges.length,1);
 sendStoryToCanvas(p,'shots',['s1']);assert.equal(p.edges.length,3);
 const image=p.nodes.find(n=>n.storyImageRef),shot=p.nodes.find(n=>n.storyRef?.kind==='shot');p.edges.push({from:shot.id,to:image.id});
 p.workstation.story.shots[0].assetIds=[];sendStoryPackageToCanvas(p,options());
 assert.equal(p.edges.filter(e=>e.assetImageLink).length,1);assert.ok(p.edges.some(e=>e.from===shot.id&&e.to===image.id));
});
test('missing image payload preserves legacy send behavior and preserves previously sent image',()=>{
 const p=project();sendStoryPackageToCanvas(p);assert.equal(p.nodes.length,2);
 sendStoryPackageToCanvas(p,options());const saved=structuredClone(p.nodes.find(n=>n.storyImageRef));
 sendStoryPackageToCanvas(p);assert.deepEqual(p.nodes.find(n=>n.storyImageRef),saved);assert.equal(p.nodes.length,3);
});
test('official image handoff remains a valid saveable project and reports stale version selection',()=>{
 const p=demoProject();p.nodes=[];p.edges=[];p.workstation.story=project().workstation.story;
 const asset=p.workstation.story.assets[0];asset.imageVersions[0]={...asset.imageVersions[0],name:'院子.png',mime:'image/png',size:5,createdAt:1};
 assert.equal(isAssetImageCurrent(p,asset),false);sendStoryPackageToCanvas(p,options());assert.equal(isAssetImageCurrent(p,asset),true);
 const saved=validateProject(JSON.parse(JSON.stringify(p)));assert.equal(saved.nodes.filter(n=>n.storyImageRef).length,1);assert.equal(saved.workstation.story.assets[0].selectedImageId,'v1');
 asset.imageVersions.push({id:'v2',mediaId:'m2'});asset.selectedImageId='v2';assert.equal(isAssetImageCurrent(p,asset),false);
});
