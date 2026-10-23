import {positionTimes} from './director.mjs';
import {sampleObject,addParameterKey} from './model.mjs';
export function pathHandleDefaults(o,t){
 const times=positionTimes(o);if(times.length<2)throw Error('请先在两个不同时间添加位置关键帧');
 const position=sampleObject(o,t).position,previous=times.filter(v=>v<t).at(-1),next=times.find(v=>v>t),old=o.pathHandles?.find(k=>Math.abs(k.t-t)<.0001);
 return {t,in:old?.in||sampleObject(o,previous??t).position.map((v,i)=>(v-position[i])/3),out:old?.out||sampleObject(o,next??t).position.map((v,i)=>(v-position[i])/3)};
}
// Edits are drafted without mutating the saved object, so dragging previews remain undoable.
export function draftPathEdit(o,data,position){
 if(o.locked)throw Error('对象已锁定');if(!['point','in','out'].includes(data.kind)||!Number.isFinite(data.t)||!positionTimes(o).some(t=>Math.abs(t-data.t)<.0001))throw Error('路径点已不存在');
 if(!Array.isArray(position)||position.length!==3||position.some(v=>!Number.isFinite(v)))throw Error('无效的路径坐标');
 const draft=structuredClone(o),limit=v=>Math.max(-1000,Math.min(1000,v));
 if(data.kind==='point')['positionX','positionY','positionZ'].forEach((key,i)=>addParameterKey(draft,key,data.t,limit(position[i])));
 else{const h=draft.pathHandles?.find(k=>Math.abs(k.t-data.t)<.0001);if(!h?.[data.kind])throw Error('曲线手柄已不存在');const anchor=sampleObject(o,data.t).position;h[data.kind]=position.map((v,i)=>limit(v-anchor[i]));}
 return draft;
}
