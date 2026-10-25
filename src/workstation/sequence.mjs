import {normalizeDirectorAssistant} from './director-state.mjs';
import {normalizeWriting} from './writing-agent.mjs';
import {normalizeStory} from './story.mjs';
import {normalizeWorkflow} from './workflow.mjs';
import {normalizeCreativeTasks} from './creative-agent.mjs';
// 剪辑页影片序列：与导演台对象关键帧时间轴完全分开的整数帧数据模型。
// 约定：所有位置 / 入出点均为「序列帧」整数（按 sequence.fps 计），不存秒数，
// 序列帧 → 秒只发生在预览与导出的最后一刻（帧 / fps），避免浮点累计误差。
// 纯数据模块：不碰 DOM，可在 Node 测试里直接运行。
export const SEQUENCE_FPS=[24,25,30];
export const MAX_CLIPS_PER_TRACK=200;
export const MAX_VOLUME=2;

export const isSequenceFps=f=>SEQUENCE_FPS.includes(Number(f));
export const clipLength=c=>c.out-c.in;
export const clipEnd=c=>c.start+clipLength(c);
export const trackEnd=track=>track.reduce((m,c)=>Math.max(m,clipEnd(c)),0);
export const sequenceDuration=ws=>Math.max(trackEnd(ws?.sequence?.video||[]),trackEnd(ws?.sequence?.audio||[]));

export function defaultWorkstation(){
 return {script:'',writing:normalizeWriting({}),story:normalizeStory({}),workflow:{},creativeTasks:[],directorAssistant:normalizeDirectorAssistant({}),assets:[],sequence:{fps:24,video:[],audio:[],audioGain:1,audioMuted:false},deliver:{height:'720p',tasks:[]}};
}

const int=(v,min=0,max=1e9)=>Number.isFinite(v)&&Math.floor(v)===v?Math.min(max,Math.max(min,v)):null;
const clampInt=(v,min,max)=>Math.round(Math.min(max,Math.max(min,v)));

// 规范化单个片段：字段齐全、帧为整数、入<出、音量与静音合法。无法修复的片段返回 null。
export function normalizeClip(raw){
 if(!raw||typeof raw!=='object')return null;
 const start=int(raw.start,0,24*3600*30),inF=int(raw.in,0,24*3600*30),outF=int(raw.out,0,24*3600*30);
 if(start==null||inF==null||outF==null||outF<=inF)return null;
 const volume=raw.volume==null?1:Number(raw.volume);
 const v=Number.isFinite(volume)?Math.min(MAX_VOLUME,Math.max(0,volume)):1;
 if(typeof raw.assetId!=='string'||!/^[\w-]{1,100}$/.test(raw.assetId))return null;
 const id=typeof raw.id==='string'&&/^[\w-]{1,100}$/.test(raw.id)?raw.id:null;
 if(!id)return null;
 return {id,assetId:raw.assetId,start,in:inF,out:outF,volume:Math.round(v*100)/100,muted:raw.muted===true,...Object.fromEntries(['canvasNodeId','versionGroupId'].filter(k=>typeof raw[k]==='string'&&/^[\w-]{1,100}$/.test(raw[k])).map(k=>[k,raw[k]]))};
}

function normalizeTrack(raw){
 if(!Array.isArray(raw))return [];
 const seen=new Set(),out=[];
 for(const item of raw){
  const c=normalizeClip(item);
  if(!c||seen.has(c.id))continue;
  seen.add(c.id);out.push(c);
 }
 out.sort((a,b)=>a.start-b.start);
 // 修复重叠：按开始顺序保留先到者，重叠的后段剔除（保住可救内容，不整轨丢弃）。
 const kept=[];let cursor=0;
 for(const c of out){if(c.start>=cursor){kept.push(c);cursor=clipEnd(c);}}
 return kept.slice(0,MAX_CLIPS_PER_TRACK);
}

export function normalizeSequence(raw){
 const seq=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const fps=isSequenceFps(seq.fps)?Number(seq.fps):24;
 // v1.3.0：A1 音轨整体音量 / 静音（作用于整条 A1，不影响视频片段原声）。
 const gain=seq.audioGain==null?1:Number(seq.audioGain);
 return {fps,video:normalizeTrack(seq.video),audio:normalizeTrack(seq.audio),audioGain:Number.isFinite(gain)?Math.min(MAX_VOLUME,Math.max(0,Math.round(gain*100)/100)):1,audioMuted:seq.audioMuted===true};
}

export function normalizeAssets(raw){
 if(!Array.isArray(raw))return [];
 const seen=new Set(),out=[];
 for(const a of raw){
  if(!a||typeof a!=='object')continue;
  if(typeof a.id!=='string'||!/^[\w-]{1,100}$/.test(a.id)||seen.has(a.id))continue;
  if(!['video','audio','image'].includes(a.kind))continue;
  if(typeof a.name!=='string'||!a.name.length||a.name.length>200)continue;
  const mime=typeof a.mime==='string'&&a.mime.length<=80?a.mime:'application/octet-stream';
  const size=int(a.size,0,2**40)??0;
  const durationSec=Number.isFinite(a.durationSec)&&a.durationSec>0&&a.durationSec<=24*3600?Math.round(a.durationSec*1000)/1000:null;
  const width=int(a.width,1,16384)??null,height=int(a.height,1,16384)??null;
  const createdAt=int(a.createdAt,0,4102444800000)??Date.now();
  seen.add(a.id);out.push({id:a.id,kind:a.kind,name:a.name.slice(0,200),mime,size,durationSec,width,height,createdAt});
 }
 return out.slice(0,500);
}

export function normalizeDeliver(raw){
 const d=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const height=d.height==='1080p'?'1080p':'720p';
 const tasks=Array.isArray(d.tasks)?d.tasks.filter(t=>t&&typeof t==='object'&&typeof t.id==='string'&&/^[\w-]{1,100}$/.test(t.id)).slice(-20).map(t=>({
  id:t.id,status:['done','error','running','queued'].includes(t.status)?t.status:'error',
  createdAt:int(t.createdAt,0,4102444800000)??0,
  height:(t.height==='1080p'||t.height===1080)?'1080p':'720p',
  frames:int(t.frames,0,24*3600*30)??0,
  fps:isSequenceFps(t.fps)?Number(t.fps):24,
  message:typeof t.message==='string'?t.message.slice(0,200):'',
  ...(t.destination==='canvas'?{destination:'canvas'}:{}),
  ...(Array.isArray(t.sourceNodeIds)?{sourceNodeIds:[...new Set(t.sourceNodeIds.filter(id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id)))].slice(0,500)}:{}),
  ...(typeof t.canvasNodeId==='string'&&/^[\w-]{1,100}$/.test(t.canvasNodeId)?{canvasNodeId:t.canvasNodeId}:{}),
 })):[];
 return {height,tasks};
}

// 工程校验入口：缺省补全、坏数据修复，不抛错（旧工程 / 中途损坏都不阻塞保存）。
export function validateWorkstation(raw){
 const ws=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 return {
  script:typeof ws.script==='string'?ws.script.slice(0,200000):'',
  story:normalizeStory(ws.story),
  writing:normalizeWriting(ws.writing),
  workflow:normalizeWorkflow(ws.workflow),
  creativeTasks:normalizeCreativeTasks(ws.creativeTasks),
  directorAssistant:normalizeDirectorAssistant(ws.directorAssistant),
  assets:normalizeAssets(ws.assets),
  sequence:normalizeSequence(ws.sequence),
  deliver:normalizeDeliver(ws.deliver),
 };
}

// 轨道上的空闲区间（升序，最后一个为 [cursor,∞)）。
export function freeIntervals(track){
 const sorted=[...track].sort((a,b)=>a.start-b.start);
 const free=[];let cursor=0;
 for(const c of sorted){
  if(c.start>cursor)free.push([cursor,c.start]);
  cursor=Math.max(cursor,clipEnd(c));
 }
 free.push([cursor,Infinity]);
 return free;
}

// 放置片段：期望 start 起放，若与已有片段重叠则顺延到第一个可容纳位置。
export function placeClip(track,clip){
 const len=clipLength(clip);
 const sorted=[...track].sort((a,b)=>a.start-b.start);
 let start=Math.max(0,Math.round(clip.start));
 let guard=0;
 while(guard++<=sorted.length+1){
  const clash=sorted.find(c=>start<clipEnd(c)&&start+len>c.start);
  if(!clash)break;
  start=clipEnd(clash);
 }
 return [...sorted,{...clip,start}].sort((a,b)=>a.start-b.start);
}

export function appendClip(track,clip){
 return placeClip(track,{...clip,start:trackEnd(track)});
}

// 移动片段：先移出，再放到「距期望位置最近且放得下」的空闲区间内。
export function moveClip(track,id,newStart){
 const clip=track.find(c=>c.id===id);
 if(!clip)return track;
 const rest=track.filter(c=>c.id!==id);
 const len=clipLength(clip),desired=Math.max(0,Math.round(newStart));
 let best=null;
 for(const [a,b] of freeIntervals(rest)){
  if(b-a<len)continue;
  const s=clampInt(desired,a,b-len);
  const cost=Math.abs(s-desired);
  if(best==null||cost<best.cost)best={start:s,cost};
 }
 if(!best)return track;
 return [...rest,{...clip,start:best.start}].sort((a,b)=>a.start-b.start);
}

// 裁切两端：edge='in' 拖左缘（start/in 同步移动），edge='out' 拖右缘（只改出点）。
// maxOut 传入素材总帧数（无则不限）；与邻居的重叠由边界钳制。
export function trimClip(track,id,edge,delta,{maxOut=Infinity}={}){
 const clip=track.find(c=>c.id===id);
 if(!clip)return track;
 const rest=track.filter(c=>c.id!==id).sort((a,b)=>a.start-b.start);
 const prevEnd=rest.filter(c=>clipEnd(c)<=clip.start).reduce((m,c)=>Math.max(m,clipEnd(c)),0);
 const nextStart=rest.filter(c=>c.start>=clipEnd(clip)).reduce((m,c)=>Math.min(m,c.start),Infinity);
 const d=Math.round(delta);
 let next={...clip};
 if(edge==='in'){
  const start=clampInt(clip.start+d,Math.max(prevEnd,clip.start-clip.in),clipEnd(clip)-1);
  next.start=start;
  next.in=clip.in+(start-clip.start);
 }else{
  const sourceCap=Number.isFinite(maxOut)?clip.start+Math.floor(maxOut)-clip.in:Infinity;
  const end=clampInt(clipEnd(clip)+d,clip.start+1,Math.min(nextStart,sourceCap));
  next.out=clip.in+(end-clip.start);
 }
 if(next.out<=next.in||next.start<prevEnd||clipEnd(next)>nextStart)return track;
 return [...rest,next].sort((a,b)=>a.start-b.start);
}

// 在序列帧 frame 处拆分（严格在片段内部才生效）。
export function splitClip(track,id,frame){
 const clip=track.find(c=>c.id===id);
 if(!clip)return {track,created:null};
 frame=Math.round(frame);
 if(frame<=clip.start||frame>=clipEnd(clip))return {track,created:null};
 const left={...clip,out:clip.in+(frame-clip.start)};
 const right={...clip,id:crypto.randomUUID(),start:frame,in:left.out};
 return {track:[...track.filter(c=>c.id!==id),left,right].sort((a,b)=>a.start-b.start),created:right};
}

// 删除；ripple=true 时后续片段左移闭合空隙（左移不越过各自前一个片段的末尾）。
export function removeClip(track,id,{ripple=false}={}){
 const clip=track.find(c=>c.id===id);
 if(!clip)return track;
 const len=clipLength(clip);
 const rest=track.filter(c=>c.id!==id).sort((a,b)=>a.start-b.start);
 if(!ripple)return rest;
 const removedEnd=clipEnd(clip);
 const shifted=rest.map(c=>c.start>=removedEnd?{...c,start:c.start-len}:c).sort((a,b)=>a.start-b.start);
 // 顺次夹紧：任何移动后的重叠重新压回合法位置。
 let result=[];
 for(const c of shifted){
  if(c.start>=removedEnd){
   const prevEndNow=result.reduce((m,x)=>Math.max(m,clipEnd(x)),0);
   result.push({...c,start:Math.max(c.start,prevEndNow)});
  }else result.push(c);
 }
 return result;
}

// 变更序列帧率：按时间秒数不变换算全部整数帧（入/出至少 1 帧）。
export function refpsSequence(sequence,newFps){
 if(!isSequenceFps(newFps)||Number(newFps)===sequence.fps)return sequence;
 const ratio=Number(newFps)/sequence.fps;
 const mapTrack=track=>{let end=0;return track.map(c=>{
  const inF=Math.round(c.in*ratio);
  const start=Math.max(end,Math.round(c.start*ratio)),out=Math.max(inF+1,Math.round(c.out*ratio));end=start+out-inF;
  return {...c,start,in:inF,out};
 }).sort((a,b)=>a.start-b.start);};
 return {fps:Number(newFps),video:mapTrack(sequence.video),audio:mapTrack(sequence.audio),audioGain:sequence.audioGain??1,audioMuted:sequence.audioMuted===true};
}

// 拖动 / 裁切时吸附到播放头、片段接缝与 0；threshold 单位为序列帧。
export function snapFrame(frame,candidates=[],threshold=2){
 const target=Math.round(frame),limit=Math.max(0,Math.round(threshold));
 let best=null;
 for(const raw of candidates){
  if(!Number.isFinite(Number(raw)))continue;
  const candidate=Math.round(Number(raw)),distance=Math.abs(candidate-target);
  if(distance<=limit&&(best===null||distance<best.distance))best={frame:candidate,distance};
 }
 return best?best.frame:target;
}

export const framesToSeconds=(frames,fps)=>frames/fps;
export const secondsToFrames=(seconds,fps)=>Math.round(seconds*fps);
export function formatTimecode(frames,fps){
 const total=Math.floor(frames/fps),ff=frames%fps,mm=Math.floor(total/60),ss=total%60;
 return String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0')+'.'+String(ff).padStart(2,'0');
}
