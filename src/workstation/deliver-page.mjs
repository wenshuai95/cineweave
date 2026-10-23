// 剪辑页的导出面板：把剪辑序列经本机 Node 服务（workstation-server.mjs）用 ffmpeg
// 裁切拼接 + A1 混音，输出 H.264 / AAC MP4。进度来自 ffmpeg 真实转码帧数，
// 不做模拟百分比；ffmpeg 缺失时明确提示，不假装输出成功。
import {clipLength,clipEnd,sequenceDuration,formatTimecode} from './sequence.mjs';

export function createDeliverPage(root,ctx){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ws=()=>ctx.project().workstation;
 const taskProjects=new Map();
 const say=t=>{const el=root.querySelector('#wsDlStatus');if(el)el.textContent=t;};
 let health=null,runningJob=null,pollTimer=0,busy=false,exportOwner=null,destination='file',sendingCanvas=false;

 async function api(path,options={}){
  const response=await fetch(path,options);
  let data=null;try{data=await response.json();}catch{}
  if(!response.ok)throw Error(data?.error||('本地服务请求失败 ('+response.status+')'));
  if(!data||typeof data!=='object')throw Error('本机导出服务没有返回有效数据，请重试');
  return data;
 }

 async function checkHealth(){
  try{health=await api('/api/workstation/health');}
  catch{health={ffmpeg:false,ffprobe:false,error:'本地服务不可用（请从桌面应用或 npm start 启动）'};}
 }

 // 把轨道转成「片段 + 空隙」的连续段表；空隙输出为静音段，保证导出时长与时间线一致。
 function buildSegments(trackName,mediaIds,volumeScale=1,snapshot=ws()){
  const seq=snapshot.sequence,track=trackName==='video'?seq.video:seq.audio,total=sequenceDuration(snapshot);
  const segments=[];let cursor=0;
  for(const c of track){
   if(c.start>cursor)segments.push({type:'silence',frames:c.start-cursor});
   segments.push({type:'media',mediaId:mediaIds[c.assetId],in:c.in,frames:clipLength(c),volume:Math.min(4,(c.muted?0:c.volume)*volumeScale)});
   cursor=clipEnd(c);
  }
  if(total>cursor)segments.push({type:'silence',frames:total-cursor});
  return segments;
 }

 async function startExport(){
  if(busy)return;
  const projectId=ctx.project().id,snapshot=structuredClone(ws()),seq=snapshot.sequence,total=sequenceDuration(snapshot);
  if(!total)return ctx.toast('时间线为空：先在剪辑页放入素材');
  if(destination==='canvas'&&(ctx.project().nodes.length>=500||snapshot.assets.length>=500))return ctx.toast('画布或素材库已满，请整理后再导出到画布');
  const clipIds=new Set([...seq.video,...seq.audio].map(c=>c.assetId));
  exportOwner={id:projectId,name:ctx.project().name,destination,sourceNodeIds:ctx.project().nodes.filter(n=>clipIds.has(n.mediaId)).map(n=>n.id)};busy=true;
  await checkHealth();
  if(!health.ffmpeg||!health.ffprobe){
   busy=false;exportOwner=null;render();return ctx.toast('缺少导出引擎（未找到 ffmpeg / ffprobe），无法导出；请安装本机 ffmpeg 后重试');
  }
  const missing=[...seq.video,...seq.audio].filter(c=>!snapshot.assets.some(a=>a.id===c.assetId));
  if(missing.length){busy=false;exportOwner=null;return ctx.toast(`有 ${missing.length} 个片段引用的素材已缺失，请先在剪辑页删除`);}
  busy=true;render();
  const say=t=>{const el=root.querySelector('#wsDlStatus');if(el)el.textContent=t;};
  try{
   say('正在上传本次媒体到本地服务…');
   const mediaIds={};
   const ids=[...new Set([...seq.video,...seq.audio].map(c=>c.assetId))];
   for(const id of ids){
    const asset=snapshot.assets.find(a=>a.id===id),blob=await ctx.mediaStore.blob(id);
    if(!blob)throw Error(`「${asset?.name||id}」内容缺失（可能来自旧备份），请删除后重新导入`);
    const uploaded=await api(`/api/workstation/media?name=${encodeURIComponent(asset.name)}&kind=${asset.kind}&mime=${encodeURIComponent(asset.mime)}&size=${blob.size}`,
     {method:'POST',headers:{'Content-Type':'application/octet-stream'},body:blob});
    mediaIds[id]=uploaded.id;
   }
   say('已上传，正在创建导出任务…');
   const height=snapshot.deliver.height==='1080p'?1080:720;
   const a1Gain=seq.audioMuted?0:(seq.audioGain??1);
   const plan={fps:seq.fps,height,video:buildSegments('video',mediaIds,1,snapshot),audio:buildSegments('audio',mediaIds,a1Gain,snapshot)};
   if(!plan.video.length)throw Error('导出计划为空');
   const job=await api('/api/workstation/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(plan)});
   runningJob=job.id;
   taskProjects.set(job.id,projectId);
   await ctx.updateExportTask(projectId,{id:job.id,status:'running',createdAt:Date.now(),height:job.height===1080?'1080p':'720p',frames:job.frames,fps:job.fps,destination:exportOwner.destination,sourceNodeIds:exportOwner.sourceNodeIds,message:''});
   render();
   await poll(job.id,true);
  }catch(e){
   say('');
   ctx.toast('导出失败：'+e.message);
   if(runningJob)await ctx.updateExportTask(taskProjects.get(runningJob)||projectId,{id:runningJob,status:'error',message:e.message.slice(0,200)});
   busy=false;runningJob=null;exportOwner=null;render();
  }
 }

 function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name.replace(/[\\/:*?"<>|]/g,'_');a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
 }

 async function poll(id,autoDownload=false){
  clearTimeout(pollTimer);
  const belongsHere=(taskProjects.get(id)||ctx.project().id)===ctx.project().id;
  try{
   const job=await api('/api/workstation/export/'+encodeURIComponent(id));
   const bar=root.querySelector('#wsDlBar i'),text=root.querySelector('#wsDlProgressText');
   if(bar&&belongsHere)bar.style.width=Math.round(job.progress*100)+'%';
   if(text&&belongsHere)text.textContent=`${job.status==='done'?'导出完成':job.status==='error'?'导出失败':'导出中'} · ${Math.round(job.progress*100)}% · ${job.message||''}`;
   const projectId=taskProjects.get(id)||ctx.project().id;
   if(job.status==='done'){
    await ctx.updateExportTask(projectId,{id,status:'done',message:''});
    if(autoDownload){
     try{
      if(exportOwner?.destination==='canvas')await sendToCanvas(id,job,exportOwner);
      else{
       say('正在下载成片…');const blob=await resultBlob(id);
       downloadBlob(blob,`${exportOwner?.name||ctx.project().name}-交付-${job.height===1080?'1080p':'720p'}-${new Date().toISOString().slice(0,10)}.mp4`);
       ctx.toast('MP4 已导出并开始下载');
      }
     }catch(e){await ctx.updateExportTask(projectId,{id,status:'done',message:e.message.slice(0,200)});ctx.toast('视频已生成，但输出失败：'+e.message+'。可从导出记录重试。');}
    }
    busy=false;runningJob=null;exportOwner=null;render();
    return;
   }
   if(job.status==='error'){
    await ctx.updateExportTask(projectId,{id,status:'error',message:job.message||'导出失败'});
    busy=false;runningJob=null;exportOwner=null;render();
    ctx.toast('导出失败：'+(job.message||'未知错误'));
    return;
   }
   await ctx.updateExportTask(projectId,{id,status:job.status,message:job.message||''});
   pollTimer=setTimeout(()=>poll(id,autoDownload),900);
  }catch(e){
   busy=false;runningJob=null;exportOwner=null;
   render();
   if(belongsHere)say('状态查询失败：'+e.message+'。可展开导出记录，点击“刷新状态”继续查询。');
  }
 }

 async function resultBlob(id){
  const response=await fetch('/api/workstation/export/'+encodeURIComponent(id)+'/file');
  if(!response.ok)throw Error('成片已过期或无法读取，请重新导出');
  return response.blob();
 }
 async function sendToCanvas(id,job,owner){
  say('正在把剪辑视频加入画布…');
  const blob=await resultBlob(id);
  const nodeId=await ctx.addCutToCanvas(blob,{projectId:owner.id,name:owner.name+' · 粗剪',jobId:id,frames:job.frames,fps:job.fps,height:job.height,sourceNodeIds:owner.sourceNodeIds||[]});
  await ctx.updateExportTask(owner.id,{id,canvasNodeId:nodeId,message:''});
  ctx.toast(owner.id===ctx.project().id?'剪辑视频已加入画布，并保留来源连线':'剪辑视频已加入原项目画布');
 }
 const taskStatus={running:'导出中',queued:'排队中',done:'已完成',error:'失败'};

 function render(){
  const recordsOpen=root.querySelector('.ws-deliver-tasks')?.open||ws().deliver.tasks.some(t=>t.status==='error'||t.message||(!busy&&['running','queued'].includes(t.status)));
  const progressWidth=root.querySelector('#wsDlBar i')?.style.width||'0%',progressText=root.querySelector('#wsDlProgressText')?.textContent||'准备中…';
  const seq=ws().sequence,total=sequenceDuration(ws());
  const vCount=seq.video.length,aCount=seq.audio.length;
  const other=busy&&exportOwner&&exportOwner.id!==ctx.project().id;
  root.innerHTML=`
   ${ctx.embedded?'':'<header class="ws-page-header"><div><h2>导出成片</h2><p>H.264 MP4 · AAC 音频 · 本机导出</p></div></header>'}
   <div class="ws-deliver-body">
    <section class="ws-deliver-main">
     <h3>导出视频</h3>
     <p class="ws-export-summary">${(total/seq.fps).toFixed(2)} 秒 · ${seq.fps} fps · ${vCount} 段视频${aCount?` · ${aCount} 段音频`:''} · H.264 MP4</p>
     <label class="field">分辨率<select id="wsDlHeight" aria-label="导出分辨率" ${busy?'disabled':''}><option value="720p" ${ws().deliver.height!=='1080p'?'selected':''}>720p · 1280×720</option><option value="1080p" ${ws().deliver.height==='1080p'?'selected':''}>1080p · 1920×1080</option></select></label>
     <p class="ws-export-notice">本机处理，不消耗模型积分，也不发送到云端。保留原素材与时间线；空隙会导出为黑场与静音。</p>
     <p class="help-text" role="status">${!total?'时间线还没有片段，请先返回剪辑加入素材。':health==null?'正在检测本机导出引擎…':health.ffmpeg&&health.ffprobe?'导出引擎已就绪 · AAC 音频 · 最长 1 小时':'本机导出引擎不可用，请安装 ffmpeg / ffprobe 后重新打开。'}</p>
     <fieldset class="ws-export-destination"><legend>导出到</legend><label><input type="radio" name="wsDestination" value="file" ${destination==='file'?'checked':''} ${busy?'disabled':''}> 本机文件</label><label><input type="radio" name="wsDestination" value="canvas" ${destination==='canvas'?'checked':''} ${busy?'disabled':''}> 画布视频节点</label></fieldset>
     <p class="ws-export-destination-note">${other?`当前任务属于「${esc(exportOwner.name)}」，输出仍保存在原项目。`:''}${destination==='canvas'?'完成后加入工程画布，建立来源连线；不会额外下载文件。':'完成后下载 MP4 文件；可在导出记录重新下载。'}</p>
     <div class="ws-deliver-actions">
      <button id="wsDlExport" class="primary" ${busy||!total?'disabled':''} ${!health?.ffmpeg||!health?.ffprobe?'disabled':''}>${other?'等待其他项目导出结束':busy?'正在导出…':destination==='canvas'?'导出到画布':'开始导出 MP4'}</button>
      ${busy?`<span class="muted">${other?`正在导出「${esc(exportOwner.name)}」，本机一次导出一个任务。`:'正在本机导出，可关闭此面板继续工作。开始后暂不支持取消；原素材和时间线保持不变。'}</span>`:''}
     </div>
     <div class="ws-export-progress ${(busy||runningJob)&&!other?'':'hidden'}"><div id="wsDlBar"><i style="width:${esc(progressWidth)}"></i></div><p class="help-text" id="wsDlProgressText" role="status">${esc(progressText)}</p></div>
     <p class="help-text" id="wsDlStatus" role="status"></p>
    </section>
    <details class="ws-deliver-tasks" ${recordsOpen?'open':''}>
     <summary>导出记录 · ${ws().deliver.tasks.length}</summary>
     ${ws().deliver.tasks.length?`<div class="ws-task-list">${[...ws().deliver.tasks].reverse().map(t=>`
      <div class="ws-task-row ${t.status}">
       <b>${t.height==='1080p'?'1080p':'720p'} · ${t.fps}fps · ${(t.frames/t.fps).toFixed(1)}s</b>
       <span>${taskStatus[t.status]||t.status} · ${new Date(t.createdAt).toLocaleTimeString('zh-CN',{hour12:false})}</span>
       ${t.message?`<small>${esc(t.message)}</small>`:''}
       ${t.status==='done'?`<div class="ws-task-output-actions"><button data-download="${esc(t.id)}">重新下载</button><button data-canvas="${esc(t.id)}" ${busy||sendingCanvas?'disabled':''}>${t.canvasNodeId?'查看 / 再送入画布':'送入画布'}</button></div>`:''}
       ${t.status==='running'?`<button data-check="${esc(t.id)}">刷新状态</button>`:''}
      </div>`).join('')}</div>`:'<p class="ws-empty">还没有导出记录。完成一次导出后会在这里列出，可以再次下载已完成的成片。</p>'}
    </details>
   </div>`;
  root.querySelector('#wsDlHeight').onchange=e=>{ws().deliver.height=e.target.value;ctx.persist();};
  root.querySelector('#wsDlExport').onclick=startExport;
  root.querySelectorAll('[name=wsDestination]').forEach(el=>el.onchange=()=>{destination=el.value;render();});
  root.querySelectorAll('[data-download]').forEach(b=>b.onclick=async()=>{
   try{const response=await fetch('/api/workstation/export/'+encodeURIComponent(b.dataset.download)+'/file');if(!response.ok)throw Error('成片已过期或无法下载，请重新导出');const blob=await response.blob();
   downloadBlob(blob,`${ctx.project().name}-交付-${new Date().toISOString().slice(0,10)}.mp4`);}catch(e){ctx.toast(e.message);}
  });
  root.querySelectorAll('[data-canvas]').forEach(b=>b.onclick=async()=>{
   if(busy||sendingCanvas)return;
   const owner={id:ctx.project().id,name:ctx.project().name},task=ws().deliver.tasks.find(t=>t.id===b.dataset.canvas);
   owner.sourceNodeIds=task?.sourceNodeIds||[];sendingCanvas=true;render();
   try{const job=await api('/api/workstation/export/'+encodeURIComponent(b.dataset.canvas));if(job.status!=='done')throw Error('该视频尚未完成');await sendToCanvas(b.dataset.canvas,job,owner);}
   catch(e){ctx.toast('送入画布失败：'+e.message);}finally{sendingCanvas=false;render();}
  });
  root.querySelectorAll('[data-check]').forEach(b=>b.onclick=()=>{if(busy)return ctx.toast('请等待当前导出任务结束');const task=ws().deliver.tasks.find(t=>t.id===b.dataset.check);exportOwner={id:ctx.project().id,name:ctx.project().name,destination:task?.destination||'file',sourceNodeIds:task?.sourceNodeIds||[]};runningJob=b.dataset.check;taskProjects.set(runningJob,ctx.project().id);busy=true;poll(b.dataset.check,exportOwner.destination==='canvas'&&!task?.canvasNodeId);});
  if(runningJob&&!busy){busy=true;poll(runningJob,false);}
 }

 async function onShow(options={}){if(!busy&&!sendingCanvas)destination=options.destination==='canvas'?'canvas':'file';render();await checkHealth();render();}
 function onHide(){}
 function refresh(){render();}
 return {onShow,onHide,refresh};
}
