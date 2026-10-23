// A read-only projection of each engine's canonical ledger. This module never
// persists tasks, submits generation, invents progress or marks a network error
// as a failed generation. The engine keeps ownership of its original task ID.
import {videoTaskState} from './video-task-state.mjs';
import {creativeSourceSignature} from './workstation/creative-agent.mjs';

const TYPES={creative:'创作助手',image:'图片生成',video:'视频生成',export:'视频导出'};
const CREATIVE={queued:'等待开始',running:'正在制作',ready:'待采用',adopted:'已采用',failed:'执行失败',canceled:'已取消',interrupted:'已中断',discarded:'已丢弃'};
const IMAGE={preparing:'准备生成',submitting:'提交待核对',pending:'平台生成中',succeeded:'生成完成',failed:'生成失败',cancelled:'平台已取消',canceled:'平台已取消',unknown:'提交待核对'};
const EXPORT={queued:'等待导出',running:'正在导出',done:'导出完成',completed:'导出完成',error:'导出失败',failed:'导出失败',canceled:'已取消',cancelled:'已取消',interrupted:'已中断'};
const text=(value,max=600)=>typeof value==='string'?value.slice(0,max):'';
const stamp=value=>Number.isFinite(value)&&value>=0?value:0;
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=200;
const rows=value=>Array.isArray(value)?value:value&&typeof value==='object'?Object.values(value):[];
const active=status=>['queued','running','preparing','pending','submitting'].includes(status);
const isDone=status=>['succeeded','done','completed','adopted','discarded','cancelled','canceled'].includes(status);
const isAttention=status=>['failed','error','interrupted','unknown','unobserved'].includes(status);

function uniqueLatest(input){
 const map=new Map();
 for(const row of rows(input)){
  if(!row||!validId(row.id))continue;
  const old=map.get(row.id);
  if(!old||stamp(row.updatedAt||row.observedAt||row.createdAt)>=stamp(old.updatedAt||old.observedAt||old.createdAt))map.set(row.id,row);
 }
 return [...map.values()];
}
function navigation(project,kind,raw){
 const nodes=Array.isArray(project.nodes)?project.nodes:[],ids=new Set(nodes.map(n=>n.id));
 const sources=kind==='export'?rows(raw.sourceNodeIds):[kind==='creative'?raw.sourceNodeId:raw.sourceId];
 const sourceNodeIds=[...new Set(sources.filter(id=>ids.has(id)))];
 const outputs=kind==='export'?[raw.canvasNodeId]:kind==='image'||kind==='video'?nodes.filter(n=>n.generatedTask===raw.id&&n.type===kind).map(n=>n.id):[];
 const resultNodeIds=[...new Set(outputs.filter(id=>ids.has(id)))];
 return {sourceNodeIds,resultNodeIds,nodeId:resultNodeIds[0]||sourceNodeIds[0]||null};
}
function cost(kind,raw){
 if(kind==='export')return '本机导出，不消耗模型积分';
 if(kind==='creative')return '按已配置的模型服务计费；取消不保证免除已发送请求的费用';
 const estimated=Number.isFinite(raw.points)&&raw.points>=0?`预估 ${raw.points} 积分`:'',actual=Number.isFinite(raw.actualPoints)&&raw.actualPoints>=0?`实扣 ${raw.actualPoints} 积分`:'实扣待平台核对';
 return [estimated,actual].filter(Boolean).join(' · ');
}
function projectRecord(project,kind,raw){
 const rawStatus=text(raw.status,40)||'unobserved';
 const status=kind==='image'&&rawStatus==='submitting'?'unknown':rawStatus;
 const state=kind==='video'?videoTaskState(raw):null;
 const labels=kind==='creative'?CREATIVE:kind==='image'?IMAGE:EXPORT;
 let stale=false;
 if(kind==='creative'&&status==='ready'){try{stale=raw.projectId!==project.id||raw.sourceSignature!==creativeSourceSignature(project,raw);}catch{stale=true;}}
 const label=stale?'来源已变化':state?.label||labels[status]||'状态待查询';
 const busy=kind==='video'?state.busy:active(status);
 const queryable=kind!=='creative';
 const canAdd=(kind==='image'||kind==='video')&&status==='succeeded'&&!raw.downloadOnly;
 const nav=navigation(project,kind,raw);
 const cancelNote=kind==='creative'?(busy?'可在任务详情中取消；已发送的模型请求仍可能计费':'此任务已结束，无需取消'):kind==='export'?'导出引擎暂不支持取消':'平台接口暂不支持在工坊内取消，请到 OiiOii 核对';
 const title=kind==='creative'?(raw.flow==='story-package'?'分镜与资产设计':'局部改写'):kind==='export'?(text(raw.name||raw.title,120)||'视频导出'):text(raw.prompt,120)||TYPES[kind];
 const message=text(raw.message||raw.error)||(status==='unobserved'?'旧版只保留了任务编号，请查询实际状态':state?.detail||'');
 const progress=Number.isFinite(raw.progress)&&raw.progress>=0&&raw.progress<=1?raw.progress:null;
 const record={
  key:kind+':'+raw.id,id:raw.id,kind,typeLabel:TYPES[kind],projectId:project.id,title,status,label,busy,
  group:busy?'active':stale?'attention':status==='ready'?'ready':isAttention(status)||!isDone(status)?'attention':'finished',
  message,queryError:text(raw.queryError),createdAt:stamp(raw.createdAt),updatedAt:stamp(raw.updatedAt||raw.observedAt||raw.createdAt),progress,
  modelName:text(raw.modelName,120),cost:cost(kind,raw),...nav,
  actions:{open:kind==='creative',query:queryable,addToCanvas:canAdd&&!nav.resultNodeIds.length,copySettings:kind==='video'&&status==='failed'&&raw.retryable!==false,cancelInDetails:kind==='creative'&&busy},
  recoveryNote:kind==='creative'?'重新执行需要你明确发起，会重新调用模型':kind==='export'?'刷新只查询原导出任务，不创建新导出':'恢复只查询原任务、接收已有结果，不重新提交生成',
  cancelNote,
  // A failed or unknown receipt must never be interpreted as permission to replay.
  submissionUncertain:['unknown','submitting'].includes(status),
 };
 // Only server-generated local output routes are offered; arbitrary stored URLs
 // must not turn into executable/downloadable links in the task center.
 const field=kind==='image'?'imageUrl':'videoUrl',prefix=kind==='image'?'/api/oiioii/image/':'/api/oiioii/video/file/';
 if((kind==='image'||kind==='video')&&raw[field]===prefix+encodeURIComponent(raw.id))record.outputUrl=raw[field];
 if(kind==='export'&&['done','completed'].includes(status))record.outputUrl='/api/workstation/export/'+encodeURIComponent(raw.id)+'/file';
 return record;
}

/** No new task store: pass current canonical records on every render. */
export function collectTaskRecords({project,imageTasks=[],videoJobs=[]}={}){
 if(!project||!validId(project.id))return [];
 const ws=project.workstation||{},out=[];
 for(const [kind,input] of [['creative',ws.creativeTasks],['export',ws.deliver?.tasks],['image',imageTasks],['video',videoJobs]]){
  for(const raw of uniqueLatest(input)){
   // Creative/export records live in the project itself. Media ledgers must
   // explicitly belong to it; records from a previous project never leak in.
   if((kind==='image'||kind==='video')&&raw.projectId!==project.id)continue;
   if((kind==='creative'||kind==='export')&&raw.projectId&&raw.projectId!==project.id)continue;
   out.push(projectRecord(project,kind,raw));
  }
 }
 return out.sort((a,b)=>b.createdAt-a.createdAt||a.key.localeCompare(b.key));
}

export function taskCenterCounts(records){
 const out={all:records.length,active:0,ready:0,attention:0,finished:0};
 for(const record of records)if(Object.hasOwn(out,record.group))out[record.group]++;
 return out;
}
export function filterTaskRecords(records,filter='all'){
 return filter==='all'?records:records.filter(record=>record.group===filter||record.kind===filter);
}

/** A recovery request can only read an existing task. No POST/generate route. */
export function taskQueryRequest(record){
 if(!record||!validId(record.id)||!record.actions?.query)throw Error('此任务不能通过媒体恢复入口查询');
 const prefix={image:'/api/oiioii/task/',video:'/api/oiioii/video/task/',export:'/api/workstation/export/'}[record.kind];
 if(!prefix)throw Error('未知任务类型');
 return {method:'GET',path:prefix+encodeURIComponent(record.id)};
}
export async function queryTaskRecord(record,api){
 const request=taskQueryRequest(record),result=await api(request.path);
 if(!result||result.id!==record.id)throw Error('任务编号与返回结果不一致，未更新记录');
 return result;
}

/** Store the latest observed image status in its original pointer, not a second ledger. */
export function mergeImageTaskObservation(pointer,job,observedAt=Date.now()){
 if(!pointer||!validId(pointer.id)||!job||pointer.id!==job.id)throw Error('图片任务编号不一致');
 const status=Object.hasOwn(IMAGE,job.status)?job.status:null;
 if(!status)throw Error('图片服务返回了无法识别的任务状态');
 const next={...pointer,status,message:text(job.message),observedAt:stamp(observedAt),queryError:''};
 if(job.imageUrl==='/api/oiioii/image/'+encodeURIComponent(pointer.id))next.imageUrl=job.imageUrl;
 for(const key of ['points','actualPoints'])if(Number.isFinite(job[key])&&job[key]>=0)next[key]=job[key];
 return next;
}
export function markTaskQueryError(pointer,error){
 // A disconnected local service does not prove that the platform generation failed.
 return {...pointer,queryError:text(error?.message||error)||'暂时无法查询任务状态'};
}
