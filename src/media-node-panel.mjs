const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const processing={
 trim:{title:'视频修剪',submit:'生成截取片段',note:'选择保留的时间范围。生成新节点，原视频保留。'},
 audio:{title:'分离音频',submit:'提取音频',note:'提取所选片段的声音，生成 WAV 音频节点。'},
 mute:{title:'移除声音',submit:'生成无声视频',note:'保留画面，生成没有音轨的视频副本。'},
 depth:{title:'提取深度',submit:'生成深度视频',note:'实验功能 · 最长15秒 · 12fps · 长边640像素。仅为深度参考，不是三维白模。'}
};
export function openMediaNodePanel(ctx,node,tool='preview'){
 const project=ctx.project(),kind=node.type,names={image:'图片',video:'视频',audio:'音频'};
 if(!node.src)return ctx.generate(node);
 const isImage=kind==='image',isVideo=kind==='video',operation=isVideo?processing[tool]:null,frames=isVideo&&tool==='frames',compat=isVideo&&tool==='compatibility';
 const visiblePreview=!operation&&!compat||tool==='trim';
 const preview=isImage?`<img id="mediaPanelPreview" src="${esc(node.src)}" alt="${esc(node.title)}">`:`<${kind} id="mediaPanelPreview" src="${esc(node.src)}" controls preload="metadata"></${kind}>`;
 const title=operation?.title||(frames?'截取帧':compat?'生成兼容副本':isImage?'预览原图':isVideo?'预览视频':'试听音频');
 const range=operation?`<div class="media-process-range"><label>开始（秒）<input id="mediaStart" type="number" min="0" step="0.1" value="0"></label><label>结束（秒）<input id="mediaEnd" type="number" min="0.1" step="0.1" value=""></label></div><p class="media-tool-note">${operation.note}</p><p class="media-tool-local">本机处理 · 不使用积分</p>`:'';
 const body=`<div class="node-media-panel media-panel-${kind}${operation||compat?' media-operation-panel':''}" data-media-tool="${esc(tool)}"><div class="media-panel-preview" ${visiblePreview?'':'hidden'}>${preview}</div><p id="mediaPanelInfo" class="help-text" role="status">正在读取素材信息…</p>${frames?'<p class="media-tool-note">播放或拖动进度条选帧，再点下方按钮。</p>':''}${range}${compat?'<p class="media-tool-note">在本机生成 H.264 MP4 副本，原视频保留。不使用积分。</p>':''}${operation||compat?'<div id="mediaProcessStatus" role="status" aria-live="polite"></div><progress id="mediaProcessProgress" max="1" value="0" hidden aria-label="素材处理进度"></progress>':''}</div>`;
 const actions=operation?`<button id="cancelMediaProcess" hidden>取消处理</button><button id="submitMediaProcess" class="primary" disabled>${operation.submit}</button>`:compat?'<button id="submitMediaCompatibility" class="primary">生成兼容副本</button>':frames?'<button data-frame="first" disabled>首帧</button><button data-frame="last" disabled>尾帧</button><button data-frame="current" class="primary" disabled>当前帧转图片</button>':'';
 ctx.modal(node.id,title,esc(node.title),body,actions);
 const root=document.querySelector('.node-media-panel'),panel=root.closest('.modal'),media=root.querySelector('#mediaPanelPreview'),info=root.querySelector('#mediaPanelInfo');
 panel.classList.add('media-composer-panel');if(operation||compat)panel.classList.add('media-operation-dialog');
 if(kind==='audio'||operation||compat){panel.dataset.overlayKind='composer';}
 const valid=()=>ctx.project()===project&&project.nodes.includes(node)&&root.isConnected;
 let capabilities=null,busy=false,frameBusy=false;
 const submit=panel.querySelector('#submitMediaProcess');
 const refreshEnabled=()=>{if(submit)submit.disabled=busy||media.readyState<1||tool==='depth'&&!capabilities?.depth;};
 const ready=()=>{
  if(!valid())return;
  info.textContent=isImage?`${media.naturalWidth} × ${media.naturalHeight} 像素`:isVideo?`${media.videoWidth} × ${media.videoHeight} · ${Number.isFinite(media.duration)?media.duration.toFixed(2)+' 秒':'时长未知'}`:Number.isFinite(media.duration)?media.duration.toFixed(2)+' 秒':'时长未知';
  panel.querySelectorAll('[data-frame]').forEach(b=>b.disabled=frameBusy);const end=root.querySelector('#mediaEnd');
  if(end&&!end.value&&Number.isFinite(media.duration))end.value=Math.min(media.duration,tool==='depth'?15:Infinity).toFixed(3);
  refreshEnabled();ctx.refresh?.();
 };
 media.addEventListener(isImage?'load':'loadedmetadata',ready,{once:true});
 media.onerror=()=>{if(valid())info.textContent=isVideo?'视频无法预览。可从工具栏“更多”生成兼容副本。':'无法预览，请检查素材或重新导入。';};
 if(isImage&&media.complete&&media.naturalWidth||!isImage&&media.readyState>=1)ready();
 if(frames)panel.querySelectorAll('[data-frame]').forEach(b=>b.onclick=async()=>{
  if(!valid()||frameBusy)return;frameBusy=true;panel.querySelectorAll('[data-frame]').forEach(b=>b.disabled=true);
  try{
   media.pause();const action=b.dataset.frame,time=action==='first'?0:action==='last'?Math.max(0,media.duration-.05):media.currentTime;
   // Wait for a decoded frame, including the first frame when only metadata was loaded.
   if(Math.abs(media.currentTime-time)>.001||media.readyState<2)await new Promise((resolve,reject)=>{
    const done=e=>{clearTimeout(timer);media.removeEventListener('seeked',check);media.removeEventListener('loadeddata',check);media.removeEventListener('error',bad);e?reject(e):resolve();},check=()=>{if(media.readyState>=2)done();},bad=()=>done(Error('无法读取视频帧')),timer=setTimeout(()=>done(Error('定位超时，请播放视频后重试')),10000);
    media.addEventListener('seeked',check);media.addEventListener('loadeddata',check);media.addEventListener('error',bad);media.currentTime=time;
   });
   if(!valid())return;const frameTime=media.currentTime,canvas=document.createElement('canvas');canvas.width=media.videoWidth;canvas.height=media.videoHeight;canvas.getContext('2d').drawImage(media,0,0);
   const src=canvas.toDataURL('image/png');if(src.length>34*1024*1024)throw Error('图片尺寸过大，请降低视频分辨率后重试');
   if(valid())ctx.addFrame(node,src,frameTime);
  }catch(e){if(valid())info.textContent=e.message||'提取失败，请重试';}finally{frameBusy=false;if(valid())panel.querySelectorAll('[data-frame]').forEach(b=>b.disabled=false);}
 });
 if(operation&&ctx.process){
  let controller=null;const status=root.querySelector('#mediaProcessStatus'),progress=root.querySelector('#mediaProcessProgress'),cancel=panel.querySelector('#cancelMediaProcess');
  const update=(message,value=0,url)=>{if(!status.isConnected)return;status.textContent=message;progress.value=value;if(url){const a=document.createElement('a');a.href=url;a.download='处理结果';a.textContent='下载结果';status.append(' ',a);}ctx.refresh?.();};
  if(tool==='depth')ctx.capabilities().then(c=>{if(!valid())return;capabilities=c;if(!c.depth)update('本机深度引擎未启用，请检查安装配置。');refreshEnabled();}).catch(()=>{if(valid())update('暂时无法连接本机引擎，请关闭后重试。');});
  submit.onclick=async()=>{
   if(!valid()||busy)return;
   const startInput=root.querySelector('#mediaStart'),endInput=root.querySelector('#mediaEnd'),options={operation:tool,start:Number(startInput.value),end:Number(endInput.value)};
   if(!startInput.value.trim()||!endInput.value.trim()||!Number.isFinite(options.start)||!Number.isFinite(options.end)||options.start<0||options.end>media.duration+.03||options.end-options.start<.1)return update('请填写有效时间范围，片段至少 0.1 秒。');
   if(tool==='depth'&&options.end-options.start>15)return update('深度参考最长15秒，请缩短时间范围。');
   busy=true;controller=new AbortController();refreshEnabled();submit.textContent='处理中…';progress.hidden=false;cancel.hidden=false;root.querySelectorAll('.media-process-range input').forEach(b=>b.disabled=true);media.pause();
   try{await ctx.process(node,options,{signal:controller.signal,status:update});}
   catch(e){update(e.name==='AbortError'?'已取消，原素材保留。':e.message,0);}
   finally{controller=null;busy=false;if(valid()){cancel.hidden=true;submit.textContent=operation.submit;root.querySelectorAll('.media-process-range input').forEach(b=>b.disabled=false);refreshEnabled();}}
  };
  cancel.onclick=()=>controller?.abort();root.querySelector('.media-process-range').ondblclick=e=>{if(e.target.matches('input'))e.target.select();};
  if(tool==='trim')root.querySelector('#mediaStart').onchange=e=>{const t=Number(e.target.value);if(Number.isFinite(t)&&t>=0&&t<=media.duration)media.currentTime=t;};
 }
 if(compat&&ctx.compatibility){const button=panel.querySelector('#submitMediaCompatibility'),status=root.querySelector('#mediaProcessStatus');button.onclick=async()=>{if(!valid()||busy)return;busy=true;button.disabled=true;button.textContent='处理中…';try{await ctx.compatibility(node,(message,url)=>{if(!status.isConnected)return;status.textContent=message;if(url){const a=document.createElement('a');a.href=url;a.download='兼容副本.mp4';a.textContent='下载副本';status.append(' ',a);}});}catch(e){if(status.isConnected)status.textContent=e.message;}finally{busy=false;if(button.isConnected){button.disabled=false;button.textContent='生成兼容副本';}}};}
 ctx.refresh?.();
}
