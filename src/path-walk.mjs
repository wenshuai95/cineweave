import {positionTimes} from './director.mjs';
import {sampleBaseObject,uid} from './model.mjs';

export function pathWalkRange(o){
 const times=positionTimes(o);if(times.length<2)throw Error('请先在两个不同时间记录位置关键帧');
 const start=times[0],end=times.at(-1);
 if(!times.slice(1).some((b,i)=>[.25,.5,.75].some(u=>pathTravel(o,times[i]+(b-times[i])*u,start,end).moving)))throw Error('路径没有连续位移，请调整位置或将跳切关键帧改为平滑 / 线性');
 return {start,end};
}
export function preferredWalkClip(clips){return clips.find(c=>/^(Adult_Walk|Walk_Loop|walk)$/i.test(c.name))||clips.find(c=>/walk|行走|步行/i.test(c.name)&&!/back|left|right|strafe|_RM/i.test(c.name))}
export function preferredRunClip(clips){return clips.find(c=>/^(Adult_Run|Run_Loop|Run_Fwd_Loop|run)$/i.test(c.name))||clips.find(c=>/run|jog|sprint|奔跑|跑步|慢跑/i.test(c.name)&&!/back|left|right|strafe|shoot|_RM/i.test(c.name))}
export function pathMotionKind(a){return a?.gait||(a?.pose==='run'||/run|jog|sprint|奔跑|跑步|慢跑/i.test(a?.clip||'')?'run':'walk')}
export function overlappingPathActions(o,a){return (o.actions||[]).filter(old=>old.id!==a.id&&old.start<a.end&&old.end>a.start)}
export function preferredIdleClip(clips){return clips.find(c=>/^(Adult_Idle_Neutral|Idle_Loop|idle)$/i.test(c.name))?.name||''}
// Sample inside a single segment to avoid treating a hold-key jump as walking.
export function pathTravel(o,t,start,end){
 const times=[...new Set([start,...positionTimes(o).filter(k=>k>start&&k<end),end])].sort((a,b)=>a-b);
 const at=Math.max(start,Math.min(t,end)),idx=Math.max(0,times.findIndex(k=>k>at)-1);
 const segment=at===end?times.length-2:idx;
 const tangent=(i,at)=>{
  const a=times[i],b=times[i+1],eps=Math.min(.01,(b-a)/100),lo=Math.max(a,Math.min(at-eps,b-2*eps)),hi=Math.min(b-eps,Math.max(at+eps,a+eps));
  const p=sampleBaseObject(o,lo).position,q=sampleBaseObject(o,hi).position,dx=q[0]-p[0],dz=q[2]-p[2];
  return {moving:Math.hypot(dx,dz)>1e-7,yaw:Math.atan2(dx,dz)*180/Math.PI};
 };
 const current=tangent(segment,at);if(current.moving)return current;
 // Keep the last heading while stationary, including at the path's final point.
 for(let i=segment-1;i>=0;i--){const previous=tangent(i,times[i+1]);if(previous.moving)return {...previous,moving:false};}
 for(let i=segment+1;i<times.length-1;i++){const next=tangent(i,times[i]);if(next.moving)return {...next,moving:false};}
 return {moving:false,yaw:sampleBaseObject(o,at).rotation};
}
export function pathWalkActions(o,a,duration,replace=false){
 if(o.locked)throw Error('对象已锁定');
 pathWalkRange(o);
 if(!['actor','model'].includes(o.type)||![a.start,a.end,a.speed,a.headingOffset].every(Number.isFinite)||a.start<0||a.end>duration||a.end<=a.start||a.speed<.1||a.speed>4||Math.abs(a.headingOffset)>180)throw Error('请检查时间、步频（0.1–4）和朝向修正（-180–180°）');
 const result=[];
 for(const old of o.actions||[]){
  if(old.id===a.id)continue;
  if(old.start>=a.end||old.end<=a.start){result.push(old);continue;}
  if(!replace)throw Error('此区间已有动作，请缩短区间或点击“替换重叠动作”');
  if(old.start<a.start)result.push({...old,end:a.start});
  if(old.end>a.end)result.push({...old,id:old.start<a.start?uid():old.id,start:a.end});
 }
 result.push(a);if(result.length>500)throw Error('动作片段已达 500 个');return result.sort((a,b)=>a.start-b.start);
}
