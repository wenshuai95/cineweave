// 剪辑媒体导入的共享逻辑：类型/大小校验、时长与画面探测、写入媒体库与工程引用。
// 供 shell（文件导入入口）、资产页与剪辑页共用，保证三条入口行为一致。
const MEDIA_TYPES={mp4:['video','video/mp4'],webm:['video','video/webm'],mp3:['audio','audio/mpeg'],wav:['audio','audio/wav'],ogg:['audio','audio/ogg'],m4a:['audio','audio/mp4'],png:['image','image/png'],jpg:['image','image/jpeg'],jpeg:['image','image/jpeg'],webp:['image','image/webp'],gif:['image','image/gif'],avif:['image','image/avif']};
export function classifyImportFile(file){const [kind,mime]=MEDIA_TYPES[String(file.name).split('.').at(-1).toLowerCase()]||[];return kind&&file.size>0&&file.size<=300*1024*1024?{ok:true,kind,mime}:{ok:false,error:`「${file.name}」请使用 MP4 / WebM / MP3 / WAV / OGG / M4A / PNG / JPG / WebP / GIF，单个不超过 300 MB`};}
import {uid} from '../model.mjs';
import {placeClip,trackEnd} from './sequence.mjs';

export const WS_MEDIA_MAX_BYTES=300*1024*1024; // 与导出服务单媒体上限一致

// 用临时 <video>/<audio> 读取时长与画面尺寸；读不到时返回 null 字段，不阻塞导入。
export function probeMediaBlob(blob,kind){
 if(kind==='image')return new Promise(resolve=>{
  const img=new Image();let finished=false,timer;
  const url=URL.createObjectURL(blob);
  const done=extra=>{if(finished)return;finished=true;clearTimeout(timer);img.onload=null;img.onerror=null;URL.revokeObjectURL(url);resolve({durationSec:null,width:img.naturalWidth||null,height:img.naturalHeight||null,...extra});};
  img.onload=()=>done({});img.onerror=()=>done({});img.src=url;timer=setTimeout(()=>done({}),8000);
 });
 return new Promise(resolve=>{
  const el=document.createElement(kind==='video'?'video':'audio');
  el.preload='metadata';el.muted=true;
  let finished=false,timer;
  const done=extra=>{
   if(finished)return;finished=true;clearTimeout(timer);el.onloadedmetadata=null;el.onerror=null;
   const result={durationSec:Number.isFinite(el.duration)&&el.duration>0?Math.round(el.duration*1000)/1000:null,width:el.videoWidth||null,height:el.videoHeight||null,...extra};
   el.removeAttribute('src');try{el.load();}catch{}
   URL.revokeObjectURL(url);resolve(result);
  };
  el.onloadedmetadata=()=>done({});
  el.onerror=()=>done({});
  const url=URL.createObjectURL(blob);
  el.src=url;
  timer=setTimeout(()=>done({}),8000);
 });
}

// 校验 + 探测 + 入库；返回 {added, errors}。不改动工程（由调用方决定 checkpoint 时机）。
export async function importMediaFiles(files,mediaStore){
 const added=[],errors=[];
 for(const file of files){
  const verdict=classifyImportFile(file);
  if(!verdict.ok){errors.push(verdict.error);continue;}
  if(file.size>WS_MEDIA_MAX_BYTES){errors.push(`「${file.name}」超过 300 MB 剪辑媒体上限`);continue;}
  try{
   const probe=await probeMediaBlob(file,verdict.kind);
   const id=uid();
   await mediaStore.put({id,kind:verdict.kind,name:file.name,mime:verdict.mime,createdAt:Date.now(),durationSec:probe.durationSec,width:probe.width,height:probe.height,blob:new Blob([file],{type:verdict.mime})});
   added.push({id,kind:verdict.kind,name:file.name,mime:verdict.mime,size:file.size,durationSec:probe.durationSec,width:probe.width,height:probe.height,createdAt:Date.now()});
  }catch(e){errors.push(`「${file.name}」导入失败：${e.message}`);}
 }
 return {added,errors};
}

export const clipFrames=(asset,fps)=>asset?.durationSec?Math.max(1,Math.floor(asset.durationSec*fps)):Math.max(1,Math.round(fps*2));

// 按素材类型追加到对应轨道末尾；返回是否成功。
export function appendClip(project,assetId,source={}){
 const ws=project.workstation,asset=ws.assets.find(a=>a.id===assetId);
 if(!asset||!['video','audio'].includes(asset.kind))return false;
 const track=asset.kind==='video'?'video':'audio';
 if(ws.sequence[track].length>=200)return false;
 const clip={id:uid(),assetId,start:trackEnd(ws.sequence[track]),in:0,out:clipFrames(asset,ws.sequence.fps),volume:1,muted:false,...source};
 ws.sequence[track]=placeClip(ws.sequence[track],clip);
 return true;
}
