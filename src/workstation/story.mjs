// Shared, bounded project data. Credentials never belong to this schema.
import {normalizeAssetImages} from './asset-images.mjs';
const str=(v,max=6000)=>typeof v==='string'?v.slice(0,max):'';
const id=v=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v)?v:crypto.randomUUID();
const ids=v=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'&&/^[\w-]{1,100}$/.test(x)))].slice(0,200):[];
export function normalizeStory(raw){
 const s=raw&&typeof raw==='object'?raw:{};
 const shots=[],assets=[],seenShots=new Set(),seenAssets=new Set();
 for(const r of (Array.isArray(s.shots)?s.shots:[]).slice(0,200)){
  if(!r||typeof r!=='object')continue;const key=id(r.id);if(seenShots.has(key))continue;seenShots.add(key);
  shots.push({id:key,scene:str(r.scene,200),characters:(Array.isArray(r.characters)?r.characters:[]).filter(x=>typeof x==='string').slice(0,30).map(x=>str(x,100)),description:str(r.description),dialogue:str(r.dialogue),duration:Number.isFinite(r.duration)?Math.min(600,Math.max(.1,r.duration)):5,shotSize:str(r.shotSize,100),cameraMovement:str(r.cameraMovement,200),assetIds:ids(r.assetIds),...(r.canvasNodeId?{canvasNodeId:id(r.canvasNodeId)}:{})});
 }
 for(const r of (Array.isArray(s.assets)?s.assets:[]).slice(0,300)){
  if(!r||typeof r!=='object'||!['character','scene','prop'].includes(r.kind))continue;const key=id(r.id);if(seenAssets.has(key))continue;seenAssets.add(key);
  const images=normalizeAssetImages(r);
  assets.push({id:key,kind:r.kind,name:str(r.name,200),description:str(r.description),prompt:str(r.prompt),negativePrompt:str(r.negativePrompt,2000),shotIds:ids(r.shotIds),...(r.canvasNodeId?{canvasNodeId:id(r.canvasNodeId)}:{}),...(images.imageVersions.length?images:{})});
 }
 // Retain unresolved links; importing a version must not silently remove them.
 const versions=(Array.isArray(s.versions)?s.versions:[]).slice(-20).filter(x=>x&&typeof x==='object').map(v=>{
  const content=normalizeStory({shots:v.shots,assets:v.assets});return {id:id(v.id),createdAt:Number.isFinite(v.createdAt)?v.createdAt:Date.now(),label:str(v.label,100),script:str(v.script,200000),shots:content.shots,assets:content.assets};
 });
 return {shots,assets,versions};
}
export function snapshotStory(ws,label='手动保存'){
 ws.story=normalizeStory(ws.story);
 const v={id:crypto.randomUUID(),createdAt:Date.now(),label:str(label,100),script:str(ws.script,200000),shots:structuredClone(ws.story.shots),assets:structuredClone(ws.story.assets)};
 ws.story.versions=[...ws.story.versions,v].slice(-20);return v;
}
export function validateStoryOutput(raw,kind,existingShots=[]){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('模型返回的数据结构不正确，请重试或调整要求');
 if(kind==='storyboard'){
  if(!Array.isArray(raw.shots)||!raw.shots.length||raw.shots.length>200)throw Error('分镜数量须为 1–200 个');
  for(const s of raw.shots)if(!s||typeof s.description!=='string'||!s.description.trim()||!Number.isFinite(s.duration)||s.duration<.1||s.duration>600||typeof s.scene!=='string'||!Array.isArray(s.characters))throw Error('模型分镜缺少画面、场景、人物或合法时长，请重新生成');
  return {shots:normalizeStory({shots:raw.shots.map(s=>({...s,id:crypto.randomUUID(),assetIds:[],canvasNodeId:undefined}))}).shots};
 }
 if(!Array.isArray(raw.assets)||!raw.assets.length||raw.assets.length>300)throw Error('资产数量须为 1–300 个');
 const shotIds=new Set(existingShots.map(s=>s.id));
 for(const a of raw.assets)if(!a||!['character','scene','prop'].includes(a.kind)||typeof a.name!=='string'||!a.name.trim()||typeof a.description!=='string'||(a.prompt!==undefined&&(typeof a.prompt!=='string'||!a.prompt.trim()||a.prompt.length>6000))||(a.negativePrompt!==undefined&&(typeof a.negativePrompt!=='string'||a.negativePrompt.length>2000))||(a.shotIds!==undefined&&!Array.isArray(a.shotIds)))throw Error('模型资产缺少类型、名称或说明，请重新生成');
 return {assets:normalizeStory({assets:raw.assets.map(a=>({...a,id:crypto.randomUUID(),canvasNodeId:undefined,imageVersions:undefined,selectedImageId:undefined,shotIds:ids(a.shotIds).filter(x=>shotIds.has(x))}))}).assets};
}
