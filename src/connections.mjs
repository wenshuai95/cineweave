export function connectionFor(start,end,edges){
 if(!end||start.id===end.id||start.port===end.port)return null;
 const edge=start.port==='out'?{from:start.id,to:end.id}:{from:end.id,to:start.id};
 return edges.some(e=>e.from===edge.from&&e.to===edge.to)?null:edge;
}

export function installPortDrag(button,{edges,onConnect,onActivate}){
 let suppressClick=false;
 button.onclick=e=>{e.stopPropagation();if(suppressClick&&e.detail!==0){suppressClick=false;return;}button.focus?.({preventScroll:true});onActivate?.();};
 button.onpointerdown=e=>{
  if(e.button!==0)return;e.preventDefault();e.stopPropagation();
  const start={id:button.closest('.node').dataset.id,port:button.dataset.port};
  const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.classList.add('connection-drag');
  const path=document.createElementNS(overlay.namespaceURI,'path');overlay.append(path);document.body.append(overlay);
  const r=button.getBoundingClientRect(),origin=[r.x+r.width/2,r.y+r.height/2];
  let hover=null,moved=false;const startPointer=[e.clientX,e.clientY];
  const hit=ev=>document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.port');
  const move=ev=>{if(Math.hypot(ev.clientX-startPointer[0],ev.clientY-startPointer[1])>4)moved=true;const end=[ev.clientX,ev.clientY],a=start.port==='out'?origin:end,b=start.port==='out'?end:origin,d=Math.max(55,Math.abs(b[0]-a[0])/2);path.setAttribute('d',`M ${a[0]} ${a[1]} C ${a[0]+d} ${a[1]}, ${b[0]-d} ${b[1]}, ${b[0]} ${b[1]}`);hover?.classList.remove('connect-target');hover=hit(ev);if(hover?.dataset.port!==start.port&&hover?.closest('.node').dataset.id!==start.id)hover?.classList.add('connect-target');};
  const cleanup=()=>{overlay.remove();hover?.classList.remove('connect-target');button.classList.remove('pending');document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);};
  const cancel=()=>cleanup();
  const key=ev=>{if(ev.key==='Escape'){ev.stopImmediatePropagation();ev.preventDefault();cancel();}};
  const up=ev=>{ev.preventDefault();ev.stopPropagation();const target=hit(ev),edge=connectionFor(start,target?{id:target.closest('.node').dataset.id,port:target.dataset.port}:null,edges());cleanup();suppressClick=moved;if(edge)onConnect(edge);};
  button.setPointerCapture(e.pointerId);button.classList.add('pending');move(e);
  document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);document.addEventListener('keydown',key,true);window.addEventListener('blur',cancel);
 };
}
