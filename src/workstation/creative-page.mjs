import './creative-ui.css';
import {creativeConversationEntries,restoreCreativeVersion,creativeDiscussionHistory,creativeProductionBrief} from './creative-conversation.mjs';
import {creativeSourceSignature,resolveCreativeSource,createCreativeTask,normalizeCreativeTasks,runCreativeTask} from './creative-agent.mjs';
import {normalizeWriting,writingSkills} from './writing-agent.mjs';
import {snapshotStory} from './story.mjs';
import {t} from '../i18n/index.mjs';
import {escapeHtml as esc,textPost,textStatus,connectionLabel,showTextSettings} from './text-settings.mjs';

const LIVE=new Set(['queued','running']);
const LABEL={queued:'等待开始',running:'正在制作',ready:'待你采用',adopted:'已采用',failed:'执行失败',canceled:'已取消',interrupted:'已中断',discarded:'已丢弃'};
const TITLE={'story-package':'分镜与资产设计','selection-rewrite':'局部改写'};
const KIND={character:'角色',scene:'场景',prop:'道具'};
const DEFAULT_PROMPT='根据当前剧本设计文学分镜，并为分镜涉及的角色、场景和道具整理资产提示词。保留剧情顺序和对白。';

export function createCreativePage(root,ctx){
 let project=ctx.project(),prompt='',selection=null,sourceNodeId=null,selectedTaskId=null,note='',status=null,active=null,composition=false,editCheckpoint=0,view='chat',draftFlow=null,versionsOpen=false,documentState={start:0,end:0,scroll:0},logPosition=null;
 const directorPanel=ctx.createDirectorPanel?.();
 root.classList.add('creative-page');
 const ws=(p=ctx.project())=>p.workstation;
 const writing=(p=ctx.project())=>ws(p).writing=normalizeWriting(ws(p).writing);
 const tasks=(p=ctx.project())=>ws(p).creativeTasks=normalizeCreativeTasks(ws(p).creativeTasks);
 const currentTask=()=>tasks().find(t=>t.id===selectedTaskId)||null;
 const sameProject=p=>ctx.project()===p;
 function hasNewDiscussionSince(taskId){const log=writing().messages,index=log.findIndex(m=>m.role==='user'&&m.taskId===taskId);return index>=0&&log.slice(index+1).some(m=>m.role==='user'&&!m.taskId);}
 function contextCandidate(){const task=currentTask(),source=sourceContext();return task?.status==='ready'&&!isStale(task)&&task.sourceScope===source.scope&&(source.scope!=='node'||task.sourceNodeId===source.nodeId)?task:null;}
 function persist(p){
  if(sameProject(p)){ctx.persist();ctx.onCreativeTasksChanged?.();}
  else if(ctx.saveCreativeTasks)Promise.resolve(ctx.saveCreativeTasks(p.id,structuredClone(tasks(p)))).catch(()=>{});
 }
 // Persistence normalizes/clones records. The running object is intentionally
 // independent, and every transition is upserted into its captured project.
 function saveTask(p,task){
  const list=tasks(p),index=list.findIndex(t=>t.id===task.id),copy=structuredClone(task);
  if(index<0)list.push(copy);else list[index]=copy;
  ws(p).creativeTasks=normalizeCreativeTasks(list);persist(p);
  if(sameProject(p)){updateTasks();updateCompose();}
 }
 function messages(p,items){ws(p).writing={...writing(p),messages:[...writing(p).messages,...items.map(m=>({...m,createdAt:m.createdAt||Date.now()}))].slice(-40)};persist(p);}
 function isStale(task){try{return task.projectId!==ctx.project().id||task.sourceSignature!==creativeSourceSignature(ctx.project(),task);}catch{return true;}}
 function sourceContext(){try{return resolveCreativeSource(ctx.project(),sourceNodeId);}catch(e){return {scope:'node',nodeId:sourceNodeId,title:'来源不可用',text:'',canRewrite:false,error:e.message};}}
 function selectionValid(){const source=sourceContext();return selection&&selection.end>selection.start&&source.text.slice(selection.start,selection.end)===selection.text;}
 function contextText(){const source=sourceContext();return source.error||`参考：${source.scope==='node'?`节点「${source.title}」正文`:'项目剧本、分镜和资产设定'}${selectionValid()?`；改写范围：选中 ${selection.text.length} 字`:''}`;}
 function sourceLabel(){return sourceContext().scope==='node'?'本次正文来自此节点；会携带近期对话与项目设定。分镜设计采用后更新项目分镜和资产，原项目剧本保留。':'讨论不改工程。请用明确的制作按钮生成候选，检查后再采用。';}
 function countsText(){const source=sourceContext(),chars=source.text.replace(/\s/g,'').length;return `${selectionValid()?`选中 ${selection.text.length} 字 · `:''}${chars} 字${source.scope==='project'?` · ${ws().story?.shots?.length||0} 个分镜 · ${ws().story?.assets?.length||0} 项资产`:''}`;}
 // 可展开区块的 open 状态集中在 openDetails，避免局部重绘把用户展开的内容折回去。
 const openDetails=new Set();
 const detailAttr=key=>`data-detail-key="${esc(key)}"${openDetails.has(key)?' open':''}`;
 function wireDetails(scope){scope?.querySelectorAll?.('details[data-detail-key]').forEach(d=>{d.ontoggle=()=>{if(d.open)openDetails.add(d.dataset.detailKey);else openDetails.delete(d.dataset.detailKey);};});}
 function truncateLabel(text,max=28){const flat=String(text||'').replace(/\s+/g,' ').trim();return flat.length>max?flat.slice(0,max)+'…':flat;}
 function setView(next){
  view=['chat','director','document','options'].includes(next)?next:'chat';
  root.querySelectorAll('[data-creative-view]').forEach(el=>el.hidden=el.dataset.creativeView!==view);
  root.querySelectorAll('[data-view]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.view===view)));
  const body=root.querySelector('.creative-body');if(body)body.scrollTop=0;
  if(view==='chat'){const log=root.querySelector('.creative-messages');if(log&&logPosition!==null)log.scrollTop=logPosition;}
 }
 // ready 但来源已变化时，唯一主状态是「来源已变化」；不再同时显示待采用与不可采用。
 function taskState(task){return task.status==='ready'&&isStale(task)?{label:'来源已变化',stale:true}:{label:LABEL[task.status]||task.status,stale:false};}
 function render(){
  const previousEditor=root.querySelector('#creativeScript');if(previousEditor)documentState={start:previousEditor.selectionStart||0,end:previousEditor.selectionEnd||0,scroll:previousEditor.scrollTop||0};
  const previousLog=root.querySelector('.creative-messages');if(previousLog)logPosition=previousLog.scrollTop;
  const focused=root.contains(document.activeElement)?document.activeElement:null;
  const focusId=focused?.id,focusStart=focused?.selectionStart,focusEnd=focused?.selectionEnd,scroll=focused?.scrollTop;
  writing();tasks();
  root.innerHTML=`<header class="creative-header"><h2>${t('creative.title')}</h2><button type="button" class="creative-model" data-action="settings" aria-label="${t('creative.settings')}">${esc(connectionLabel(status?.config))} · ${t('creative.settings')}</button></header>
   <nav class="creative-nav" aria-label="${t('creative.navAria')}">${[['chat',t('creative.chat')],['director',t('creative.director')],['document',t('creative.document')],['options',t('creative.options')]].map(([id,label])=>`<button type="button" data-view="${id}" aria-pressed="${view===id}">${label}</button>`).join('')}</nav>
   <div class="creative-body"><section class="creative-chat" data-creative-view="chat">
   <p class="creative-source-scope"><b>${esc(sourceContext().scope==='node'?t('creative.referenceNode',{title:sourceContext().title}):t('creative.referenceProject'))}</b>${sourceNodeId?'<button type="button" data-action="project-scope">'+t('creative.useProject')+'</button>':''}</p><details class="creative-context" aria-label="${t('creative.contextAria')}" ${detailAttr('context')}><summary><b>${t('creative.scope')}</b><span class="creative-counts">${esc(countsText())}</span></summary><div class="creative-context-body"><p class="creative-project-name">${t('creative.project',{name:esc(ctx.project().name||t('creative.untitled'))})}</p><b class="creative-scope">${esc(contextText())}</b><p>${esc(sourceLabel())}</p>${selection?'<button type="button" data-action="clear-selection">'+t('creative.clearSelection')+'</button>':''}</div></details>
   <section class="creative-messages" role="log" aria-label="创作对话与候选结果" aria-live="polite"></section>
   </section>
   <section class="creative-director" data-creative-view="director" aria-label="白模导演助手"></section>
   <section class="creative-document" data-creative-view="document" aria-label="项目文稿"><div class="creative-section-heading"><h3>${t('creative.docTitle')}</h3><span>${t('creative.autoSaved')}</span></div><p>${t('creative.docHelp')}</p><div class="creative-document-tools"><button type="button" data-action="use-selection" disabled>${t('creative.rewriteSelection')}</button><button type="button" data-action="save-version">${t('creative.saveVersion')}</button><button type="button" data-action="legacy">${t('creative.versions')}</button></div><section class="creative-versions" aria-label="${t('creative.versionsAria')}" hidden></section><textarea id="creativeScript" maxlength="200000" rows="10" aria-label="${t('creative.docAria')}" placeholder="${t('creative.docPlaceholder')}"></textarea></section>
   <section class="creative-options" data-creative-view="options" aria-label="${t('creative.settingsTitle')}"><h3>${t('creative.settingsTitle')}</h3><label>${t('creative.skill')}<select id="creativeSkill">${writingSkills.map(s=>`<option value="${s.id}" ${writing().skill===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><p id="creativeSkillDescription">${esc(writingSkills.find(s=>s.id===writing().skill)?.description||'')}</p><label>${t('creative.brief')}<textarea id="creativeBrief" maxlength="6000" rows="5" placeholder="${t('creative.briefPlaceholder')}"></textarea></label><p>${t('creative.settingsHelp')}</p></section></div>
   <form class="creative-composer" data-creative-view="chat"><div class="creative-starters"><button type="button" data-action="package">${t('creative.package')}</button><button type="button" data-action="rewrite">${sourceContext().scope==='node'?t('creative.rewriteNode'):t('creative.rewriteLocal')}</button><button type="button" data-action="discuss" ${draftFlow?'':'hidden'}>${t('creative.discuss')}</button></div><div class="creative-input"><textarea id="creativePrompt" maxlength="6000" rows="2" aria-label="${t('creative.promptAria')}" placeholder="${t('creative.promptPlaceholder')}"></textarea><div class="creative-compose-actions"><span>${t('creative.sendHint')}</span><button type="button" data-action="cancel" ${active?'':'hidden'}>${t('creative.stop')}</button><button type="submit" class="primary" ${active?'disabled':''}>${active?t('creative.working'):t('creative.send')}</button></div></div><p class="creative-compose-disclosure">${t(sourceContext().scope==='node'?'creative.disclosureNode':'creative.disclosureProject')}</p></form><p class="creative-note" role="status">${esc(note)}</p>`;
  root.querySelector('#creativeScript').value=ws().script||'';
  root.querySelector('#creativePrompt').value=prompt;
  root.querySelector('#creativeBrief').value=writing().brief;
  root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  root.querySelector('[data-action="legacy"]').onclick=()=>{versionsOpen=!versionsOpen;updateVersions();};
  root.querySelector('[data-action="project-scope"]')?.addEventListener('click',()=>{sourceNodeId=null;selection=null;draftFlow=null;note='已改用项目剧本；发送仅讨论。';render();});
  root.querySelector('[data-action="discuss"]').onclick=()=>{draftFlow=null;note='本次仅讨论，不生成修改候选。';updateCompose();};
  root.querySelector('[data-action="settings"]').onclick=()=>showTextSettings(ctx,loadStatus);
  root.querySelector('[data-action="package"]').onclick=()=>{selection=null;draftFlow=null;prompt=prompt.trim()||DEFAULT_PROMPT;root.querySelector('#creativePrompt').value=prompt;submit('story-package');};
  root.querySelector('[data-action="rewrite"]').onclick=()=>{const source=sourceContext();if(source.scope==='node'){if(!source.canRewrite||!source.text.trim()){note=source.error||'此节点正文由分镜或资产管理，请在对应记录中修改；也可以继续讨论。';updateCompose();return;}selection={start:0,end:source.text.length,text:source.text};}if(!selectionValid()){setView('document');note='选中一段文稿，再点「改写选中文字」。';updateCompose();root.querySelector('#creativeScript').focus();return;}prompt=prompt.trim()||'改善这段文字的表达与节奏，保留原有剧情和人物设定。';root.querySelector('#creativePrompt').value=prompt;submit('selection-rewrite');};
  root.querySelector('[data-action="clear-selection"]')?.addEventListener('click',()=>{selection=null;draftFlow=null;render();});
  root.querySelector('[data-action="cancel"]').onclick=()=>cancelAll();
  wireDetails(root);wireDocument();wireComposer();
  root.querySelector('#creativeSkill').onchange=e=>{writing().skill=e.target.value;persist(ctx.project());root.querySelector('#creativeSkillDescription').textContent=writingSkills.find(s=>s.id===e.target.value)?.description||'';updateTasks();};
  root.querySelector('#creativeBrief').oninput=e=>{writing().brief=e.target.value;persist(ctx.project());updateTasks();};
  const preservedLogPosition=logPosition;updateMessages();if(preservedLogPosition!==null){root.querySelector('.creative-messages').scrollTop=preservedLogPosition;logPosition=preservedLogPosition;}updateVersions();root.querySelector('#creativeScript').setSelectionRange(documentState.start,documentState.end);root.querySelector('#creativeScript').scrollTop=documentState.scroll;root.querySelector('[data-action="use-selection"]').disabled=documentState.end<=documentState.start;directorPanel?.mount(root.querySelector('.creative-director'));setView(view);
  if(focusId){const target=root.querySelector('#'+focusId);if(target){target.focus({preventScroll:true});if(typeof focusStart==='number'&&target.setSelectionRange)target.setSelectionRange(focusStart,focusEnd);if(scroll!==undefined)target.scrollTop=scroll;}}
 }
 function wireDocument(){
  const area=root.querySelector('#creativeScript'),use=root.querySelector('[data-action="use-selection"]');
  const update=()=>{use.disabled=area.selectionEnd<=area.selectionStart;documentState={start:area.selectionStart,end:area.selectionEnd,scroll:area.scrollTop};};
  area.addEventListener('scroll',update);
  for(const event of ['select','keyup','mouseup','pointerup'])area.addEventListener(event,update);
  area.oninput=()=>{const p=ctx.project(),now=Date.now();if(now-editCheckpoint>1500){ctx.checkpoint();editCheckpoint=now;}ws(p).script=area.value;ctx.commit();persist(p);updateTasks();updateCompose();};
  use.onclick=()=>{if(area.selectionEnd<=area.selectionStart)return;sourceNodeId=null;draftFlow='selection-rewrite';selection={start:area.selectionStart,end:area.selectionEnd,text:area.value.slice(area.selectionStart,area.selectionEnd)};note=`已选中 ${selection.text.length} 字；发送将生成局部改写候选，不会立即替换。`;view='chat';render();root.querySelector('#creativePrompt').focus();};
  root.querySelector('[data-action="save-version"]').onclick=()=>{ctx.checkpoint();snapshotStory(ws(),'手动保存');ctx.commit();persist(ctx.project());updateVersions();ctx.toast('已保存当前剧本、分镜和资产版本');};
 }
 function wireComposer(){
  const input=root.querySelector('#creativePrompt');
  input.oninput=()=>prompt=input.value;
  input.oncompositionstart=()=>composition=true;input.oncompositionend=()=>composition=false;
  input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!composition&&e.keyCode!==229){e.preventDefault();submit();}};
  root.querySelector('form').onsubmit=e=>{e.preventDefault();submit();};
 }
 // Contain all keystrokes (including Escape/Delete and IME) inside this tool.
 root.addEventListener('keydown',e=>e.stopPropagation());
 function updateCompose(){
  const input=root.querySelector('#creativePrompt');if(!input)return;
  const button=root.querySelector('button[type="submit"]');button.disabled=!!active;button.textContent=active?'进行中…':draftFlow==='selection-rewrite'?'生成改写候选':'发送';
  root.querySelector('[data-action="cancel"]').hidden=!active;
  root.querySelector('.creative-note').textContent=note;
  const discuss=root.querySelector('[data-action="discuss"]');if(discuss)discuss.hidden=!draftFlow;
  const context=root.querySelector('.creative-context .creative-scope');if(context)context.textContent=contextText();
  const counts=root.querySelector('.creative-context .creative-counts');if(counts)counts.textContent=countsText();
 }
 function updateMessages({follow=false,paintTask=true}={}){
  const log=root.querySelector('.creative-messages');if(!log)return;
  const position=log.scrollTop,nearEnd=log.scrollHeight-position-log.clientHeight<64;
  const entries=creativeConversationEntries(writing().messages,tasks());
  log.innerHTML=entries.length?entries.map(entry=>{
   if(entry.kind==='message'){const m=entry.message;return `<article class="creative-message ${m.role}"><b>${m.role==='user'?'你':'创作助手'}</b><div>${esc(m.content)}</div></article>`;}
   const t=entry.task,state=taskState(t),selected=t.id===selectedTaskId;
   return `<article class="creative-conversation-task" data-task-id="${esc(t.id)}"><button type="button" data-conversation-task="${esc(t.id)}" aria-expanded="${selected}"><span>${esc(TITLE[t.flow]||'创作任务')}</span><small>${esc(state.label)}</small></button>${selected?'<section class="creative-task-area" aria-label="候选结果"></section>':''}</article>`;
  }).join(''):'<div class="creative-welcome"><h3>'+t('creative.welcomeTitle')+'</h3><p>'+t('creative.welcomeText')+'</p></div>';
  if(active?.kind==='chat')log.insertAdjacentHTML('beforeend','<p class="creative-thinking" role="status">正在讨论创作…</p>');
  log.querySelectorAll('[data-conversation-task]').forEach(b=>b.onclick=()=>{const id=b.dataset.conversationTask;selectedTaskId=selectedTaskId===id?null:id;updateTasks();root.querySelector('[data-conversation-task="'+id+'"]')?.focus({preventScroll:true});});
  if(paintTask)updateTasks({refreshLog:false});
  if(follow||nearEnd)log.scrollTop=log.scrollHeight;else log.scrollTop=position;
  logPosition=log.scrollTop;
 }
 function updateVersions(){
  const area=root.querySelector('.creative-versions');if(!area)return;area.hidden=!versionsOpen;
  root.querySelector('[data-action="legacy"]').setAttribute('aria-expanded',String(versionsOpen));
  if(!versionsOpen)return;
  const list=ws().story?.versions||[];
  area.innerHTML=`<div class="creative-versions-heading"><b>版本记录</b><button type="button" data-close-versions>收起</button></div><p>保留最近 20 个版本，包含剧本、分镜和资产。恢复前会自动保存当前内容，可撤销。</p>${list.length?[...list].reverse().map(v=>`<article><div><b>${esc(v.label||'已保存版本')}</b><small>${new Date(v.createdAt).toLocaleString('zh-CN')} · ${v.script.length} 字 · ${v.shots.length} 镜</small></div><button type="button" data-restore-version="${esc(v.id)}" ${active?'disabled':''}>恢复此版本</button></article>`).join(''):'<p>还没有保存的版本。</p>'}`;
  area.querySelector('[data-close-versions]')?.addEventListener('click',()=>{versionsOpen=false;updateVersions();root.querySelector('[data-action="legacy"]').focus();});
  area.querySelectorAll('[data-restore-version]').forEach(b=>b.onclick=()=>{
   if(active)return;
   try{ctx.checkpoint();const saved=restoreCreativeVersion(ws(),b.dataset.restoreVersion);ctx.commit();persist(ctx.project());selection=null;draftFlow=null;documentState={start:0,end:0,scroll:0};const editor=root.querySelector('#creativeScript');editor.value=ws().script;editor.setSelectionRange(0,0);editor.scrollTop=0;note=`已恢复「${saved.label||'已保存版本'}」；恢复前内容已自动保存。`;updateVersions();updateMessages();updateTasks();updateCompose();ctx.toast(note);}
   catch(e){note=e.message;updateCompose();}
  });
 }
 function candidateHtml(task){
  const c=task.candidate;if(!c)return '';
  if(c.kind==='selection-rewrite')return `<details class="creative-before" ${detailAttr('before:'+task.id)}><summary>查看原文 · ${task.selection?.text?.length||0} 字</summary><pre>${esc(task.selection?.text||'')}</pre></details><pre class="creative-rewrite">${esc(c.text)}</pre>`;
  // 默认只给数量与少量摘要，完整分镜与资产提示词收进可展开详情，避免几十个镜头挤满面板。
  const sceneBrief=c.shots.slice(0,3).map((s,i)=>`镜头 ${i+1}·${s.scene||'未命名场景'}`).join('，');
  const assetBrief=c.assets.slice(0,4).map(a=>`${KIND[a.kind]||'资产'}「${a.name}」`).join('，');
  const review=c.review;
  const reviewHtml=review?`<details class="creative-review"><summary>制作检查 · ${review.issueCount?review.issueCount+' 项提醒':'未发现结构问题'} · 总时长 ${review.durationSec.toFixed(1)} 秒</summary><p>本机检查角色、场景资产和镜头关联，不额外调用 API，不判断剧情或画面质量。</p>${review.issues.length?'<ul>'+review.issues.map(i=>'<li>'+esc(i.message)+'</li>').join('')+'</ul>':'<p>角色、场景与资产引用检查已完成，采用前请复核创作内容。</p>'}</details>`:'';
  return `${reviewHtml}<div class="creative-candidate-summary"><p><b>分镜 ${c.shots.length} 镜</b>${sceneBrief?` · ${esc(sceneBrief)}${c.shots.length>3?' 等':''}`:''}</p>${c.assets.length?`<p><b>资产提示词 ${c.assets.length} 项</b>${assetBrief?` · ${esc(assetBrief)}${c.assets.length>4?' 等':''}`:''}</p>`:''}</div><details class="creative-detail" ${detailAttr('shots:'+task.id)}><summary>查看完整分镜 · ${c.shots.length} 镜</summary><div class="creative-preview-scroll">${c.shots.map((s,i)=>`<article class="creative-shot"><header><b>镜头 ${i+1} · ${esc(s.scene||'未命名场景')}</b><span>${esc(s.duration)} 秒</span></header><p>${esc(s.description)}</p>${s.dialogue?`<p class="creative-dialogue">${esc(s.dialogue)}</p>`:''}<small>${esc((s.characters||[]).join('、'))} · ${esc(s.shotSize)} · ${esc(s.cameraMovement)}</small></article>`).join('')}</div></details><details class="creative-detail" ${detailAttr('assets:'+task.id)}><summary>查看完整资产提示词 · ${c.assets.length} 项</summary><div class="creative-preview-scroll">${c.assets.map(a=>`<article class="creative-asset"><b>${esc(KIND[a.kind]||'资产')} · ${esc(a.name)}</b><p>${esc(a.description)}</p><p class="creative-asset-prompt">${esc(a.prompt)}</p></article>`).join('')}</div></details>`;
 }
 function updateTasks({refreshLog=true}={}){
  if(refreshLog){updateMessages();return;}
  const area=root.querySelector('.creative-task-area');if(!area)return;
  const list=tasks(),task=currentTask(),state=task?taskState(task):null,stale=!!state?.stale;
  area.innerHTML=`${task?`<article class="creative-task" data-status="${task.status}"${stale?' data-stale="true"':''}><header><div><b>${esc(TITLE[task.flow]||'创作任务')}</b><span class="creative-state${stale?' is-stale':''}">${esc(state.label)}</span></div><button type="button" data-task-close aria-label="收起任务详情">收起</button></header><p class="creative-task-context">来源：${esc(task.sourceScope==='node'?'节点「'+(task.sourceTitle||'未命名节点')+'」':'本项目剧本')}${task.selection?` · 选中 ${task.selection.text.length} 字`:''} · ${new Date(task.createdAt).toLocaleString('zh-CN')}</p><details class="creative-prompt-detail" ${detailAttr('prompt:'+task.id)}><summary>本次要求 · ${esc(truncateLabel(task.prompt))}</summary><p class="creative-task-prompt">${esc(task.prompt)}</p></details><ol class="creative-steps" ${task.status==='ready'?'hidden':''}>${task.steps.map(s=>`<li data-status="${esc(s.status)}"><span>${s.status==='completed'||s.status==='done'?'✓':s.status==='running'?'◌':s.status==='failed'?'!':'○'}</span>${esc(s.label)}<small>${esc(({queued:'等待',running:'处理中',completed:'完成',done:'完成',ready:'完成',failed:'失败',canceled:'已取消',interrupted:'已中断',skipped:'未执行'})[s.status]||s.status)}</small></li>`).join('')}</ol>${task.message&&task.status!=='ready'?`<p class="creative-task-message" role="status">${esc(task.message)}</p>`:''}${task.status==='ready'?`<p class="creative-adopt-note${stale?' is-stale':''}">${stale?'生成后来源内容、分镜或设定已变化，此结果不能采用，也不会自动覆盖当前内容；可按当前内容重新生成。':task.sourceScope==='node'?(task.flow==='selection-rewrite'?'采用后仅替换来源节点选中文字；项目剧本、分镜与资产不变，可撤销。':'采用后更新项目分镜、资产提示词及对应画布节点；来源节点与项目剧本保持不变，可撤销。'):'请检查候选结果。采用后会一次更新画布，可撤销；当前内容会保留版本。'}</p>${candidateHtml(task)}<footer><button type="button" data-task-adopt class="primary" ${stale||active?'disabled':''}>${task.flow==='selection-rewrite'?(task.sourceScope==='node'?'仅替换节点正文':'仅替换选中文字'):'采用并关联到画布'}</button><button type="button" data-task-discuss>讨论此候选</button><button type="button" data-task-discard>丢弃结果</button>${stale?`<button type="button" data-task-retry ${active?'disabled':''}>按当前内容重新生成</button>`:''}</footer>`:''}${LIVE.has(task.status)?'<button type="button" data-task-cancel>取消此任务</button>':''}${['failed','canceled','interrupted'].includes(task.status)?`<button type="button" data-task-retry ${active?'disabled':''}>按当前内容重新执行</button>`:''}</article>`:''}
   `;
  if(!list.length)area.innerHTML='<div class="creative-welcome"><h3>'+t('creative.taskEmptyTitle')+'</h3><p>'+t('creative.taskEmptyText')+'</p><button type="button" data-return-chat>'+t('creative.backToChat')+'</button></div>';
  area.querySelector('[data-return-chat]')?.addEventListener('click',()=>setView('chat'));
  area.querySelector('[data-task-close]')?.addEventListener('click',()=>{selectedTaskId=null;updateMessages();updateTasks();});
    wireDetails(area);
  area.querySelector('[data-task-cancel]')?.addEventListener('click',()=>cancelAll());
  area.querySelector('[data-task-discuss]')?.addEventListener('click',()=>{setView('chat');note=isStale(task)?'此候选来源已变化，讨论将参考当前工程；旧候选不会自动应用。':'接下来的讨论会参考当前展开的候选摘要，不会自动采用。';updateCompose();root.querySelector('#creativePrompt').focus();});
  area.querySelector('[data-task-discard]')?.addEventListener('click',()=>{if(task.status!=='ready')return;task.status='discarded';task.candidate=null;task.updatedAt=Date.now();saveTask(ctx.project(),task);});
  area.querySelector('[data-task-retry]')?.addEventListener('click',()=>{selection=task.selection?structuredClone(task.selection):null;sourceNodeId=task.sourceNodeId;prompt=task.prompt;root.querySelector('#creativePrompt').value=prompt;submit(task.flow);});
  area.querySelector('[data-task-adopt]')?.addEventListener('click',async()=>{
   if(task.status!=='ready'||isStale(task)||active)return;const p=ctx.project(),button=area.querySelector('[data-task-adopt]');button.disabled=true;
   try{const result=await ctx.adoptCreativeTask(task);if(result===false)return;if(ctx.project().id!==p.id)return;selection=null;draftFlow=null;note=task.sourceScope==='node'&&task.flow==='selection-rewrite'?'已更新来源节点，可撤销；项目剧本保持不变。':'已采用；可撤销本次更新，原内容也已保存版本。';render();ctx.toast('已采用候选结果并更新画布');}
   catch(e){if(ctx.project().id===p.id){note=e.message;updateCompose();ctx.toast(e.message);}}
   finally{if(ctx.project().id===p.id)updateTasks();}
  });
 }
 async function loadStatus(){try{status=await textStatus();}catch{status=null;}const badge=root.querySelector('.creative-model');if(badge)badge.textContent=connectionLabel(status?.config)+' · 设置';}
 function ensureCurrent(){if(project!==ctx.project()){cancelAll('interrupted');project=ctx.project();prompt='';selection=null;sourceNodeId=null;selectedTaskId=null;note='';view='chat';draftFlow=null;composition=false;editCheckpoint=0;versionsOpen=false;documentState={start:0,end:0,scroll:0};logPosition=null;openDetails.clear();}}
 async function submit(explicitFlow){
  ensureCurrent();if(active)return ctx.toast('请等待当前任务完成，或先取消');
  const message=prompt.trim();if(!message)return;const p=ctx.project();
  const flow=explicitFlow||draftFlow;
  const source=sourceContext();if(source.error){note=source.error;updateCompose();return;}
  if(status?.config&&!status.config.configured){note='请先配置文字模型，再开始创作。';updateCompose();await showTextSettings(ctx,loadStatus);return;}
  if(flow){
   let task;try{
    task=createCreativeTask(p,{flow,prompt:message,selection:flow==='selection-rewrite'?selection:null,sourceNodeId,sourceScope:source.scope});
    if(task.snapshot)task.snapshot.brief=creativeProductionBrief(task.snapshot.brief,writing(p).messages,contextCandidate());
    const duplicate=tasks(p).find(t=>['queued','running','ready'].includes(t.status)&&t.flow===task.flow&&t.sourceSignature===task.sourceSignature&&t.sourceScope===task.sourceScope&&t.prompt===task.prompt&&JSON.stringify(t.selection)===JSON.stringify(task.selection)&&!hasNewDiscussionSince(t.id));
    if(duplicate){selectedTaskId=duplicate.id;note='已有相同任务，请查看现有结果或先丢弃候选。';updateTasks();setView('chat');updateCompose();return;}
   }catch(e){note=e.message;updateCompose();return;}
   selectedTaskId=task.id;setView('chat');const run={kind:'task',project:p,task,controller:new AbortController()};active=run;
   saveTask(p,task);messages(p,[{role:'user',content:message,taskId:task.id}]);prompt='';root.querySelector('#creativePrompt').value='';note='正在制作，完成后先供你预览。';updateMessages({follow:true});updateTasks();updateCompose();
   try{await runCreativeTask(task,(body,opts)=>textPost('generate',body,opts),{signal:run.controller.signal,onChange:changed=>saveRunTask(run,changed)});}
   catch(e){if(!run.controller.signal.aborted){task.status='failed';task.message=e.message;task.updatedAt=Date.now();}}
   finally{
    saveRunTask(run,task);
    if(active===run){active=null;if(sameProject(p)){note=task.status==='ready'?'候选已完成，检查后再采用。':task.message||LABEL[task.status];if(task.status==='ready')messages(p,[{role:'assistant',taskId:task.id,content:task.flow==='story-package'?'分镜和资产提示词已准备好，候选留在本次要求下方；采用后才会更新画布。':'局部改写候选已准备好，可在本次要求下方预览，再决定是否替换。'}]);updateMessages();updateCompose();updateTasks();}}
   }
  }else await discuss(p,message);
 }
 async function discuss(p,message){
  const run={kind:'chat',project:p,controller:new AbortController()};active=run;
  const source=sourceContext(),history=creativeDiscussionHistory(writing(p).messages,contextCandidate()),script=source.text,shots=source.scope==='node'?[]:structuredClone(ws(p).story.shots),assets=source.scope==='node'?[]:structuredClone(ws(p).story.assets),brief=writing(p).brief,skill=writing(p).skill;
  messages(p,[{role:'user',content:message}]);prompt='';root.querySelector('#creativePrompt').value='';note='讨论只提供建议，不会自动修改工程。';updateCompose();updateMessages({follow:true});
  try{const result=await textPost('generate',{kind:'chat',prompt:(source.scope==='node'?`本次仅讨论节点「${source.title}」正文；不要声称已修改工程。\n`:'' )+message,script,shots,assets,brief,skill,scope:selectionValid()?'selection':'script',selection:selectionValid()?structuredClone(selection):null,history},{signal:run.controller.signal});
   if(active!==run||run.controller.signal.aborted||!sameProject(p))return;
   if(typeof result.text!=='string'||!result.text.trim())throw Error('模型没有返回讨论内容，请重试');
   messages(p,[{role:'assistant',content:result.text}]);note='可以继续讨论；需要制作候选时，点击「分镜与资产设计」或「局部改写」。';
  }catch(e){if(active===run&&!run.controller.signal.aborted)note=e.message;}
  finally{if(active===run){active=null;if(sameProject(p)){updateMessages();updateCompose();}}}
 }
 function saveRunTask(run,task){
  if(active===run&&!sameProject(run.project))cancelAll('interrupted');
  if(run.terminalStatus){task.status=run.terminalStatus;task.message=run.terminalMessage;task.candidate=null;for(const step of task.steps)if(LIVE.has(step.status))step.status=task.status;}
  saveTask(run.project,task);
 }
 function cancelAll(reason='canceled'){
  directorPanel?.cancel();
  const run=active;if(!run)return;active=null;
  if(run.task){run.task.status=reason==='interrupted'?'interrupted':'canceled';run.task.message=reason==='interrupted'?'工程已切换或运行已中断，请手动重新执行。':'已取消；已发送的模型请求仍可能计费。';run.task.updatedAt=Date.now();for(const step of run.task.steps)if(LIVE.has(step.status))step.status=run.task.status;run.task.candidate=null;run.terminalStatus=run.task.status;run.terminalMessage=run.task.message;saveTask(run.project,run.task);}
  run.controller.abort();if(sameProject(run.project)){note=run.task?.message||'讨论已取消；已发送的请求仍可能计费。';updateCompose();updateMessages();updateTasks();}
 }
 function onProjectChanged(){ensureCurrent();directorPanel?.onProjectChanged();render();}
 function onShow(options={}){
  ensureCurrent();
  view=options.mode==='director'?'director':options.editDocument?'document':'chat';
  if(Object.hasOwn(options,'sourceNodeId')||Object.hasOwn(options,'nodeId')){const nextSource=options.sourceNodeId||options.nodeId||null;if(sourceNodeId!==nextSource){selection=null;draftFlow=null;}sourceNodeId=nextSource;}
  if(options.selection&&typeof options.selection==='object'){
   const s=options.selection;if(Number.isInteger(s.start)&&Number.isInteger(s.end)&&s.end>s.start&&ws().script.slice(s.start,s.end)===s.text){sourceNodeId=null;selection={start:s.start,end:s.end,text:s.text};draftFlow='selection-rewrite';view='chat';}
  }
  if(options.operation==='rewrite'){draftFlow='selection-rewrite';view='chat';note='描述你想怎样修改，助手会先提供候选，采用后才更新节点。';}
  if(options.taskId){selectedTaskId=options.taskId;view='chat';}
  if(!selectedTaskId)selectedTaskId=[...tasks()].reverse().find(t=>t.status==='ready'||LIVE.has(t.status))?.id||null;
  if(options.operation==='storyboard'||options.operation==='assets'){prompt=DEFAULT_PROMPT;draftFlow=null;note='点击「分镜与资产设计」开始制作；「发送」仅讨论，不改工程。';}
  render();loadStatus();
 }
 function openTask(id){ensureCurrent();if(!tasks().some(t=>t.id===id))return false;selectedTaskId=id;view='chat';render();root.querySelector('.creative-task-area')?.scrollIntoView?.({block:'nearest'});return true;}
 return {onShow,open:onShow,onHide(){composition=false;editCheckpoint=0;},refresh(){ensureCurrent();render();},onProjectChanged,cancelAll,tasks:()=>tasks(),openTask};
}
