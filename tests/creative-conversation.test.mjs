import test from 'node:test';
import assert from 'node:assert/strict';
import {creativeConversationEntries,restoreCreativeVersion} from '../src/workstation/creative-conversation.mjs';
import {normalizeWriting,boundedHistory} from '../src/workstation/writing-agent.mjs';
import {snapshotStory} from '../src/workstation/story.mjs';

test('conversation associates canonical tasks by persisted id, without matching repeated prompt text',()=>{
 const tasks=[{id:'first',status:'ready',candidate:{text:'原候选'}},{id:'second',status:'canceled'}];
 const messages=normalizeWriting({messages:[{role:'user',content:'同一句要求',createdAt:1},{role:'assistant',content:'先讨论'},{role:'user',content:'同一句要求',taskId:'first',createdAt:2},{role:'assistant',content:'已完成'},{role:'user',content:'再改',taskId:'second'}]}).messages;
 const entries=creativeConversationEntries(messages,tasks);
 assert.deepEqual(entries.map(e=>e.kind==='task'?e.task.id:e.message.content),['同一句要求','先讨论','同一句要求','first','已完成','再改','second']);
 assert.equal(entries[3].task,tasks[0],'state and candidate are not copied into a second store');
 tasks[0].status='adopted';assert.equal(entries[3].task.status,'adopted');
 assert.equal(messages[2].taskId,'first');assert.equal(messages[2].createdAt,2);
});

test('old task records remain visible without inventing message links; each task appears once',()=>{
 const tasks=[{id:'orphan'},{id:'linked'}];
 const messages=[{role:'user',content:'旧对话'},{role:'user',content:'新要求',taskId:'linked'},{role:'assistant',content:'完成',taskId:'linked'}];
 assert.deepEqual(creativeConversationEntries(messages,tasks).filter(e=>e.kind==='task').map(e=>e.task.id),['linked','orphan']);
 assert.equal(creativeConversationEntries([{role:'user',content:'任务已清理',taskId:'gone'}],[]).length,1);
});

test('message metadata is optional and bounded history sends only model conversation fields',()=>{
 const old={role:'user',content:'旧内容'};assert.deepEqual(normalizeWriting({messages:[old]}).messages,[old]);
 assert.deepEqual(normalizeWriting({messages:[{...old,taskId:'<script>',createdAt:-2}]}).messages,[old]);
 assert.deepEqual(boundedHistory([{...old,taskId:'task-a',createdAt:1}]),[old]);
});

test('restoring a version snapshots the current script, shots and assets before replacing them',()=>{
 const ws={script:'旧剧本',story:{shots:[{id:'old-shot',scene:'旧场景',description:'旧动作',duration:3,characters:[]}],assets:[{id:'old-asset',kind:'prop',name:'玉印',description:'旧道具'}],versions:[]}};
 const saved=snapshotStory(ws,'已确认版本');ws.script='正在修改的新剧本';ws.story.shots[0].description='新动作';ws.story.assets[0].name='新道具';
 const result=restoreCreativeVersion(ws,saved.id);
 assert.equal(result.id,saved.id);assert.equal(ws.script,'旧剧本');assert.equal(ws.story.shots[0].description,'旧动作');assert.equal(ws.story.assets[0].name,'玉印');
 const backup=ws.story.versions.at(-1);assert.equal(backup.label,'恢复前自动保存');assert.equal(backup.script,'正在修改的新剧本');assert.equal(backup.shots[0].description,'新动作');assert.equal(backup.assets[0].name,'新道具');
 assert.notEqual(ws.story.shots,saved.shots);assert.throws(()=>restoreCreativeVersion(ws,'gone'),/已不存在/);
});

test('production context preserves a long explicit project brief and stays bounded',async()=>{
 const {creativeProductionBrief,creativeDiscussionHistory}=await import('../src/workstation/creative-conversation.mjs');
 const brief='设'.repeat(6000);assert.equal(creativeProductionBrief(brief,[{role:'user',content:'近期讨论'}],null),brief);
 const combined=creativeProductionBrief('主角设定',[{role:'user',content:'请保留偷偷结印'}],{status:'ready',candidate:{kind:'selection-rewrite',text:'候选新动作'}});
 assert.match(combined,/主角设定/);assert.match(combined,/偷偷结印/);assert.match(combined,/候选新动作/);assert.ok(combined.length<=6000);
 const history=creativeDiscussionHistory([{role:'user',content:'看看候选'}],{status:'ready',candidate:{kind:'selection-rewrite',text:'长'.repeat(20000)}});assert.match(history.at(-1).content,/仅附部分摘要/);
});
