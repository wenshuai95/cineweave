// 工作站资产登记：File / 画布节点 data URL → IndexedDB Blob 媒体 + 元数据。
// 元数据同时写入工程 p.workstation.assets（仅描述信息，不含媒体字节）。
import {uid} from '../model.mjs';

export const WORKSTATION_MAX_BYTES=512*1024*1024;
export const WS_MEDIA_KINDS={'video/mp4':'video','video/webm':'video','video/quicktime':'video','audio/mpeg':'audio','audio/mp3':'audio','audio/wav':'audio','audio/x-wav':'audio','audio/ogg':'audio','audio/mp4':'audio','audio/webm':'audio','audio/aac':'audio','audio/flac':'audio','image/png':'image','image/jpeg':'image','image/webp':'image','image/gif':'image'};
const EXTENSION_MIMES={mp4:'video/mp4',m4v:'video/mp4',webm:'video/webm',mov:'video/quicktime',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',oga:'audio/ogg',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'};

export function classifyWorkstationFile(file){
 const name=String(file?.name??''),mime=String(file?.type??'').toLowerCase(),size=Number(file?.size);
 const ext=(name.match(/\.([A-Za-z0-9]+)$/)?.[1]||'').toLowerCase();
 const resolved=WS_MEDIA_KINDS[mime]?mime:(['','application/octet-stream','application/binary'].includes(mime)&&EXTENSION_MIMES[ext])||null;
 const kind=resolved?WS_MEDIA_KINDS[resolved]:null;
 if(!kind)return {ok:false,error:`「${name||'未命名文件'}」不是工作站支持的 MP4 / WebM / 音频 / 图片`};
 if(!Number.isFinite(size)||size<0)return {ok:false,error:`「${name}」无法读取文件大小`};
 if(size>WORKSTATION_MAX_BYTES)return {ok:false,error:`「${name}」超过 512 MB 工作站上限`};
 return {ok:true,kind,mime:resolved};
}

// 读取视频 / 音频元数据（时长秒、像素）。失败不阻塞导入，仅缺省。
export function probeMedia(url,kind){
 return new Promise(resolve=>{
  const done=value=>{cleanup();resolve(value);};
  const cleanup=()=>{
   clearTimeout(timer);
   el.removeEventListener('loadedmetadata',onMeta);
   el.removeEventListener('error',onError);
   if(!usedAsSource)el.removeAttribute('src');
  };
  const el=document.createElement(kind==='video'?'video':'audio');
  let usedAsSource=false;
  const timer=setTimeout(()=>done({}),15000);
  const onMeta=()=>{
   const base={durationSec:el.duration&&Number.isFinite(el.duration)?el.duration:null};
   if(kind==='video'&&el.videoWidth)base.width=el.videoWidth,base.height=el.videoHeight;
   done(base);
  };
  const onError=()=>done({});
  el.preload='metadata';
  el.addEventListener('loadedmetadata',onMeta);
  el.addEventListener('error',onError);
  el.src=url;usedAsSource=true;
 });
}

export async function registerBlob(store,blob,{kind,name,mime}){
 const id=uid();
 const url=URL.createObjectURL(blob);
 let meta={};
 try{meta=kind==='image'?{}:await probeMedia(url,kind);}catch{}
 URL.revokeObjectURL(url);
 const record=await store.put({id,blob,kind,name:String(name||'未命名素材').slice(0,200),mime,...(meta.durationSec?{durationSec:meta.durationSec}:{}),...(meta.width?{width:meta.width,height:meta.height}:{})});
 const {blob:omit,...saved}=record;
 return saved;
}

export async function registerFile(store,file){
 const verdict=classifyWorkstationFile(file);
 if(!verdict.ok)return {error:verdict.error};
 const meta=await registerBlob(store,file,{kind:verdict.kind,name:file.name,mime:verdict.mime});
 return {meta};
}

// 画布媒体节点（data URL）→ 工作站资产；返回登记元数据或错误。
export async function registerDataURL(store,dataUrl,{kind,name}){
 if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:'))return {error:'画布节点没有可登记的媒体数据'};
 const match=dataUrl.match(/^data:([^;,]+);base64,(.*)$/s);
 if(!match)return {error:'画布节点媒体格式不受支持'};
 const binary=atob(match[2]);
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const blob=new Blob([bytes],{type:match[1]});
 if(blob.size>WORKSTATION_MAX_BYTES)return {error:'画布媒体超过 512 MB，无法登记到工作站'};
 const meta=await registerBlob(store,blob,{kind,name:name||'画布媒体',mime:match[1]});
 return {meta};
}

// 工程内登记（p.workstation.assets 元数据追加，去重按 id）。
export function upsertAssetMeta(project,meta){
 if(!meta||typeof meta.id!=='string')return false;
 const list=project.workstation.assets;
 const index=list.findIndex(a=>a.id===meta.id);
 const entry={id:meta.id,kind:meta.kind,name:meta.name,mime:meta.mime,size:meta.size,createdAt:meta.createdAt||Date.now(),...(meta.durationSec?{durationSec:meta.durationSec}:{}),...(meta.width?{width:meta.width,height:meta.height}:{})};
 if(index>=0)list[index]=entry;else list.push(entry);
 return true;
}

export function assetKindLabel(kind){return {video:'视频',audio:'音频',image:'图片'}[kind]||'素材';}
export function formatBytes(n){
 if(!Number.isFinite(n))return '—';
 if(n<1024)return n+' B';
 if(n<1024*1024)return (n/1024).toFixed(1)+' KB';
 if(n<1024*1024*1024)return (n/1024/1024).toFixed(1)+' MB';
 return (n/1024/1024/1024).toFixed(2)+' GB';
}
