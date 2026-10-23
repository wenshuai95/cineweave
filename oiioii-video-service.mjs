import {referenceProblem,validateReferenceMentions,compileReferencePrompt,referencePurposes} from './src/video-references.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,stat,rm,open} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';

const ID=/^[\w.-]{1,100}$/;
const active=new Set(['preparing','submitting','pending']);
export function videoModels(data){
 return (data.models||[]).map(m=>({id:String(m.id),name:m.name,sizes:m.sizes||[],aspects:m.aspect_ratios||[],durations:m.durations||[],media:m.generation_input_contract?.media||{},audioRequiresVisual:m.key==='minimax-h3',promptOnly:m.generation_input_contract?.prompt_only_supported===true}));
}
export function durationAllowed(value,choices){
 return Number.isFinite(value)&&value>0&&value<=180&&choices.some(c=>{const p=String(c).split('-').map(Number);return p.length===2?value>=p[0]&&value<=p[1]:value===p[0];});
}
function validateInput(b,m){
 if(!m||!durationAllowed(b.duration,m.durations)||!m.aspects.includes(b.aspect)||!(m.sizes.length?m.sizes.includes(b.resolution):!b.resolution))throw Error('模型参数已变化，请重新选择模型、时长、尺寸和画幅');
 if(typeof b.prompt!=='string'||!b.prompt.trim()||b.prompt.length>6000||!ID.test(b.projectId)||b.sourceId&&!ID.test(b.sourceId))throw Error('请输入有效描述和工程来源');
 const refs=b.references||[];
 if(!Array.isArray(refs)||refs.length>5)throw Error('当前最多参考 3 张图片、1 段视频和 1 段音频');
 const seen=new Set(),aliases=new Set();
 for(const r of refs){
  if(!r||!['image','video','audio'].includes(r.kind)||!ID.test(r.nodeId)||seen.has(r.nodeId))throw Error('所选模型不支持此参考素材或引用重复');
  if(r.purpose!==undefined&&r.purpose!==null&&!Object.hasOwn(referencePurposes[r.kind],r.purpose))throw Error('参考用途无效，请重新选择');
  seen.add(r.nodeId);
  if(r.alias!==undefined&&(!new RegExp('^'+({image:'图片',video:'视频',audio:'音频'})[r.kind]+'[1-9][0-9]*$').test(r.alias)||r.alias.length>20||aliases.has(r.alias)))throw Error('参考素材别名无效或重复');
  if(r.alias)aliases.add(r.alias);
 }
 const problem=referenceProblem(refs,m)||validateReferenceMentions(b.prompt,refs);if(problem)throw Error(problem);

 return refs;
}
function decodeRef(r){
 const match=typeof r.data==='string'&&r.data.match(/^data:((?:image\/(?:png|jpeg|webp))|(?:video\/(?:mp4|webm))|(?:audio\/(?:mpeg|mp3|wav|x-wav|ogg|mp4|webm)));base64,([A-Za-z0-9+/]*={0,2})$/);
 if(!match||!match[1].startsWith(r.kind+'/'))throw Error('参考格式不支持，请使用 PNG、JPEG、WebP、MP4、WebM、MP3、WAV、M4A 或 Ogg');
 const buffer=Buffer.from(match[2],'base64'),max=r.kind==='video'?40:r.kind==='audio'?15:10;
 if(!buffer.length||buffer.length>max*1024*1024)throw Error(`参考素材须小于 ${max} MB`);
 const format=match[1].split('/')[1],magic=buffer.toString('ascii',0,4),mp4=buffer.toString('ascii',4,8)==='ftyp',webm=buffer.subarray(0,4).equals(Buffer.from([26,69,223,163]));
 const wav=magic==='RIFF'&&buffer.toString('ascii',8,12)==='WAVE',ogg=magic==='OggS',mp3=buffer.toString('ascii',0,3)==='ID3'||buffer[0]===255&&(buffer[1]&224)===224;
 const valid=r.kind==='image'?(format==='png'?buffer[0]===137&&buffer[1]===80:format==='jpeg'?buffer[0]===255&&buffer[1]===216:magic==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP'):r.kind==='video'?(format==='mp4'?mp4:webm):({wav,'x-wav':wav,mpeg:mp3,mp3,ogg,mp4,webm})[format];
 if(!valid)throw Error('参考文件内容与格式不匹配');
 return {buffer,ext:({'x-wav':'wav',mpeg:'mp3',mp4:r.kind==='audio'?'m4a':'mp4'})[format]||format};
}
const signature=b=>createHash('sha256').update(JSON.stringify({projectId:b.projectId,sourceId:b.sourceId||null,sourceText:b.sourceText||'',prompt:b.prompt,modelId:b.modelId,duration:b.duration,resolution:b.resolution||'',aspect:b.aspect,references:(b.references||[]).map(r=>({nodeId:r.nodeId,kind:r.kind,alias:r.alias||null,purpose:r.purpose||null,duration:r.duration||0,data:r.data}))})).digest('hex');
// Identity captured when the user submitted the quote. Keep only small IDs or a
// short source fingerprint, never reference bytes or credentials. Missing items
// become an explicit unknown legacy marker instead of being filled from today's
// project state.
function submittedSnapshot(references,raw){
 const byNode=new Map(),items=Array.isArray(raw)?raw:[];
 for(const item of items){
  if(!item||typeof item!=='object'||typeof item.nodeId!=='string'||byNode.has(item.nodeId))continue;
  const reference=(references||[]).find(ref=>ref.nodeId===item.nodeId);
  if(!reference||item.kind!==reference.kind)continue;
  if(item.legacy===true||item.unknown===true){byNode.set(item.nodeId,{nodeId:item.nodeId,kind:reference.kind,legacy:true,unknown:true});continue;}
  if(item.missing===true){byNode.set(item.nodeId,{nodeId:item.nodeId,kind:reference.kind,missing:true});continue;}
  if(typeof item.assetId==='string'&&typeof item.versionId==='string'&&ID.test(item.assetId)&&ID.test(item.versionId))byNode.set(item.nodeId,{nodeId:item.nodeId,kind:reference.kind,assetId:item.assetId,versionId:item.versionId});
  else if(typeof item.srcHash==='string'&&/^[a-f0-9]{16}$/.test(item.srcHash))byNode.set(item.nodeId,{nodeId:item.nodeId,kind:reference.kind,srcHash:item.srcHash});
 }
 return (references||[]).map(reference=>byNode.get(reference.nodeId)||{nodeId:reference.nodeId,kind:reference.kind,legacy:true,unknown:true});
}

// All state is local and survives restarts. An ambiguous submission is never retried.
export function createOiioiiVideoService({folder,run,probe}){
 folder=resolve(folder);const jobs=new Map(),quotes=new Map(),polls=new Map();let saving=Promise.resolve();
 // Only a missing ledger may start empty; a corrupt or unreadable one must block paid work instead of being reset.
 let ledgerProblem=null;
 const ready=(async()=>{try{const list=JSON.parse(await readFile(join(folder,'jobs.json'),'utf8'));if(!Array.isArray(list)||list.some(j=>!j||typeof j!=='object'||!ID.test(j.id)||!ID.test(j.projectId)))throw Error('Invalid video ledger');for(const j of list){if(['preparing','submitting'].includes(j.status)){j.status='unknown';j.message='上次提交被中断，请到 OiiOii 核对记录，勿重复提交。';}jobs.set(j.id,j);}}catch(e){if(!e||e.code!=='ENOENT')ledgerProblem=e;}})();
 const save=()=>{if(ledgerProblem)return Promise.reject(Error('任务记录无法读取，请先修复本机任务记录'));const data=JSON.stringify([...jobs.values()]);saving=saving.catch(()=>{}).then(async()=>{await mkdir(folder,{recursive:true,mode:0o700});const temp=join(folder,randomUUID()+'.tmp');await writeFile(temp,data,{mode:0o600});await rename(temp,join(folder,'jobs.json'));});return saving;};
 const clean=j=>({id:j.id,projectId:j.projectId,sourceId:j.sourceId,sourceText:j.sourceText||'',referenceIds:j.referenceIds||[],references:j.references||[],referenceSnapshot:submittedSnapshot(j.references,j.referenceSnapshot),prompt:j.prompt,modelId:j.modelId,modelName:j.modelName,duration:j.duration,resolution:j.resolution,aspect:j.aspect,status:j.status,retryable:j.retryable,phase:j.phase,completedReferences:j.completedReferences,totalReferences:j.totalReferences,message:j.message,createdAt:j.createdAt,updatedAt:j.updatedAt,points:j.points,actualPoints:j.actualPoints,cliId:j.cliId,sourceSignature:j.sourceSignature,downloadOnly:j.downloadOnly===true,bytes:j.bytes,videoUrl:j.output?'/api/oiioii/video/file/'+j.id:undefined});
 const models=async()=>videoModels(await run(['inspect','models','--domain','video','--json']));
 async function refreshCharge(j){
  if(!j.resourceUri||Number.isFinite(j.actualPoints)||Date.now()-(j.costCheckedAt||0)<30000)return;
  j.costCheckedAt=Date.now();
  try{const data=await run(['points','cost',j.resourceUri,'--json']);const entry=data?.entries?.find(e=>e.uri===j.resourceUri&&e.status==='charged');if(Number.isFinite(entry?.consumed_points)&&entry.consumed_points>=0)j.actualPoints=entry.consumed_points;}catch{}
 }
 function args(q,refs){const a=['video','generate','--model-id',q.modelId,'--prompt',compileReferencePrompt(q.prompt,q.references),'--duration',String(q.duration),'--aspect-ratio',q.aspect];if(q.resolution)a.push('--resolution',q.resolution);for(const kind of ['image','video','audio']){const uris=refs.filter(r=>r.kind===kind).map(r=>r.uri);if(uris.length)a.push('--'+kind,...uris);}return a;}
 return {
  models,
  async quote(b){const model=(await models()).find(m=>m.id===b.modelId);let refs=validateInput(b,model);const decoded=refs.map(decodeRef);
   let referenceDuration=0,billableReferenceDuration=0;
   refs=refs.map(r=>({...r}));
   // Read local bytes before quoting: audio metadata is as important as whitebox duration.
   // Only the video has our existing 180-second input limit; model-specific audio limits are not guessed.
   for(let i=0;i<refs.length;i++){
    const r=refs[i];if(!['video','audio'].includes(r.kind))continue;
    let actual=r.duration;const name=r.kind==='audio'?'音频':'视频';
    if(probe){
     await mkdir(folder,{recursive:true,mode:0o700});const temp=join(folder,randomUUID()+'.probe.'+decoded[i].ext);
     try{await writeFile(temp,decoded[i].buffer,{mode:0o600});actual=await probe(temp);}catch{throw Error('无法读取参考'+name+'时长，请重新导入'+name);}finally{await rm(temp,{force:true});}
    }
    if((probe||r.kind==='video'||actual!==undefined)&&(!Number.isFinite(actual)||actual<=0||r.kind==='video'&&actual>180))throw Error('无法读取参考'+name+'时长，请重新导入'+name);
    if(Number.isFinite(actual))r.duration=actual;
    if(r.kind==='video'){referenceDuration=actual;billableReferenceDuration=Math.ceil(actual);}
   }
   const a=['points','quote','--model-id',b.modelId,'--duration',String(b.duration),'--reference-video-duration',String(billableReferenceDuration)];if(b.resolution)a.push('--resolution',b.resolution);a.push('--json');const d=await run(a),id=randomUUID();
   quotes.set(id,{...b,references:refs,referenceSnapshot:submittedSnapshot(refs,b.referenceSnapshot),signature:signature({...b,references:refs}),modelName:model.name,points:d.estimated_points,sufficient:d.sufficient,referenceDuration,billableReferenceDuration,expires:Date.now()+600000});return {quoteId:id,points:d.estimated_points,sufficient:d.sufficient,caveat:d.caveat,referenceDuration,billableReferenceDuration,references:refs.map(({nodeId,kind,duration})=>({nodeId,kind,...(Number.isFinite(duration)?{duration}:{})}))};
  },
  async generate(b){await ready;if(ledgerProblem)throw Error('本机任务记录无法读取，可能已损坏或无权限；为避免重复扣费已阻止新的付费提交。尚未提交生成，请修复任务记录后重试。');
   const prior=[...jobs.values()].find(j=>j.quoteId===b.quoteId);if(prior)return clean(prior);
   const q=quotes.get(b.quoteId);if(!q||q.expires<Date.now())throw Error('报价已过期，请重新查询积分');if(q.jobId&&jobs.has(q.jobId))return clean(jobs.get(q.jobId));const duplicate=[...jobs.values()].find(j=>j.projectId===q.projectId&&j.sourceSignature===q.signature&&(active.has(j.status)||j.status==='unknown'));if(duplicate){q.jobId=duplicate.id;return clean(duplicate);}if(q.sufficient===false)throw Error('平台积分不足');
   const j={id:randomUUID(),quoteId:b.quoteId,projectId:q.projectId,sourceId:q.sourceId||null,sourceText:typeof q.sourceText==='string'?q.sourceText.slice(0,200000):'',referenceIds:q.references.map(r=>r.nodeId),references:q.references.map(r=>({nodeId:r.nodeId,kind:r.kind,alias:r.alias||null,...(r.purpose?{purpose:r.purpose}:{}),...(Number.isFinite(r.duration)?{duration:r.duration}:{})})),referenceSnapshot:submittedSnapshot(q.references,q.referenceSnapshot),sourceSignature:q.signature,prompt:q.prompt,modelId:q.modelId,modelName:q.modelName,duration:q.duration,resolution:q.resolution||null,aspect:q.aspect,points:q.points,status:'preparing',phase:'preparing',completedReferences:0,totalReferences:q.references.length,createdAt:Date.now(),updatedAt:Date.now()};jobs.set(j.id,j);q.jobId=j.id;try{await save();}catch(e){jobs.delete(j.id);delete q.jobId;throw Error('本机任务记录无法保存，尚未提交生成，请检查磁盘空间后重试');}
   // Return immediately; uploads can take minutes and must not hold a request open.
   (async()=>{let submitted=false;try{
    const ws=await run(['workspace','current','--json']);if(!ws.workspace_id)throw Error('请先在 OiiOii 选择工作空间');
    const stage=async(phase,message)=>{j.phase=phase;j.message=message;j.updatedAt=Date.now();await save();};
    const refs=[];await mkdir(join(folder,j.id),{recursive:true,mode:0o700});
    for(let i=0;i<q.references.length;i++){await stage('uploading',`正在上传参考 ${i+1} / ${q.references.length}`);const r=q.references[i],{buffer,ext}=decodeRef(r),file=join(folder,j.id,`ref-${i}.${ext}`);await writeFile(file,buffer,{mode:0o600});try{
     if(['video','audio'].includes(r.kind)&&probe){const d=await probe(file);if(!Number.isFinite(d)||Math.abs(d-r.duration)>.25)throw Error('参考素材时长与报价不一致，请重新查询积分');}
     const d=await run(['upload','file',file,'--workspace',String(ws.workspace_id),'--json'],720000);const uri=d.uri||d.resource_uri||d.resource?.uri;
     if(typeof uri!=='string'||!uri.startsWith('hogi://'+r.kind+'/'))throw Error('平台未返回有效参考资源');refs.push({kind:r.kind,uri});j.completedReferences=i+1;
    }finally{await rm(file,{force:true});}}
    await stage('validating','参考上传完成，正在校验模型参数');const a=args(q,refs);const validation=await run([...a,'--workspace',String(ws.workspace_id),'--dry-run','--json']);if(validation.valid!==true)throw Error('平台参数校验未通过');
    j.status='submitting';await stage('submitting','正在提交生成，请勿重复操作');submitted=true;
    const d=await run([...a,'--workspace',String(ws.workspace_id),'--json']);j.cliId=d.local_task_id||d.task_id;if(!j.cliId)throw Error('平台未返回任务 ID');
    j.status='pending';j.phase='generating';j.message='已提交，等待平台生成';
   }catch{j.status=submitted?'unknown':'failed';j.phase=j.status;j.message=submitted?'提交结果不确定，请到 OiiOii 核对记录，勿重复提交。':'参考准备或参数校验失败，未提交生成。请核对授权、素材格式和模型参数。';}finally{j.updatedAt=Date.now();try{await save();}finally{quotes.delete(b.quoteId);}}})().catch(()=>{if(j.status==='preparing')j.status='failed';else if(j.status==='submitting')j.status='unknown';j.message='本机任务记录保存失败，请先核对平台任务记录，勿重复提交。';});
   return clean(j);
  },
  async list(projectId){await ready;if(ledgerProblem)throw Error('本机任务记录无法读取；已阻止新的付费提交，请先检查任务记录。');return [...jobs.values()].filter(j=>j.projectId===projectId).sort((a,b)=>b.createdAt-a.createdAt).map(clean);},
  async poll(id){await ready;if(ledgerProblem)throw Error('本机任务记录无法读取，请先检查任务记录');const j=jobs.get(id);if(!j)throw Error('视频任务不存在');if(j.status==='succeeded'){await refreshCharge(j);await save();return clean(j);}if(j.status!=='pending')return clean(j);if(polls.has(id))return polls.get(id);
   const work=(async()=>{try{const d=await run(['task','status',j.cliId,'--json']),t=d.task;
    if(t?.status==='succeeded'){const uri=t.resourceUris?.find(u=>typeof u==='string'&&u.startsWith('hogi://video/'));if(!uri)throw Error('任务完成但视频资源未就绪，可稍后恢复');j.resourceUri=uri;j.phase='downloading';j.message='平台已生成，正在接收视频到本机';j.updatedAt=Date.now();await save();await refreshCharge(j);
     await mkdir(folder,{recursive:true,mode:0o700});const out=join(folder,j.id+'.mp4');const downloaded=await run(['record','open',uri,'--output',out,'--no-open','--json'],360000);if(resolve(downloaded.path||out)!==out)throw Error('平台下载路径不匹配');const info=await stat(out);if(info.size>200*1024*1024){j.status='failed';j.retryable=false;j.phase='failed';j.message='平台已生成，但文件超过本机 200 MB 接收上限，请到 OiiOii 下载。不会再次提交。';await save();return clean(j);}const handle=await open(out,'r');const head=Buffer.alloc(16);try{await handle.read(head,0,16,0);}finally{await handle.close();}if(head.toString('ascii',4,8)!=='ftyp')throw Error('平台未返回 MP4 视频，请从 OiiOii 下载后导入');j.output=out;j.status='succeeded';j.phase='succeeded';j.bytes=info.size;j.downloadOnly=info.size>25*1024*1024;j.message=j.downloadOnly?'视频已保存到本机。大于 25 MB 的视频请先下载，避免工程保存卡顿。':'视频已保存到本机，可加入画布';
    }else if(['failed','cancelled','canceled'].includes(t?.status)){j.status='failed';j.phase='failed';j.message='平台生成失败或已取消，请核对平台记录与扣费。';}
    j.updatedAt=Date.now();await save();return clean(j);
   }finally{polls.delete(id);}})();polls.set(id,work);return work;
  },
  async file(id){await ready;const j=jobs.get(id),path=join(folder,id+'.mp4');if(!ID.test(id)||!j||j.status!=='succeeded'||j.output!==path||!path.startsWith(folder+sep))throw Error('视频尚未就绪');return readFile(path);},
 };
}
