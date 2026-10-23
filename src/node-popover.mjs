// 画布节点旁的上下文 UI 定位（小云雀式）：选中节点 → 工具条贴上方，编辑 / 生成面板按需展开。
// 本模块只做 DOM 几何，不改业务状态；Escape、焦点归还与 portal 挂载（modalRoot / body）由调用方负责。
const TOP_RESERVE=60,BOTTOM_RESERVE=85,SIDE_MARGIN=12,GAP=8; // 顶部画布工具带 / 底部控件+小地图带，两侧安全边距，节点与浮层间距。
const num=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
// 水平安全区间：窄画布（放不下 浮层+两侧边距）时先保住可见性，left 边距优先、允许右侧少量溢出。
const hBounds=(boardWidth,overlayWidth)=>{const min=Math.min(SIDE_MARGIN,Math.max(0,boardWidth-overlayWidth));return [min,Math.max(min,boardWidth-SIDE_MARGIN-overlayWidth)];};

// node 为 board 内屏幕坐标（可能出界）；返回同一坐标系下的 {left,top}（取整）。
export function nodeOverlayPosition({board,node,overlay,kind='toolbar',obstacles=[],bottomReserve=BOTTOM_RESERVE}={}){
 const W=num(board?.width,Infinity),H=num(board?.height,Infinity);
 const nx=num(node?.x),ny=num(node?.y),nw=num(node?.w),nh=num(node?.h);
 const ow=num(overlay?.width),oh=num(overlay?.height);
 const [minLeft,maxLeft]=hBounds(W,ow);
 const bandTop=TOP_RESERVE,bandMax=Math.max(TOP_RESERVE,H-bottomReserve-oh); // 垂直安全带；画布过矮时收缩到顶部保留区。
 let placement,left,top,dock;
 if(kind==='composer'){
  left=clamp(nx+nw/2-ow/2,minLeft,maxLeft);
  const below=ny+nh+GAP,above=ny-GAP-oh;
  if(below+oh<=H-bottomReserve&&below>=bandTop){top=below;placement='below';}
  else if(above>=bandTop){top=above;placement='above';}
  else{top=clamp(below,bandTop,bandMax);placement='clamped';}
 }else if(kind==='panel'){
  // 面板优先节点右方，放不下换左方，两侧都放不下（窄画布 / 节点出界）以节点为中心贴边；高度交给 CSS 收敛。
  const right=nx+nw+GAP,leftSide=nx-GAP-ow;
  if(right+ow<=W-SIDE_MARGIN){left=right;placement='right';}
  else if(leftSide>=SIDE_MARGIN){left=leftSide;placement='left';}
  else{left=nx+nw/2-ow/2;placement='clamped';}
  left=clamp(left,minLeft,maxLeft);
  top=clamp(ny,bandTop,bandMax);
 }else{
  // 工具条贴节点上方，上方不够（顶部保留区）放节点下方；都不行说明画布过矮或节点出界，贴安全带最近的边。
  const above=ny-GAP-oh,below=ny+nh+GAP,fits=t=>t>=bandTop&&t+oh<=H-bottomReserve;
  if(fits(above)){top=above;placement='above';}
  else if(fits(below)){top=below;placement='below';}
  else{top=clamp(below,bandTop,bandMax);placement='clamped';}
  left=clamp(nx+nw/2-ow/2,minLeft,maxLeft);
 }
 // The source card is a hard exclusion; neighboring cards and the open
 // composer are avoided when space allows. Never clamp a toolbar into its source.
 if(kind==='toolbar'&&Number.isFinite(W)&&Number.isFinite(H)){
  const source={x:nx,y:ny,w:nw,h:nh};
  const intersects=(p,q)=>p.left<q.x+q.w+GAP&&p.left+ow+GAP>q.x&&p.top<q.y+q.h+GAP&&p.top+oh+GAP>q.y;
  const overlapArea=(p,q)=>Math.max(0,Math.min(p.left+ow,q.x+q.w)-Math.max(p.left,q.x))*Math.max(0,Math.min(p.top+oh,q.y+q.h)-Math.max(p.top,q.y));
  const fits=p=>p.left>=minLeft&&p.left<=maxLeft&&p.top>=bandTop&&p.top<=bandMax;
  const original={left,top};
  const candidates=[
   original,{left,top:ny-oh-GAP},{left,top:ny+nh+GAP},{left,top:bandTop},{left,top:bandMax},
   // Explicit dock slots: canvas edges and corners stay reachable when nearby
   // cards fill every gap. Choosing one is reported as a docked placement.
   {left:minLeft,top:bandTop},{left:maxLeft,top:bandTop},{left:minLeft,top:bandMax},{left:maxLeft,top:bandMax},
   {left:minLeft,top:clamp(ny,bandTop,bandMax)},{left:maxLeft,top:clamp(ny,bandTop,bandMax)}
  ];
  for(const q of [source,...obstacles]){
   candidates.push({left,top:q.y-oh-GAP},{left,top:q.y+q.h+GAP},
    {left:q.x-ow-GAP,top:clamp(ny,bandTop,bandMax)},{left:q.x+q.w+GAP,top:clamp(ny,bandTop,bandMax)});
  }
  const nodeDistance=p=>{
   const dx=Math.max(0,nx-(p.left+ow),p.left-(nx+nw));
   const dy=Math.max(0,ny-(p.top+oh),p.top-(ny+nh));
   return Math.hypot(dx,dy);
  };
  const originalDistance=p=>Math.hypot(p.left-original.left,p.top-original.top);
  const order=(a,b)=>nodeDistance(a)-nodeDistance(b)||originalDistance(a)-originalDistance(b);
  candidates.sort(order);
  const possible=candidates.filter(p=>fits(p)&&!intersects(p,source));
  const clear=p=>!obstacles.some(q=>intersects(p,q));
  const chosen=possible.find(clear)||possible.slice().sort((a,b)=>obstacles.reduce((sum,q)=>sum+overlapArea(a,q),0)-obstacles.reduce((sum,q)=>sum+overlapArea(b,q),0)||order(a,b))[0];
  if(chosen){
   left=chosen.left;top=chosen.top;
   if(left!==original.left||top!==original.top)placement='clear';
   // A node that is still on the canvas but whose nearest clear strip is far
   // away (busy low-zoom boards) gets a labelled dock at the nearest edge
   // instead of being pushed across the screen by unrelated cards.
   const onCanvas=ny+nh>bandTop&&ny<H-bottomReserve&&nx+nw>0&&nx<W;
   if(onCanvas&&possible.length&&nodeDistance(chosen)>200){
    placement='docked';
    dock=top+oh<=ny?'top':top>=ny+nh?'bottom':left+ow<=nx?'left':left>=nx+nw?'right':'edge';
   }
  }
  else{left=clamp(nx+nw/2-ow/2,minLeft,maxLeft);top=ny-oh-GAP;placement='outside';}
 }
 const result={left:Math.round(left),top:Math.round(top),placement};
 if(dock)result.dock=dock;
 return result;
}

// board / anchor 为 DOM 元素（anchor 可不存在，退回画布中心锚点）；以 fixed 定位写入 element，返回 viewport 坐标。
export function positionNodeOverlay(element,{board,anchor=null,kind='toolbar',obstacles=[],bottomReserve=BOTTOM_RESERVE}={}){
 if(!element?.getBoundingClientRect||!board?.getBoundingClientRect)return null;
 const b=board.getBoundingClientRect(),r=anchor?.getBoundingClientRect?.();
 const node=r?{x:r.left-b.left,y:r.top-b.top-(kind==='toolbar'?26:0),w:r.width,h:r.height+(kind==='toolbar'?26:0)}:{x:b.width/2,y:b.height/2,w:0,h:0};
 const e=element.getBoundingClientRect();
 const p=nodeOverlayPosition({board:{width:b.width,height:b.height},node,overlay:{width:e.width,height:e.height},kind,bottomReserve,obstacles:obstacles.map(el=>{const q=el.getBoundingClientRect();return {x:q.left-b.left,y:q.top-b.top,w:q.width,h:q.height};})});
 const left=Math.round(b.left+p.left),top=Math.round(b.top+p.top);
 element.style.position='fixed';element.style.left=left+'px';element.style.top=top+'px';
 return {left,top,placement:p.placement,...(p.dock?{dock:p.dock}:{})};
}

// 事件驱动的跟踪刷新：ResizeObserver（浮层 / 画布 / 锚点）+ 捕获 scroll + resize，统一 rAF 节流合并；不轮询。
export function installNodeOverlayTracking({element,board,anchor=null,kind='toolbar'}={}){
 const win=typeof window==='undefined'?null:window;
 if(!win||!element||!board)return {refresh(){},dispose(){}};
 let raf=0,disposed=false,watched=null;
 const ro=typeof win.ResizeObserver==='function'?new win.ResizeObserver(schedule):null;
 function schedule(){if(disposed||raf)return;raf=win.requestAnimationFrame(()=>{raf=0;run();});}
 function run(){
  if(disposed)return;
  const a=typeof anchor==='function'?anchor():anchor; // 锚点可能随选中变化，逐帧校对观察对象。
  if(a&&a!==watched){if(watched&&ro)ro.unobserve(watched);watched=a;ro?.observe(a);}
  positionNodeOverlay(element,{board,anchor:a,kind});
 }
 const onScroll=e=>{if(e?.target===element)return;schedule();}; // 面板自身滚动不触发重定位。
 ro?.observe(element);ro?.observe(board);
 win.addEventListener('resize',schedule,{passive:true});
 win.addEventListener('scroll',onScroll,{capture:true,passive:true});
 return {
  refresh:schedule,
  dispose(){
   if(disposed)return;disposed=true;
   if(raf)win.cancelAnimationFrame(raf);raf=0;
   ro?.disconnect();watched=null;
   win.removeEventListener('resize',schedule,{passive:true});
   win.removeEventListener('scroll',onScroll,{capture:true});
  }
 };
}
