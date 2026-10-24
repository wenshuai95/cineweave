import test from 'node:test';
import assert from 'node:assert/strict';
import {shotProductionList,shotProductionSummary,shotProductionFor,pendingVideoReferenceChanges,reviewShotReferenceChanges,clearRestoredReferenceAcknowledgements} from '../src/shot-production.mjs';

const version=(id,createdAt=1)=>({id,mediaId:'m-'+id,mime:'image/png',size:10,width:160,height:90,createdAt,name:id+'.png'});
function fixture(){
 const project={
  nodes:[
   {id:'shot-node',type:'text',title:'镜头 01',text:'画面',x:0,y:0,w:280,storyRef:{kind:'shot',id:'s1'}},
   {id:'asset-node',type:'text',title:'院子',text:'场景',x:320,y:0,w:280,storyRef:{kind:'asset',id:'a1'}},
   {id:'img1',type:'image',title:'院子 · 正式图片',text:'',x:640,y:0,w:280,src:'data:image/png;base64,AAAA',mediaId:'m-v1',storyImageRef:{assetId:'a1',versionId:'v1'}},
   {id:'generator',type:'video',title:'镜头 01 · 生成入口',text:'',x:320,y:360,w:280},
   {id:'video1',type:'video',title:'Provider · 院子',text:'',x:640,y:360,w:280,src:'data:video/mp4;base64,AAAA',mediaId:'m-video1',generatedTask:'task-1',generatedSource:'generator',generatedProvider:'provider',generatedAt:100,referenceSnapshot:[{nodeId:'img1',assetId:'a1',versionId:'v1'}]}
  ],
  edges:[{from:'shot-node',to:'generator'},{from:'img1',to:'asset-node'},{from:'img1',to:'shot-node'},{from:'img1',to:'video1'}],
  boardGroups:[
   {id:'bundle',name:'镜头组',memberIds:['shot-node','generator'],collapsed:true,shotBundle:true,shotSourceId:'generator'},
   {id:'versions',name:'镜头版本',memberIds:['video1'],collapsed:true,videoVersions:true,sourceNodeId:'generator',adoptedNodeId:'video1'}
  ],
  workstation:{story:{shots:[{id:'s1',scene:'院子',description:'推门',assetIds:['a1']}],assets:[{id:'a1',kind:'scene',name:'院子',imageVersions:[version('v1'),version('v2',200)],selectedImageId:'v1',shotIds:['s1']}]},sequence:{fps:24,video:[{id:'clip1',assetId:'m-video1',start:0,in:0,out:24,versionGroupId:'versions',canvasNodeId:'video1'}]}}
 };
 return project;
}
test('a shot derives asset images, adopted video and cut use from live records',()=>{
 const p=fixture(),item=shotProductionFor(p,'s1');
 assert.equal(item.shotNodeId,'shot-node');assert.equal(item.assets.length,1);assert.equal(item.assets[0].official,true);
 assert.deepEqual(item.videos.generated,['video1']);assert.equal(item.adoptedVideoId,'video1');assert.equal(item.versionGroupId,'versions');
 assert.equal(item.inCut.used,true);assert.equal(item.inCut.count,1);assert.equal(item.pending.length,0);
 assert.equal(item.statuses.assets.tone,'ok');assert.equal(item.statuses.visual.text,'生成视频 1 个');assert.equal(item.next.action,'locate');
});
test('changing the official image marks the affected shot for review, and review is version-derived',()=>{
 const p=fixture(),asset=p.workstation.story.assets[0];asset.selectedImageId='v2';
 let item=shotProductionFor(p,'s1');
 assert.equal(item.pending.length,1);assert.equal(item.pending[0].assetId,'a1');assert.equal(item.pending[0].versionId,'v1');assert.equal(item.pending[0].currentVersionId,'v2');
 assert.equal(item.statuses.review.tone,'warn');assert.match(item.statuses.review.text,/待复核/);assert.equal(item.next.action,'review');
 const videoSrc=p.nodes.find(node=>node.id==='video1').src,sequence=structuredClone(p.workstation.sequence);
 const result=reviewShotReferenceChanges(p,'s1');assert.equal(result.changes,1);assert.deepEqual(result.videos,['video1']);
 assert.equal(p.nodes.find(node=>node.id==='video1').src,videoSrc);assert.deepEqual(p.workstation.sequence,sequence);
 item=shotProductionFor(p,'s1');assert.equal(item.pending.length,0);assert.equal(item.statuses.review.text,'参考无需复核');
 asset.imageVersions.push(version('v3',300));asset.selectedImageId='v3';
 item=shotProductionFor(p,'s1');assert.equal(item.pending.length,1);assert.equal(item.next.action,'review');
});
test('incomplete shots expose missing assets, official images and visual material without fake progress',()=>{
 const p=fixture();
 p.workstation.story.shots.push(
  {id:'s2',scene:'门外',description:'',assetIds:[]},
  {id:'s3',scene:'街道',description:'',assetIds:['a2']}
 );
 p.workstation.story.assets.push({id:'a2',kind:'character',name:'旅人',imageVersions:[],shotIds:[]});
 const list=shotProductionList(p),byId=new Map(list.map(item=>[item.id,item]));
 assert.equal(list.length,3);
 assert.equal(byId.get('s2').statuses.assets.text,'未关联资产');assert.equal(byId.get('s2').statuses.visual.text,'缺白模 / 生成视频');assert.equal(byId.get('s2').next.action,'edit');
 assert.equal(byId.get('s3').statuses.assets.text,'缺 1 张正式图');assert.equal(byId.get('s3').next.action,'assets');assert.equal(byId.get('s3').next.assetId,'a2');
 const summary=shotProductionSummary(p);assert.equal(summary.total,3);assert.equal(summary.missingCanvas,2);assert.equal(summary.missingOfficial,1);assert.equal(summary.pendingReview,0);
});
test('legacy generated video without a snapshot is reviewed using the image node version',()=>{
 const p=fixture();delete p.nodes.find(node=>node.id==='video1').referenceSnapshot;
 p.nodes.find(node=>node.id==='video1').generatedInput={references:[{nodeId:'img1'}]};
 p.workstation.story.assets[0].selectedImageId='v2';
 const pending=pendingVideoReferenceChanges(p,p.nodes.find(node=>node.id==='video1'));
 assert.equal(pending.length,1);assert.match(pending[0].reason,/正式图/);
});
test('a removed reference is pending until the review records that it was checked',()=>{
 const p=fixture();p.nodes.find(node=>node.id==='video1').referenceSnapshot=[{nodeId:'gone',assetId:'a1',versionId:'v1'}];
 let item=shotProductionFor(p,'s1');assert.equal(item.pending.length,1);assert.match(item.pending[0].reason,/已移除/);
 reviewShotReferenceChanges(p,'s1');item=shotProductionFor(p,'s1');assert.equal(item.pending.length,0);
});

test('a white-model previz is recognised and can be the next cut source',()=>{
 const p=fixture();
 p.nodes=p.nodes.filter(node=>!['video1'].includes(node.id));
 p.boardGroups=p.boardGroups.filter(group=>group.id!=='versions');
 p.edges=p.edges.filter(edge=>edge.to!=='video1');
 p.nodes.push({id:'previz',type:'video',title:'镜头 01 · 白模预演',text:'',x:320,y:520,w:280,src:'data:video/mp4;base64,BBBB'});
 p.edges.push({from:'shot-node',to:'previz'});
 p.workstation.sequence.video=[];
 const item=shotProductionFor(p,'s1');
 assert.deepEqual(item.videos.previz,['previz']);assert.equal(item.visualReady,true);assert.equal(item.statuses.visual.text,'白模已导出 · 1 段');
 assert.equal(item.cutVideoId,'previz');assert.equal(item.next.action,'cut');assert.equal(item.next.videoId,'previz');
});

test('two shots sharing an asset never inherit each other\'s generated video or review',()=>{
 const p=fixture();
 p.workstation.story.shots.push({id:'s2',scene:'门外',description:'',assetIds:['a1']});
 p.workstation.story.assets[0].shotIds=['s1','s2'];
 p.nodes.push({id:'shot-node-2',type:'text',title:'镜头 02',text:'画面',x:0,y:700,w:280,storyRef:{kind:'shot',id:'s2'}});
 p.nodes.push({id:'generator-2',type:'video',title:'镜头 02 · 生成入口',text:'',x:320,y:700,w:280});
 p.edges.push({from:'shot-node-2',to:'generator-2'});
 let s1=shotProductionFor(p,'s1'),s2=shotProductionFor(p,'s2');
 assert.deepEqual(s1.videos.generated,['video1']);assert.equal(s1.inCut.used,true);
 assert.deepEqual(s2.videos.generated,[]);assert.equal(s2.videos.total,0);assert.equal(s2.inCut.used,false);assert.equal(s2.visualReady,false);
 assert.equal(s2.next.action,'generate');
 p.workstation.story.assets[0].selectedImageId='v2';
 s1=shotProductionFor(p,'s1');s2=shotProductionFor(p,'s2');
 assert.equal(s1.pending.length,1);assert.equal(s2.pending.length,0);
 const reviewed=reviewShotReferenceChanges(p,'s2');
 assert.equal(reviewed.changes,0);assert.deepEqual(reviewed.videos,[]);
 assert.equal(shotProductionFor(p,'s1').pending.length,1,'reviewing s2 must not acknowledge s1 video');
 assert.equal(reviewShotReferenceChanges(p,'s1').changes,1);
 assert.equal(shotProductionFor(p,'s1').pending.length,0);
});

test('a removed asset clears after review even while its image node remains, then a restored change prompts again',()=>{
 const p=fixture(),asset=p.workstation.story.assets[0];
 p.workstation.story.assets=[];
 let item=shotProductionFor(p,'s1');
 assert.equal(item.pending.length,1);assert.equal(item.pending[0].missing,true);assert.match(item.pending[0].reason,/参考资产已移除/);
 const first=reviewShotReferenceChanges(p,'s1');assert.equal(first.changes,1);
 item=shotProductionFor(p,'s1');assert.equal(item.pending.length,0);assert.equal(item.statuses.review.text,'参考无需复核');
 p.workstation.story.assets=[{...asset,selectedImageId:'v2',imageVersions:[version('v1'),version('v2',200)]}];
 item=shotProductionFor(p,'s1');
 assert.equal(item.pending.length,1);assert.equal(item.pending[0].missing,undefined);assert.match(item.pending[0].reason,/正式图已更换/);
 assert.equal(reviewShotReferenceChanges(p,'s1').changes,1);
 assert.equal(shotProductionFor(p,'s1').pending.length,0);
 // The successful review above cleared the missing marker; a later removal is visible again.
 p.workstation.story.assets=[];
 item=shotProductionFor(p,'s1');assert.equal(item.pending.length,1);assert.equal(item.pending[0].missing,true);
});

test('restoring the same asset version during commit ends the old missing acknowledgement',()=>{
 const p=fixture(),asset=structuredClone(p.workstation.story.assets[0]),video=p.nodes.find(node=>node.id==='video1');
 p.workstation.story.assets=[];
 assert.equal(shotProductionFor(p,'s1').pending.length,1);
 reviewShotReferenceChanges(p,'s1');
 assert.deepEqual(video.referenceReview.missing,['img1']);assert.equal(shotProductionFor(p,'s1').pending.length,0);
 // An unrelated save while the asset is still absent must keep the acknowledgement.
 assert.deepEqual(clearRestoredReferenceAcknowledgements(p),{videos:[],cleared:0});
 const reviewedAt=video.referenceReview.at;
 p.workstation.story.assets=[asset];
 const restored=structuredClone(p);
 assert.equal(shotProductionFor(p,'s1').pending.length,0);
 assert.deepEqual(p,restored,'checklist derivation must not mutate review lifecycle state');
 assert.deepEqual(clearRestoredReferenceAcknowledgements(p),{videos:['video1'],cleared:1});
 assert.deepEqual(video.referenceReview.missing,[]);assert.equal(video.referenceReview.at,reviewedAt);
 assert.equal(shotProductionFor(p,'s1').pending.length,0,'same version restoration needs no content review');
 p.workstation.story.assets=[];
 assert.equal(shotProductionFor(p,'s1').pending.length,1,'a new absence requires a new review');
});

test('restored reference nodes expire only their missing marker and preserve other review identities',()=>{
 const p=fixture(),video=p.nodes.find(node=>node.id==='video1'),image=p.nodes.find(node=>node.id==='img1');
 p.nodes=p.nodes.filter(node=>node.id!=='img1');
 reviewShotReferenceChanges(p,'s1');
 video.referenceReview.versions={a1:'v2'};video.referenceReview.srcHashes={other:'1234567890abcdef'};
 const before=structuredClone(video.referenceReview);
 assert.equal(clearRestoredReferenceAcknowledgements(p).cleared,0);
 p.nodes.push(image);
 assert.equal(clearRestoredReferenceAcknowledgements(p).cleared,1);
 assert.deepEqual(video.referenceReview,{...before,missing:[]});
 p.nodes=p.nodes.filter(node=>node.id!=='img1');
 assert.equal(shotProductionFor(p,'s1').pending.length,1);
});
