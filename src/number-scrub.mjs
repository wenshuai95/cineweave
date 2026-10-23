export function scrubValue(value,delta,step,min,max,precise=false){
 const next=value+delta*step*(precise?.1:1);
 return Math.min(max,Math.max(min,Math.round(next*1e6)/1e6));
}

// One change event per gesture keeps the app's undo and validation atomic.
export function installNumberScrub({onStart=()=>{},onPreview=()=>{},onEnd=()=>{}}={}){
 let drag=null,suppressClick=false;
 const finish=(cancel=false)=>{
  if(!drag)return;const d=drag;drag=null;clearTimeout(d.timer);
  document.body.classList.remove('scrubbing-number');
  if(!d.active)return;
  if(cancel)d.el.value=d.original;
  onEnd();
  if(!cancel&&d.el.value!==d.original)d.el.dispatchEvent(new Event('change',{bubbles:true}));
  if(d.el.hasPointerCapture(d.id))d.el.releasePointerCapture(d.id);
  suppressClick=true;setTimeout(()=>suppressClick=false,0);
 };
 document.addEventListener('pointerdown',e=>{
  const el=e.target.closest?.('input[type="number"],input[data-nf]');
  if(e.button!==0||!el||el.disabled||el.readOnly||!Number.isFinite(el.valueAsNumber))return;
  finish(true);
  drag={el,id:e.pointerId,x:e.clientX,y:e.clientY,original:el.value,value:el.valueAsNumber,active:false,ready:false};
  drag.timer=setTimeout(()=>{if(drag)drag.ready=true},180);
 },true);
 document.addEventListener('pointermove',e=>{
  const d=drag;if(!d||d.id!==e.pointerId)return;
  if(!d.active){
   if(Math.abs(e.clientX-d.x)<(d.ready?1:5))return;
   if(Math.abs(e.clientY-d.y)>Math.abs(e.clientX-d.x))return;
   d.active=true;d.el.setPointerCapture(d.id);onStart(d.el);document.body.classList.add('scrubbing-number');
  }
  e.preventDefault();
  const step=d.el.step&&d.el.step!=='any'?Number(d.el.step):1;
  d.value=scrubValue(d.value,e.clientX-d.x,step/6,d.el.min===''?-Infinity:Number(d.el.min),d.el.max===''?Infinity:Number(d.el.max),e.shiftKey);
  d.x=e.clientX;d.el.value=String(Number(d.value.toFixed(4)));onPreview(d.el);
 },{capture:true,passive:false});
 document.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)finish()},true);
 document.addEventListener('pointercancel',()=>finish(true),true);
 document.addEventListener('keydown',e=>{if(drag?.active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(true)}},true);
 document.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation()}},true);
 window.addEventListener('blur',()=>finish(true));
 return ()=>finish(true);
}
