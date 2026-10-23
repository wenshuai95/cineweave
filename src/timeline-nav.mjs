// 时间轴横向导航：缩放档位、刻度密度、缩放锚点、全览/细节切换、Shift+滚轮与中键平移。
// 宿主元素的滚动位置属于 #tracks 自身，重绘子节点后浏览器可能按新内容收窄，
// 因此 renderTracks 需在重建前后调用 save/restoreTimelineScroll。

export const TIMELINE_ZOOM_MIN=1,TIMELINE_ZOOM_MAX=12;
export const TIMELINE_ZOOM_LEVELS=[1,1.5,2,3,4,6,8,12];
export const TICK_STEPS=[.1,.2,.25,.5,1,2,5,10,15,30,60];

export function clampTimelineZoom(z){return Math.min(TIMELINE_ZOOM_MAX,Math.max(TIMELINE_ZOOM_MIN,z))}

export function stepTimelineZoom(current,dir){
 const z=clampTimelineZoom(current);
 let i=TIMELINE_ZOOM_LEVELS.findIndex(v=>v>=z-1e-9);
 if(i<0)i=TIMELINE_ZOOM_LEVELS.length-1;
 return TIMELINE_ZOOM_LEVELS[Math.min(TIMELINE_ZOOM_LEVELS.length-1,Math.max(0,i+(dir>0?1:dir<0?-1:0)))];
}

// 旧的比例换算：内容按倍率伸展时保持左侧时间不动（不含固定标签列的近似）。
// 仅在没有尺区几何信息时作为回退路径。
export function scaledScroll(scrollLeft,nextZoom,prevZoom){
 if(!Number.isFinite(scrollLeft)||!prevZoom)return 0;
 return Math.max(0,Math.round(scrollLeft*nextZoom/prevZoom));
}

// 读取尺区（时间车道）在内容坐标里的位置与宽度：offsetLeft 已含宿主内边距，
// 车道左侧的固定标签列不随缩放变化，锚点换算必须把它扣掉。
export function defaultTimelineMetrics(host){
 try{
  const ruler=typeof host?.querySelector==='function'?host.querySelector('.timeline-ruler'):null;
  if(ruler&&Number.isFinite(ruler.offsetLeft)&&Number.isFinite(ruler.offsetWidth)&&ruler.offsetWidth>0)
   return {left:ruler.offsetLeft,width:ruler.offsetWidth};
 }catch{}
 return null;
}

export function clampTimelineScroll(host,value){
 const max=Math.max(0,(host.scrollWidth||0)-(host.clientWidth||0));
 return Math.max(0,Math.min(max,Math.round(value)));
}

export function timelineTickStep(duration,zoom=1,columns=12){
 const d=Math.max(.0001,Number.isFinite(duration)?duration:1),z=clampTimelineZoom(zoom||1);
 const raw=d/(z*columns);
 for(const s of TICK_STEPS)if(s>=raw-1e-9)return s;
 return TICK_STEPS[TICK_STEPS.length-1];
}

export function timelineTicks(duration,zoom=1){
 const step=timelineTickStep(duration,zoom),out=[];
 for(let i=0;;i++){
  const t=i*step;
  if(t>duration+1e-6)break;
  out.push({t,label:`${+t.toFixed(2)}s`});
 }
 return out;
}

export function saveTimelineScroll(host){
 if(!host)return null;
 return {left:host.scrollLeft||0,top:host.scrollTop||0};
}

export function restoreTimelineScroll(host,saved){
 if(!host||!saved)return;
 host.scrollLeft=saved.left||0;
 host.scrollTop=saved.top||0;
}

// Shift+滚轮转为横向滚动；未按 Shift 时交还浏览器原生行为（纵向滚动 / 触控板横滚）。
export function timelineWheelScroll(host,e){
 if(!e.shiftKey)return false;
 const d=(e.deltaY||0)+(e.deltaX||0);
 if(!d)return false;
 host.scrollLeft+=d;
 return true;
}

export function createTimelineNav(host,{onZoom=()=>{},body,win,metrics=defaultTimelineMetrics,anchorClientX=null}={}){
 const bodyEl=body||(typeof document!=='undefined'?document.body:{classList:{add(){},remove(){}}});
 const winEl=win||(typeof window!=='undefined'?window:null);
 let zoom=1,pan=null,fitMemory=null;
 const apply=()=>{host.style.setProperty('--tl-zoom',String(zoom));onZoom(zoom)};
 const lane=()=>{
  try{const m=metrics?.(host);if(m&&Number.isFinite(m.left)&&Number.isFinite(m.width)&&m.width>0)return {left:m.left,width:m.width};}catch{}
  return null;
 };
 const hostRect=()=>{try{const r=host.getBoundingClientRect();return r&&r.width?r:null;}catch{return null}};
 // 计算锚点（clientX 屏幕坐标）当前对应的车道时间占比，缩放后把同一时间放回同一屏幕位置。
 const anchorFraction=clientX=>{
  const m=lane(),rect=hostRect();
  if(m&&rect&&Number.isFinite(clientX))return {frac:(host.scrollLeft+clientX-rect.left-m.left)/m.width,px:clientX-rect.left};
  return null;
 };
 const setZoom=(next,{anchor=true,resetScroll=false,clientX=null}={})=>{
  const nz=clampTimelineZoom(next);
  if(nz===zoom&&!resetScroll)return;
  const prev=zoom,left=host.scrollLeft;
  let keep=null;
  if(anchor&&!resetScroll){
   let ax=clientX;
   if(ax==null&&typeof anchorClientX==='function')ax=anchorClientX();
   if(ax==null){const r=hostRect();if(r)ax=r.left+r.width/2;}
   keep=ax!=null?anchorFraction(ax):null;
  }
  zoom=nz;
  // Expand content before scrolling: browsers clamp scrollLeft against its current width.
  apply();
  if(resetScroll){host.scrollLeft=0;return;}
  // 锚点保持：缩放后 scrollLeft' = 车道左缘 + frac*新车道宽 - 锚点屏幕偏移，
  // 使锚点时间仍在同一屏幕位置；再按内容宽度做边缘限幅。
  if(keep){const m1=lane();if(m1){host.scrollLeft=clampTimelineScroll(host,m1.left+keep.frac*m1.width-keep.px);return;}}
  host.scrollLeft=anchor&&prev?scaledScroll(left,nz,prev):left;
 };
 const endPan=()=>{
  if(!pan)return;
  const id=pan.id;pan=null;
  bodyEl.classList.remove('timeline-panning');
  if(host.hasPointerCapture&&host.hasPointerCapture(id)){try{host.releasePointerCapture(id)}catch{}}
 };
 host.addEventListener('pointerdown',e=>{
  if(e.button!==1||e.shiftKey||e.ctrlKey||e.metaKey||e.altKey)return;
  e.preventDefault();
  try{host.setPointerCapture(e.pointerId)}catch{}
  pan={id:e.pointerId,x:e.clientX,y:e.clientY};
  bodyEl.classList.add('timeline-panning');
 });
 host.addEventListener('pointermove',e=>{
  if(!pan||e.pointerId!==pan.id)return;
  e.preventDefault();
  host.scrollLeft+=pan.x-e.clientX;
  host.scrollTop+=pan.y-e.clientY;
  pan.x=e.clientX;pan.y=e.clientY;
 });
 host.addEventListener('pointerup',e=>{if(pan&&pan.id===e.pointerId)endPan()});
 host.addEventListener('pointercancel',endPan);
 host.addEventListener('lostpointercapture',endPan);
 winEl&&winEl.addEventListener&&winEl.addEventListener('blur',endPan);
 host.addEventListener('wheel',e=>{
  // Alt/Option＋滚轮：以鼠标位置为锚缩放；其余修饰键保持原生行为。
  if(e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){
   const d=e.deltaY||0;
   if(d){e.preventDefault();setZoom(stepTimelineZoom(zoom,d<0?1:-1),{clientX:e.clientX});}
   return;
  }
  if(timelineWheelScroll(host,e))e.preventDefault();
 },{passive:false});
 apply();
 const isFit=()=>zoom<=TIMELINE_ZOOM_MIN+1e-9&&host.scrollLeft<=0;
 const fitToggle=()=>{
  if(!isFit()){
   fitMemory={zoom,left:host.scrollLeft};
   setZoom(TIMELINE_ZOOM_MIN,{resetScroll:true});
  }else if(fitMemory){
   const m=fitMemory;
   setZoom(m.zoom,{anchor:false});
   host.scrollLeft=clampTimelineScroll(host,m.left);
  }
  return fitState();
 };
 const fitState=()=>({fit:isFit(),canReturn:!!fitMemory,zoom});
 return {
  zoom:()=>zoom,
  setZoom,
  zoomIn(){setZoom(stepTimelineZoom(zoom,1))},
  zoomOut(){setZoom(stepTimelineZoom(zoom,-1))},
  fit:fitToggle,
  fitToggle,
  fitState,
  fitMemory:()=>fitMemory?{...fitMemory}:null,
  clearFitMemory(){fitMemory=null;},
  destroy(){endPan()},
 };
}
