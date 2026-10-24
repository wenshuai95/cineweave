import {createDirectorPanel} from './director-panel.mjs';
import {fitToolDock} from './dock-layout.mjs';
import {videoVersionGroup,versionClips,replaceVersionClips,adoptVideoVersion} from '../video-versions.mjs';
import './workstation.css';
import './workflow-ui.css';
import './canvas-tools.css';
import {createMediaStore} from './media-store.mjs';
import {importMediaFiles as readMediaFiles,probeMediaBlob,appendClip} from './media-import.mjs';
import {createScriptPage} from './script-page.mjs';
import {createCreativePage} from './creative-page.mjs';
import {normalizeCreativeTasks} from './creative-agent.mjs';
import {createAssetsPage} from './assets-page.mjs';
import {createEditPage} from './edit-page.mjs';
import {createDeliverPage} from './deliver-page.mjs';
import {uid} from '../model.mjs';
import {t} from '../i18n/index.mjs';
import {workflowState,recordWorkflowStep} from './workflow.mjs';

const PAGES=[['canvas',t('nav.canvas'),'▦'],['edit',t('nav.edit'),'▤']];
const TOOL_NAMES={assistant:'Creative Assistant',script:t('workspace.script'),assets:t('workspace.assets')};

export function installWorkstation(ctx){
 const app=document.querySelector('.app');
 if(!app)throw Error('未找到应用根节点，无法安装工作台');
 const mediaStore=createMediaStore();

 // 画布为主工作区；剧本与资产保留为按需打开的画布工具。
 const nav=document.createElement('nav');
 nav.className='ws-bottomnav';nav.setAttribute('aria-label',t('workspace.pageAria'));
 nav.innerHTML=PAGES.map(([id,name,icon])=>`<button type="button" data-ws-nav="${id}" aria-current="${id==='canvas'}" title="${name}"><i>${icon}</i><span>${name}</span></button>`).join('');
 nav.querySelectorAll('[data-ws-nav]').forEach(b=>b.onclick=()=>setPage(b.dataset.wsNav));
 const footer=app.querySelector('footer.statusbar');
 app.insertBefore(nav,footer);

 const toolbar=document.createElement('div');toolbar.className='ws-canvas-tools';toolbar.setAttribute('aria-label',t('workspace.toolAria'));
 toolbar.innerHTML='<button type="button" data-ws-tool="script">'+t('workspace.script')+'</button><button type="button" data-ws-tool="assets">'+t('workspace.assets')+'</button><button type="button" id="wsArrangeStory" title="Arrange script, shots and assets to canvas; does not call models">'+t('workspace.arrangeStory')+'</button>';
 app.querySelector('.sidebar').prepend(toolbar);
 const dock=document.createElement('aside');dock.className='ws-canvas-dock';dock.hidden=true;dock.setAttribute('aria-label',t('workspace.dockAria'));
 dock.innerHTML=`<div class="ws-dock-grip" role="separator" tabindex="0" aria-label="调整创作工具宽度" aria-orientation="vertical" aria-valuemin="420" aria-valuemax="1200" aria-valuenow="580"></div><header class="ws-dock-header"><strong id="wsDockTitle"></strong><span>${t('workspace.dockSubtitle')}</span><button type="button" id="wsDockExpand" aria-label="扩大创作工具" aria-pressed="false">${t('workspace.expand')}</button><button type="button" id="wsDockClose" aria-label="关闭创作工具，返回画布">${t('workspace.close')}</button></header>`;
 app.insertBefore(dock,footer);
 // 工具容器常驻在画布旁边；切换只隐藏，不销毁已有编辑状态。
 const sections={};
 for(const id of ['assistant','script','assets','edit']){
  const section=document.createElement('section');
  section.className='ws-page';section.hidden=true;
  section.id='wsPage'+id[0].toUpperCase()+id.slice(1);
  section.setAttribute('aria-label',(TOOL_NAMES[id]||PAGES.find(([p])=>p===id)[1])+(TOOL_NAMES[id]?'工具':'页面'));
  if(TOOL_NAMES[id]){section.classList.add('ws-tool-page');dock.append(section);}else app.insertBefore(section,footer);
  sections[id]=section;
 }

 // Export is an on-demand dialog owned by the rough-cut workspace.
 const exportDialog=document.createElement('dialog');
 exportDialog.className='ws-export-dialog';exportDialog.id='wsExportDialog';exportDialog.setAttribute('aria-labelledby','wsExportTitle');
 exportDialog.innerHTML=`<header class="ws-export-heading"><div><h2 id="wsExportTitle">${t('workspace.exportTitle')}</h2><p>MP4 · H.264 / AAC</p></div><button type="button" id="wsExportClose" aria-label="关闭导出，返回剪辑">${t('workspace.exportClose')}</button></header><div id="wsExportContent"></div>`;
 app.append(exportDialog);
 const exportContent=exportDialog.querySelector('#wsExportContent');
 exportDialog.querySelector('#wsExportClose').onclick=()=>closeExport();
 exportDialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();closeExport();}});
 exportDialog.addEventListener('cancel',e=>{e.preventDefault();closeExport();});
 exportDialog.addEventListener('close',()=>{pages.deliver.onHide?.();const button=current==='edit'?document.querySelector('#wsEdExport'):nav.querySelector('[aria-current="true"]');button?.focus({preventScroll:true});});
 function closeExport(){if(exportDialog.open)exportDialog.close();}
 function openExport(destination='file'){
  if(current!=='edit')setPage('edit');
  pages.edit.onHide?.(); // Pause and finish gestures without resetting the playhead or selection.
  if(!exportDialog.open)exportDialog.showModal();
  pages.deliver.onShow({destination});exportDialog.querySelector('#wsExportClose').focus({preventScroll:true});
 }
 let current='canvas',currentTool=null,dockWidth=580,expanded=false,returnFocus=null;
 const grip=dock.querySelector('.ws-dock-grip');
 let reserveFrame=0;
 function updateReservedSpace(){
  const width=dock.hidden||dock.classList.contains('node-assistant-floating')?0:Math.round(dock.getBoundingClientRect().width);
  app.style.setProperty('--ws-reserved-width',width+'px');
  app.classList.toggle('has-tool-dock',width>0);
  app.classList.toggle('tool-canvas-compact',width>0&&window.innerWidth-width<700);
  if(!reserveFrame)reserveFrame=requestAnimationFrame(()=>{reserveFrame=0;ctx.onCanvasShown?.();});
 }
 const resizeDock=value=>{dockWidth=Number(value)||580;const fit=fitToolDock(window.innerWidth,dockWidth,expanded);dock.style.setProperty('--ws-dock-width',fit.width+'px');grip.setAttribute('aria-valuemin',String(fit.minimum));grip.setAttribute('aria-valuemax',String(fit.maximum));grip.setAttribute('aria-valuenow',String(fit.width));updateReservedSpace();};
 resizeDock(dockWidth);
 window.addEventListener('resize',()=>{resizeDock(dockWidth);});
 const dockObserver=new ResizeObserver(entries=>{for(const entry of entries)if(entry.contentRect.width)dock.classList.toggle('compact',entry.contentRect.width<=650);updateReservedSpace();});dockObserver.observe(dock);
 grip.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();if(expanded){const width=dock.getBoundingClientRect().width;setExpanded(false);resizeDock(width);}resizeDock(e.key==='Home'?420:e.key==='End'?window.innerWidth*.85:dockWidth+(e.key==='ArrowLeft'?40:-40));});
 grip.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();if(expanded){const width=dock.getBoundingClientRect().width;setExpanded(false);resizeDock(width);}grip.setPointerCapture(e.pointerId);dock.classList.add('resizing');const start=e.clientX,width=dockWidth;const move=ev=>{if(ev.pointerId===e.pointerId)resizeDock(width+start-ev.clientX);};const stop=ev=>{if(ev.pointerId!==e.pointerId)return;grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',stop);grip.removeEventListener('pointercancel',stop);grip.removeEventListener('lostpointercapture',stop);dock.classList.remove('resizing');};grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',stop);grip.addEventListener('pointercancel',stop);grip.addEventListener('lostpointercapture',stop);});
 toolbar.querySelectorAll('[data-ws-tool]').forEach(button=>button.onclick=()=>{const kind=button.dataset.wsTool;if(currentTool===kind)closeTool();else openTool(kind);});
 toolbar.querySelector('#wsArrangeStory').onclick=()=>{const send=ctx.sendStoryPackageToCanvas||ctx.syncStoryCanvas;if(send)send();else ctx.toast('请先准备剧本与分镜，再整理到画布');};
 dock.querySelector('#wsDockClose').onclick=()=>closeTool();
 function setExpanded(value){expanded=value;dock.classList.toggle('expanded',expanded);resizeDock(dockWidth);const button=dock.querySelector('#wsDockExpand');button.textContent=expanded?'收起':'扩大';button.setAttribute('aria-label',expanded?'恢复创作工具宽度':'扩大创作工具');button.setAttribute('aria-pressed',String(expanded));}
 dock.querySelector('#wsDockExpand').onclick=()=>{if(dock.classList.contains('node-assistant-floating'))openTool('assistant',{nodeId:dock.dataset.nodeId,fullAssistant:true});else setExpanded(!expanded);};
 let workflowFrame=0;
 function scheduleWorkflow(){if(!workflowFrame)workflowFrame=requestAnimationFrame(()=>{workflowFrame=0;refreshWorkflow();});}
 function refreshWorkflow(){
  const project=ctx.project();if(!project?.workstation)return;
  const state=workflowState(project);
  const counts={script:state.shots?`${state.shots} 镜`:(state.scriptChars?'有文稿':''),assets:state.assets?`${state.assets} 项`:'',canvas:state.synced?`${state.synced}/${state.total}`:'',edit:state.clips?`${state.clips} 段`:'',deliver:state.deliveries?`${state.deliveries} 次`:''};
  for(const b of nav.querySelectorAll('[data-ws-nav]')){
   const id=b.dataset.wsNav;let count=b.querySelector('small');
   if(!count){count=document.createElement('small');b.append(count);}
   const value=counts[id];if(count.textContent!==value)count.textContent=value;
   const warning=(id==='script'&&state.shotsStale)||(id==='assets'&&state.assetsStale)||(id==='canvas'&&state.pendingSync>0);
   b.classList.toggle('ws-needs-review',warning);
   b.title=PAGES.find(p=>p[0]===id)[1]+(value?' · '+(id==='canvas'?'分镜资产已关联 ':'')+value:'')+(id==='canvas'&&state.pendingSync?' · '+state.pendingSync+' 项待同步':warning?' · 上游已变化，请检查':'');
  }
  for(const b of toolbar.querySelectorAll('[data-ws-tool]')){const kind=b.dataset.wsTool;const warning=kind==='assistant'?(state.shotsStale||state.assetsStale):kind==='script'?state.shotsStale:state.assetsStale;b.classList.toggle('ws-needs-review',warning);b.title=TOOL_NAMES[kind]+(warning?' · 上游已变化，请检查':'');}
  for(const id of ['script','assets']){
   const root=sections[id];let notice=root.querySelector(':scope > .ws-workflow-notice');
   const step=id==='script'?'shots':'assets',visible=id===currentTool&&(id==='script'?state.shotsStale:state.assetsStale);
   if(!visible){notice?.remove();continue;}
   if(notice)continue;
   notice=document.createElement('aside');notice.className='ws-workflow-notice';notice.setAttribute('role','status');
   const text=document.createElement('span');text.textContent=id==='script'?'剧本文稿已改动，请检查分镜是否仍适用。':'剧本或分镜已改动，请检查资产是否需要调整。';notice.append(text);
   const reviewed=document.createElement('button');reviewed.textContent='已检查，保留现有内容';
   reviewed.onclick=()=>{ctx.checkpoint();recordWorkflowStep(ctx.project().workstation,step);ctx.commit();ctx.persist();refreshWorkflow();};notice.append(reviewed);root.prepend(notice);
  }
 }
 const pageCtx={
  ...ctx,createDirectorPanel:()=>createDirectorPanel(pageCtx),mediaStore,importMediaFiles,linkLegacyCanvasMedia,importCanvasNodeToLibrary,sendCanvasNodeToEdit,openExport,
  commit(...args){const result=ctx.commit(...args);scheduleWorkflow();return result;},
  persist(...args){const result=ctx.persist(...args);scheduleWorkflow();return result;},
  goToPage:(id,options)=>setPage(id,options),
  openTool:(kind,options)=>openTool(kind,options),
  closeTool:()=>closeTool(),
  openLegacyWriting:options=>openTool('script',options),
  onCreativeTasksChanged:()=>{scheduleWorkflow();document.dispatchEvent(new CustomEvent('creative-tasks-changed'));},
  appendMediaClip:assetId=>appendClip(ctx.project(),assetId),
 };
 const pages={
  assistant:createCreativePage(sections.assistant,pageCtx),
  script:createScriptPage(sections.script,pageCtx),
  assets:createAssetsPage(sections.assets,pageCtx),
  edit:createEditPage(sections.edit,pageCtx),
  deliver:createDeliverPage(exportContent,{...pageCtx,embedded:true}),
 };
 // Page renderers replace their own markup. Restore only the shared notice,
 // without rebuilding their form controls or stealing the current focus.
 const workflowObserver=new MutationObserver(scheduleWorkflow);
 for(const root of Object.values(sections))workflowObserver.observe(root,{childList:true});

 function closeTool({restoreFocus=true}={}){
  if(!currentTool)return;
  pages[currentTool]?.onHide?.();sections[currentTool].hidden=true;currentTool=null;dock.hidden=true;
  delete document.body.dataset.wsTool;dock.classList.remove('node-assistant-floating');delete dock.dataset.nodeId;delete dock.dataset.overlayKind;
  updateReservedSpace();
  toolbar.querySelectorAll('[data-ws-tool]').forEach(b=>b.setAttribute('aria-pressed','false'));
  ctx.onCanvasShown?.();scheduleWorkflow();
  if(restoreFocus&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
 }
 function openTool(kind,options={}){
  if(!TOOL_NAMES[kind])return;
  ctx.prepareCanvasTool?.(options);if(kind==='script')ctx.ensureScriptNode?.();
  if(current!== 'canvas')setPage('canvas');
  const nodeId=kind==='assistant'&&!options.editDocument?(options.nodeId||options.sourceNodeId):null;
  const floating=!options.fullAssistant&&!!nodeId&&ctx.project().nodes.some(n=>n.id===nodeId&&n.type==='text');
  const configure=()=>{dock.classList.toggle('node-assistant-floating',floating);if(floating){dock.dataset.nodeId=nodeId;dock.dataset.overlayKind='composer';}else{delete dock.dataset.nodeId;delete dock.dataset.overlayKind;dock.style.removeProperty('left');dock.style.removeProperty('top');dock.style.removeProperty('position');dock.style.removeProperty('max-height');dock.style.removeProperty('max-width');}resizeDock(dockWidth);};
  if(currentTool===kind){configure();pages[kind].open?.(options);ctx.onToolShown?.(kind);scheduleWorkflow();return;}
  closeTool({restoreFocus:false});returnFocus=document.activeElement;
  currentTool=kind;dock.hidden=false;sections[kind].hidden=false;configure();
  document.body.dataset.wsPage='canvas';document.body.dataset.wsTool=kind;
  resizeDock(dockWidth);
  dock.querySelector('#wsDockTitle').textContent=TOOL_NAMES[kind];
  toolbar.querySelectorAll('[data-ws-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wsTool===kind)));
  pages[kind].onShow(options);ctx.onToolShown?.(kind);scheduleWorkflow();
 }
 function setPage(id,options={}){
  if(id==='deliver'){openExport();return;} // Compatibility with existing navigation callers.
  if(TOOL_NAMES[id])return openTool(id,options);
  if(!PAGES.some(([key])=>key===id))return;
  if(id===current){if(id==='canvas')closeTool({restoreFocus:false});return;}
  closeExport();closeTool({restoreFocus:false});pages[current]?.onHide?.();current=id;
  document.body.dataset.wsPage=id;if(id!=='canvas')ctx.onCanvasHidden?.();
  nav.querySelectorAll('[data-ws-nav]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.wsNav===id)));
  for(const [key,section] of Object.entries(sections))section.hidden=key!==id;
  toolbar.hidden=id!=='canvas';
  if(id!=='canvas')pages[id].onShow();else ctx.onCanvasShown?.();
  scheduleWorkflow();
 }

 // 统一媒体导入入口：校验 + 探测 + 写库 + 工程引用，一次撤销。
 let importing=false;
 async function importMediaFiles(files){
  if(importing)return {added:[],addedCount:0,errors:['正在导入素材，请稍后']};
  if(ctx.project().workstation.assets.length>=500)return {added:[],addedCount:0,errors:['素材库已达 500 个上限，请先整理素材']};
  const projectId=ctx.project().id;importing=true;
  try{
  const {added,errors}=await readMediaFiles(Array.from(files).slice(0,500-ctx.project().workstation.assets.length),mediaStore);
  if(ctx.project().id!==projectId||ctx.isProjectActive?.()===false){for(const a of added)await mediaStore.delete(a.id).catch(()=>{});return {added:[],addedCount:0,errors:['项目已切换，请在目标项目重新导入']};}
  if(added.length){
   ctx.checkpoint();
   const ws=ctx.project().workstation;
   ws.assets=[...ws.assets,...added];
   ctx.commit();ctx.persist();
  }
  return {added,errors,addedCount:added.length};
  }finally{importing=false;}
 }

 // Lazy ingest: reuse media already in the project; reading the library never duplicates it.
 // Older "send to cut" imports had no canvas media ID. Link only byte-identical
 // candidates, so different takes with the same name can never be merged.
 async function matchingCanvasAsset(owner,node,blob){
  const candidates=owner.workstation.assets.filter(a=>a.kind===node.type&&a.name===node.title&&a.size===blob.size);
  if(!candidates.length)return null;
  const bytes=new Uint8Array(await blob.arrayBuffer());
  for(const a of candidates){const other=await mediaStore.blob(a.id);if(!other||other.size!==blob.size)continue;const data=new Uint8Array(await other.arrayBuffer());if(bytes.every((v,i)=>data[i]===v))return a;}
  return null;
 }
 async function linkLegacyCanvasMedia(){
  const owner=ctx.project(),links=[];
  for(const n of owner.nodes){
   if(n.mediaId||!['video','audio'].includes(n.type)||!n.src?.startsWith('data:')||!owner.workstation.assets.some(a=>a.kind===n.type&&a.name===n.title))continue;
   const source=n.src,blob=await(await fetch(source)).blob(),a=await matchingCanvasAsset(owner,n,blob);
   if(a)links.push({nodeId:n.id,source,assetId:a.id});
  }
  if(ctx.project().id!==owner.id||ctx.isProjectActive?.()===false)return false;
  const applicable=links.filter(l=>ctx.project().nodes.some(n=>n.id===l.nodeId&&n.src===l.source&&!n.mediaId)&&ctx.project().workstation.assets.some(a=>a.id===l.assetId));
  if(!applicable.length)return false;
  ctx.checkpoint();for(const l of applicable)ctx.project().nodes.find(n=>n.id===l.nodeId).mediaId=l.assetId;
  ctx.commit();ctx.persist();return true;
 }
 const canvasImports=new Map();
 async function importCanvasNodeToLibrary(nodeId){
  if(canvasImports.has(nodeId))return canvasImports.get(nodeId);
  const work=(async()=>{
   const owner=ctx.project(),projectId=owner.id,node=owner.nodes.find(n=>n.id===nodeId);
   if(!node||!['video','audio'].includes(node.type)||!/^data:(video|audio)\//.test(node.src||''))throw Error('该节点没有可用的视频或音频');
   const existing=owner.workstation.assets.find(a=>a.id===node.mediaId&&a.kind===node.type);
   if(existing&&await mediaStore.blob(existing.id))return existing;
   const source=node.src,blob=await (await fetch(source)).blob();
   if(blob.size>300*1024*1024)throw Error('素材超过 300 MB 剪辑媒体上限');
   const matched=await matchingCanvasAsset(owner,node,blob);
   if(matched&&ctx.project().id===projectId&&ctx.isProjectActive?.()!==false){
    const live=ctx.project().nodes.find(n=>n.id===nodeId&&n.src===source);
    if(!live)throw Error('素材已变化，请重新加入');
    ctx.checkpoint();live.mediaId=matched.id;ctx.commit();ctx.persist();return matched;
   }
   if(owner.workstation.assets.length>=500)throw Error('素材库已达 500 个上限');
   const probe=await probeMediaBlob(blob,node.type),id=uid();
   const entry={id,kind:node.type,name:node.title,mime:blob.type,size:blob.size,createdAt:Date.now(),...probe};
   await mediaStore.put({...entry,blob});
   if(ctx.project().id!==projectId||ctx.isProjectActive?.()===false||!ctx.project().nodes.some(n=>n.id===nodeId&&n.src===source)||ctx.project().workstation.assets.length>=500){await mediaStore.delete(id);throw Error('项目或素材已变化，请重新加入');}
   ctx.checkpoint();ctx.project().workstation.assets.push(entry);ctx.project().nodes.find(n=>n.id===nodeId).mediaId=id;
   ctx.commit();ctx.persist();return entry;
  })();
  canvasImports.set(nodeId,work);
  try{return await work;}finally{canvasImports.delete(nodeId);}
 }
 async function sendCanvasNodeToEdit(nodeId){
  const projectId=ctx.project().id;
  try{
   const entry=await importCanvasNodeToLibrary(nodeId);
   if(ctx.project().id!==projectId)throw Error('项目已切换，请在目标项目重新加入');
   if(ctx.project().workstation.sequence[entry.kind].length>=200)throw Error('该剪辑轨道已达 200 段上限');
   ctx.checkpoint();
   const group=videoVersionGroup(ctx.project(),nodeId);if(group&&versionClips(ctx.project(),group).length){ctx.toast('这个镜头已在剪辑中；可在版本对比中替换，原有裁切会保留');return;}
   if(!appendClip(ctx.project(),entry.id,{canvasNodeId:nodeId,...(group?{versionGroupId:group.id}:{})}))throw Error('未能加入剪辑，请检查轨道容量');
   ctx.commit();ctx.persist();setPage('edit');ctx.toast(`已把「${entry.name}」加入剪辑`);
  }catch(e){ctx.toast('送入剪辑失败：'+e.message);}
 }

 async function replaceCanvasVersionInEdit(nodeId){
  const owner=ctx.project(),originalGroup=videoVersionGroup(owner,nodeId),originalNode=owner.nodes.find(n=>n.id===nodeId);
  if(!originalGroup||!originalNode)throw Error('镜头版本卡片不存在');
  const source=originalNode.src,groupId=originalGroup.id,sourceNodeId=originalGroup.sourceNodeId;
  const asset=await importCanvasNodeToLibrary(nodeId);
  if(ctx.project()!==owner||ctx.isProjectActive?.()===false)throw Error('工程已切换，请重新打开版本面板');
  // Import can outlive this dialog. Resolve live records before planning either
  // adoption or timeline changes; closing/removing a group must leave both intact.
  const group=owner.boardGroups?.find(g=>g.id===groupId&&g.videoVersions&&g.sourceNodeId===sourceNodeId),node=owner.nodes.find(n=>n.id===nodeId);
  if(!group||!group.memberIds.includes(nodeId))throw Error('镜头版本卡片已移除或变化，请重新打开版本面板');
  if(!node||node.type!=='video'||!node.src||node.src!==source)throw Error('候选素材已移除或变化，请重新打开版本面板');
  const next=replaceVersionClips(owner,group,asset,nodeId);
  ctx.checkpoint();adoptVideoVersion(owner,group.id,nodeId);owner.workstation.sequence.video=next;
  ctx.commit();ctx.persist();ctx.toast('剪辑已替换为所选版本，保留裁切、位置和音量');return true;
 }
 async function sendVideoVersionsToEdit(nodeIds){
  const owner=ctx.project(),entries=[];
  for(const id of nodeIds){const group=videoVersionGroup(owner,id);if(!group||versionClips(owner,group).length)continue;const asset=await importCanvasNodeToLibrary(id);if(ctx.project()!==owner)throw Error('工程已切换');entries.push({id,group,asset});}
  if(owner.workstation.sequence.video.length+entries.length>200)throw Error('视频轨道已达 200 段上限');
  if(!entries.length)throw Error('选中镜头已在剪辑中，可在版本面板替换');
  ctx.checkpoint();for(const {id,group,asset} of entries)appendClip(owner,asset.id,{canvasNodeId:id,versionGroupId:group.id});ctx.commit();ctx.persist();setPage('edit');ctx.toast('已按分镜顺序加入 '+entries.length+' 个镜头');return true;
 }
 // 非画布页的按键分流（编辑焦点 / 弹窗打开时不拦截）
 document.addEventListener('keydown',e=>{
  if(current==='canvas'&&!currentTool)return;
  if(e.isComposing)return;
  if(e.key==='Escape'&&currentTool&&!document.querySelector('.modal,.ws-dialog-overlay,.ws-result-preview,.ws-asset-preview-overlay')){e.preventDefault();closeTool();return;}
  const field=e.target.closest?.('input,textarea,select,[contenteditable]');
  if((e.metaKey||e.ctrlKey)&&e.code==='KeyS'){e.preventDefault();ctx.persist();return;}
  if(!field&&!document.querySelector('.modal,dialog[open]')&&(e.metaKey||e.ctrlKey)&&e.code==='KeyZ'){e.preventDefault();ctx.undo(e.shiftKey);return;}
  if(current==='edit')pages.edit.handleKey(e);
 });

 document.body.dataset.wsPage='canvas';

 function applyCanvas(){
  closeExport();
  closeTool({restoreFocus:false});pages[current]?.onHide?.();
  current='canvas';
  document.body.dataset.wsPage='canvas';
  nav.querySelectorAll('[data-ws-nav]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.wsNav==='canvas')));
  for(const section of Object.values(sections))section.hidden=true;toolbar.hidden=false;
 }

 return {
  mediaStore,
  page:()=>current,
  onCanvas:()=>current==='canvas'&&(!currentTool||dock.classList.contains('node-assistant-floating')),
  tool:()=>currentTool,
  setPage,openTool,closeTool,
  refresh(){if(currentTool!=='assistant')pages.assistant.refresh();const p=pages[currentTool||current];if(p){if(p.refresh)p.refresh();else p.onShow();}if(exportDialog.open)pages.deliver.refresh();scheduleWorkflow();},
  onProjectOpened(){
   const ws=ctx.project().workstation;
   ws.creativeTasks=normalizeCreativeTasks(ws.creativeTasks,{interrupt:true});
   pages.assistant.onProjectChanged();
   pages.edit.reset();
   applyCanvas();
   // Older projects start tracking from this opening; nothing is regenerated.
   ws.workflow||={};
   if(ws.story.shots.length&&!ws.workflow.scriptForShots)recordWorkflowStep(ws,'shots');
   if(ws.story.assets.length&&!ws.workflow.sourceForAssets)recordWorkflowStep(ws,'assets');
   ctx.persist();scheduleWorkflow();
  },
  onProjectsView(){closeExport();pages.assistant.cancelAll('interrupted');closeTool({restoreFocus:false});pages[current]?.onHide?.();},
  cancelCreativeTasks:reason=>pages.assistant.cancelAll(reason||'interrupted'),
  openCreativeTask(id){openTool('assistant',{taskId:id});},
  sendCanvasNodeToEdit,replaceCanvasVersionInEdit,sendVideoVersionsToEdit,
  importMediaFiles,
 };
}
