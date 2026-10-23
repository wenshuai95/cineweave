// Read-only shot production checklist. Every state is derived from the live
// project on each render: story assets and their selected image versions, real
// canvas video nodes, the rough-cut sequence and version snapshots recorded when
// a video was generated. No parallel status table is stored.
import {bundleMemberIds} from './shot-bundles.mjs';
import {sourceFingerprint} from './workstation/asset-image-context.mjs';

const generatedVideo=node=>!!(node?.generatedTask||node?.generatedProvider==='oiioii');
const previzVideo=node=>!generatedVideo(node)&&(/白模|预演|previz/i.test(node?.title||'')||/白模预演|previz/i.test(node?.text||''));
function linkedAssets(project,shot){
 const assets=project?.workstation?.story?.assets||[],ids=new Set(Array.isArray(shot?.assetIds)?shot.assetIds:[]);
 for(const asset of assets)if((Array.isArray(asset.shotIds)?asset.shotIds:[]).includes(shot?.id))ids.add(asset.id);
 const byId=new Map(assets.map(asset=>[asset.id,asset]));
 return {assets:[...ids].map(id=>byId.get(id)).filter(Boolean),unresolved:[...ids].filter(id=>!byId.has(id))};
}
function shotNode(project,shot){
 const direct=(project.nodes||[]).find(node=>node.id===shot?.canvasNodeId&&node.storyRef?.kind==='shot'&&node.storyRef.id===shot.id);
 return direct||(project.nodes||[]).find(node=>node.storyRef?.kind==='shot'&&node.storyRef.id===shot?.id)||null;
}
function normalizeReview(raw){
 const out={versions:{},srcHashes:{},missing:[],at:0};
 if(!raw||typeof raw!=='object')return out;
 for(const [assetId,versionId] of Object.entries(raw.versions||{}))if(/^[\w-]{1,100}$/.test(assetId)&&/^[\w-]{1,100}$/.test(versionId))out.versions[assetId]=versionId;
 for(const [nodeId,hash] of Object.entries(raw.srcHashes||{}))if(/^[\w-]{1,100}$/.test(nodeId)&&typeof hash==='string'&&/^[a-f0-9]{16}$/.test(hash))out.srcHashes[nodeId]=hash;
 if(Array.isArray(raw.missing))out.missing=[...new Set(raw.missing.filter(id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id)))];
 if(Number.isFinite(raw.at)&&raw.at>0)out.at=raw.at;
 return out;
}
function videoReferences(video){
 if(Array.isArray(video?.referenceSnapshot))return video.referenceSnapshot;
 return (video?.generatedInput?.references||[]).map(reference=>({nodeId:reference?.nodeId,kind:reference?.kind,legacy:true}));
}
export function pendingVideoReferenceChanges(project,video){
 const pending=[],review=normalizeReview(video.referenceReview),seen=new Set();
 for(const reference of videoReferences(video)){
  if(!reference?.nodeId||seen.has(reference.nodeId))continue;seen.add(reference.nodeId);
  const node=(project.nodes||[]).find(item=>item.id===reference.nodeId);
  // A missing node and a missing asset share the same review key: the reference
  // node ID. This lets one review acknowledgement clear either kind of loss.
  if(!node){
   if(!review.missing.includes(reference.nodeId))pending.push({videoId:video.id,title:video.title,refNodeId:reference.nodeId,missing:true,reason:'参考节点已移除'});
   continue;
  }
  const assetId=reference.assetId||node.storyImageRef?.assetId;
  if(assetId){
   const asset=(project.workstation?.story?.assets||[]).find(item=>item.id===assetId);
   if(!asset){
    if(!review.missing.includes(reference.nodeId))pending.push({videoId:video.id,title:video.title,refNodeId:reference.nodeId,assetId,missing:true,reason:'参考资产已移除'});
    continue;
   }
   const current=asset.selectedImageId;
   if(!current)continue;
   const recorded=reference.versionId||(reference.legacy?node.storyImageRef?.versionId:undefined);
   // Legacy results have no version snapshot. A version created after the video
   // generation cannot have been its reference, even if the canvas image node
   // was later synchronized to that version.
   if(reference.legacy&&Number.isFinite(video.generatedAt)){
    const currentVersion=(asset.imageVersions||[]).find(version=>version.id===current);
    if(currentVersion?.createdAt&&currentVersion.createdAt>video.generatedAt&&review.versions[assetId]!==current){pending.push({videoId:video.id,title:video.title,refNodeId:node.id,assetId,versionId:recorded||null,currentVersionId:current,reason:'正式图晚于视频生成'});continue;}
   }
   if(recorded&&recorded!==current){
    if(review.versions[assetId]!==current)pending.push({videoId:video.id,title:video.title,refNodeId:node.id,assetId,versionId:recorded,currentVersionId:current,reason:'正式图已更换'});
   }
   continue;
  }
  if(reference.srcHash){
   const currentHash=sourceFingerprint(node.src||'');
   if(reference.srcHash!==currentHash&&review.srcHashes[node.id]!==currentHash)pending.push({videoId:video.id,title:video.title,refNodeId:node.id,reason:'参考素材已更换'});
  }
 }
 return pending;
}
// Call from the project's commit/persist lifecycle, never from the read-only
// checklist derivation. A missing acknowledgement applies to one absence only:
// restoring the reference ends that absence even if its version is unchanged.
// Removing it again must therefore require a fresh acknowledgement.
export function clearRestoredReferenceAcknowledgements(project){
 const nodes=project?.nodes||[],byId=new Map(nodes.map(node=>[node.id,node]));
 const assetIds=new Set((project?.workstation?.story?.assets||[]).map(asset=>asset.id));
 const videos=[];let cleared=0;
 for(const video of nodes){
  if(video.type!=='video'||!Array.isArray(video.referenceReview?.missing)||!video.referenceReview.missing.length)continue;
  const restored=new Set();
  for(const reference of videoReferences(video)){
   const node=byId.get(reference?.nodeId);if(!node)continue;
   const assetId=reference.assetId||node.storyImageRef?.assetId;
   if(!assetId||assetIds.has(assetId))restored.add(node.id);
  }
  const review=normalizeReview(video.referenceReview),missing=review.missing.filter(id=>!restored.has(id));
  if(missing.length===review.missing.length)continue;
  cleared+=review.missing.length-missing.length;
  // Preserve the user's last review time and version/source acknowledgements;
  // recovery is a lifecycle event, not a new confirmation of reference content.
  video.referenceReview={...review,missing};videos.push(video.id);
 }
 return {videos,cleared};
}
function sourceIdsForShot(project,shot){
 const nodes=project.nodes||[],byId=new Map(nodes.map(node=>[node.id,node]));
 // Ownership starts from nodes that explicitly belong to this shot. Shared
 // assets and their images only prove a reference relation, so they are never
 // roots: an asset video generated for shot A must not appear as shot B's video.
 const shotRoots=new Set();
 for(const node of nodes)if(node.storyRef?.kind==='shot'&&node.storyRef.id===shot?.id)shotRoots.add(node.id);
 const own=shotNode(project,shot);if(own)shotRoots.add(own.id);
 const ids=new Set(shotRoots);
 // One hop from the shot to its explicit generation entries. The entries remain
 // the stable roots of their own result/version groups.
 for(const edge of project.edges||[]){
  if(!shotRoots.has(edge.from))continue;
  const target=byId.get(edge.to);
  if(target?.type==='video'&&!target.src)ids.add(target.id);
 }
 // A video wired directly from the shot or its entry is also explicit
 // ownership; a video wired only from a shared asset is not.
 const directRoots=new Set(ids);
 for(const edge of project.edges||[]){
  if(!directRoots.has(edge.from))continue;
  const target=byId.get(edge.to);
  if(target?.type==='video'&&target.src)ids.add(target.id);
 }
 return ids;
}
function shotVideos(project,shot){
 const sourceIds=sourceIdsForShot(project,shot),groups=project.boardGroups||[];
 const bundle=groups.find(group=>group.shotBundle===true&&sourceIds.has(group.shotSourceId));
 const versionGroups=groups.filter(group=>group.videoVersions===true&&sourceIds.has(group.sourceNodeId));
 const ids=new Set();
 if(bundle)for(const id of bundleMemberIds(project,bundle))ids.add(id);
 for(const group of versionGroups)for(const id of (Array.isArray(group.memberIds)?group.memberIds:[]))ids.add(id);
 for(const node of project.nodes||[]){
  if(node.type!=='video'||!node.src)continue;
  if(sourceIds.has(node.generatedSource)){ids.add(node.id);continue;}
  if((project.edges||[]).some(edge=>sourceIds.has(edge.from)&&edge.to===node.id))ids.add(node.id);
 }
 const nodes=(project.nodes||[]).filter(node=>ids.has(node.id)&&node.type==='video'&&node.src);
 return {nodes,bundle,versionGroups};
}
function cutUsage(project,videos){
 const groupIds=new Set(videos.versionGroups.map(group=>group.id));
 const ids=new Set(videos.nodes.map(node=>node.id));
 const mediaIds=new Set(videos.nodes.map(node=>node.mediaId).filter(Boolean));
 const clips=(project.workstation?.sequence?.video||[]).filter(clip=>groupIds.has(clip.versionGroupId)||ids.has(clip.canvasNodeId)||mediaIds.has(clip.assetId));
 return {used:clips.length>0,count:clips.length};
}
export function shotProductionFor(project,shotId){
 const shots=Array.isArray(project?.workstation?.story?.shots)?project.workstation.story.shots:[],index=shots.findIndex(shot=>shot.id===shotId);
 if(index<0)return null;
 const shot=shots[index],node=shotNode(project,shot),linked=linkedAssets(project,shot);
 const official=(linked.assets||[]).filter(asset=>(asset.imageVersions||[]).some(version=>version.id===asset.selectedImageId));
 const missingOfficial=linked.assets.filter(asset=>!official.includes(asset));
 const videos=shotVideos(project,shot);
 const generated=videos.nodes.filter(generatedVideo),previz=videos.nodes.filter(item=>previzVideo(item));
 const plain=videos.nodes.filter(item=>!generatedVideo(item)&&!previzVideo(item));
 const versionGroup=generated.map(item=>videos.versionGroups.find(group=>Array.isArray(group.memberIds)&&group.memberIds.includes(item.id))).find(Boolean)||videos.versionGroups[0]||null;
 const adopted=versionGroup?versionGroup.adoptedNodeId:generated[0]?.id||null;
 const adoptedVideoId=generated.some(item=>item.id===adopted)?adopted:generated[0]?.id||null;
 const cutVideoId=adoptedVideoId||previz[0]?.id||videos.nodes[0]?.id||null;
 const pending=generated.flatMap(video=>pendingVideoReferenceChanges(project,video));
 const cut=cutUsage(project,videos);
 const visualReady=generated.length>0||previz.length>0;
 const statuses={
  assets:linked.unresolved.length?{tone:'warn',text:`关联资产已移除 ${linked.unresolved.length} 项`}:!linked.assets.length?{tone:'warn',text:'未关联资产'}:missingOfficial.length?{tone:'warn',text:`缺 ${missingOfficial.length} 张正式图`}:{tone:'ok',text:`正式图齐 · ${linked.assets.length} 项`},
  visual:generated.length&&previz.length?{tone:'ok',text:`白模已导出 · 生成视频 ${generated.length}`}:previz.length?{tone:'ok',text:`白模已导出 · ${previz.length} 段`}:generated.length?{tone:'ok',text:`生成视频 ${generated.length} 个`}:plain.length?{tone:'info',text:`参考视频 ${plain.length} 段 · 未生成`}:{tone:'warn',text:'缺白模 / 生成视频'},
  cut:cut.used?{tone:'ok',text:`已用于剪辑 · ${cut.count} 段`}:videos.nodes.length?{tone:'info',text:'未加入剪辑'}:{tone:'neutral',text:'暂无视频可入剪辑'},
  review:pending.length?{tone:'warn',text:`${pending.length} 个视频参考待复核`}:generated.length?{tone:'ok',text:'参考无需复核'}:{tone:'neutral',text:'暂无生成参考'}
 };
 const missing=[];
 if(!node)missing.push('未整理到画布');
 if(linked.unresolved.length)missing.push('资产关联已失效');
 else if(!linked.assets.length)missing.push('未关联角色 / 场景 / 道具');
 else if(missingOfficial.length)missing.push(`缺正式图：${missingOfficial.map(asset=>asset.name||'未命名资产').slice(0,3).join('、')}${missingOfficial.length>3?' 等':''}`);
 if(!visualReady)missing.push('缺白模或生成视频');
 if(pending.length)missing.push('正式图或参考已变化，待复核');
 if(visualReady&&!cut.used)missing.push('尚未加入剪辑');
 let next;
 if(linked.unresolved.length)next={action:'edit',label:'修复资产关联'};
 else if(!linked.assets.length)next={action:'edit',label:'关联资产'};
 else if(missingOfficial.length)next={action:'assets',label:'补正式图',assetId:missingOfficial[0].id};
 else if(!node)next={action:'sync',label:'整理到画布'};
 else if(!visualReady)next={action:'generate',label:'导出白模或生成视频'};
 else if(pending.length)next={action:'review',label:'复核参考变更'};
 else if(!cut.used)next={action:'cut',label:'送入剪辑',videoId:cutVideoId};
 else next={action:'locate',label:'查看镜头'};
 return {
  id:shot.id,index,scene:shot.scene||'',description:shot.description||'',shotNodeId:node?.id||null,
  assets:linked.assets.map(asset=>({id:asset.id,name:asset.name,official:official.includes(asset),versionId:asset.selectedImageId||null})),
  unresolvedAssetIds:linked.unresolved,
  videos:{total:videos.nodes.length,generated:generated.map(item=>item.id),previz:previz.map(item=>item.id),plain:plain.map(item=>item.id)},
  versionGroupId:versionGroup?.id||null,adoptedVideoId,cutVideoId,bundleGroupId:videos.bundle?.id||null,
  videoNodes:videos.nodes,
  pending,inCut:cut,visualReady,statuses,missing,next
 };
}
export function shotProductionList(project){
 return (Array.isArray(project?.workstation?.story?.shots)?project.workstation.story.shots:[]).map(shot=>shotProductionFor(project,shot.id)).filter(Boolean);
}
export function shotProductionSummary(project){
 const items=shotProductionList(project);
 return {
  total:items.length,
  missingCanvas:items.filter(item=>!item.shotNodeId).length,
  missingAssets:items.filter(item=>!item.assets.length||item.unresolvedAssetIds.length).length,
  missingOfficial:items.filter(item=>item.assets.some(asset=>!asset.official)).length,
  missingVisual:items.filter(item=>!item.visualReady).length,
  pendingReview:items.filter(item=>item.pending.length).length,
  inCut:items.filter(item=>item.inCut.used).length
 };
}
// Record an explicit review against the current versions. The checklist then
// re-derives from those version IDs; a later image change becomes pending again.
export function reviewShotReferenceChanges(project,shotId){
 const item=shotProductionFor(project,shotId);
 if(!item)throw Error('镜头已移除，请刷新清单');
 let changes=0;const videos=[],assets=project.workstation?.story?.assets||[];
 for(const node of item.videoNodes){
  const pending=pendingVideoReferenceChanges(project,node),review=normalizeReview(node.referenceReview);
  // Clear a stale missing acknowledgement once the node and its asset are back.
  // The same node-ID key is used for a missing node and a missing asset, so a
  // later removal creates a fresh pending item instead of inheriting the old one.
  let cleaned=false;
  for(const reference of videoReferences(node)){
   const referenceNode=(project.nodes||[]).find(item=>item.id===reference?.nodeId);
   if(!referenceNode)continue;
   const assetId=reference.assetId||referenceNode.storyImageRef?.assetId;
   const assetMissing=assetId&&!assets.some(asset=>asset.id===assetId);
   if(!assetMissing&&review.missing.includes(reference.nodeId)){
    review.missing=review.missing.filter(id=>id!==reference.nodeId);cleaned=true;
   }
  }
  if(!pending.length){
   if(cleaned){review.at=Date.now();node.referenceReview=review;videos.push(node.id);}
   continue;
  }
  for(const entry of pending){
   if(entry.missing&&entry.refNodeId){
    if(!review.missing.includes(entry.refNodeId))review.missing.push(entry.refNodeId);
   }else if(entry.currentVersionId&&entry.assetId)review.versions[entry.assetId]=entry.currentVersionId;
   else if(entry.refNodeId){
    const reference=(project.nodes||[]).find(item=>item.id===entry.refNodeId);
    if(reference)review.srcHashes[reference.id]=sourceFingerprint(reference.src||'');
    else if(!review.missing.includes(entry.refNodeId))review.missing.push(entry.refNodeId);
   }
  }
  review.at=Date.now();
  node.referenceReview=review;
  changes+=pending.length;videos.push(node.id);
 }
 return {videos,changes};
}
