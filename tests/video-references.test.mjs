import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceEntries,referenceProblem,validateReferenceMentions,compileReferencePrompt,mentionQuery,insertMention} from '../src/video-references.mjs';
import {buildCanvasCopy,pasteCanvasCopy} from '../src/board-operations.mjs';
import {planVideoResult} from '../src/video-generation.mjs';
const nodes=[{id:'i',type:'image',src:'img',title:'同名'},{id:'v',type:'video',src:'vid',title:'同名'},{id:'a',type:'audio',src:'aud',title:'<音频>'},{id:'j',type:'image',src:'img',title:'第二张'}];
test('mixed references use stable aliases across rename, reorder and removal',()=>{
 const first=referenceEntries(nodes,['i','v','a','i']);assert.deepEqual(first.map(r=>r.alias),['图片1','视频1','音频1']);
 const changed=nodes.map(n=>({...n,title:'新名称'}));
 assert.deepEqual(referenceEntries(changed,['a','v','i'],first).map(r=>r.alias),['音频1','视频1','图片1']);
 assert.equal(referenceEntries(nodes,['j'],first)[0].alias,'图片2');
 assert.equal(validateReferenceMentions('@图片1 @视频1 @音频1',first),'');
 assert.match(validateReferenceMentions('@图片1',referenceEntries(nodes,['j'],first)),/已移除/);
});
test('mentions compile to actual same-kind upload order rather than the alias number',()=>{
 const refs=referenceEntries(nodes,['j','i','a'],referenceEntries(nodes,['i']));
 assert.equal(compileReferencePrompt('用 @图片2 的场景和 @图片1 的角色，以 @音频1 为节奏',refs),'用 第1张参考图片 的场景和 第2张参考图片 的角色，以 第1段参考音频 为节奏');
 assert.throws(()=>compileReferencePrompt('@视频1',refs),/未连接/);
 const at=mentionQuery('角色参考 @图',7);assert.deepEqual(at,{start:5,end:7,query:'图'});
 assert.deepEqual(insertMention('角色 @图 后景',5,'图片1'),{value:'角色 @图片1  后景',caret:8});
 assert.equal(mentionQuery('邮箱@test.com 后景',14),null);
});
test('unsupported audio and reference limits block before upload without dropping input',()=>{
 const refs=referenceEntries(nodes,['i','v','a']);
 assert.equal(referenceProblem(refs,{media:{image:true,video:true,audio:true}}),'');
 assert.match(referenceProblem(refs,{media:{image:true,video:true,audio:false}}),/音频/);
 assert.match(referenceProblem([...refs,{nodeId:'a2',kind:'audio',alias:'音频2'}]),/最多/);
 assert.match(referenceProblem(refs.filter(r=>r.kind==='audio'),{media:{audio:true},audioRequiresVisual:true}),/同时连接/);
 assert.equal(refs.length,3);
});
test('copying a wired generator remaps its draft references along with the wires',()=>{
 const refs=nodes.map(n=>({...n,src:`data:${n.type}/${n.type==='image'?'png':n.type==='audio'?'wav':'mp4'};base64,AAAA`,x:0,y:0,w:280})),source={id:'g',type:'video',title:'生成器',text:'',x:400,y:0,w:280,videoDraft:{prompt:'参考 @图片1 @音频1',aliases:referenceEntries(refs,['i','a']),referenceOrder:['i','a']}};
 const copied=buildCanvasCopy([...refs,source],[{from:'i',to:'g'},{from:'a',to:'g'}],['i','a','g']);let i=0;
 const result=pasteCanvasCopy(copied,{uid:()=>`copy-${++i}`}),target=result.nodes.find(n=>n.title==='生成器');
 assert.deepEqual(target.videoDraft.referenceOrder,['copy-1','copy-2']);assert.deepEqual(target.videoDraft.aliases.map(r=>r.nodeId),['copy-1','copy-2']);assert.equal(target.videoDraft.prompt,'参考 @图片1 @音频1');
 assert.equal(source.videoDraft.referenceOrder[0],'i');
});
test('a completed empty generator keeps references but excludes its new output from the next request',()=>{
 const source={id:'g',type:'video',text:'',videoDraft:{prompt:'用 @音频1',aliases:[{nodeId:'a',kind:'audio',alias:'音频1'}],referenceOrder:['a']}};
 const p={nodes:[source],edges:[]},plan=planVideoResult(p,{id:'job',sourceId:'g',sourceText:'',prompt:'用 @音频1',referenceIds:['a']},'video',()=>{throw Error('must reuse target');});
 assert.equal(plan.replace,true);assert.equal(plan.node.videoDraft.excludeSelf,true);assert.equal(plan.node.videoDraft.aliases[0].alias,'音频1');assert.equal(source.videoDraft.excludeSelf,undefined);
});
