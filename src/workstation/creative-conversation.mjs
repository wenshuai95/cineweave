import {normalizeStory,snapshotStory} from './story.mjs';
import {boundedHistory} from './writing-agent.mjs';

// Task entries reference canonical creativeTasks. No candidate or state is
// duplicated in messages; older conversations remain readable without migration.
export function creativeConversationEntries(messages,tasks){
 const entries=[],seen=new Set(),byId=new Map(tasks.map(t=>[t.id,t]));
 for(const message of messages){
  entries.push({kind:'message',message});
  if(message.taskId&&byId.has(message.taskId)&&!seen.has(message.taskId)){
   entries.push({kind:'task',task:byId.get(message.taskId)});seen.add(message.taskId);
  }
 }
 // Records from old versions, or whose message aged out of the bounded log,
 // are still accessible. Never guess an association from matching prompt text.
 for(const task of tasks)if(!seen.has(task.id))entries.push({kind:'task',task});
 return entries;
}

export function restoreCreativeVersion(ws,versionId){
 const version=ws.story?.versions?.find(v=>v.id===versionId);
 if(!version)throw Error('此版本已不存在，请重新打开版本记录');
 const saved=structuredClone(version),content=normalizeStory(saved);
 snapshotStory(ws,'恢复前自动保存');
 ws.script=saved.script||'';ws.story.shots=content.shots;ws.story.assets=content.assets;
 return saved;
}

export function creativeCandidateContext(task){
 if(task?.status!=='ready'||!task.candidate)return '';
 const c=task.candidate;
 const body=c.kind==='selection-rewrite'?c.text:JSON.stringify({shots:c.shots,assets:c.assets});
 return `当前正在预览的待采用候选（尚未写入工程）：\n${String(body).slice(0,10000)}${body.length>10000?'\n（候选较长，仅附部分摘要；不要声称已检查全部内容。）':''}`;
}

export function creativeDiscussionHistory(messages,task){
 const candidate=creativeCandidateContext(task);
 return boundedHistory(candidate?[...messages,{role:'assistant',content:candidate}]:messages);
}

export function creativeProductionBrief(brief,messages,task){
 // Keep the user's project brief first. Earlier discussion is context, never
 // authorization to edit or a substitute for the explicit production request.
 const base=String(brief||'').slice(0,6000),context=boundedHistory(messages).slice(-4).map(m=>`${m.role==='user'?'用户':'助手'}：${m.content.slice(0,600)}`).join('\n');
 const candidate=creativeCandidateContext(task).slice(0,1800);
 return [base,(context||candidate)&&'以下是近期讨论与待采用候选，仅作参考；以本次明确要求为准，不视为已确认或已应用：',context,candidate].filter(Boolean).join('\n').slice(0,6000);
}
