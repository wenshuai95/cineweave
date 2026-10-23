export function adjacentKeyTime(object,time,direction){
 const times=[...object.keys,...Object.values(object.channels||{}).flat()].map(k=>k.t).filter(Number.isFinite);
 return adjacentFromTimes(times,time,direction);
}
// 参数级前后关键帧：只看该参数自己的通道（重复时间与浮点误差在排序前去重/容差）。
export function adjacentParameterKeyTime(object,parameter,time,direction){
 if(parameter===null)return adjacentKeyTime(object,time,direction);
 const times=(object?.channels?.[parameter]||[]).map(k=>k.t).filter(Number.isFinite);
 return adjacentFromTimes(times,time,direction);
}
function adjacentFromTimes(times,time,direction){
 const sorted=[...new Set(times)].sort((a,b)=>a-b);
 return direction<0?sorted.filter(t=>t<time-1e-6).at(-1)??null:sorted.find(t=>t>time+1e-6)??null;
}
// 播放推进：非循环在结尾停止；循环按取余回到开头继续。导出走独立计时不经过这里。
export function advancePlayTime(time,dt,duration,loop){
 const t=Number.isFinite(time)?Math.max(0,time):0,d=Number.isFinite(dt)?Math.max(0,dt):0,total=Number.isFinite(duration)?Math.max(0,duration):0;
 const next=t+d;
 if(next<total)return {time:next,playing:true};
 if(loop&&total>0)return {time:next%total,playing:true};
 return {time:total,playing:false};
}
export function timeAtPointer(x,rect,duration,fps){return Math.max(0,Math.min(duration,Math.round((x-rect.left)/Math.max(1,rect.width)*duration*fps)/fps))}
export function frameTimecode(time,fps){const frames=Math.round(time*fps),f=frames%fps,seconds=Math.floor(frames/fps);return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60,f].map(n=>String(n).padStart(2,'0')).join(':')}
export function installPlayheadScrub(host,ruler,{duration,fps,getTime,setTime,onStart=()=>{},onFinish=()=>{},enabled=()=>true,win=window,raf=requestAnimationFrame,caf=cancelAnimationFrame}={}){
 ruler.onpointerdown=e=>{
  if(!enabled()||e.button!==0||e.target.closest('button')&&!e.target.closest('.timeline-cursor'))return;
  e.preventDefault();e.stopPropagation();const before=getTime();let x=e.clientX,closed=false,frame=0;
  const seek=()=>setTime(timeAtPointer(x,ruler.getBoundingClientRect(),duration,fps),false);
  const cleanup=()=>{caf(frame);for(const [event,handler] of [['pointermove',move],['pointerup',up],['pointercancel',cancel],['blur',cancel],['keydown',key]])win.removeEventListener(event,handler);ruler.removeEventListener('lostpointercapture',cancel);if(ruler.hasPointerCapture?.(e.pointerId))ruler.releasePointerCapture(e.pointerId);};
  const finish=restore=>{if(closed)return;closed=true;cleanup();if(restore)setTime(before,false);onFinish()};
  const cancel=()=>finish(true),up=ev=>{if(ev.pointerId===e.pointerId)finish(false)},key=ev=>{if(ev.key==='Escape'){ev.preventDefault();cancel()}},move=ev=>{if(ev.pointerId!==e.pointerId)return;x=ev.clientX;seek()};
  const tick=()=>{if(closed)return;const r=host.getBoundingClientRect(),left=host.scrollLeft;if(x<r.left+140)host.scrollLeft-=12;else if(x>r.right-24)host.scrollLeft+=12;if(left!==host.scrollLeft)seek();frame=raf(tick)};
  onStart(cancel);seek();ruler.setPointerCapture(e.pointerId);for(const [event,handler] of [['pointermove',move],['pointerup',up],['pointercancel',cancel],['blur',cancel],['keydown',key]])win.addEventListener(event,handler);ruler.addEventListener('lostpointercapture',cancel);frame=raf(tick);
 };
}
