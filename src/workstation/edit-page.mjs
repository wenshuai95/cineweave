// 剪辑页：影片序列时间线（V1 视频 + A1 音频），与导演台对象关键帧时间轴完全分开。
// 全部位置 / 入出点按整数帧保存（p.workstation.sequence）；秒只在本页预览与导出换算。
// 交互：拖入媒体、拖动移动、两端裁切、播放杆定位、空格播放、左右逐帧、拆分、
// 删除 / 闭合空隙、撤销重做（复用工程全局历史）、缩放与适应全部。
import {SEQUENCE_FPS,clipLength,clipEnd,trackEnd,sequenceDuration,placeClip,moveClip,trimClip,splitClip,removeClip,formatTimecode,isSequenceFps,refpsSequence} from './sequence.mjs';
import {cutLibraryRows} from './cut-library.mjs';
import {uid} from '../model.mjs';
import {t} from '../i18n/index.mjs';
import {parseClipTime,displayClipTime,isNativeActivationTarget} from './media-interactions.mjs';

const LABEL_W=118,LANE_TAIL=220,MIN_PPF=.04,MAX_PPF=32;

export function createEditPage(root,ctx){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ws=()=>ctx.project().workstation;
 const seq=()=>ws().sequence;
 let playhead=0,playAcc=0,playing=false,lastTs=0,rafId=0,pxPerFrame=6;
 let timeUnit='seconds';
 let selected=null; // {track:'video'|'audio', id}
 let drag=null,scrub=null,binDrag=null,cancelGesture=null;
 let activeVideoClipId=null,activeAudioClipId=null;
 const els={};
 let libraryFilter='all',libraryQuery='',libraryBusy=false,libraryRequest=0;
 const libraryRows=()=>cutLibraryRows(ctx.project(),{filter:libraryFilter,query:libraryQuery});

 const assetOf=id=>ws().assets.find(a=>a.id===id);
 const sourceFrames=asset=>asset?.durationSec?Math.max(1,Math.floor(asset.durationSec*seq().fps)):null;
 const trackOf=name=>name==='video'?seq().video:seq().audio;
 const setTrack=(name,value)=>{if(name==='video')seq().video=value;else seq().audio=value;};
 const selectedClip=()=>selected?trackOf(selected.track).find(c=>c.id===selected.id)||null:null;
 const totalFrames=()=>Math.max(sequenceDuration(ws()),0);
 const framesOfAsset=asset=>{const f=sourceFrames(asset);return f??Math.max(1,seq().fps*2);};

 function makeClip(assetId,start=0){
  const asset=assetOf(assetId);if(!asset)throw Error('素材不存在');
  return {id:uid(),assetId,start,in:0,out:framesOfAsset(asset),volume:1,muted:false};
 }

 // ---------- 渲染 ----------
 function render(){
  const keepLeft=els.scroll?.scrollLeft??0;
  const focused=root.contains(document.activeElement)?document.activeElement:null;
  const focusId=focused?.id,focusClip=focused?.dataset?.clip;
  const empty=!totalFrames(),hasLibrary=cutLibraryRows(ctx.project()).length>0;
  stop();
  root.innerHTML=`
   <header class="ws-page-header ws-edit-header">
    <div class="ws-edit-heading"><div><h2>${t('edit.title')}</h2><p>${t('edit.subtitle',{timecode:formatTimecode(totalFrames(),seq().fps),seconds:(totalFrames()/seq().fps).toFixed(2),fps:seq().fps})}</p></div><div class="ws-edit-output-actions"><button id="wsEdToCanvas" ${empty?'disabled aria-describedby="wsEdEmptyReason"':''} title="将粗剪结果渲染为 MP4 视频节点">${t('edit.toCanvas')}</button><button id="wsEdExport" class="primary" ${empty?'disabled aria-describedby="wsEdEmptyReason"':''} title="导出当前时间线为 MP4 文件">${t('edit.export')}</button></div></div>
    <div class="ws-edit-toolbar">
     <button id="wsEdHome" title="回到开头 Home">|◁</button>
     <button id="wsEdStepBack" title="上一帧 ←">◁</button>
     <button id="wsEdPlay" class="primary" ${empty?'disabled':''} title="播放 / 暂停 Space">▶</button>
     <button id="wsEdStepFwd" title="下一帧 →">▷</button>
     <span class="timecode" id="wsEdTimecode">00:00.00</span>
     <span class="divider"></span>
     <label class="ws-inline-label" title="影片帧率：24 / 25 / 30，切换时保持时间不变">${t('edit.fps')}
      <select id="wsEdFps">${SEQUENCE_FPS.map(f=>`<option value="${f}" ${seq().fps===f?'selected':''}>${f}</option>`).join('')}</select>
     </label>
     <span class="divider"></span>
     <button id="wsEdUndo" title="撤销 ⌘Z">↶</button>
     <button id="wsEdRedo" title="重做 ⌘⇧Z">↷</button>
     <span class="divider"></span>
     <button id="wsEdSplit" title="在播放杆处拆分所选片段 S">${t('edit.split')}</button>
     <button id="wsEdDelete" title="删除所选片段 Delete">${t('edit.delete')}</button>
     <button id="wsEdRipple" title="删除所选片段并闭合空隙">${t('edit.ripple')}</button>
     <span class="divider"></span>
     <button id="wsEdZoomOut" title="缩小 −">−</button>
     <button id="wsEdZoomIn" title="放大 ＋">＋</button>
     <button id="wsEdFit" title="缩放适配全部片段 F">${t('edit.fit')}</button>

    </div>
   </header>
   <div class="ws-edit-body">
    <aside class="ws-cut-library" aria-label="剪辑素材库" id="wsCutLibrary">
     <header><div><h3>${t('edit.library')} <small id="wsLibCount"></small></h3><p>${t('edit.libraryHint')}</p></div><button id="wsEdImport" class="primary">${t('edit.import')}</button></header>
     <input type="file" id="wsEdFile" multiple accept=".mp4,.webm,.mp3,.wav,.ogg,.m4a,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4" hidden>
     <nav ${hasLibrary?'':'hidden'} class="ws-library-filters ${hasLibrary?'':'hidden'}" aria-label="素材分类">${[['all',t('edit.filterAll')],['previz',t('edit.filterPreviz')],['video',t('edit.filterVideo')],['audio',t('edit.filterAudio')]].map(([id,label])=>`<button data-library-filter="${id}" aria-pressed="${libraryFilter===id}">${label}</button>`).join('')}</nav>
     <input ${hasLibrary?'':'hidden'} id="wsLibSearch" class="${hasLibrary?'':'hidden'}" type="search" aria-label="搜索剪辑素材" placeholder="${t('edit.search')}" value="${esc(libraryQuery)}">
     <div class="ws-bin-list" id="wsEdBin">${binHtml()}</div>
     <p class="help-text" id="wsLibStatus" role="status">${t('edit.importHint')}</p>
    </aside>
    <main class="ws-edit-main">
     <div class="ws-preview-wrap"><div class="ws-preview-frame"><video id="wsEdVideo" playsinline preload="auto"></video><div class="ws-preview-gap hidden" id="wsEdGap">${empty?`<section class="ws-edit-empty-start"><h3>${t('edit.emptyTitle')}</h3><p>${t('edit.emptyText')}</p><div class="ws-flow-actions"><button id="wsEdEmptyImport" class="primary">${t('edit.importExternal')}</button><button id="wsEdEmptyCanvas">${t('edit.chooseCanvas')}</button></div><p id="wsEdEmptyReason">${t('edit.emptyReason')}</p></section>`:t('edit.blackGap')}</div><span class="ws-preview-tag" id="wsEdTag"></span></div>
     <div class="ws-preview-row"><span id="wsEdClipInfo" class="muted">—</span><span class="grow"></span><span class="muted">${t('edit.previewTracks')}</span></div></div>
     <div class="ws-tl-scroll" id="wsTlScroll"><div class="ws-tl-content" id="wsTlContent"></div></div>
    </main>
    <aside class="ws-edit-side">
     <section class="ws-inspector" id="wsEdInspector"></section>
    </aside>
   </div>
   <dialog class="ws-library-preview" id="wsLibPreview" aria-labelledby="wsLibPreviewTitle"><header><h3 id="wsLibPreviewTitle">${t('edit.preview')}</h3><button id="wsLibPreviewClose" aria-label="关闭素材预览">${t('edit.close')}</button></header><div id="wsLibPreviewMedia"></div></dialog>`;
  Object.assign(els,{scroll:root.querySelector('#wsTlScroll'),content:root.querySelector('#wsTlContent'),
   video:root.querySelector('#wsEdVideo'),gap:root.querySelector('#wsEdGap'),tag:root.querySelector('#wsEdTag'),
   timecode:root.querySelector('#wsEdTimecode'),playBtn:root.querySelector('#wsEdPlay'),
   inspector:root.querySelector('#wsEdInspector'),clipInfo:root.querySelector('#wsEdClipInfo')});
  wire();
  wireLibraryRows();
  buildTimeline();
  els.scroll.scrollLeft=keepLeft;
  renderInspector();
  updatePlayheadView(true);
  const nextFocus=focusId?root.querySelector('#'+focusId):focusClip?[...root.querySelectorAll('[data-clip]')].find(el=>el.dataset.clip===focusClip):null;
  nextFocus?.focus({preventScroll:true});
 }
 function binHtml(){
  const items=libraryRows();
  if(!items.length)return `<p class="ws-empty">${libraryQuery||libraryFilter!=='all'?t('edit.noMatch'):t('edit.dropImport')}</p>`;
  return items.map(a=>`<div class="ws-bin-row" data-bin-key="${esc(a.key)}" title="${t('edit.dragToTrack')}">
   <span class="ws-asset-icon ${a.kind}">${a.kind==='video'?'▷':'♫'}</span>
   <span class="ws-bin-name" title="${esc(a.name)}"><b>${esc(a.name)}</b><small>${a.previz?t('edit.previz'):a.source}${a.durationSec?' · '+a.durationSec.toFixed(1)+' '+t('edit.secondsShort'):''}</small></span>
   <span class="ws-bin-actions"><button data-preview-material="${esc(a.key)}" aria-label="${t('edit.preview')} ${esc(a.name)}">${t('edit.preview')}</button><button data-add-material="${esc(a.key)}" aria-label="${t('edit.addAria',{name:esc(a.name),kind:a.kind==='video'?t('edit.videoTrack'):t('edit.audioTrack')})}" title="${t('edit.addTitle',{track:a.kind==='video'?'V1':'A1'})}">＋</button></span>
  </div>`).join('');
 }
 function wireLibraryRows(){
  root.querySelector('#wsLibCount').textContent=String(libraryRows().length);
  root.querySelectorAll('[data-add-material]').forEach(b=>b.onclick=()=>addMaterial(b.dataset.addMaterial));
  root.querySelectorAll('[data-preview-material]').forEach(b=>b.onclick=()=>previewMaterial(b.dataset.previewMaterial));
  root.querySelectorAll('[data-bin-key]').forEach(row=>installBinDrag(row));
 }
 function refreshLibrary(){
  const hasLibrary=cutLibraryRows(ctx.project()).length>0;
  for(const control of [root.querySelector('.ws-library-filters'),root.querySelector('#wsLibSearch')]){
   if(!control)continue;control.hidden=!hasLibrary;control.classList.toggle('hidden',!hasLibrary);
  }
  root.querySelector('#wsEdBin').innerHTML=binHtml();wireLibraryRows();
 }
 async function materialAsset(key){
  const item=cutLibraryRows(ctx.project()).find(r=>r.key===key);
  if(!item)throw Error('素材已变化，请重新选择');
  return item.assetId?assetOf(item.assetId):ctx.importCanvasNodeToLibrary(item.nodeId);
 }
 async function addMaterial(key){
  if(libraryBusy)return;
  const projectId=ctx.project().id;libraryBusy=true;
  try{const a=await materialAsset(key);if(ctx.project().id!==projectId||ctx.isProjectActive?.()===false)throw Error('项目已切换，请重新选择素材');appendAsset(a.id,a.kind);}
  catch(e){ctx.toast('加入剪辑失败：'+e.message);}finally{libraryBusy=false;}
 }
 async function previewMaterial(key){
  const item=cutLibraryRows(ctx.project()).find(r=>r.key===key);if(!item)return;
  stop();const request=++libraryRequest,projectId=ctx.project().id;
  try{
   const src=item.assetId?await ctx.mediaStore.url(item.assetId):ctx.project().nodes.find(n=>n.id===item.nodeId)?.src;
   if(request!==libraryRequest||ctx.project().id!==projectId)return;
   if(!src)throw Error('素材内容缺失，请重新导入');
   const dialog=root.querySelector('#wsLibPreview'),body=root.querySelector('#wsLibPreviewMedia');
   root.querySelector('#wsLibPreviewTitle').textContent=item.name;
   const media=document.createElement(item.kind);media.src=src;media.controls=true;media.preload='metadata';body.replaceChildren(media);
   dialog.showModal();root.querySelector('#wsLibPreviewClose').focus();
  }catch(e){ctx.toast('预览失败：'+e.message);}
 }
 function buildTimeline(){
  const frames=Math.max(totalFrames(),seq().fps*6);
  const width=LABEL_W+frames*pxPerFrame+LANE_TAIL;
  const laneW=frames*pxPerFrame+LANE_TAIL;
  const step=pxPerFrame*seq().fps>=34?1:pxPerFrame*seq().fps>=7?5:pxPerFrame*seq().fps>=1.4?30:120;
  let ticks='';
  for(let f=0;f<=frames;f+=step*seq().fps){
   const sec=f/seq().fps;
   ticks+=`<span class="ws-tick" style="left:${LABEL_W+f*pxPerFrame}px">${String(Math.floor(sec/60)).padStart(2,'0')}:${String(Math.round(sec%60)).padStart(2,'0')}</span>`;
  }
  els.content.style.width=width+'px';
  els.content.innerHTML=`
   <div class="ws-tl-ruler" id="wsTlRuler" style="width:${width}px">${ticks}</div>
   <div class="ws-tl-track"><div class="ws-tl-label" style="width:${LABEL_W}px"><b>V1</b> ${t('edit.videoTrack')}<span>${t('edit.singleTrackHint')}</span></div><div class="ws-tl-lane" data-lane="video" style="width:${laneW}px"></div></div>
   <div class="ws-tl-track audio"><div class="ws-tl-label" style="width:${LABEL_W}px"><b>A1</b> ${t('edit.audioTrack')}<span>${t('edit.trackVolume')} <input type="number" id="wsEdA1Gain" min="0" max="2" step="0.05" value="${seq().audioGain??1}"> <label class="ws-check"><input type="checkbox" id="wsEdA1Mute" ${seq().audioMuted?'checked':''}>${t('edit.mute')}</label></span></div><div class="ws-tl-lane" data-lane="audio" style="width:${laneW}px"></div></div>
   <i class="ws-tl-playhead" id="wsTlPlayhead" style="left:${LABEL_W}px"></i>`;
  els.ruler=els.content.querySelector('#wsTlRuler');
  els.playheadEl=els.content.querySelector('#wsTlPlayhead');
  els.lanes={video:els.content.querySelector('[data-lane=video]'),audio:els.content.querySelector('[data-lane=audio]')};
  for(const lane of Object.values(els.lanes))lane.style.setProperty('--tl-second',seq().fps*pxPerFrame+'px');
  for(const name of ['video','audio']){
   els.lanes[name].innerHTML=trackOf(name).map(c=>clipHtml(c,name)).join('');
   els.lanes[name].querySelectorAll('[data-clip]').forEach(el=>installClipDrag(el,name));
  }
  installScrub();
  root.querySelector('#wsEdA1Gain').onchange=e=>{const value=Number(e.target.value);const v=Math.min(2,Math.max(0,Number.isFinite(value)?value:1));ctx.checkpoint();seq().audioGain=v;ctx.commit();ctx.persist();updateMediaVolume();};
  root.querySelector('#wsEdA1Mute').onchange=e=>{ctx.checkpoint();seq().audioMuted=e.target.checked;ctx.commit();ctx.persist();updateMediaVolume();};
 }
 function clipHtml(c,track){
  const asset=assetOf(c.assetId),missing=!asset;
  const w=Math.max(6,clipLength(c)*pxPerFrame);
  return `<button class="ws-clip ${track} ${missing?'missing':''} ${selected&&selected.track===track&&selected.id===c.id?'selected':''}" data-clip="${esc(c.id)}" data-track="${track}" style="left:${c.start*pxPerFrame}px;width:${w}px" title="${esc(asset?.name||'素材缺失')} · ${formatTimecode(c.start,seq().fps)} 起 · ${clipLength(c)} 帧${missing?' · 素材缺失':''}">
   <span class="ws-clip-handle in" data-edge="in" title="拖动裁切入点"></span>
   <span class="ws-clip-body">${missing?'⚠ 素材缺失':esc(asset.name)} · ${clipLength(c)}f${c.muted?' · 静音':''}</span>
   <span class="ws-clip-handle out" data-edge="out" title="拖动裁切出点"></span>
  </button>`;
 }
 function relayout(name){
  const lane=els.lanes?.[name];if(!lane)return;
  const clips=trackOf(name);
  if(lane.children.length!==clips.length){lane.innerHTML=clips.map(c=>clipHtml(c,name)).join('');lane.querySelectorAll('[data-clip]').forEach(el=>installClipDrag(el,name));}
  else for(const el of lane.children){
   const c=clips.find(x=>x.id===el.dataset.clip);
   if(!c){el.remove();continue;}
   el.style.left=c.start*pxPerFrame+'px';
   el.style.width=Math.max(6,clipLength(c)*pxPerFrame)+'px';
   el.classList.toggle('selected',selected?.track===name&&selected.id===c.id);
   const body=el.querySelector('.ws-clip-body');
   if(body)body.textContent=`${assetOf(c.assetId)?.name??'素材缺失'} · ${clipLength(c)}f${c.muted?' · 静音':''}`;
  }
 }
 function renderInspector(){
  const c=selectedClip();
  if(!c){els.inspector.innerHTML=`<h3>${t('edit.clip')}</h3><p class="help-text">${t('edit.clickClip')}<br>${t('edit.addClip')}</p>`;return;}
  const asset=assetOf(c.assetId),src=sourceFrames(asset);
  els.inspector.innerHTML=`<h3>${t('edit.clipNamed',{name:esc(asset?.name||t('edit.missingAsset'))})}</h3>
   ${!asset?'<p class="ws-warn">'+t('edit.missingClip')+'</p>':''}
   <label class="field">${t('edit.timeDisplay')}<select id="wsPrUnit" aria-label="${t('edit.timeDisplay')}"><option value="seconds" ${timeUnit==='seconds'?'selected':''}>${t('edit.seconds')}</option><option value="timecode" ${timeUnit==='timecode'?'selected':''}>${t('edit.timecode')}</option><option value="frames" ${timeUnit==='frames'?'selected':''}>${t('edit.frames')}</option></select></label>
   <label class="field">${t('edit.position')} / ${timeUnit==='seconds'?t('edit.seconds') : timeUnit==='frames'?t('edit.frames'):t('edit.timecode')}<input type="${timeUnit==='timecode'?'text':'number'}" id="wsPrStart" min="0" step="${timeUnit==='seconds'?'any':'1'}" value="${displayClipTime(c.start,timeUnit,seq().fps)}"></label>
   <div class="ws-field-row">
    <label class="field">${t('edit.inPoint')} / ${timeUnit==='seconds'?t('edit.seconds') : timeUnit==='frames'?t('edit.frames'):t('edit.timecode')}<input type="${timeUnit==='timecode'?'text':'number'}" id="wsPrIn" min="0" step="${timeUnit==='seconds'?'any':'1'}" value="${displayClipTime(c.in,timeUnit,seq().fps)}"></label>
    <label class="field">${t('edit.outPoint')} / ${timeUnit==='seconds'?t('edit.seconds') : timeUnit==='frames'?t('edit.frames'):t('edit.timecode')}<input type="${timeUnit==='timecode'?'text':'number'}" id="wsPrOut" min="0" step="${timeUnit==='seconds'?'any':'1'}" value="${displayClipTime(c.out,timeUnit,seq().fps)}"></label>
   </div>
   <p class="help-text">${t('edit.duration')} ${clipLength(c)} ${t('edit.frames')} · ${(clipLength(c)/seq().fps).toFixed(2)} ${t('edit.seconds')}${src?` · ${t('edit.sourceFrames',{count:src})}`:''}</p>
   <div class="ws-field-row">
    <label class="field">${t('edit.volume')}<input type="number" id="wsPrVolume" min="0" max="2" step="0.05" value="${c.volume}"></label>
    <label class="field ws-check-field"><input type="checkbox" id="wsPrMute" ${c.muted?'checked':''}>${t('edit.clipMute')}</label>
   </div>
   <div class="ws-field-row">
    <button id="wsPrSplit" class="grow">${t('edit.split')}</button>
    <button id="wsPrDelete" class="danger grow">${t('edit.delete')}</button>
    <button id="wsPrRipple" class="grow" title="Delete and shift following clips">${t('edit.closeGap')}</button>
   </div>
   <p class="help-text">${t('edit.inspectorHelp')}</p>`;
  els.inspector.querySelector('#wsPrUnit').onchange=e=>{timeUnit=e.target.value;renderInspector();root.querySelector('#wsPrUnit').focus();};
  const readTime=input=>{try{input.setCustomValidity('');return parseClipTime(input.value,timeUnit,seq().fps);}catch(error){input.setCustomValidity(error.message);input.reportValidity();return null;}};
  els.inspector.querySelector('#wsPrStart').onchange=e=>{const start=readTime(e.target);if(start===null)return;ctx.checkpoint();setTrack(selected.track,moveClip(trackOf(selected.track),c.id,start));ctx.commit();ctx.persist();render();};
  els.inspector.querySelector('#wsPrIn').onchange=e=>{const v=readTime(e.target);if(v===null)return;ctx.checkpoint();const t=trackOf(selected.track);setTrack(selected.track,t.map(x=>x.id===c.id?{...x,in:Math.max(0,Math.min(v,x.out-1),x.out-(t.find(n=>n.start>=clipEnd(x)&&n.id!==x.id)?.start??Infinity)+x.start)}:x));ctx.commit();ctx.persist();render();};
  els.inspector.querySelector('#wsPrOut').onchange=e=>{let v=readTime(e.target);if(v===null)return;if(src!=null)v=Math.min(v,src);v=Math.min(v,c.in+(trackOf(selected.track).find(n=>n.start>=clipEnd(c)&&n.id!==c.id)?.start??Infinity)-c.start);ctx.checkpoint();const t=trackOf(selected.track);setTrack(selected.track,t.map(x=>x.id===c.id?{...x,out:Math.max(x.in+1,v)}:x));ctx.commit();ctx.persist();render();};
  els.inspector.querySelector('#wsPrVolume').onchange=e=>{const value=Number(e.target.value);const v=Math.min(2,Math.max(0,Number.isFinite(value)?value:1));ctx.checkpoint();const t=trackOf(selected.track);setTrack(selected.track,t.map(x=>x.id===c.id?{...x,volume:Math.round(v*100)/100}:x));ctx.commit();ctx.persist();render();};
  els.inspector.querySelector('#wsPrMute').onchange=e=>{ctx.checkpoint();const t=trackOf(selected.track);setTrack(selected.track,t.map(x=>x.id===c.id?{...x,muted:e.target.checked}:x));ctx.commit();ctx.persist();render();};
  els.inspector.querySelector('#wsPrSplit').onclick=()=>splitAtPlayhead();
  els.inspector.querySelector('#wsPrDelete').onclick=()=>deleteSelected(false);
  els.inspector.querySelector('#wsPrRipple').onclick=()=>deleteSelected(true);
 }

 // ---------- 时间线交互 ----------
 function frameFromClientX(clientX,laneEl){
  const r=laneEl.getBoundingClientRect();
  return Math.max(0,Math.round((clientX-r.left)/pxPerFrame));
 }
 function installScrub(){
  const scrubAt=e=>{
   const lane=els.lanes.video;if(!lane)return;
   setPlayhead(frameFromClientX(e.clientX,lane));
  };
  els.ruler.addEventListener('pointerdown',e=>{
   if(e.button!==0||drag||binDrag)return;
   e.preventDefault();stop();scrubAt(e);
   scrub={id:e.pointerId};
   const move=ev=>{if(ev.pointerId===scrub?.id)scrubAt(ev);};
   const up=ev=>{if(ev.pointerId!==scrub?.id)return;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);scrub=null;};
   window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
  });
  for(const name of ['video','audio']){
   els.lanes[name].addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('[data-clip]')||drag||binDrag)return;
    e.preventDefault();stop();selected=null;scrubAt(e);relayout('video');relayout('audio');renderInspector();
   });
  }
 }
 function selectClipElement(el,trackName){
  if(!trackOf(trackName).some(c=>c.id===el.dataset.clip))return;
  stop();selected={track:trackName,id:el.dataset.clip};
  relayout('video');relayout('audio');renderInspector();
 }
 function installClipDrag(el,trackName){
  el.addEventListener('click',()=>selectClipElement(el,trackName));
  el.addEventListener('pointerdown',e=>{
   if(e.button!==0||drag||binDrag||scrub)return;
   e.preventDefault();e.stopPropagation();el.focus({preventScroll:true});
   selectClipElement(el,trackName);
   const clip=selectedClip();if(!clip)return;
   const edge=el.querySelector('.ws-clip-handle:hover')?.dataset.edge||e.target.closest('[data-edge]')?.dataset.edge||'move';
   const initial=structuredClone(trackOf(trackName)),initialHead=playhead,sx=e.clientX,lane=els.lanes[trackName];
   let applied=null,moved=false,closed=false;
   const finish=cancelled=>{
    if(closed)return;closed=true;drag=null;cancelGesture=null;
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);
    if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);
    document.body.classList.remove('ws-dragging');
    if(cancelled||!applied){setTrack(trackName,initial);setPlayhead(initialHead);renderTimelineOnly();return;}
    setTrack(trackName,initial);ctx.checkpoint();setTrack(trackName,applied);ctx.commit();ctx.persist();renderTimelineOnly();renderInspector();
   };
   const cancel=()=>finish(true),up=ev=>{if(ev.pointerId===e.pointerId)finish(false);};
   const move=ev=>{
    if(ev.pointerId!==e.pointerId)return;
    const dFrames=Math.round((ev.clientX-sx)/pxPerFrame);
    if(!moved){if(Math.abs(ev.clientX-sx)<3)return;moved=true;document.body.classList.add('ws-dragging');}
    const base=initial;
    if(edge==='move')applied=moveClip(base,clip.id,clip.start+dFrames);
    else{
     const src=sourceFrames(assetOf(clip.assetId));
     applied=trimClip(base,clip.id,edge,dFrames,{maxOut:src??Infinity});
    }
    setTrack(trackName,applied);
    renderTimelineOnly();
    const now=trackOf(trackName).find(x=>x.id===clip.id);
    if(now)setPlayhead(edge==='out'?Math.max(now.start,clipEnd(now)-1):now.start);
   };
   drag={id:e.pointerId};cancelGesture=cancel;
   el.setPointerCapture(e.pointerId);
   window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);
  });
 }
 // 只重排轨道 DOM（拖动中高频调用），不动其余页面结构。
 function renderTimelineOnly(){
  const frames=Math.max(totalFrames(),seq().fps*6);
  const width=LABEL_W+frames*pxPerFrame+LANE_TAIL,laneW=frames*pxPerFrame+LANE_TAIL;
  els.content.style.width=width+'px';
  els.ruler.style.width=width+'px';
  els.lanes.video.style.width=laneW+'px';els.lanes.audio.style.width=laneW+'px';
  for(const lane of Object.values(els.lanes))lane.style.setProperty('--tl-second',seq().fps*pxPerFrame+'px');
  relayout('video');relayout('audio');
  updatePlayheadView();
  const header=root.querySelector('.ws-edit-header p');
  if(header)header.textContent=`粗剪与导出 · ${formatTimecode(totalFrames(),seq().fps)} · ${(totalFrames()/seq().fps).toFixed(2)} 秒 · ${seq().fps} fps`;
 }

 // 媒体条目 → 轨道：点按钮加到末尾，或按住拖到轨道指定帧。
 function wire(){
  root.querySelector('#wsEdExport').onclick=()=>ctx.openExport('file');
  root.querySelector('#wsEdToCanvas').onclick=()=>ctx.openExport('canvas');
  root.querySelector('#wsEdHome').onclick=()=>{stop();setPlayhead(0);};
  root.querySelector('#wsEdStepBack').onclick=()=>stepFrame(-1);
  root.querySelector('#wsEdStepFwd').onclick=()=>stepFrame(1);
  root.querySelector('#wsEdPlay').onclick=togglePlay;
  root.querySelector('#wsEdUndo').onclick=()=>ctx.undo();
  root.querySelector('#wsEdRedo').onclick=()=>ctx.undo(true);
  root.querySelector('#wsEdSplit').onclick=()=>splitAtPlayhead();
  root.querySelector('#wsEdDelete').onclick=()=>deleteSelected(false);
  root.querySelector('#wsEdRipple').onclick=()=>deleteSelected(true);
  root.querySelector('#wsEdZoomIn').onclick=()=>zoomBy(1.3);
  root.querySelector('#wsEdZoomOut').onclick=()=>zoomBy(1/1.3);
  root.querySelector('#wsEdFit').onclick=fitAll;
  root.querySelector('#wsEdFps').onchange=e=>changeFps(+e.target.value);
  root.querySelector('#wsEdEmptyImport')?.addEventListener('click',()=>root.querySelector('#wsEdFile').click());
  root.querySelector('#wsEdEmptyCanvas')?.addEventListener('click',()=>{
   libraryFilter='all';libraryQuery='';refreshLibrary();
   const rows=cutLibraryRows(ctx.project()),canvas=rows.find(row=>row.nodeId&&row.kind==='video');
   if(canvas){const button=[...root.querySelectorAll('[data-add-material]')].find(el=>el.dataset.addMaterial===canvas.key);button?.focus();button?.scrollIntoView({block:'nearest'});}
   else{ctx.toast('画布还没有可用的视频；可先在导演台导出白模，或在画布拖入视频');ctx.goToPage('canvas');}
  });
  root.querySelector('#wsEdImport').onclick=()=>root.querySelector('#wsEdFile').click();
  root.querySelector('#wsEdFile').onchange=async e=>{const files=[...e.target.files];e.target.value='';if(files.length)await importToLibrary(files);};
  root.querySelectorAll('[data-library-filter]').forEach(b=>b.onclick=()=>{libraryFilter=b.dataset.libraryFilter;root.querySelectorAll('[data-library-filter]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));refreshLibrary();});
  root.querySelector('#wsLibSearch').oninput=e=>{libraryQuery=e.target.value;refreshLibrary();};
  const library=root.querySelector('#wsCutLibrary');
  library.ondragover=e=>{if(!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='copy';library.classList.add('drop-active');};
  library.ondragleave=e=>{if(!library.contains(e.relatedTarget))library.classList.remove('drop-active');};
  library.ondrop=e=>{if(!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();e.stopPropagation();library.classList.remove('drop-active');importToLibrary([...e.dataTransfer.files]);};
  const preview=root.querySelector('#wsLibPreview');
  const closePreview=()=>preview.close();
  root.querySelector('#wsLibPreviewClose').onclick=closePreview;
  preview.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();closePreview();}});
  preview.addEventListener('close',()=>{const media=preview.querySelector('video,audio');media?.pause();media?.removeAttribute('src');root.querySelector('#wsLibPreviewMedia').replaceChildren();});

 }
 function installBinDrag(row){
  row.addEventListener('pointerdown',e=>{
   if(e.button!==0||e.target.closest('button')||drag||binDrag||scrub)return;
   const key=row.dataset.binKey,item=cutLibraryRows(ctx.project()).find(a=>a.key===key),projectId=ctx.project().id;if(!item)return;
   e.preventDefault();
   const sx=e.clientX,sy=e.clientY;let started=false,closed=false;
   const ghost=document.createElement('div');ghost.className='ws-bin-ghost';ghost.textContent=item.name;ghost.hidden=true;document.body.append(ghost);
   const finish=async drop=>{
    if(closed)return;closed=true;binDrag=null;cancelGesture=null;
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);
    ghost.remove();document.body.classList.remove('ws-dragging');
    if(!started||!drop)return;
    const lane=document.elementFromPoint(drop.clientX,drop.clientY)?.closest?.('[data-lane]');
    if(!lane)return ctx.toast('请拖到 V1 / A1 轨道上松开');
    const laneKind=lane.dataset.lane;
    if(laneKind!==item.kind)return ctx.toast(laneKind==='video'?'视频轨只能放视频素材':'音轨只能放音频素材');
    const frame=frameFromClientX(drop.clientX,lane);
    try{
     const asset=await materialAsset(key);
     if(ctx.project().id!==projectId)throw Error('项目已切换，请重新加入');
     const next=placeClip(trackOf(laneKind),{...makeClip(asset.id),start:frame});
     ctx.checkpoint();setTrack(laneKind,next);ctx.commit();ctx.persist();render();
     ctx.toast(`已把「${asset.name}」放到${laneKind==='video'?'V1':'A1'}`);
    }catch(err){ctx.toast(err.message);}

   };
   const cancel=()=>finish(null);cancelGesture=cancel;binDrag={id:e.pointerId};
   const up=ev=>{if(ev.pointerId===e.pointerId)finish(ev);};
   const move=ev=>{
    if(ev.pointerId!==e.pointerId)return;
    if(!started){if(Math.hypot(ev.clientX-sx,ev.clientY-sy)<5)return;started=true;binDrag={id:e.pointerId};document.body.classList.add('ws-dragging');ghost.hidden=false;}
    ghost.style.left=ev.clientX+12+'px';ghost.style.top=ev.clientY+10+'px';
   };
   window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);
  });
 }
 async function importToLibrary(files){
  if(libraryBusy)return ctx.toast('正在导入素材，请稍后');
  libraryBusy=true;const projectId=ctx.project().id;
  const status=root.querySelector('#wsLibStatus');if(status)status.textContent='正在导入素材…';
  try{
   const {added,errors}=await ctx.importMediaFiles(files);
   if(ctx.project().id!==projectId)return;
   if(added.length){libraryFilter='all';libraryQuery='';render();}
   if(errors.length)ctx.toast(errors.join('；'));else if(added.length)ctx.toast(`已导入 ${added.length} 个素材，点「＋」或拖到轨道开始剪辑`);
  }catch(e){ctx.toast('导入失败：'+e.message);}finally{libraryBusy=false;const el=root.querySelector('#wsLibStatus');if(el)el.textContent='可拖入文件导入。点预览查看原片，点「＋」或拖到轨道加入剪辑。';}
 }
 function appendAsset(assetId,track){
  const asset=assetOf(assetId);if(!asset)return;
  if(track==='video'&&asset.kind!=='video')return ctx.toast('视频轨只能加入视频素材');
  if(track==='audio'&&asset.kind!=='audio')return ctx.toast('音轨只能加入音频素材');
  const next=placeClip(trackOf(track),makeClip(assetId));
  ctx.checkpoint();setTrack(track,next);
  ctx.commit();ctx.persist();render();
  ctx.toast(`已追加到${track==='video'?' V1':' A1'}末尾`);
 }

 // ---------- 编辑操作 ----------
 function splitAtPlayhead(){
  const target=selectedClip()||trackOf('video').find(c=>playhead>c.start&&playhead<clipEnd(c))||trackOf('audio').find(c=>playhead>c.start&&playhead<clipEnd(c));
  if(!target)return ctx.toast('播放杆不在任何片段内，无法拆分');
  const trackName=trackOf('video').includes(target)?'video':'audio';
  const {track:next,created}=splitClip(trackOf(trackName),target.id,playhead);
  if(!created)return ctx.toast('请将播放杆放在所选片段内部');
  ctx.checkpoint();setTrack(trackName,next);ctx.commit();ctx.persist();
  if(created)selected={track:trackName,id:created.id};
  render();ctx.toast('已拆分；可拖动右半段');
 }
 function deleteSelected(ripple){
  const c=selectedClip();
  if(!c)return ctx.toast('请先选中要删除的片段');
  ctx.checkpoint();
  setTrack(selected.track,removeClip(trackOf(selected.track),c.id,{ripple}));
  selected=null;ctx.commit();ctx.persist();render();
  ctx.toast(ripple?'已删除并闭合空隙':'已删除片段');
 }
 function changeFps(fps){
  if(!isSequenceFps(fps)||fps===seq().fps)return;
  ctx.checkpoint();
  const old=seq().fps;
  ctx.project().workstation.sequence=refpsSequence({...ctx.project().workstation.sequence},fps);
  playhead=Math.round(playhead*fps/old);
  ctx.commit();ctx.persist();render();
 }
 function zoomBy(factor){
  pxPerFrame=Math.min(MAX_PPF,Math.max(MIN_PPF,pxPerFrame*factor));
  const centerFrame=playhead;
  buildTimeline();renderTimelineOnly();
  keepFrameVisible(centerFrame);
 }
 function fitAll(){
  const frames=Math.max(totalFrames(),seq().fps);
  const view=els.scroll.clientWidth-LABEL_W-LANE_TAIL/2;
  pxPerFrame=Math.min(MAX_PPF,Math.max(MIN_PPF,view/frames));
  buildTimeline();renderTimelineOnly();els.scroll.scrollLeft=0;
 }
 function keepFrameVisible(frame){
  const x=frame*pxPerFrame+LABEL_W;
  if(x<els.scroll.scrollLeft+LABEL_W+20)els.scroll.scrollLeft=Math.max(0,x-LABEL_W-40);
  else if(x>els.scroll.scrollLeft+els.scroll.clientWidth-60)els.scroll.scrollLeft=x-els.scroll.clientWidth+120;
 }

 // ---------- 播放与预览 ----------
 function setPlayhead(frame){
  playhead=Math.max(0,Math.min(totalFrames()||0,Math.round(frame)));
  updatePlayheadView();
 }
 function stepFrame(delta){
  stop();setPlayhead(playhead+delta);
 }
 let audioContext=null;const gainNodes=new WeakMap();
 function previewGain(el,value){
  if(!el)return;
  if(audioContext){let gain=gainNodes.get(el);if(!gain){gain=audioContext.createGain();audioContext.createMediaElementSource(el).connect(gain);gain.connect(audioContext.destination);gainNodes.set(el,gain);}el.volume=1;gain.gain.value=value;}
  else el.volume=Math.min(1,value);
 }
 function togglePlay(){
  if(playing){stop();return;}
  if(!totalFrames())return ctx.toast('时间线为空，先导入或拖入素材');
  if(playhead>=totalFrames())playhead=0;
  audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});updateMediaVolume();
  playing=true;playAcc=playhead;lastTs=performance.now();
  els.playBtn.textContent='Ⅱ';
  const tick=ts=>{
   if(!playing)return;
   playAcc+=(ts-lastTs)/1000*seq().fps;lastTs=ts;
   if(playAcc>=totalFrames()){playhead=totalFrames();stop();updatePlayheadView();return;}
   playhead=Math.round(playAcc);
   updatePlayheadView();
   rafId=requestAnimationFrame(tick);
  };
  rafId=requestAnimationFrame(tick);
 }
 function stop(){
  if(playing){playing=false;cancelAnimationFrame(rafId);}
  els.playBtn&&(els.playBtn.textContent='▶');
  els.video?.pause();els.audioEl?.pause();
 }
 async function mediaUrl(assetId){
  return ctx.mediaStore.url(assetId);
 }
 function activeClipAt(trackName,f){
  return trackOf(trackName).find(c=>f>=c.start&&f<clipEnd(c))||null;
 }
 let previewRequest=0;
 async function syncPreview(seek){
  const request=++previewRequest,at=playhead,fps=seq().fps;
  const v=activeClipAt('video',playhead),a=activeClipAt('audio',playhead);
  els.gap.classList.toggle('hidden',!!v);
  els.tag.textContent=v?assetOf(v.assetId)?.name||'素材缺失':'';
  els.clipInfo.textContent=!totalFrames()?'加入素材后在这里预览':v?`V1 · ${assetOf(v.assetId)?.name??'素材缺失'} · ${formatTimecode(playhead,seq().fps)} / ${formatTimecode(totalFrames(),seq().fps)}`:`空隙 · ${formatTimecode(playhead,seq().fps)} / ${formatTimecode(totalFrames(),seq().fps)}`;
  if(v){
   const url=await mediaUrl(v.assetId);if(request!==previewRequest)return;
   if(!url){els.video.removeAttribute('src');els.video.load();els.tag.textContent='素材缺失';return;}
   if(els.video.dataset.asset!==v.assetId){els.video.dataset.asset=v.assetId;els.video.src=url;activeVideoClipId=null;}
   const t=(v.in+at-v.start)/fps;
   if(seek||activeVideoClipId!==v.id||!playing||Math.abs(els.video.currentTime-t)>0.2){
    activeVideoClipId=v.id;
    try{els.video.currentTime=t;}catch{}
    if(playing)els.video.play().catch(()=>{});
   }
   updateMediaVolume();
  }else{els.video.pause();els.video.dataset.asset='';activeVideoClipId=null;}
  // A1 用独立音频元素播放（视频原声走 video 元素）
  if(a){
   const url=await mediaUrl(a.assetId);if(request!==previewRequest)return;
   if(url){
    els.audioEl??=document.createElement('audio');
    if(els.audioEl.dataset.asset!==a.assetId){els.audioEl.dataset.asset=a.assetId;els.audioEl.src=url;activeAudioClipId=null;}
    const t=(a.in+at-a.start)/fps;
    if(seek||activeAudioClipId!==a.id||!playing||Math.abs(els.audioEl.currentTime-t)>0.2){
     activeAudioClipId=a.id;
     try{els.audioEl.currentTime=t;}catch{}
     if(playing)els.audioEl.play().catch(()=>{});
    }
    updateMediaVolume();
   }
  }else if(els.audioEl){els.audioEl.pause();els.audioEl.dataset.asset='';activeAudioClipId=null;}
 }
 function updateMediaVolume(){
  const v=activeClipAt('video',playhead);
  if(v&&els.video)previewGain(els.video,v.muted?0:v.volume);
  const a=activeClipAt('audio',playhead),gain=seq().audioMuted?0:(seq().audioGain??1);
  if(els.audioEl)previewGain(els.audioEl,a?(a.muted?0:a.volume)*gain:0);
 }
 function updatePlayheadView(seek=false){
  if(els.playheadEl){
   els.playheadEl.style.left=LABEL_W+playhead*pxPerFrame+'px';
   if(playing)keepFrameVisible(playhead);
  }
  if(els.timecode)els.timecode.textContent=formatTimecode(playhead,seq().fps);
  syncPreview(seek);
 }

 // ---------- 键盘（由 shell 在剪辑页转发） ----------
 function handleKey(e){
  const inField=e.target instanceof Element&&(e.target.matches('input,textarea,select,[contenteditable="true"]')||e.target.closest('input,textarea,select,[contenteditable="true"]'));
  if(inField||document.querySelector('.modal,dialog[open]'))return;
  if((e.metaKey||e.ctrlKey)&&e.code==='KeyZ'){e.preventDefault();ctx.undo(e.shiftKey);return;}
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  // Space / Enter activate the focused native control; timeline shortcuts must not intercept them.
  if((e.code==='Space'||e.code==='Enter'||e.code==='NumpadEnter')&&isNativeActivationTarget(e.target))return;
  switch(e.code){
   case 'Space':e.preventDefault();if(!e.repeat)togglePlay();return;
   case 'ArrowLeft':e.preventDefault();stepFrame(e.shiftKey?-10:-1);return;
   case 'ArrowRight':e.preventDefault();stepFrame(e.shiftKey?10:1);return;
   case 'Home':e.preventDefault();stop();setPlayhead(0);return;
   case 'End':e.preventDefault();stop();setPlayhead(totalFrames());return;
   case 'KeyS':e.preventDefault();if(!e.repeat)splitAtPlayhead();return;
   case 'KeyF':e.preventDefault();if(!e.repeat)fitAll();return;
   case 'Delete':case 'Backspace':e.preventDefault();if(!e.repeat)deleteSelected(false);return;
   case 'Equal':case 'NumpadAdd':e.preventDefault();if(!e.repeat)zoomBy(1.3);return;
   case 'Minus':case 'NumpadSubtract':e.preventDefault();if(!e.repeat)zoomBy(1/1.3);return;
  }
 }
 // 外部（撤销 / 素材变化）后刷新
 function refresh(){
  playhead=Math.min(playhead,totalFrames());
  const sel=selectedClip();
  if(selected&&!sel)selected=null;
  render();
 }
 async function onShow(){
  const projectId=ctx.project().id;
  pxPerFrame=Math.min(MAX_PPF,Math.max(MIN_PPF,pxPerFrame));
  render();
  fitAll();
  try{if(await ctx.linkLegacyCanvasMedia?.()&&ctx.project().id===projectId&&!root.hidden)refreshLibrary();}catch{/* Legacy matching is optional; all original media remain available. */}
 }
 function onHide(){cancelGesture?.();++previewRequest;++libraryRequest;root.querySelector('#wsLibPreview')?.close();stop();}
 function reset(){cancelGesture?.();++previewRequest;stop();playhead=0;playAcc=0;selected=null;pxPerFrame=6;libraryFilter='all';libraryQuery='';++libraryRequest;}
 return {handleKey,refresh,onShow,onHide,reset,appendAsset};
}
