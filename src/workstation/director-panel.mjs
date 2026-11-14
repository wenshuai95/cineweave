import {directorSignature,prepareDirectorEdit,refineDirectorPlan} from './director-agent.mjs';
import {normalizeDirectorAssistant} from './director-state.mjs';
import {escapeHtml as esc,textPost,showTextSettings} from './text-settings.mjs';
import './director-ui.css';

export function createDirectorPanel(ctx){
 let root=null,owner=ctx.project(),prompt='',run=null,note='',images=[],frames=[],previewSignature=null,undoToken=null,vision=true,scope='shot',scrollState=null,followNext=false,focusInputNext=false;
 const state=()=>{const ws=ctx.project().workstation;return ws.directorAssistant=normalizeDirectorAssistant(ws.directorAssistant);};
 const save=()=>ctx.persist();
 const current=r=>run===r&&!r.controller.signal.aborted&&ctx.project()===r.owner;
 const ensureSignature=signature=>{if(signature!==directorSignature(owner))throw Error('导演台已变化，请根据最新工程重新发送要求');};
 function sync(){if(owner!==ctx.project()){cancel();owner=ctx.project();prompt='';note='';images=[];frames=[];previewSignature=null;undoToken=null;scrollState=null;}}
 function add(role,content){const s=state();s.messages=[...s.messages,{role,content}].slice(-24);save();}
 const pendingText=()=>run?.kind==='capture'?'正在本机截取关键画面…':run?.kind==='preview'?'正在本机生成前后对比…':run?.kind==='review'?'正在看图复查候选方案…':run?.kind==='review-preview'?'正在生成修正后的对比…':'正在设计白模修改…';
 function render(){
  if(!root?.isConnected)return;
  const previousLog=root.querySelector('.director-log');
  const active=typeof document!=='undefined'?document.activeElement:null;
  const focused=root.contains?.(active)?active:null;
  const focusKey=focusInputNext?'textarea':focused?.matches?.('textarea')?'textarea':focused?.dataset?.director?`[data-director="${focused.dataset.director}"]`:null;
  const selection=focusKey==='textarea'&&focused?.matches?.('textarea')?{start:focused.selectionStart,end:focused.selectionEnd,scrollTop:focused.scrollTop}:null;
  if(previousLog&&Number.isFinite(previousLog.scrollTop))scrollState={top:previousLog.scrollTop,bottom:previousLog.scrollHeight-previousLog.clientHeight-previousLog.scrollTop<32};
  sync();const s=state(),c=s.candidate,stale=c&&(c.projectId!==owner.id||c.signature!==directorSignature(owner));
  root.innerHTML=`<div class="director-context"><span>${esc(ctx.directorSelectionLabel?.()||'当前导演台')} · ${owner.objects.length} 个对象 · ${owner.shots.length} 个镜头</span><button type="button" data-director="stage">查看导演台</button></div>
   <div class="director-log" role="log" aria-label="白模导演对话" aria-live="polite">${s.messages.length?s.messages.map(m=>`<article class="creative-message ${m.role}"><b>${m.role==='user'?'你':'白模导演'}</b><div>${esc(m.content)}</div></article>`).join(''):'<div class="creative-welcome"><h3>说出你想要的调度</h3><p>调整站位、朝向、颜色、机位和动作定格。也可以直接看图审片，找出需要改善的地方。</p><p>例如：让女修面对巨妖，摄影机从她背后拍。</p></div>'}
   ${frames.length&&!images.length?`<div class="director-frames" aria-label="本次参考画面">${frames.map(f=>`<figure><img src="${esc(f.image)}" alt="${esc(f.label)} ${f.time.toFixed(2)}秒"><figcaption>${f.time.toFixed(2)}秒</figcaption></figure>`).join('')}</div>`:''}
   ${run?`<p class="creative-thinking" role="status">${pendingText()}</p>`:''}
   ${c?`<section class="director-candidate" aria-label="白模修改方案"><h3>${stale?'工程已变化':'待你采用'}</h3><ul>${(c.changes||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>${c.plan.warnings?.length?'<p>'+c.plan.warnings.map(esc).join('<br>')+'</p>':''}${stale?'<p>请丢弃此方案，再根据最新工程发送要求。</p>':''}
    ${images.length?`<div class="director-comparison">${images.map(pair=>`<figure><figcaption>${pair.time.toFixed(2)}秒 · ${esc(pair.label||'当前镜头')}</figcaption><div><img src="${esc(pair.before)}" alt="修改前的白模预览"><img src="${esc(pair.after)}" alt="修改后的白模预览"></div><p><span>修改前</span><span>修改后</span></p></figure>`).join('')}</div>`:''}</section>`:''}
   ${undoToken?'<button type="button" data-director="undo">撤销刚才的修改</button>':''}</div>
   ${c?`<div class="director-decision"><div class="director-candidate-actions">${run?'<button type="button" data-director="cancel">停止</button>':''}<button type="button" data-director="preview" ${run||stale?'disabled':''}>${images.length?'刷新预览':'预览修改'}</button><button type="button" data-director="review" ${run||stale||!images.length||previewSignature!==c.signature?'disabled':''}>AI 复查</button><button type="button" class="primary" data-director="adopt" ${run||stale||previewSignature!==c.signature?'disabled':''}>采用修改</button><button type="button" data-director="discard" ${run?'disabled':''}>丢弃</button></div><p class="director-small">${previewSignature===c.signature?'AI复查会发送前后截图，可能计费；采用后可撤销。':'先在本机预览，再复查或采用。'}</p></div>`:''}
   <div class="director-compose"><textarea id="directorPrompt" rows="3" maxlength="6000" aria-label="对白模导演说出要求" placeholder="${c?'继续微调此方案，例如：机位再向右半米…':'例如：让女修面对巨妖，摄影机从她背后拍…'}"></textarea>
   <div class="director-vision-options"><label><input type="checkbox" data-director="vision" ${vision?'checked':''} ${run?'disabled':''}>附带画面</label><select aria-label="审片范围" data-director="scope" ${run||!vision?'disabled':''}><option value="shot" ${scope==='shot'?'selected':''}>当前镜头 · 最多3帧</option><option value="overview" ${scope==='overview'?'selected':''}>全片概览 · 最多6帧</option></select></div>
   <div><span>${c?'只调整候选，采用前工程不变；':''}${vision?'白模截图将发送到模型服务，可能计费':'仅发送场景参数；按模型服务计费'}</span><button type="button" data-director="cancel" ${run?'':'hidden'}>停止</button><button type="button" data-director="inspect" ${run||c?'disabled':''}>看图审片</button><button type="button" class="primary" data-director="send" ${run||stale?'disabled':''}>${c?'微调方案':'发送'}</button></div></div><p class="director-note" role="status">${esc(note)}</p>`;
  const input=root.querySelector('textarea');if(input){input.value=prompt;input.oninput=()=>prompt=input.value;
  input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();submit();}};}
  const bind=(name,fn)=>{const selector=`[data-director="${name}"]`;const elements=root.querySelectorAll?.(selector)||[root.querySelector(selector)];elements.forEach(el=>el?.addEventListener('click',fn));};
  bind('send',()=>submit());bind('inspect',()=>submit({inspect:true}));bind('cancel',()=>{cancel();note='已停止；已发送的模型请求仍可能计费。';render();});
  bind('stage',()=>ctx.showDirector?.());bind('preview',preview);bind('review',review);bind('adopt',adopt);
  const visionInput=root.querySelector('[data-director="vision"]'),scopeInput=root.querySelector('[data-director="scope"]');
  if(visionInput)visionInput.onchange=e=>{vision=e.target.checked;render();};
  if(scopeInput)scopeInput.onchange=e=>{scope=e.target.value;};
  bind('discard',()=>{state().candidate=null;images=[];frames=[];previewSignature=null;save();render();});
  bind('undo',()=>{try{ctx.undoDirectorEdit(undoToken);undoToken=null;note='已撤销本次白模修改。';}catch(e){note=e.message;}render();});
  const log=root.querySelector('.director-log');
  if(log){log.scrollTop=followNext||!scrollState||scrollState.bottom?log.scrollHeight:scrollState.top;followNext=false;
   log.onscroll=()=>{scrollState={top:log.scrollTop,bottom:log.scrollHeight-log.clientHeight-log.scrollTop<32};};}
  focusInputNext=false;if(focusKey){const target=root.querySelector(focusKey);if(target&&!target.disabled){target.focus?.({preventScroll:true});if(selection){target.setSelectionRange?.(selection.start,selection.end);target.scrollTop=selection.scrollTop;}}}
 }
 async function handleError(e,r){if(current(r)){note=e.message;if(/请先.*API Key|先.*文字模型/.test(e.message))await showTextSettings(ctx);}}
 async function submit({inspect=false}={}){
  sync();if(run)return;const message=prompt.trim()||(inspect?'请检查附带画面的构图、人物站位、朝向与遮挡，指出可见问题；如有把握，提出最少必要修正。不确定的地方请说明。':'');if(!message)return;
  const candidate=state().candidate;
  if(candidate&&(candidate.projectId!==owner.id||candidate.signature!==directorSignature(owner))){note='工程已变化，请丢弃旧方案，再根据最新工程发送要求。';render();return;}
  const useVision=vision||inspect,r={owner,controller:new AbortController(),kind:useVision?'capture':'plan'};run=r;note=useVision?'正在截取所选范围；只发送白模画面和场景参数，不发送模型文件。':'只发送场景参数和动作名称。';
  const history=state().messages.slice(-10),signature=directorSignature(owner);add('user',message);prompt='';if(!candidate){images=[];frames=[];}followNext=true;focusInputNext=true;render();
  try{
   const context=await ctx.readDirectorContext(candidate?{candidate}:undefined);if(!current(r))return;ensureSignature(signature);
   let captured=[];
   if(useVision&&candidate){
    const comparisons=images.length&&previewSignature===candidate.signature?images:await ctx.previewDirectorPlan(candidate,{signal:r.controller.signal});
    if(!current(r))return;ensureSignature(signature);
    captured=comparisons.map(pair=>({image:pair.after,time:pair.time,label:pair.label||'候选镜头'}));
   }else if(useVision)captured=await ctx.captureDirectorFrames({scope,signal:r.controller.signal});if(!current(r))return;ensureSignature(signature);
   if(useVision&&!captured.length)throw Error('没有截取到画面，本次未发送，请重试');
   frames=captured;r.kind='plan';note=captured.length?`已附带${captured.length}帧；静帧检查不能代替完整播放。`:'';render();
   const result=await textPost('generate',{kind:'director-plan',prompt:candidate?'在尚未采用的候选场景上继续微调。仅提出相对于当前候选的增量修正，不重复已经完成的操作。\n追加要求：'+message:message,context,history,...(captured.length?{frames:captured}:{})},{signal:r.controller.signal});if(!current(r))return;
   const edit=candidate?refineDirectorPlan(owner,candidate,result,{clips:ctx.directorClipCatalog()}):prepareDirectorEdit(owner,result,{signature,clips:ctx.directorClipCatalog()});
   add('assistant',edit.plan.message);
   if(result.operations.length){state().candidate={projectId:owner.id,signature,plan:edit.plan,changes:edit.changes,request:[candidate?.request,message].filter(Boolean).join('\n').slice(-6000)};images=[];frames=[];previewSignature=null;save();note=candidate?'已合并追加要求，请重新预览后再采用；正式工程尚未改动。':'方案已准备好，请预览后采用；也可继续微调。';}
   else note=candidate?'未提出可执行修正，已保留原候选和预览；可以继续补充要求。':captured.length?'已完成本次静帧检查，工程未改动；仍需播放检查动作连续性。':'可继续补充要求；工程未改动。';
  }catch(e){await handleError(e,r);}
  finally{if(run===r){run=null;render();}}
 }
 async function preview(){
  sync();const c=state().candidate;if(run||!c)return;
  const r={owner:ctx.project(),controller:new AbortController(),kind:'preview'};run=r;note='';render();
  try{const result=await ctx.previewDirectorPlan(c,{signal:r.controller.signal});if(!current(r))return;ensureSignature(c.signature);images=result;previewSignature=c.signature;note='请检查站位、朝向与构图；AI复查可根据前后画面提出修正。';}
  catch(e){if(current(r)){images=[];previewSignature=null;note=e.message;}}
  finally{if(run===r){run=null;render();}}
 }
 async function review(){
  sync();const c=state().candidate;if(run||!c||!images.length||previewSignature!==c.signature)return;
  const r={owner,controller:new AbortController(),kind:'review'};run=r;note='本次发送前后截图复查，仅调用一次模型；不会自动采用。';render();
  try{
   ensureSignature(c.signature);const context=await ctx.readDirectorContext({candidate:c});if(!current(r))return;ensureSignature(c.signature);
   const reviewFrames=images.flatMap(pair=>[{image:pair.before,time:pair.time,label:pair.label,phase:'before'},{image:pair.after,time:pair.time,label:pair.label,phase:'after'}]);
   const result=await textPost('generate',{kind:'director-review',prompt:'原始要求：'+(c.request||c.plan.message)+'\n请检查候选修改后的画面是否符合要求，说明可见问题与不确定之处，再给出相对于候选场景的最少必要修正。',context,history:state().messages.slice(-10),frames:reviewFrames},{signal:r.controller.signal});if(!current(r))return;ensureSignature(c.signature);
   const edit=refineDirectorPlan(owner,c,result,{clips:ctx.directorClipCatalog()});
   add('assistant','看图复查：'+result.message);
   if(!result.operations.length){note='复查未提出可执行修正；这不代表全片无误，请播放检查后再采用。';return;}
   const next={...c,plan:edit.plan,changes:edit.changes};state().candidate=next;images=[];previewSignature=null;save();r.kind='review-preview';note='修正方案已准备，正在重新渲染；工程尚未改动。';render();
   const comparisons=await ctx.previewDirectorPlan(next,{signal:r.controller.signal});if(!current(r))return;ensureSignature(c.signature);images=comparisons;previewSignature=c.signature;note='已生成修正后的对比，请检查后决定是否采用。';
  }catch(e){await handleError(e,r);}
  finally{if(run===r){run=null;render();}}
 }
 function adopt(){
  const c=state().candidate;if(run||!c||previewSignature!==c.signature)return;
  try{undoToken=ctx.adoptDirectorPlan(c);state().candidate=null;images=[];frames=[];previewSignature=null;add('assistant','已采用这次白模修改，可在导演台播放检查，或撤销刚才的修改。');note='已采用并保存到工程。';}
  catch(e){note=e.message;}render();
 }
 function cancel(){const r=run;run=null;r?.controller.abort();}
 return {mount(element){if(root&&root!==element){const log=root.querySelector('.director-log');if(log&&Number.isFinite(log.scrollTop))scrollState={top:log.scrollTop,bottom:log.scrollHeight-log.clientHeight-log.scrollTop<32};}root=element;sync();render();},refresh(){sync();render();},cancel,onProjectChanged(){sync();render();}};
}
