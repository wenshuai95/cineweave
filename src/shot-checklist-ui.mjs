// Markup-only shot checklist. All counts and next steps come from the live
// derivation in shot-production.mjs; this module never stores status.
import {shotProductionList} from './shot-production.mjs';
import {getLocale} from './i18n/index.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// 迁移期：只在浏览器(en-US)翻译 shot-production 生成的动态文案；
// Node 测试没有 document，继续看到中文原值，避免测试断言被语言影响。
const EN_EXACT = new Map([
  ['未关联资产','No assets linked'],['视频','videos'],['暂无视频','No videos'],['缺白模 / 生成视频','Missing previz / generated video'],
  ['白模已导出','Previz exported'],['生成视频','Generated video'],['参考视频','Reference video'],
  ['已用于剪辑','Used in Edit'],['未加入剪辑','Not in Edit'],['暂无视频可入剪辑','No video available for Edit'],
  ['参考无需复核','No reference review needed'],['暂无生成参考','No generated references'],
  ['资产齐','Assets ready'],['待补资产','Assets missing'],['有画面','Visual ready'],['待画面','Visual missing'],
  ['已入剪辑','In Edit'],['待剪辑','Not in Edit'],['待复核','Needs review'],
  ['修复资产关联','Fix asset links'],['关联资产','Link assets'],['补正式图','Add official images'],
  ['整理到画布','Arrange to canvas'],['导出白模或生成视频','Export previz or generate video'],
  ['复核参考变更','Review reference changes'],['送入剪辑','Send to Edit'],['查看镜头','View shot'],
  ['未整理到画布','Not arranged to canvas'],['资产关联已失效','Asset links are stale'],
  ['未关联角色 / 场景 / 道具','No character / scene / prop linked'],
  ['正式图或参考已变化，待复核','Official image or reference changed; review needed'],
  ['尚未加入剪辑','Not added to Edit yet'],['素材缺失','Missing asset'],
]);
const EN_PATTERNS = [
  [/^(\d+) 镜$/,m=>`${m[1]} shots`],
  [/^(\d+) 镜未上画布$/,m=>`${m[1]} shots not on canvas`],
  [/^(\d+) 镜未关联资产$/,m=>`${m[1]} shots without assets`],
  [/^(\d+) 镜缺正式图$/,m=>`${m[1]} shots missing official images`],
  [/^(\d+) 镜缺画面$/,m=>`${m[1]} shots missing visuals`],
  [/^(\d+) 镜待复核$/,m=>`${m[1]} shots need review`],
  [/^(\d+) 镜已进剪辑$/,m=>`${m[1]} shots in Edit`],
  [/^关联资产已移除 (\d+) 项$/,m=>`${m[1]} linked assets removed`],
  [/^缺 (\d+) 张正式图$/,m=>`${m[1]} official images missing`],
  [/^正式图齐 · (\d+) 项$/,m=>`Official images ready · ${m[1]} assets`],
  [/^白模已导出 · 生成视频 (\d+)$/,m=>`Previz exported · ${m[1]} generated videos`],
  [/^白模已导出 · (\d+) 段$/,m=>`Previz exported · ${m[1]} clips`],
  [/^生成视频 (\d+) 个$/,m=>`${m[1]} generated videos`],
  [/^参考视频 (\d+) 段 · 未生成$/,m=>`${m[1]} reference clips · not generated`],
  [/^已用于剪辑 · (\d+) 段$/,m=>`Used in Edit · ${m[1]} clips`],
  [/^(\d+) 个视频参考待复核$/,m=>`${m[1]} video references need review`],
  [/^(\d+) 个视频$/,m=>`${m[1]} videos`],
  [/^镜头 (\d+)(?: · (.+))?$/,m=>`Shot ${m[1]}${m[2]?' · '+m[2]:''}`],
  [/^(\d+) 处参考变化$/,m=>`${m[1]} reference changes`],
  [/^缺正式图：(.+)$/,m=>`Official images missing: ${m[1]}`],
];
function trShot(text){
  if(typeof document==='undefined'||getLocale()!=='en-US'||typeof text!=='string')return text;
  return EN_EXACT.get(text)||EN_PATTERNS.reduce((out,[re,fn])=>out!==text?out:out.replace(re,(...args)=>fn(args)),text);
}

const statusOrder=[['assets','资产'],['visual','画面'],['cut','剪辑'],['review','复核']];
function statusRows(item){
 return statusOrder.map(([key,label])=>{
  const status=item.statuses[key];
  return `<div class="shot-status" data-state="${esc(status.tone)}"><span class="shot-status-label" data-i18n="shots.${key}">${label}</span><span class="shot-status-text">${esc(trShot(status.text))}</span></div>`;
 }).join('');
}
function nextButton(item){
 const action=item.next;
 const attrs=`data-shot-action="${esc(action.action)}" data-shot-id="${esc(item.id)}"${action.assetId?` data-asset-id="${esc(action.assetId)}"`:''}${action.videoId?` data-video-id="${esc(action.videoId)}"`:''}`;
 return `<button type="button" class="shot-next ${action.action==='review'?'primary':''}" ${attrs}>${esc(trShot(action.label))}</button>`;
}
function row(item){
 const number=String(item.index+1).padStart(2,'0');
 const title=`镜头 ${number}${item.scene?' · '+item.scene:''}`,description=item.description||'';
 return `<li class="shot-list-item ${item.pending.length?'needs-review':''}" data-shot-item="${esc(item.id)}">
  <div class="shot-list-head"><button type="button" class="shot-list-title" data-shot-locate="${esc(item.id)}" aria-label="定位${esc(trShot(title))}"><span class="shot-number">${number}</span><span><b>${esc(item.scene||'未命名场景')}</b><small>${esc(description).slice(0,90)||'还没有画面描述'}${description.length>90?'…':''}</small></span></button><button type="button" class="ghost shot-edit" data-shot-action="open-script" data-shot-id="${esc(item.id)}" aria-label="编辑${esc(trShot(title))}的分镜表" data-i18n="shots.edit">编辑</button></div>
  <div class="shot-glance">${[['assets',trShot(item.statuses.assets.tone==='ok'?'资产齐':'待补资产')],['visual',trShot(item.visualReady?'有画面':'待画面')],['cut',trShot(item.inCut.used?'已入剪辑':'待剪辑')],...(item.pending.length?[['review',trShot('待复核')]]:[])].map(([key,label])=>`<span data-state="${esc(item.statuses[key].tone)}">${esc(trShot(label))}</span>`).join('')}</div>
  <details class="shot-details" data-shot-details="${esc(item.id)}"><summary><span data-i18n="shots.statusDetails">状态详情</span>${item.pending.length?` · ${item.pending.length} 处参考变化`:''}</summary>${statusRows(item)}${item.missing.length?`<p class="shot-missing">${esc(item.missing.map(trShot).join('；'))}</p>`:''}</details>
  <div class="shot-list-actions">${nextButton(item)}<span class="shot-list-meta">${item.videos.total?`${item.videos.total} ${trShot('视频')}`:trShot('暂无视频')}</span></div>
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
 return `<p class="shot-list-summary" role="status">${esc(parts.map(trShot).join(' · '))}</p>`;
}
export function shotChecklistHtmlFromItems(items){
 if(!items.length)return '<div class="shot-list-empty"><b data-i18n="shots.emptyTitle">还没有分镜</b><p data-i18n="shots.emptyText">先把故事整理成分镜，或在文稿里写下第一个镜头。镜头清单只读取现有数据，不会伪造进度。</p><div class="shot-list-empty-actions"><button type="button" data-shot-empty="script" data-i18n="shots.openWriting">打开镜头表</button><button type="button" data-shot-empty="story" data-i18n="shots.writeStory">新建镜头</button></div></div>';
 return `${summaryLine(items)}<ol class="shot-list">${items.map(row).join('')}</ol>`;
}
export function shotChecklistHtml(project){
 return shotChecklistHtmlFromItems(shotProductionList(project));
}
