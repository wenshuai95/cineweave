export async function createCompatibleVideo(node,{project,api,readDataURL,onReady,onTask,status}){
 const source=node.src,projectId=project.id;
 const response=await fetch(source,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('无法读取原视频，请重新导入');
 const blob=await response.blob();
 if(blob.size>300*1024*1024)throw Error('本地兼容处理上限为 300 MB，请先截取视频');
 status('正在读取原视频，原片会保留…');
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
 let job=node.compatibilityJob?.digest===digest?{id:node.compatibilityJob.id}:null;
 if(!job){
  const mime=(blob.type||'video/mp4').split(';')[0];
  const uploaded=await fetch('/api/workstation/media?kind=video&name='+encodeURIComponent(node.title)+ '&mime='+encodeURIComponent(mime)+'&size='+blob.size,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:blob,signal:AbortSignal.timeout(60000)});
  const media=await uploaded.json();if(!uploaded.ok)throw Error(media.error||'原视频无法上传到本机处理服务');
  job=await api('/api/workstation/media/'+encodeURIComponent(media.id)+'/compatibility',{});onTask?.({id:job.id,digest});
 }
 for(let attempt=0;attempt<300;attempt++){
  let current;try{current=await api('/api/workstation/compatibility/'+encodeURIComponent(job.id));}catch(e){if(/不存在|已清理|过期/.test(e.message)){onTask?.(null);throw Error('旧兼容任务已清理，请再次点击生成兼容副本');}throw e;}
  status(current.message||'正在生成兼容副本…');
  if(current.status==='error'){onTask?.(null);throw Error(current.message||'兼容处理失败，原片保持不变');}
  if(current.status==='done'){
   if(current.size>25*1024*1024){status('兼容副本超过 25 MB，请下载后导入。原视频保持不变。',current.fileUrl);return;}
   const result=await fetch(current.fileUrl);if(!result.ok){if([404,410].includes(result.status))onTask?.(null);throw Error('兼容副本读取失败，请重新尝试');}
   const src=await readDataURL(await result.blob());await onReady({projectId,source,src,jobId:current.id});return;
  }
  await new Promise(r=>setTimeout(r,1000));
 }
 status('兼容处理仍在运行，请稍后再次打开此素材检查。原片保持不变。');
}
