import {bundleMemberIds,bundleVersionGroups} from './shot-bundles.mjs';
import {adoptedVideo,versionClips} from './video-versions.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function shotBundleCard(project,group){
 const ids=bundleMemberIds(project,group),members=project.nodes.filter(n=>ids.includes(n.id)),version=bundleVersionGroups(project,group)[0],adopted=version&&adoptedVideo(project,version),source=project.nodes.find(n=>n.id===group.shotSourceId);
 const preview=adopted||members.find(n=>n.type==='video'&&n.src)||members.find(n=>n.type==='image'&&n.src);
 const shot=members.find(n=>n.storyRef?.kind==='shot')||members.find(n=>n.type==='text'),text=shot?.text||source?.videoDraft?.prompt||source?.text||'连接参考素材，描述这个镜头。';
 const count=version?.memberIds.length||0,inCut=version&&project.workstation?.sequence&&versionClips(project,version).length;
 return `<div class="shot-bundle-preview">${preview?.type==='video'?`<video src="${esc(preview.src)}" controls preload="metadata" aria-label="${adopted?'已采用版本':'镜头参考'}预览"></video>`:preview?`<img src="${esc(preview.src)}" alt="镜头参考" draggable="false">`:'<span>镜头待创作</span>'}<small>${inCut?'已加入剪辑':adopted?'已采用版本':'待生成'}${count?' · '+count+' 个版本':''}</small></div><p class="shot-bundle-text" title="${esc(text)}">${esc(text.slice(0,300))}</p><div class="group-card-actions shot-bundle-actions"><button data-shot-generate="${esc(source?.id||'')}" ${source?'':'disabled'}>${count?'继续生成':'生成视频'}</button><button data-group-list="${esc(group.id)}">素材 · ${ids.length}</button>${version?`<button data-video-versions="${esc(version.id)}">版本 · ${count}</button>`:''}<button data-group-toggle="${esc(group.id)}">展开</button></div>`;
}
