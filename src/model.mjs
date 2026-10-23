import {pathTravel} from './path-walk.mjs';
import {sanitizeVideoDraft} from './video-references.mjs';
export const MAX_PROJECT_DURATION=3600;
import {formats,positionTimes,bezierPoint,validPathHandles} from './director.mjs';
import {defaultWorkstation,validateWorkstation} from './workstation/sequence.mjs';
export const uid = () => crypto.randomUUID();
export const clone = v => structuredClone(v);
export const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
export const types = {actor:'角色',box:'方块',wall:'墙体',table:'桌子',pillar:'立柱',camera:'摄影机',model:'模型资产'};
export function object(type, name, pos=[0,0,0], color='#cfaa7c') {
 return {id:uid(),type,name,position:pos,rotation:0,rotationX:0,rotationZ:0,roll:0,scale:1,color,pose:'stand',target:[0,1,0],fov:45,keys:[]};
}
export const poses={stand:'站立',walk:'行走',run:'跑步',sit:'坐姿',point:'指向',wave:'挥手',cheer:'举手欢呼'};
function sampleLegacyObject(o,t) {
 const keys=[...o.keys].sort((a,b)=>a.t-b.t);
 if(!keys.length) return o;
 if(t<=keys[0].t) return {...o,...keys[0]};
 if(t>=keys.at(-1).t) return {...o,...keys.at(-1)};
 const b=keys.find(k=>k.t>t),a=keys[keys.indexOf(b)-1];
 let u=(t-a.t)/(b.t-a.t); if(a.ease==='hold')u=0;else if(a.ease!=='linear')u=u*u*(3-2*u);
 const lerp=(x,y)=>x+(y-x)*u;
 return {...o,position:a.position.map((x,i)=>lerp(x,b.position[i])),rotation:lerp(a.rotation,b.rotation),rotationX:lerp(a.rotationX??o.rotationX??0,b.rotationX??o.rotationX??0),rotationZ:lerp(a.rotationZ??o.rotationZ??0,b.rotationZ??o.rotationZ??0),roll:lerp(a.roll??o.roll??0,b.roll??o.roll??0),scale:lerp(a.scale,b.scale),fov:lerp(a.fov,b.fov),target:a.target.map((x,i)=>lerp(x,b.target[i])),pose:a.pose};
}
export const parameters={
 positionX:{name:'位置 X',field:'position',axis:0,min:-1000,max:1000,step:.1},
 positionY:{name:'位置 Y',field:'position',axis:1,min:-1000,max:1000,step:.1},
 positionZ:{name:'位置 Z',field:'position',axis:2,min:-1000,max:1000,step:.1},
 rotationX:{name:'旋转 X',field:'rotationX',min:-3600,max:3600,step:1},
 rotationZ:{name:'旋转 Z',field:'rotationZ',min:-3600,max:3600,step:1},
 roll:{name:'镜头滚转',field:'roll',min:-3600,max:3600,step:1},
 rotation:{name:'旋转 Y',field:'rotation',min:-3600,max:3600,step:1},
 scale:{name:'比例',field:'scale',min:.1,max:20,step:.1},
 modelTint:{name:'模型颜色',field:'modelTint',kind:'color'},
 color:{name:'标识颜色',field:'color',kind:'color'},
 targetX:{name:'注视点 X',field:'target',axis:0,min:-1000,max:1000,step:.1},
 targetY:{name:'注视点 Y',field:'target',axis:1,min:-1000,max:1000,step:.1},
 targetZ:{name:'注视点 Z',field:'target',axis:2,min:-1000,max:1000,step:.1},
 fov:{name:'视场角 FOV',field:'fov',min:10,max:120,step:1},
 pose:{name:'角色动作',field:'pose',kind:'pose'}
};
export function parameterIds(o){return Object.keys(parameters).filter(id=>id==='modelTint'?o.type==='model':id==='pose'?o.type==='actor':id.startsWith('target')||id==='fov'?o.type==='camera':id==='roll'?o.type==='camera':id.startsWith('rotation')?o.type!=='camera':true)}
// Match the parameters displayed in the inspector's Transform group.
export function transformParameterIds(o){return ['positionX','positionY','positionZ',...(o.type==='camera'?['roll']:['rotationX','rotation','rotationZ','scale'])]}
export function addTransformKey(o,t,ease='smooth'){
 if(o.locked)throw new Error('对象已锁定');
 const ids=transformParameterIds(o);
 for(const id of ids){const keys=o.channels?.[id]??o.keys;if(keys.length>=1000&&!keys.some(k=>Math.abs(k.t-t)<.0001))throw new Error(`${parameters[id].name}已达到 1000 个关键帧`);}
 // Sample once before changing any curve, including legacy and Bézier paths.
 const state=sampleBaseObject(o,t);
 for(const id of ids)addParameterKey(o,id,t,parameterValue(state,id),ease);
}
export function parameterValue(state,id){const d=parameters[id];return d.axis===undefined?(state[d.field]??(id==='modelTint'?'#ffffff':['rotationX','rotationZ','roll'].includes(id)?0:undefined)):state[d.field][d.axis]}
export function setParameterValue(state,id,value){const d=parameters[id];if(d.axis===undefined)state[d.field]=value;else state[d.field][d.axis]=value;}
function sampleChannel(keys,t,kind){
 if(t<=keys[0].t)return keys[0].value;if(t>=keys.at(-1).t)return keys.at(-1).value;
 const index=keys.findIndex(k=>k.t>t),a=keys[index-1],b=keys[index];
 if(a.ease==='hold'||kind==='pose')return a.value;
 let u=(t-a.t)/(b.t-a.t);if(a.ease!=='linear')u=u*u*(3-2*u);
 if(kind==='color'){let hex='#';for(let i=1;i<7;i+=2)hex+=Math.round(parseInt(a.value.slice(i,i+2),16)*(1-u)+parseInt(b.value.slice(i,i+2),16)*u).toString(16).padStart(2,'0');return hex;}
 return a.value+(b.value-a.value)*u;
}
function sampleRawObject(o,t){
 const base=sampleLegacyObject(o,t),s={modelTint:'#ffffff',rotationX:0,rotationZ:0,roll:0,...base,position:[...base.position],target:[...base.target]};
 for(const [id,keys] of Object.entries(o.channels||{}))if(keys.length)setParameterValue(s,id,sampleChannel(keys,t,parameters[id].kind));
 return s;
}
export function sampleBaseObject(o,t){
 const s=sampleRawObject(o,t);if(!o.pathHandles?.length)return s;
 const times=positionTimes(o),i=times.findIndex(v=>v>t);if(i<1)return s;
 const start=times[i-1],end=times[i],a=o.pathHandles.find(k=>Math.abs(k.t-start)<.0001),b=o.pathHandles.find(k=>Math.abs(k.t-end)<.0001);
 if(a?.out||b?.in)s.position=bezierPoint(sampleRawObject(o,start).position,sampleRawObject(o,end).position,a?.out,b?.in,(t-start)/(end-start));
 return s;
}
export function addParameterKey(o,id,t,value=parameterValue(sampleBaseObject(o,t),id),ease='smooth'){
 if(!parameterIds(o).includes(id))throw new Error('该对象不支持此参数');
 o.channels??={};
 // Extract the old curve on first use so adding one parameter key preserves legacy animation.
 if(!o.channels[id])o.channels[id]=o.keys.map(k=>({t:k.t,value:parameterValue({...o,...k},id),ease:parameters[id].kind==='pose'?'hold':k.ease})).sort((a,b)=>a.t-b.t);
 o.channels[id]=o.channels[id].filter(k=>Math.abs(k.t-t)>.0001).concat({t,value,ease:parameters[id].kind==='pose'?'hold':ease}).sort((a,b)=>a.t-b.t);
}
export function editParameters(o,t,values,ease='smooth'){
 for(const [id,value] of Object.entries(values)){
  if(o.channels?.[id]?.length||o.keys.length)addParameterKey(o,id,t,value,ease);
  else setParameterValue(o,id,value);
 }
}
export function removeParameterKey(o,id,index,t){
 const value=parameterValue(sampleBaseObject(o,t),id);o.channels[id].splice(index,1);
 if(!o.channels[id].length){
  // Also clear this parameter's legacy curve, avoiding a surprise reversion to old motion.
  setParameterValue(o,id,value);for(const k of o.keys)setParameterValue(k,id,value);delete o.channels[id];
 }
}
export function sampleObject(o,t){
 const s=sampleBaseObject(o,t),action=['actor','model'].includes(o.type)?(o.actions||[]).find(a=>t>=a.start&&t<a.end):null;
 const result=action?{...s,...(o.type==='model'?{modelClip:action.clip}:{pose:action.pose}),actionTime:action.mode==='hold'?action.holdTime:(t-action.start)*action.speed}:s;
 const latest=action||(o.actions||[]).filter(a=>a.end<=t).sort((a,b)=>b.end-a.end)[0];
 // Hold the completed walk's heading unless a later action or rotation curve takes over.
 const laterRotation=[...(o.channels?.rotation||[]),...o.keys].some(k=>k.t>latest?.end);
 if(latest?.followPath&&latest.mode!=='hold'&&(action||!laterRotation)){
  const travel=pathTravel(o,Math.min(t,latest.end),latest.start,latest.end);
  result.rotation=travel.yaw+(latest.headingOffset||0);
  if(action&&!travel.moving||!action){if(o.type==='model')result.modelClip=latest.idleClip||'';else result.pose='stand';result.actionTime=0;}
 }
 return result;
}
export function frame(o,t,ease='smooth') {
 const s=sampleBaseObject(o,t); return {t,position:[...s.position],rotation:s.rotation,rotationX:s.rotationX,rotationZ:s.rotationZ,roll:s.roll,scale:s.scale,fov:s.fov,target:[...s.target],pose:s.pose,color:s.color,modelTint:s.modelTint,ease};
}
export function addKey(o,k) {o.keys=o.keys.filter(a=>Math.abs(a.t-k.t)>.025).concat(k).sort((a,b)=>a.t-b.t);}
export function activeCamera(p,t) {const shot=[...p.shots].sort((a,b)=>a.start-b.start).find(s=>t>=s.start&&(t<s.end||(t===p.duration&&s.end===p.duration)));return p.objects.find(o=>o.id===shot?.cameraId)||p.objects.find(o=>o.type==='camera');}
export function demoProject() {
 const a=object('actor','林舟 · 主角',[-2,0,0.3],'#ddae73');a.pose='walk';
 addKey(a,frame(a,0));const ak=frame(a,6);ak.position=[.2,0,.3];ak.pose='stand';addKey(a,ak);const ak2={...clone(ak),t:12,pose:'stand'};addKey(a,ak2);
 const b=object('actor','沈青 · 对手',[2,0,-.2],'#81aba6'); b.rotation=-90;
 const c1=object('camera','01 · 建立空间',[7,4,8],'#d9b375'); c1.target=[0,1,0];c1.fov=46;addKey(c1,frame(c1,0));const ck=frame(c1,6);ck.position=[5.5,3,6];addKey(c1,ck);
 const c2=object('camera','02 · 双人中景',[0,2,5],'#d9b375');c2.target=[1,1.2,0];c2.fov=42;
 const c3=object('camera','03 · 侧面特写',[-2,1.8,2.8],'#d9b375');c3.target=[.2,1.35,.3];c3.fov=38;
 const props=[object('table','会面桌',[1,0,-1.7],'#959b9b'),object('wall','背景墙',[0,0,-4],'#747e81'),object('pillar','左立柱',[-5,0,-3],'#a5adaa'),object('pillar','右立柱',[5,0,-3],'#a5adaa')];
 const nodes=[
 {id:uid(),type:'text',title:'雨后会面',text:'EXT. 庭院 · 傍晚\n\n林舟穿过庭院，在旧友面前停下。\n镜头缓慢推进，停留在两人的沉默之间。\n\n01 建立空间 → 02 双人中景 → 03 侧面特写',x:60,y:75,w:290},
 {id:uid(),type:'actor',title:'林舟 · 主角',text:'年轻旅人，寡言。暖色外套。\n从画面左侧走向桌前。',objectId:a.id,x:410,y:55,w:250},
 {id:uid(),type:'actor',title:'沈青 · 对手',text:'等待故人的守望者。灰青色衣装。\n面向林舟，保持静止。',objectId:b.id,x:410,y:330,w:250},
 {id:uid(),type:'scene',title:'庭院 · 傍晚',text:'立柱、长桌、灰色背景墙。\n先确定空间与站位，再设计画面风格。',x:740,y:50,w:290},
 {id:uid(),type:'director',title:'会面 · 3D 预演',text:'双人调度 / 3 个机位 / 12 秒\n打开导演台，设计你的第一个镜头。',x:740,y:345,w:290}
 ];
 return {schema:'jingchang/1',id:uid(),name:'雨后会面',duration:12,fps:24,objects:[a,b,...props,c1,c2,c3],shots:[{id:uid(),cameraId:c1.id,start:0,end:6},{id:uid(),cameraId:c2.id,start:6,end:9},{id:uid(),cameraId:c3.id,start:9,end:12}],nodes,edges:[{from:nodes[0].id,to:nodes[1].id},{from:nodes[0].id,to:nodes[2].id},{from:nodes[1].id,to:nodes[4].id},{from:nodes[2].id,to:nodes[4].id},{from:nodes[3].id,to:nodes[4].id}],board:{x:0,y:0,zoom:.8},ai:{provider:'none',model:'',prompt:'参考预演视频中的人物站位、运动轨迹和相机运动。角色外观与场景风格以参考图为准。'},workstation:defaultWorkstation()};
}
// New projects use offline skinned characters; demoProject remains a legacy fixture for compatibility.
export function starterProject(){
 const p=demoProject(),actors=p.objects.filter(o=>o.type==='actor');
 actors.forEach((o,i)=>{o.type='model';o.name=i?'女演员 · 休闲装':'男演员 · 连帽衫';o.modelSrc='/assets/models/'+(i?'adult-female-casual':'adult-male-casual-hoodie')+'.glb';o.modelSize=i?1.7:1.8;o.modelClip='Adult_Idle_Neutral';if(!i)o.actions=[{id:uid(),clip:'Adult_Walk',start:0,end:6,speed:1}];const n=p.nodes.find(n=>n.objectId===o.id);n.title=o.name;n.text=i?'在庭院等待来访者。':'穿过庭院，走向桌前。';});
 p.nodes.find(n=>n.type==='text').text='EXT. 庭院 · 傍晚\n\n一位来访者穿过庭院，在旧友面前停下。\n镜头缓慢推进，停留在两人的沉默之间。\n\n01 建立空间 → 02 双人中景 → 03 侧面特写';
 return p;
}
export function validateProject(p) {
 const fail=m=>{throw new Error('工程格式错误：'+m)};
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const validId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
 const vec=v=>Array.isArray(v)&&v.length===3&&v.every(n=>finite(n)&&Math.abs(n)<=10000);
 if(!p||p.schema!=='jingchang/1')fail('不支持的版本');
 if(typeof p.name!=='string'||p.name.length>200)fail('名称');
 if(!finite(p.duration)||p.duration<1||p.duration>MAX_PROJECT_DURATION)fail('时长必须为 1–3600 秒');
 if(![24,25,30].includes(p.fps))fail('帧率');
 if(p.groundColor!==undefined&&(typeof p.groundColor!=='string'||!/^#[0-9a-f]{6}$/i.test(p.groundColor)))fail('地面颜色');
 if(!Array.isArray(p.objects)||p.objects.length>300||!Array.isArray(p.nodes)||p.nodes.length>500||!Array.isArray(p.shots)||!Array.isArray(p.edges))fail('项目结构');
 const ids=new Set();
 for(const o of p.objects){
 if(!o||!validId(o.id)||ids.has(o.id)||!types[o.type]||typeof o.name!=='string'||!vec(o.position)||!vec(o.target)||!finite(o.rotation)||!finite(o.scale)||o.scale<=0||!finite(o.fov)||o.fov<10||o.fov>120||!/^#[0-9a-f]{6}$/i.test(o.color)||!Object.hasOwn(poses,o.pose)||!Array.isArray(o.keys)||o.keys.length>1000)fail('场景对象');
 ids.add(o.id);
 for(const state of [o,...o.keys])for(const id of ['rotationX','rotationZ','roll'])if(state[id]!==undefined&&(!finite(state[id])||Math.abs(state[id])>3600))fail('旋转角度');
 if(o.modelColorMode!==undefined&&!['original','tint','solid'].includes(o.modelColorMode))fail('模型颜色模式');
 if(o.modelTint!==undefined&&!/^#[0-9a-f]{6}$/i.test(o.modelTint))fail('模型颜色');
 if(o.previzFacingYaw!==undefined&&(o.type!=='model'||!finite(o.previzFacingYaw)||Math.abs(o.previzFacingYaw)>180))fail('模型正面标定');
 if(o.motionDraft!==undefined&&(!o.motionDraft||typeof o.motionDraft.prompt!=='string'||o.motionDraft.prompt.length>1000||!Number.isInteger(o.motionDraft.duration)||o.motionDraft.duration<1||o.motionDraft.duration>12))fail('文字动作草稿');
 if(o.hidden!==undefined&&typeof o.hidden!=='boolean')fail('显示状态');
 if(o.actorVariant!==undefined&&(o.type!=='actor'||!['adultMale','adultFemale','boy','girl'].includes(o.actorVariant)))fail('人物体型');
 if(o.locked!==undefined&&typeof o.locked!=='boolean'||o.solo!==undefined&&typeof o.solo!=='boolean')fail('锁定 / Solo');
 if(o.aspect!==undefined&&(o.type!=='camera'||!Object.hasOwn(formats,o.aspect)))fail('机位画幅');
 if(o.pathHandles!==undefined&&!validPathHandles(o.pathHandles,p.duration))fail('贝塞尔手柄');
 if(o.type==='model'&&(!o.modelSrc||!/^\/assets\/[a-zA-Z0-9_./-]+\.glb$/.test(o.modelSrc)&&!/^data:model\/gltf-binary;base64,[A-Za-z0-9+/]*={0,2}$/.test(o.modelSrc)||o.modelSrc.includes('..')||!finite(o.modelSize)||o.modelSize<=0||o.modelSize>100))fail('模型资源');

 if(o.channels!==undefined){
  if(!o.channels||typeof o.channels!=='object'||Array.isArray(o.channels))fail('参数动画');
  for(const [id,keys] of Object.entries(o.channels)){
   if(!parameterIds(o).includes(id)||!Array.isArray(keys)||keys.length>1000)fail('参数动画');
   const d=parameters[id];let previous=-1;
   for(const k of keys){
    const validValue=d.kind==='color'?typeof k?.value==='string'&&/^#[0-9a-f]{6}$/i.test(k.value):d.kind==='pose'?Object.hasOwn(poses,k?.value):finite(k?.value)&&k.value>=d.min&&k.value<=d.max;
    if(!k||!finite(k.t)||k.t<0||k.t>p.duration||k.t<=previous||!validValue||!['smooth','linear','hold'].includes(k.ease))fail('参数关键帧');previous=k.t;
   }
  }
 }

 if(o.actions!==undefined){
  if(!['actor','model'].includes(o.type)||!Array.isArray(o.actions)||o.actions.length>500)fail('动作片段');
  const sorted=[...o.actions].sort((a,b)=>a.start-b.start),aids=new Set();
  for(let i=0;i<sorted.length;i++){const a=sorted[i];if(!validId(a.id)||aids.has(a.id)||!finite(a.start)||!finite(a.end)||a.start<0||a.end>p.duration||a.end<=a.start||!(o.type==='model'?typeof a.clip==='string'&&a.clip.length>0&&a.clip.length<=200:Object.hasOwn(poses,a.pose))||!finite(a.speed)||a.speed<.1||a.speed>4||(i&&a.start<sorted[i-1].end))fail('动作片段区间、速度或重叠');if(a.mode!==undefined&&!['play','hold'].includes(a.mode)||a.mode==='hold'&&(o.type!=='model'||!finite(a.holdTime)||a.holdTime<0||a.holdTime>MAX_PROJECT_DURATION||a.followPath===true))fail('动作定格设置');if(a.gait!==undefined&&!['walk','run'].includes(a.gait)||a.followPath!==undefined&&typeof a.followPath!=='boolean'||a.headingOffset!==undefined&&(!finite(a.headingOffset)||Math.abs(a.headingOffset)>180)||a.idleClip!==undefined&&(typeof a.idleClip!=='string'||a.idleClip.length>200))fail('沿路径行走设置');aids.add(a.id);}
 }

 for(const k of o.keys)if(!finite(k.t)||k.t<0||k.t>p.duration||!vec(k.position)||!vec(k.target)||!finite(k.rotation)||!finite(k.scale)||k.scale<=0||!finite(k.fov)||k.fov<10||k.fov>120||!Object.hasOwn(poses,k.pose)||!['smooth','linear','hold'].includes(k.ease))fail('关键帧');
 }
 const nids=new Set();for(const n of p.nodes){if(!n||!validId(n.id)||nids.has(n.id)||!['text','actor','scene','director','image','video','audio','model'].includes(n.type)||typeof n.title!=='string'||typeof n.text!=='string'||!finite(n.x)||!finite(n.y)||!finite(n.w)||n.w<100||n.w>1000)fail('画布节点');if(n.src&&!/^data:(image\/(png|jpeg|webp|gif)|video\/(webm|mp4)|audio\/(mpeg|mp3|wav|x-wav|ogg|mp4|webm));base64,[A-Za-z0-9+/\r\n]*={0,2}$/i.test(n.src))fail('仅支持内嵌图片、视频与音频');if(n.type==='model'&&(!/^data:model\/gltf-binary;base64,[A-Za-z0-9+/]*={0,2}$/.test(n.modelSrc||'')||!finite(n.modelSize)||n.modelSize<.1||n.modelSize>100||!['scene','human','animal','creature'].includes(n.modelKind)))fail('生成模型节点');nids.add(n.id);}
 let scriptSourceCount=0;
 for(const n of p.nodes){
  if(n.videoDraft!==undefined)n.videoDraft=sanitizeVideoDraft(n.videoDraft);
  if(n.promptHistory!==undefined)n.promptHistory=Array.isArray(n.promptHistory)?n.promptHistory.filter(h=>h&&['image','video'].includes(h.kind)&&typeof h.before==='string'&&typeof h.after==='string').slice(-5).map(h=>({kind:h.kind,before:h.before.slice(0,6000),after:h.after.slice(0,6000)})):[];
  if(n.imagePromptDraft!==undefined)n.imagePromptDraft=typeof n.imagePromptDraft==='string'?n.imagePromptDraft.slice(0,6000):'';
  if(n.storyRef!==undefined){const ref=n.storyRef;if(!ref||!['script','shot','asset'].includes(ref.kind)||!validId(ref.id)||n.storyImageRef)fail('创作节点来源');if(ref.kind==='script'&&(ref.id!=='main-script'||n.type!=='text'||++scriptSourceCount>1))fail('项目剧本节点');}
  if(n.storyStandalone!==undefined&&typeof n.storyStandalone!=='boolean')fail('分镜独立显示设置');
  if(n.mediaId!==undefined&&!validId(n.mediaId))fail('媒体引用');
  if(n.storyImageRef!==undefined&&(n.type!=='image'||!n.storyImageRef||!validId(n.storyImageRef.assetId)||!validId(n.storyImageRef.versionId)))fail('资产图片关联');
 }
 for(const e of p.edges)if(!nids.has(e.from)||!nids.has(e.to)||e.from===e.to)fail('连线');
 if(p.boardGroups!==undefined){ // 可选字段：旧工程没有分组时跳过；存在时逐项校验，成员必须是已有节点且不跨组重复。
  if(!Array.isArray(p.boardGroups)||p.boardGroups.length>200)fail('画布分组');
  const gids=new Set(),grouped=new Set(),shotSources=new Set();
  for(const g of p.boardGroups){
   if(!g||!validId(g.id)||gids.has(g.id)||typeof g.name!=='string'||g.name.length>100||!Array.isArray(g.memberIds)||g.memberIds.length>500)fail('画布分组');
   if(g.collapsed!==undefined&&typeof g.collapsed!=='boolean'||g.storyShots!==undefined&&typeof g.storyShots!=='boolean')fail('画布分组显示设置');
   if(g.videoVersions!==undefined&&typeof g.videoVersions!=='boolean'||g.sourceNodeId!==undefined&&!validId(g.sourceNodeId)||g.adoptedNodeId!==undefined&&(!validId(g.adoptedNodeId)||!g.memberIds.includes(g.adoptedNodeId)))fail('镜头版本设置');
   if(g.shotBundle!==undefined&&typeof g.shotBundle!=='boolean'||g.shotSourceId!==undefined&&!validId(g.shotSourceId)||[g.storyShots,g.videoVersions,g.shotBundle].filter(v=>v===true).length>1)fail('镜头分组设置');
   if(g.shotBundle===true){if(!nids.has(g.shotSourceId)||!g.memberIds.includes(g.shotSourceId)&&!p.boardGroups.some(v=>v?.videoVersions===true&&v.sourceNodeId===g.shotSourceId&&Array.isArray(v.memberIds)&&v.memberIds.includes(g.shotSourceId))||shotSources.has(g.shotSourceId))fail('镜头分组来源');shotSources.add(g.shotSourceId);}
   else if(g.shotSourceId!==undefined)fail('镜头分组来源');
   gids.add(g.id);
   for(const id of g.memberIds){if(!nids.has(id)||grouped.has(id))fail('画布分组成员');grouped.add(id)}
  }
 }
 const sorted=[...p.shots].sort((a,b)=>a.start-b.start);for(let i=0;i<sorted.length;i++){const s=sorted[i];if(!finite(s.start)||!finite(s.end)||s.start<0||s.end>p.duration||s.end<=s.start||!p.objects.some(o=>o.id===s.cameraId&&o.type==='camera')||(i&&s.start<sorted[i-1].end))fail('镜头区间重叠或机位不存在');}
 if(!p.objects.some(o=>o.type==='camera'))fail('至少保留一个机位');
 if(!p.board||!finite(p.board.x)||!finite(p.board.y)||!finite(p.board.zoom)||p.board.zoom<.2||p.board.zoom>2)fail('画布视图');
 p.ai={provider:'none',model:typeof p.ai?.model==='string'?p.ai.model:'',prompt:typeof p.ai?.prompt==='string'?p.ai.prompt:''};
 // v1.3.0 工作站字段：剧本 / 媒体资产引用 / 影片序列 / 交付记录。缺省补全、坏数据修复，
 // 旧工程（无 workstation）导入即获得默认值；已有数据经规范化保留，撤销与复制不受影响。
 p.workstation=validateWorkstation(p.workstation);
 return p;
}
export async function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('jingchang-studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveProject(p){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(p,'current');tx.oncomplete=()=>{db.close();res()};tx.onerror=()=>{db.close();rej(tx.error)};});}
export async function loadProject(){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction('projects').objectStore('projects').get('current');r.onsuccess=()=>{db.close();res(r.result)};r.onerror=()=>{db.close();rej(r.error)};});}
