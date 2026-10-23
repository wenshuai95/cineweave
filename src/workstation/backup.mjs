import {validateProject,uid} from '../model.mjs';
// 工作站备份：剪辑媒体存在 IndexedDB Blob 库，工程 JSON 只有 assetId 引用。
// 备份时把引用到的媒体以 base64 一并打包（结构自带 schema 标记），导入时
// 先回写媒体库再校验工程——不会静默丢失新媒体，旧版纯工程 JSON 仍可导入。
export const BACKUP_SCHEMA='aivideo-workstation-backup/1';
const BACKUP_MEDIA_WARN_BYTES=200*1024*1024;
const MAX_BACKUP_BYTES=900*1024*1024,MAX_BACKUP_MEDIA=10000;

// Include local visual assets and their retained story versions, not only clips.
export function projectMediaReferences(project){
 const refs=new Map();
 const add=entry=>{
  if(!entry?.id)return;
  const old=refs.get(entry.id);
  if(old&&(old.kind!==entry.kind||old.mime!==entry.mime||old.size!==entry.size))throw Error('同一媒体引用的类型或大小不一致');
  refs.set(entry.id,entry);
 };
 for(const asset of project?.workstation?.assets||[])add(asset);
 const story=project?.workstation?.story;
 for(const plan of [story,...(story?.versions||[])])for(const asset of plan?.assets||[]){
  for(const image of asset.imageVersions||[])add({...image,id:image.mediaId,kind:'image'});
 }
 if(refs.size>MAX_BACKUP_MEDIA)throw Error('备份引用图片过多，请先整理历史版本');
 return refs;
}

// Base64 转换避免 FileReader：Blob.arrayBuffer 在浏览器与 Node 均可用，测试可直接跑。
const bytesToBase64=bytes=>{
 let binary='';
 for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(binary);
};
const blobToBase64=async blob=>bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
const base64ToBlob=(base64,mime)=>{
 const binary=atob(base64),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new Blob([bytes],{type:mime||'application/octet-stream'});
};

// 组装带媒体的完整备份。mediaStore 缺失（异常环境）时退化为纯工程并打标记。
export async function buildWorkstationBackup(project,mediaStore){
 const backup={schema:BACKUP_SCHEMA,app:'造梦工坊',version:'1.7.0',exportedAt:new Date().toISOString(),project:structuredClone(project),media:[]};
 let bytes=0,missing=0;
 const assets=[...projectMediaReferences(backup.project).values()];
 if(mediaStore){
  for(const asset of assets){
   const entry=await mediaStore.get(asset.id);
   if(!entry){missing++;continue;}
   if(entry.kind!==asset.kind||entry.mime!==asset.mime||entry.size!==asset.size)throw Error('媒体库内容与工程引用不一致');
   bytes+=entry.size;
   if(bytes>MAX_BACKUP_BYTES)throw Error('带媒体备份超过 900 MB，请分批整理素材');
   backup.media.push({id:entry.id,kind:entry.kind,name:entry.name,mime:entry.mime,size:entry.size,durationSec:entry.durationSec??null,width:entry.width??null,height:entry.height??null,createdAt:entry.createdAt,encoding:'base64',data:await blobToBase64(entry.blob)});
  }
 }
 return {backup,mediaBytes:bytes,missingCount:missing,large:bytes>BACKUP_MEDIA_WARN_BYTES};
}

// Import as an independent copy: media IDs must never overwrite other projects.
export async function restoreWorkstationBackup(raw,mediaStore){
 if(!raw||raw.schema!==BACKUP_SCHEMA||!raw.project)throw Error('不是有效的 工作站 备份文件');
 if(!mediaStore)throw Error('此环境缺少本地媒体库，无法恢复备份媒体');
 const project=validateProject(structuredClone(raw.project));
 if(!Array.isArray(raw.media)||raw.media.length>MAX_BACKUP_MEDIA)throw Error('备份媒体列表无效或超过上限');
 const refs=projectMediaReferences(project);
 const mapping=new Map([...refs.keys()].map(id=>[id,uid()]));
 const prepared=[],seen=new Set();let totalBytes=0;
 for(const item of raw.media){
  if(!item||!mapping.has(item.id)||seen.has(item.id)||item.encoding!=='base64'||typeof item.data!=='string')throw Error('备份媒体条目无效');
  const asset=refs.get(item.id);
  if(item.kind!==asset.kind||item.mime!==asset.mime)throw Error('备份媒体类型不一致');
  if(item.data.length>400*1024*1024)throw Error('备份单个媒体超过 300 MB');
  const blob=base64ToBlob(item.data,item.mime);totalBytes+=blob.size;
  if(blob.size!==item.size||blob.size!==asset.size||blob.size>(asset.kind==='image'?20:300)*1024*1024||totalBytes>MAX_BACKUP_BYTES)throw Error('备份媒体大小无效或超过上限');
  seen.add(item.id);prepared.push({...item,id:mapping.get(item.id),blob});
 }
 for(const a of project.workstation.assets)a.id=mapping.get(a.id);
 for(const plan of [project.workstation.story,...project.workstation.story.versions])for(const a of plan.assets){
  for(const image of a.imageVersions||[])image.mediaId=mapping.get(image.mediaId);
 }
 for(const node of project.nodes)if(node.mediaId){
  // A removed candidate may remain embedded on the canvas. It needs no dangling
  // cross-project media ID; the embedded pixels and provenance remain intact.
  if(mapping.has(node.mediaId))node.mediaId=mapping.get(node.mediaId);else delete node.mediaId;
 }
 for(const c of [...project.workstation.sequence.video,...project.workstation.sequence.audio])c.assetId=mapping.get(c.assetId)||uid();
 const written=[];
 try{for(const item of prepared){await mediaStore.put(item);written.push(item.id);}}
 catch(e){for(const id of written)await mediaStore.delete(id).catch(()=>{});throw e;}
 return {project,mediaRestored:prepared.length,mediaTotal:refs.size};
}
