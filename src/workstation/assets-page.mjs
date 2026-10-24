// 资产页：工作站媒体库（IndexedDB Blob）的导入 / 预览 / 删除 / 送入剪辑，
// 同时汇总画布上已有的图片 / 视频 / 音频节点，可一键送到剪辑或回到画布定位。
import './flow-ui.css';
import {removeMediaWithConsent} from './media-interactions.mjs';
import {isStoryNodeCurrent,isAssetImageCurrent} from './story-canvas.mjs';
import {IMAGE_VERSION_LIMIT,validateImageFile,addAssetImageVersions,selectAssetImage,removeAssetImageVersion} from './asset-images.mjs';
import {assetReferenceImpact} from './asset-image-context.mjs';
import {normalizeStory} from './story.mjs';

export function normalizeAssetsOpenOptions(options={}){
 if(!options||typeof options!=='object')return {};
 const out={};if(['planning','media'].includes(options.mode))out.mode=options.mode;
 if(typeof options.assetId==='string'&&options.assetId)out.assetId=options.assetId;
 return out;
}
export function createAssetsPage(root,ctx){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let contextualAssetId=null;
 let previewUrl=null,planningFilter='all',mode='planning',focusId=null,query='',previewClose=null,lastProjectId=null,lastEdit=0,impactClose=null;const planningSelected=new Set();
 const imageUrls=new Map(),imageLoads=new Map();let imageEpoch=0,active=false,imageImport=null,previewImageId=null;
 function revokeImageUrls(){imageEpoch++;for(const url of imageUrls.values())URL.revokeObjectURL(url);imageUrls.clear();imageLoads.clear();}
 function fillImageUrls(){
  const epoch=imageEpoch,projectId=ctx.project().id;
  for(const el of root.querySelectorAll('[data-image-media]')){const id=el.dataset.imageMedia;if(imageUrls.has(id)){el.src=imageUrls.get(id);continue;}
   if(!imageLoads.has(id)){const task=ctx.mediaStore.get(id).then(entry=>{if(!active||epoch!==imageEpoch||ctx.project().id!==projectId)return;if(!entry?.blob){for(const img of root.querySelectorAll('[data-image-media]'))if(img.dataset.imageMedia===id){img.hidden=true;img.parentElement.classList.add('ws-image-missing');img.parentElement.title='本地图片内容缺失，请重新导入';}return;}const url=URL.createObjectURL(entry.blob);imageUrls.set(id,url);for(const img of root.querySelectorAll('[data-image-media]'))if(img.dataset.imageMedia===id){img.src=url;img.hidden=false;img.parentElement.classList.remove('ws-image-missing');}}).catch(()=>{if(epoch===imageEpoch)ctx.toast('本地图片读取失败，请重新导入');}).finally(()=>{if(imageLoads.get(id)===task)imageLoads.delete(id);});imageLoads.set(id,task);}
  }
 }
 function imageElement(v,alt,extra=''){return `<img data-image-media="${esc(v.mediaId)}" ${imageUrls.has(v.mediaId)?`src="${esc(imageUrls.get(v.mediaId))}"`:''} alt="${esc(alt)}" ${extra}>`;}
 function confirmOfficialChange(asset,version,onConfirm,{removing=false,focusSelector='#wsPlanImageUse'}={}){
  impactClose?.();
  let impact;try{impact=assetReferenceImpact(ctx.project(),asset.id);}catch(e){return ctx.toast(e.message);}
  const shots=impact.shots.length?impact.shots.map(shot=>`镜头 ${String(shot.index+1).padStart(2,'0')}${shot.scene?' · '+shot.scene:''}`).join('、'):'暂无关联镜头';
  const old=impact.oldVersion?`${impact.oldVersion.name}${impact.oldVersion.width?` · ${impact.oldVersion.width}×${impact.oldVersion.height}`:''}`:'还没有正式图';
  const overlay=document.createElement('div');overlay.id='wsOfficialImageChange';overlay.className='ws-dialog-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',removing?'移除正式图版本':'更换正式图');
  overlay.innerHTML=`<section class="ws-dialog ws-official-change"><header><h2>${removing?'移除':'更换'}「${esc(asset.name)}」${removing?'的正式图版本':'的正式图'}</h2><button type="button" id="wsOfficialClose" aria-label="${removing?'取消移除':'取消更换正式图'}">✕</button></header><p>${removing?'将要移除':'新正式图'}：${esc(version.name)}${version.width?` · ${version.width}×${version.height}`:''}</p><dl class="ws-official-impact"><div><dt>关联镜头</dt><dd>${esc(shots)}</dd></div><div><dt>既有旧参考</dt><dd>${esc(old)}</dd></div><div><dt>既有视频</dt><dd>${impact.videos.length?`${impact.videos.length} 个视频引用过这个资产；不会改写它们。`:'无'}</dd></div><div><dt>剪辑使用</dt><dd>${impact.clips?`${impact.clips} 段；不会自动替换。`:'未使用'}</dd></div></dl><p class="help-text">${removing?'移除后如果还有其他版本，会自动顺延一个正式图；版本字节仍保留，可撤销。':'本次只改变资产正式图与画布图片。旧版本保留。'}旧视频、剪辑和已提交任务不会被静默重写；${removing?'移除后':'更换后'}请在镜头清单逐镜复核参考变更。</p><footer><button type="button" id="wsOfficialCancel">取消</button><button type="button" id="wsOfficialConfirm" class="primary">${removing?'确认移除':'确认更换'}</button></footer></section>`;
  const close=()=>{document.removeEventListener('keydown',keys,true);overlay.remove();impactClose=null;};
  const keys=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();root.querySelector(focusSelector)?.focus();}else if(e.key==='Tab'){const buttons=[...overlay.querySelectorAll('button:not(:disabled)')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}}};
  impactClose=close;document.addEventListener('keydown',keys,true);document.body.append(overlay);
  overlay.querySelector('#wsOfficialClose').onclick=close;overlay.querySelector('#wsOfficialCancel').onclick=close;
  overlay.querySelector('#wsOfficialConfirm').onclick=()=>{const current=ctx.project().workstation.story.assets.find(item=>item.id===asset.id);if(!current||!current.imageVersions?.some(item=>item.id===version.id)){close();return ctx.toast('图片版本或资产已变化，请重新选择');}close();onConfirm();};
  overlay.querySelector('#wsOfficialCancel').focus();
 }
 async function probeImage(blob){let bitmap;try{bitmap=await createImageBitmap(blob);if(!bitmap.width||!bitmap.height||bitmap.width>32768||bitmap.height>32768)throw Error('图片尺寸无效或超过 32768 像素');return {width:bitmap.width,height:bitmap.height};}finally{bitmap?.close();}}
 async function importPlanningImages(assetId,files){
  if(imageImport)return ctx.toast('图片正在导入，请稍候');const projectId=ctx.project().id,asset=ctx.project().workstation.story.assets.find(a=>a.id===assetId);if(!asset)return;
  files=[...files];if(!files.length)return;if(files.length+(asset.imageVersions?.length||0)>IMAGE_VERSION_LIMIT)return ctx.toast(`每项资产最多保留 ${IMAGE_VERSION_LIMIT} 张图片，请先移除部分版本`);
  const job={projectId,assetId};imageImport=job;render();const added=[],errors=[];
  try{for(const file of files){
   if(ctx.project().id!==projectId||imageImport!==job||!active)break;
   try{const mime=await validateImageFile(file),dimensions=await probeImage(file);if(ctx.project().id!==projectId||imageImport!==job||!active)break;
    const version={id:crypto.randomUUID(),mediaId:crypto.randomUUID(),name:file.name,mime,size:file.size,...dimensions,createdAt:Date.now(),prompt:asset.prompt||''};
    await ctx.mediaStore.put({id:version.mediaId,kind:'image',name:version.name,mime,blob:file,...dimensions,createdAt:version.createdAt});
    if(ctx.project().id!==projectId||imageImport!==job||!active){await ctx.mediaStore.delete(version.mediaId);break;}added.push(version);
   }catch(e){errors.push(`${file.name}：${e.message}`);}
  }
  const current=ctx.project().id===projectId?ctx.project().workstation.story.assets.find(a=>a.id===assetId):null;
  if(current&&imageImport===job&&active&&added.length){try{ctx.checkpoint();addAssetImageVersions(current,added);ctx.commit();ctx.persist();previewImageId=added.at(-1).id;ctx.toast(`已导入 ${added.length} 张图片${errors.length?`；${errors.join('；')}`:''}`);}catch(e){for(const version of added)await ctx.mediaStore.delete(version.mediaId);ctx.toast(e.message);}}
  else{for(const version of added)await ctx.mediaStore.delete(version.mediaId);if(errors.length&&ctx.project().id===projectId&&active)ctx.toast(errors.join('；'));}
  }finally{if(imageImport===job){imageImport=null;if(active)render();}}
 }
 function wireImageDrop(el,assetId){el.ondragover=e=>{if(!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='copy';el.classList.add('ws-image-drop-active');};el.ondragleave=e=>{if(!el.contains(e.relatedTarget))el.classList.remove('ws-image-drop-active');};el.ondrop=e=>{if(!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();e.stopPropagation();el.classList.remove('ws-image-drop-active');focusId=assetId;importPlanningImages(assetId,e.dataTransfer.files);};}
 const revoke=()=>{if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}};
 const fmtBytes=n=>n>=1024*1024?(n/1024/1024).toFixed(1)+' MB':Math.round(n/1024)+' KB';
 const fmtDuration=s=>s==null?'—':(s>=60?Math.floor(s/60)+' 分 '+Math.round(s%60)+' 秒':s.toFixed(1)+' 秒');
 const labelsOf=t=>({image:'图片参考',video:'视频参考',audio:'音频参考'})[t]||t;

 async function importFiles(files){
  // 校验、探测、写媒体库与工程引用、checkpoint/commit 全部在 shell.importMediaFiles 内完成
  const {addedCount,errors}=await ctx.importMediaFiles(files);
  ctx.toast(addedCount?`已导入 ${addedCount} 个剪辑媒体${errors.length?`；${errors.join('；')}`:''}`:(errors.length?errors.join('；'):'没有可导入的媒体'));
  render();
 }

 async function deleteAsset(id){
  const ws=ctx.project().workstation;
  if(!removeMediaWithConsent(ws,id,{confirm:message=>window.confirm(message),checkpoint:ctx.checkpoint,commit:ctx.commit,persist:ctx.persist}))return;
  // Blob data remain available for undo and other project references.
  ctx.toast('已删除媒体，可通过撤销恢复');
  render();
 }

 async function previewAsset(id){
  revoke();
  const entry=await ctx.mediaStore.get(id);
  const box=root.querySelector('#wsAssetPreviewBody');
  if(!box)return;
  if(!entry){box.innerHTML='<p class="help-text">媒体内容缺失（可能来自旧备份或已被清理）。可删除该条目后重新导入。</p>';return;}
  previewUrl=URL.createObjectURL(entry.blob);
  box.innerHTML=entry.kind==='video'
   ?`<video src="${previewUrl}" controls preload="metadata"></video><p class="help-text">${esc(entry.name)} · ${fmtBytes(entry.size)}${entry.width?` · ${entry.width}×${entry.height}`:''}${entry.durationSec?` · ${fmtDuration(entry.durationSec)}`:''}</p>`
   :`<audio src="${previewUrl}" controls></audio><p class="help-text">${esc(entry.name)} · ${fmtBytes(entry.size)}${entry.durationSec?` · ${fmtDuration(entry.durationSec)}`:''}</p>`;
 }

 async function sendToEdit(id,track){
  const ws=ctx.project().workstation;
  const asset=ws.assets.find(a=>a.id===id);
  if(!asset)return;
  if(track==='video'&&asset.kind!=='video')return ctx.toast('视频轨只能加入视频素材');
  if(track==='audio'&&asset.kind!=='audio')return ctx.toast('音轨只能加入音频素材');
  if(ws.sequence[asset.kind==='video'?'video':'audio'].length>=200)return ctx.toast('该轨道已达 200 个片段上限，请先移除片段');
  ctx.checkpoint();
  if(!ctx.appendMediaClip(id))return ctx.toast('未能加入剪辑，请检查素材和轨道容量');
  ctx.commit();ctx.persist();
  ctx.toast(`已把「${asset.name}」加入${asset.kind==='video'?'视频轨 V1':'音轨 A1'}末尾`);
  ctx.goToPage('edit');
 }

 function render(){
  const ws=ctx.project().workstation;ws.story=normalizeStory(ws.story);if(contextualAssetId&&!ws.story.assets.some(a=>a.id===contextualAssetId)){contextualAssetId=null;focusId=null;}root.classList.toggle('ws-context-asset',mode==='planning'&&!!contextualAssetId);
  const canvasMedia=ctx.project().nodes.filter(n=>['image','video','audio'].includes(n.type)&&n.src);
  root.innerHTML=`
   <header class="ws-page-header"><div><h2>项目素材</h2><p>画布中的角色、场景、道具与媒体，在这里统一管理</p></div><div class="ws-header-actions"><button id="wsAssetImport" class="primary">＋ 导入视频 / 音频</button><input type="file" id="wsAssetFile" multiple accept="video/mp4,video/webm,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/webm" hidden></div></header>
   <nav class="ws-asset-tabs"><button data-asset-mode="planning" class="${mode==='planning'?'primary':''}">创作资产 · ${ws.story.assets.length}</button><button data-asset-mode="media" class="${mode==='media'?'primary':''}">媒体库 · ${ws.assets.length+canvasMedia.length}</button></nav><div class="ws-assets-body">
    <section class="ws-assets-main">
     ${mode==='planning'?planningHtml():''}<div class="ws-media-section" ${mode==='planning'?'hidden':''}>
     <h3>剪辑媒体 · ${ws.assets.length} 个 <small>（单个 ≤300 MB · 共 ≤500 个）</small></h3>
     ${ws.assets.length?`<div class="ws-asset-list">${ws.assets.map(a=>`
       <div class="ws-asset-row" data-asset="${esc(a.id)}">
        <span class="ws-asset-icon ${a.kind}">${a.kind==='video'?'▷':'♫'}</span>
        <span class="ws-asset-name" title="${esc(a.name)}">${esc(a.name)}${a.durationSec?`<small>${fmtDuration(a.durationSec)}</small>`:'<small>时长未知</small>'}</span>
        <span class="ws-asset-meta">${a.kind==='video'?'视频':'音频'} · ${fmtBytes(a.size)}</span>
        <span class="ws-asset-actions">
         <button data-preview="${esc(a.id)}">预览</button>
         ${a.kind==='video'?`<button data-send-video="${esc(a.id)}" title="追加到剪辑页视频轨 V1 末尾">→ V1</button>`:''}
         ${a.kind==='audio'?`<button data-send-audio="${esc(a.id)}" title="追加到剪辑页音轨 A1 末尾">→ A1</button>`:''}
         <button class="danger" data-delete="${esc(a.id)}" aria-label="删除媒体 ${esc(a.name)}" title="删除媒体；引用片段会先确认">✕</button>
        </span>
       </div>`).join('')}</div>`:'<p class="ws-empty">还没有剪辑媒体。点击右上角导入 MP4 / WebM / 音频；也可把画布视频节点「送入剪辑」，或在剪辑页直接导入。</p>'}
     <h3 style="margin-top:22px">画布媒体素材 · ${canvasMedia.length} 个</h3>
     ${canvasMedia.length?`<div class="ws-asset-list">${canvasMedia.map(n=>`
       <div class="ws-asset-row">
        <span class="ws-asset-icon ${n.type}">${n.type==='image'?'▧':n.type==='video'?'▷':'♫'}</span>
        <span class="ws-asset-name" title="${esc(n.title)}">${esc(n.title)}<small>画布节点 · ${labelsOf(n.type)}</small></span>
        <span class="ws-asset-actions">
         ${n.type!=='image'?`<button data-send-node="${esc(n.id)}" title="内容导入媒体库并追加到剪辑轨道">送入剪辑</button>`:''}
         <button data-locate="${esc(n.id)}" title="切回画布并定位该节点">定位 ↗</button>
        </span>
       </div>`).join('')}</div>`:'<p class="ws-empty">画布上还没有图片 / 视频 / 音频节点。</p>'}
    </div></section>
    <aside class="ws-assets-preview">${mode==='planning'?detailsHtml():'<h3>媒体预览</h3><div id="wsAssetPreviewBody"><p class="help-text">点击左侧「预览」查看媒体内容。</p></div>'}</aside>
   </div>`;
  root.classList.toggle('ws-flow-no-detail',mode==='planning'&&!focusId);
  if(mode==='planning'){wirePlanning();fillImageUrls();}
  root.querySelectorAll('[data-asset-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.assetMode;if(mode==='planning')contextualAssetId=null;revoke();render();});
  root.querySelector('#wsAssetImport').onclick=()=>{mode='media';render();root.querySelector('#wsAssetFile').click();};
  root.querySelector('#wsAssetFile').onchange=async e=>{const files=[...e.target.files];e.target.value='';if(files.length)await importFiles(files);};
  root.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>previewAsset(b.dataset.preview));
  root.querySelectorAll('[data-send-video]').forEach(b=>b.onclick=()=>sendToEdit(b.dataset.sendVideo,'video'));
  root.querySelectorAll('[data-send-audio]').forEach(b=>b.onclick=()=>sendToEdit(b.dataset.sendAudio,'audio'));
  root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteAsset(b.dataset.delete));
  root.querySelectorAll('[data-send-node]').forEach(b=>b.onclick=()=>ctx.sendCanvasNodeToEdit(b.dataset.sendNode));
  root.querySelectorAll('[data-locate]').forEach(b=>b.onclick=()=>ctx.locateCanvasNode(b.dataset.locate));
 }
 const kindLabel=k=>({character:'角色',scene:'场景',prop:'道具'})[k];
 function canvasThumbnail(a){const project=ctx.project();const ids=new Set(project.edges.filter(e=>e.from===a.canvasNodeId).map(e=>e.to));return project.nodes.find(n=>n.type==='image'&&n.src&&(n.id===a.canvasNodeId||ids.has(n.id)))?.src;}
 function thumbnail(a){const v=a.imageVersions?.find(v=>v.id===a.selectedImageId)||a.imageVersions?.[0];return v?imageElement(v,a.name+'参考图','loading="lazy"'):canvasThumbnail(a)?`<img src="${esc(canvasThumbnail(a))}" alt="${esc(a.name)}参考图" loading="lazy">`:`<span>${{character:'人',scene:'景',prop:'物'}[a.kind]}</span><small>${kindLabel(a.kind)}设定</small>`;}
 function imageStatus(a){return a.imageVersions?.some(v=>v.id===a.selectedImageId)?'正式图已选':a.imageVersions?.length?`${a.imageVersions.length} 张候选`:'待导入图片';}
 function planningHtml(){
  const story=ctx.project().workstation.story,items=story.assets.filter(a=>(planningFilter==='all'||a.kind===planningFilter)&&(!query||[a.name,a.description,a.prompt].join(' ').toLowerCase().includes(query.toLowerCase())));
  if(focusId&&!items.some(a=>a.id===focusId))focusId=null;
  const hasScript=!!ctx.project().workstation.script.trim(),hasAssets=story.assets.length>0;
  const syncPending=story.assets.some((asset,index)=>!isStoryNodeCurrent(asset,ctx.project().nodes.find(n=>n.id===asset.canvasNodeId),'assets',index)||!isAssetImageCurrent(ctx.project(),asset));
  return `<section class="ws-asset-agent ws-flow-agent"><div><h3>故事资产</h3><p>手工建立角色、场景和道具，导入图片后选择正式图；造梦工坊不自动生成剧本或资产。</p></div><div class="ws-flow-actions">${hasAssets?'<button id="wsPlanPackage">更新画布节点</button>':''}</div><p id="wsAssetAgentNote" role="status">导入本地图片 → 选定正式图 → 送入画布</p></section>
  <p class="ws-asset-save-state" role="status">${hasAssets?`编辑自动保存在工程中 · ${syncPending?'画布待更新，点击「更新画布节点」同步':'画布已同步'}`:'设定会自动保存，采用后可送入画布'}</p><div class="ws-asset-library-toolbar"><h3>创作资产 <small>${story.assets.length} 项 · ${story.assets.filter(a=>a.imageVersions?.some(v=>v.id===a.selectedImageId)).length} 项已有正式图</small></h3>${hasAssets?`<input id="wsAssetSearch" type="search" aria-label="搜索创作资产" placeholder="搜索名称或提示词">`:""}<button id="wsPlanAdd">＋ 新增</button>${planningSelected.size?`<button id="wsPlanSend">更新选中节点 · ${planningSelected.size}</button>`:''}</div>
  <div class="ws-asset-browser"><nav class="ws-asset-categories" aria-label="资产分类">${hasAssets?[['all','全部'],['character','角色'],['scene','场景'],['prop','道具']].map(([id,name])=>`<button data-plan-filter="${id}" class="${planningFilter===id?'primary':''}"><span>${name}</span><small>${id==='all'?story.assets.length:story.assets.filter(a=>a.kind===id).length}</small></button>`).join(''):''}<button id="wsPlanScript">打开剧本参考</button></nav><div class="ws-asset-grid">${items.map(a=>`<article class="ws-asset-tile ${a.id===focusId?'selected':''}" data-image-drop="${esc(a.id)}"><label class="ws-tile-select"><input type="checkbox" data-plan-select="${a.id}" aria-label="选择资产 ${esc(a.name)}" ${planningSelected.has(a.id)?'checked':''}></label><button data-plan-focus="${a.id}" class="ws-asset-tile-content" aria-label="查看资产 ${esc(a.name)}"><div class="ws-asset-placeholder ${a.kind}">${thumbnail(a)}</div><b>${esc(a.name)}</b><p>${esc(a.description||'点击填写资产设定')}</p><footer><span>${a.shotIds.length} 个关联镜头</span><em>${imageStatus(a)}</em></footer></button></article>`).join('')||`<div class="ws-asset-empty"><b>${query?'没有匹配的资产':'你的视觉资产从这里开始'}</b><p>${query?'换个关键词或分类试试。':(hasScript?'点击上方「设计资产」，先预览清单与提示词，再决定采用。':'打开剧本参考节点，导入已有剧本后再建立资产。')}</p></div>`}</div></div>`;
 }
 function localImagesHtml(a){
  const versions=a.imageVersions||[],official=versions.find(v=>v.id===a.selectedImageId),shown=versions.find(v=>v.id===previewImageId)||official||versions.at(-1),busy=imageImport?.assetId===a.id;
  return `<section class="ws-local-images" data-image-drop="${esc(a.id)}" aria-label="本地资产图片"><div class="ws-local-image-heading"><h3>资产图片 <small>${versions.length} / ${IMAGE_VERSION_LIMIT}</small></h3><button id="wsPlanImageImport" class="primary" ${imageImport||versions.length>=IMAGE_VERSION_LIMIT?'disabled':''}>${busy?'正在导入…':'＋ 导入图片'}</button><input id="wsPlanImageFile" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" multiple hidden></div>
  ${shown?`<div class="ws-local-image-preview">${imageElement(shown,a.name+' · '+shown.name)}<span>${shown.id===a.selectedImageId?'正式图':'候选图'}</span></div><p class="ws-image-filename" title="${esc(shown.name)}">${esc(shown.name)}</p><div class="ws-image-version-actions"><span>${shown.width} × ${shown.height} · ${fmtBytes(shown.size)}</span><button id="wsPlanImageUse" ${shown.id===a.selectedImageId?'disabled':''}>${shown.id===a.selectedImageId?'✓ 已选为正式图':'选为正式图'}</button><button id="wsPlanImageRemove" class="danger">移除此版本</button></div>
  <div class="ws-image-versions" role="group" aria-label="图片版本">${versions.map((v,i)=>`<button data-image-preview="${esc(v.id)}" class="${v.id===shown.id?'selected':''}" title="${esc(v.name)}${v.id===a.selectedImageId?' · 正式图':''}" aria-label="查看图片版本 ${i+1}${v.id===a.selectedImageId?'，正式图':''}" aria-pressed="${v.id===shown.id}">${imageElement(v,'版本 '+(i+1),'loading="lazy"')}<span>${v.id===a.selectedImageId?'✓ 正式':i+1}</span></button>`).join('')}</div>
  ${shown.prompt?`<details class="ws-image-prompt"><summary>导入时的提示词</summary><p>${esc(shown.prompt)}</p></details>`:''}`:`<div class="ws-image-drop-hint"><span>▧</span><b>把图片拖到这里，或点击导入</b><p>支持 Blender 渲染结果与其他本地图片</p></div>`}
  <p class="help-text">PNG / JPG / WebP · 每张 ≤20 MB。首张自动成为正式图，可随时切换版本；送入画布时使用正式图。</p></section>`;
 }
 function detailsHtml(){
  const story=ctx.project().workstation.story,a=story.assets.find(a=>a.id===focusId);
  if(!a)return '<div class="ws-detail-empty"><span>▧</span><h3>资产详情</h3><p>选择资产，在这里导入图片、选定版本或编辑设定。</p></div>';
  return `<article class="ws-asset-detail" data-plan-id="${a.id}"><header>${contextualAssetId?'<button id="wsAssetShowAll">← 全部资产</button>':''}<span class="ws-eyebrow">${kindLabel(a.kind)} · ${a.shotIds.length} 个镜头</span><button data-plan-delete="${a.id}" aria-label="删除资产 ${esc(a.name)}">删除</button></header>${localImagesHtml(a)}<div class="ws-writing-actions"><button id="wsAssetCopy" ${a.prompt?'':'disabled'}>复制提示词</button><button id="wsAssetSendOne" class="primary">更新画布节点</button></div><label class="field">名称<input data-plan-field="name" aria-label="资产名称" maxlength="200" value="${esc(a.name)}"></label><label class="field">类型<select data-plan-field="kind" aria-label="资产类型">${[['character','角色'],['scene','场景'],['prop','道具']].map(([id,name])=>`<option value="${id}" ${a.kind===id?'selected':''}>${name}</option>`).join('')}</select></label><label class="field">资产设定<textarea data-plan-field="description" aria-label="资产说明" maxlength="6000" rows="3">${esc(a.description)}</textarea></label><label class="field">图片提示词<textarea data-plan-field="prompt" aria-label="图片提示词" maxlength="6000" rows="5" placeholder="设计资产后自动填写，也可以自行编辑">${esc(a.prompt)}</textarea></label><details class="ws-image-more"><summary>更多设置与生成入口</summary><label class="field">避免内容<textarea data-plan-field="negativePrompt" aria-label="避免内容" maxlength="2000" rows="2">${esc(a.negativePrompt)}</textarea></label><p class="help-text">在画布节点使用「AI 生图」：ComfyUI 本地或 Seedream 云端。</p><label class="field">关联镜头 · ${a.shotIds.length}<select multiple data-plan-field="shotIds" aria-label="关联分镜" size="6">${story.shots.map((shot,i)=>`<option value="${shot.id}" ${a.shotIds.includes(shot.id)?'selected':''}>镜头 ${i+1} · ${esc(shot.scene)}</option>`).join('')}</select></label></details><p class="help-text">编辑自动保存在工程中 · 更新画布节点后同步设定与正式图</p></article>`;
 }
 function wirePlanning(){
  const ws=ctx.project().workstation;
  root.querySelector('#wsAssetShowAll')?.addEventListener('click',()=>{contextualAssetId=null;render();});
  const change=fn=>{ctx.checkpoint();fn();ctx.commit();ctx.persist();};
  root.querySelectorAll('[data-plan-filter]').forEach(b=>b.onclick=()=>{planningFilter=b.dataset.planFilter;render();});
  root.querySelectorAll('[data-plan-focus]').forEach(b=>b.onclick=()=>{if(focusId!==b.dataset.planFocus)previewImageId=null;focusId=b.dataset.planFocus;render();});
  root.querySelectorAll('[data-image-drop]').forEach(el=>wireImageDrop(el,el.dataset.imageDrop));
  const activeAsset=ws.story.assets.find(a=>a.id===focusId);
  root.querySelector('#wsPlanImageImport')?.addEventListener('click',()=>root.querySelector('#wsPlanImageFile').click());
  root.querySelector('#wsPlanImageFile')?.addEventListener('change',e=>{const files=[...e.target.files];e.target.value='';if(activeAsset)importPlanningImages(activeAsset.id,files);});
  root.querySelectorAll('[data-image-preview]').forEach(b=>b.onclick=()=>{previewImageId=b.dataset.imagePreview;render();});
  const shown=activeAsset?.imageVersions?.find(v=>v.id===previewImageId)||activeAsset?.imageVersions?.find(v=>v.id===activeAsset.selectedImageId)||activeAsset?.imageVersions?.at(-1);
  root.querySelector('#wsPlanImageUse')?.addEventListener('click',()=>{if(!activeAsset||!shown||shown.id===activeAsset.selectedImageId)return;confirmOfficialChange(activeAsset,shown,()=>{const current=ctx.project().workstation.story.assets.find(asset=>asset.id===activeAsset.id);if(!current||!current.imageVersions?.some(version=>version.id===shown.id))return ctx.toast('图片版本或资产已变化，请重新选择');change(()=>selectAssetImage(current,shown.id));previewImageId=shown.id;render();ctx.toast('正式图已更换，旧版本保留；请在镜头清单复核关联镜头');});});
  root.querySelector('#wsPlanImageRemove')?.addEventListener('click',()=>{if(!activeAsset||!shown)return;const remove=()=>{const current=ctx.project().workstation.story.assets.find(asset=>asset.id===activeAsset.id);if(!current||!current.imageVersions?.some(version=>version.id===shown.id))return ctx.toast('图片版本或资产已变化，请重新选择');change(()=>removeAssetImageVersion(current,shown.id));previewImageId=null;render();ctx.toast('已移除此版本，旧版本与媒体字节仍可撤销恢复');};if(shown.id===activeAsset.selectedImageId)confirmOfficialChange(activeAsset,shown,remove,{removing:true,focusSelector:'#wsPlanImageRemove'});else remove();});
  const search=root.querySelector('#wsAssetSearch');if(search){search.value=query;search.oninput=()=>{const cursor=search.selectionStart;query=search.value;render();const input=root.querySelector('#wsAssetSearch');input.focus();if(input.type!=='search')input.setSelectionRange(cursor,cursor);};}
  root.querySelector('#wsPlanScript')?.addEventListener('click',()=>ctx.toast('请在画布中打开剧本参考节点编辑内容'));
  root.querySelector('#wsPlanAdd').onclick=()=>{if(ws.story.assets.length>=300)return ctx.toast('策划资产最多 300 个');change(()=>{focusId=crypto.randomUUID();ws.story.assets.push({id:focusId,kind:planningFilter==='all'?'character':planningFilter,name:'新资产',description:'',prompt:'',negativePrompt:'',shotIds:[]});});render();};
  root.querySelector('#wsPlanPackage')?.addEventListener('click',()=>ctx.sendStoryPackageToCanvas());
  root.querySelector('#wsPlanSend')?.addEventListener('click',()=>ctx.sendStoryAssetsToCanvas([...planningSelected]));
  root.querySelectorAll('[data-plan-select]').forEach(e=>e.onchange=()=>{e.checked?planningSelected.add(e.dataset.planSelect):planningSelected.delete(e.dataset.planSelect);const id=e.dataset.planSelect;render();[...root.querySelectorAll('[data-plan-select]')].find(el=>el.dataset.planSelect===id)?.focus();});
  root.querySelectorAll('[data-plan-field]').forEach(e=>{
   const save=()=>{const current=ctx.project().workstation,a=current.story.assets.find(a=>a.id===e.closest('[data-plan-id]').dataset.planId),field=e.dataset.planField;
    if(!a)return;const value=field==='shotIds'?[...e.selectedOptions].map(o=>o.value):e.value;
    if(JSON.stringify(a[field])===JSON.stringify(value))return;
    const now=Date.now();if(now-lastEdit>1500){ctx.checkpoint();lastEdit=now;}a[field]=value;
    if(field==='shotIds')for(const shot of current.story.shots){shot.assetIds=shot.assetIds.filter(id=>id!==a.id);if(a.shotIds.includes(shot.id))shot.assetIds.push(a.id);}
    ctx.persist();const state=root.querySelector('.ws-asset-save-state');if(state)state.textContent='编辑自动保存 · 画布待更新，点击「更新画布节点」同步';const tile=root.querySelector(`[data-plan-focus="${a.id}"]`);if(tile){tile.querySelector('b').textContent=a.name;tile.querySelector('p').textContent=a.description;tile.querySelector('em').textContent=imageStatus(a);tile.querySelector('footer span').textContent=a.shotIds.length+' 个关联镜头';}
    const ready=!!a.prompt.trim();root.querySelector('#wsAssetCopy').disabled=!ready;
   };
   if(e.tagName!=='SELECT')e.oninput=save;e.onchange=()=>{save();ctx.commit();};
  });
  root.querySelector('#wsAssetCopy')?.addEventListener('click',async()=>{const a=ws.story.assets.find(a=>a.id===focusId);try{await navigator.clipboard.writeText(a.prompt);ctx.toast('提示词已复制');}catch{ctx.toast('复制失败，可选中文字后复制');}});
  root.querySelector('#wsAssetSendOne')?.addEventListener('click',()=>ctx.sendStoryAssetsToCanvas([focusId]));
  root.querySelectorAll('[data-plan-delete]').forEach(b=>b.onclick=()=>{const id=b.dataset.planDelete;change(()=>{ws.story.assets=ws.story.assets.filter(a=>a.id!==id);ws.story.shots.forEach(s=>s.assetIds=s.assetIds.filter(x=>x!==id));});planningSelected.delete(id);focusId=null;render();});
 }
 function onShow(options){active=true;if(lastProjectId!==ctx.project().id){revokeImageUrls();previewImageId=null;planningSelected.clear();focusId=null;contextualAssetId=null;mode='planning';planningFilter='all';query='';note='';lastProjectId=ctx.project().id;}style=ctx.project().workstation.writing?.artDirection||'';if(pending&&pending.projectId!==ctx.project().id)pending=null;if(request&&request.projectId!==ctx.project().id){request.controller.abort();request=null;}
  const input=normalizeAssetsOpenOptions(options);if(input.mode){mode=input.mode;if(mode==='media')contextualAssetId=null;}
  if(input.assetId){const asset=ctx.project().workstation.story.assets.find(a=>a.id===input.assetId);if(asset){if(focusId!==asset.id)previewImageId=null;focusId=asset.id;contextualAssetId=asset.id;mode='planning';planningFilter='all';query='';}else{focusId=null;contextualAssetId=null;}}
  else if(options&&Object.hasOwn(input,'mode'))contextualAssetId=null;
  render();}

 function onHide(){active=false;imageImport=null;revoke();revokeImageUrls();previewClose?.();impactClose?.();}
 return {onShow,open:onShow,onHide,importFiles};
}
