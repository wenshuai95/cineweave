const KEY='director-canvas-panel-layout-v1';
export const defaults={left:260,right:280,timeline:274,preview:230};
// 轻量布局预设：构图（大画布）、动画（高时间轴）、预演（大机位监看）。
// 只是同一套面板的尺寸组合，不创建第二份场景数据。
export const layoutPresets={
 compose:{left:210,right:250,timeline:180,preview:150},
 animate:{left:225,right:260,timeline:430,preview:220},
 preview:{left:195,right:345,timeline:190,preview:430},
};
const clamp=(v,min,max)=>Math.min(Math.max(min,max),Math.max(min,v));
export function readLayout(value){const result={...defaults};for(const key of Object.keys(result))if(Number.isFinite(value?.[key]))result[key]=clamp(value[key],80,1000);return result;}
export function fitLayout(value,width,height){
 const s=readLayout(value),budget=Math.max(410,width-372);
 s.left=clamp(s.left,180,Math.min(480,budget-230));s.right=clamp(s.right,230,Math.min(560,budget-s.left));
 s.timeline=clamp(s.timeline,180,Math.min(600,height-223));s.preview=clamp(s.preview,130,Math.min(560,height-190));return s;
}
// 存储读取：v1 是纯尺寸对象，v2 是 {v:2,sizes,collapsed,custom}；损坏数据回退默认。
function readSaved(raw){
 let data=raw;
 try{data=typeof raw==='string'?JSON.parse(raw):raw;}catch{return {sizes:{...defaults},collapsed:readCollapsed(null),custom:null,customCollapsed:readCollapsed(null)};}
 if(data&&data.v===2&&data.sizes)return {
  sizes:readLayout(data.sizes),
  collapsed:readCollapsed(data.collapsed),
  custom:data.custom&&Object.keys(data.custom).length?readLayout(data.custom.sizes||data.custom):null,
  customCollapsed:readCollapsed(data.custom?.collapsed),
 };
 return {sizes:readLayout(data),collapsed:readCollapsed(null),custom:null,customCollapsed:readCollapsed(null)};
}
function readCollapsed(value){
 const out={left:false,right:false,timeline:false,preview:false};
 for(const key of Object.keys(out))out[key]=!!value?.[key];
 return out;
}
export function installPanelLayout({root,onStart=()=>{},onResize=()=>{}}){
 let desired,custom,customCollapsed,collapsed;
 try{({sizes:desired,custom,customCollapsed,collapsed}=readSaved(localStorage.getItem(KEY)));}catch{desired={...defaults};custom=null;customCollapsed=readCollapsed(null);collapsed={left:false,right:false,timeline:false,preview:false};}
 let current,drag=null;const handles=[...root.querySelectorAll('[data-panel-resize]')];
 const panels={left:root.querySelector('.sidebar'),right:root.querySelector('.inspector'),timeline:root.querySelector('.timeline'),preview:root.querySelector('#previewSection')};
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({v:2,sizes:desired,collapsed,custom:custom?{sizes:custom,collapsed:customCollapsed}:null}));}catch{}};
 const apply=()=>{current=fitLayout(desired,root.clientWidth,root.clientHeight);
  for(const key of Object.keys(current)){
   const off=collapsed[key];
   root.style.setProperty('--panel-'+key,off?'0px':current[key]+'px');
   // Mode visibility (e.g. timeline hidden in board mode) belongs to main.js.
   // Panel collapse must not toggle or remove that independent hidden class.
   if(panels[key])panels[key].style.display=off?'none':'';
  }
  for(const h of handles){const key=h.dataset.panelResize;h.style.display=collapsed[key]?'none':'';h.setAttribute('aria-valuenow',Math.round(current[key]));h.setAttribute('aria-valuemin',({left:180,right:230,timeline:180,preview:130})[key]);const edge=fitLayout({...desired,[key]:10000},root.clientWidth,root.clientHeight);h.setAttribute('aria-valuemax',Math.round(edge[key]));}onResize();};
 const expandAll=()=>{collapsed={left:false,right:false,timeline:false,preview:false};};
 const end=cancel=>{if(!drag)return;const d=drag;drag=null;if(cancel)desired=d.original;else save();document.body.classList.remove('resizing-panels','resizing-panels-x','resizing-panels-y');if(d.handle.hasPointerCapture(d.id))d.handle.releasePointerCapture(d.id);apply();};
 for(const h of handles){const key=h.dataset.panelResize,horizontal=['left','right'].includes(key),sign=key==='left'?1:-1;
  h.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();onStart();h.focus();drag={handle:h,id:e.pointerId,key,start:horizontal?e.clientX:e.clientY,size:current[key],original:{...desired}};h.setPointerCapture(e.pointerId);document.body.classList.add('resizing-panels','resizing-panels-'+(horizontal?'x':'y'));});
  h.addEventListener('pointermove',e=>{if(!drag||drag.handle!==h||drag.id!==e.pointerId)return;e.preventDefault();const size=drag.size+sign*((horizontal?e.clientX:e.clientY)-drag.start);desired={...current,[key]:size};desired=fitLayout(desired,root.clientWidth,root.clientHeight);apply();});
  h.addEventListener('pointerup',()=>end(false));h.addEventListener('pointercancel',()=>end(true));h.addEventListener('lostpointercapture',()=>end(true));
  h.addEventListener('dblclick',()=>{end(true);desired[key]=defaults[key];apply();save();});
  h.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){e.preventDefault();e.stopPropagation();end(true);return;}const directions=horizontal?{ArrowLeft:-1,ArrowRight:1}:{ArrowUp:-1,ArrowDown:1};if(e.key==='Home'){desired[key]=defaults[key];}else if(e.key in directions){desired={...current,[key]:current[key]+directions[e.key]*sign*(e.shiftKey?1:10)};}else return;e.preventDefault();e.stopPropagation();onStart();desired=fitLayout(desired,root.clientWidth,root.clientHeight);apply();save();});
 }
 window.addEventListener('blur',()=>end(true));document.addEventListener('keydown',e=>{if(drag&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();end(true);}},true);
 let last='';const observer=new ResizeObserver(()=>{const size=root.clientWidth+':'+root.clientHeight;if(size!==last){last=size;apply();}});observer.observe(root);apply();
 return {
  refresh:apply,
  reset(){end(true);expandAll();desired={...defaults};apply();save();},
  presets:layoutPresets,
  applyPreset(name){const preset=layoutPresets[name];if(!preset)return false;end(true);expandAll();desired=readLayout(preset);apply();save();return true;},
  saveCustom(){custom=readLayout(desired);customCollapsed=readCollapsed(collapsed);save();return {...custom};},
  hasCustom(){return !!custom;},
  applyCustom(){if(!custom)return false;end(true);collapsed=readCollapsed(customCollapsed);desired={...custom};apply();save();return true;},
  isCollapsed(key){return !!collapsed[key];},
  collapsedKeys(){return Object.keys(collapsed).filter(k=>collapsed[k]);},
  collapse(key){if(!(key in collapsed))return;collapsed[key]=true;end(true);apply();save();},
  expand(key){if(!(key in collapsed))return;collapsed[key]=false;end(true);apply();save();},
  togglePanel(key){collapsed[key]?this.expand(key):this.collapse(key);},
 };
}
