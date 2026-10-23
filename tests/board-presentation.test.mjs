import test from 'node:test';
import assert from 'node:assert/strict';
import {boardItems,boardWires,ensureStoryShotGroup,detachGroupNode,groupCardRect,collapsedGroupFor,GROUP_CARD_WIDTH} from '../src/board-presentation.mjs';
import {planShotBundle,bundleMemberIds} from '../src/shot-bundles.mjs';
import {pruneGroups,buildCanvasCopy,pasteCanvasCopy,nodesInRect} from '../src/board-operations.mjs';
import {planCanvasArrangement} from '../src/canvas-arrange.mjs';
import {demoProject,validateProject} from '../src/model.mjs';
import {sendStoryToCanvas,sendStoryPackageToCanvas} from '../src/workstation/story-canvas.mjs';
import {normalizeStory} from '../src/workstation/story.mjs';
const size=n=>({w:n.w,h:250});
function project(count=29){const p=demoProject();p.nodes=[];p.edges=[];p.workstation={script:'一个完整的剧本。',story:normalizeStory({shots:Array.from({length:count},(_,i)=>({id:'s'+i,scene:'场景'+i,description:'镜头内容'+i,duration:3,characters:[],assetIds:[]})),assets:[]})};return validateProject(p);}
function make(count=29){const p=project(count);sendStoryPackageToCanvas(p);return p;}
test('29 shots project as one card; all source records, node ids and edges survive collapse and expand',()=>{
 const p=make(),g=p.boardGroups[0],before=structuredClone({nodes:p.nodes,edges:p.edges,story:p.workstation.story});
 assert.equal(g.memberIds.length,29);assert.equal(g.collapsed,true);assert.equal(boardItems(p,size).length,2);assert.equal(boardWires(p,boardItems(p,size)).length,1);
 g.collapsed=false;assert.equal(boardItems(p,size).length,30);assert.equal(boardWires(p,boardItems(p,size)).length,29);
 assert.deepEqual({nodes:p.nodes,edges:p.edges,story:p.workstation.story},before);
 assert.doesNotThrow(()=>validateProject(structuredClone(p)));
});
test('standalone-shot sync and repeated package updates group once and respect expanded state and manual groups',()=>{
 const p=project(3);sendStoryToCanvas(p,'shots',['s0','s1','s2']);assert.equal(p.boardGroups.length,1);
 const g=p.boardGroups[0],id=g.id;g.collapsed=false;sendStoryPackageToCanvas(p);assert.equal(p.boardGroups.length,1);assert.equal(g.collapsed,false);assert.equal(p.boardGroups[0].id,id);assert.equal(p.nodes.length,4);
 const manual=project(3);sendStoryToCanvas(manual,'shots',['s0']);manual.boardGroups=[{id:'manual',name:'手动组',memberIds:[manual.nodes.find(n=>n.storyRef.kind==='shot').id]}];sendStoryPackageToCanvas(manual);
 assert.equal(manual.boardGroups[0].id,'manual');assert.equal(manual.boardGroups[1].memberIds.length,2);assert.equal(new Set(manual.boardGroups.flatMap(g=>g.memberIds)).size,3);
});
test('extract one shot leaves others collapsed, retains provenance and wires, and remains standalone after sync',()=>{
 const p=make(5),g=p.boardGroups[0],id=g.memberIds[0],before=structuredClone(p.edges),ref=structuredClone(p.nodes.find(n=>n.id===id).storyRef);
 assert.equal(detachGroupNode(p,g.id,id),true);assert.equal(g.memberIds.length,4);assert.equal(boardItems(p,size).length,3);
 assert.deepEqual(p.edges,before);assert.deepEqual(p.nodes.find(n=>n.id===id).storyRef,ref);
 sendStoryPackageToCanvas(p);assert.equal(g.memberIds.includes(id),false);
 ensureStoryShotGroup(p,{force:true});assert.equal(g.memberIds.includes(id),true);assert.equal(p.nodes.find(n=>n.id===id).storyStandalone,undefined);
});
test('prune, JSON reopen and clipboard retain collapsed view; copies cannot claim canonical story ownership',()=>{
 const p=make(3);p.boardGroups=pruneGroups(p.boardGroups,p.nodes);assert.equal(p.boardGroups[0].collapsed,true);assert.equal(p.boardGroups[0].storyShots,true);
 const reopened=validateProject(JSON.parse(JSON.stringify(p)));assert.equal(boardItems(reopened,size).length,2);
 let serial=0;const clip=buildCanvasCopy(p.nodes,p.edges,p.boardGroups[0].memberIds,p.boardGroups),copy=pasteCanvasCopy(clip,{uid:()=>`copy-${serial++}`});
 assert.equal(copy.groups[0].collapsed,true);assert.equal(copy.groups[0].storyShots,undefined);assert.ok(copy.nodes.every(n=>!n.storyRef));
 assert.equal(boardItems({nodes:copy.nodes,edges:copy.edges,boardGroups:copy.groups},size).length,1);
});
test('bounds, marquee, filtering and arranging use card geometry instead of hidden far-away members',()=>{
 const p=make(29),g=p.boardGroups[0];p.nodes.find(n=>n.id===g.memberIds.at(-1)).y=90000;
 const rect=groupCardRect(p,g),items=boardItems(p,size);assert.equal(rect.h,190);assert.equal(rect.w,GROUP_CARD_WIDTH);
 const hits=nodesInRect(items,rect,n=>n);assert.ok(hits.includes('group:'+g.id));
 assert.deepEqual(boardItems(p,size,n=>n.type==='video'),[]);
 const original=structuredClone(p),moves=planCanvasArrangement(p,()=>250);assert.deepEqual(p,original);
 for(const m of moves)Object.assign(p.nodes.find(n=>n.id===m.id),m);
 const visible=boardItems(p,size);assert.ok(Math.max(...visible.map(n=>n.y+n.h))-Math.min(...visible.map(n=>n.y))<1000);
 assert.equal(p.nodes.find(n=>n.id===g.memberIds.at(-1)).y-p.nodes.find(n=>n.id===g.memberIds[0]).y,original.nodes.find(n=>n.id===g.memberIds.at(-1)).y-original.nodes.find(n=>n.id===g.memberIds[0]).y);
});
test('group bundle maps actual edge indices without deleting or rewriting edges; internal wires are hidden',()=>{
 const p=make(3),g=p.boardGroups[0];p.edges.push({from:g.memberIds[0],to:g.memberIds[1],manual:true});
 const before=structuredClone(p.edges),wires=boardWires(p,boardItems(p,size));assert.equal(wires.length,1);assert.equal(wires[0].indices.length,3);assert.deepEqual(wires[0].groupIds,[g.id]);assert.deepEqual(p.edges,before);
});
test('old drafts remain in the compact group after regeneration; unavailable and max groups fail safely',()=>{
 const p=make(2),old=[...p.boardGroups[0].memberIds];for(const n of p.nodes)if(n.storyRef?.kind==='shot')delete n.storyRef;
 p.workstation.story.shots=normalizeStory({shots:[{id:'new',scene:'新镜头',description:'新稿',duration:2}]}).shots;sendStoryPackageToCanvas(p);assert.ok(old.every(id=>p.boardGroups[0].memberIds.includes(id)));assert.equal(p.boardGroups[0].memberIds.length,3);
 const empty=project(0);assert.equal(ensureStoryShotGroup(empty,{force:true}),null);
 const limit=project(2);limit.boardGroups=Array.from({length:200},(_,i)=>({id:'g'+i,memberIds:[]}));sendStoryPackageToCanvas(limit);assert.equal(limit.boardGroups.length,200);
});
test('collapsed shot card envelopes version cards, reference wires and outputs; expansion restores original groups',()=>{
 const p={nodes:[{id:'ref',type:'image',x:10,y:20,w:300},{id:'entry',type:'video',x:400,y:20,w:300},{id:'v1',type:'video',x:800,y:20,w:300},{id:'v2',type:'video',x:1100,y:20,w:300},{id:'out',type:'video',x:1600,y:20,w:300}],edges:[{from:'ref',to:'entry'},{from:'entry',to:'v1'},{from:'entry',to:'v2'},{from:'v1',to:'out'},{from:'v2',to:'out'}],boardGroups:[{id:'versions',name:'版本',memberIds:['v1','v2'],collapsed:true,videoVersions:true,sourceNodeId:'entry'}]};
 const before=structuredClone({nodes:p.nodes,edges:p.edges}),plan=planShotBundle(p,{nodeIds:['entry'],createId:()=> 'shot'});p.boardGroups=plan.boardGroups;
 const items=boardItems(p,size);assert.equal(items.length,2);assert.equal(items[0].groupId,'shot');assert.deepEqual(new Set(items[0].memberIds),new Set(['ref','entry','v1','v2']));assert.equal(collapsedGroupFor(p,'v2').id,'shot');
 const wires=boardWires(p,items);assert.equal(wires.length,1);assert.deepEqual(wires[0].indices,[3,4]);assert.deepEqual(wires[0].groupIds,['shot']);
 plan.group.collapsed=false;assert.equal(boardItems(p,size).length,4);assert.equal(collapsedGroupFor(p,'v2').id,'versions');assert.equal(boardWires(p,boardItems(p,size)).length,3);
 assert.deepEqual({nodes:p.nodes,edges:p.edges},before);
});
test('effective membership supports filters showing only nested versions and excludes deleted media',()=>{
 const p={nodes:[{id:'entry',type:'text',x:0,y:0,w:300},{id:'v',type:'video',x:900,y:900,w:300}],edges:[{from:'entry',to:'v'}],boardGroups:[{id:'versions',name:'版本',memberIds:['v','missing'],videoVersions:true,sourceNodeId:'entry',collapsed:true},{id:'shot',name:'镜头',memberIds:['entry'],shotBundle:true,shotSourceId:'entry',collapsed:true}]};
 assert.deepEqual(bundleMemberIds(p,p.boardGroups[1]),['entry','v']);const items=boardItems(p,size,n=>n.type==='video');assert.equal(items.length,1);assert.equal(items[0].groupId,'shot');assert.deepEqual(items[0].memberIds,['v']);assert.deepEqual(groupCardRect(p,p.boardGroups[1],n=>n.type==='video'),{x:900,y:900,w:360,h:300});assert.deepEqual(boardWires(p,items),[]);
});
