import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {videoVersionGroup,replaceVersionClips,adoptVideoVersion} from '../src/video-versions.mjs';

// Exercise the shipped shell action without starting a DOM or touching user media.
const shell=await readFile(new URL('../src/workstation/shell.mjs',import.meta.url),'utf8');
const start=shell.indexOf(' async function replaceCanvasVersionInEdit(nodeId){'),end=shell.indexOf('\n async function sendVideoVersionsToEdit',start);
assert.ok(start>=0&&end>start,'replacement action must remain testable');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const action=new AsyncFunction('ctx','videoVersionGroup','importCanvasNodeToLibrary','replaceVersionClips','adoptVideoVersion',shell.slice(start,end)+'\nreturn replaceCanvasVersionInEdit("v2");');
function fixture(){
 const clip={id:'clip',assetId:'a1',canvasNodeId:'v1',versionGroupId:'versions',start:50,in:12,out:90,volume:.6,muted:true};
 const owner={id:'p',nodes:[{id:'v1',type:'video',src:'one',mediaId:'a1'},{id:'v2',type:'video',src:'two',mediaId:'a2'}],boardGroups:[{id:'versions',videoVersions:true,sourceNodeId:'entry',memberIds:['v1','v2'],adoptedNodeId:'v1'}],workstation:{sequence:{fps:24,video:[clip],audio:[]}}};
 let current=owner,active=true,resolveImport,checkpoints=0,commits=0,persists=0;
 const imported=new Promise(resolve=>resolveImport=resolve),ctx={project:()=>current,isProjectActive:()=>active,checkpoint:()=>checkpoints++,commit:()=>commits++,persist:()=>persists++,toast(){}};
 return {owner,clip,run:()=>action(ctx,videoVersionGroup,()=>imported,replaceVersionClips,adoptVideoVersion),complete:(durationSec=5)=>resolveImport({id:'a2',kind:'video',durationSec}),switchProject:()=>current={...owner,id:'other'},deactivate:()=>active=false,counts:()=>({checkpoints,commits,persists})};
}
for(const [label,change,error] of [
 ['project switches',f=>f.switchProject(),/工程已切换/],
 ['project becomes inactive',f=>f.deactivate(),/工程已切换/],
 ['version group disappears',f=>f.owner.boardGroups=[],/卡片已移除/],
 ['candidate leaves the group',f=>f.owner.boardGroups[0].memberIds=['v1'],/卡片已移除/],
 ['candidate is deleted',f=>f.owner.nodes=f.owner.nodes.filter(n=>n.id!=='v2'),/候选素材已移除/],
 ['candidate media changes',f=>f.owner.nodes[1].src='replaced',/候选素材已移除/],
])test('replacement remains atomic when '+label+' during import',async()=>{
 const f=fixture(),before=structuredClone(f.owner.workstation.sequence),group=f.owner.boardGroups[0],pending=f.run();change(f);f.complete();
 await assert.rejects(pending,error);
 assert.deepEqual(f.owner.workstation.sequence,before);assert.equal(group.adoptedNodeId,'v1');
 assert.deepEqual(f.counts(),{checkpoints:0,commits:0,persists:0});
});
test('shorter replacement leaves timeline and adoption untouched',async()=>{
 const f=fixture(),before=structuredClone(f.owner),pending=f.run();f.complete(2);await assert.rejects(pending,/较短/);
 assert.deepEqual(f.owner,before);assert.deepEqual(f.counts(),{checkpoints:0,commits:0,persists:0});
});
test('successful replacement uses live group and preserves placement, trims, gain and mute',async()=>{
 const f=fixture(),pending=f.run();
 // Another safe operation may clone group objects while media import is pending.
 const stale=f.owner.boardGroups[0];f.owner.boardGroups=structuredClone(f.owner.boardGroups);f.complete();assert.equal(await pending,true);
 assert.deepEqual(f.owner.workstation.sequence.video,[{...f.clip,assetId:'a2',canvasNodeId:'v2'}]);
 assert.equal(f.owner.boardGroups[0].adoptedNodeId,'v2');assert.equal(stale.adoptedNodeId,'v1');
 assert.deepEqual(f.counts(),{checkpoints:1,commits:1,persists:1});
});
