import {uiIcon} from './canvas-content.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function promptDifference(before,after){
 let start=0,end=0;
 while(start<Math.min(before.length,after.length)&&before[start]===after[start])start++;
 while(end<Math.min(before.length,after.length)-start&&before[before.length-1-end]===after[after.length-1-end])end++;
 const render=(text,tag)=>esc(text.slice(0,start))+`<${tag}>`+esc(text.slice(start,end?text.length-end:undefined))+`</${tag}>`+(end?esc(text.slice(-end)):'');
 return {before:render(before,'del'),after:render(after,'ins')};
}
export function promptAssistantMarkup(){return `<div class="prompt-assistant"><button type="button" class="prompt-assistant-toggle" aria-expanded="false">${uiIcon('spark')}优化提示词</button><section class="prompt-assistant-body" aria-label="提示词助手" hidden><div class="prompt-assistant-controls"><label>优化方向<select class="prompt-assistant-goal"><option value="clarify">整理表达</option><option value="detail">补充镜头细节</option><option value="adapt">适配当前模型</option></select></label><button type="button" class="prompt-assistant-run">开始优化</button><button type="button" class="prompt-assistant-cancel" hidden>取消优化</button></div><p class="prompt-assistant-note">保留原稿，校验 @引用、引号内台词和时长。人物、道具与禁用项采用前请复核。使用已配置的文字模型，仅发送此处文字、参数与参考名称；按模型服务计费。</p><p class="prompt-assistant-status" role="status" aria-live="polite"></p><div class="prompt-assistant-result" hidden></div><div class="prompt-assistant-actions"><button type="button" class="prompt-assistant-apply primary" hidden>采用优化稿</button><button type="button" class="prompt-assistant-restore" hidden>恢复原稿</button></div></section></div>`;}
export function attachPromptAssistant(root,textarea,{api,getContext=()=>({}),getRevision=()=>null,valid=()=>true,onChange=()=>{},onApply=()=>{},onRestore=()=>{},lastChange=null,refresh=()=>{}}){
 const box=root.querySelector('.prompt-assistant');if(!box)return;
 const $=s=>box.querySelector(s),toggle=$('.prompt-assistant-toggle'),body=$('.prompt-assistant-body'),run=$('.prompt-assistant-run'),cancel=$('.prompt-assistant-cancel'),apply=$('.prompt-assistant-apply'),restore=$('.prompt-assistant-restore'),result=$('.prompt-assistant-result'),status=$('.prompt-assistant-status');
 let controller=null,sequence=0,candidate=null,adopted=lastChange&&lastChange.after===textarea.value?lastChange:null;
 if(adopted){restore.hidden=false;const diff=promptDifference(adopted.before,adopted.after);result.innerHTML=`<div class="prompt-assistant-compare"><div><b>保留的原稿</b><pre>${diff.before}</pre></div><div><b>当前优化稿</b><pre>${diff.after}</pre></div></div>`;result.hidden=false;}
 const alive=()=>root.isConnected&&valid()&&!textarea.disabled;
 const snapshot=()=>JSON.stringify([getContext(),getRevision()]);
 const reveal=element=>requestAnimationFrame(()=>requestAnimationFrame(()=>element.scrollIntoView({block:'nearest'})));
 const busy=value=>{run.disabled=value;cancel.hidden=!value;$('.prompt-assistant-goal').disabled=value;refresh();};
 const stop=()=>{sequence++;controller?.abort();controller=null;busy(false);};
 const invalidate=()=>{candidate=null;apply.hidden=true;restore.disabled=!!adopted&&textarea.value!==adopted.after;};
 toggle.onclick=()=>{body.hidden=!body.hidden;toggle.setAttribute('aria-expanded',String(!body.hidden));refresh();if(!body.hidden)reveal(body.querySelector('.prompt-assistant-controls'));};
 cancel.onclick=()=>{stop();status.textContent='已取消，原稿保持不变。';};
 textarea.addEventListener('input',()=>{if(controller){stop();status.textContent='提示词已变化，请重新优化。';}invalidate();});
 root.addEventListener('change',e=>{if(!box.contains(e.target)){stop();invalidate();status.textContent='参数或参考已变化，请重新优化。';}});
 run.onclick=async()=>{
  if(!alive())return;const original=textarea.value;if(!original.trim()){status.textContent='先写一句镜头描述，再优化。';return;}
  stop();invalidate();result.hidden=true;const current=sequence,context=getContext(),stamp=snapshot();controller=new AbortController();busy(true);status.textContent='正在优化，可取消；不会启动图片或视频生成。';
  try{
   const response=await api('/api/ai/text/generate',{kind:'optimize-prompt',sourcePrompt:original,goal:$('.prompt-assistant-goal').value,...context},{signal:controller.signal});
   if(current!==sequence||!alive())return;
   if(textarea.value!==original||snapshot()!==stamp){status.textContent='原稿、参数或参考已变化，本次结果未采用，请重新优化。';return;}
   candidate={before:original,after:response.prompt,stamp};const diff=promptDifference(original,response.prompt);
   result.innerHTML=`<div class="prompt-assistant-compare"><div><b>原稿</b><pre>${diff.before}</pre></div><div><b>优化稿</b><pre>${diff.after}</pre></div></div><ul>${(response.changes||[]).map(c=>`<li>${esc(c)}</li>`).join('')}</ul>`;
   result.hidden=false;apply.hidden=false;status.textContent='优化完成，尚未修改输入框。采用前请检查创作细节。';reveal(apply);
  }catch(e){if(current===sequence&&root.isConnected)status.textContent=(e.name==='AbortError'?'已取消':e.message)+'；原稿已保留，可手动重试。';}
  finally{if(current===sequence){controller=null;busy(false);}}
 };
 apply.onclick=()=>{
  if(!candidate||!alive())return;
  if(textarea.value!==candidate.before||snapshot()!==candidate.stamp){invalidate();status.textContent='原稿、参数或参考已变化，请重新优化。';return;}
  onApply(candidate);adopted=candidate;textarea.value=candidate.after;candidate=null;apply.hidden=true;restore.hidden=false;restore.disabled=false;onChange();textarea.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='已采用，可恢复原稿。生成前请重新查看本次费用。';refresh();
 };
 restore.onclick=()=>{if(!adopted||!alive())return;if(textarea.value!==adopted.after){status.textContent='你已继续编辑，未覆盖当前内容。原稿仍在上方对比中。';return;}onRestore();textarea.value=adopted.before;adopted=null;restore.hidden=true;onChange();textarea.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='已恢复原稿。';refresh();};
 const observer=new MutationObserver(()=>{if(!root.isConnected){stop();observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});
 return {cancel:stop};
}
