// Planning stores references and bounded metadata; image bytes live in mediaStore.
export const IMAGE_VERSION_LIMIT=20;
export const IMAGE_MAX_BYTES=20*1024*1024;
const validId=v=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v);
const mimes=new Set(['image/png','image/jpeg','image/webp']);
const dimension=v=>Number.isInteger(v)&&v>0&&v<=32768;
function normalizedVersion(v){
 if(!v||typeof v!=='object'||!validId(v.id)||!validId(v.mediaId)||!mimes.has(v.mime)||!Number.isInteger(v.size)||v.size<=0||v.size>IMAGE_MAX_BYTES||!dimension(v.width)||!dimension(v.height))return null;
 return {id:v.id,mediaId:v.mediaId,name:typeof v.name==='string'?v.name.slice(0,200):'未命名图片',mime:v.mime,size:v.size,width:v.width,height:v.height,createdAt:Number.isFinite(v.createdAt)&&v.createdAt>=0?v.createdAt:0,...(typeof v.prompt==='string'?{prompt:v.prompt.slice(0,6000)}:{}),...(typeof v.srcHash==='string'&&/^[a-f0-9]{16}$/.test(v.srcHash)?{srcHash:v.srcHash}:{})};
}
export function normalizeAssetImages(asset){
 const imageVersions=[],seen=new Set();
 for(const raw of (Array.isArray(asset?.imageVersions)?asset.imageVersions:[]).slice(0,IMAGE_VERSION_LIMIT)){
  const v=normalizedVersion(raw);if(!v||seen.has(v.id))continue;seen.add(v.id);imageVersions.push(v);
 }
 return {imageVersions,...(imageVersions.some(v=>v.id===asset?.selectedImageId)?{selectedImageId:asset.selectedImageId}:{})};
}
export function addAssetImageVersions(asset,candidates,{selectFirst=true}={}){
 if(!asset||!Array.isArray(candidates)||!candidates.length)throw Error('请选择要导入的图片');
 const current=normalizeAssetImages(asset),added=[],seen=new Set(current.imageVersions.map(v=>v.id));
 if(current.imageVersions.length+candidates.length>IMAGE_VERSION_LIMIT)throw Error(`每项资产最多保留 ${IMAGE_VERSION_LIMIT} 个图片版本，请先移除不需要的版本`);
 for(const raw of candidates){
  const v=normalizedVersion({...raw,id:raw?.id??crypto.randomUUID(),createdAt:raw?.createdAt??Date.now()});
  if(!v)throw Error('图片版本信息不完整或格式不支持');
  if(seen.has(v.id))throw Error('图片版本 ID 重复，请重新导入');
  seen.add(v.id);added.push(v);
 }
 asset.imageVersions=[...current.imageVersions,...added];
 if(current.selectedImageId)asset.selectedImageId=current.selectedImageId;
 else if(selectFirst)asset.selectedImageId=added[0].id;
 else delete asset.selectedImageId;
 return added;
}
export function selectAssetImage(asset,versionId){
 const version=normalizeAssetImages(asset).imageVersions.find(v=>v.id===versionId);
 if(!version)throw Error('此图片版本已不存在，请刷新后重试');
 asset.selectedImageId=version.id;return version;
}
export function removeAssetImageVersion(asset,versionId){
 const current=normalizeAssetImages(asset),removed=current.imageVersions.find(v=>v.id===versionId);
 if(!removed)throw Error('此图片版本已不存在，请刷新后重试');
 asset.imageVersions=current.imageVersions.filter(v=>v.id!==versionId);
 if(current.selectedImageId===versionId){if(asset.imageVersions.length)asset.selectedImageId=asset.imageVersions[0].id;else delete asset.selectedImageId;}
 // Do not delete media bytes: history, undo and canvas may still reference them.
 return removed;
}
export async function validateImageFile(file){
 if(!file||typeof file.slice!=='function'||!Number.isInteger(file.size)||file.size<=0)throw Error('图片文件为空或无法读取');
 if(file.size>IMAGE_MAX_BYTES)throw Error('单张图片不能超过 20 MB');
 const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
 let mime='';
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))mime='image/png';
 else if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
 else if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')mime='image/webp';
 if(!mime)throw Error('仅支持 PNG、JPEG 和 WebP 图片，请先从 Blender 导出为这些格式');
 if(file.type&&file.type!==mime&&file.type!=='application/octet-stream')throw Error('图片内容与文件格式不一致，请重新导出');
 return mime;
}
