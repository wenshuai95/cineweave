import test from 'node:test';
import assert from 'node:assert/strict';
import {planShotBundle,bundleMemberIds,bundleVersionGroups,hiddenByShotBundle} from '../src/shot-bundles.mjs';
import {pruneGroups,regroup,buildCanvasCopy,pasteCanvasCopy} from '../src/board-operations.mjs';
import {demoProject,validateProject} from '../src/model.mjs';
const node=(id,type='text',extra={})=>({id,type,title:id,x:0,y:0,w:300,...extra});
function fixture(){return {nodes:[node('script'),node('image','image'),node('audio','audio'),node('whitebox','video',{src:'whitebox.mp4'}),node('entry','video'),node('v1','video',{src:'v1.mp4',generatedSource:'entry'}),node('v2','video',{src:'v2.mp4',generatedSource:'entry'}),node('other')],edges:[{from:'script',to:'image'},{from:'image',to:'entry'},{from:'audio',to:'entry'},{from:'whitebox',to:'entry'}],boardGroups:[{id:'versions',name:'版本',videoVersions:true,sourceNodeId:'entry',adoptedNodeId:'v1',collapsed:true,memberIds:['v1','v2']}]};}
const opts={nodeIds:['entry'],createId:()=> 'shot'};
test('one-click plan collects only direct inputs, preserves version ownership and never mutates source',()=>{
 const p=fixture(),before=structuredClone(p),plan=planShotBundle(p,opts);
 assert.deepEqual(p,before);assert.deepEqual(plan.group.memberIds,['image','audio','whitebox','entry']);
 assert.equal(plan.group.shotBundle,true);assert.equal(plan.group.shotSourceId,'entry');assert.equal(plan.group.collapsed,true);assert.equal(plan.updated,false);
 const q={...p,boardGroups:plan.boardGroups};assert.deepEqual(bundleMemberIds(q,plan.group),['image','audio','whitebox','entry','v1','v2']);
 assert.equal(new Set(plan.boardGroups.flatMap(g=>g.memberIds)).size,6);assert.deepEqual(bundleVersionGroups(q,plan.group).map(g=>g.id),['versions']);assert.equal(hiddenByShotBundle(q,plan.boardGroups[0]),true);
 plan.boardGroups[0].memberIds.push('other');assert.deepEqual(p,before);
});
test('explicit script joins the card while indirect upstream remains outside by default',()=>{
 const p=fixture(),plan=planShotBundle(p,{...opts,nodeIds:['entry','script']});assert.ok(plan.memberIds.includes('script'));
 assert.equal(plan.memberIds.includes('other'),false);
});
test('auto upstream respects another group and reports excluded nodes without breaking its membership',()=>{
 const p=fixture();p.boardGroups.push({id:'manual',name:'手动',memberIds:['image','other']});
 const plan=planShotBundle(p,opts);assert.deepEqual(plan.excludedIds,['image']);assert.equal(plan.memberIds.includes('image'),false);assert.deepEqual(plan.boardGroups.find(g=>g.id==='manual').memberIds,['image','other']);
 assert.throws(()=>planShotBundle(p,{...opts,nodeIds:['entry','image']}),/完整分组/);
});
test('explicit full ordinary groups can be converted, preserving data and excluding dedicated groups',()=>{
 const p=fixture();p.boardGroups.unshift({id:'manual',name:'手动',memberIds:['image','other']});
 const plan=planShotBundle(p,{...opts,nodeIds:['entry','image','other']});assert.ok(plan.memberIds.includes('other'));assert.equal(plan.boardGroups.some(g=>g.id==='manual'),false);
 p.boardGroups[0].storyShots=true;assert.throws(()=>planShotBundle(p,{...opts,nodeIds:['entry','image','other']}),/分镜组/);
 p.boardGroups[0]={id:'manual',name:'别的镜头',shotBundle:true,shotSourceId:'other',memberIds:['image','other']};assert.throws(()=>planShotBundle(p,{...opts,nodeIds:['entry','image','other']}),/另一个镜头组/);
});
test('source inside a manual group cannot be implicitly stolen even if direct inputs would fit',()=>{
 const p=fixture();p.boardGroups.push({id:'manual',name:'手动',memberIds:['entry','other']});assert.throws(()=>planShotBundle(p,opts),/完整分组/);
 assert.doesNotThrow(()=>planShotBundle(p,{...opts,nodeIds:['entry','other']}));
});
test('existing bundle updates idempotently, keeps position and expanded state, and accepts future versions dynamically',()=>{
 const p=fixture(),first=planShotBundle(p,opts);p.boardGroups=first.boardGroups;p.boardGroups[1].collapsed=false;
 const before=structuredClone(p),next=planShotBundle(p,{...opts,nodeIds:['entry','script'],name:'镜头 01'});assert.deepEqual(p,before);
 assert.equal(next.updated,true);assert.equal(next.group.id,'shot');assert.equal(next.group.collapsed,false);assert.equal(next.group.name,'镜头 01');assert.equal(next.boardGroups.length,2);assert.equal(next.boardGroups[1].id,'shot');
 const q={...p,boardGroups:next.boardGroups};q.nodes=[...q.nodes,node('v3','video')];q.boardGroups[0].memberIds.push('v3');assert.ok(bundleMemberIds(q,next.group).includes('v3'));assert.equal(hiddenByShotBundle(q,q.boardGroups[0]),false);
});
test('version selection resolves entry, ignores dangling effective ids and rejects unrelated version groups',()=>{
 const p=fixture(),plan=planShotBundle(p,{...opts,nodeIds:['v1','v2']});assert.equal(plan.group.shotSourceId,'entry');assert.ok(!plan.memberIds.includes('v1'));
 const q={...p,boardGroups:plan.boardGroups};q.boardGroups[0].memberIds.push('missing');assert.ok(!bundleMemberIds(q,plan.group).includes('missing'));
 p.nodes.push(node('alien','video'));p.boardGroups.push({id:'alien-group',name:'其他',videoVersions:true,sourceNodeId:'other',memberIds:['alien']});assert.throws(()=>planShotBundle(p,{...opts,sourceId:'entry',nodeIds:['alien']}),/其他镜头/);
});
test('missing, ambiguous, duplicate and limit conditions fail clearly without changing any records',()=>{
 const p=fixture(),before=structuredClone(p);
 assert.throws(()=>planShotBundle(p,{...opts,nodeIds:['missing']}),/已被移除/);assert.throws(()=>planShotBundle(p,{...opts,nodeIds:['image','audio']}),/视频生成入口/);
 assert.throws(()=>planShotBundle(p,{...opts,sourceId:'missing'}),/来源节点已被移除/);assert.throws(()=>planShotBundle(p,{...opts,createId:()=> 'versions'}),/编号/);assert.deepEqual(p,before);
 p.nodes.push(node('entry2','video'));assert.throws(()=>planShotBundle(p,{...opts,nodeIds:['entry','entry2']}),/一个视频生成入口/);
 const capped=fixture();capped.boardGroups.push(...Array.from({length:199},(_,i)=>({id:'g'+i,name:'组',memberIds:[]})));assert.throws(()=>planShotBundle(capped,opts),/上限/);
});
test('pruning and regrouping retain valid shot identity and clear it when source ownership is lost',()=>{
 const p=fixture();p.boardGroups=planShotBundle(p,opts).boardGroups;
 const before=structuredClone(p),pruned=pruneGroups(p.boardGroups,p.nodes);assert.equal(pruned.find(g=>g.id==='shot').shotSourceId,'entry');assert.deepEqual(p,before);
 const gone=pruneGroups(p.boardGroups,p.nodes.filter(n=>n.id!=='entry')),old=gone.find(g=>g.id==='shot');assert.equal(old.shotBundle,undefined);assert.equal(old.shotSourceId,undefined);assert.ok(old.memberIds.includes('image'));assert.equal(gone.find(g=>g.id==='versions').sourceNodeId,undefined);
 const moved=regroup(p.boardGroups,['entry','other'],'manual'),former=moved.find(g=>g.id==='shot');assert.equal(former.shotBundle,undefined);assert.equal(former.shotSourceId,undefined);assert.deepEqual(former.memberIds,['image','audio','whitebox']);
 const kept=regroup(p.boardGroups,['image','other'],'manual').find(g=>g.id==='shot');assert.equal(kept.shotBundle,true);assert.equal(kept.shotSourceId,'entry');
});
function clipboardFixture(){const p=fixture();for(const n of p.nodes){n.text='';if(n.src)n.src='data:video/mp4;base64,AAAA';}p.boardGroups=planShotBundle(p,opts).boardGroups;return p;}
test('full shot copy remaps source and version metadata without duplicating actual ownership',()=>{
 const p=clipboardFixture(),ids=bundleMemberIds(p,p.boardGroups.find(g=>g.shotBundle)),before=structuredClone(p),clip=buildCanvasCopy(p.nodes,p.edges,ids,p.boardGroups);let i=0;
 const copy=pasteCanvasCopy(JSON.parse(JSON.stringify(clip)),{uid:()=>`copy-${++i}`}),source=copy.nodes.find(n=>n.title==='entry'),versions=copy.groups.find(g=>g.videoVersions),shot=copy.groups.find(g=>g.shotBundle);
 assert.equal(shot.shotSourceId,source.id);assert.equal(versions.sourceNodeId,source.id);assert.equal(versions.adoptedNodeId,copy.nodes.find(n=>n.title==='v1').id);assert.equal(new Set(copy.groups.flatMap(g=>g.memberIds)).size,6);
 assert.equal(bundleMemberIds({nodes:copy.nodes,boardGroups:copy.groups},shot).length,6);assert.deepEqual(p,before);
 const project=demoProject();project.nodes=copy.nodes;project.edges=copy.edges;project.boardGroups=copy.groups;assert.doesNotThrow(()=>validateProject(project));
});
test('partial shot/version copies become ordinary groups and cannot attach to the original source',()=>{
 const p=clipboardFixture(),clip=buildCanvasCopy(p.nodes,p.edges,['entry','image','audio','whitebox','v1'],p.boardGroups);let i=0;
 const copy=pasteCanvasCopy(clip,{uid:()=>`part-${++i}`});assert.ok(copy.groups.every(g=>!g.shotBundle&&!g.videoVersions));
 const versionsOnly=buildCanvasCopy(p.nodes,p.edges,['v1','v2'],p.boardGroups),vCopy=pasteCanvasCopy(versionsOnly,{uid:()=>`version-${++i}`});assert.equal(vCopy.groups[0].videoVersions,true);assert.equal(vCopy.groups[0].sourceNodeId,undefined);assert.ok(vCopy.groups[0].memberIds.includes(vCopy.groups[0].adoptedNodeId));
});
test('a single-source shot card and one-version group survive full clipboard round trips',()=>{
 const p=clipboardFixture();p.boardGroups.find(g=>g.shotBundle).memberIds=['entry'];p.boardGroups.find(g=>g.videoVersions).memberIds=['v1'];let i=0;
 const copy=pasteCanvasCopy(buildCanvasCopy(p.nodes,p.edges,['entry','v1'],p.boardGroups),{uid:()=>`single-${++i}`});assert.equal(copy.groups.length,2);assert.ok(copy.groups.every(g=>g.memberIds.length===1));assert.equal(bundleMemberIds({nodes:copy.nodes,boardGroups:copy.groups},copy.groups.find(g=>g.shotBundle)).length,2);
 const invalid=buildCanvasCopy(p.nodes,p.edges,['entry','v1'],p.boardGroups);invalid.groups.find(g=>g.shotBundle).shotSourceId='missing';assert.throws(()=>pasteCanvasCopy(invalid,{uid:()=>`bad-${++i}`}),/无效镜头来源/);
});
test('legacy first result as its own source remains exclusively version-owned through plan, save and copy',()=>{
 const p=clipboardFixture();p.boardGroups=p.boardGroups.filter(g=>!g.shotBundle);p.nodes=p.nodes.filter(n=>n.id!=='entry');
 for(const n of p.nodes)if(n.generatedSource==='entry')n.generatedSource='v1';p.boardGroups[0].sourceNodeId='v1';p.edges=p.edges.map(e=>e.to==='entry'?{...e,to:'v1'}:e);
 const plan=planShotBundle(p,{nodeIds:['v1'],createId:()=> 'legacy-shot'});assert.equal(plan.group.shotSourceId,'v1');assert.deepEqual(plan.group.memberIds,['image','audio','whitebox']);p.boardGroups=plan.boardGroups;
 assert.equal(new Set(p.boardGroups.flatMap(g=>g.memberIds)).size,5);assert.equal(pruneGroups(p.boardGroups,p.nodes).find(g=>g.shotBundle).shotSourceId,'v1');
 const project=demoProject();Object.assign(project,{nodes:p.nodes,edges:p.edges,boardGroups:p.boardGroups});assert.doesNotThrow(()=>validateProject(JSON.parse(JSON.stringify(project))));
 let i=0;const copied=pasteCanvasCopy(buildCanvasCopy(p.nodes,p.edges,bundleMemberIds(p,plan.group),p.boardGroups),{uid:()=>`legacy-copy-${++i}`});const first=copied.nodes.find(n=>n.title==='v1'),group=copied.groups.find(g=>g.shotBundle);assert.equal(group.shotSourceId,first.id);assert.equal(group.memberIds.includes(first.id),false);
 Object.assign(project,{nodes:copied.nodes,edges:copied.edges,boardGroups:copied.groups});assert.doesNotThrow(()=>validateProject(project));
 const moved=regroup(p.boardGroups,['v1','other'],'manual').find(g=>g.id==='legacy-shot');assert.equal(moved.shotBundle,undefined);assert.equal(moved.shotSourceId,undefined);
 const gone=pruneGroups(p.boardGroups,p.nodes.filter(n=>n.id!=='v1')).find(g=>g.id==='legacy-shot');assert.equal(gone.shotBundle,undefined);
 const duplicate=pruneGroups([...p.boardGroups,{id:'duplicate',name:'重复镜头',memberIds:['other'],shotBundle:true,shotSourceId:'v1'}],p.nodes);assert.equal(duplicate.filter(g=>g.shotBundle).length,1);assert.equal(duplicate.find(g=>g.id==='duplicate').shotSourceId,undefined);
 const noReferences={nodes:p.nodes.filter(n=>['v1','v2'].includes(n.id)),edges:[],boardGroups:[p.boardGroups.find(g=>g.videoVersions)]};assert.throws(()=>planShotBundle(noReferences,{nodeIds:['v1'],createId:()=> 'no-base'}),/先连入参考素材/);
});
