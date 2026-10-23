// Asset image provenance and version linkage.
// Only real source IDs are stored: an image result may point at the asset or
// shot that started it, and at the exact image version the user explicitly
// adopted. Nothing here rewrites videos, clips or submitted tasks.
import {addAssetImageVersions,selectAssetImage} from './asset-images.mjs';
import {getCanvasStoryContext} from './canvas-source.mjs';

const validId=v=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v);
export function sourceFingerprint(value){
 const text=String(value??'');
 let a=2166136261,b=5381;
 for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}
 return `${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}
export function linkedShotAssets(project,shot){
 const assets=project?.workstation?.story?.assets||[],shotIds=new Set(Array.isArray(shot?.assetIds)?shot.assetIds:[]);
 for(const asset of assets)if((Array.isArray(asset.shotIds)?asset.shotIds:[]).includes(shot?.id))shotIds.add(asset.id);
 const byId=new Map(assets.map(asset=>[asset.id,asset]));
 return {assets:[...shotIds].map(id=>byId.get(id)).filter(Boolean),unresolved:[...shotIds].filter(id=>!byId.has(id))};
}
function contextNode(project,node){return node?.type==='image'||node?.type==='text'||node?.type==='actor'||node?.type==='scene'?getCanvasStoryContext(project,node.id):null;}
// The context is derived from the source node, never inferred from whatever
// image happens to be selected in the asset library.
export function imageAssetContext(project,sourceId){
 const node=(project?.nodes||[]).find(item=>item.id===sourceId);
 if(!node)return null;
 const context=contextNode(project,node);
 if(context?.kind==='asset'&&context.asset)return {kind:'asset',sourceNodeId:node.id,assetId:context.asset.id,assetName:context.asset.name};
 if(context?.kind==='image'&&context.asset)return {kind:'asset',sourceNodeId:node.id,assetId:context.asset.id,assetName:context.asset.name,baseVersionId:context.versionId};
 if(context?.kind==='shot'&&context.record){
  const linked=linkedShotAssets(project,context.record);
  return {kind:'shot',sourceNodeId:node.id,shotId:context.record.id,shotScene:context.record.scene||'',assetIds:linked.assets.map(asset=>asset.id),unresolvedAssetIds:linked.unresolved};
 }
 return null;
}
export function generatedImageAssets(project,node){
 const context=node?.imageResultContext;
 if(!context)return [];
 const ids=context.kind==='asset'?[context.assetId]:context.kind==='shot'?(Array.isArray(context.assetIds)?context.assetIds:[]):[];
 const assets=project?.workstation?.story?.assets||[];
 const byId=new Map(assets.map(asset=>[asset.id,asset]));
 return [...new Set(ids)].map(id=>byId.get(id)).filter(Boolean);
}
export function assetShots(project,assetId){
 const asset=(project?.workstation?.story?.assets||[]).find(item=>item.id===assetId);
 if(!asset)return [];
 return (Array.isArray(project?.workstation?.story?.shots)?project.workstation.story.shots:[]).map((shot,index)=>({shot,index}))
  .filter(({shot})=>(Array.isArray(shot.assetIds)?shot.assetIds:[]).includes(assetId)||(Array.isArray(asset.shotIds)?asset.shotIds:[]).includes(shot.id))
  .map(({shot,index})=>({id:shot.id,index,scene:shot.scene||'',description:shot.description||''}));
}
export function currentImageVersion(asset){
 return (asset?.imageVersions||[]).find(version=>version.id===asset.selectedImageId)||null;
}
// Snapshot the exact source identity used for a generation request. Asset image
// nodes store asset+version IDs; other media store a short source fingerprint.
// The snapshot is small, credential-free and survives project save/undo.
export function referenceSnapshotFor(project,references=[]){
 const out=[];
 for(const reference of Array.isArray(references)?references:[]){
  if(!reference?.nodeId||out.some(item=>item.nodeId===reference.nodeId))continue;
  const node=(project.nodes||[]).find(item=>item.id===reference.nodeId);
  if(!node){out.push({nodeId:reference.nodeId,kind:reference.kind,missing:true});continue;}
  const assetId=node.storyImageRef?.assetId;
  out.push({nodeId:node.id,kind:node.type,...(assetId?{assetId,versionId:node.storyImageRef.versionId}:{srcHash:sourceFingerprint(node.src||'')})});
 }
 return out;
}
// Read-only impact summary shown before the official image changes.
export function assetReferenceImpact(project,assetId){
 const asset=(project?.workstation?.story?.assets||[]).find(item=>item.id===assetId);
 if(!asset)throw Error('资产已不存在，请刷新后重试');
 const shots=assetShots(project,assetId);
 const imageNodes=(project.nodes||[]).filter(node=>node.storyImageRef?.assetId===assetId||node.assetImageRef?.assetId===assetId);
 const imageIds=new Set(imageNodes.map(node=>node.id));
 const videoIds=new Set();
 const videos=[];
 for(const node of project.nodes||[]){
  if(node.type!=='video'||!node.src)continue;
  const rawReferences=node.generatedInput?.references,rawSnapshots=node.referenceSnapshot;
  const references=Array.isArray(rawReferences)?rawReferences:Array.isArray(rawSnapshots)?rawSnapshots:[];
  const snapshots=Array.isArray(rawSnapshots)?rawSnapshots:[];
  const linked=references.some(ref=>imageIds.has(ref?.nodeId))||snapshots.some(ref=>ref?.assetId===assetId)||(project.edges||[]).some(edge=>edge.to===node.id&&imageIds.has(edge.from));
  if(!linked)continue;
  videoIds.add(node.id);
  videos.push({id:node.id,title:node.title,generated:!!node.generatedTask,previz:!node.generatedTask&&/白模|预演|previz/i.test(node.title||'')});
 }
 const groupIds=new Set((project.boardGroups||[]).filter(group=>group.videoVersions&&(Array.isArray(group.memberIds)?group.memberIds:[]).some(id=>videoIds.has(id))).map(group=>group.id));
 const mediaIds=new Set((project.nodes||[]).filter(node=>videoIds.has(node.id)).map(node=>node.mediaId).filter(Boolean));
 const clips=(Array.isArray(project.workstation?.sequence?.video)?project.workstation.sequence.video:[]).filter(clip=>groupIds.has(clip.versionGroupId)||videoIds.has(clip.canvasNodeId)||mediaIds.has(clip.assetId));
 const oldVersion=currentImageVersion(asset);
 return {
  asset:{id:asset.id,name:asset.name,kind:asset.kind},
  oldVersion:oldVersion?{id:oldVersion.id,name:oldVersion.name,createdAt:oldVersion.createdAt,width:oldVersion.width,height:oldVersion.height}:null,
  shots,
  videos,
  clips:clips.length,
  // Related shot records always exist in the story source. Videos and clips are
  // only listed; this operation never rewrites their src, cut or task records.
  submittedTasksUnchanged:true
 };
}
function assertContextAllows(node,assetId){
 const context=node?.imageResultContext;
 if(!context)throw Error('这张图片不是从资产或镜头上下文生成的，不能直接加入资产版本');
 if(!['asset','shot'].includes(context.kind))throw Error('图片来源信息不完整，请重新生成');
 if(context.kind==='asset'&&context.assetId!==assetId)throw Error('这张图片属于其他资产，不能改加到当前资产');
 if(context.kind==='shot'&&!(Array.isArray(context.assetIds)?context.assetIds:[]).includes(assetId))throw Error('当前资产不在这个镜头的资产清单中，请重新选择');
}
function adoptionTarget(project,nodeId,assetId){
 const node=(project.nodes||[]).find(item=>item.id===nodeId);
 const asset=(project.workstation?.story?.assets||[]).find(item=>item.id===assetId);
 if(!node||node.type!=='image'||typeof node.src!=='string'||!node.src)throw Error('生成图片节点已移除或没有图片');
 if(!asset)throw Error('资产已不存在，请刷新后重试');
 if(!validId(assetId))throw Error('资产信息不完整，请刷新后重试');
 if(node.storyImageRef&&node.storyImageRef.assetId!==assetId)throw Error('这张图片已经绑定到其他资产，不能改加');
 assertContextAllows(node,assetId);
 return {node,asset};
}
// Resolve the write before touching the media store. The caller reuses the exact
// version already adopted from this node when the image content has not changed;
// publishing it as official is then only a select pointer plus a checkpoint.
// A real content change (or a removed version) returns no version so the caller
// may safely write one new media entry and one new version.
export function planGeneratedImageAdoption(project,{nodeId,assetId,official=false}){
 const {node,asset}=adoptionTarget(project,nodeId,assetId),srcHash=sourceFingerprint(node.src);
 const ref=node.assetImageRef?.assetId===assetId?node.assetImageRef:null;
 const existing=ref&&(Array.isArray(asset.imageVersions)?asset.imageVersions:[]).find(version=>version.id===ref.versionId);
 if(existing){
  const recorded=existing.srcHash||ref.srcHash;
  const sameSource=recorded?recorded===srcHash:node.mediaId?node.mediaId===existing.mediaId:true;
  if(sameSource)return {node,asset,version:existing,reuse:true,official,srcHash};
 }
 return {node,asset,version:null,reuse:false,official,srcHash};
}
// Apply a version the caller has already written to the media store. The old
// versions stay in the asset history; only the official pointer and the image
// node provenance change. No video, clip or task field is touched.
export function applyGeneratedImageToAsset(project,{nodeId,assetId,version,official=false}){
 const {node,asset}=adoptionTarget(project,nodeId,assetId);
 if(!version||!validId(version.id)||!validId(version.mediaId))throw Error('图片版本信息不完整，请重新生成');
 if(version.srcHash&&version.srcHash!==sourceFingerprint(node.src))throw Error('图片内容已变化，请重新加入版本');
 const existing=(Array.isArray(asset.imageVersions)?asset.imageVersions:[]).find(item=>item.id===version.id);
 if(existing&&existing.mediaId!==version.mediaId)throw Error('图片版本编号已存在但内容不同，请重新生成');
 if(!existing)addAssetImageVersions(asset,[version],{selectFirst:false});
 if(official){
  selectAssetImage(asset,version.id);
  // Retired image nodes keep their own version pointer for history and legacy
  // reference checks; imageNodeFor() always prefers the selected version.
  node.storyImageRef={assetId,versionId:version.id};
  node.mediaId=version.mediaId;
 }
 node.assetImageRef={assetId,versionId:version.id,...(version.srcHash||existing?.srcHash?{srcHash:version.srcHash||existing.srcHash}:{})};
 node.assetImageVersionId=version.id;
 return {asset,version,node,official};
}
