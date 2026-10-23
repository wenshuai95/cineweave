import {adoptedVideo,adoptVideoVersion,versionClips,orderedVideoGroups,videoVersionFacts} from './video-versions.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 候选生成快照（纯函数，可测）：null 显示为「未记录」，旧数据温和回退；不渲染任何 src 或参考素材内容。
export function videoVersionSnapshotHtml(project,node){
 const legacy=!(node?.generatedInput||node?.videoDraft);
 return `<dl class="video-version-facts">${videoVersionFacts(project,node).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v==null?'未记录':String(v))}</dd></div>`).join('')}</dl>${legacy?'<p class="video-version-legacy">旧版本未记录生成参数；继续生成新版本后会补全。</p>':''}`;
}
export function videoVersionCard(project,group){const node=adoptedVideo(project,group);return `<div class="video-version-preview">${node?`<video src="${esc(node.src)}" controls preload="metadata" aria-label="采用版本预览"></video>`:'<p>版本素材已移除</p>'}<span>采用：${esc(node?.generatedModel||node?.title||'待选择')}</span></div><div class="group-card-actions"><button data-video-versions="${esc(group.id)}">版本对比 · ${group.memberIds.length}</button><button data-video-send="${esc(group.id)}" ${node?'':'disabled'}>采用版送入剪辑</button></div>`;}
export function createVideoVersionUI(ctx){
 // token 防串写：异步回调完成时若对话框已重开（token 变化）或工程已切换，旧面板不再写任何 UI。
 let dialogSeq=0;
 function open(groupId,candidateId){
  const token=++dialogSeq,owner=ctx.project(),group=owner.boardGroups?.find(g=>g.id===groupId&&g.videoVersions);if(!group)return ctx.toast('镜头卡片已移除');
  const members=owner.nodes.filter(n=>group.memberIds.includes(n.id)&&n.type==='video'&&n.src),adopted=adoptedVideo(owner,group);
  if(!members.length)return ctx.toast('这个镜头没有可用版本');
  const candidate=members.find(n=>n.id===candidateId)||members.at(-1),source=owner.nodes.find(n=>n.id===group.sourceNodeId&&n.src&&n.type==='video');
  const no=n=>members.findIndex(m=>m.id===n.id)+1,differs=!!adopted&&adopted.id!==candidate.id,inEdit=versionClips(owner,group).length;
  const notes=differs?[`正在查看候选版本 ${no(candidate)}（未采用）；当前采用的是版本 ${no(adopted)}。「采用版送入剪辑」只送入已采用的版本 ${no(adopted)}，不会送入候选。`]:(inEdit?[]:[`候选与采用为同一版本（版本 ${no(candidate)}），「采用版送入剪辑」送入的就是它。`]);
  if(inEdit)notes.push('采用只更新画布预览，不会改动已剪入时间线的片段；要把剪辑换成候选版本，请单独点「替换剪辑并采用」。');
  ctx.modal('镜头版本对比',esc(group.name),`<div class="video-version-workspace"><nav aria-label="镜头版本">${members.map((n,i)=>`<button data-version-preview="${esc(n.id)}" aria-pressed="${n.id===candidate.id}"><b>版本 ${i+1}${adopted?.id===n.id?' · 已采用':''}${n.id===candidate.id?' · 当前候选':''}</b><span>${esc(n.generatedModel||'本地视频')}${Number.isFinite(n.generatedPoints)?' · 预估 '+esc(n.generatedPoints)+' 积分':''}</span></button>`).join('')}</nav><div class="video-version-content"><div class="video-version-players"><figure><figcaption>${source&&!group.memberIds.includes(source.id)?'白模 / 来源参考':'已采用版本 '+(adopted?no(adopted):'—')}</figcaption>${(source||adopted)?`<video id="versionReference" controls preload="metadata" src="${esc((source||adopted).src)}"></video>`:'<p>来源节点已移除</p>'}</figure><figure><figcaption>候选版本 ${no(candidate)}${differs?'（未采用）':'（与采用相同）'}</figcaption><video id="versionCandidate" controls preload="metadata" src="${esc(candidate.src)}"></video></figure></div><div class="row"><button id="versionPlayBoth">从头对比播放</button><button id="versionPauseBoth">暂停</button></div><details><summary>生成快照与提示词</summary>${videoVersionSnapshotHtml(owner,candidate)}<p class="video-version-meta">${esc(candidate.generatedModel||'未记录模型')} · ${candidate.generatedAt?esc(new Date(candidate.generatedAt).toLocaleString('zh-CN')):'旧版导入'}</p><pre>${esc(candidate.text)}</pre></details><p id="versionNote" role="status">${esc(notes.join(' '))}</p></div></div>`,`<button id="versionGenerate">继续生成版本</button><button id="versionAdopt" class="primary" ${differs?'':'disabled'}>采用此版本</button><button id="versionSend" ${adopted?'':'disabled'}>采用版送入剪辑</button>${inEdit?`<button id="versionReplace" title="用候选版本 ${no(candidate)} 替换剪辑中的片段并采用；保留位置、裁切与音量">替换剪辑并采用</button>`:''}`);
  const panel=document.querySelector('#versionNote').closest('.modal');panel.classList.add('video-version-dialog');
  const live=()=>token===dialogSeq&&ctx.project()===owner&&owner.boardGroups?.includes(group)&&panel.isConnected;
  panel.querySelectorAll('[data-version-preview]').forEach(b=>b.onclick=()=>{if(live())open(groupId,b.dataset.versionPreview);});
  const players=()=>[...panel.querySelectorAll('video')];
  panel.querySelector('#versionPlayBoth').onclick=()=>{players().forEach(v=>{v.currentTime=0;});Promise.allSettled(players().map(v=>v.play()));};
  panel.querySelector('#versionPauseBoth').onclick=()=>players().forEach(v=>v.pause());
  const foot=()=>[...panel.querySelectorAll('.modal-actions button')],adoptBtn=panel.querySelector('#versionAdopt'),sendBtn=panel.querySelector('#versionSend'),replaceBtn=panel.querySelector('#versionReplace');
  panel.querySelector('#versionGenerate').onclick=()=>{if(!live())return;ctx.closeModal();ctx.generate(source||candidate);};
  adoptBtn.onclick=()=>{if(!live())return;ctx.checkpoint();adoptVideoVersion(owner,groupId,candidate.id);ctx.commit();open(groupId,candidate.id);};
  sendBtn.onclick=async()=>{if(!live()||sendBtn.disabled)return;sendBtn.disabled=true;const n=adoptedVideo(owner,group);if(!n)return;ctx.closeModal();await ctx.send(n.id);};
  if(replaceBtn)replaceBtn.onclick=async()=>{
   if(!live()||replaceBtn.disabled)return;
   foot().forEach(b=>b.disabled=true);panel.querySelector('#versionNote').textContent='正在替换剪辑，请稍候…';
   try{await ctx.replace(candidate.id);if(live())open(groupId,candidate.id);}
   catch(e){if(live()){panel.querySelector('#versionNote').textContent=e.message;foot().forEach(b=>b.disabled=false);adoptBtn.disabled=!differs;}}
  };
 }
 function send(groupId){const group=ctx.project().boardGroups?.find(g=>g.id===groupId&&g.videoVersions),node=adoptedVideo(ctx.project(),group);if(node)ctx.send(node.id);}
 function batch(){const owner=ctx.project(),groups=orderedVideoGroups(owner);if(!groups.length)return ctx.toast('生成视频后，可在镜头卡片中采用版本并送入剪辑');
  ctx.modal('采用镜头送入剪辑','按文学分镜顺序排列；尚未关联文学分镜的镜头按卡片创建顺序追加。',`<div class="video-version-batch">${groups.map((g,i)=>{const n=adoptedVideo(owner,g),exists=versionClips(owner,g).length;return `<label><input type="checkbox" data-version-batch="${esc(n.id)}" ${exists?'disabled':'checked'}><b>镜头 ${i+1} · ${esc(g.name)}</b><span>${exists?'已在剪辑中，可在版本对比中「替换剪辑并采用」':esc(n.generatedModel||n.title)}</span></label>`;}).join('')}</div><p id="versionBatchStatus" role="status">只加入勾选镜头的采用版本，不会消耗生成积分。</p>`,'<button id="versionBatchSend" class="primary">按顺序加入剪辑</button>');
  const button=document.querySelector('#versionBatchSend'),panel=button.closest('.modal');button.onclick=async()=>{if(ctx.project()!==owner||button.disabled)return;button.disabled=true;try{const ids=[...panel.querySelectorAll('[data-version-batch]:checked')].filter(b=>!b.disabled).map(b=>b.dataset.versionBatch);if(!ids.length)throw Error('请勾选尚未加入剪辑的镜头');await ctx.batchSend(ids);if(panel.isConnected)ctx.closeModal();}catch(e){if(panel.isConnected){panel.querySelector('#versionBatchStatus').textContent=e.message;button.disabled=false;}}};
 }
 return {open,send,batch};
}
