// 工作站工程备份：包含新媒体的 .zip 结构（project.json + media/<assetId>.<ext> + manifest.json）。
// 写入复用 reference-zip 的 STORE 方式（媒体本身已是压缩格式）；读取自带一个
// 仅支持 STORE 条目的最小 ZIP 解析器（本项目生成的备份必然可读）。
import {zipFiles} from '../reference-zip.mjs';

const encoder=new TextEncoder(),decoder=new TextDecoder();
const EXT_BY_MIME={'video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov','audio/mpeg':'mp3','audio/mp3':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/mp4':'m4a','audio/webm':'webm','audio/aac':'aac','audio/flac':'flac','image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
export const mediaFileName=(id,mime)=>id+'.'+(EXT_BY_MIME[mime]||'bin');

// project: 工程对象；media: [{meta:{id,mime,...}, getBlob: async()=>Blob}]
export async function buildWorkstationBackup(project,media){
 const files=[{name:'project.json',data:JSON.stringify(project,null,2)}];
 const manifest=[];
 for(const item of media){
  const blob=await item.getBlob();
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const name='media/'+mediaFileName(item.meta.id,item.meta.mime);
  files.push({name,data:bytes});
  manifest.push({id:item.meta.id,file:name,mime:item.meta.mime,size:bytes.length,kind:item.meta.kind,name:item.meta.name});
 }
 files.push({name:'manifest.json',data:JSON.stringify({schema:'workstation-backup/1',createdAt:new Date().toISOString(),media:manifest},null,2)});
 return {blob:new Blob([zipFiles(files)],{type:'application/zip'}),mediaCount:manifest.length};
}

// 解析 STORE ZIP：返回 [{name, data:Uint8Array}]。检测到压缩条目（方法≠0）直接报错。
export function readStoreZip(buffer){
 const data=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
 if(data.length<22)throw Error('备份文件不完整');
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 // 定位 End Of Central Directory（末尾注释最多 65535 字节）。
 let eocd=-1;
 for(let i=data.length-22;i>=Math.max(0,data.length-22-65535);i--){
  if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
 }
 if(eocd<0)throw Error('不是有效的工作站备份 ZIP');
 const count=view.getUint16(eocd+10,true);
 const centralSize=view.getUint32(eocd+12,true);
 const centralOffset=view.getUint32(eocd+16,true);
 const decoder2=decoder;
 const entries=[];
 let p=centralOffset;
 for(let i=0;i<count;i++){
  if(p+46>data.length||view.getUint32(p,true)!==0x02014b50)throw Error('备份目录损坏');
  const method=view.getUint16(p+10,true);
  if(method!==0)throw Error('备份包含压缩条目，无法读取');
  const compressedSize=view.getUint32(p+20,true);
  const nameLen=view.getUint16(p+28,true),extraLen=view.getUint16(p+30,true),commentLen=view.getUint16(p+32,true);
  const localOffset=view.getUint32(p+42,true);
  const name=decoder2.decode(data.subarray(p+46,p+46+nameLen));
  if(localOffset+30>data.length||view.getUint32(localOffset,true)!==0x04034b50)throw Error('备份数据损坏');
  const lNameLen=view.getUint16(localOffset+26,true),lExtraLen=view.getUint16(localOffset+28,true);
  const start=localOffset+30+lNameLen+lExtraLen;
  if(start+compressedSize>data.length)throw Error('备份数据不完整');
  entries.push({name,data:data.slice(start,start+compressedSize)});
  p+=46+nameLen+extraLen+commentLen;
 }
 if(centralSize&&p-centralOffset>centralSize)throw Error('备份目录损坏');
 return entries;
}

export function parseBackup(entries){
 const projectEntry=entries.find(e=>e.name==='project.json');
 if(!projectEntry)throw Error('备份缺少 project.json');
 let project;
 try{project=JSON.parse(decoder2.decode(projectEntry.data));}catch{throw Error('备份中的工程文件无法解析');}
 const media=[];
 for(const entry of entries){
  if(!entry.name.startsWith('media/'))continue;
  const file=entry.name.slice('media/'.length);
  const id=file.match(/^([\w-]{1,100})\.[a-z0-9]+$/i)?.[1];
  if(!id)continue;
  media.push({id,blob:new Blob([entry.data],{type:'application/octet-stream'}),bytes:entry.data.length});
 }
 let manifest=null;
 const manifestEntry=entries.find(e=>e.name==='manifest.json');
 if(manifestEntry){try{manifest=JSON.parse(decoder2.decode(manifestEntry.data));}catch{}}
 // 用 manifest 里的 mime 重建 Blob 类型；缺失时退回 octet-stream。
 const byId=new Map(media.map(m=>[m.id,m]));
 for(const item of manifest?.media||[]){
  const found=byId.get(item.id);
  if(found&&item.mime&&typeof item.mime==='string')found.blob=new Blob([found.bytes.buffer.slice(found.bytes.byteOffset,found.bytes.byteOffset+found.bytes.length)],{type:item.mime.slice(0,80)});
 }
 return {project,media,manifest};
}
