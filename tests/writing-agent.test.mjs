import test from 'node:test';import assert from 'node:assert/strict';
import {writingRequest,generateWriting} from '../text-writing.mjs';
import {normalizeWriting,boundedHistory,applyLocalWriting} from '../src/workstation/writing-agent.mjs';
import {defaultWorkstation,validateWorkstation} from '../src/workstation/sequence.mjs';
const shot={id:'shot1',scene:'小院',characters:['甲'],description:'甲进门',dialogue:'来了',duration:4,shotSize:'全景',cameraMovement:'固定',assetIds:['asset1'],canvasNodeId:'node1'};
const cfg={base:'https://example.com',model:'test',key:'FAKE'};
const response=content=>async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(content)}}]})});
test('conversation survives project validation; imported roles and context are bounded',()=>{
 const ws=defaultWorkstation();ws.writing={brief:'关系设定',skill:'structure',messages:[{role:'system',content:'bad'},{role:'user',content:'讨论'},{role:'assistant',content:'建议'}],key:'SECRET'};
 const w=validateWorkstation(ws).writing;assert.equal(w.messages.length,2);assert.equal(w.brief,'关系设定');assert.ok(!JSON.stringify(w).includes('SECRET'));
 assert.equal(normalizeWriting({skill:'unknown'}).skill,'general');assert.ok(boundedHistory(Array.from({length:30},(_,i)=>({role:i%2?'assistant':'user',content:'a'.repeat(12000)}))).reduce((s,m)=>s+m.content.length,0)<=24000);
});
test('chat combines prior turns, chosen skill, project brief and assets without output mutation tools',()=>{
 const r=writingRequest({kind:'chat',prompt:'为什么这样写',script:'剧本',history:[{role:'user',content:'保留悬念'},{role:'assistant',content:'延迟揭示'}],skill:'dialogue',brief:'兄弟关系',assets:[{name:'甲',kind:'character',description:'来客'}]});
 assert.equal(r.messages.length,4);assert.match(r.messages[0].content,/潜台词/);assert.match(r.messages[3].content,/兄弟关系/);assert.match(r.messages[3].content,/来客/);assert.equal(r.structured,false);
});
test('selection replacement changes precisely one occurrence and rejects stale offsets',()=>{
 const ws={script:'前文重复后文重复尾声'};const p={scope:'selection',selection:{start:2,end:4,text:'重复'},result:{text:'新的'}};
 writingRequest({kind:'rewrite',prompt:'改',script:ws.script,scope:'selection',selection:p.selection});applyLocalWriting(ws,p);assert.equal(ws.script,'前文新的后文重复尾声');assert.throws(()=>applyLocalWriting(ws,p),/变化/);
 assert.throws(()=>writingRequest({kind:'rewrite',prompt:'改',script:'原稿',scope:'selection',selection:{start:0,end:2,text:'错字'}}),/无效/);
});
test('selected-shot output cannot invent, duplicate or omit ids; valid patch preserves unrelated shots and canvas links',async()=>{
 const body={kind:'rewrite',prompt:'动作改为离开',script:'甲进门',shots:[shot],scope:'shots',selectedIds:['shot1']};
 for(const shots of [[{...shot,id:'other'}],[shot,shot],[]])await assert.rejects(generateWriting(cfg,body,{fetchImpl:response({shots})}),/未选中|遗漏/);
 const result=await generateWriting(cfg,body,{fetchImpl:response({shots:[{...shot,description:'甲离开',canvasNodeId:'bogus'}]})});
 const ws={story:{shots:[shot,{...shot,id:'shot2'}]}};applyLocalWriting(ws,{scope:'shots',result});assert.equal(ws.story.shots[0].description,'甲离开');assert.equal(ws.story.shots[0].canvasNodeId,'node1');assert.deepEqual(ws.story.shots[0].assetIds,['asset1']);assert.equal(ws.story.shots[1].description,'甲进门');
});
test('export/import restores creative conversations along with story',async()=>{
 const {demoProject}=await import('../src/model.mjs');const {buildWorkstationBackup,restoreWorkstationBackup}=await import('../src/workstation/backup.mjs');const p=demoProject();p.workstation.writing=normalizeWriting({brief:'悬疑',skill:'review',messages:[{role:'user',content:'检查逻辑'},{role:'assistant',content:'时间需澄清'}]});const {backup}=await buildWorkstationBackup(p,{get:async()=>null});const {project}=await restoreWorkstationBackup(backup,{put:async()=>{}});assert.deepEqual(project.workstation.writing,p.workstation.writing);
});
test('long projects can discuss a selected passage while full requests require explicit splitting',()=>{
 const script='a'.repeat(100000)+'尾部';assert.throws(()=>writingRequest({kind:'chat',prompt:'讨论',script}),/分段|选择/);
 const r=writingRequest({kind:'rewrite',prompt:'改',script,scope:'selection',selection:{start:100000,end:100002,text:'尾部'}});assert.ok(r.messages.at(-1).content.length<10000);assert.match(r.messages.at(-1).content,/尾部/);
});
test('provider address is checked before any key can be sent',async()=>{
 let called=false;await assert.rejects(generateWriting({...cfg,base:'http://example.com'},{kind:'chat',prompt:'讨论',script:''},{fetchImpl:async()=>{called=true}}),/HTTPS/);assert.equal(called,false);
});
