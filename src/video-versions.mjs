// Versions remain ordinary media nodes: existing backups, undo, wires and editing
// continue to work. Only their presentation is collected into a collapsed card.
import {referencePurposeLabel} from './video-references.mjs';
export function videoVersionGroup(project,nodeId){return (project.boardGroups||[]).find(g=>g.videoVersions===true&&g.memberIds.includes(nodeId));}
export function adoptedVideo(project,group){const members=project.nodes.filter(n=>group?.memberIds.includes(n.id)&&n.type==='video'&&n.src);return members.find(n=>n.id===group.adoptedNodeId)||members[0]||null;}
export function videoVersionRoot(project,node){return videoVersionGroup(project,node.id)?.sourceNodeId||node.generatedSource||node.id;}
export function collectVideoVersions(project,nodeId,createId){
 const node=project.nodes.find(n=>n.id===nodeId);if(!node||node.type!=='video'||!node.src||!node.generatedTask)return null;
 let group=videoVersionGroup(project,node.id);if(group)return group;
 const source=project.nodes.find(n=>n.id===node.generatedSource),sourceGroup=source&&videoVersionGroup(project,source.id),root=sourceGroup?.sourceNodeId||node.generatedSource||node.id;
 group=sourceGroup||(project.boardGroups||[]).find(g=>g.videoVersions===true&&g.sourceNodeId===root);
 // A user-created group wins. Never steal its members or break group validation.
 const claimed=new Set((project.boardGroups||[]).filter(g=>g!==group).flatMap(g=>g.memberIds));
 if(claimed.has(node.id))return null;
 const candidates=project.nodes.filter(n=>n.type==='video'&&n.src&&n.generatedTask&&!claimed.has(n.id)&&(n.id===node.id||n.generatedSource===root));
 if(!group){if((project.boardGroups?.length||0)>=200)return null;group={id:createId(),name:String((source?.title||node.title)+' · 镜头版本').slice(0,100),memberIds:[],collapsed:true,videoVersions:true,sourceNodeId:root,adoptedNodeId:candidates[0]?.id||node.id};(project.boardGroups??=[]).push(group);}
 group.memberIds=[...new Set([...group.memberIds,...candidates.map(n=>n.id)])];return group;
}
export function adoptVideoVersion(project,groupId,nodeId){const group=project.boardGroups?.find(g=>g.id===groupId&&g.videoVersions);if(!group?.memberIds.includes(nodeId)||!project.nodes.some(n=>n.id===nodeId&&n.type==='video'&&n.src))throw Error('这个镜头版本已移除，请重新打开');group.adoptedNodeId=nodeId;return group;}
export function versionClips(project,group){const assets=new Set(project.nodes.filter(n=>group.memberIds.includes(n.id)).map(n=>n.mediaId).filter(Boolean));return project.workstation.sequence.video.filter(c=>c.versionGroupId?c.versionGroupId===group.id:c.canvasNodeId?group.memberIds.includes(c.canvasNodeId):assets.has(c.assetId));}
export function replaceVersionClips(project,group,asset,candidateNodeId){
 if(asset.kind!=='video'||!Number.isFinite(asset.durationSec)||asset.durationSec<=0)throw Error('无法读取新版本时长，请重新导入');
 const clips=versionClips(project,group);if(!clips.length)throw Error('这个镜头尚未加入剪辑');
 const frames=Math.floor(asset.durationSec*project.workstation.sequence.fps);
 if(clips.some(c=>c.out>frames))throw Error('新版本较短，无法保留现有裁切。请先缩短对应片段，或选择更长的版本。');
 // 来源追踪：片段必须指向候选节点。显式传入时校验属于本镜头；旧调用未传时按 mediaId 反查，
 // 唯一命中才采用，命中多个或零个就不猜（宁可少更新，不能指错镜头）。
 let candidate=null;
 if(candidateNodeId!=null){
  const node=project.nodes.find(n=>n.id===candidateNodeId);
  if(!group.memberIds.includes(candidateNodeId)||!node||node.type!=='video'||!node.src)throw Error('只能替换本镜头的版本：所选节点不属于这个镜头');
  candidate=node;
 }else{
  const matches=project.nodes.filter(n=>group.memberIds.includes(n.id)&&n.type==='video'&&n.src&&n.mediaId===asset.id);
  if(matches.length===1)candidate=matches[0];
 }
 const ids=new Set(clips.map(c=>c.id));
 return project.workstation.sequence.video.map(c=>ids.has(c.id)?{...c,assetId:asset.id,versionGroupId:group.id,...(candidate?{canvasNodeId:candidate.id}:{})}:c);
}
// 候选生成快照（纯数据）：值可以是 string 或 null（null = 未记录，由 UI 温和回退）。
// 只读参数与参考用途文案，绝不带出 src、参考素材内容（data）或任务凭据。
export function videoVersionFacts(project,node){
 const input=node?.generatedInput,draft=node?.videoDraft;
 const rawDuration=input?input.duration:draft?.duration,durationNumber=Number(rawDuration);
 const refs=new Map();
 for(const r of (input?input.references||[]:draft?.aliases||[])){
  if(!r||typeof r.nodeId!=='string')continue;
  const prev=refs.get(r.nodeId)||{alias:'',kind:undefined,purpose:undefined};
  const kind=r.kind||project?.nodes.find(n=>n.id===r.nodeId)?.type;
  if(!prev.alias&&r.alias)prev.alias=String(r.alias);
  if(!prev.kind&&kind)prev.kind=kind;
  if(!prev.purpose&&r.purpose)prev.purpose=String(r.purpose);
  refs.set(r.nodeId,prev);
 }
 const refText=[...refs].map(([id,r])=>{const title=project?.nodes.find(n=>n.id===id)?.title;return '@'+r.alias+'参考'+(title?`「${title}」`:'')+' · '+referencePurposeLabel(r);}).join('；');
 const points=node?.generatedPoints,actual=node?.generatedActualPoints;
 return [
  ['模型',node?.generatedModel||(input?input.modelId:draft?.modelId)||null],
  ['时长',rawDuration!=null&&String(rawDuration).trim()!==''&&Number.isFinite(durationNumber)?durationNumber+' 秒':null],
  ['分辨率',(input?input.resolution:draft?.resolution)||null],
  ['画幅',(input?input.aspect:draft?.aspect)||null],
  ['参考用途',refs.size?refText:null],
  ['预估积分',Number.isFinite(points)?points+' 积分':null],
  ['实扣积分',Number.isFinite(actual)?actual+' 积分':'待平台核对'],
 ];
}
export function orderedVideoGroups(project){
 const shots=project.workstation?.story?.shots||[];
 function shotOrder(group){let ids=[group.sourceNodeId],seen=new Set();while(ids.length){const next=[];for(const id of ids){if(seen.has(id))continue;seen.add(id);const n=project.nodes.find(n=>n.id===id);if(n?.storyRef?.kind==='shot'){const index=shots.findIndex(s=>s.id===n.storyRef.id);if(index>=0)return index;}next.push(...project.edges.filter(e=>e.to===id).map(e=>e.from));}ids=next;}return Infinity;}
 return (project.boardGroups||[]).filter(g=>g.videoVersions&&adoptedVideo(project,g)).map((g,i)=>({g,i,order:shotOrder(g)})).sort((a,b)=>a.order-b.order||a.i-b.i).map(x=>x.g);
}
