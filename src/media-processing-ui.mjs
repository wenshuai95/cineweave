// Captured source/project identities prevent late results from altering another project.
export async function processMediaNode(node,options,{api,readDataURL,onTask,onReady,onStatus,signal}){
 const source=node.src;
 const failIfCanceled=()=>{if(signal?.aborted)throw new DOMException('已取消','AbortError');};
 onStatus('正在读取素材…',0);failIfCanceled();
 const response=await fetch(source,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('原视频无法读取，请重新导入');
 const blob=await response.blob();if(blob.size>300*1024*1024)throw Error('素材超过 300 MB，请先截取后导入');
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const key=JSON.stringify([digest,options.operation,options.start,options.end]);
 let job=node.processingJobs?.find(j=>j.key===key);
 const cancel=()=>{if(job)api('/api/workstation/processing/'+encodeURIComponent(job.id)+'/cancel',{}).catch(()=>{});};
 signal?.addEventListener('abort',cancel,{once:true});
 try{
  failIfCanceled();
  if(!job){
   onStatus('正在准备本机处理…',0.02);
   const mime=(blob.type||'video/mp4').split(';')[0];
   const uploaded=await fetch('/api/workstation/media?kind=video&name='+encodeURIComponent(node.title)+'&mime='+encodeURIComponent(mime)+'&size='+blob.size,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:blob,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000)});
   const media=await uploaded.json();if(!uploaded.ok)throw Error(media.error||'本地素材准备失败');
   failIfCanceled();const created=await api('/api/workstation/media/'+encodeURIComponent(media.id)+'/processing',options);
   job={id:created.id,key};onTask(job);if(signal?.aborted){cancel();failIfCanceled();}
  }
  for(let n=0;n<1800;n++){
   failIfCanceled();const current=await api('/api/workstation/processing/'+encodeURIComponent(job.id));
   onStatus(current.message,current.progress||0);
   if(['error','canceled'].includes(current.status)){onTask(null,job.id);throw Error(current.message||'处理已结束，请重试');}
   if(current.status==='done'){
    if(current.size>25*1024*1024){onStatus('产物超过 25 MB，请下载后拖入画布。',1,current.fileUrl);return;}
    const result=await fetch(current.fileUrl,{signal});if(!result.ok)throw Error('结果已过期，请重新处理');
    const src=await readDataURL(await result.blob());failIfCanceled();await onReady({source,src,job:current});return;
   }
   await new Promise(r=>setTimeout(r,1000));
  }
  onStatus('处理仍在进行，可稍后用相同参数重新打开取回结果。',0);
 }catch(e){if(/不存在|过期|清理/.test(e.message))onTask(null,job?.id);throw e;}
 finally{signal?.removeEventListener('abort',cancel);}
}
