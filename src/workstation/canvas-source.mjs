// The workstation remains the single stored source of planning content. Canvas
// provenance binds a view to that content without treating generated media as drafts.
export const SCRIPT_REF_ID='main-script';
const validId=value=>typeof value==='string'&&/^[\w-]{1,100}$/.test(value);
const scriptRef=node=>node?.type==='text'&&!node.storyImageRef&&node.storyRef?.kind==='script'&&node.storyRef.id===SCRIPT_REF_ID;
export const getScriptNode=project=>(project.nodes||[]).find(scriptRef)||null;

// New cards reserve a conservative height because the data layer has no DOM
// measurements. Scan a bounded grid around occupied rectangles, including cards
// a user moved off-grid. Repeated synchronization never calls this for old cards.
export function freeCanvasPosition(project){
 const width=320,height=480,gap=40;
 const occupied=(project.nodes||[]).filter(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)).map(n=>({x:n.x,y:n.y,w:Number.isFinite(n.w)?Math.max(100,n.w):width,h:Number.isFinite(n.h)?Math.max(height,n.h):height}));
 const blocked=(x,y)=>occupied.some(n=>x<n.x+n.w+gap&&x+width+gap>n.x&&y<n.y+n.h+gap&&y+height+gap>n.y);
 for(let row=0;row<=occupied.length*2+1;row++)for(let col=0;col<4;col++){
  const x=60+col*(width+gap),y=60+row*(height+gap);
  if(!blocked(x,y))return {x,y,w:width};
 }
 // Tall imported cards cannot make the search unbounded.
 return {x:60,y:Math.max(60,...occupied.map(n=>n.y+n.h+gap)),w:width};
}

export function storyNodeContent(record,kind,index=0){
 if(kind==='shots'||kind==='shot')return {
  title:`镜头 ${String(index+1).padStart(2,'0')} · ${record.scene||'未命名场景'}`,
  text:[record.description,record.dialogue&&'对白：'+record.dialogue,
   '人物：'+(record.characters||[]).join('、'),
   `时长：${record.duration} 秒 · ${record.shotSize} · ${record.cameraMovement}`
  ].filter(Boolean).join('\n'),
 };
 return {title:record.name||'未命名资产',text:record.prompt||record.description||''};
}

export function ensureScriptNode(project){
 let node=getScriptNode(project);
 if(!node){
  if(project.nodes.length>=500)throw Error('画布节点已达 500 个上限，请删除不需要的节点后创建剧本');
  node={id:crypto.randomUUID(),type:'text',title:'剧本',text:'',...freeCanvasPosition(project),storyRef:{kind:'script',id:SCRIPT_REF_ID}};
  project.nodes.push(node);
 }
 node.text=typeof project.workstation?.script==='string'?project.workstation.script:'';
 connectScriptSources(project);
 return node;
}

export function getCanvasStoryContext(project,nodeId){
 const node=(project.nodes||[]).find(n=>n.id===nodeId);if(!node)return null;
 if(scriptRef(node))return {kind:'script',node,record:null};
 const story=project.workstation?.story;
 if(node.storyImageRef&&node.type==='image'&&!node.storyRef&&validId(node.storyImageRef.assetId)&&validId(node.storyImageRef.versionId)){
  const asset=story?.assets?.find(a=>a.id===node.storyImageRef.assetId);
  if(asset)return {kind:'image',node,record:asset,asset,assetId:asset.id,versionId:node.storyImageRef.versionId};
  return null;
 }
 if(node.storyImageRef)return null;
 const ref=node.storyRef;if(!ref||!validId(ref.id))return null;
 if(ref.kind==='shot'){
  const record=story?.shots?.find(s=>s.id===ref.id);
  return record?{kind:'shot',node,record,shotId:record.id}:null;
 }
 if(ref.kind==='asset'){
  const asset=story?.assets?.find(a=>a.id===ref.id);
  return asset?{kind:'asset',node,record:asset,asset,assetId:asset.id}:null;
 }
 return null;
}

// Never creates nodes, rewrites images, or removes links. Structured shot fields
// remain editable in the planning inspector, not in their composed text summary.
export function syncCanonicalNodes(project){
 let changed=false;
 for(const node of project.nodes||[]){
  const context=getCanvasStoryContext(project,node.id);if(!context||context.kind==='image')continue;
  const content=context.kind==='script'?{text:project.workstation.script||''}:storyNodeContent(context.record,context.kind,context.kind==='shot'?project.workstation.story.shots.indexOf(context.record):0);
  for(const [key,value] of Object.entries(content))if(node[key]!==value){node[key]=value;changed=true;}
 }
 return changed;
}

export function editStoryNode(project,nodeId,patch={}){
 const context=getCanvasStoryContext(project,nodeId);
 if(!context||!['script','asset'].includes(context.kind))throw Error('请在对应的分镜或资产面板中编辑此节点');
 if(patch.text!==undefined&&typeof patch.text!=='string'||patch.title!==undefined&&typeof patch.title!=='string')throw Error('节点内容格式不正确');
 if(context.kind==='script'){
  if(patch.text!==undefined)project.workstation.script=patch.text.slice(0,200000);
  if(patch.title!==undefined)context.node.title=patch.title.slice(0,200)||'剧本';
 }else{
  if(patch.text!==undefined)context.record.prompt=patch.text.slice(0,6000);
  if(patch.title!==undefined)context.record.name=patch.title.slice(0,200);
 }
 syncCanonicalNodes(project);
 return context.node;
}

export function promoteTextToScript(project,nodeId,{replaceConfirmed=false}={}){
 const candidate=(project.nodes||[]).find(n=>n.id===nodeId);
 if(!candidate||candidate.type!=='text'||candidate.storyImageRef||(candidate.storyRef&&!scriptRef(candidate)))throw Error('只能将普通文本节点设为项目剧本');
 const text=typeof candidate.text==='string'?candidate.text.slice(0,200000):'';
 const current=project.workstation?.script||'';
 if(current.trim()&&current!==text&&!replaceConfirmed)throw Error('替换项目剧本需要确认，原有分镜和图片将保留');
 const existing=getScriptNode(project);
 project.workstation.script=text;
 const node=existing||candidate;
 node.storyRef={kind:'script',id:SCRIPT_REF_ID};
 syncCanonicalNodes(project);
 connectScriptSources(project);
 return node;
}

// Only provenance-owned source links can be pruned. A user-made wire with the
// same endpoints stays user-owned and is never silently adopted.
export function connectScriptSources(project,{prune=false}={}){
 const script=getScriptNode(project),desired=new Map();
 if(script)for(const node of project.nodes){
  const context=getCanvasStoryContext(project,node.id);
  if(context?.kind==='shot'||context?.kind==='asset'&&!context.record.shotIds?.length){
   const edge={from:script.id,to:node.id,storySourceLink:true};desired.set(JSON.stringify([edge.from,edge.to]),edge);
  }
 }
 if(prune)project.edges=project.edges.filter(edge=>edge.storySourceLink!==true||desired.has(JSON.stringify([edge.from,edge.to])));
 const existing=new Set(project.edges.map(edge=>JSON.stringify([edge.from,edge.to])));
 for(const [key,edge] of desired)if(!existing.has(key))project.edges.push(edge);
}
