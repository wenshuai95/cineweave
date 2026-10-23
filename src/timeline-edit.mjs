import {clone,clamp,parameterIds,parameterValue,setParameterValue,sampleBaseObject,removeParameterKey} from './model.mjs';
import {positionTimes} from './director.mjs';

export const snapTime=(t,fps,duration)=>clamp(Math.round(t*fps)/fps,0,duration);
export function actionTiming(o,id,edge,delta,duration,fps){
 const a=o.actions?.find(a=>a.id===id);if(!a)throw Error('动作片段不存在');
 if(o.locked)throw Error('对象已锁定');
 const previous=Math.max(0,...o.actions.filter(b=>b.id!==id&&b.end<=a.start).map(b=>b.end));
 const next=Math.min(duration,...o.actions.filter(b=>b.id!==id&&b.start>=a.end).map(b=>b.start));
 const step=1/fps,ceil=t=>Math.ceil((t-1e-7)*fps)/fps,floor=t=>Math.floor((t+1e-7)*fps)/fps;
 let start=a.start,end=a.end;
 if(edge==='start')start=clamp(snapTime(a.start+delta,fps,duration),ceil(previous),floor(a.end-step));
 else if(edge==='end')end=clamp(snapTime(a.end+delta,fps,duration),ceil(a.start+step),floor(next));
 else {const shift=clamp(Math.round(delta*fps)/fps,ceil(previous-a.start),floor(next-a.end));start+=shift;end+=shift;}
 return {...a,start,end};
}
function syncHandles(o,oldTime,newTime){
 if(!o.pathHandles)return;
 const times=positionTimes(o),has=t=>times.some(v=>Math.abs(v-t)<.0001);
 const h=o.pathHandles.find(h=>Math.abs(h.t-oldTime)<.0001);
 if(h&&!has(oldTime)&&newTime!==undefined&&!o.pathHandles.some(v=>Math.abs(v.t-newTime)<.0001))h.t=newTime;
 o.pathHandles=o.pathHandles.filter(h=>has(h.t)).sort((a,b)=>a.t-b.t);
}
export function moveTimelineKey(original,parameter,index,t,duration,fps){
 if(original.locked)throw Error('对象已锁定');
 const o=clone(original),keys=parameter?o.channels?.[parameter]:o.keys,k=keys?.[index];
 if(!k)throw Error('关键帧不存在');
 t=snapTime(t,fps,duration);
 if(keys.some((v,i)=>i!==index&&Math.abs(v.t-t)<.0001))throw Error('该位置已有关键帧，请放在其他帧');
 const oldTime=k.t;k.t=t;keys.sort((a,b)=>a.t-b.t);
 syncHandles(o,oldTime,t);return o;
}
export function deleteTimelineKey(original,parameter,index,time){
 if(original.locked)throw Error('对象已锁定');
 const o=clone(original),keys=parameter?o.channels?.[parameter]:o.keys,k=keys?.[index];
 if(!k)throw Error('关键帧不存在');
 const oldTime=k.t,state=sampleBaseObject(o,time);
 if(parameter)removeParameterKey(o,parameter,index,time);
 else {keys.splice(index,1);if(!keys.length)for(const id of parameterIds(o))setParameterValue(o,id,parameterValue(state,id));}
 syncHandles(o,oldTime);return o;
}

// Shared cuts roll both neighbours; gaps trim only the selected shot.
export function shotTiming(project,id,edge,delta){
 if(!['start','end'].includes(edge)||!Number.isFinite(delta))throw Error('无效镜头边界');
 const shots=clone(project.shots).sort((a,b)=>a.start-b.start),i=shots.findIndex(s=>s.id===id),s=shots[i];
 if(!s)throw Error('镜头不存在');
 const locked=s=>project.objects.find(o=>o.id===s.cameraId)?.locked;
 if(locked(s))throw Error('机位已锁定');
 const step=1/project.fps,other=shots[i+(edge==='start'?-1:1)];
 const joined=other&&Math.abs((edge==='start'?other.end:other.start)-s[edge])<1e-7;
 const low=edge==='start'?(joined?other.start+step:other?.end||0):s.start+step;
 const high=edge==='start'?s.end-step:(joined?other.end-step:other?.start??project.duration);
 const min=Math.ceil((low-1e-7)*project.fps)/project.fps,max=Math.floor((high+1e-7)*project.fps)/project.fps;
 if(min>max)throw Error('可调整区间不足一帧');
 const value=clamp(snapTime(s[edge]+delta,project.fps,project.duration),min,max);
 if(joined&&locked(other)&&Math.abs(value-s[edge])>1e-7)throw Error('相邻机位已锁定，无法移动共用剪辑点');
 s[edge]=value;if(joined)other[edge==='start'?'end':'start']=value;
 return shots;
}
