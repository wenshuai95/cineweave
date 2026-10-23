import {poses} from './model.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>finite(n)&&Math.abs(n)<=500);
export function validatePlan(plan,kind,duration,assets=[]){
 if(!plan||typeof plan!=='object')throw Error('模型没有返回可用方案');
 if(kind==='motion'){
  if(!Array.isArray(plan.clips)||plan.clips.length>50||!Array.isArray(plan.waypoints)||plan.waypoints.length>100)throw Error('动作方案结构错误');
  const clips=plan.clips.map(c=>{if(!Object.hasOwn(poses,c.pose)||![c.start,c.end,c.speed].every(finite)||c.start<0||c.end>duration||c.end<=c.start||c.speed<.1||c.speed>4)throw Error('动作区间或速度无效');return {pose:c.pose,start:c.start,end:c.end,speed:c.speed}}).sort((a,b)=>a.start-b.start);
  if(clips.some((c,i)=>i&&c.start<clips[i-1].end))throw Error('动作片段不能重叠');
  const waypoints=plan.waypoints.map(w=>{if(!finite(w.t)||w.t<0||w.t>duration||!vector(w.position)||w.rotation!==undefined&&(!finite(w.rotation)||Math.abs(w.rotation)>3600))throw Error('走位关键帧无效');return {t:w.t,position:w.position,rotation:w.rotation}}).sort((a,b)=>a.t-b.t);
  if(waypoints.some((w,i)=>i&&w.t===waypoints[i-1].t))throw Error('走位时间重复');if(!clips.length&&!waypoints.length)throw Error('方案没有动作或走位');return {clips,waypoints};
 }
 if(!Array.isArray(plan.objects)||!plan.objects.length||plan.objects.length>50)throw Error('场景方案需包含 1–50 个对象');
 return {objects:plan.objects.map(o=>{if(!['actor','box','wall','table','pillar','model'].includes(o.type)||!vector(o.position)||!finite(o.rotation)||Math.abs(o.rotation)>3600||!finite(o.scale)||o.scale<.1||o.scale>20||typeof o.name!=='string'||o.name.length>100||o.type==='model'&&!assets.some(a=>a.id===o.assetId))throw Error('场景对象、资产或坐标无效');return {type:o.type,name:o.name,assetId:o.assetId,position:o.position,rotation:o.rotation,scale:o.scale}})};
}
const motionAliases=[[/欢呼|举手/,'cheer'],[/挥手|招手/,'wave'],[/指向|指着/,'point'],[/跑/,'run'],[/走|行走/,'walk'],[/坐/,'sit'],[/站|停/,'stand']];
const splitMotionPrompt=prompt=>prompt.split(/[，,。；;]|然后|接着/).map(s=>s.trim()).filter(Boolean);
// Partial parse for preview: recognized fragments build a validated plan while
// unrecognized sentences are reported verbatim instead of being silently dropped.
export function localMotionDraft(prompt,position,duration,start=0){
 const parts=splitMotionPrompt(prompt);let t=start;const clips=[],waypoints=[{t:start,position:[...position]}],unrecognized=[];let pos=[...position];
 for(const part of parts){
  const pose=motionAliases.find(([re])=>re.test(part))?.[1];
  if(!pose){unrecognized.push({text:part,reason:'本地规则未识别此句（支持站立、行走、跑步、坐姿、指向、挥手、欢呼）'});continue;}
  const seconds=Number(part.match(/(\d+(?:\.\d+)?)\s*秒/)?.[1]||2),end=Math.min(duration,t+seconds);
  if(end<=t+1e-9){unrecognized.push({text:part,reason:'工程剩余时长不足'});continue;}
  clips.push({pose,start:t,end,speed:1});
  const distance=Number(part.match(/(\d+(?:\.\d+)?)\s*米/)?.[1]||0);
  if(distance){const axis=/左|右/.test(part)?0:/上|下/.test(part)?1:2;const sign=/左|下|前/.test(part)?-1:1;pos=[...pos];pos[axis]+=distance*sign;waypoints.push({t:end,position:pos});}t=end;
 }
 let plan=null,error=null;
 try{plan=clips.length||waypoints.length>1?validatePlan({clips,waypoints},'motion',duration):null}catch(e){error=e.message}
 if(!plan&&!error)error='没有识别到任何动作或走位';
 return {plan,unrecognized,error};
}
export function localMotion(prompt,position,duration,start=0){
 const {plan,unrecognized,error}=localMotionDraft(prompt,position,duration,start);
 if(unrecognized.length)throw Error(`「${unrecognized[0].text}」${unrecognized[0].reason}。复杂描述请用 DeepSeek。`);
 if(!plan)throw Error(error);
 return plan;
}
export function localScene(prompt,assets){
 const categories=[[/人|角色/,'character'],[/汽车|车辆|轿车/,'vehicle'],[/动物|狗|马|牛/,'animal'],[/房|建筑/,'building'],[/树|花园|环境/,'environment']];const objects=[];
 for(const [re,category] of categories)if(re.test(prompt)){const a=assets.find(a=>a.category===category&&a.proportions==='realistic')||assets.find(a=>a.category===category);if(a)objects.push({type:'model',assetId:a.id,name:a.name,position:({character:[0,0,0],vehicle:[4,0,0],animal:[-3,0,0],building:[0,0,-8],environment:[-6,0,-4]})[category],rotation:0,scale:1});else if(category==='character')throw Error('请先加载离线模型库，再规划人物场景');}
 if(/桌/.test(prompt))objects.push({type:'table',name:'桌子',position:[0,0,-2],rotation:0,scale:1});return validatePlan({objects},'scene',120,assets);
}
