// 工作现场（UI 状态）按工程 ID 单独保存：模式、选中、播放位置、画布视口、
// 时间轴缩放/滚动/展开状态。与工程内容、撤销历史完全分离；恢复端负责
// 校验对象是否仍存在，缺失即回退默认。
const KEY='director-canvas-workspace-v1';
const MAX_PROJECTS=80;

const num=(v,min,max)=>Number.isFinite(v)?Math.min(max,Math.max(min,v)):null;
const str=v=>typeof v==='string'&&v.length<=64?v:null;

export function saveWorkspaceState(projectId,state,storage){
 if(!projectId||typeof projectId!=='string'||!state||!storage||typeof storage.setItem!=='function')return;
 const board=state.board||{};
 const timeline=state.timeline||{};
 const entry={
  v:1,updatedAt:Date.now(),
  mode:state.mode==='stage'?'stage':'board',
  selectedId:str(state.selectedId),
  time:num(state.time,0,3600),
  board:{x:num(board.x,-1e6,1e6),y:num(board.y,-1e6,1e6),zoom:num(board.zoom,.2,2)},
  timeline:{zoom:num(timeline.zoom,1,12),scrollLeft:num(timeline.scrollLeft,0,1e7),scrollTop:num(timeline.scrollTop,0,1e7)},
  expanded:Array.isArray(state.expanded)?state.expanded.filter(x=>typeof x==='string'&&x.length<=64).slice(0,300):[],
  collapsed:Array.isArray(state.collapsed)?state.collapsed.filter(x=>typeof x==='string'&&x.length<=64).slice(0,300):[],
  filter:str(state.filter),
 };
 try{
  const all=loadAll(storage);
  all[projectId]=entry;
  const keys=Object.keys(all);
  if(keys.length>MAX_PROJECTS){
   for(const k of keys.sort((a,b)=>(all[a].updatedAt||0)-(all[b].updatedAt||0)).slice(0,keys.length-MAX_PROJECTS))delete all[k];
  }
  storage.setItem(KEY,JSON.stringify(all));
 }catch{}
}
export function loadWorkspaceState(projectId,storage){
 if(!projectId||typeof projectId!=='string'||!storage||typeof storage.getItem!=='function')return null;
 let s;
 try{s=loadAll(storage)[projectId];}catch{return null;}
 if(!s||typeof s!=='object')return null;
 return {
  mode:s.mode==='stage'?'stage':'board',
  selectedId:str(s.selectedId),
  time:num(s.time,0,3600),
  board:{x:num(s.board?.x,-1e6,1e6),y:num(s.board?.y,-1e6,1e6),zoom:num(s.board?.zoom,.2,2)},
  timeline:{zoom:num(s.timeline?.zoom,1,12),scrollLeft:num(s.timeline?.scrollLeft,0,1e7),scrollTop:num(s.timeline?.scrollTop,0,1e7)},
  expanded:Array.isArray(s.expanded)?s.expanded.filter(x=>typeof x==='string'&&x.length<=64).slice(0,300):[],
  collapsed:Array.isArray(s.collapsed)?s.collapsed.filter(x=>typeof x==='string'&&x.length<=64).slice(0,300):[],
  filter:str(s.filter),
 };
}
function loadAll(storage){
 try{
  const raw=storage.getItem(KEY);
  const all=raw?JSON.parse(raw):{};
  return all&&typeof all==='object'&&!Array.isArray(all)?all:{};
 }catch{return {};}
}
