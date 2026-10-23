export const formats={'16:9':{width:1280,height:720},'2.35:1':{width:1410,height:600},'9:16':{width:720,height:1280}};
export const formatFor=o=>formats[o?.aspect]||formats['16:9'];
export function editorVisible(o,objects){const group=objects.filter(x=>!x.hidden&&(x.type==='camera')===(o.type==='camera'));return !o.hidden&&(!group.some(x=>x.solo)||!!o.solo);}
export function toggleSolo(objects,id){
 const target=objects.find(o=>o.id===id);if(!target)return;
 const enable=!target.solo;if(enable)target.hidden=false;
 for(const o of objects)if((o.type==='camera')===(target.type==='camera'))o.solo=enable&&o===target;
}
export function positionTimes(o){return [...new Set([...o.keys.map(k=>k.t),...['positionX','positionY','positionZ'].flatMap(id=>(o.channels?.[id]||[]).map(k=>k.t))])].sort((a,b)=>a-b);}
export function bezierPoint(a,b,out,into,u){return a.map((v,i)=>(1-u)**3*v+3*(1-u)**2*u*(v+(out?.[i]||0))+3*(1-u)*u*u*(b[i]+(into?.[i]||0))+u**3*b[i]);}
export function validPathHandles(value,duration){return Array.isArray(value)&&value.length<=1000&&value.every((k,i)=>k&&Number.isFinite(k.t)&&k.t>=0&&k.t<=duration&&(!i||k.t>value[i-1].t)&&['in','out'].every(side=>k[side]===undefined||Array.isArray(k[side])&&k[side].length===3&&k[side].every(n=>Number.isFinite(n)&&Math.abs(n)<=1000)));}
