// Markup-only shot checklist. All counts and next steps come from the live
// derivation in shot-production.mjs; this module never stores status.
import {shotProductionList} from './shot-production.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const statusOrder=[['assets','资产'],['visual','画面'],['cut','剪辑'],['review','复核']];
function statusRows(item){
 return statusOrder.map(([key,label])=>{
  const status=item.statuses[key];
  return `<div class="shot-status" data-state="${esc(status.tone)}"><span class="shot-status-label">${label}</span><span class="shot-status-text">${esc(status.text)}</span></div>`;
 }).join('');
}
function nextButton(item){
 const action=item.next;
 const attrs=`data-shot-action="${esc(action.action)}" data-shot-id="${esc(item.id)}"${action.assetId?` data-asset-id="${esc(action.assetId)}"`:''}${action.videoId?` data-video-id="${esc(action.videoId)}"`:''}`;
 return `<button type="button" class="shot-next ${action.action==='review'?'primary':''}" ${attrs}>${esc(action.label)}</button>`;
}
function row(item){
 const number=String(item.index+1).padStart(2,'0');
 const title=`镜头 ${number}${item.scene?' · '+item.scene:''}`,description=item.description||'';
 return `<li class="shot-list-item ${item.pending.length?'needs-review':''}" data-shot-item="${esc(item.id)}">
  <div class="shot-list-head"><button type="button" class="shot-list-title" data-shot-locate="${esc(item.id)}" aria-label="定位${esc(title)}"><span class="shot-number">${number}</span><span><b>${esc(item.scene||'未命名场景')}</b><small>${esc(description).slice(0,90)||'还没有画面描述'}${description.length>90?'…':''}</small></span></button><button type="button" class="ghost shot-edit" data-shot-action="open-script" data-shot-id="${esc(item.id)}" aria-label="编辑${esc(title)}的分镜表">编辑</button></div>
  <div class="shot-glance">${[['assets',item.statuses.assets.tone==='ok'?'资产齐':'待补资产'],['visual',item.visualReady?'有画面':'待画面'],['cut',item.inCut.used?'已入剪辑':'待剪辑'],...(item.pending.length?[['review','待复核']]:[])].map(([key,label])=>`<span data-state="${esc(item.statuses[key].tone)}">${esc(label)}</span>`).join('')}</div>
  <details class="shot-details" data-shot-details="${esc(item.id)}"><summary>状态详情${item.pending.length?` · ${item.pending.length} 处参考变化`:''}</summary>${statusRows(item)}${item.missing.length?`<p class="shot-missing">${esc(item.missing.join('；'))}</p>`:''}</details>
  <div class="shot-list-actions">${nextButton(item)}<span class="shot-list-meta">${item.videos.total?`${item.videos.total} 个视频`:'暂无视频'}</span></div>
 </li>`;
}
function summaryLine(items){
 const total=items.length,missingCanvas=items.filter(item=>!item.shotNodeId).length;
 const missingAssets=items.filter(item=>!item.assets.length||item.unresolvedAssetIds.length).length;
 const missingOfficial=items.filter(item=>item.assets.some(asset=>!asset.official)).length;
 const missingVisual=items.filter(item=>!item.visualReady).length;
 const pendingReview=items.filter(item=>item.pending.length).length;
 const inCut=items.filter(item=>item.inCut.used).length;
 const parts=[`${total} 镜`,missingCanvas?`${missingCanvas} 镜未上画布`:null,missingAssets?`${missingAssets} 镜未关联资产`:null,missingOfficial?`${missingOfficial} 镜缺正式图`:null,missingVisual?`${missingVisual} 镜缺画面`:null,pendingReview?`${pendingReview} 镜待复核`:null,inCut?`${inCut} 镜已进剪辑`:null].filter(Boolean);
 return `<p class="shot-list-summary" role="status">${esc(parts.join(' · '))}</p>`;
}
export function shotChecklistHtmlFromItems(items){
 if(!items.length)return '<div class="shot-list-empty"><b>还没有分镜</b><p>先把故事整理成分镜，或在文稿里写下第一个镜头。镜头清单只读取现有数据，不会伪造进度。</p><div class="shot-list-empty-actions"><button type="button" data-shot-empty="script">打开文稿与分镜</button><button type="button" data-shot-empty="story">写下故事</button></div></div>';
 return `${summaryLine(items)}<ol class="shot-list">${items.map(row).join('')}</ol>`;
}
export function shotChecklistHtml(project){
 return shotChecklistHtmlFromItems(shotProductionList(project));
}
