import {videoTaskState,latestVideoJobs,referenceDurationText,shortAudioWarning,planVideoRetry} from './video-task-state.mjs';
import {uiIcon} from './canvas-content.mjs';
import {referenceNames,referenceEntries,referenceProblem,validateReferenceMentions,mentionQuery,insertMention,sanitizeVideoDraft,referencePurposes,defaultReferencePurpose,referencePurposeLabel} from './video-references.mjs';
import {promptAssistantMarkup,attachPromptAssistant} from './prompt-assistant-ui.mjs';
import {collectVideoVersions,videoVersionGroup,adoptedVideo} from './video-versions.mjs';
import {canvasImagePrompt} from './canvas-image-result.mjs';
import {referenceSnapshotFor} from './workstation/asset-image-context.mjs';
// A task submitted before snapshots existed has no historical identity. Mark it
// explicitly unknown instead of reading today's image versions as if they were
// the submitted references.
export function submittedReferenceSnapshot(job){
 if(Array.isArray(job?.referenceSnapshot))return job.referenceSnapshot;
 return (Array.isArray(job?.references)?job.references:[]).filter(reference=>reference?.nodeId).map(reference=>({nodeId:reference.nodeId,kind:reference.kind,legacy:true,unknown:true}));
}
export function videoDurations(values){const out=new Set();for(const raw of values){const [a,b]=String(raw).split('-').map(Number);if(b)for(let n=Math.ceil(a);n<=Math.min(b,180);n++)out.add(n);else if(a)out.add(a);}return [...out].sort((a,b)=>a-b);}
export function planVideoResult(project,job,src,createNode){
 const existing=project.nodes.find(n=>n.generatedTask===job.id);if(existing)return {already:true,node:existing};
 // Keep a shot bundle's generator as its stable input; results belong to a separate version group.
 const bundledSource=(project.boardGroups||[]).some(g=>g.shotBundle===true&&g.memberIds.includes(job.sourceId));
 const target=!bundledSource&&project.nodes.find(n=>n.id===job.sourceId&&n.type==='video'&&!n.src&&(n.text||'')===(job.sourceText||'')&&(!n.videoDraft?.prompt||n.videoDraft.prompt===job.prompt));
 if(!target&&project.nodes.length>=500)throw Error('画布节点已满，视频保留在任务中心，可清理后恢复');
 const origin=project.nodes.find(n=>n.id===job.sourceId),draft=sanitizeVideoDraft(target?.videoDraft||origin?.videoDraft);
 const details={videoDraft:sanitizeVideoDraft({...draft,prompt:job.prompt,modelId:job.modelId||draft.modelId,duration:job.duration?String(job.duration):draft.duration,resolution:job.resolution||draft.resolution,aspect:job.aspect||draft.aspect,aliases:job.references?.length?job.references:draft.aliases,referenceOrder:job.referenceIds||draft.referenceOrder,excludeSelf:true}),generatedInput:{modelId:job.modelId,duration:job.duration,resolution:job.resolution,aspect:job.aspect,references:job.references||[]},referenceSnapshot:submittedReferenceSnapshot(job),src,text:job.prompt,generatedTask:job.id,generatedSource:job.sourceId,generatedProvider:'oiioii',generatedModel:job.modelName||'',generatedPoints:job.points??null,generatedActualPoints:job.actualPoints??null,generatedAt:job.createdAt||Date.now()};
 const position=origin?{x:origin.x+origin.w+100,y:origin.y}:{};
 if(origin)for(let i=0;i<=project.nodes.length;i++){if(!project.nodes.some(n=>Math.abs(n.y-position.y)<250&&position.x<n.x+n.w+24&&position.x+280>n.x-24))break;position.y+=280;}
 const node=target?{...target,...details}:createNode({...position,title:'OiiOii · '+job.prompt.slice(0,24),...details});
 const ids=[...new Set([job.sourceId,...(job.referenceIds||[])])].filter(id=>id&&id!==node.id&&project.nodes.some(n=>n.id===id));
 return {node,replace:!!target,edges:ids.filter(from=>!project.edges.some(e=>e.from===from&&e.to===node.id)).map(from=>({from,to:node.id}))};
}
const labels={preparing:'正在准备参考',submitting:'正在提交',pending:'平台生成中',succeeded:'已完成',failed:'失败',unknown:'提交待核对'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createVideoGeneration(ctx){
 const watching=new Set(),statusTargets=new Map();let refreshReferences=()=>{},boardProject=null,jobs=[],syncTimer=null,loading=null,lastSync=0;
 const mediaMetadata=new Map();
 const probe=(src,kind)=>new Promise((resolve,reject)=>{const el=document.createElement(kind);el.preload='metadata';let settled=false;const done=error=>{if(settled)return;settled=true;clearTimeout(timer);const duration=el.duration;el.removeAttribute('src');el.load();error?reject(error):Number.isFinite(duration)&&duration>0?resolve(duration):reject(Error('参考'+referenceNames[kind]+'时长无效'));};const timer=setTimeout(()=>done(Error('无法读取参考'+referenceNames[kind]+'时长，请重新导入')),15000);el.onloadedmetadata=()=>done();el.onerror=()=>done(Error('参考'+referenceNames[kind]+'无法读取'));el.src=src;});
 async function reference(node){const src=node.src,response=await fetch(src);if(!response.ok)throw Error('无法读取参考素材：'+node.title);const blob=await response.blob();if(blob.size>(node.type==='video'?40:node.type==='audio'?15:10)*1024*1024)throw Error('参考素材过大：视频上限 40 MB，图片上限 10 MB，音频上限 15 MB');return {nodeId:node.id,kind:node.type,data:await ctx.readDataURL(blob),...(['video','audio'].includes(node.type)?{duration:await probe(src,node.type)}:{})};}
 function rememberJob(job){if(ctx.project().id!==job.projectId)return;jobs=jobs.filter(j=>j.id!==job.id).concat(job);paintBoard();paintTaskList();ctx.onTasksChanged?.(job.projectId);}
 function paintBoard(){
  const project=ctx.project();if(boardProject!==project.id)return;
  document.querySelectorAll('[data-video-task-state]').forEach(el=>{el.textContent=el.dataset.videoTaskOriginal;el.classList.remove('video-task-busy','video-task-warning');el.removeAttribute('title');el.removeAttribute('aria-busy');delete el.dataset.videoTaskState;});
  const grouped=new Map();
  for(const [id,job] of latestVideoJobs(jobs)){
   const node=project.nodes.find(n=>n.id===id);if(!node)continue;
   let target=document.querySelector(`.node[data-id="${CSS.escape(id)}"] .node-meta span:last-child`);
   if(!target){const group=(project.boardGroups||[]).find(g=>g.collapsed&&g.memberIds.includes(id));if(group)target=document.querySelector(`.board-group[data-group="${CSS.escape(group.id)}"] .shot-bundle-preview small`);}
   if(target){const old=grouped.get(target);if(!old||videoTaskState(job).busy||!videoTaskState(old).busy&&job.createdAt>old.createdAt)grouped.set(target,job);}
  }
  for(const [target,job] of grouped){const state=videoTaskState(job);target.dataset.videoTaskOriginal=target.textContent;target.dataset.videoTaskState=job.status;target.textContent=state.label;target.title=state.detail;target.classList.toggle('video-task-busy',state.busy);target.classList.toggle('video-task-warning',['failed','unknown'].includes(job.status));target.setAttribute('aria-busy',String(state.busy));}
  ctx.taskLayout?.();
 }
 async function syncBoard(force=false){
  const projectId=ctx.project().id;
  if(projectId!==boardProject){boardProject=projectId;jobs=[];lastSync=0;clearTimeout(syncTimer);loading=null;}
  paintBoard();if(loading||!force&&Date.now()-lastSync<2500)return;
  const work=(async()=>{try{const result=await ctx.api('/api/oiioii/video/tasks?projectId='+encodeURIComponent(projectId));if(ctx.project().id!==projectId)return;jobs=result.jobs;lastSync=Date.now();paintBoard();paintTaskList();ctx.onTasksChanged?.(projectId);for(const job of jobs)if(videoTaskState(job).busy&&!watching.has(job.id))void watch(job.id,projectId);}
   catch{/* Keep the last known task state while the local service reconnects. */}
   finally{if(ctx.project().id===projectId){if(loading===work)loading=null;clearTimeout(syncTimer);if(jobs.some(j=>videoTaskState(j).busy))syncTimer=setTimeout(()=>syncBoard(true),2500);}}
  })();loading=work;await work;
 }
 async function open(source){
  const project=ctx.project(),projectId=project.id,draft=sanitizeVideoDraft(source?.videoDraft);
  const initial=project.edges.filter(e=>e.to===source?.id).map(e=>e.from);if(source?.src&&!draft.excludeSelf)initial.push(source.id);
  // Continue from a version with its original reference material, never the result by accident.
  for(const id of [...initial]){const group=videoVersionGroup(project,id),root=group&&project.nodes.find(n=>n.id===group.sourceNodeId&&n.type==='video'&&n.src);if(root&&root.id!==id){initial.splice(initial.indexOf(id),1);initial.push(root.id,...project.edges.filter(e=>e.to===root.id).map(e=>e.from));}}
  const nodes=project.nodes.filter(n=>['image','video','audio'].includes(n.type)&&n.src),selected=new Set([...new Set([...(draft.referenceOrder||[]).filter(id=>initial.includes(id)),...initial])].filter(id=>nodes.some(n=>n.id===id)));
  let aliases=[...(draft.aliases||[])];for(const r of referenceEntries(nodes,[...selected],aliases))if(!aliases.some(a=>a.nodeId===r.nodeId&&a.alias===r.alias))aliases.push(r);for(const r of aliases)if(!r.purpose)r.purpose=defaultReferencePurpose(r.kind);let quote=null,models=[],quotePending=false,revision=0,mentionIndex=0,mentionMatches=[],quotedSnapshot=null;
  ctx.modal('生成视频','',`<div id="videoGenerationForm" class="video-composer"><div class="composer-scroll"><div id="videoRefChips" class="reference-chips"></div><details class="reference-picker"><summary>${uiIcon('plus')}添加参考 <span id="videoRefCount">${selected.size}</span></summary><div class="video-reference-list">${nodes.length?nodes.map(n=>`<label><input type="checkbox" data-video-ref="${esc(n.id)}" ${selected.has(n.id)?'checked':''}><span>${esc(n.title)}</span><small>${referenceNames[n.type]}</small></label>`).join(''):'<p>从文件夹拖入图片、视频或音频后，即可连接和引用。</p>'}</div><p class="help-text">当前上限：3 张图片、1 段视频、1 段音频。</p></details><div class="video-prompt-wrap"><label class="field">描述你想生成的镜头<textarea id="videoPrompt" rows="4" maxlength="6000" placeholder="例如：用 @图片1 的场景，参考 @视频1 的运镜，以 @音频1 的节奏推进。">${esc(typeof draft.prompt==='string'?draft.prompt:canvasImagePrompt(project,source))}</textarea></label><div id="videoMentionList" class="reference-mentions" role="listbox" aria-label="引用参考素材" hidden></div></div></div><div class="composer-bottom-tools">${promptAssistantMarkup()}<details class="composer-parameters"><summary id="videoParameterSummary">模型与参数 · 正在读取…</summary><div class="composer-settings"><label class="field grow">模型<select id="videoModel" aria-label="视频生成模型"></select></label><label class="field">时长<select id="videoDuration" aria-label="视频时长"></select></label><label class="field">分辨率<select id="videoSize" aria-label="视频分辨率"></select></label><label class="field">画幅<select id="videoAspect" aria-label="视频画幅"></select></label></div></details></div><div id="videoReceipt" class="video-receipt"><p id="videoReferenceNotice" class="reference-notice" hidden></p><p id="videoStatus" class="help-text" role="status" aria-live="polite">正在读取视频模型…</p><p id="videoQuote" class="preset-help"></p></div></div>`,`<button id="insertVideoAt" class="composer-at" aria-label="插入素材引用">@</button><span class="grow"></span><button id="quoteVideo" class="primary" disabled>查看本次费用</button><button id="submitVideo" class="primary" hidden disabled>确认并生成</button>`,source?.id);
  const root=document.querySelector('#videoGenerationForm'),$=s=>root.closest('.modal').querySelector(s),quoteButton=document.querySelector('#quoteVideo'),submit=document.querySelector('#submitVideo'),prompt=$('#videoPrompt'),mentionList=$('#videoMentionList');
  refreshReferences=()=>{if(root.isConnected&&ctx.project()===project)open(source);};
  const panel=root.closest('.modal');panel.classList.add('video-composer-panel');panel.dataset.overlayKind='composer';panel.insertBefore($('#videoReceipt'),panel.querySelector('.modal-actions'));ctx.refresh?.();
  root.querySelectorAll('details').forEach(el=>el.addEventListener('toggle',()=>ctx.refresh?.()));
  const purchase=ready=>{submit.hidden=!ready;quoteButton.classList.toggle('primary',!ready);quoteButton.textContent=ready?'重新查看费用':'查看本次费用';ctx.refresh?.();};
  const entries=()=>referenceEntries(project.nodes,[...selected],aliases);
  const setStatus=(text,busy=false)=>{if(!root.isConnected)return;const el=$('#videoStatus');el.textContent=text;el.classList.toggle('video-task-busy',busy);el.setAttribute('aria-busy',String(busy));};
  const currentTask=()=>latestVideoJobs(jobs).get(source?.id);
  const taskProblem=()=>{const j=currentTask();return j&&(videoTaskState(j).busy||j.status==='unknown')?videoTaskState(j).label+'，请到任务中心查询此任务，勿重复提交':'';};
  const remember=()=>{if(ctx.project()!==project||!project.nodes.includes(source))return;source.videoDraft={prompt:prompt.value,modelId:$('#videoModel').value||draft.modelId,duration:$('#videoDuration').value||draft.duration,resolution:$('#videoSize').value||draft.resolution,aspect:$('#videoAspect').value||draft.aspect,aliases,referenceOrder:[...selected],excludeSelf:!!source.src&&!selected.has(source.id)};ctx.persist?.();};
  const currentModel=()=>models.find(m=>m.id===$('#videoModel').value);
  const snapshot=()=>({prompt:prompt.value,model:$('#videoModel').value,duration:$('#videoDuration').value,resolution:$('#videoSize').value,aspect:$('#videoAspect').value,refs:entries().map(r=>({...r,src:project.nodes.find(n=>n.id===r.nodeId)?.src}))});
  const matches=before=>{if(!before||!root.isConnected||ctx.project()!==project||!project.nodes.includes(source))return false;const after=snapshot();return ['prompt','model','duration','resolution','aspect'].every(k=>before[k]===after[k])&&before.refs.length===after.refs.length&&before.refs.every((r,i)=>['nodeId','kind','alias','purpose','src','title'].every(k=>r[k]===after.refs[i][k]));};
  const problem=()=>taskProblem()||(!prompt.value.trim()?'请先描述你想生成的镜头':'')||referenceProblem(entries(),currentModel())||validateReferenceMentions(prompt.value,entries());
  document.querySelector('#insertVideoAt').onclick=()=>{prompt.focus();const a=prompt.selectionStart,b=prompt.selectionEnd;prompt.setRangeText('@',a,b,'end');invalidate();showMentions();};
  const modelHint=()=>{const m=currentModel();quoteButton.disabled=quotePending||!m||!!problem();if(!m)return;$('#videoParameterSummary').textContent=[m.name||m.id,$('#videoDuration').value?$('#videoDuration').value+' 秒':'',$('#videoSize').value,$('#videoAspect').value].filter(Boolean).join(' · ');setStatus(problem()||'');};
  const invalidate=()=>{$('#videoReferenceNotice').hidden=true;quote=null;quotedSnapshot=null;revision++;submit.disabled=true;$('#videoQuote').textContent='';purchase(false);modelHint();remember();};
  const chips=()=>{
   const items=entries();$('#videoRefCount').textContent=items.length||'';
   $('#videoRefChips').innerHTML=items.length?items.map(r=>{const n=project.nodes.find(n=>n.id===r.nodeId),meta=mediaMetadata.get(r.nodeId),duration=meta?.src===n.src?referenceDurationText(meta.duration):'';return `<div class="reference-chip"><div class="reference-chip-main"><button type="button" data-insert-ref="${esc(r.alias)}" title="${esc(r.title)} · 插入引用">${r.kind==='image'?`<img src="${esc(n.src)}" alt="">`:`<span class="ref-kind">${uiIcon(r.kind)}</span>`}<span><b>@${esc(r.alias)}</b><small>${esc(r.title)}</small><em>${esc(duration)}</em></span></button><button type="button" data-remove-ref="${esc(r.nodeId)}" aria-label="移除参考 ${esc(r.alias)}">×</button></div><select class="reference-chip-purpose" data-ref-purpose="${esc(r.nodeId)}" aria-label="${esc(r.alias)}参考用途">${Object.entries(referencePurposes[r.kind]).map(([key,label])=>`<option value="${key}" ${key===r.purpose?'selected':''}>${label}</option>`).join('')}</select></div>`;}).join(''):'';
   root.querySelectorAll('[data-insert-ref]').forEach(b=>b.onclick=()=>insert(b.dataset.insertRef));
   root.querySelectorAll('[data-ref-purpose]').forEach(el=>el.onchange=()=>{const r=aliases.find(r=>r.nodeId===el.dataset.refPurpose);if(!r||ctx.project()!==project)return;ctx.checkpoint();r.purpose=el.value;invalidate();ctx.commit();});
   root.querySelectorAll('[data-remove-ref]').forEach(b=>b.onclick=()=>setReference(b.dataset.removeRef,false));ctx.refresh?.();
  };
  const setReference=(id,checked)=>{
   if(ctx.project()!==project||!project.nodes.includes(source))return ctx.toast('工程或节点已变化，请重新打开');
   const n=project.nodes.find(n=>n.id===id&&n.src);if(!n)return ctx.toast('参考素材已移除，请重新打开');
   const proposed=new Set(selected);checked?proposed.add(id):proposed.delete(id);
   const next=referenceEntries(project.nodes,[...proposed],aliases),limit=referenceProblem(next);
   if(limit){const input=root.querySelector(`[data-video-ref="${CSS.escape(id)}"]`);if(input)input.checked=selected.has(id);return ctx.toast(limit);}
   ctx.checkpoint();checked?selected.add(id):selected.delete(id);for(const r of next)if(!aliases.some(a=>a.nodeId===r.nodeId))aliases.push({...r,purpose:defaultReferencePurpose(r.kind)});
   if(source&&id!==source.id){if(checked&&!project.edges.some(e=>e.from===id&&e.to===source.id))project.edges.push({from:id,to:source.id});else if(!checked)project.edges=project.edges.filter(e=>e.from!==id||e.to!==source.id);}
   const input=root.querySelector(`[data-video-ref="${CSS.escape(id)}"]`);if(input)input.checked=checked;
   chips();invalidate();ctx.commit();
  };
  function insert(alias){const result=insertMention(prompt.value,prompt.selectionStart??prompt.value.length,alias);prompt.value=result.value;prompt.focus();prompt.setSelectionRange(result.caret,result.caret);mentionList.hidden=true;invalidate();}
  const showMentions=()=>{const q=mentionQuery(prompt.value,prompt.selectionStart),items=entries();mentionMatches=q?items.filter(r=>(r.alias+' '+r.title).toLowerCase().includes(q.query.toLowerCase())):[];mentionIndex=0;renderMentions();};
  function renderMentions(){mentionList.hidden=!mentionMatches.length;prompt.setAttribute('aria-expanded',String(!mentionList.hidden));prompt.setAttribute('aria-controls','videoMentionList');mentionList.innerHTML=mentionMatches.map((r,i)=>`<button type="button" id="videoMention${i}" role="option" aria-selected="${i===mentionIndex}" data-mention="${esc(r.alias)}"><b>@${esc(r.alias)}</b><span>${esc(r.title)}</span></button>`).join('');if(mentionMatches.length)prompt.setAttribute('aria-activedescendant','videoMention'+mentionIndex);else prompt.removeAttribute('aria-activedescendant');mentionList.querySelectorAll('[data-mention]').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>insert(b.dataset.mention);});}
  prompt.oninput=showMentions;prompt.onclick=showMentions;
  prompt.onkeydown=e=>{if(e.isComposing||mentionList.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();mentionList.hidden=true;return;}if(['ArrowDown','ArrowUp','Enter','Tab'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='Enter'||e.key==='Tab')insert(mentionMatches[mentionIndex].alias);else{mentionIndex=(mentionIndex+(e.key==='ArrowDown'?1:-1)+mentionMatches.length)%mentionMatches.length;renderMentions();}}};
  root.querySelectorAll('[data-video-ref]').forEach(el=>el.onchange=()=>setReference(el.dataset.videoRef,el.checked));
  const options=(el,values)=>el.innerHTML=values.map(v=>`<option value="${esc(v)}">${esc(v||'默认')}</option>`).join('');
  const sizes=(restore=false)=>{const m=currentModel();if(!m)return;options($('#videoSize'),m.sizes.length?m.sizes:['']);options($('#videoAspect'),m.aspects);options($('#videoDuration'),videoDurations(m.durations));if(m.aspects.includes('16:9'))$('#videoAspect').value='16:9';if(videoDurations(m.durations).includes(5))$('#videoDuration').value='5';if(restore)for(const [id,value] of [['videoSize',draft.resolution],['videoAspect',draft.aspect],['videoDuration',draft.duration]]){if([...$('#'+id).options].some(o=>o.value===String(value)))$('#'+id).value=String(value);}invalidate();ctx.refresh?.();};
  root.addEventListener('input',e=>{if(!e.target.closest('.prompt-assistant'))invalidate();});chips();
  attachPromptAssistant(root,prompt,{api:ctx.api,lastChange:source?.promptHistory?.filter(h=>h.kind==='video').at(-1),onApply:change=>{ctx.checkpoint();source.promptHistory=[...(source.promptHistory||[]),{kind:'video',before:change.before,after:change.after}].slice(-5);},onRestore:()=>ctx.checkpoint(),getRevision:()=>entries().map(r=>project.nodes.find(n=>n.id===r.nodeId)?.src),valid:()=>ctx.project()===project&&project.nodes.includes(source),getContext:()=>({duration:Number($('#videoDuration').value)||undefined,references:entries().map(r=>({...r,purpose:referencePurposeLabel(r)})),modelCapabilities:{domain:'video',...currentModel(),resolution:$('#videoSize').value,aspect:$('#videoAspect').value}}),refresh:ctx.refresh});
  try{const status=await ctx.api('/api/ai/status');if(!status.oiioii)throw Error('OiiOii 尚未登录，请在终端运行 oiioii auth login');const data=await ctx.api('/api/oiioii/video/models');if(!root.isConnected)return;models=data.models;if(!models.length)throw Error('账号未返回可用视频模型');$('#videoModel').innerHTML=models.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');if(models.some(m=>m.id===(draft.modelId||'63')))$('#videoModel').value=draft.modelId||'63';sizes(true);$('#videoModel').onchange=()=>sizes(false);modelHint();}catch(e){if(root.isConnected)$('#videoStatus').textContent=e.message;return;}
  await syncBoard(true);if(!root.isConnected)return;modelHint();
  const activeJob=currentTask();if(activeJob&&videoTaskState(activeJob).busy)void watch(activeJob.id,projectId,$('#videoStatus'));
  quoteButton.onclick=async()=>{if(quotePending)return;if(ctx.project()!==project)return ctx.toast('工程已切换，请重新打开生成入口');const issue=problem();if(issue)return ctx.toast(issue);const current=revision,captured=snapshot();quotePending=true;quote=null;quotedSnapshot=null;quoteButton.disabled=true;submit.disabled=true;$('#videoReferenceNotice').hidden=true;$('#videoQuote').textContent='检查完成后查看本次费用，当前未提交生成。';setStatus('正在检查参考素材…',true);try{
   const refs=[];for(const [i,entry] of captured.refs.entries()){setStatus(`正在检查参考 ${i+1} / ${captured.refs.length} · @${entry.alias}`,true);const n=project.nodes.find(n=>n.id===entry.nodeId);if(!n||n.src!==entry.src)throw Error('参考素材已变化，请重新查看本次费用');const ref={...await reference(n),alias:entry.alias,purpose:entry.purpose};refs.push(ref);mediaMetadata.set(n.id,{src:entry.src,duration:ref.duration});if(!matches(captured)||revision!==current)throw Error('提示词、参考或参数已变化，请重新查看本次费用');}
   chips();setStatus('参考检查完成，正在查看本次费用…',true);
   const referenceSnapshot=referenceSnapshotFor(project,captured.refs);
   const b={projectId,sourceId:source?.id||null,sourceText:(source?.text||'').slice(0,200000),prompt:captured.prompt.trim(),modelId:captured.model,resolution:captured.resolution,aspect:captured.aspect,duration:Number(captured.duration),references:refs,referenceSnapshot};
   const result=await ctx.api('/api/oiioii/video/quote',b);if(!root.isConnected)return;if(revision!==current||!matches(captured)){invalidate();setStatus('提示词、参考或参数已变化，请重新查看本次费用。');return;}
   for(const r of result.references||[]){const original=captured.refs.find(e=>e.nodeId===r.nodeId);if(original)mediaMetadata.set(r.nodeId,{src:original.src,duration:r.duration});}chips();
   quote=result;quotedSnapshot=captured;$('#videoQuote').textContent=`预计 ${quote.points??'平台计价'} 积分${quote.sufficient===false?' · 积分不足':''}。实际以平台结算为准。`+(Number.isFinite(quote.referenceDuration)&&quote.referenceDuration>0?` 参考视频 ${quote.referenceDuration.toFixed(2)} 秒，计费按 ${quote.billableReferenceDuration??Math.ceil(quote.referenceDuration)} 秒预估。`:'');
   const notice=$('#videoReferenceNotice'),warning=shortAudioWarning(refs);notice.textContent=warning;notice.hidden=!warning;
   setStatus('');submit.disabled=quote.sufficient===false;purchase(true);
  }catch(e){if(root.isConnected){quote=null;quotedSnapshot=null;submit.disabled=true;setStatus(e.message);}}finally{quotePending=false;if(root.isConnected)quoteButton.disabled=!!problem();}};
  submit.onclick=async()=>{if(!quote||ctx.project()!==project)return;if(!matches(quotedSnapshot)){invalidate();setStatus('引用素材或生成参数已变化，请重新查看本次费用。');return;}submit.disabled=quoteButton.disabled=true;root.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);setStatus('正在创建任务，请勿重复点击…',true);try{const job=await ctx.api('/api/oiioii/video/generate',{quoteId:quote.quoteId});quote=null;rememberJob(job);void syncBoard(true);await watch(job.id,projectId,$('#videoStatus'));}catch(e){setStatus(e.message+'；请在任务中心核对，勿重复提交。');}};

 }
 async function watch(id,projectId,status){
  if(status){if(!statusTargets.has(id))statusTargets.set(id,new Set());statusTargets.get(id).add(status);}
  if(watching.has(id))return;watching.add(id);
  const say=(text,busy=false)=>{const targets=statusTargets.get(id);for(const el of targets||[]){if(!el.isConnected){targets.delete(el);continue;}el.textContent=text;el.classList.toggle('video-task-busy',busy);el.setAttribute('aria-busy',String(busy));}};
  try{for(let attempts=0;attempts<240;attempts++){const job=await ctx.api('/api/oiioii/video/task/'+encodeURIComponent(id));rememberJob(job);const state=videoTaskState(job);say(state.label+' · '+state.detail,state.busy);
   if(job.status==='succeeded'){
    if(job.downloadOnly){say('视频已完成。文件大于 25 MB，请在任务中心下载，避免工程保存卡顿。');return;}
    if(ctx.project().id!==projectId||ctx.managerOpen()){say('已完成，请切回原工程后从任务中心加入画布');return;}
    const project=ctx.project();if(project.nodes.some(n=>n.generatedTask===id)){say('视频已在画布中');return;}
    const response=await fetch(job.videoUrl);if(!response.ok)throw Error('本机视频读取失败');const src=await ctx.readDataURL(await response.blob());if(ctx.project()!==project||ctx.managerOpen())return;
    const plan=planVideoResult(project,job,src,extra=>ctx.asset('video',extra));if(plan.already)return;ctx.checkpoint();if(plan.replace)project.nodes[project.nodes.findIndex(n=>n.id===plan.node.id)]=plan.node;else project.nodes.push(plan.node);project.edges.push(...plan.edges);const group=collectVideoVersions(project,plan.node.id,()=>crypto.randomUUID());ctx.commit();ctx.resultReady?.(plan.node.id,group?.id);say('视频已收进镜头版本卡片，参考连线已保留');ctx.toast('视频已完成，可比较版本并选用');return;
   }
   if(['unknown','failed'].includes(job.status))return;await new Promise(r=>setTimeout(r,5000));
  }say('平台仍在处理，可在任务中心继续查询；不会重新提交。');}catch(e){say(e.message+'；可从任务中心恢复，恢复不会重复提交');ctx.toast(e.message);}finally{watching.delete(id);statusTargets.delete(id);}
 }
 let taskRoot=null,taskStatus=null;
 function paintTaskList(){const root=taskRoot;if(!root?.isConnected||root.dataset.project!==ctx.project().id||boardProject!==ctx.project().id)return;
  root.innerHTML=jobs.length?[...jobs].sort((a,b)=>b.createdAt-a.createdAt).map(j=>{const state=videoTaskState(j);return `<div class="model-job"><b>${esc(j.prompt.slice(0,60))}</b><span class="${state.busy?'video-task-busy':''}">${esc(state.label)} · ${esc(j.modelName)}${j.points!==undefined?' · 预估 '+esc(j.points)+' 积分':''}${Number.isFinite(j.actualPoints)?' · 实扣 '+esc(j.actualPoints)+' 积分':' · 实扣待平台核对'}</span><small>${esc(state.detail)} · ${new Date(j.createdAt).toLocaleString('zh-CN')}</small>${j.videoUrl?`<a href="${esc(j.videoUrl)}" download="oiioii-${esc(j.id)}.mp4">下载视频</a>`:''}<div class="video-task-actions"><button data-video-job="${esc(j.id)}" ${!j.downloadOnly&&['pending','succeeded','preparing','submitting'].includes(j.status)?'':'disabled'}>查询 / 加入画布</button>${j.status==='failed'&&j.retryable!==false?`<button data-video-retry="${esc(j.id)}">复制设置重试</button>`:''}</div>${j.status==='unknown'?'<small>请先到 OiiOii 核对是否已扣费和生成，暂不提供重复提交。</small>':''}</div>`;}).join(''):'当前工程还没有视频任务。选中白模视频或提示词节点，点击「生成视频」开始。';
  root.querySelectorAll('[data-video-job]').forEach(b=>b.onclick=()=>watch(b.dataset.videoJob,ctx.project().id,taskStatus));
  root.querySelectorAll('[data-video-retry]').forEach(b=>b.onclick=()=>{try{const project=ctx.project(),job=jobs.find(j=>j.id===b.dataset.videoRetry),plan=planVideoRetry(project,job,extra=>ctx.asset('video',extra));ctx.checkpoint();project.nodes.push(plan.node);project.edges.push(...plan.edges);ctx.commit();ctx.focusNode?.(plan.node.id);void open(plan.node);if(plan.missing.length)ctx.toast('部分原参考已移除，请补齐参考并重新查看本次费用');else ctx.toast('已复制设置，重新查看本次费用后才能提交');}catch(e){ctx.toast(e.message);}});
 }
 async function renderTasks(root,status){taskRoot=root;taskStatus=status;root.dataset.project=ctx.project().id;await syncBoard(true);paintTaskList();if(root.isConnected&&root.textContent==='读取中…')root.textContent='暂时无法读取任务，请稍后重新打开任务中心。';}
 return {open,watch,renderTasks,syncBoard,getTasks:()=>boardProject===ctx.project().id?jobs.map(job=>({...job})):[],refreshReferences:()=>refreshReferences()};
}
