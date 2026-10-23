import {clone,clamp,sampleBaseObject,parameterIds,parameterValue,setParameterValue} from './model.mjs';
import {positionTimes} from './director.mjs';
export const keyRefId=r=>JSON.stringify([r.objectId,r.parameter||null,r.t]);
export function resolveKeyRefs(objects,refs){
 const seen=new Set();return refs.map(r=>{const o=objects.find(o=>o.id===r.objectId),keys=r.parameter?o?.channels?.[r.parameter]:o?.keys,index=keys?.findIndex(k=>Math.abs(k.t-r.t)<.0001);return o&&index>=0?{o,keys,index,ref:{objectId:o.id,parameter:r.parameter||null,t:keys[index].t}}:null;}).filter(hit=>{if(!hit)return false;const id=keyRefId(hit.ref);if(seen.has(id))return false;seen.add(id);return true;});
}
export function moveTimelineKeys(objects,refs,delta,duration,fps){
 const hits=resolveKeyRefs(objects,refs);if(!hits.length)throw Error('请先选择关键帧');
 if(hits.some(h=>h.o.locked))throw Error('选中对象已锁定');
 if(!Number.isFinite(delta))throw Error('无效的时间偏移');
 const min=Math.min(...hits.map(h=>h.ref.t)),max=Math.max(...hits.map(h=>h.ref.t));
 const shift=clamp(Math.round(delta*fps)/fps,Math.ceil((-min-1e-7)*fps)/fps,Math.floor((duration-max+1e-7)*fps)/fps);
 const drafts=new Map(),nextRefs=[];
 for(const hit of hits){if(!drafts.has(hit.o.id))drafts.set(hit.o.id,clone(hit.o));const o=drafts.get(hit.o.id),keys=hit.ref.parameter?o.channels[hit.ref.parameter]:o.keys;keys[hit.index].t=hit.ref.t+shift;nextRefs.push({...hit.ref,t:hit.ref.t+shift});}
 for(const [id,o] of drafts){
  for(const keys of [o.keys,...Object.values(o.channels||{})]){keys.sort((a,b)=>a.t-b.t);if(keys.some((k,i)=>i&&Math.abs(k.t-keys[i-1].t)<.0001))throw Error('目标时间已有关键帧，请换一个位置');}
  const times=positionTimes(o),moved=hits.filter(h=>h.o.id===id&&(!h.ref.parameter||h.ref.parameter.startsWith('position'))),original=objects.find(o=>o.id===id);
  const stillUses=t=>[null,'positionX','positionY','positionZ'].some(parameter=>(parameter?original.channels?.[parameter]||[]:original.keys).some(k=>Math.abs(k.t-t)<.0001&&!moved.some(h=>h.ref.parameter===parameter&&Math.abs(h.ref.t-t)<.0001)));
  for(const h of o.pathHandles||[])if(moved.some(k=>Math.abs(k.ref.t-h.t)<.0001)&&!stillUses(h.t))h.t+=shift;
  o.pathHandles=o.pathHandles?.filter(h=>times.some(t=>Math.abs(t-h.t)<.0001)).sort((a,b)=>a.t-b.t);
  if(o.pathHandles?.some((h,i)=>i&&Math.abs(h.t-o.pathHandles[i-1].t)<.0001))throw Error('目标时间已有贝塞尔手柄，请换一个位置');
 }
 return {objects:objects.map(o=>drafts.get(o.id)||o),refs:nextRefs,delta:shift};
}
export function deleteTimelineKeys(objects,refs,time){
 const hits=resolveKeyRefs(objects,refs);if(!hits.length)throw Error('请先选择关键帧');if(hits.some(h=>h.o.locked))throw Error('选中对象已锁定');
 return objects.map(original=>{
  const chosen=hits.filter(h=>h.o.id===original.id);if(!chosen.length)return original;
  const o=clone(original),state=sampleBaseObject(original,time),selected=(parameter,i)=>chosen.some(h=>h.ref.parameter===parameter&&h.index===i);
  o.keys=o.keys.filter((k,i)=>!selected(null,i));
  if(original.keys.length&&!o.keys.length)for(const id of parameterIds(o))setParameterValue(o,id,parameterValue(state,id));
  for(const [id,keys] of Object.entries(o.channels||{})){
   if(!chosen.some(h=>h.ref.parameter===id))continue;
   o.channels[id]=keys.filter((k,i)=>!selected(id,i));
   if(!o.channels[id].length){const value=parameterValue(state,id);setParameterValue(o,id,value);for(const k of o.keys)setParameterValue(k,id,value);delete o.channels[id];}
  }
  const times=positionTimes(o);if(o.pathHandles)o.pathHandles=o.pathHandles.filter(h=>times.some(t=>Math.abs(t-h.t)<.0001));return o;
 });
}
// Content-space rectangles keep selection correct while the timeline scrolls.
export function keysInBox(candidates,box){return candidates.filter(c=>c.right>=box.left&&c.left<=box.right&&c.bottom>=box.top&&c.top<=box.bottom).map(c=>c.ref)}
