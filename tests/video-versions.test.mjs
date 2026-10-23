import test from 'node:test';import assert from 'node:assert/strict';
import {collectVideoVersions,adoptVideoVersion,adoptedVideo,versionClips,replaceVersionClips,orderedVideoGroups,videoVersionFacts} from '../src/video-versions.mjs';
import {videoVersionSnapshotHtml} from '../src/video-versions-ui.mjs';
import {pruneGroups,regroup,buildCanvasCopy,pasteCanvasCopy} from '../src/board-operations.mjs';
import {starterProject,validateProject} from '../src/model.mjs';
import {normalizeSequence,placeClip} from '../src/workstation/sequence.mjs';
import {planVideoResult} from '../src/video-generation.mjs';
const video=(id,source='whitebox')=>({id,type:'video',title:id,text:'prompt',x:0,y:0,w:280,src:'data:video/mp4;base64,AAAA',generatedTask:'task-'+id,generatedSource:source});
const project=()=>({nodes:[{id:'whitebox',type:'video',src:'original'},video('v1')],edges:[{from:'whitebox',to:'v1'}],boardGroups:[],workstation:{assets:[],story:{shots:[]},sequence:{fps:24,video:[],audio:[]}}});
test('same source collects versions without overwriting whitebox, adoption, wires or media',()=>{
 const p=project(),g=collectVideoVersions(p,'v1',()=> 'versions');assert.equal(g.collapsed,true);assert.deepEqual(g.memberIds,['v1']);p.nodes.push(video('v2'));p.edges.push({from:'whitebox',to:'v2'});assert.equal(collectVideoVersions(p,'v2',()=>{throw Error('unneeded id')}),g);assert.equal(adoptedVideo(p,g).id,'v1');assert.equal(p.nodes[0].src,'original');assert.equal(p.nodes.length,3);assert.equal(p.edges.length,2);adoptVideoVersion(p,g.id,'v2');assert.equal(adoptedVideo(p,g).id,'v2');assert.throws(()=>adoptVideoVersion(p,g.id,'whitebox'),/移除/);
});
test('generating from a version continues its card; user-created group is not stolen',()=>{
 const p=project(),g=collectVideoVersions(p,'v1',()=> 'versions');p.nodes.push(video('v2','v1'));assert.equal(collectVideoVersions(p,'v2',()=>''),g);assert.deepEqual(g.memberIds,['v1','v2']);const other=video('v3');p.nodes.push(other);p.boardGroups.push({id:'manual',name:'用户分组',memberIds:['v3']});assert.equal(collectVideoVersions(p,'v3',()=>''),null);assert.deepEqual(p.boardGroups[1].memberIds,['v3']);
});
test('delete/regroup keeps a valid adopted version and group provenance',()=>{
 const p=project();p.nodes.push(video('v2'));const g=collectVideoVersions(p,'v1',()=> 'versions');adoptVideoVersion(p,g.id,'v2');p.nodes=p.nodes.filter(n=>n.id!=='v2');const clean=pruneGroups(p.boardGroups,p.nodes);assert.equal(clean[0].adoptedNodeId,'v1');assert.equal(clean[0].sourceNodeId,'whitebox');const before=project();before.nodes.push(video('v2'));collectVideoVersions(before,'v1',()=> 'versions');const out=regroup(before.boardGroups,['v1'],'user-group');assert.equal(out[0].adoptedNodeId,'v2');
});
test('version replacement preserves placement, exact trims, gain and mute, refuses shorter source atomically',()=>{
 const p=project();p.nodes.push({...video('v2'),mediaId:'asset-two'});p.nodes[1].mediaId='asset-one';const g=collectVideoVersions(p,'v1',()=> 'versions');const c={id:'clip',assetId:'asset-one',start:50,in:12,out:90,volume:.6,muted:true,versionGroupId:g.id};const other={id:'other',assetId:'unrelated',start:130,in:0,out:24,volume:1,muted:false};p.workstation.sequence.video=[c,other];const before=JSON.stringify(p);const next=replaceVersionClips(p,g,{id:'asset-two',kind:'video',durationSec:5});assert.deepEqual(next[0],{...c,assetId:'asset-two',canvasNodeId:'v2'});assert.equal(next[1],other);assert.equal(JSON.stringify(p),before);assert.throws(()=>replaceVersionClips(p,g,{id:'short',kind:'video',durationSec:2}),/较短/);assert.equal(JSON.stringify(p),before);assert.equal(versionClips(p,g).length,1);
});
test('explicit candidate retargets canvasNodeId, keeps trims and audio, refuses other shots atomically',()=>{
 const p=project();p.nodes[1].mediaId='asset-one';p.nodes.push({...video('v2'),mediaId:'asset-two'});
 const g=collectVideoVersions(p,'v1',()=> 'g1');
 p.nodes.push({...video('foreign','other-root'),mediaId:'asset-foreign'});collectVideoVersions(p,'foreign',()=> 'g2');
 const mine={id:'clip',assetId:'asset-one',canvasNodeId:'v1',start:50,in:12,out:90,volume:.6,muted:true,versionGroupId:g.id};
 const theirs={id:'theirs',assetId:'asset-foreign',canvasNodeId:'foreign',start:130,in:0,out:24,volume:1,muted:false,versionGroupId:'g2'};
 p.workstation.sequence.video=[mine,theirs];const before=JSON.stringify(p);
 const next=replaceVersionClips(p,g,{id:'asset-two',kind:'video',durationSec:5},'v2');
 assert.deepEqual(next[0],{...mine,assetId:'asset-two',canvasNodeId:'v2'});
 assert.deepEqual(next[1],theirs);
 assert.throws(()=>replaceVersionClips(p,g,{id:'asset-foreign',kind:'video',durationSec:9},'foreign'),/不属于这个镜头/);
 assert.throws(()=>replaceVersionClips(p,g,{id:'short',kind:'video',durationSec:2},'v2'),/较短/);
 assert.equal(JSON.stringify(p),before);
});
test('sequence normalization and split retain version provenance',()=>{
 const c={id:'clip',assetId:'asset-one',start:0,in:0,out:120,volume:1,muted:false,canvasNodeId:'v1',versionGroupId:'group-1'};assert.equal(normalizeSequence({fps:24,video:[c]}).video[0].versionGroupId,'group-1');assert.equal(placeClip([],c)[0].canvasNodeId,'v1');assert.equal(normalizeSequence({video:[{...c,versionGroupId:'<script>'}]}).video[0].versionGroupId,undefined);
});
test('batch groups follow literary shot order, then creation order, and tolerate reference cycles',()=>{
 const p=project();p.nodes.push(video('v2','second'),{id:'second',storyRef:{kind:'shot',id:'shot-2'}});p.nodes[0].storyRef={kind:'shot',id:'shot-1'};p.workstation.story.shots=[{id:'shot-1'},{id:'shot-2'}];collectVideoVersions(p,'v2',()=> 'second-group');collectVideoVersions(p,'v1',()=> 'first-group');assert.deepEqual(orderedVideoGroups(p).map(g=>g.id),['first-group','second-group']);p.edges.push({from:'v2',to:'second'},{from:'second',to:'v2'});assert.equal(orderedVideoGroups(p).length,2);
});
test('project import/save validates version membership; ordinary node copy detaches task bindings safely',()=>{
 const p=validateProject(starterProject());const root={...video('whitebox'),generatedTask:undefined,generatedSource:undefined};p.nodes.push(root,video('v1'),video('v2'));collectVideoVersions(p,'v1',()=> 'video-versions');assert.doesNotThrow(()=>validateProject(structuredClone(p)));p.boardGroups.find(g=>g.videoVersions).adoptedNodeId='missing';assert.throws(()=>validateProject(structuredClone(p)),/版本/);let n=0;const copied=pasteCanvasCopy(buildCanvasCopy(p.nodes,p.edges,['v1','v2'],p.boardGroups),{uid:()=> 'copy-'+(++n)});assert.equal(copied.nodes[0].generatedTask,undefined);assert.equal(copied.groups[0].videoVersions,true);assert.equal(copied.groups[0].sourceNodeId,undefined);assert.ok(copied.groups[0].memberIds.includes(copied.groups[0].adoptedNodeId));
});
test('changed empty target is preserved when a late video completes',()=>{
 const p={nodes:[{id:'target',type:'video',text:'new prompt',x:0,y:0,w:280}],edges:[]};const plan=planVideoResult(p,{id:'job',sourceId:'target',sourceText:'old prompt',prompt:'generated',modelName:'model',points:20},'data:video/mp4;base64,AAAA',v=>({id:'result',type:'video',...v}));assert.equal(plan.replace,false);assert.equal(p.nodes[0].text,'new prompt');assert.equal(plan.node.generatedModel,'model');assert.equal(plan.node.generatedPoints,20);
});

test('shared media cannot replace a different shot with explicit provenance',()=>{
 const p=project();p.nodes[1].mediaId='shared';p.nodes.push({...video('v2','other-root'),mediaId:'shared'});const g=collectVideoVersions(p,'v1',()=> 'g1'),other=collectVideoVersions(p,'v2',()=> 'g2');
 p.workstation.sequence.video=[{id:'one',assetId:'shared',versionGroupId:g.id,start:0,in:0,out:24},{id:'two',assetId:'shared',versionGroupId:other.id,start:24,in:0,out:24},{id:'three',assetId:'shared',canvasNodeId:'v2',start:48,in:0,out:24}];
 assert.deepEqual(versionClips(p,g).map(c=>c.id),['one']);const next=replaceVersionClips(p,g,{id:'new',kind:'video',durationSec:5});assert.equal(next[0].assetId,'new');assert.equal(next[1].assetId,'shared');assert.equal(next[2].assetId,'shared');
});
test('candidate snapshot renders parameters and purposes without leaking sources or injecting html',()=>{
 const evil='<img src=x onerror=alert(1)>',p=project();p.nodes.push({id:'ref1',type:'image',title:'<b>角色</b>立绘',src:'data:image/png;base64,REFSECRET'});
 const node=p.nodes[1];node.src='data:video/mp4;base64,CLIPSECRET';node.generatedModel=evil;node.generatedPoints=20;
 node.generatedInput={modelId:'m',duration:5,resolution:'720p',aspect:'16:9',references:[{nodeId:'ref1',kind:'image',alias:evil,purpose:'appearance',data:'data:image/png;base64,REFDATA'}]};
 node.videoDraft={aliases:[{nodeId:'ref1',alias:evil,purpose:'appearance'}]};
 const facts=Object.fromEntries(videoVersionFacts(p,node));
 assert.equal(facts['模型'],evil);assert.equal(facts['时长'],'5 秒');assert.equal(facts['分辨率'],'720p');assert.equal(facts['画幅'],'16:9');
 assert.equal(facts['预估积分'],'20 积分');assert.equal(facts['实扣积分'],'待平台核对');
 assert.ok(facts['参考用途'].includes('角色外观'));
 const html=videoVersionSnapshotHtml(p,node);
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(!html.includes(evil));
 assert.ok(!html.includes('CLIPSECRET'));assert.ok(!html.includes('REFSECRET'));assert.ok(!html.includes('REFDATA'));
});
test('legacy candidates without a snapshot degrade gently',()=>{
 const p=project(),node=p.nodes[1],html=videoVersionSnapshotHtml(p,node),facts=Object.fromEntries(videoVersionFacts(p,node));
 assert.equal(facts['模型'],null);assert.equal(facts['时长'],null);assert.equal(facts['参考用途'],null);
 assert.equal(facts['实扣积分'],'待平台核对');
 assert.ok((html.match(/未记录/g)||[]).length>=5);assert.ok(html.includes('旧版本未记录生成参数'));
});

test('generated facts do not change when a continuation draft is edited',()=>{
 const p=project(),n=p.nodes.find(n=>n.id==='v1');
 n.generatedInput={modelId:'original-model',duration:5,resolution:'720P',aspect:'16:9',references:[]};
 n.generatedModel='Original';n.videoDraft={modelId:'new-model',duration:'10',resolution:'1080P',aspect:'9:16',aliases:[{nodeId:'whitebox',alias:'新参考',kind:'video',purpose:'motion'}]};
 const facts=Object.fromEntries(videoVersionFacts(p,n));
 assert.equal(facts['时长'],'5 秒');assert.equal(facts['分辨率'],'720P');assert.equal(facts['画幅'],'16:9');assert.equal(facts['参考用途'],null);
});
