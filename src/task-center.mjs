// Read-only projection of creative and export ledgers. // Provider video tasks are listed separately by the app.
import {creativeSourceSignature} from './workstation/creative-agent.mjs';

const TYPES={creative:'创作助手',export:'视频导出'};
const CREATIVE={queued:'等待开始',running:'正在制作',ready:'待采用',adopted:'已采用',failed:'执行失败',canceled:'已取消',interrupted:'已中断',discarded:'已丢弃'};
const EXPORT={queued:'等待导出',running:'正在导出',done:'导出完成',completed:'导出完成',error:'导出失败',failed:'导出失败',canceled:'已取消',cancelled:'已取消',interrupted:'已中断'};
const text=(value,max=600)=>typeof value==='string'?value.slice(0,max):'';
const stamp=value=>Number.isFinite(value)&&value>=0?value:0;
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=200;
const rows=value=>Array.isArray(value)?value:value&&typeof value==='object'?Object.values(value):[];
const active=status=>['queued','running'].includes(status);
const isDone=status=>['done','completed','adopted','discarded','cancelled','canceled'].includes(status);
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
 const sources=kind==='export'?rows(raw.sourceNodeIds):[raw.sourceNodeId];
 const sourceNodeIds=[...new Set(sources.filter(id=>ids.has(id)))];
 const outputs=kind==='export'?[raw.canvasNodeId]:[];
 const resultNodeIds=[...new Set(outputs.filter(id=>ids.has(id)))];
 return {sourceNodeIds,resultNodeIds,nodeId:resultNodeIds[0]||sourceNodeIds[0]||null};
}
function projectRecord(project,kind,raw){
 const rawStatus=text(raw.status,40)||'unobserved';
 const labels=kind==='creative'?CREATIVE:EXPORT;
 let stale=false;
 if(kind==='creative'&&rawStatus==='ready'){try{stale=raw.projectId!==project.id||raw.sourceSignature!==creativeSourceSignature(project,raw);}catch{stale=true;}}
 const label=stale?'来源已变化':labels[rawStatus]||'状态待查询';
 const busy=active(rawStatus);
 const nav=navigation(project,kind,raw);
 const cancelNote=kind==='creative'?(busy?'可在任务详情中取消；已发送的模型请求仍可能计费':'此任务已结束，无需取消'):'导出引擎暂不支持取消';
 const title=kind==='creative'?(raw.flow==='story-package'?'分镜与资产设计':'局部改写'):(text(raw.name||raw.title,120)||'视频导出');
 const message=text(raw.message||raw.error)||(rawStatus==='unobserved'?'旧版只保留了任务编号，请查询实际状态':'');
 const progress=Number.isFinite(raw.progress)&&raw.progress>=0&&raw.progress<=1?raw.progress:null;
 const record={
  key:kind+':'+raw.id,id:raw.id,kind,typeLabel:TYPES[kind],projectId:project.id,title,status:rawStatus,label,busy,
  group:busy?'active':stale?'attention':rawStatus==='ready'?'ready':isAttention(rawStatus)||!isDone(rawStatus)?'attention':'finished',
  message,queryError:text(raw.queryError),createdAt:stamp(raw.createdAt),updatedAt:stamp(raw.updatedAt||raw.observedAt||raw.createdAt),progress,
  modelName:text(raw.modelName,120),cost:kind==='export'?'本机导出，不消耗模型积分':'按已配置的模型服务计费；取消不保证免除已发送请求的费用',...nav,
  actions:{open:kind==='creative',query:kind==='export',addToCanvas:false,copySettings:false,cancelInDetails:kind==='creative'&&busy},
  recoveryNote:kind==='creative'?'重新执行需要你明确发起，会重新调用模型':'刷新只查询原导出任务，不创建新导出',
  cancelNote,
  submissionUncertain:rawStatus==='unknown',
 };
 if(kind==='export'&&['done','completed'].includes(rawStatus))record.outputUrl='/api/workstation/export/'+encodeURIComponent(raw.id)+'/file';
 return record;
}

/** No new task store: pass current canonical records on every render. */
export function collectTaskRecords({project}={}){
 if(!project||!validId(project.id))return [];
 const ws=project.workstation||{},out=[];
 for(const [kind,input] of [['creative',ws.creativeTasks],['export',ws.deliver?.tasks]]){
  for(const raw of uniqueLatest(input)){
   if(raw.projectId&&raw.projectId!==project.id)continue;
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

/** A recovery request can only read an existing export task. */
export function taskQueryRequest(record){
 if(!record||!validId(record.id)||!record.actions?.query)throw Error('此任务不能通过恢复入口查询');
 if(record.kind!=='export')throw Error('未知任务类型');
 return {method:'GET',path:'/api/workstation/export/'+encodeURIComponent(record.id)};
}
export async function queryTaskRecord(record,api){
 const request=taskQueryRequest(record),result=await api(request.path);
 if(!result||result.id!==record.id)throw Error('任务编号与返回结果不一致，未更新记录');
 return result;
}
