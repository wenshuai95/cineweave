import {ensureStoryShotGroup} from '../board-presentation.mjs';
// Planning links never replace media, placement, size or generated results.
import {storyNodeContent,ensureScriptNode,getScriptNode,connectScriptSources,freeCanvasPosition} from './canvas-source.mjs';
const recordsFor=(project,kind)=>kind==='shots'?project.workstation.story.shots:project.workstation.story.assets;
const refKind=kind=>kind==='shots'?'shot':'asset';

function findNode(project,record,kind){
 const matches=node=>node.storyRef?.id===record.id&&node.storyRef.kind===refKind(kind);
 // Legacy nodes without provenance may still use their stored back-reference.
 // An explicitly owned node must never be overwritten by a corrupt back-reference.
 const direct=project.nodes.find(node=>node.id===record.canvasNodeId);
 if(direct&&!direct.storyImageRef&&(!direct.storyRef||matches(direct)))return direct;
 return project.nodes.find(matches);
}

const content=storyNodeContent;

export function isStoryNodeCurrent(record,node,kind,index){
 if(!node)return false;
 const expected=content(record,kind,index);
 return node.title===expected.title&&node.text===expected.text;
}

// Prefer the node that carries the currently selected version. Retired nodes
// keep their own version pointer so legacy reference changes stay derivable.
const imageNodeFor=(project,asset)=>{
 const nodes=project.nodes.filter(node=>!node.storyRef&&node.storyImageRef?.assetId===asset.id);
 return nodes.find(node=>node.storyImageRef.versionId===asset.selectedImageId)||nodes[0];
};
const validImageSource=src=>typeof src==='string'&&src.length<=28*1024*1024&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/\r\n]+={0,2}$/.test(src);
export function isAssetImageCurrent(project,asset){
 const version=asset.imageVersions?.find(v=>v.id===asset.selectedImageId);if(!version)return true;
 const node=imageNodeFor(project,asset);
 return !!node&&node.type==='image'&&node.storyImageRef.versionId===version.id&&node.mediaId===version.mediaId&&validImageSource(node.src);
}
function imagePlans(project,assets,imagesByAssetId){
 const plans=[];
 for(const asset of assets){
  const payload=imagesByAssetId?.[asset.id];if(!payload)continue;
  const version=asset.imageVersions?.find(v=>v.id===asset.selectedImageId);
  if(!version||payload.versionId!==version.id||payload.mediaId!==version.mediaId||!validImageSource(payload.src))throw Error('正式图片尚未就绪，请重新选择图片后重试');
  plans.push({asset,version,src:payload.src,node:imageNodeFor(project,asset)});
 }
 return plans;
}
function capacity(project,batches,images=[]){
 let missing=project.workstation.script?.trim()&&!getScriptNode(project)?1:0;const claimed=new Set();
 for(const [kind,items] of batches){
  for(const record of items){
   const node=findNode(project,record,kind);
   if(!node||claimed.has(node.id))missing++;
   else claimed.add(node.id);
  }
 }
 for(const image of images)if(!image.node||claimed.has(image.node.id))missing++;else claimed.add(image.node.id);
 if(project.nodes.length+missing>500)throw Error('画布节点已达 500 个上限，请减少本次选择');
}

function connectImages(project){
 const {assets,shots}=project.workstation.story,desired=new Map();
 const add=(from,to)=>{if(from&&to&&from!==to)desired.set(JSON.stringify([from,to]),{from,to,assetImageLink:true});};
 for(const asset of assets){
  if(!asset.imageVersions?.some(v=>v.id===asset.selectedImageId))continue;
  const image=imageNodeFor(project,asset);if(!image||image.storyImageRef.versionId!==asset.selectedImageId)continue;
  add(image.id,findNode(project,asset,'assets')?.id);
  for(const shot of shots)if(shot.assetIds.includes(asset.id)||asset.shotIds.includes(shot.id))add(image.id,findNode(project,shot,'shots')?.id);
 }
 project.edges=project.edges.filter(edge=>edge.assetImageLink!==true||desired.has(JSON.stringify([edge.from,edge.to])));
 const existing=new Set(project.edges.map(edge=>JSON.stringify([edge.from,edge.to])));
 for(const [key,edge] of desired)if(!existing.has(key))project.edges.push(edge);
}
// Reuse the same provenance-owned image links after an explicit official image
// adoption. Other edges, videos, clips and task records stay untouched.
export function syncAssetImageLinks(project){connectImages(project);return project;}

function sendImages(project,plans){
 const ids=[];
 for(const plan of plans){
  let node=plan.node;
  if(!node){node={id:crypto.randomUUID(),type:'image',...freeCanvasPosition(project)};project.nodes.push(node);}
  Object.assign(node,{type:'image',title:`${plan.asset.name||'未命名资产'} · 正式图片`,text:plan.version.prompt||plan.asset.prompt||plan.asset.description||'',src:plan.src,mediaId:plan.version.mediaId,storyImageRef:{assetId:plan.asset.id,versionId:plan.version.id}});
  ids.push(node.id);
 }
 return ids;
}

function connect(project,{prune=false}={}){
 const {shots,assets}=project.workstation.story;
 const desired=new Map();
 for(const shot of shots){
  for(const asset of assets){
   if(!shot.assetIds.includes(asset.id)&&!asset.shotIds.includes(shot.id))continue;
   const shotNode=findNode(project,shot,'shots'),assetNode=findNode(project,asset,'assets');
   if(!shotNode||!assetNode||shotNode.id===assetNode.id)continue;
   const edge={from:assetNode.id,to:shotNode.id,storyLink:true};
   desired.set(JSON.stringify([edge.from,edge.to]),edge);
  }
 }
 // Only our explicitly marked planning edges may be retired. Older/manual and
 // generated-reference wires remain untouched, including wires to generated media.
 if(prune)project.edges=project.edges.filter(edge=>edge.storyLink!==true||desired.has(JSON.stringify([edge.from,edge.to])));
 const existing=new Set(project.edges.map(edge=>JSON.stringify([edge.from,edge.to])));
 for(const [key,edge] of desired)if(!existing.has(key))project.edges.push(edge);
}

function send(project,kind,items){
 const records=recordsFor(project,kind),ids=[];
 for(const record of items){
  let node=findNode(project,record,kind);
  if(!node){
   node={id:crypto.randomUUID(),
    type:kind==='shots'?'text':record.kind==='character'?'actor':record.kind==='scene'?'scene':'text',
    ...freeCanvasPosition(project)};
   project.nodes.push(node);
  }
  record.canvasNodeId=node.id;
  Object.assign(node,content(record,kind,records.indexOf(record)));
  node.storyRef={kind:refKind(kind),id:record.id};
  ids.push(node.id);
 }
 return ids;
}

export function sendStoryToCanvas(project,kind,selectedIds,{imagesByAssetId={}}={}){
 const chosen=new Set(selectedIds),items=recordsFor(project,kind).filter(record=>chosen.has(record.id));
 const images=imagePlans(project,kind==='assets'?items:[],imagesByAssetId);
 capacity(project,[[kind,items]],images);
 const script=project.workstation.script?.trim()?ensureScriptNode(project):null;
 const ids=[...(script?[script.id]:[]),...send(project,kind,items),...sendImages(project,images)];
 if(ids.length){connect(project);connectImages(project);connectScriptSources(project);}
 if(kind==='shots')ensureStoryShotGroup(project);
 return ids;
}

export function sendStoryPackageToCanvas(project,{imagesByAssetId={}}={}){
 const story=project.workstation.story,batches=[['shots',story.shots],['assets',story.assets]];
 const images=imagePlans(project,story.assets,imagesByAssetId);
 capacity(project,batches,images);
 const script=project.workstation.script?.trim()?ensureScriptNode(project):null;
 const ids=[...(script?[script.id]:[]),...batches.flatMap(([kind,items])=>send(project,kind,items)),...sendImages(project,images)];
 // Even an empty plan can retire its former automatic edges after records were deleted.
 connect(project,{prune:true});
 connectImages(project);
 connectScriptSources(project,{prune:true});
 ensureStoryShotGroup(project);
 return [...new Set(ids)];
}
