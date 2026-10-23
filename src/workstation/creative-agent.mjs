// v1.7 第一阶段：画布创作任务（整包分镜+资产 / 局部改写）的纯数据核心。
// 不用 DOM、fetch、Node 专用模块或全局 storage；工程写入只发生在
// prepareCreativeAdoption 返回的副本上，运行期只改动 task 本身。
import {reviewStoryPackage} from './creative-review.mjs';
import {normalizeStory,snapshotStory,validateStoryOutput} from './story.mjs';
import {applyAssetDesigns} from './asset-agent.mjs';
import {sendStoryPackageToCanvas} from './story-canvas.mjs';
import {syncCanonicalNodes} from './canvas-source.mjs';
import {recordWorkflowStep} from './workflow.mjs';
import {writingSkills} from './writing-agent.mjs';

const str=(v,max=6000)=>typeof v==='string'?v.slice(0,max):'';
const ID_RE=/^[\w-]{1,100}$/;
const validId=v=>typeof v==='string'&&ID_RE.test(v);
const now=()=>Date.now();
export const CREATIVE_FLOWS=['story-package','selection-rewrite'];
export const CREATIVE_TASK_STATUSES=['queued','running','ready','failed','canceled','interrupted','adopted','discarded'];
export const CREATIVE_STEP_STATUSES=['queued','running','done','failed','canceled','interrupted','skipped'];
const CREATIVE_STEP_DEFS={'story-package':[['storyboard','分镜'],['assets','资产提示词']],'selection-rewrite':[['rewrite','局部改写']]};
const TASK_JSON_BUDGET=8*1024*1024;
const TASK_LIMIT=10;
// 与 workflow.mjs 同款有界指纹；签名只覆盖策划内容，不含图片/版本/画布。
function fingerprint(value){
 const text=JSON.stringify(value);let a=2166136261,b=5381;
 for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}
 return `${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}
const shotRow=s=>[s?.id||'',s?.scene||'',Array.isArray(s?.characters)?s.characters:[],s?.description||'',s?.dialogue||'',Number.isFinite(s?.duration)?s.duration:null,s?.shotSize||'',s?.cameraMovement||'',Array.isArray(s?.assetIds)?s.assetIds:[]];
const shotContent=s=>JSON.stringify(shotRow(s).slice(1,-1));
const assetRow=a=>[a?.id||'',a?.kind||'',a?.name||'',a?.description||'',a?.prompt||'',a?.negativePrompt||'',Array.isArray(a?.shotIds)?a.shotIds:[]];

// A node entry is an explicit source, never a hint to silently use the project script.
export function resolveCreativeSource(project,nodeId=null){
 if(!nodeId)return {scope:'project',nodeId:null,title:'项目剧本',text:project?.workstation?.script||'',canRewrite:true};
 const node=project?.nodes?.find(n=>n.id===nodeId);
 if(!node)throw Error('来源节点已删除，请重新选择参考内容');
 if(node.storyRef?.kind==='script')return {scope:'project',nodeId:node.id,title:node.title||'项目剧本',text:project.workstation.script||'',canRewrite:true};
 if(typeof node.text!=='string')throw Error('此节点没有可供文字助手使用的正文，请选择文本节点或项目剧本');
 return {scope:'node',nodeId:node.id,title:str(node.title,200)||'未命名节点',text:node.text.slice(0,200000),canRewrite:node.type==='text'&&!node.storyRef&&!node.storyImageRef};
}
export function creativeSourceSignature(project,source={}){
 if(source.sourceScope==='node'){
  const context=resolveCreativeSource(project,source.sourceNodeId);
  if(context.scope!=='node')throw Error('来源节点的用途已变化，请重新生成');
  return fingerprint([creativeSourceSignature(project),context.nodeId,context.text,project.nodes.find(n=>n.id===context.nodeId)?.storyRef||null]);
 }
 const ws=project?.workstation||{},story=ws.story||{},writing=ws.writing||{};
 return fingerprint([
  project?.id||'',ws.script||'',
  (Array.isArray(story.shots)?story.shots:[]).slice(0,200).map(shotRow),
  (Array.isArray(story.assets)?story.assets:[]).slice(0,300).map(assetRow),
  writing.brief||'',writing.skill||'',writing.artDirection||'']);
}

// 快照与候选共用的最小记录形状：模型与持久化都不得夹带画布/图片/多余字段。
const stripShot=s=>({id:s.id,scene:s.scene,characters:s.characters,description:s.description,dialogue:s.dialogue,duration:s.duration,shotSize:s.shotSize,cameraMovement:s.cameraMovement,assetIds:s.assetIds});
const stripAsset=a=>({id:a.id,kind:a.kind,name:a.name,description:a.description,prompt:a.prompt,negativePrompt:a.negativePrompt,shotIds:a.shotIds});
function creativeSnapshot(project){
 const ws=project.workstation,writing=ws.writing||{};
 return {script:str(ws.script,200000),
  shots:normalizeStory({shots:ws.story.shots}).shots.map(stripShot),
  assets:normalizeStory({assets:ws.story.assets}).assets.map(stripAsset),
  brief:str(writing.brief,6000),
  skill:writingSkills.some(s=>s.id===writing.skill)?writing.skill:'general',
  artDirection:str(writing.artDirection,6000)};
}
function normalizeCreativeSnapshot(raw){
 if(!raw||typeof raw!=='object')return null;
 return {script:str(raw.script,200000),
  shots:normalizeStory({shots:raw.shots}).shots.map(stripShot),
  assets:normalizeStory({assets:raw.assets}).assets.map(stripAsset),
  brief:str(raw.brief,6000),
  skill:writingSkills.some(s=>s.id===raw.skill)?raw.skill:'general',
  artDirection:str(raw.artDirection,6000)};
}

export function createCreativeTask(project,input={}){
 const opts=input&&typeof input==='object'?input:{};
 if(!CREATIVE_FLOWS.includes(opts.flow))throw Error('未知的创作任务类型');
 if(!project||typeof project!=='object'||!validId(project.id))throw Error('工程数据不正确');
 const ws=project.workstation;
 if(!ws||typeof ws.script!=='string')throw Error('请先在本工程准备剧本文稿');
 if(opts.sourceScope==='node'&&!validId(opts.sourceNodeId))throw Error('请明确选择来源节点');
 const source=resolveCreativeSource(project,opts.sourceScope==='node'?opts.sourceNodeId:null);
 if(!source.text.trim())throw Error(source.scope==='node'?'来源节点正文为空，请先填写内容':'请先在本工程准备剧本文稿');
 if(opts.flow==='selection-rewrite'&&!source.canRewrite)throw Error('此节点由分镜或资产记录管理，请到对应面板修改；讨论不会改动它');
 const prompt=str(opts.prompt,6000);
 if(!prompt.trim())throw Error('请先填写本次创作要求');
 let selection=null;
 if(opts.flow==='selection-rewrite'){
  const s=opts.selection;
  if(!s||typeof s!=='object'||!Number.isInteger(s.start)||!Number.isInteger(s.end)||typeof s.text!=='string'||s.start<0||s.end<=s.start||s.end>source.text.length||source.text.slice(s.start,s.end)!==s.text)throw Error('选中文字与剧本不一致，请重新选择');
  selection={start:s.start,end:s.end,text:s.text};
 }
 const snapshot=creativeSnapshot(project);
 if(source.scope==='node'){snapshot.script=source.text;snapshot.shots=[];snapshot.assets=[];}
 const stamp=now();
 return {id:crypto.randomUUID(),projectId:project.id,flow:opts.flow,prompt,
  sourceNodeId:validId(opts.sourceNodeId)?opts.sourceNodeId:null,
  sourceScope:source.scope,sourceTitle:source.title,
  sourceSignature:creativeSourceSignature(project,{sourceScope:source.scope,sourceNodeId:source.nodeId}),
  snapshot,selection,status:'queued',
  steps:CREATIVE_STEP_DEFS[opts.flow].map(([id,label])=>({id,label,status:'queued'})),
  candidate:null,message:'',createdAt:stamp,updatedAt:stamp,skillVersion:'1'};
}

// 候选必须是完整、可重开预览的最小结构；模型提供的画布/图片字段一律剥除。
export function normalizeCreativeCandidate(raw,flow){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 if(flow==='selection-rewrite'){
  if(typeof raw.text!=='string'||!raw.text.trim()||raw.text.length>200000)return null;
  return {kind:'selection-rewrite',text:raw.text.slice(0,200000)};
 }
 if(flow!=='story-package')return null;
 if(!Array.isArray(raw.shots)||!raw.shots.length||raw.shots.length>200)return null;
 if(!Array.isArray(raw.assets)||!raw.assets.length||raw.assets.length>300)return null;
 const shots=normalizeStory({shots:raw.shots.map(s=>({...s,canvasNodeId:undefined}))}).shots.map(stripShot);
 if(shots.length!==raw.shots.length||shots.some(s=>!s.description.trim()||!Number.isFinite(s.duration)))return null;
 const assets=normalizeStory({assets:raw.assets.map(a=>({...a,canvasNodeId:undefined,imageVersions:undefined,selectedImageId:undefined}))}).assets.map(stripAsset);
 if(assets.length!==raw.assets.length||assets.some(a=>!a.prompt.trim()))return null;
 const shotIds=new Set(shots.map(s=>s.id));
 if(assets.some(a=>a.shotIds.some(id=>!shotIds.has(id))))return null;
 const key=a=>a.kind+'\0'+a.name.trim();
 if(new Set(assets.map(key)).size!==assets.length)return null;
 return {kind:'story-package',shots,assets,review:reviewStoryPackage({shots,assets})};
}

const looseSelection=s=>s&&typeof s==='object'&&Number.isInteger(s.start)&&Number.isInteger(s.end)&&typeof s.text==='string'&&s.start>=0&&s.end>s.start&&s.end<=200000&&s.text.length===s.end-s.start?{start:s.start,end:s.end,text:str(s.text,200000)}:null;

function normalizeCreativeTaskRow(raw,interrupt){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 if(raw.skillVersion!=='1'||!validId(raw.id))return null;
 if(raw.sourceScope==='node'&&!validId(raw.sourceNodeId))return null;
 const projectId=str(raw.projectId,100);
 if(!projectId||!CREATIVE_FLOWS.includes(raw.flow))return null;
 const prompt=str(raw.prompt,6000);
 if(!prompt.trim())return null;
 const sourceSignature=str(raw.sourceSignature,64);
 if(!sourceSignature)return null;
 const snapshot=normalizeCreativeSnapshot(raw.snapshot);
 if(!snapshot)return null;
 let status=CREATIVE_TASK_STATUSES.includes(raw.status)?raw.status:'failed';
 let message=str(raw.message,600);
 let selection=null;
 if(raw.flow==='selection-rewrite'){
  selection=looseSelection(raw.selection);
  if(!selection)return null;
  // 待采用或仍可重跑的任务必须能对上快照文稿；终态记录只留历史。
  if(['ready','queued','running','interrupted'].includes(status)&&snapshot.script.slice(selection.start,selection.end)!==selection.text)return null;
 }
 const steps=(Array.isArray(raw.steps)?raw.steps:[]).slice(0,3).map(x=>x&&typeof x==='object'&&!Array.isArray(x)&&str(x.id,40)?{id:str(x.id,40),label:str(x.label,60)||'步骤',status:CREATIVE_STEP_STATUSES.includes(x.status)?x.status:'queued'}:null).filter(Boolean);
 if(!steps.length)return null;
 const candidate=normalizeCreativeCandidate(raw.candidate,raw.flow);
 if(status==='ready'&&!candidate){status='failed';message='候选内容不完整，请重新生成';}
 if(interrupt&&(status==='queued'||status==='running')){status='interrupted';message='任务已中断（切换项目或关闭页面），可手动重试';}
 return {id:raw.id,projectId,flow:raw.flow,prompt,
  sourceNodeId:validId(raw.sourceNodeId)?raw.sourceNodeId:null,
  sourceScope:raw.sourceScope==='node'?'node':'project',sourceTitle:str(raw.sourceTitle,200),
  sourceSignature,snapshot,selection,status,
  steps:steps.map(s=>({...s,status:interrupt&&(s.status==='queued'||s.status==='running')?'interrupted':s.status})),
  candidate:status==='ready'?candidate:null,message,
  createdAt:Number.isFinite(raw.createdAt)?raw.createdAt:now(),
  updatedAt:Number.isFinite(raw.updatedAt)?raw.updatedAt:now(),
  skillVersion:'1'};
}

export function normalizeCreativeTasks(raw,{interrupt=false}={}){
 if(!Array.isArray(raw))return [];
 const seen=new Set(),rows=[];
 for(const item of raw){
  const task=normalizeCreativeTaskRow(item,interrupt);
  if(!task||seen.has(task.id))continue;
  seen.add(task.id);rows.push(task);
 }
 rows.sort((a,b)=>b.updatedAt-a.updatedAt);
 const out=[];let size=2;
 for(const task of rows.slice(0,TASK_LIMIT)){
  const json=JSON.stringify(task);
  if(size+json.length>TASK_JSON_BUDGET)break;
  out.push(task);size+=json.length+1;
 }
 return out.sort((a,b)=>a.updatedAt-b.updatedAt);
}

// 同一 task 对象并发/重试时用私有令牌区分，迟到响应不会覆盖新一次运行。
const runTokens=new WeakMap();

export async function runCreativeTask(task,request,{signal,onChange=()=>{}}={}){
 if(!task||typeof task!=='object'||!CREATIVE_FLOWS.includes(task.flow))throw Error('任务数据不正确');
 if(typeof request!=='function')throw Error('请求接口不正确');
 if(task.status==='ready'||task.status==='running'||task.status==='adopted')return task;
 const token={};runTokens.set(task,token);
 const notify=()=>{try{onChange(task);}catch{/* UI 回调异常不中断任务 */}};
 const mine=()=>runTokens.get(task)===token;
 const stopStep=stepId=>kind=>{ // kind: 'failed' | 'canceled'
  if(!mine())return null;
  task.steps=task.steps.map(s=>s.id===stepId?{...s,status:kind}:s.status==='queued'?{...s,status:'skipped'}:{...s});
  task.status=kind;task.candidate=null;
  task.message=kind==='canceled'?'已取消本次任务；已发送的请求可能仍计费':task.message;
  task.updatedAt=now();notify();return null;};
 const fail=stepId=>message=>{if(!mine())return null;task.message=str(message,600);return stopStep(stepId)('failed');};
 const guard=()=>signal?.aborted?'cancel':!mine()||task.status!=='running'?'stop':'ok';
 task.status='running';task.message='';task.candidate=null;
 task.steps=task.steps.map(s=>({...s,status:'queued'}));
 task.updatedAt=now();notify();
 const runStep=async(stepId,body,parse)=>{
  task.steps=task.steps.map(s=>s.id===stepId?{...s,status:'running'}:s);
  task.updatedAt=now();notify();
  const pre=guard();
  if(pre==='cancel')return stopStep(stepId)('canceled');
  if(pre==='stop')return null;
  let result;
  try{result=await request(body,{signal});}
  catch(e){
   if(!mine()||task.status!=='running')return null; // 迟到/被接管的失败不再改状态
   if(signal?.aborted||e?.name==='AbortError')return stopStep(stepId)('canceled');
   return fail(stepId)(e?.message||'请求失败，请重试');
  }
  const post=guard();
  if(post==='cancel')return stopStep(stepId)('canceled'); // 取消后的迟到响应直接丢弃
  if(post==='stop')return null;
  let parsed;
  try{parsed=parse(result);}
  catch(e){return fail(stepId)(e?.message||'模型返回的数据结构不正确');}
  task.steps=task.steps.map(s=>s.id===stepId?{...s,status:'done'}:s);
  task.updatedAt=now();notify();
  return {ok:true,parsed};
 };
 const snap=task.snapshot;
 const base={script:snap.script,shots:snap.shots,assets:snap.assets,brief:[snap.brief,snap.artDirection&&'美术方向：'+snap.artDirection].filter(Boolean).join('\n'),skill:snap.skill};
 let candidate;
 if(task.flow==='story-package'){
  // 第一步：仅内容未变的镜头复用标识，插入或改写不会转移旧镜头的关联。
  const storyboard=await runStep('storyboard',{...base,kind:'storyboard',prompt:task.prompt},result=>{
   const validated=validateStoryOutput(result,'storyboard');
   const unused=[...snap.shots];
   return {shots:validated.shots.map(s=>{const i=unused.findIndex(old=>shotContent(old)===shotContent(s));const old=i>=0?unused.splice(i,1)[0]:null;return {...stripShot(s),id:old?.id||crypto.randomUUID()};})};
  });
  if(!storyboard)return task;
  // 第二步：资产。用候选镜头的完整 ID 请求，引用与重名都在本地严格校验。
  const assets=await runStep('assets',{...base,shots:storyboard.parsed.shots,kind:'assets',prompt:'根据剧本与本次分镜设计可制作的资产与图片提示词，保持美术风格和角色一致。本次要求：'+task.prompt},result=>{
   const raw=result&&typeof result==='object'&&!Array.isArray(result)?result:null;
   if(!raw||!Array.isArray(raw.assets))throw Error('模型返回的数据结构不正确，请重试或调整要求');
   const shotIds=new Set(storyboard.parsed.shots.map(s=>s.id));
   for(const a of raw.assets){
    if(!a||typeof a!=='object')throw Error('模型资产缺少类型、名称或说明，请重新生成');
    if(a.shotIds!==undefined&&!Array.isArray(a.shotIds))throw Error('模型资产的镜头引用不合法，请重新生成');
    if(Array.isArray(a.shotIds)&&a.shotIds.some(x=>!shotIds.has(x)))throw Error('模型资产引用了未知镜头，请重新生成');
   }
   const validated=validateStoryOutput(raw,'assets',storyboard.parsed.shots);
   const list=validated.assets.map(stripAsset);
   if(!list.length)throw Error('模型未返回可用的资产设计，请重新生成');
   if(list.some(a=>!a.prompt.trim()))throw Error('资产提示词为空，请重新设计');
   const key=a=>a.kind+'\0'+a.name.trim();
   if(new Set(list.map(key)).size!==list.length)throw Error('资产名称重复，请重新设计');
   return {assets:list};
  });
  if(!assets)return task;
  candidate={kind:'story-package',shots:storyboard.parsed.shots,assets:assets.parsed.assets,review:reviewStoryPackage({shots:storyboard.parsed.shots,assets:assets.parsed.assets})};
 }else{
  const sel=task.selection;
  const rewrite=await runStep('rewrite',{kind:'rewrite',scope:'selection',script:snap.script,selection:{start:sel.start,end:sel.end,text:sel.text},prompt:task.prompt,brief:[snap.brief,snap.artDirection&&'美术方向：'+snap.artDirection].filter(Boolean).join('\n'),skill:snap.skill},result=>{
   const text=result&&typeof result==='object'&&!Array.isArray(result)?result.text:null;
   if(typeof text!=='string'||!text.trim())throw Error('模型返回的数据结构不正确，请重试或调整要求');
   if(snap.script.length-(sel.end-sel.start)+text.length>200000)throw Error('改写后剧本超过长度限制，请缩短后重试');
   return {text:text.slice(0,200000)};
  });
  if(!rewrite)return task;
  candidate={kind:'selection-rewrite',text:rewrite.parsed.text};
 }
 const final=guard();
 if(final==='cancel'){stopStep(task.steps.at(-1)?.id||task.steps[0].id)('canceled');return task;}
 if(final==='stop')return task;
 task.candidate=candidate;task.status='ready';task.message='生成完成，请预览并采用';
 task.updatedAt=now();notify();
 return task;
}

const shrunkSnapshot=snap=>({script:'',shots:[],assets:[],brief:'',skill:writingSkills.some(s=>s.id===snap?.skill)?snap.skill:'general',artDirection:''});

function adoptStoryPackage(project,candidate){
 const ws=project.workstation;
 snapshotStory(ws,'采用创作任务前');
 const old=ws.story.shots;
 ws.story.shots=candidate.shots.map(s=>{const prev=old.find(o=>o.id===s.id&&shotContent(o)===shotContent(s));return {...s,assetIds:prev?[...prev.assetIds]:[],...(prev?.canvasNodeId?{canvasNodeId:prev.canvasNodeId}:{})};});
 const liveIds=new Set(ws.story.shots.map(s=>s.id));
 for(const asset of ws.story.assets)asset.shotIds=asset.shotIds.filter(id=>liveIds.has(id));
 recordWorkflowStep(ws,'shots');
 applyAssetDesigns(ws,candidate.assets,{snapshot:false}); // 保留资产图片和手工记录，共用本次快照
 // 旧系统分镜节点失去对应记录时只摘除 storyRef，节点本身按旧分镜保留。
 for(const node of project.nodes)if(node?.storyRef?.kind==='shot'&&!liveIds.has(node.storyRef.id))delete node.storyRef;
 sendStoryPackageToCanvas(project); // 节点上限溢出在此整体抛出，采用失败
}

function adoptSelectionRewrite(project,selection,text){
 const ws=project.workstation;
 if(ws.script.slice(selection.start,selection.end)!==selection.text)throw Error('选中文字已变化，请重新生成');
 if(ws.script.length-(selection.end-selection.start)+text.length>200000)throw Error('采用后剧本超过长度限制');
 snapshotStory(ws,'采用局部改写前');
 ws.script=ws.script.slice(0,selection.start)+text+ws.script.slice(selection.end);
 syncCanonicalNodes(project);
}

export function prepareCreativeAdoption(project,task){
 if(!task||typeof task!=='object'||!CREATIVE_FLOWS.includes(task.flow))throw Error('任务数据不正确');
 if(task.status==='adopted')throw Error('此任务已采用过，不能重复采用');
 if(task.status!=='ready')throw Error('任务尚未完成，不能采用');
 if(!project||typeof project!=='object'||project.id!==task.projectId)throw Error('任务不属于当前工程，不能采用');
 if(creativeSourceSignature(project,task)!==task.sourceSignature)throw Error('工程内容已变化，此候选已过期，请重新生成');
 const candidate=normalizeCreativeCandidate(task.candidate,task.flow);
 if(!candidate)throw Error('候选内容不完整，请重新生成');
 if(task.flow==='selection-rewrite'&&(!looseSelection(task.selection)||task.snapshot.script.slice(task.selection.start,task.selection.end)!==task.selection.text))throw Error('任务的选中范围已失效，请重新生成');
 const copy=structuredClone(project);
 copy.workstation=copy.workstation||{};
 const ws=copy.workstation;
 ws.creativeTasks=normalizeCreativeTasks(ws.creativeTasks);
 const record=ws.creativeTasks.find(t=>t.id===task.id);
 if(!record||record.status!=='ready')throw Error('任务记录已失效，请刷新任务列表');
 if(task.flow==='story-package')adoptStoryPackage(copy,candidate);
 else if(task.sourceScope==='node'){
  const source=resolveCreativeSource(copy,task.sourceNodeId);
  if(!source.canRewrite||source.text.slice(task.selection.start,task.selection.end)!==task.selection.text)throw Error('来源节点或选中范围已变化，请重新生成');
  const next=source.text.slice(0,task.selection.start)+candidate.text+source.text.slice(task.selection.end);
  if(next.length>200000)throw Error('采用后节点正文超过长度限制');
  copy.nodes.find(n=>n.id===task.sourceNodeId).text=next;
 }else adoptSelectionRewrite(copy,task.selection,candidate.text);
 if(task.flow==='story-package'&&task.sourceScope==='node'){
  // Newly generated planning records come from this node. Do not imply that
  // the unchanged canonical project script generated this batch.
  const generated=new Set([...ws.story.shots,...ws.story.assets].map(r=>r.canvasNodeId).filter(Boolean));
  copy.edges=copy.edges.filter(e=>!(e.storySourceLink===true&&generated.has(e.to)));
  const existing=new Set(copy.edges.map(e=>e.from+'\0'+e.to));
  for(const to of generated)if(to!==task.sourceNodeId&&!existing.has(task.sourceNodeId+'\0'+to))copy.edges.push({from:task.sourceNodeId,to,creativeSourceLink:true});
 }
 record.status='adopted';record.candidate=null;record.snapshot=shrunkSnapshot(record.snapshot);
 record.message='已采用';record.updatedAt=now();
 return copy;
}
