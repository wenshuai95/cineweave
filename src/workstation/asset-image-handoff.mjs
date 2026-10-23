// Resolve the official local image before any canvas mutation or undo checkpoint.
export async function hydrateAssetImages(project,assetIds,mediaStore){
 const chosen=new Set(assetIds),imagesByAssetId={};
 let total=0;
 for(const asset of project.workstation.story.assets){
  if(!chosen.has(asset.id))continue;
  const version=asset.imageVersions?.find(v=>v.id===asset.selectedImageId);
  total+=version?.size||0;
 }
 if(total>80*1024*1024)throw Error('本次正式图片合计超过 80 MB，请分批选择资产送入画布');
 for(const asset of project.workstation.story.assets){
  if(!chosen.has(asset.id)||!asset.selectedImageId)continue;
  const version=asset.imageVersions?.find(v=>v.id===asset.selectedImageId);
  if(!version)throw Error(`「${asset.name}」的正式图片版本缺失，请重新选择`);
  const entry=await mediaStore.get(version.mediaId);
  if(!entry?.blob)throw Error(`「${asset.name}」的本地图片缺失，请重新导入后再送入画布`);
  if(entry.kind!=='image'||entry.mime!==version.mime||entry.blob.size!==version.size||entry.blob.size>20*1024*1024)throw Error(`「${asset.name}」的图片内容与记录不一致，请重新导入`);
  const bytes=new Uint8Array(await entry.blob.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  imagesByAssetId[asset.id]={versionId:version.id,mediaId:version.mediaId,src:`data:${version.mime};base64,${btoa(binary)}`,width:version.width,height:version.height};
 }
 return {imagesByAssetId};
}
