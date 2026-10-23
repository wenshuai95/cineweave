// 素材画布纯函数：多选、框选、安全复制/粘贴、对齐分布、编组与小地图边界。
// 不触碰 DOM——渲染尺寸由调用方传入（sizeOf(node)->{w,h}），便于 node:test 直接验证。
export const MAX_BOARD_NODES=500;
import {sanitizeVideoDraft} from './video-references.mjs';
import {bundleMemberIds} from './shot-bundles.mjs';
export const CANVAS_CLIP_MIME='application/x-director-canvas-nodes';
export const ALIGN_MODES=['left','right','top','bottom','hcenter','vcenter'];
const NODE_TYPES=['text','actor','scene','director','image','video','audio','model'];
const SRC_RE=/^data:(image\/(png|jpeg|webp|gif)|video\/(webm|mp4)|audio\/(mpeg|mp3|wav|x-wav|ogg|mp4|webm));base64,[A-Za-z0-9+/\r\n]*={0,2}$/i;
const MODEL_SRC_RE=/^data:model\/gltf-binary;base64,[A-Za-z0-9+/]*={0,2}$/;
// 画布间可复制的字段；工程绑定（objectId/sceneObjectIds/modelTask/generatedTask）刻意排除。
const COPY_FIELDS=['type','title','text','x','y','w','src','modelSrc','modelSize','modelKind'];

const finiteOr=(v,fallback)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
const clampNumber=(v,min,max,fallback)=>{const n=finiteOr(v,fallback);return Math.min(max,Math.max(min,n))};
const text=(v,max,fallback)=>typeof v==='string'&&v.length?v.slice(0,max):fallback;

// 去重并只保留仍存在的节点 ID，保持顺序。
export function sanitizeSelection(ids,nodes){
 if(!Array.isArray(ids))return [];
 const exists=new Set(nodes.map(n=>n.id)),seen=new Set(),out=[];
 for(const id of ids){if(typeof id==='string'&&exists.has(id)&&!seen.has(id)){seen.add(id);out.push(id)}}
 return out;
}

// 框选命中：世界坐标矩形与节点实际渲染矩形相交（部分压到即算）。
export function nodesInRect(nodes,rect,sizeOf){
 if(!rect||!(rect.w>0)||!(rect.h>0))return [];
 return nodes.filter(n=>{const s=sizeOf(n);return n.x<rect.x+rect.w&&n.x+s.w>rect.x&&n.y<rect.y+rect.h&&n.y+s.h>rect.y}).map(n=>n.id);
}

// 生成安全副本：仅白名单字段；保留本地媒体/模型数据，剥离工程绑定。
export function buildCanvasCopy(nodes,edges,selectedIds,groups=[]){
 const ids=new Set(selectedIds),copied=[],map=new Map();
 for(const n of nodes){
  if(!ids.has(n.id))continue;
  const c={};
  for(const key of COPY_FIELDS)if(n[key]!==undefined)c[key]=n[key];
  c.id=n.id;c.title=text(c.title,100,'未命名资产');c.text=typeof c.text==='string'?c.text.slice(0,200000):'';
  c.x=finiteOr(c.x,0);c.y=finiteOr(c.y,0);c.w=clampNumber(c.w,100,1000,280);
  if(n.videoDraft)c.videoDraft=sanitizeVideoDraft(n.videoDraft);
  if(typeof n.imagePromptDraft==='string')c.imagePromptDraft=n.imagePromptDraft.slice(0,6000);
  copied.push(c);map.set(n.id,c);
 }
 const internal=Array.isArray(edges)?edges.filter(e=>map.has(e.from)&&map.has(e.to)).map(e=>({from:e.from,to:e.to})):[];
 const copyGroups=[];
 for(const g of Array.isArray(groups)?groups:[]){
  if(!g||!Array.isArray(g.memberIds))continue;
  const memberIds=g.memberIds.filter(id=>map.has(id)),complete=bundleMemberIds({nodes,boardGroups:groups},g).every(id=>map.has(id));
  const shot=complete&&g.shotBundle===true&&map.has(g.shotSourceId),versions=complete&&g.videoVersions===true;
  if(memberIds.length<2&&!(memberIds.length&&(shot||versions)))continue;
  copyGroups.push({name:text(g.name,100,'分组'),memberIds,...(typeof g.collapsed==='boolean'?{collapsed:g.collapsed}:{}),...(shot?{shotBundle:true,shotSourceId:g.shotSourceId}:{}),...(versions?{videoVersions:true,...(map.has(g.sourceNodeId)?{sourceNodeId:g.sourceNodeId}:{}),adoptedNodeId:memberIds.includes(g.adoptedNodeId)?g.adoptedNodeId:memberIds[0]}:{})});
 }
 return {app:'director-canvas',version:1,nodes:copied,edges:internal,groups:copyGroups};
}

// 粘贴：整体校验后一次性返回新节点/连线/分组（新 ID、位移错开）；任何字段异常在写入前抛错，保证原子失败。
export function pasteCanvasCopy(raw,{uid,offset={x:40,y:40},limit}={}){
 if(typeof uid!=='function')throw Error('缺少 ID 生成器');
 if(!offset||!Number.isFinite(offset.x)||!Number.isFinite(offset.y))throw Error('粘贴位置无效');
 if(limit!=null&&(!Number.isInteger(limit)||limit<0))throw Error('画布容量无效');
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('剪贴内容不是有效的画布数据');
 if(raw.app!=='director-canvas'||raw.version!==1)throw Error('剪贴内容不是有效的画布节点');
 if(!Array.isArray(raw.nodes)||!raw.nodes.length)throw Error('剪贴内容没有可粘贴的节点');
 if(!Array.isArray(raw.edges))throw Error('剪贴内容无效');
 if(raw.nodes.length>MAX_BOARD_NODES)throw Error('粘贴内容超过画布节点上限');
 if(limit!=null&&raw.nodes.length>limit)throw Error('画布节点已达上限，本次粘贴未执行');
 const map=new Map(),nodes=[];
 for(const item of raw.nodes){
  if(!item||typeof item!=='object'||Array.isArray(item))throw Error('剪贴内容无效');
  if(typeof item.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(item.id)||map.has(item.id))throw Error('剪贴内容包含无效节点 ID');
  if(!NODE_TYPES.includes(item.type))throw Error('剪贴内容包含不支持的节点类型');
  if(!Number.isFinite(item.x)||!Number.isFinite(item.y)||!Number.isFinite(item.w)||item.w<100||item.w>1000)throw Error('剪贴内容包含无效节点位置或尺寸');
  const n={id:uid(),type:item.type,title:text(item.title,100,'未命名资产'),text:text(item.text,200000,''),x:finiteOr(item.x,0)+offset.x,y:finiteOr(item.y,0)+offset.y,w:clampNumber(item.w,100,1000,280)};
  if(item.src!==undefined){if(typeof item.src!=='string'||!SRC_RE.test(item.src))throw Error('剪贴内容包含不支持的媒体数据');n.src=item.src;}
  if(item.type==='model'){
   if(typeof item.modelSrc!=='string'||!MODEL_SRC_RE.test(item.modelSrc))throw Error('剪贴内容缺少有效的模型数据');
   if(!Number.isFinite(item.modelSize)||item.modelSize<.1||item.modelSize>100||!['scene','human','animal','creature'].includes(item.modelKind))throw Error('剪贴内容包含无效模型设置');
   n.modelSrc=item.modelSrc;n.modelSize=clampNumber(item.modelSize,.1,100,2);
   n.modelKind=['scene','human','animal','creature'].includes(item.modelKind)?item.modelKind:'scene';
  }
  map.set(item.id,n);nodes.push(n);
 }
 for(const item of raw.nodes)if(item.videoDraft)map.get(item.id).videoDraft=sanitizeVideoDraft(item.videoDraft,id=>map.get(id)?.id||id);
 const edges=[],edgeIds=new Set();
 for(const e of raw.edges){
  if(!e||typeof e!=='object')throw Error('剪贴内容无效');
  const from=map.get(e.from),to=map.get(e.to);
  if(!from||!to||from===to)throw Error('剪贴内容包含无效连线端点');
  const edgeId=JSON.stringify([e.from,e.to]);if(edgeIds.has(edgeId))continue;edgeIds.add(edgeId);
  edges.push({from:from.id,to:to.id});
 }
 const groups=[],groupMembers=new Set();
 if(raw.groups!==undefined){
  if(!Array.isArray(raw.groups))throw Error('剪贴内容无效');
  for(const g of raw.groups){
   if(!g||typeof g!=='object'||!Array.isArray(g.memberIds)||!g.memberIds.length||[g.shotBundle,g.videoVersions].some(v=>v!==undefined&&typeof v!=='boolean')||g.shotBundle&&g.videoVersions)throw Error('剪贴内容包含无效分组');
   const shot=g.shotBundle===true,versions=g.videoVersions===true;
   if(g.memberIds.length<2&&!shot&&!versions)throw Error('剪贴内容包含无效分组');
   if(shot&&(!map.has(g.shotSourceId)||!g.memberIds.includes(g.shotSourceId)&&!raw.groups.some(v=>v?.videoVersions===true&&v.sourceNodeId===g.shotSourceId&&Array.isArray(v.memberIds)&&v.memberIds.includes(g.shotSourceId))))throw Error('剪贴内容包含无效镜头来源');
   const memberIds=[];
   for(const id of g.memberIds){const hit=map.get(id);if(!hit||groupMembers.has(hit.id))throw Error('剪贴内容包含无效分组成员');if(!memberIds.includes(hit.id))memberIds.push(hit.id);}
   if(memberIds.length<2&&!shot&&!versions)throw Error('剪贴内容包含无效分组');
   memberIds.forEach(id=>groupMembers.add(id));
   groups.push({id:uid(),name:text(g.name,100,'分组'),memberIds,...(typeof g.collapsed==='boolean'?{collapsed:g.collapsed}:{}),...(shot?{shotBundle:true,shotSourceId:map.get(g.shotSourceId).id}:{}),...(versions?{videoVersions:true,...(map.has(g.sourceNodeId)?{sourceNodeId:map.get(g.sourceNodeId).id}:{}),adoptedNodeId:map.get(g.adoptedNodeId)&&g.memberIds.includes(g.adoptedNodeId)?map.get(g.adoptedNodeId).id:memberIds[0]}:{})});
  }
 }
 return {nodes,edges,groups};
}

// 对齐（≥2）：以选中包围盒为基准；只改 x/y，不改尺寸。
export function alignSelection(nodes,selectedIds,mode,sizeOf){
 if(!ALIGN_MODES.includes(mode))return null;
 const ids=new Set(selectedIds),sel=nodes.filter(n=>ids.has(n.id));
 if(sel.length<2)return null;
 const rects=sel.map(n=>{const s=sizeOf(n);return {n,x:n.x,y:n.y,w:s.w,h:s.h}});
 const minX=Math.min(...rects.map(r=>r.x)),maxX=Math.max(...rects.map(r=>r.x+r.w));
 const minY=Math.min(...rects.map(r=>r.y)),maxY=Math.max(...rects.map(r=>r.y+r.h));
 const out=new Map();
 for(const r of rects){
  let x=r.x,y=r.y;
  if(mode==='left')x=minX;else if(mode==='right')x=maxX-r.w;else if(mode==='hcenter')x=(minX+maxX)/2-r.w/2;
  if(mode==='top')y=minY;else if(mode==='bottom')y=maxY-r.h;else if(mode==='vcenter')y=(minY+maxY)/2-r.h/2;
  out.set(r.n.id,{x,y});
 }
 return out;
}

// 等距分布（≥3）：沿轴按包围盒两端均匀排布，总跨度不变；空间不足（<3 个仍可排）返回 null。
export function distributeSelection(nodes,selectedIds,axis,sizeOf){
 const ids=new Set(selectedIds),sel=nodes.filter(n=>ids.has(n.id));
 if(sel.length<3)return null;
 const horizontal=axis==='x',vertical=axis==='y';
 if(!horizontal&&!vertical)return null;
 const rects=sel.map(n=>{const s=sizeOf(n);return {n,x:n.x,y:n.y,w:s.w,h:s.h}}).sort((a,b)=>horizontal?a.x-b.x:a.y-b.y);
 const lead=rects[0],spanStart=horizontal?lead.x:lead.y;
 const spanEnd=Math.max(...rects.map(r=>horizontal?r.x+r.w:r.y+r.h));
 const total=rects.reduce((sum,r)=>sum+(horizontal?r.w:r.h),0);
 const free=spanEnd-spanStart-total;
 if(free<-1e-6)throw Error('所选节点无法等距分布');
 const gap=free/(rects.length-1),out=new Map();
 let cursor=spanStart;
 for(const r of rects){
  if(horizontal)out.set(r.n.id,{x:cursor,y:r.y});else out.set(r.n.id,{x:r.x,y:cursor});
  cursor+= (horizontal?r.w:r.h)+gap;
 }
 return out;
}

// 清理分组：去悬空成员、跨组去重、丢弃空组；始终返回合法数组。
export function pruneGroups(groups,nodes){
 if(!Array.isArray(groups))return [];
 const exists=new Set(nodes.map(n=>n.id)),seen=new Set(),out=[];
 for(const g of groups){
  if(!g||typeof g!=='object'||!Array.isArray(g.memberIds))continue;
  const memberIds=[];
  for(const id of g.memberIds)if(typeof id==='string'&&exists.has(id)&&!seen.has(id)){seen.add(id);memberIds.push(id)}
  const story=g.storyShots===true,versions=!story&&g.videoVersions===true,shot=!story&&!versions&&g.shotBundle===true&&exists.has(g.shotSourceId);
  if(memberIds.length)out.push({id:typeof g.id==='string'?g.id:memberIds[0],name:text(g.name,100,'分组'),memberIds,...(typeof g.collapsed==='boolean'?{collapsed:g.collapsed}:{}),...(story?{storyShots:true}:{}),...(shot?{shotBundle:true,shotSourceId:g.shotSourceId}:{}),...(versions?{videoVersions:true,...(exists.has(g.sourceNodeId)?{sourceNodeId:g.sourceNodeId}:{}),adoptedNodeId:memberIds.includes(g.adoptedNodeId)?g.adoptedNodeId:memberIds[0]}:{})});
 }
 return cleanShotIdentities(out);
}

// Old generations may use their first result as the version group's source.
// Such a source remains owned by the version group, never by both groups.
function cleanShotIdentities(groups){
 const roots=new Set();
 for(const g of groups)if(g.shotBundle){
  const valid=g.memberIds.includes(g.shotSourceId)||groups.some(v=>v.videoVersions===true&&v.sourceNodeId===g.shotSourceId&&v.memberIds.includes(g.shotSourceId));
  if(!valid||roots.has(g.shotSourceId)){delete g.shotBundle;delete g.shotSourceId;}else roots.add(g.shotSourceId);
 }
 return groups;
}

// 组包围盒（含留白与标题条高度），供可视组边框渲染。
export function groupBounds(members,sizeOf,pad=14,titleBar=28){
 if(!members.length)return null;
 const rects=members.map(n=>{const s=sizeOf(n);return {x:n.x,y:n.y,w:s.w,h:s.h}});
 const minX=Math.min(...rects.map(r=>r.x)),minY=Math.min(...rects.map(r=>r.y));
 const maxX=Math.max(...rects.map(r=>r.x+r.w)),maxY=Math.max(...rects.map(r=>r.y+r.h));
 return {x:minX-pad,y:minY-pad-titleBar,w:maxX-minX+pad*2,h:maxY-minY+pad*2+titleBar};
}

// 与当前选中相交的分组（用于解组按钮状态与操作）。
export function groupsForSelection(groups,selectedIds){
 const ids=new Set(selectedIds);
 return (Array.isArray(groups)?groups:[]).filter(g=>g&&Array.isArray(g.memberIds)&&g.memberIds.some(id=>ids.has(id)));
}

// 编组：从其它组移出所选成员后加入新组，不产生悬空成员/重复 ID。
export function regroup(groups,memberIds,newId,name='分组'){
 const ids=new Set(memberIds),out=[];
 for(const g of (Array.isArray(groups)?groups:[])){
  if(!g||!Array.isArray(g.memberIds))continue;
  const keep=g.memberIds.filter(id=>!ids.has(id));
  if(keep.length)out.push({...g,memberIds:keep,...(g.videoVersions?{adoptedNodeId:keep.includes(g.adoptedNodeId)?g.adoptedNodeId:keep[0]}:{})});
 }
 if(ids.size)out.push({id:newId,name:text(name,100,'分组'),memberIds:[...ids]});
 return cleanShotIdentities(out);
}

// 小地图内容边界：节点矩形与视口世界矩形的并集（含留白）。
export function minimapBounds(rects,viewport,pad=60){
 const all=[...(Array.isArray(rects)?rects:[]),viewport].filter(r=>r&&Number.isFinite(r.x)&&Number.isFinite(r.y)&&r.w>0&&r.h>0);
 if(!all.length)return null;
 const minX=Math.min(...all.map(r=>r.x)),minY=Math.min(...all.map(r=>r.y));
 const maxX=Math.max(...all.map(r=>r.x+r.w)),maxY=Math.max(...all.map(r=>r.y+r.h));
 return {x:minX-pad,y:minY-pad,w:maxX-minX+pad*2,h:maxY-minY+pad*2};
}
