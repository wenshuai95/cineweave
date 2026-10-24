import './i18n/index.mjs';
import {setLocale, getLocale, t} from './i18n/index.mjs';
import {startI18nDom, applyI18n} from './i18n/dom.mjs';
import {openOnboarding, shouldShowOnboarding} from './onboarding.mjs';
import {translateToast} from './i18n/toast.mjs';
import {inlineNodeText,writeInlineNodeText} from './inline-node-text.mjs';
import {canvasRelations,wireRelationState,fitRelationView,snapshotCanvasView,relationTargets} from './canvas-focus.mjs';
import {collectTaskRecords,taskCenterCounts,filterTaskRecords,queryTaskRecord} from './task-center.mjs';
import {showTextSettings} from './workstation/text-settings.mjs';
import {directorFrameSamples} from './workstation/director-vision.mjs';
import {directorContext,directorSignature,prepareDirectorEdit} from './workstation/director-agent.mjs';
import {openMediaNodePanel} from './media-node-panel.mjs';
import {processMediaNode} from './media-processing-ui.mjs';
import {createCompatibleVideo} from './media-compatibility-ui.mjs';
import {positionNodeOverlay} from './node-popover.mjs';
import {freeNodePosition} from './node-placement.mjs';
import {createVideoVersionUI,videoVersionCard} from './video-versions-ui.mjs';
import {videoVersionGroup,adoptedVideo,collectVideoVersions} from './video-versions.mjs';
import './video-versions.css';
import {prepareCutCanvasResult} from './workstation/cut-library.mjs';
import {planCanvasImageResult,canvasImagePrompt} from './canvas-image-result.mjs';
import {imageAssetContext,generatedImageAssets,assetReferenceImpact,planGeneratedImageAdoption,applyGeneratedImageToAsset} from './workstation/asset-image-context.mjs';
import {shotProductionFor,reviewShotReferenceChanges,clearRestoredReferenceAcknowledgements} from './shot-production.mjs';
import {shotChecklistHtml} from './shot-checklist-ui.mjs';
import {CANVAS_TEMPLATES,planCanvasTemplate} from './canvas-templates.mjs';
import {nodePresentation,nodeQuickActions,visibleNodeActions} from './node-ui.mjs';
import './node-ui.css';
import {boardItems,boardWires,collapsedGroupFor,groupCardRect,ensureStoryShotGroup,detachGroupNode} from './board-presentation.mjs';
import {planShotBundle,bundleMemberIds,bundleVersionGroups,hiddenByShotBundle} from './shot-bundles.mjs';
import {groupAwareSelection} from './canvas-selection.mjs';
import {shotBundleCard} from './shot-bundles-ui.mjs';
import {planCanvasArrangement} from './canvas-arrange.mjs';
import {sendStoryToCanvas,sendStoryPackageToCanvas,syncAssetImageLinks} from './workstation/story-canvas.mjs';
import {freeCanvasPosition,getScriptNode,ensureScriptNode,syncCanonicalNodes,getCanvasStoryContext,editStoryNode,promoteTextToScript} from './workstation/canvas-source.mjs';
import {hydrateAssetImages} from './workstation/asset-image-handoff.mjs';
import {validateImageFile} from './workstation/asset-images.mjs';
import {recordingFormat} from './video-format.mjs';
import {appendDirectorVideo} from './director-output.mjs';
import {installWorkstation} from './workstation/shell.mjs';
import {prepareCreativeAdoption,normalizeCreativeTasks} from './workstation/creative-agent.mjs';
import {buildWorkstationBackup,restoreWorkstationBackup,BACKUP_SCHEMA,projectMediaReferences} from './workstation/backup.mjs';
import {adjacentKeyTime,adjacentParameterKeyTime,advancePlayTime,frameTimecode,installPlayheadScrub} from './timeline-playhead.mjs';
import {holdFrameLimit,holdFrameTime} from './action-hold.mjs';
import {exportCharacterCandidates} from './export-characters.mjs';
import {keyRefId,resolveKeyRefs,moveTimelineKeys,deleteTimelineKeys,keysInBox} from './timeline-multiselect.mjs';
import {pathWalkRange,pathWalkActions,preferredWalkClip,preferredRunClip,pathMotionKind,overlappingPathActions,preferredIdleClip} from './path-walk.mjs';
import {groundColors,DEFAULT_GROUND_COLOR} from './ground-colors.mjs';
import {contentEnd,resizeProjectDuration} from './project-duration.mjs';
import {pathHandleDefaults,draftPathEdit} from './path-edit.mjs';
import {installPanelLayout} from './panel-layout.mjs';
import {clipLabel} from './clip-labels.mjs';
import {shotTiming,actionTiming,moveTimelineKey,deleteTimelineKey,snapTime} from './timeline-edit.mjs';
import {projectLibrary} from './project-library.mjs';
import {createProjectManager} from './project-manager.mjs';
import {createProjectSaver} from './project-saver.mjs';
import {showContextMenu} from './context-menu.mjs';
import {modelNodeToStage,connectCanvasNodes} from './generated-model.mjs';
import {installPortDrag} from './connections.mjs';
import './style.css';
import './ui-polish.css';
import './node-popover.css';
import './shot-checklist.css';
import './cineweave.css';
import './canvas-simple.css';
import './interface-standards.css';
import {uiIcon,renderNodeText,formatSelection,composerView} from './canvas-content.mjs';
import {actorVariants} from './actors.mjs';
import {formats,formatFor,positionTimes,toggleSolo,editorVisible} from './director.mjs';
import {checkGLB} from './asset-loader.mjs';
import {classifyImportFile,planImportBatch,boardPointFromClient,staggeredNodeOrigins} from './drop-import.mjs';
import {Stage} from './stage.js';
import {navigationCodes} from './navigation.mjs';
import {poses,parameters,parameterIds,transformParameterIds,addTransformKey,parameterValue,setParameterValue,sampleBaseObject,addParameterKey,editParameters,removeParameterKey} from './model.mjs';
import {motions,motionDraft,actionRange} from './presets.mjs';
import {installNumberScrub} from './number-scrub.mjs';
import {saveSelection,restoreSelection} from './selection-memory.mjs';
import {shotReferencePlan,referenceManifest,timecode} from './shot-reference.mjs';
import {createTimelineNav,clampTimelineZoom,timelineTicks,saveTimelineScroll,restoreTimelineScroll} from './timeline-nav.mjs';
import {isAnimatedTrack} from './timeline-filter.mjs';
import {nodeMatchesQuery} from './node-search.mjs';
import {saveWorkspaceState,loadWorkspaceState} from './workspace-state.mjs';
import {CANVAS_CLIP_MIME,nodesInRect,buildCanvasCopy,pasteCanvasCopy,alignSelection,distributeSelection,pruneGroups,groupBounds,groupsForSelection,regroup,minimapBounds,sanitizeSelection} from './board-operations.mjs';
import {installNumberFields} from './number-field.mjs';
import {zipFiles} from './reference-zip.mjs';
import {uid,clone,clamp,types,object,sampleObject,frame,addKey,activeCamera,starterProject as demoProject,validateProject} from './model.mjs';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)],esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const IS_WIN=/Windows/i.test(navigator.userAgent),K=IS_WIN?'Ctrl':'⌘';
let p=demoProject(),mode='board',selected=null,time=0,playing=false,last=0,dirty=false,history=[],future=[],exporting=false,override=null,filter='all',stage,mediaTarget=null,assetCatalog=[],focusAfterLoad=null,selectedEdge=null;
let wsShell=null; // Canvas-first workstation with contextual script and asset tools.
let timelineSelection=null,timelineGesture=null;let timelineNav=null;
const modeMemory={board:null,stage:null};
let activeDirectorId=null;
const expandedTracks=new Map();
const trackExpanded=o=>expandedTracks.get(o.id)??o.id===selected;
let libraryOpen=false,libraryGroup="",libraryQuery="";
let loopPlayback=false,followPlayhead=true,animatedOnly=false,nodeQuery="";
let pendingTimelineScroll=null;
// v1.2.10 画布多选 / 工具 / 编组 / 小地图状态（模块级，随工程切换重置选择）。
let boardSelection=[],boardTool='select',spaceHand=false,boardGesture=null,minimapOn=true,canvasClipboard=null,canvasClipboardToken="",pasteSerial=0,nudgeStamp=0,minimapRaf=0,minimapProj=null,minimapDragProjection=null,boardPointer={x:null,y:null};
const nodeHeights=new Map();
let relationReturnView=null,relationProject=null,objectFilter="all";

const assetGroups=[['character-cartoon','卡通人物'],['character-realistic','写实比例人物'],['animal-cartoon','卡通动物'],['animal-realistic','写实动物'],['vehicle','车辆'],['building','建筑'],['environment','环境'],['geometry','基础几何体'],['furniture','桌椅家具']];
const icons={actor:'♙',box:'▧',wall:'▥',table:'⊓',pillar:'▯',camera:'▣',text:'≡',scene:'▱',director:'◈',image:'▧',video:'▷',audio:'♫',model:'⬡'};
const labels={text:'文本 / 笔记',actor:'角色资产',scene:'场景资产',director:'3D 导演台',image:'图片参考',video:'视频参考',audio:'音频参考',model:'3D 模型'};
const library=projectLibrary();let managerOpen=true,activeProject=false,transitioning=false,localWork=0,releaseProjectLock=null;
document.body.classList.add('project-home');
$('#app').innerHTML=`<div class="app"><header class="topbar"><div class="brand"><div class="mark" aria-hidden="true">${uiIcon('weave')}</div><div><b>造梦工坊</b><small>CineWeave</small></div></div><div class="divider"></div><input class="project-title" id="projectName" aria-label="工程名称" maxlength="200"><span class="muted optional">/</span><div class="tabs"><button id="boardTab" class="active" data-i18n="nav.canvas">画布</button><button id="stageTab" data-i18n="nav.director">3D 导演台</button></div><span class="grow"></span><button class="ghost" id="helpBtn" title="使用指南与快捷键">?</button><button id="projectsHome" title="保存并返回项目管理" data-i18n="topbar.projects">项目库</button><button id="projectBtn" data-i18n="topbar.project">工程</button><button id="taskCenterBtn" title="任务中心：创作、图片、视频与交付任务" data-i18n="topbar.tasks">任务</button><button id="saveBtn" title="保存到本机 · ${K}+S" data-i18n="topbar.save">保存</button><button id="settingsBtn" class="ghost" title="API、保存与存储设置" data-i18n="topbar.settings">设置</button><button class="primary" id="exportBtn" data-i18n="topbar.export">导出预演 ↗</button></header>
<div class="workbench"><aside class="sidebar"><div class="sidebar-tabs"><button id="projectAssetsTab" class="active" aria-pressed="true" data-i18n="canvas.nodes">节点列表</button><button id="offlineAssetsTab" aria-pressed="false">⬡ <span data-i18n="canvas.offlineModels">离线模型库</span></button></div><div id="projectSidebar"><section id="boardSidebarPane" aria-label="节点列表"><div class="section-label"><span data-i18n="canvas.categories">节点分类</span> <button id="addBtn" title="新建画布节点" aria-label="新建画布节点">＋</button></div><nav id="boardNav" aria-label="画布节点分类">${[['all','▦',t('canvas.all')],['text','≡',t('canvas.text')],['image','▧',t('canvas.image')],['video','▷',t('canvas.video')],['audio','♫',t('canvas.audio')],['actor','♙',t('canvas.actor')],['scene','▱',t('canvas.scene')],['model','⬡',t('canvas.model')],['director','◈',t('canvas.director')]].map(([id,icon,name])=>`<button type="button" class="navitem" data-filter="${id}">${icon}　${name}<span></span></button>`).join('')}</nav><div class="node-search-row"><input id="nodeSearch" type="search" placeholder="搜索节点：名称或文字内容" data-i18n-placeholder="canvas.searchNodes" aria-label="搜索画布节点" autocomplete="off"><button id="nodeSearchClear" class="ghost" hidden aria-label="清空节点搜索" title="清空搜索">✕</button></div><div class="section-label"><span data-i18n="canvas.nodeList">节点列表</span> <span id="boardAssetCount"></span></div><div id="boardAssetList" class="board-asset-list"></div></section><section id="stageSidebarPane" class="hidden" aria-label="导演台场景对象"><div class="section-label"><span data-i18n="canvas.sceneObjects">场景对象</span> <span id="stageObjectCount"></span></div><button id="clearSolo" class="solo-exit hidden" data-i18n="canvas.exitSolo">退出全部 Solo · 恢复显示</button><div class="object-filters" role="group" aria-label="筛选场景对象"><button type="button" data-object-filter="all" aria-pressed="true" data-i18n="canvas.filterAll">全部</button><button type="button" data-object-filter="character" aria-pressed="false" data-i18n="canvas.filterCharacter">角色</button><button type="button" data-object-filter="scene" aria-pressed="false" data-i18n="canvas.filterScene">场景</button><button type="button" data-object-filter="camera" aria-pressed="false" data-i18n="canvas.filterCamera">机位</button></div><div class="object-list" id="objects"></div></section><div class="sidebar-foot"><div class="row"><span class="led"></span><span id="saveModeLabel">本地创作 · 自动保存</span></div></div></div><section id="offlineSidebar" class="hidden" aria-label="离线模型库"><div class="offline-heading"><b data-i18n="canvas.offlineModels">离线模型库</b><span id="libraryCount" class="badge"></span></div><input id="assetSearch" type="search" placeholder="搜索人物、动物、模型名称" data-i18n-placeholder="canvas.searchOffline" aria-label="搜索离线模型"><div id="assetCategories" class="offline-categories" role="group" aria-label="模型分类"></div><p id="assetGroupNote" class="asset-group-note"></p><div class="asset-grid" id="assetGrid"></div><div class="offline-footer"><button id="importGLB" data-i18n="canvas.importGlb">＋ 导入本地 GLB</button><small data-i18n="canvas.offlineHint">点击缩略图加入导演台 · 全部可离线使用</small></div></section></aside><div class="panel-splitter " data-panel-resize="left" role="separator" tabindex="0" aria-label="调整左侧栏宽度" aria-orientation="vertical" title="拖拽调整大小 · 双击恢复默认 · 方向键微调"></div>
<main class="center"><div class="workspace-toolbar"><button id="canvasLibraryToggle" aria-expanded="false" title="展开或收起节点列表">${uiIcon('library')}节点列表</button><div class="stage-nav" id="stageNav" role="group" aria-label="创作阶段"><button type="button" data-stage="script">剧本</button><button type="button" data-stage="shots">镜头</button><button type="button" data-stage="assets">资产</button><button type="button" data-stage="previz">预演</button><button type="button" data-stage="generate">生成</button><button type="button" data-stage="edit">剪辑</button></div><button id="shotListBtn" aria-expanded="false" aria-controls="shotChecklist" title="按镜头查看资产正式图、白模 / 生成视频、剪辑使用与参考变更">${uiIcon('storyboard')}镜头清单</button><div><span class="workspace-title" id="workspaceTitle">画布</span><span class="breadcrumb" id="workspaceSub"></span></div><span class="grow"></span><button id="layoutBtn" title="布局预设 · 面板收起与恢复 · 我的布局">◱ 布局</button><button id="undoBtn" title="撤销 ${K}+Z" aria-label="撤销">${uiIcon('undo')}</button><button id="redoBtn" title="重做 ${K}+Shift+Z" aria-label="重做">${uiIcon('redo')}</button><div class="divider"></div><button id="importMedia">＋ 导入素材</button><button id="quickAdd">${uiIcon('plus')}新建</button><button id="workflowTemplates">流程模板</button><button id="canvasMore" aria-label="更多画布操作">${uiIcon('more')}</button><button id="directorAssistantBtn" class="hidden">${uiIcon('spark')}白模助手</button><button id="addCameraBtn" class="hidden">＋ 摄像机</button></div>
<div class="board-wrap" id="board" tabindex="0" role="region" aria-label="画布工作区"><div class="board-world" id="world"><svg class="connections" id="edges"></svg><div id="nodes"></div></div><div id="nodeActionBar" class="node-action-bar" role="toolbar" aria-label="所选节点的操作" hidden></div><div class="board-toolbar" id="boardToolbar" role="toolbar" aria-label="画布工具与批量操作"><button id="toolSelect" class="active" aria-pressed="true" title="选择工具 · V：点击节点、空白拖拽框选，Shift / ${K} 点击加选减选" aria-label="选择工具">${uiIcon('select')}<span class="tool-label">选择</span><kbd>V</kbd></button><button id="toolHand" aria-pressed="false" title="抓手工具 · H：左键拖拽平移画布；按住 Space 临时切换" aria-label="抓手工具">${uiIcon('hand')}<span class="tool-label">抓手</span><kbd>H</kbd></button><span class="divider"></span><span id="boardSelCount" class="board-sel-count" aria-live="polite">未选中</span><span class="divider"></span><button id="bundleShotBtn" data-i18n="canvas.bundleShots" title="选中视频生成入口或版本，把分镜、直接参考和版本收成镜头卡">整理镜头</button><button id="boardGroupBtn" data-i18n="canvas.group" title="把所选节点编组 · ${K}G：点组标题选整组、拖标题整体移动">▣ 编组</button><button id="collapseStoryBtn" data-i18n="canvas.collapseShots" title="把已有分镜收进一张卡片，节点和连线保留">▤ 收起分镜</button><button id="boardUngroupBtn" data-i18n="canvas.ungroup" title="解组所选节点所在的组 · ${K}+Shift+G">◧ 解组</button><button id="boardAlignBtn" data-i18n="canvas.align" title="多选对齐与等距分布（至少 2 / 3 个节点）">⇹ 对齐 ▾</button><button id="boardCopyBtn" data-i18n="canvas.copy" title="复制所选节点与内部连线 · ${K}+C，可跨工程粘贴">⧉ 复制</button><button id="boardPasteBtn" data-i18n="canvas.paste" title="粘贴画布节点 · ${K}+V">⎘ 粘贴</button><button id="boardDeleteBtn" data-i18n="canvas.delete" class="danger" title="删除所选节点（只删画布节点与连线，不动导演台对象 / 镜头 / 动作）· Delete">✕ 删除</button><span class="divider"></span><button id="minimapToggle" aria-pressed="true" title="小地图 开 / 关：显示节点与视口，可拖动定位">◫</button><button id="canvasKeysBtn" data-i18n="canvas.shortcuts" title="画布快捷键速查（可搜索）">⌘ 快捷键</button></div><div class="board-minimap" id="boardMinimap"><canvas id="minimapCanvas" width="168" height="112" aria-label="画布小地图：拖动定位视口" title="拖动定位视口"></canvas></div><div class="board-controls"><button id="zoomOut" class="ghost" aria-label="缩小">−</button><button id="zoomLabel" class="ghost" title="适应全部">80%</button><button id="zoomIn" class="ghost" aria-label="放大">＋</button><button id="fitBoard" class="ghost" data-i18n="canvas.fit">适应画布</button><span class="board-relation-controls"><button id="focusRelations" disabled data-i18n="canvas.focus">聚焦关系</button><button id="returnRelationView" hidden data-i18n="canvas.returnView">返回视角</button></span><button id="cutEdge" disabled data-i18n="canvas.cutEdge">✂ 剪断连线</button></div><div class="board-hint" data-i18n="canvas.hint">V 选择 / H 抓手 · 空白拖拽框选 · Shift / ${K}+点击 加选 · Space 临时抓手 · 中键或 Shift+滚轮平移 · 滚轮缩放 · F 适应全部 · 从访达拖入素材 · 右键节点展开操作</div></div>
<div class="stage-shell hidden" id="stageShell"><div class="stage-host" id="stage"></div><div class="stage-top"><button data-transform="select" aria-pressed="false" title="选择 0">↖ 0</button><button data-transform="translate" aria-pressed="true" class="active" title="移动 1">↔ 1</button><button data-transform="rotate" aria-pressed="false" title="旋转 2">⟳ 2</button><button data-transform="scale" aria-pressed="false" title="缩放 3">⤢ 3</button><button id="groundBtn" title="落到地面 G" data-i18n="stage.ground">落地 G</button><div class="divider"></div><button id="viewPreset" data-i18n="stage.perspective">透视 ▾</button><button id="frameSelection" data-i18n="stage.focus">聚焦</button></div><div id="pathControls" class="path-controls hidden"></div><div class="stage-label"><span class="led"></span><span data-i18n="stage.stageLabel">实时三维 / 米</span></div><div class="stage-caption" data-i18n="stage.stageCaption">WASD 移动 · QE 升降 · IJKL / 左拖转向 · 右拖平移 · Alt＋滚轮调视野</div></div>
<div class="panel-splitter hidden" data-panel-resize="timeline" role="separator" tabindex="0" aria-label="调整时间轴高度" aria-orientation="horizontal" title="拖拽调整大小 · 双击恢复默认 · 方向键微调"></div><div class="timeline hidden" id="timeline"><div class="timeline-toolbar"><button id="goStart" class="ghost" aria-label="回到开头">|◁</button><button id="playBtn" class="primary" aria-label="播放">▶</button><span class="timecode" id="timecode">00:00.00</span><button id="timelineDuration" title="调整时间轴总时长" aria-label="调整时间轴总时长">时长 <span id="durationLabel">12.00s</span> ▾</button><span class="grow"></span><button id="deleteTimeline" class="danger" disabled title="删除选中的关键帧或动作片段（Delete / Backspace）" data-i18n="stage.deleteSelection">删除所选</button><button id="actionPresetBtn" data-i18n="stage.addAction">＋ 角色动作</button><button id="motionPresetBtn" data-i18n="stage.addCameraMove">＋ 运镜</button><button id="addKeyBtn" data-i18n="stage.addKeyframe">◇ 添加关键帧</button><button id="shotsBtn" data-i18n="stage.shotSequence">镜头编排</button></div><div class="timeline-navigation" aria-label="时间轴横向导航"><button id="timelineZoomOut" aria-label="缩小时间轴">−</button><span id="timelineZoomLabel">100%</span><button id="timelineZoomIn" aria-label="放大时间轴">＋</button><button id="timelineFit" title="在全部时长与细节缩放之间切换" data-i18n="stage.fitAll">适应全部</button><button id="timelineLoop" aria-pressed="false" title="循环播放：到结尾后回到开头继续；不影响单次播放和导出" data-i18n="stage.loop">↻ 循环</button><button id="animatedOnlyBtn" aria-pressed="false" title="只显示有动画的轨道（姿态键、参数键、动作/路径或镜头用到）；仅影响显示，不改工程" data-i18n="stage.animatedOnly">仅动画</button><button id="followToggle" aria-pressed="true" title="播放时保持播放杆可见；手动横滚会暂停跟随" data-i18n="stage.follow">◉ 跟随</button><span data-i18n="stage.timelineHint">Alt＋滚轮以鼠标缩放 · Shift＋滚轮横移 · 中键平移</span></div><div class="timeline-help" id="timelineHelp" data-i18n="stage.timelineHelp">拖拽调整时间 · Delete 删除 · 双击编辑</div><div class="timeline-main" id="tracks"></div></div></main><div class="panel-splitter " data-panel-resize="right" role="separator" tabindex="0" aria-label="调整属性栏宽度" aria-orientation="vertical" title="拖拽调整大小 · 双击恢复默认 · 方向键微调"></div>
<aside class="inspector"><div class="inspector-header"><span id="inspectorTitle">创作概览</span><span class="muted" title="双击全选输入 · 左右拖动调值 · Shift 精调 · Enter 提交 · Esc 取消">${IS_WIN?'⇆':'⌘'}</span></div><div id="properties"></div><div class="panel-splitter " data-panel-resize="preview" role="separator" tabindex="0" aria-label="调整机位监看高度" aria-orientation="horizontal" title="拖拽调整大小 · 双击恢复默认 · 方向键微调"></div><div class="inspector-section" id="previewSection"><div class="row between"><h3 data-i18n="stage.preview">机位监看</h3><select id="previewSelect" aria-label="预览机位"></select></div><div class="preview" id="preview"></div><div class="preview-name" id="previewName"></div><div class="row" style="margin-top:12px"><button id="captureBtn" class="grow" data-i18n="stage.capture">▣ 截图到画布</button><button id="depthBtn" class="grow" data-i18n="stage.depth">◐ 深度图</button></div></div></aside></div><footer class="statusbar"><button id="saveStatus" class="status-save" title="保存状态与设置">● 本地已就绪</button><span id="stats"></span><span class="right">本地工作空间　·　<span id="renderStatus">准备中</span></span></footer></div><input type="file" id="mediaFile" multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4"><input type="file" id="projectFile" accept=".json,application/json"><input type="file" id="modelFile" accept=".glb"><div id="contextMenu" class="hidden" role="menu"></div><div id="modalRoot"></div>`;
let canvasLibraryOpen=false;
try{canvasLibraryOpen=localStorage.getItem('cineweave-library-open')==='true';}catch{}
function toggleCanvasLibrary(open=!canvasLibraryOpen){canvasLibraryOpen=open;document.body.classList.toggle('canvas-library-open',open);$('#canvasLibraryToggle').setAttribute('aria-expanded',String(open));if(open&&panelLayout.isCollapsed('left'))panelLayout.expand('left');try{localStorage.setItem('cineweave-library-open',String(open));}catch{}stage?.resize();refreshNodeOverlays();}
document.body.classList.toggle('canvas-library-open',canvasLibraryOpen);
$('#canvasLibraryToggle').setAttribute('aria-expanded',String(canvasLibraryOpen));
$('#canvasLibraryToggle').onclick=()=>toggleCanvasLibrary();
$('#directorAssistantBtn').onclick=()=>wsShell?.openTool('assistant',{mode:'director'});
$('#canvasMore').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();showContextMenu($('#contextMenu'),{x:r.left,y:r.bottom+6,title:'画布操作',items:[['流程模板','workflowTemplates'],['布局与面板','layoutBtn'],['小地图开关','minimapToggle'],['导入素材','importMedia'],['编组所选节点','boardGroupBtn'],['解组所选节点','boardUngroupBtn'],['对齐与分布','boardAlignBtn'],['整理所选镜头','bundleShotBtn'],['采用镜头送入剪辑','sendVideoVersions'],['收起已有分镜','collapseStoryBtn'],['快捷键','canvasKeysBtn']].map(([label,id])=>({label,disabled:!!$('#'+id)?.disabled,run:()=>$('#'+id)?.click()}))});};
function toast(msg){msg=translateToast(msg);$('.toast')?.remove();const d=document.createElement('div');d.className='toast';d.role='status';d.textContent=msg;document.body.append(d);setTimeout(()=>d.remove(),4200)}
function checkpoint(){nudgeStamp=0;history.push(clone(p));if(history.length>30)history.shift();future=[];updateUndo()}
function updateUndo(){$('#undoBtn').disabled=!history.length;$('#redoBtn').disabled=!future.length}
let layoutReady=false; // install 期间的首次 apply() 发生在 panelLayout 赋值前，此时跳过恢复条渲染。
const panelLayout=installPanelLayout({root:$('.workbench'),onStart(){stage?.orbit.clear()},onResize(){stage?.resize();renderLayoutRestore()}});
layoutReady=true;
{const bar=document.createElement('div');bar.id='layoutRestore';bar.className='layout-restore hidden';bar.setAttribute('aria-label','恢复已收起的面板');$('.center').append(bar);}
function renderLayoutRestore(){const bar=$('#layoutRestore');if(!bar||!layoutReady)return;const items=[['left','▸ 素材栏'],['right','◂ 属性栏'],['timeline','▴ 时间轴'],['preview','▴ 机位监看']].filter(([key])=>panelLayout.isCollapsed(key));bar.classList.toggle('hidden',!items.length);bar.innerHTML=items.map(([key,label])=>`<button data-restore-panel="${key}" title="恢复此面板">${label}</button>`).join('');$$('[data-restore-panel]').forEach(b=>b.onclick=()=>panelLayout.expand(b.dataset.restorePanel));}
$('#layoutBtn').onclick=e=>{e.currentTarget.blur();const r=e.currentTarget.getBoundingClientRect();const panelItems=[['left','左侧素材栏'],['right','右侧属性栏'],['timeline','时间轴'],['preview','机位监看']].map(([key,name])=>({label:(panelLayout.isCollapsed(key)?'恢复':'收起')+name,run:()=>panelLayout.togglePanel(key)}));
 showContextMenu($('#contextMenu'),{x:r.left,y:r.bottom+4,title:'布局',items:[
  {label:'布局预设',children:[{label:'构图 · 大画布',run:()=>panelLayout.applyPreset('compose')},{label:'动画 · 高时间轴',run:()=>panelLayout.applyPreset('animate')},{label:'预演 · 大机位监看',run:()=>panelLayout.applyPreset('preview')}]},
  {label:'保存当前为「我的布局」',run:()=>{panelLayout.saveCustom();toast('已保存当前布局为「我的布局」')}},
  {label:'应用「我的布局」',run:()=>{if(!panelLayout.applyCustom())toast('还没有保存过「我的布局」')},disabled:!panelLayout.hasCustom()},
  {label:'恢复默认布局',run:()=>{panelLayout.reset();toast('布局已恢复默认')}},
  {label:'面板收起 / 恢复',children:panelItems},
 ]});};
const SAVE_PREF='director-canvas-save-delay-v1';
let saveDelay=350,lastSavedAt=null;
try{const raw=localStorage.getItem(SAVE_PREF),value=raw===null?350:JSON.parse(raw);if([350,5000,15000,30000,null].includes(value))saveDelay=value;}catch{}
function saveStatus(state){dirty=state!=='saved';const el=$('#saveStatus');if(state==='saved')lastSavedAt=new Date();el.textContent=state==='saving'?'● 正在保存…':state==='saved'?'● 已保存 '+lastSavedAt.toLocaleTimeString('zh-CN',{hour12:false}):state==='pending'?(saveDelay===null?'● 有未保存更改':'● 等待自动保存'):'● 保存失败 · 点击重试';el.classList.toggle('save-warn',state==='error');el.classList.toggle('save-pending',state==='pending');}
const projectSaver=createProjectSaver(snapshot=>library.save(snapshot),saveStatus,saveDelay);
let canonicalFrame=0;
function persist(){clearRestoredReferenceAcknowledgements(p);if(syncCanonicalNodes(p)&&!canonicalFrame)canonicalFrame=requestAnimationFrame(()=>{canonicalFrame=0;renderBoard();renderSidebar();});if(activeProject){projectSaver.request(p);saveWorkspaceUI()}}
// 工作现场按工程 ID 单独保存（限频），不写入工程内容、不进撤销栈。
let wsSavedAt=0;
function saveWorkspaceUI(force=false){
 if(!activeProject||managerOpen)return;
 if(!force&&transitioning)return;
 const now=Date.now();if(!force&&now-wsSavedAt<1000)return;wsSavedAt=now;
 const tracks=$('#tracks');
 saveWorkspaceState(p.id,{mode,selectedId:selected,time,board:p.board,timeline:{zoom:timelineNav?.zoom()||1,scrollLeft:tracks?.scrollLeft||0,scrollTop:tracks?.scrollTop||0},expanded:[...expandedTracks].filter(([,on])=>on).map(([id])=>id),collapsed:[...expandedTracks].filter(([,on])=>!on).map(([id])=>id),filter},typeof localStorage!=='undefined'?localStorage:undefined);
}
function applyPendingTimelineScroll(){if(pendingTimelineScroll==null)return;const h=$('#tracks');if(!h||!h.isConnected||!(h.clientWidth>0))return;h.scrollLeft=Math.min(pendingTimelineScroll.left,Math.max(0,h.scrollWidth-h.clientWidth));h.scrollTop=pendingTimelineScroll.top;pendingTimelineScroll=null;}
function updateSaveMode(){$('#saveModeLabel').textContent=saveDelay===null?'本地创作 · 手动保存':'本地创作 · 自动保存';}
async function saveNow(){if(!activeProject)return;document.activeElement?.blur();try{await library.idle();do{await projectSaver.flush();}while(projectSaver.pending);toast('已保存到本机');}catch{toast('保存失败，请重试或导出工程备份');}}
updateSaveMode();
window.directorDesktop?.onSaveRequest(async()=>{try{if(exporting||localWork||transitioning)throw Error('正在导出、读取素材或切换项目，请完成后退出。');document.activeElement?.blur();wsShell?.cancelCreativeTasks('interrupted');await creativeSaveChain;await library.idle();if(activeProject){do{await projectSaver.flush();}while(projectSaver.pending);await saveProjectCover();}return {ok:true};}catch(e){return {ok:false,message:e.message||'保存失败，请先导出工程备份。'};}});
window.directorDesktop?.onCommand(command=>{if(exporting)return;if(boardGesture){boardGesture.cancel();endSpaceHand();if(command==='undo'||command==='redo')return;}if(command==='select-all'){if(!managerOpen&&!transitioning&&mode==='board'&&!editingTarget({target:document.activeElement})&&!$('.modal')&&$('#contextMenu').classList.contains('hidden'))setBoardSelection(p.nodes.filter(n=>nodeVisible(n)).map(n=>n.id));else document.execCommand('selectAll');return;}if(command==='help')helpModal();if(command==='project'){goProjects();return}if(managerOpen){if(command==='api'||command==='settings')toast('请先打开一个项目，再进入设置');return;}if(command==='api')aiModal();if(command==='settings')settingsModal();if(command==='save')saveNow();if(command==='undo'||command==='redo'){if(document.activeElement?.matches('input,textarea,[contenteditable=true]'))document.execCommand(command);else if(!$('.modal'))undo(command==='redo');}});

function commit(rebuild=false){syncCanonicalNodes(p);if(mode==='board')pruneBoardSelection();if(rebuild){stage?.rebuild(p);if(mode==='stage')stage?.select(selected)}renderSidebar();renderPreviewSelect();renderTracks();renderBoard();updateStats();persist();if(shotListOpen)renderShotChecklist()}
function updateStats(){$('#stats').textContent=`${p.nodes.length} 个资产 · ${p.objects.length} 个对象 · ${p.shots.length} 个镜头`;$('#durationLabel').textContent=p.duration.toFixed(2)+'s';$('#projectName').value=p.name}
function stop(){playing=false;$('#playBtn').textContent='▶'}
function setMode(m){if(exporting)return;if(m==='stage'&&$('.node-tool-panel'))closeModal();if(wsShell&&!wsShell.onCanvas())wsShell.setPage('canvas');boardGesture?.cancel();endSpaceHand();if(m==='stage'&&mode==='board'){const d=p.nodes.find(n=>n.id===selected&&n.type==='director');if(d)activeDirectorId=d.id;}const memory=saveSelection({selected,timelineSelection,selectedEdge});modeMemory[mode]=memory;mode=m;document.body.dataset.canvasMode=m;const restored=restoreSelection(modeMemory[m],p,m);selected=restored.selected;timelineSelection=restored.timelineSelection;selectedEdge=restored.selectedEdge;endSpaceHand();if(m==='board')pruneBoardSelection();stage?.orbit.clear();stop();$('#board').classList.toggle('hidden',m!=='board');$('#stageShell').classList.toggle('hidden',m!=='stage');$('#timeline').classList.toggle('hidden',m!=='stage');$('[data-panel-resize=timeline]').classList.toggle('hidden',m!=='stage');$('#boardTab').classList.toggle('active',m==='board');$('#stageTab').classList.toggle('active',m==='stage');$('#workspaceTitle').textContent=m==='board'?'画布':'3D 导演台';$('#workspaceSub').textContent=m==='board'?'':'　/　工程共享场景';$('#quickAdd').classList.toggle('hidden',m!=='board');$('#workflowTemplates').classList.toggle('hidden',m!=='board');$('#sendVideoVersions')?.classList.toggle('hidden',m!=='board');$('#importMedia').classList.toggle('hidden',m!=='board');$('#shotListBtn').classList.toggle('hidden',m!=='board');if(m!=='board'&&shotListOpen)toggleShotChecklist(false);$('#addCameraBtn').classList.toggle('hidden',m!=='stage');$('#directorAssistantBtn').classList.toggle('hidden',m!=='stage');stage?.select(m==='stage'?selected:null);$('#groundBtn').disabled=m!=='stage'||!selected||!p.objects.some(o=>o.id===selected&&o.type!=='camera');renderProperties();renderSidebar();renderTracks();if(m==='board')renderBoard();stage?.resize();applyPendingTimelineScroll();saveWorkspaceUI()}
function select(id){if(selected!==id)dismissNodeUI();if(mode==='board')nudgeStamp=0;timelineSelection=null;selectedEdge=null;updateEdgeSelection();selected=id;if(mode==='board')boardSelection=id?[id]:[];$('#groundBtn').disabled=!id||!p.objects.some(o=>o.id===id&&o.type!=='camera');stage?.select(mode==='stage'?id:null);renderProperties();renderSidebar();renderTracks();updateBoardSelectionClasses();updateBoardToolbar()}
function lockIcon(locked){return `<svg class="lock-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="${locked?'M8 10V7a4 4 0 0 1 8 0v3':'M8 10V7a4 4 0 0 1 7.5-2'}"/><path d="M12 14v3"/></svg>`}
function syncSidebarMode(){
 const isStage=mode==='stage',showLibrary=isStage&&libraryOpen;
 $('#projectAssetsTab').textContent=isStage?t('canvas.sceneObjects'):t('canvas.nodes');$('#offlineAssetsTab').classList.toggle('hidden',!isStage);
 $('#boardSidebarPane').classList.toggle('hidden',isStage);$('#stageSidebarPane').classList.toggle('hidden',!isStage);
 $('#projectSidebar').classList.toggle('hidden',showLibrary);$('#offlineSidebar').classList.toggle('hidden',!showLibrary);$('.workbench').classList.toggle('library-open',showLibrary);
 for(const [id,on] of [['projectAssetsTab',!showLibrary],['offlineAssetsTab',showLibrary]]){$('#'+id).classList.toggle('active',on);$('#'+id).setAttribute('aria-pressed',String(on));}
}
function renderSidebar(){
 syncSidebarMode();
 const nodes=p.nodes.filter(n=>nodeVisible(n)&&nodeMatchesQuery(n,nodeQuery));$('#boardAssetCount').textContent=nodes.length;$('#stageObjectCount').textContent=p.objects.length;
 const listed=nodeQuery.trim()?nodes:nodes.filter(n=>!collapsedGroupFor(p,n.id)),compactGroups=nodeQuery.trim()?'':(p.boardGroups||[]).filter(g=>g.collapsed&&!hiddenByShotBundle(p,g)&&bundleMemberIds(p,g).some(id=>nodes.some(n=>n.id===id))).map(g=>`<button class="board-asset-item" data-sidebar-group="${esc(g.id)}" title="打开组内节点列表"><i>▤</i><span><b>${esc(g.name)}</b><small>${bundleMemberIds(p,g).length} ${g.videoVersions?'个版本':g.shotBundle?'项镜头素材':'个节点'} · 已收起</small></span></button>`).join('');
 $('#boardAssetList').innerHTML=nodes.length?compactGroups+listed.map(n=>`<button class="board-asset-item ${mode==='board'&&selected===n.id?'active':''}" data-board-asset="${esc(n.id)}" title="定位 ${esc(n.title)}" aria-label="定位画布节点：${esc(n.title)}"><i>${n.type==='image'&&n.src?`<img src="${esc(n.src)}" alt="" loading="lazy">`:icons[n.type]}</i><span><b>${esc(n.title)}</b><small>${labels[n.type]}</small></span></button>`).join(''):nodeQuery?`<p class="sidebar-empty">没有匹配「${esc(nodeQuery)}」的节点<br><button class="link-like" data-clear-node-search>清空搜索</button></p>`:'<p class="sidebar-empty">当前分类暂无节点</p>';
 $$('[data-sidebar-group]').forEach(b=>b.onclick=()=>groupNodeList(b.dataset.sidebarGroup));
 $$('[data-clear-node-search]').forEach(b=>b.onclick=clearNodeSearch);
 $$('[data-board-asset]').forEach(el=>el.onclick=()=>{const n=p.nodes.find(n=>n.id===el.dataset.boardAsset);if(!n)return;if(collapsedGroupFor(p,n.id)){locateCanvasNode(n.id);return;}if(mode==='board'&&nodeQuery.trim()&&boardSelection.length)setBoardSelection([...boardSelection,n.id]);else select(n.id);const element=$$('.node').find(el=>el.dataset.id===n.id),z=p.board.zoom;p.board.x=$('#board').clientWidth/2-(n.x+n.w/2)*z;p.board.y=$('#board').clientHeight/2-(n.y+(element?.offsetHeight||250)/2)*z;boardTransform();persist();});
 $('#clearSolo').classList.toggle('hidden',!p.objects.some(o=>o.solo));
 const characterIds=new Set(exportCharacterCandidates(p,assetCatalog).filter(row=>row.automatic).map(row=>row.id));
 const category=o=>o.type==='camera'?'camera':characterIds.has(o.id)?'character':'scene';
 $$('[data-object-filter]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.objectFilter===objectFilter));b.onclick=()=>{objectFilter=b.dataset.objectFilter;renderSidebar();};});
 $('#objects').innerHTML=p.objects.filter(o=>objectFilter==='all'||category(o)===objectFilter).map(o=>`<div class="object-row ${editorVisible(o,p.objects)?'':'solo-muted'}"><button class="object-item ${mode==='stage'&&selected===o.id?'active':''}" data-id="${esc(o.id)}"><span class="object-icon" style="color:${o.color}">${icons[o.type]}</span><span class="object-name">${esc(o.name)}</span></button><button class="object-toggle eye-toggle ${o.hidden?'off':''}" data-visibility="${o.id}" aria-label="${o.hidden?'显示':'隐藏'} ${esc(o.name)}" aria-pressed="${!o.hidden}" title="${o.hidden?'显示素材':'隐藏素材（预览和导出也隐藏）'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12 Q12 0 22 12 Q12 24 2 12Z"/><circle cx="12" cy="12" r="3"/>${o.hidden?'<path d="M3 3L21 21"/>':''}</svg></button><button class="object-toggle ${o.locked?'active':''}" data-lock="${o.id}" aria-label="${o.locked?'解锁':'锁定'} ${esc(o.name)}" title="${o.locked?'点击解锁':'点击锁定'}" aria-pressed="${!!o.locked}">${lockIcon(o.locked)}</button><button class="object-toggle ${o.solo?'active':''}" data-solo="${o.id}" aria-label="Solo ${esc(o.name)}" aria-pressed="${!!o.solo}" title="Solo · 同类单选独显，再次点击恢复全部">S</button></div>`).join('');
 $$('[data-visibility]').forEach(el=>el.onclick=()=>{stop();checkpoint();const o=p.objects.find(o=>o.id===el.dataset.visibility);o.hidden=!o.hidden;stage?.select(selected);commit();renderProperties()});
 $$('.object-item').forEach(el=>el.onclick=()=>{if(mode!=='stage')setMode('stage');select(el.dataset.id)});
 $$('[data-lock]').forEach(el=>el.onclick=()=>{stop();checkpoint();const o=p.objects.find(o=>o.id===el.dataset.lock);o.locked=!o.locked;stage?.select(selected);commit();renderProperties()});
 $$('[data-solo]').forEach(el=>el.onclick=()=>{checkpoint();const o=p.objects.find(o=>o.id===el.dataset.solo);toggleSolo(p.objects,o.id);stage?.select(selected);commit();renderProperties()});
 $$('.navitem').forEach(el=>{const f=el.dataset.filter;el.classList.toggle('active',filter===f);el.setAttribute('aria-pressed',String(filter===f));el.querySelector('span').textContent=p.nodes.filter(n=>nodeVisible(n,f)).length;el.onclick=()=>{filter=f;if(mode!=='board')setMode('board');if(selected&&!p.nodes.some(n=>n.id===selected&&nodeVisible(n))){selected=null;renderProperties()}if(boardSelection.length){boardSelection=boardSelection.filter(id=>{const n=p.nodes.find(v=>v.id===id);return n&&nodeVisible(n)});if(selected&&!boardSelection.includes(selected))boardSelection=selected?[selected]:[];updateBoardSelectionClasses();updateBoardToolbar()}renderBoard();renderSidebar();fitBoard()}});
}
function canvasNodeActions(context,inspector=false){
 if(!context)return '';
 const actions=context.kind==='script'?[]:context.kind==='shot'?[['edit','编辑分镜','editStorySource']]:[['edit','图片与版本','manageStoryAsset']];
 return `<div class="node-source-actions">${actions.map(([operation,label,id])=>`<button type="button" ${inspector?`id="${id}"`:''} data-node-tool="${operation}">${label}</button>`).join('')}</div>`;
}
let versionsController;
function versions(){return versionsController??=createVideoVersionUI({project:()=>p,modal,closeModal,toast,checkpoint,commit,generate:providerVideoModal,send:id=>wsShell?.sendCanvasNodeToEdit(id),replace:id=>wsShell.replaceCanvasVersionInEdit(id),batchSend:ids=>wsShell.sendVideoVersionsToEdit(ids)});}
function focusVersionGroup(id){let g=p.boardGroups?.find(g=>g.id===id);if(g&&hiddenByShotBundle(p,g))g=p.boardGroups.find(b=>b.shotBundle&&b.collapsed&&b.shotSourceId===g.sourceNodeId);const r=g&&groupCardRect(p,g);if(!r)return;select(null);const z=p.board.zoom;p.board.x=$('#board').clientWidth/2-(r.x+r.w/2)*z;p.board.y=$('#board').clientHeight/2-(r.y+r.h/2)*z;boardTransform();persist();}
const shotChecklist=document.createElement('aside');
shotChecklist.id='shotChecklist';shotChecklist.className='shot-checklist';shotChecklist.hidden=true;shotChecklist.setAttribute('aria-label','镜头生产清单');
shotChecklist.innerHTML='<header class="shot-checklist-head"><div><b>'+t('shots.title')+'</b><small id="shotChecklistCount"></small></div><div class="shot-checklist-tools"><button type="button" id="shotChecklistReturn" class="ghost" hidden>'+t('shots.returnView')+'</button><button type="button" id="shotChecklistCollapse" class="ghost" aria-expanded="true" aria-controls="shotChecklistBody">'+t('shots.collapse')+'</button><button type="button" id="shotChecklistClose" class="ghost" aria-label="Close shot list">'+t('shots.close')+'</button></div></header><div id="shotChecklistBody" class="shot-checklist-body"></div>';
$('#board').append(shotChecklist);
let shotListOpen=false,shotListCollapsed=false,shotListFocus=null,shotListReturnView=null;
function renderShotChecklist(){
 if(!shotListOpen)return;
 shotChecklist.hidden=false;
 const shots=p.workstation?.story?.shots||[];
 $('#shotChecklistCount').textContent=shots.length?t('shots.count',{count:shots.length}):t('shots.empty');
 const expanded=new Set($$('#shotChecklistBody details[open]').map(el=>el.dataset.shotDetails));
 $('#shotChecklistBody').innerHTML=shotChecklistHtml(p);
 for(const el of $$('#shotChecklistBody details'))el.open=expanded.has(el.dataset.shotDetails);
 for(const item of $$('#shotChecklistBody [data-shot-item]')){const active=item.dataset.shotItem===shotListFocus;item.classList.toggle('active',active);if(active)item.setAttribute('aria-current','true');else item.removeAttribute('aria-current');}
 $('#shotChecklistBody').hidden=shotListCollapsed;
 const collapse=$('#shotChecklistCollapse');collapse.textContent=shotListCollapsed?t('shots.expand'):t('shots.collapse');collapse.setAttribute('aria-expanded',String(!shotListCollapsed));
 $('#shotChecklistReturn').hidden=!shotListReturnView;
 $('#shotListBtn').setAttribute('aria-expanded','true');
 return;
}
function setShotListCollapsed(value){shotListCollapsed=!!value;renderShotChecklist();if(!shotListCollapsed)$('#shotChecklistBody')?.querySelector('[data-shot-locate]')?.focus?.({preventScroll:true});}
function toggleShotChecklist(open=!shotListOpen){
 shotListOpen=!!open;if(shotListOpen&&$('.node-tool-panel'))closeModal();renderNodeActionBar();shotChecklist.hidden=!shotListOpen;$('#shotListBtn').setAttribute('aria-expanded',String(shotListOpen));
 if(shotListOpen){renderShotChecklist();requestAnimationFrame(()=>$('#shotChecklistBody')?.querySelector('[data-shot-locate],[data-shot-empty]')?.focus?.({preventScroll:true}));}
}
function shotTargetNode(item){const direct=p.nodes.find(node=>node.id===item?.shotNodeId);if(direct)return direct;for(const asset of item?.assets||[]){const record=p.workstation.story.assets.find(row=>row.id===asset.id);const node=p.nodes.find(row=>row.id===record?.canvasNodeId);if(node)return node;}return null;}
function focusShotFromChecklist(shotId){
 const item=shotProductionFor(p,shotId);if(!item)return toast('这个镜头已移除，请刷新清单');
 const node=shotTargetNode(item);if(!node)return toast('这镜还没有画布节点；先点「整理到画布」再定位');
 if(filter!=='all'){filter='all';renderBoard();renderSidebar();}
 if(!shotListReturnView)shotListReturnView=snapshotCanvasView(p.board);
 if(collapsedGroupFor(p,node.id)){locateCanvasNode(node.id);setBoardSelection([node.id]);}
 else{
  const board=$('#board'),z=Math.max(.7,Math.min(1,p.board.zoom));
  p.board.zoom=z;p.board.x=board.clientWidth/2-(node.x+node.w/2)*z;p.board.y=board.clientHeight/2-(node.y+(nodeHeights.get(node.id)||240)/2)*z;
  boardTransform();persist();setBoardSelection([node.id]);
 }
 shotListFocus=item.id;renderShotChecklist();updateRelationControls();
 requestAnimationFrame(()=>nodeAnchor(node.id)?.focus?.({preventScroll:true}));
}
function returnShotChecklistView(){if(!shotListReturnView)return;Object.assign(p.board,shotListReturnView);shotListReturnView=null;boardTransform();saveWorkspaceUI(true);updateRelationControls();renderShotChecklist();}
function shotGenerationSource(item){
 const node=p.nodes.find(row=>row.id===item?.shotNodeId);if(node)return node;
 for(const asset of item?.assets||[]){const record=p.workstation.story.assets.find(row=>row.id===asset.id);const source=p.nodes.find(row=>row.id===record?.canvasNodeId);if(source)return source;}
 return p.nodes.find(node=>item?.versionGroupId&&videoVersionGroup(p,node.id)?.id===item.versionGroupId)||null;
}
async function runShotChecklistAction(shotId,action,button){
 const item=shotProductionFor(p,shotId);if(!item)return toast('这个镜头已移除，请刷新清单');
 if(action==='sync'){const ok=await sendPlanningToCanvas('shots',[shotId],{keepTool:true});if(ok){renderShotChecklist();focusShotFromChecklist(shotId);}return;}
 if(action==='assets'){toggleShotChecklist(false);const assetId=button?.dataset.assetId||item.assets.find(asset=>!asset.official)?.id||item.assets[0]?.id;wsShell?.openTool('assets',{assetId,mode:'planning'});return;}
 if(action==='edit'||action==='open-script'){toggleShotChecklist(false);shotSheetModal(shotId);return;}
 if(action==='generate'){const source=shotGenerationSource(item);if(!source)return toast('先把分镜整理到画布，再生成视频');providerVideoModal(source);return;}
 if(action==='cut'){const videoId=item.cutVideoId||item.adoptedVideoId||item.videos.generated[0]||item.videos.previz[0];if(!videoId)return toast('这个镜头还没有可送入剪辑的视频');wsShell?.sendCanvasNodeToEdit(videoId);return;}
 if(action==='locate'){focusShotFromChecklist(shotId);return;}
 if(action==='review'){
  const changes=item.pending.map(change=>`<li><b>${esc(change.title||'生成视频')}</b><span>${esc(change.reason)}${change.currentVersionId?' · 当前正式图版本已更新':''}</span></li>`).join('');
  modal('复核参考变更','只记录你已经核对当前正式图；不会改写旧视频、剪辑或已提交任务。',`<p>${item.pending.length} 处参考变化需要确认。确认后，如果正式图再次更换，清单会重新标记待复核。</p><ul class="shot-review-list">${changes}</ul>`,`<button id="cancelShotReview">取消</button><button id="confirmShotReview" class="primary">确认已复核</button>`);
  $('#cancelShotReview').onclick=closeModal;
  $('#confirmShotReview').onclick=()=>{checkpoint();const result=reviewShotReferenceChanges(p,shotId);commit();closeModal();renderShotChecklist();toast(result.changes?`已记录 ${result.videos.length} 个视频的参考复核`:'没有待复核参考');};
  return;
 }
 toast('这个操作暂时不可用');
}
$('#shotListBtn').onclick=()=>toggleShotChecklist();
$('#shotChecklistClose').onclick=()=>{toggleShotChecklist(false);$('#shotListBtn').focus({preventScroll:true});};
$('#shotChecklistCollapse').onclick=()=>setShotListCollapsed(!shotListCollapsed);
$('#shotChecklistReturn').onclick=returnShotChecklistView;
shotChecklist.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('.modal')){event.preventDefault();event.stopPropagation();toggleShotChecklist(false);$('#shotListBtn').focus({preventScroll:true});}});
$('#shotChecklistBody').addEventListener('click',event=>{
 const action=event.target.closest('[data-shot-action]');
 if(action){event.preventDefault();void runShotChecklistAction(action.dataset.shotId,action.dataset.shotAction,action);return;}
 const locate=event.target.closest('[data-shot-locate]');
 if(locate){event.preventDefault();focusShotFromChecklist(locate.dataset.shotLocate);return;}
 const empty=event.target.closest('[data-shot-empty]');
 if(empty){toggleShotChecklist(false);shotSheetModal();}
});
let nodeOverlayFrame=0;
const framedNodePanels=new WeakSet();
let observedNodeOverlayElements=[];
const nodeOverlayResizeObserver=new ResizeObserver(entries=>{
 const panel=$('.node-tool-panel');
 if(panel&&entries.some(e=>e.target===nodeAnchor(panel.dataset.nodeId)))framedNodePanels.delete(panel);
 refreshNodeOverlays();
});
function nodeAnchor(id){const group=collapsedGroupFor(p,id);return group?$$('.board-group').find(el=>el.dataset.group===group.id):$$('.node').find(el=>el.dataset.id===id);}
function refreshNodeOverlays(){
 if(nodeOverlayFrame)return;nodeOverlayFrame=requestAnimationFrame(()=>{
  nodeOverlayFrame=0;const board=$('#board'),bar=$('#nodeActionBar'),panel=$('.node-tool-panel')||$('.node-assistant-floating:not([hidden])');
  if(mode!=='board'||!wsShell?.onCanvas()||$('.standard-dialog')||shotListOpen){if(bar)bar.hidden=true;return;}
  const boardRect=board.getBoundingClientRect();
  if(bar&&!bar.hidden)bar.style.maxWidth=Math.max(160,board.clientWidth-24)+'px';
  const watched=[bar&&!bar.hidden?bar:null,panel,nodeAnchor(boardSelection[0])].filter(Boolean);
  for(const el of observedNodeOverlayElements)if(!watched.includes(el))nodeOverlayResizeObserver.unobserve(el);
  for(const el of watched)if(!observedNodeOverlayElements.includes(el))nodeOverlayResizeObserver.observe(el);
  observedNodeOverlayElements=watched;
  if(panel?.dataset.overlayKind==='composer'&&!panel.classList.contains('node-assistant-floating')&&!framedNodePanels.has(panel)){
   const anchor=nodeAnchor(panel.dataset.nodeId),n=p.nodes.find(n=>n.id===panel.dataset.nodeId);
   if(anchor&&n){
    framedNodePanels.add(panel);
    const rect=anchor.getBoundingClientRect(),z=p.board.zoom,barHeight=bar&&!bar.hidden?bar.getBoundingClientRect().height:50;
    const nodeTop=60+barHeight+26+12,room=Math.max(70,board.clientHeight-nodeTop-16-220-8);
    const nextZoom=Math.min(z,Math.max(.1,z*room/Math.max(1,rect.height)));
    const worldCenter=(rect.left+rect.width/2-boardRect.left-p.board.x)/z;
    const worldTop=(rect.top-boardRect.top-p.board.y)/z;
    p.board.zoom=nextZoom;p.board.x=board.clientWidth/2-worldCenter*nextZoom;p.board.y=nodeTop-worldTop*nextZoom;
    boardTransform();saveWorkspaceUI();
   }
  }
  if(bar&&!bar.hidden){bar.style.zIndex='71';bar.style.transform='none';bar.style.bottom='auto';bar.style.maxWidth=Math.max(160,board.clientWidth-24)+'px';positionNodeOverlay(bar,{board,anchor:nodeAnchor(boardSelection[0]),kind:'toolbar',obstacles:[...$$('.node').filter(n=>n.dataset.id!==boardSelection[0]),...(shotListOpen&&!shotChecklist.hidden?[shotChecklist]:[])]});}
  if(panel){
   const anchor=nodeAnchor(panel.dataset.nodeId),r=anchor?.getBoundingClientRect(),composer=panel.dataset.overlayKind==='composer';let maxHeight=Math.max(120,board.clientHeight-96);
   if(panel.classList.contains('node-assistant-floating'))maxHeight=Math.max(280,Math.min(420,board.clientHeight-306));
   else if(composer&&r&&!panel.classList.contains('media-operation-dialog')&&!panel.querySelector('#videoReceipt,details[open]')){const below=boardRect.bottom-16-r.bottom-8,above=r.top-8-boardRect.top-60;if(below>=120)maxHeight=Math.min(maxHeight,420,below);else if(above>=120)maxHeight=Math.min(maxHeight,420,above);}
   panel.parentElement.style.backdropFilter='none';panel.style.maxHeight=maxHeight+'px';if(panel.classList.contains('node-assistant-floating'))panel.style.height=Math.min(420,maxHeight)+'px';panel.style.maxWidth=Math.max(240,Math.min(composer?680:440,board.clientWidth-24))+'px';panel.querySelector('.modal-actions')?.style.setProperty('flex-wrap','wrap');
   positionNodeOverlay(panel,{board,anchor,kind:panel.dataset.overlayKind||'panel',bottomReserve:composer?16:85});
  }
  if(bar&&!bar.hidden){
   // Joint positioning: moving clear of the composer must never cover the source.
   const options={board,anchor:nodeAnchor(boardSelection[0]),kind:'toolbar',obstacles:[...$$('.node').filter(n=>n.dataset.id!==boardSelection[0]),...(panel?[panel]:[]),...(shotListOpen&&!shotChecklist.hidden?[shotChecklist]:[])]};
   const placed=positionNodeOverlay(bar,options);
   if(placed?.placement==='outside'){p.board.y+=boardRect.top+60-placed.top;boardTransform();saveWorkspaceUI();positionNodeOverlay(bar,options);if(panel)positionNodeOverlay(panel,{board,anchor:nodeAnchor(panel.dataset.nodeId),kind:panel.dataset.overlayKind||'panel',bottomReserve:panel.dataset.overlayKind==='composer'?16:85});}
   const relation=bar.querySelector('.node-action-relation'),current=p.nodes.find(n=>n.id===boardSelection[0]);
   const docked=placed?.placement==='docked'||placed?.placement==='outside',nextHidden=!docked;
   if(relation&&relation.hidden!==nextHidden){relation.hidden=nextHidden;relation.textContent=docked?'关联「'+(current?.title||'所选节点')+'」':'';bar.classList.toggle('docked',docked);bar.dataset.placement=placed?.placement||'';positionNodeOverlay(bar,options);}
   else if(relation){relation.textContent=docked?'关联「'+(current?.title||'所选节点')+'」':'';bar.classList.toggle('docked',docked);bar.dataset.placement=placed?.placement||'';}
  }
 });
}
function nodeToolModal(nodeId,title,subtitle,body,actions=''){
 if(mode==='board'&&nodeId){const n=p.nodes.find(n=>n.id===nodeId);if(n){p.board={...p.board,...composerView(n,{width:$('#board').clientWidth,height:$('#board').clientHeight},p.board.zoom)};boardTransform();saveWorkspaceUI();}}
 modal(title,subtitle,body,actions,{nodeId});
}
function renderNodeActionBar(){
 const bar=$('#nodeActionBar');if(!bar)return;
 const node=mode==='board'&&boardSelection.length===1?p.nodes.find(n=>n.id===boardSelection[0]&&nodeVisible(n)&&!collapsedGroupFor(p,n.id)):null;
 bar.classList.add('node-action-anchored');bar.hidden=!node||!!$('.standard-dialog')||shotListOpen;if(!node){bar.replaceChildren();return;}
 const actions=visibleNodeActions(p,node);refreshNodeOverlays();
 bar.innerHTML=`<span class="node-action-relation" aria-live="polite" hidden></span>${actions.map(a=>`<button type="button" data-node-action="${a.id}" class="${a.primary?'node-main-action':''}">${uiIcon(a.id==='media'?node.type:a.id)}${esc(a.label)}</button>`).join('')}<button type="button" class="node-more" data-node-action="more" aria-label="更多节点操作">${uiIcon('more')}更多</button>`;
 bar.onpointerdown=e=>e.stopPropagation();bar.oncontextmenu=e=>{e.preventDefault();e.stopPropagation()};
 bar.querySelectorAll('[data-node-action]').forEach(b=>b.onclick=e=>{e.stopPropagation();const current=p.nodes.find(n=>n.id===node.id);if(!current)return;runNodeQuickAction(current,b.dataset.nodeAction,b);});
}
function mediaNodePanel(n,tool='preview'){return openMediaNodePanel({project:()=>p,modal:nodeToolModal,toast,refresh:refreshNodeOverlays,run:runNodeQuickAction,generate:providerVideoModal,capabilities:()=>api('/api/workstation/processing-capabilities'),process:async(source,options,{signal,status})=>{
 const project=p,panel=document.querySelector('.node-media-panel');
 return processMediaNode(source,options,{api,readDataURL,signal,onStatus:status,onTask:(job,id)=>{if(!project.nodes.includes(source))return;source.processingJobs=(source.processingJobs||[]).filter(j=>j.id!==(job?.id||id)).slice(-9);if(job)source.processingJobs.push(job);persist();},onReady:({source:original,src,job})=>{
  if(p!==project||!project.nodes.includes(source)||source.src!==original){status('处理完成，请回到原工程用相同参数取回结果。',1);return;}
  if(project.nodes.some(n=>n.processingTask===job.id)){status('结果已在画布中。',1);return;}
  if(project.nodes.length>=500)throw Error('画布节点已满，请清理后用相同参数取回结果');
  checkpoint();const kind=job.operation==='audio'?'audio':'video',node=asset(kind,{src,title:source.title+' · '+({trim:'截取片段',audio:'音频',mute:'无声',depth:'深度参考'})[job.operation],text:job.operation==='depth'?'从原视频估计的深度参考；不是三维白模重建。':source.text,...freeCanvasPosition(project),processingTask:job.id});
  project.nodes.push(node);project.edges.push({from:source.id,to:node.id});if(panel?.isConnected)closeModal();commit();select(node.id);toast('处理结果已加入画布，原素材保留');
 }});
},compatibility:async(source,status)=>{const project=p;return createCompatibleVideo(source,{project,api,readDataURL,status,onTask:job=>{if(project.nodes.includes(source)){source.compatibilityJob=job;persist();}},onReady:({source:original,src,jobId})=>{if(p!==project||!project.nodes.includes(source)||source.src!==original){toast('兼容副本已完成，请回到原工程从原视频再次打开恢复');return;}if(project.nodes.some(n=>n.compatibilityTask===jobId)){status('兼容副本已在画布中');return;}if(project.nodes.length>=500)throw Error('画布节点已满，请清理后从原视频恢复副本');checkpoint();const node=asset('video',{src,title:source.title+' · 兼容副本',text:source.text,...freeCanvasPosition(project),compatibilityTask:jobId});project.nodes.push(node);project.edges.push({from:source.id,to:node.id});closeModal();commit();select(node.id);toast('兼容副本已加入画布，原视频保留');}});},addFrame:(source,src,t)=>{
 if(p.nodes.length>=500)return toast('画布节点已满，请先清理');checkpoint();const node=asset('image',{src,title:source.title+' · '+t.toFixed(2)+'s',text:'从视频提取的参考帧',...freeCanvasPosition(p)});p.nodes.push(node);p.edges.push({from:source.id,to:node.id});closeModal();commit();select(node.id);toast('当前帧已加入画布，可继续生成');
}},n,tool);}
function runNodeQuickAction(n,action,button){
 if(action==='shot-bundle')return bundleBoardShot([n.id]);
 if(action==='assistant'){finishInlineNodeText();return wsShell?.openTool('assistant',{nodeId:n.id,operation:n.type==='text'?'rewrite':undefined});}
 if(action==='media')return mediaNodePanel(n);
 if(['frames','trim','audio','mute','depth','compatibility'].includes(action))return mediaNodePanel(n,action);
 if(action==='download')return download(n.src,mediaFileName(n));
 if(action==='versions')return versions().open(videoVersionGroup(p,n.id)?.id,n.id);
 if(action==='content')return editCanvasNode(n.id);
 if(['edit','storyboard','assets'].includes(action))return openNodeTool(n.id,action);
 if(action==='promote')return promoteNodeScript(n.id);
 if(action==='templates')return canvasTemplatesModal();
 if(action==='image')return aiImageModal(n);
 if(action==='asset-version')return openImageAdoption(n,false);
 if(action==='asset-official')return openImageAdoption(n,true);
 if(action==='import'){mediaTarget=n.id;$('#mediaFile').accept=n.type+'/*';$('#mediaFile').click();return;}
 if(action==='video')return providerVideoModal(n);
 if(action==='edit-media')return wsShell?.sendCanvasNodeToEdit(n.id);
 if(action==='stage')return enterGeneratedModel(n);
 if(action==='director'){activeDirectorId=n.id;select(n.id);setMode('stage');return;}
 if(action==='more'){const r=button.getBoundingClientRect();nodeMoreMenu(n,r.left,r.bottom+6);}
}
function adoptionImpactHtml(assetId){
 let impact;try{impact=assetReferenceImpact(p,assetId);}catch(e){return `<p class="image-adoption-warning">${esc(e.message)}</p>`;}
 const shots=impact.shots.length?impact.shots.map(shot=>`镜头 ${String(shot.index+1).padStart(2,'0')}${shot.scene?' · '+shot.scene:''}`).join('、'):'暂无关联镜头';
 const old=impact.oldVersion?`当前正式图：${esc(impact.oldVersion.name)}`:'当前还没有正式图';
 return `<div class="image-adoption-impact"><p><b>关联镜头</b> ${impact.shots.length} 镜</p>${impact.shots.length?`<details><summary>查看关联镜头</summary><p>${esc(shots)}</p></details>`:''}<p><b>既有旧参考</b> ${old}${impact.videos.length?` · ${impact.videos.length} 个视频引用过这个资产`:''}</p><p><b>剪辑与任务</b> ${impact.clips?`剪辑已使用 ${impact.clips} 段，不会自动替换；`:'剪辑尚未使用；'}已提交任务保持原样。</p><p class="help-text">更换正式图只改变资产正式图与画布图片，不会静默重写旧视频、剪辑或已提交任务。请在镜头清单逐镜复核参考变更。</p></div>`;
}
function imagePixelSize(blob){
 if(typeof createImageBitmap==='function')return createImageBitmap(blob).then(bitmap=>{try{return {width:bitmap.width,height:bitmap.height};}finally{bitmap.close();}});
 return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),image=new Image();image.onload=()=>{resolve({width:image.naturalWidth,height:image.naturalHeight});URL.revokeObjectURL(url);};image.onerror=()=>{reject(Error('无法读取生成图片尺寸'));URL.revokeObjectURL(url);};image.src=url;});
}

function candidateImages(sourceId,currentTaskId=null){
 const source=sourceId?p.nodes.find(n=>n.id===sourceId):null;
 const ids=new Set(p.nodes.filter(n=>n?.id===sourceId).map(n=>n.id));
 return p.nodes.filter(n=>n.type==='image'&&n.src&&n.generatedTask&&(
  n.id===sourceId||
  (currentTaskId&&n.generatedTask===currentTaskId)||
  n.imageResultContext?.sourceNodeId===sourceId||
  (source&&p.edges.some(e=>e.from===sourceId&&e.to===n.id))
 ));
}
function openImageCandidates(sourceId,currentTaskId=null){
 const source=p.nodes.find(n=>n.id===sourceId),items=candidateImages(sourceId,currentTaskId);
 if(!items.length)return toast('还没有同源候选图');
 modal('同源候选','并排比较同一来源生成的图片；旧图和画布节点都会保留。',`<div class="candidate-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;max-height:60vh;overflow:auto">${items.map((node,index)=>{const assets=generatedImageAssets(p,node),canAdopt=assets.length>0;return `<article class="candidate-card" style="border:1px solid #39393c;border-radius:10px;padding:8px;background:#1b1b1d"><img src="${esc(node.src)}" alt="" style="width:100%;height:150px;object-fit:cover;border-radius:6px;background:#111"><p style="margin:6px 0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${String(index+1).padStart(2,'0')} · ${esc(node.title||'生成图片')}</p><div class="property-actions" style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" data-candidate-locate="${esc(node.id)}">定位</button><button type="button" data-candidate-version="${esc(node.id)}" ${canAdopt?'':'disabled'}>加入版本</button><button type="button" data-candidate-official="${esc(node.id)}" ${canAdopt?'':'disabled'}>设为正式图</button></div></article>`}).join('')}</div><p class="help-text">同源候选来自同一来源节点或同一生成任务；不会删除未采用的图片。</p>`,`<button id="closeCandidates">关闭</button>`);
 $('#closeCandidates').onclick=closeModal;
 $$('[data-candidate-locate]').forEach(b=>b.onclick=()=>{closeModal();select(b.dataset.candidateLocate);fitBoard();});
 $$('[data-candidate-version]').forEach(b=>b.onclick=()=>{const node=p.nodes.find(n=>n.id===b.dataset.candidateVersion);if(node){closeModal();openImageAdoption(node,false);}});
 $$('[data-candidate-official]').forEach(b=>b.onclick=()=>{const node=p.nodes.find(n=>n.id===b.dataset.candidateOfficial);if(node){closeModal();openImageAdoption(node,true);}});
}

function openImageAdoption(node,officialDefault=false){
 if(!node?.src)return toast('图片尚未生成完成');
 const assets=generatedImageAssets(p,node);
 if(!assets.length)return toast('这张图片没有可加入的资产；请从资产或已关联资产的镜头重新生成');
 const projectId=p.id,nodeId=node.id,initial=assets.length===1?assets[0].id:'';
 const options=assets.map(asset=>`<option value="${esc(asset.id)}" ${asset.id===initial?'selected':''}>${esc(asset.name||'未命名资产')}</option>`).join('');
 modal('加入资产版本','只在你确认后写入资产版本；旧版本和画布原图都会保留。',`<label class="field">加入资产<select id="imageAdoptAsset" aria-label="选择要加入的资产"><option value="">请选择资产</option>${options}</select></label><div id="imageAdoptImpact">${initial?adoptionImpactHtml(initial):'<p class="help-text">选择资产后，这里会列出关联镜头和既有旧参考。</p>'}</div>`,`<button id="cancelImageAdoption">取消</button><button id="imageAdoptKeep" ${initial?'':'disabled'}>仅加入版本</button><button id="imageAdoptOfficial" class="primary" ${initial?'':'disabled'}>设为正式图</button>`);
 const select=$('#imageAdoptAsset'),impact=$('#imageAdoptImpact'),keep=$('#imageAdoptKeep'),official=$('#imageAdoptOfficial');
 const refresh=()=>{const assetId=select.value;const valid=assets.some(asset=>asset.id===assetId);keep.disabled=!valid;official.disabled=!valid;impact.innerHTML=valid?adoptionImpactHtml(assetId):'<p class="help-text">选择资产后，这里会列出关联镜头和既有旧参考。</p>';};
 select.onchange=refresh;
 if(officialDefault){official.classList.add('primary');keep.classList.remove('primary');}else{keep.classList.add('primary');official.classList.remove('primary');}
 $('#cancelImageAdoption').onclick=closeModal;
 keep.onclick=()=>{if(!select.value)return toast('请选择要加入的资产');void adoptGeneratedImage(nodeId,select.value,false,keep,projectId);};
 official.onclick=()=>{if(!select.value)return toast('请选择要设为正式图的资产');void adoptGeneratedImage(nodeId,select.value,true,official,projectId);};
}
async function adoptGeneratedImage(nodeId,assetId,official,button,projectId){
 const project=p,node=project.nodes.find(item=>item.id===nodeId),asset=p.workstation.story.assets.find(item=>item.id===assetId);
 if(!node||!asset)return toast('图片或资产已移除，请刷新后重试');
 if(p.id!==projectId)return toast('工程已切换，请重新打开生成结果');
 button.disabled=true;
 let mediaId=null,checkpointed=false,committed=false;
 try{
  // Reuse the version already adopted from this exact image. Publishing it as
  // the official image then only selects a pointer; no duplicate media/version.
  const planned=planGeneratedImageAdoption(project,{nodeId,assetId,official});
  let version=planned.version;
  if(!version){
   const plannedSrc=node.src;
   const response=await fetch(plannedSrc);if(!response.ok)throw Error('无法读取生成的图片');
   const blob=await response.blob();if(blob.size>20*1024*1024)throw Error('生成图片超过 20 MB，请下载后压缩再导入');
   const mime=await validateImageFile(blob),dimensions=await imagePixelSize(blob);
   if(!dimensions.width||!dimensions.height||dimensions.width>32768||dimensions.height>32768)throw Error('生成图片尺寸无效');
   if(p!==project||!project.nodes.includes(node)||p.id!==projectId||node.src!==plannedSrc)throw Error('工程或图片已变化，请重新打开');
   mediaId=crypto.randomUUID();
   version={id:crypto.randomUUID(),mediaId,name:`${asset.name||'资产'} · 生成图片`,mime,size:blob.size,width:dimensions.width,height:dimensions.height,createdAt:Date.now(),prompt:node.text||'',srcHash:planned.srcHash};
   await wsShell.mediaStore.put({id:version.mediaId,kind:'image',name:version.name,mime,size:blob.size,width:dimensions.width,height:dimensions.height,createdAt:version.createdAt,blob});
   if(p!==project||!project.nodes.includes(node)||p.id!==projectId||node.src!==plannedSrc){await wsShell.mediaStore.delete(version.mediaId).catch(()=>{});mediaId=null;throw Error('工程或图片已变化，请重新打开');}
   // A concurrent adoption may have written the same content first. Re-plan so
   // this click reuses that version instead of appending a duplicate.
   const settled=planGeneratedImageAdoption(project,{nodeId,assetId,official});
   if(settled.version){await wsShell.mediaStore.delete(version.mediaId).catch(()=>{});mediaId=null;version=settled.version;}
   else if(settled.srcHash!==planned.srcHash){await wsShell.mediaStore.delete(version.mediaId).catch(()=>{});mediaId=null;throw Error('图片内容已变化，请重新打开生成结果');}
  }
  checkpoint();checkpointed=true;
  applyGeneratedImageToAsset(p,{nodeId,assetId,version,official});
  if(official){node.title=(asset.name||'未命名资产')+' · 正式图片';syncAssetImageLinks(p);}
  else node.title=(asset.name||'未命名资产')+' · 候选图片';
  commit();committed=true;
  closeModal();select(nodeId);filter='all';renderBoard();renderSidebar();renderShotChecklist();
  toast(official?`已设为「${asset.name}」的正式图；旧版本保留，请在镜头清单复核关联镜头`:`已加入「${asset.name}」的资产版本；可随时再选为正式图`);
 }catch(error){
  if(checkpointed&&!committed){p=history.pop()||project;updateUndo();}
  if(mediaId)await wsShell.mediaStore.delete(mediaId).catch(()=>{});
  toast('加入资产版本失败：'+error.message);
 }finally{if(button.isConnected)button.disabled=false;}
}
let inlineTextSession=null;
function finishInlineNodeText(){
 const session=inlineTextSession;if(!session)return;inlineTextSession=null;
 const {editor,body,owner,id}=session;
 if(owner===p){const n=p.nodes.find(n=>n.id===id);if(n&&body.isConnected){body.innerHTML=renderNodeText(n.text.slice(0,2400));const empty=body.closest('.node')?.querySelector('.node-empty');if(empty)empty.hidden=!!n.text.trim();}}
 editor.closest('.node')?.classList.remove('editing-text');editor.remove();
 if(body.isConnected)body.hidden=false;
 if(session.changed){renderSidebar();renderProperties();updateUndo();}
 requestAnimationFrame(()=>{drawEdges();refreshNodeOverlays();});
}
function dismissNodeUI(){
 finishInlineNodeText();
 if($('.node-tool-panel'))closeModal({restoreFocus:false});
 if($('.node-assistant-floating:not([hidden])'))wsShell?.closeTool({restoreFocus:false});
}
function beginInlineNodeText(id){
 if(inlineTextSession?.id===id){inlineTextSession.editor.focus({preventScroll:true});return;}
 dismissNodeUI();
 const state=inlineNodeText(p,id),el=nodeAnchor(id);if(!state||!el?.classList.contains('node'))return;
 select(id);const body=el.querySelector('.node-text');if(!body)return;
 const editor=document.createElement('textarea');editor.className='node-inline-editor';editor.value=state.value;editor.maxLength=state.limit;
 editor.setAttribute('aria-label',state.label);editor.placeholder='直接输入文字…';editor.spellcheck=false;
 editor.title='自动保存 · Esc 或 ⌘/Ctrl+Enter 结束编辑';body.hidden=true;body.after(editor);el.classList.add('editing-text');
 const owner=p,session={owner,id,body,editor,changed:false};inlineTextSession=session;
 editor.style.height=Math.min(360,Math.max(130,body.offsetHeight||180))+'px';
 editor.addEventListener('pointerdown',e=>e.stopPropagation());
 editor.addEventListener('dblclick',e=>e.stopPropagation());
 editor.addEventListener('input',()=>{
  if(inlineTextSession!==session||owner!==p||!p.nodes.includes(state.node))return;
  if(editor.value===inlineNodeText(p,id)?.value)return;
  if(!session.changed){checkpoint();session.changed=true;}
  writeInlineNodeText(p,id,editor.value);persist();
 });
 editor.addEventListener('keydown',e=>{
  if(e.isComposing)return;
  if(e.key==='Escape'||(e.key==='Enter'&&(e.metaKey||e.ctrlKey))){e.preventDefault();e.stopPropagation();finishInlineNodeText();el.focus({preventScroll:true});}
 });
 editor.addEventListener('blur',()=>{if(inlineTextSession===session)finishInlineNodeText();});
 editor.focus({preventScroll:true});refreshNodeOverlays();
}
function editCanvasNode(id){
 const source=p,n=p.nodes.find(n=>n.id===id);if(!n)return;
 if(n.type==='text')return beginInlineNodeText(id);
 const context=getCanvasStoryContext(p,id);
 if(context?.kind==='shot')return openNodeTool(id);
 const title=n.title,text=n.text,limit=context?.kind==='asset'?6000:200000;
 nodeToolModal(n.id,'编辑'+nodePresentation(p,n).label,'保存后更新当前节点；取消会保留原内容。',`<div class="node-edit-form"><label class="field"><span>名称</span><input id="canvasEditTitle" maxlength="100" value="${esc(title)}"></label><label class="field">${context?.kind==='script'?'剧本正文':context?.kind==='asset'?'资产提示词':'内容'}<textarea id="canvasEditText" aria-label="节点正文" rows="6" maxlength="${limit}">${esc(text)}</textarea></label></div><p class="node-editor-note">${context?.kind==='script'?'这里与项目剧本同步，已有分镜与资产会保留。':context?.kind==='asset'?'这里与资产提示词同步，已有图片与版本会保留。':'可记录设定、台词、提示词或素材说明。编辑组内节点时，分组保持收起。'}</p>`,`<button id="cancelCanvasEdit">取消</button><button id="saveCanvasEdit" class="primary">保存内容</button>`);
 const editorPanel=$('#canvasEditText').closest('.modal');editorPanel.classList.add('text-composer-panel');editorPanel.dataset.overlayKind='composer';
 $('#canvasEditText').before(Object.assign(document.createElement('div'),{className:'text-format-toolbar',innerHTML:'<button type="button" data-format="heading">H</button><button type="button" data-format="bold"><b>B</b></button><button type="button" data-format="italic"><i>I</i></button><button type="button" data-format="list">列表</button><button type="button" data-format="quote">引用</button>'}));
 editorPanel.querySelectorAll('[data-format]').forEach(b=>{b.setAttribute('aria-label',({heading:'标题',bold:'加粗',italic:'斜体',list:'无序列表',quote:'引用'})[b.dataset.format]);b.onclick=()=>{const el=$('#canvasEditText'),r=formatSelection(el.value,el.selectionStart,el.selectionEnd,b.dataset.format);el.value=r.value;el.focus();el.setSelectionRange(r.start,r.end);};});refreshNodeOverlays();
 $('#cancelCanvasEdit').onclick=closeModal;
 $('#saveCanvasEdit').onclick=()=>{
  if(p!==source||!p.nodes.includes(n)||n.title!==title||n.text!==text)return toast('节点内容已变化，请关闭后重新打开编辑');
  const nextTitle=$('#canvasEditTitle').value.trim()||'未命名节点',nextText=$('#canvasEditText').value;
  if(nextTitle===title&&nextText===text)return closeModal();
  checkpoint();
  if(context&&['script','asset'].includes(context.kind))editStoryNode(p,id,{title:nextTitle,text:nextText});
  else{n.title=nextTitle;n.text=nextText;const o=p.objects.find(o=>o.id===n.objectId);if(o&&nextTitle!==title)o.name=nextTitle;}
  closeModal();commit();renderProperties();toast('内容已保存，可撤销');
 };
 $('#canvasEditText').onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&!e.isComposing){e.preventDefault();$('#saveCanvasEdit').click();}};
 $('#canvasEditText').focus();
}
function canvasTemplatesModal(at){
 modal(t('template.tplTitle'),t('template.tplSubtitle'),`<h3 class="template-section-title">剧本参考</h3><div class="template-grid"><button class="template-tile" id="templateScript"><b>导入已有剧本</b><span>粘贴或导入已有剧本，作为镜头、资产和预演参考。</span><small>不生成剧本，不自动拆分镜</small></button></div><h3 class="template-section-title">${t('template.tplFlows')}</h3><div class="template-grid">${CANVAS_TEMPLATES.map(t=>`<button type="button" class="template-tile" data-canvas-template="${esc(t.id)}"><b>${esc(t.title)}</b><span>${esc(t.description)}</span><small>${t.steps.map(esc).join(' → ')}</small></button>`).join('')}</div><p class="template-note">${t('template.tplNote')}</p>`);
 $('#templateScript').onclick=()=>{closeModal();scriptReferenceModal();};
 $$('[data-canvas-template]').forEach(b=>b.onclick=()=>insertCanvasTemplate(b.dataset.canvasTemplate,at));
}
function insertCanvasTemplate(id,at){
 try{
  const board=$('#board'),z=p.board.zoom;
  let x=at?.x??(board.clientWidth/2-p.board.x)/z-180,y=at?.y??(board.clientHeight/2-p.board.y)/z-95;
  const occupied=boardItems(p,nodeSizeOf);
  for(let i=0;i<=p.nodes.length;i++){
   if(!occupied.some(r=>x<r.x+r.w+24&&x+384>r.x&&y<r.y+r.h+24&&y+214>r.y))break;
   y+=240;
  }
  const plan=planCanvasTemplate(p,id,{x,y,createId:uid});
  validateProject(clone({...p,nodes:[...p.nodes,...plan.nodes],edges:[...p.edges,...plan.edges],boardGroups:[...(p.boardGroups||[]),plan.group]}));
  checkpoint();p.nodes.push(...plan.nodes);p.edges.push(...plan.edges);p.boardGroups=[...(p.boardGroups||[]),plan.group];
  closeModal();filter='all';if(mode!=='board')setMode('board');commit();setBoardSelection(plan.group.memberIds);
  p.board.x=board.clientWidth/2-(x+180)*z;p.board.y=board.clientHeight/2-(y+95)*z;boardTransform();persist();
  toast('已创建「'+plan.group.name+'」；打开组内节点继续填写，未调用生成服务');
 }catch(e){toast('模板未创建：'+e.message);}
}
function openNodeTool(nodeId,operation='edit'){
 const context=getCanvasStoryContext(p,nodeId);if(!context)return toast('关联内容已移除，请重新整理到画布');
 if(mode!=='board')setMode('board');
 select(nodeId);
 // Text, script and storyboard editing share the script workspace so the
 // document stays editable and the AI request composer sits directly below it.
 if(context.kind==='script'){
  if(operation==='assets')return wsShell.openTool('assets',{mode:'planning'});
  if(operation==='storyboard')return wsShell.openTool('script',{operation:'storyboard'});
  return wsShell.openTool('script',{tab:'text'});
 }
 if(context.kind==='shot')wsShell.openTool('script',{shotId:context.shotId,tab:'shots'});
 else wsShell.openTool('assets',{assetId:context.assetId,mode:'planning'});
}

function scriptReferenceModal(){
 const project=p, before=typeof p.workstation?.script==='string'?p.workstation.script:'';
 modal('剧本参考','导入、粘贴或修改已有剧本；造梦工坊不生成剧本。',`<section class="settings-section"><p class="help-text">这里的内容只作为镜头、资产和预演的参考文本，不会自动生成剧本或改写剧情。</p><label class="field">剧本内容<textarea id="scriptReferenceText" rows="16" maxlength="200000" placeholder="粘贴已有剧本、场次或镜头描述…">${esc(before)}</textarea></label><p class="help-text" id="scriptReferenceCount">${before.replace(/\s/g,'').length} 字</p></section>`,`<button id="scriptReferenceCancel">取消</button><button class="primary" id="scriptReferenceSave">保存剧本参考</button>`);
 const area=$('#scriptReferenceText');
 const count=()=>{if($('#scriptReferenceCount'))$('#scriptReferenceCount').textContent=area.value.replace(/\s/g,'').length+' 字';};
 area.oninput=count;
 $('#scriptReferenceCancel').onclick=closeModal;
 $('#scriptReferenceSave').onclick=()=>{
  if(p!==project)return;
  const text=area.value.slice(0,200000);
  try{checkpoint();p.workstation.script=text;if(text.trim())ensureScriptNode(p);commit();closeModal();toast('剧本参考已保存；不会自动生成分镜');}
  catch(e){if(history.length)p=history.pop();updateUndo();toast(e.message);}
 };
}

function shotSheetModal(focusShotId=null){
 const story=p.workstation.story||{shots:[],assets:[]};
 const original=new Map((story.shots||[]).map(shot=>[shot.id,structuredClone(shot)]));
 const rows=[...original.values()].map(shot=>({...shot}));
 const escValue=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rowHtml=(shot,index)=>`<tr data-shot-row="${escValue(shot.id)}"><td>${String(index+1).padStart(2,'0')}</td><td><input data-shot-field="scene" value="${escValue(shot.scene)}" maxlength="200" aria-label="场景"></td><td><textarea data-shot-field="description" rows="3" maxlength="6000" aria-label="画面描述">${escValue(shot.description)}</textarea></td><td><input data-shot-field="duration" type="number" min=".1" max="600" step=".1" value="${Number(shot.duration)||5}" aria-label="时长"></td><td><input data-shot-field="shotSize" value="${escValue(shot.shotSize)}" maxlength="100" aria-label="景别"></td><td><input data-shot-field="cameraMovement" value="${escValue(shot.cameraMovement)}" maxlength="200" aria-label="运镜"></td><td><textarea data-shot-field="dialogue" rows="3" maxlength="6000" aria-label="对白">${escValue(shot.dialogue)}</textarea></td><td><button type="button" data-shot-delete aria-label="删除镜头">删除</button></td></tr>`;
 const emptyRow=()=>({id:uid(),scene:'',description:'',duration:5,shotSize:'',cameraMovement:'',dialogue:'',characters:[],assetIds:[]});
 modal('镜头工作表','手工维护已有剧本的镜头；不生成剧本、不自动拆分镜。',`<section class="settings-section shot-sheet-section"><p class="help-text">逐镜填写场景、画面、时长和运镜；保存后用于白模预演、生成和剪辑。新镜头不会自动生成内容。</p><div class="shot-sheet-scroll"><table class="shot-sheet-table"><thead><tr><th>#</th><th>场景</th><th>画面描述</th><th>时长/s</th><th>景别</th><th>运镜</th><th>对白</th><th></th></tr></thead><tbody id="shotSheetRows">${rows.map(rowHtml).join('')}</tbody></table></div><button type="button" id="shotSheetAdd" class="key-button">＋ 新增镜头</button></section>`,`<button id="shotSheetCancel">取消</button><button class="primary" id="shotSheetSave">保存镜头表</button>`);
 const body=$('#shotSheetRows');
 const bindDelete=()=>body.querySelectorAll('[data-shot-delete]').forEach(b=>b.onclick=()=>b.closest('tr')?.remove());
 bindDelete();
 $('#shotSheetAdd').onclick=()=>{const shot=emptyRow();body.insertAdjacentHTML('beforeend',rowHtml(shot,body.children.length));bindDelete();body.lastElementChild?.scrollIntoView({block:'nearest'});};
 $('#shotSheetCancel').onclick=closeModal;
 $('#shotSheetSave').onclick=()=>{
  if(p!==storyProject)return;
  const next=[];
  for(const tr of body.querySelectorAll('[data-shot-row]')){
   const old=original.get(tr.dataset.shotRow)||{};
   const field=name=>tr.querySelector(`[data-shot-field="${name}"]`)?.value??'';
   const duration=Math.min(600,Math.max(.1,Number(field('duration'))||5));
   next.push({...old,id:tr.dataset.shotRow,scene:field('scene').trim().slice(0,200),description:field('description').slice(0,6000),duration,shotSize:field('shotSize').trim().slice(0,100),cameraMovement:field('cameraMovement').trim().slice(0,200),dialogue:field('dialogue').slice(0,6000),characters:Array.isArray(old.characters)?old.characters:[],assetIds:Array.isArray(old.assetIds)?old.assetIds:[]});
  }
  checkpoint();p.workstation.story={...p.workstation.story,shots:next};commit();closeModal();if(shotListOpen)renderShotChecklist();toast('镜头表已保存');
 };
 const storyProject=p;
 if(focusShotId){const row=body.querySelector(`[data-shot-row="${focusShotId}"]`);row?.scrollIntoView({block:'center'});row?.querySelector('[data-shot-field="scene"]')?.focus({preventScroll:true});}
}

function jumpToStage(stage){
 const setActive=()=>$('#stageNav')?.querySelectorAll('[data-stage]').forEach(b=>b.classList.toggle('active',b.dataset.stage===stage));
 setActive();
 if(stage==='script')return scriptReferenceModal();
 if(stage==='shots'){shotSheetModal();return;}
 if(stage==='assets'){wsShell?.openTool('assets');return;}
 if(stage==='previz'){setMode('stage');return;}
 if(stage==='edit'){wsShell?.setPage('edit');return;}
 if(stage==='generate'){
  const node=p.nodes.find(n=>n.id===selected);
  if(!node)return generationPanel(null,'image');
  if(node.type==='video')return providerVideoModal(node);
  if(['text','image','scene','actor'].includes(node.type))return aiImageModal(node);
  return toast('该节点不支持直接生成；请选择文本、图片、角色或场景节点');
 }
}

function ensureProjectScriptNode(){
 try{const previous=getScriptNode(p);if(previous)return previous;if(p.nodes.length>=500)throw Error('画布节点已满；可继续编辑剧本，整理后再创建节点');checkpoint();const node=ensureScriptNode(p);commit();return node;}catch(e){toast(e.message);return null;}
}
function createScriptNode(at){
 closeModal();if(mode!=='board')setMode('board');const existed=getScriptNode(p),node=ensureProjectScriptNode();if(!node)return;
 if(!existed&&at){const placed=freeNodePosition(p.nodes.filter(n=>n!==node),{...at,w:node.w,h:260},n=>nodeHeights.get(n.id)||n.h||260);Object.assign(node,placed);commit();}filter='all';renderBoard();renderSidebar();select(node.id);openNodeTool(node.id);if(existed)toast('已打开当前项目的剧本；普通文本可用于保存其他草稿');
}
function promoteNodeScript(nodeId){
 const node=p.nodes.find(n=>n.id===nodeId);if(!node)return;
 const apply=confirmed=>{try{checkpoint();const canonical=promoteTextToScript(p,nodeId,{replaceConfirmed:confirmed});commit();closeModal();openNodeTool(canonical.id);}catch(e){if(history.length)p=history.pop();updateUndo();toast(e.message);}};
 if(p.workstation.script.trim()&&p.workstation.script!==node.text){modal('替换项目剧本','原有分镜、资产图片和导演台内容会保留，请在修改后检查是否仍适用。',`<p>将「${esc(node.title)}」设为当前项目剧本？</p><pre class="script-source-preview">${esc(node.text.slice(0,2000))}</pre>`,'<button id="cancelScriptReplace">取消</button><button class="primary" id="confirmScriptReplace">确认替换剧本</button>');$('#cancelScriptReplace').onclick=closeModal;$('#confirmScriptReplace').onclick=()=>apply(true);}
 else apply(false);
}
function activateCanvasNode(id){
 const n=p.nodes.find(n=>n.id===id);if(!n)return;
 if(n.type==='director'){activeDirectorId=n.id;setMode('stage');}
 else if(n.type==='model')enterGeneratedModel(n);
 else if(n.type==='text')editCanvasNode(n.id);
 else if(getCanvasStoryContext(p,n.id))openNodeTool(n.id);
 else if(['image','video','audio'].includes(n.type)&&n.src)mediaNodePanel(n);
 else if(n.type==='video')providerVideoModal(n);
 else editCanvasNode(n.id);
}
function nodeVisible(n,f=filter){return f==='all'||(f==='media'?['image','video','audio'].includes(n.type):n.type===f)}
function renderBoard(){
 finishInlineNodeText();
 if(mode==='board')pruneBoardSelection();
 const groupsHtml=(p.boardGroups||[]).filter(g=>!hiddenByShotBundle(p,g)).map(g=>{
  const members=bundleMemberIds(p,g).map(id=>p.nodes.find(n=>n.id===id)).filter(Boolean),shown=members.filter(n=>nodeVisible(n));if(!shown.length)return '';
  const preview=shown.slice(0,3).map(n=>n.title).join(' · ');
  return `<div class="board-group ${g.collapsed?'collapsed':''} ${g.shotBundle?'shot-bundle':''}" data-group="${esc(g.id)}" aria-label="画布分组：${esc(g.name)}"><button type="button" class="board-group-title" data-group-title="${esc(g.id)}" title="${esc(g.name)} · 拖动整体移动 · 双击重命名"><span>${esc(g.name)}</span><small>${shown.length} ${g.videoVersions?'版':g.shotBundle?'项':g.storyShots?'镜':'节点'}</small></button>${g.collapsed&&g.shotBundle?shotBundleCard(p,g):g.collapsed&&g.videoVersions?videoVersionCard(p,g):g.collapsed?`<div class="group-card-summary"><b>${shown.length} ${g.storyShots?'个分镜':'个节点'}</b><p title="${esc(preview)}">${esc(preview)}</p><small>保留全部内容与连线，按需打开节点</small></div><div class="group-card-actions"><button data-group-list="${esc(g.id)}">${g.storyShots?'分镜列表':'节点列表'}</button><button data-group-toggle="${esc(g.id)}">展开全部</button></div>`:`<button class="group-collapse" data-group-toggle="${esc(g.id)}" title="收成一张卡片">收起</button>`}</div>`;
 }).join('');
 $('#nodes').innerHTML=groupsHtml+p.nodes.filter(n=>nodeVisible(n)&&!collapsedGroupFor(p,n.id)).map(n=>{const o=p.objects.find(o=>o.id===n.objectId),context=getCanvasStoryContext(p,n.id),info=nodePresentation(p,n);let visual='';if(n.src)visual=n.type==='audio'?`<audio class="node-media" src="${n.src}" controls preload="metadata"></audio>`:n.type==='video'?`<video class="node-media" src="${n.src}" controls preload="metadata"></video>`:`<img class="node-media" src="${n.src}" alt="${esc(n.title)}" draggable="false">`;else if(n.type==='actor')visual=`<div class="node-visual actor"><div class="avatar-sculpt" style="--actor-color:${o?.color||'#91b7b0'}"></div></div>`;else if(n.type==='scene')visual='<div class="node-visual"><div class="scene-sculpt"><i class="scene-table"></i></div></div>';else if(n.type==='director')visual='<div class="director-visual">◈　◌　◈</div>';else if(n.type==='model')visual='<div class="director-visual">⬡</div>';
 return `<article class="node node-${esc(n.type)} ${n.src?'has-media':''} ${boardSelection.includes(n.id)||selected===n.id?'selected':''}" data-id="${esc(n.id)}" tabindex="0" aria-label="${esc(info.label+'：'+n.title)}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px"><div class="node-head"><span>${uiIcon(n.type)}</span><b class="grow" title="${esc(n.title)}">${esc(n.title)}</b><span class="node-type">${esc(info.label)}</span></div>${['image','video','audio'].includes(n.type)&&!n.src?`<div class="node-empty"><div class="node-empty-icon">${uiIcon(n.type)}</div><div class="node-empty-actions"><button data-empty-action="import">${uiIcon('upload')}上传</button><button data-empty-action="library">${uiIcon('library')}节点列表</button></div><p>${n.type==='image'?'生成参考图，或拖入图片':n.type==='video'?'连入图片、视频、音频，开始生成':'拖入配音、音乐或音效'}</p></div>`:info.empty?`<div class="node-empty"><b>${esc(info.hint)}</b><small>点击节点开始编辑</small></div>`:visual}<div class="node-text">${renderNodeText(n.text.slice(0,2400))}</div>${canvasNodeActions(context)}<div class="node-meta"><span>${esc(info.label)}</span><span>${esc(info.status)}</span></div><button class="port in" data-port="in" aria-label="为 ${esc(n.title)} 选择来源节点" title="点击选择来源节点，也可拖拽连线"></button><button class="port out" data-port="out" aria-label="从 ${esc(n.title)} 选择目标节点" title="点击选择目标节点，也可拖拽连线"></button></article>`}).join('');
 boardTransform();requestAnimationFrame(drawEdges);
 $$('.node').forEach(el=>{
  nodeHeights.set(el.dataset.id,el.offsetHeight);
  el.addEventListener('pointerdown',e=>{
   if(e.button!==0||e.target.closest('button,input,textarea,video,audio,[contenteditable="true"]'))return;
   if(boardHandActive())return; // 抓手 / Space：节点区域交给画布平移，不劫持
   e.stopPropagation();
   const id=el.dataset.id;
   if(e.shiftKey||e.metaKey||e.ctrlKey){toggleBoardSelection(id);return}
   if(!boardSelection.includes(id))select(id);
   beginBoardNodesDrag(e,el,[...boardSelection]);
  });
  el.ondblclick=e=>{if(boardHandActive()||e.target.closest('video,audio,button,input,textarea,[contenteditable="true"]'))return;activateCanvasNode(el.dataset.id);};
  el.addEventListener('keydown',e=>{if(e.target!==el||!['Enter','F2'].includes(e.key))return;e.preventDefault();e.stopPropagation();select(el.dataset.id);if(e.key==='F2')editCanvasNode(el.dataset.id);else activateCanvasNode(el.dataset.id);});
  el.querySelectorAll('[data-node-tool]').forEach(button=>button.onclick=e=>{e.stopPropagation();openNodeTool(el.dataset.id,button.dataset.nodeTool);});
  el.querySelectorAll('[data-empty-action]').forEach(b=>b.onclick=e=>{e.stopPropagation();const n=p.nodes.find(n=>n.id===el.dataset.id);if(!n)return;if(b.dataset.emptyAction==='library'){toggleCanvasLibrary(true);filter=n.type;renderSidebar();renderBoard();}else runNodeQuickAction(n,'import',b);});
  el.querySelectorAll('.port').forEach(b=>installPortDrag(b,{edges:()=>p.edges,onConnect:connectBoardEdge,onActivate:()=>connectionTargetModal(el.dataset.id,b.dataset.port)}));
 });
 $$('[data-shot-generate]').forEach(b=>b.onclick=e=>{e.stopPropagation();const n=p.nodes.find(n=>n.id===b.dataset.shotGenerate);if(n)providerVideoModal(n);});
 $$('[data-video-versions]').forEach(b=>b.onclick=e=>{e.stopPropagation();versions().open(b.dataset.videoVersions);});
 $$('[data-video-send]').forEach(b=>b.onclick=e=>{e.stopPropagation();versions().send(b.dataset.videoSend);});
 $$('.board-group').forEach(gel=>{
  const group=(p.boardGroups||[]).find(g=>g.id===gel.dataset.group);
  gel.addEventListener('pointerdown',e=>{ // 组体点击：选中整组（不拖动；拖动走标题或选中后拖节点）
   if(e.button!==0||e.target.closest('button,input,textarea,video,audio,[contenteditable="true"]'))return;
   if(boardHandActive()){e.preventDefault();e.stopPropagation();startBoardPan(e);return}
   e.stopPropagation();if(group)setBoardSelection(bundleMemberIds(p,group));
  });
 });
 $$('.board-group-title').forEach(title=>{
  title.addEventListener('pointerdown',e=>{
   if(e.button===1||e.button===0&&boardHandActive()){e.preventDefault();e.stopPropagation();startBoardPan(e);return}
   if(e.button!==0)return;e.stopPropagation();
   const group=(p.boardGroups||[]).find(g=>g.id===title.dataset.groupTitle);if(!group)return;
   setBoardSelection(bundleMemberIds(p,group));
   beginBoardNodesDrag(e,title,bundleMemberIds(p,group)); // 拖标题 = 整组移动，组内外连线保留
  });
  title.onclick=e=>{if(e.detail===0){const group=p.boardGroups?.find(g=>g.id===title.dataset.groupTitle);if(group)setBoardSelection(bundleMemberIds(p,group));}};
  title.ondblclick=e=>{e.stopPropagation();if(boardHandActive())return;const group=(p.boardGroups||[]).find(g=>g.id===title.dataset.groupTitle);if(group)renameGroupModal(group)};
 });
 $$('[data-group-toggle]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleGroupCollapse(b.dataset.groupToggle);});
 $$('[data-group-list]').forEach(b=>b.onclick=e=>{e.stopPropagation();groupNodeList(b.dataset.groupList);});
 updateGroupFrames();renderNodeActionBar();renderCanvasStart();updateRelationControls();
}
function updateEdgeSelection(){if(!p.edges.some(e=>selectedEdge&&e.from===selectedEdge.from&&e.to===selectedEdge.to))selectedEdge=null;$('#cutEdge').disabled=!selectedEdge;}
function cutSelectedEdge(){if(!selectedEdge)return;checkpoint();p.edges=p.edges.filter(e=>e.from!==selectedEdge.from||e.to!==selectedEdge.to);selectedEdge=null;$('#contextMenu').classList.add('hidden');commit();toast('已剪断连线；导演台已有对象保留，可撤销');}
function visibleBoardItems(){return boardItems(p,nodeSizeOf,nodeVisible);}
function drawEdges(){
 updateEdgeSelection();const paths=[],wires=boardWires(p,visibleBoardItems()),relations=canvasRelations(p,boardSelection);
 for(const [i,wire] of wires.entries()){
  const {a,b,indices,groupIds}=wire,e=p.edges[indices[0]],na=p.nodes.find(n=>n.id===e.from),nb=p.nodes.find(n=>n.id===e.to);
  const x=a.x+a.w,y=a.y+a.h*.46+6,xx=b.x,yy=b.y+b.h*.46+6,d=Math.max(75,Math.abs(xx-x)/2),path=`M ${x} ${y} C ${x+d} ${y}, ${xx-d} ${yy}, ${xx} ${yy}`;
  const active=!groupIds.length&&selectedEdge?.from===e.from&&selectedEdge?.to===e.to;
  paths.push(`<path class="edge-line relation-${wireRelationState(wire,relations)} ${na.type==='model'&&nb.type==='director'?'asset-wire':''} ${active?'selected':''}" d="${path}"/><path class="edge-hit" d="${path}" data-wire="${i}" tabindex="0" role="button" aria-label="${groupIds.length?'分组连线，点击展开后编辑':'连线：'+esc(na.title)+' → '+esc(nb.title)}" aria-pressed="${active}"/>`);
 }
 $('#edges').innerHTML=paths.join('');
 $$('[data-wire]').forEach(el=>{
  const wire=wires[+el.dataset.wire],choose=()=>{
   if(wire.groupIds.length){checkpoint();for(const id of wire.groupIds){const g=p.boardGroups.find(g=>g.id===id);if(g)g.collapsed=false;}commit();toast('已展开分组，可选择具体连线编辑');return false;}
   select(null);selectedEdge=p.edges[wire.indices[0]];drawEdges();return true;
  };
  el.onpointerdown=e=>{e.stopPropagation();e.preventDefault()};
  el.onclick=e=>{e.stopPropagation();if(choose())toast(`连线已选中：Delete 或「剪断连线」删除；${K}+Z 撤销`)};
  el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};
  el.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();if(choose())showContextMenu($('#contextMenu'),{x:e.clientX,y:e.clientY,title:'连线 · 剪断后保留导演台对象',items:[{label:'✂ 剪断此连线',run:cutSelectedEdge}]});};
 });
 updateGroupFrames();scheduleMinimap();
}
$('#cutEdge').onclick=cutSelectedEdge;

function updateRelationControls(){
 if(relationProject!==p.id){relationReturnView=null;relationProject=p.id;}
 const focus=$('#focusRelations'),back=$('#returnRelationView');if(focus)focus.disabled=!boardSelection.length;if(back)back.hidden=!relationReturnView;
}
function focusCanvasRelations(){
 const next=fitRelationView(visibleBoardItems(),canvasRelations(p,boardSelection),{width:$('#board').clientWidth,height:$('#board').clientHeight});if(!next)return;
 updateRelationControls();if(!relationReturnView)relationReturnView=snapshotCanvasView(p.board);Object.assign(p.board,next);boardTransform();saveWorkspaceUI(true);updateRelationControls();if(shotListOpen)renderShotChecklist();
}
function returnCanvasRelationView(){if(!relationReturnView||relationProject!==p.id)return;Object.assign(p.board,relationReturnView);relationReturnView=null;boardTransform();saveWorkspaceUI(true);updateRelationControls();if(shotListOpen)renderShotChecklist();}
function navigateCanvasRelation(direction){
 const ids=relationTargets(p,boardSelection,direction);if(!ids.length)return toast(direction==='in'?'没有相连的来源节点':'没有相连的去向节点');
 const locate=id=>{closeModal();locateCanvasNode(id);requestAnimationFrame(()=>nodeAnchor(id)?.focus?.({preventScroll:true}));};
 if(ids.length===1)return locate(ids[0]);
 modal(direction==='in'?'来源节点':'去向节点','选择节点，查看它与当前素材的关系。',`<div class="relation-targets">${ids.map(id=>{const n=p.nodes.find(n=>n.id===id);return `<button type="button" data-relation-target="${esc(id)}">${esc(n.title)}<small>${esc(nodePresentation(p,n).label)}</small></button>`;}).join('')}</div>`);
 $$('[data-relation-target]').forEach(b=>b.onclick=()=>locate(b.dataset.relationTarget));
}
function renderCanvasStart(){
 let root=$('#boardStart');const empty=!p.nodes.length,filtered=!empty&&!visibleBoardItems().length;
 if(!empty&&!filtered){root?.remove();return;}
 if(!root){root=document.createElement('section');root.id='boardStart';root.className='board-empty-onboarding';$('#board').append(root);}
 root.innerHTML=empty?`<h2>从已有剧本开始</h2><p>造梦工坊不生成剧本。导入已有剧本和素材，或直接创建第一个镜头。</p><div><button type="button" class="primary" data-start-script>导入剧本</button><button type="button" data-start-shot>新建镜头</button><button type="button" data-start-import>导入素材</button></div>`:`<h2>此分类暂无节点</h2><button type="button" data-start-all>查看全部节点</button>`;
 root.querySelector('[data-start-script]')?.addEventListener('click',()=>scriptReferenceModal());root.querySelector('[data-start-shot]')?.addEventListener('click',()=>shotSheetModal());root.querySelector('[data-start-import]')?.addEventListener('click',()=>$('#importMedia').click());root.querySelector('[data-start-all]')?.addEventListener('click',()=>{filter='all';renderBoard();renderSidebar();fitBoard();});
 root.onpointerdown=e=>e.stopPropagation();
}
function boardTransform(){$('#world').style.transform=`translate(${p.board.x}px,${p.board.y}px) scale(${p.board.zoom})`;$('#zoomLabel').textContent=Math.round(p.board.zoom*100)+'%';scheduleMinimap();refreshNodeOverlays()}
function zoom(delta,cx,cy){const b=$('#board').getBoundingClientRect(),x=(cx??b.width/2+b.left)-b.left,y=(cy??b.height/2+b.top)-b.top,z=p.board.zoom,nz=clamp(z*delta,.2,2);p.board.x=x-(x-p.board.x)*nz/z;p.board.y=y-(y-p.board.y)*nz/z;p.board.zoom=nz;boardTransform();persist()}
function fitBoard(){
 const ns=visibleBoardItems();if(!ns.length)return;
 const minx=Math.min(...ns.map(n=>n.x)),miny=Math.min(...ns.map(n=>n.y)),maxx=Math.max(...ns.map(n=>n.x+n.w)),maxy=Math.max(...ns.map(n=>n.y+n.h));
 const w=$('#board').clientWidth,h=$('#board').clientHeight,tools=$('#boardToolbar'),actions=$('#nodeActionBar');
 const top=66,bottom=76,available=Math.max(80,h-top-bottom);
 p.board.zoom=clamp(Math.min((w-80)/Math.max(1,maxx-minx),available/Math.max(1,maxy-miny)),.2,1.15);
 p.board.x=(w-(maxx-minx)*p.board.zoom)/2-minx*p.board.zoom;
 p.board.y=top+(available-(maxy-miny)*p.board.zoom)/2-miny*p.board.zoom;
 boardTransform();persist();
}
$('#board').addEventListener('wheel',e=>{
 if(e.target.closest('.node-action-bar,.node-tool-panel,.shot-checklist'))return;
 e.preventDefault();
 if(e.shiftKey&&!e.altKey){panBoard(-(e.deltaY+(e.deltaX||0)),0);persist()} // board.x/y 为屏幕像素，平移不随缩放放大
 else zoom(Math.exp(-e.deltaY*.001),e.clientX,e.clientY);
},{passive:false});
$('#board').addEventListener('pointermove',e=>{boardPointer={x:e.clientX,y:e.clientY}},{passive:true});
$('#board').addEventListener('pointerdown',e=>{if(!e.target.closest('button,input,textarea,select,video,audio,.edge-hit,.shot-checklist,[contenteditable="true"]'))$('#board').focus({preventScroll:true})},true);
$('#board').addEventListener('pointerdown',e=>{
 if(e.button===1){ // 中键平移：任何工具、任何位置（媒体控件与工具条除外）
  if(e.target.closest('.board-controls,.board-toolbar,.board-minimap,.edge-hit,button,input,textarea,video,audio'))return;
  e.preventDefault();startBoardPan(e);return;
 }
 if(e.button!==0)return;
 if(e.target.closest('.node-action-bar,.board-controls,.board-toolbar,.board-minimap,.shot-checklist,.edge-hit,.board-group-title,[data-group-toggle],[data-group-list]'))return;
 if(boardHandActive()){
  if(e.target.closest('button,video,audio,input,textarea,select,[contenteditable="true"]'))return; // 媒体控件 / 连接端口优先，不被抓手劫持
  startBoardPan(e);return;
 }
 if(e.target.closest('.node'))return; // 节点自己的选择 / 拖动 / 加减选
 const groupEl=e.target.closest('.board-group');
 if(groupEl){const g=(p.boardGroups||[]).find(v=>v.id===groupEl.dataset.group);if(g)setBoardSelection(bundleMemberIds(p,g));return}
 dismissNodeUI();
 startBoardMarquee(e); // V 工具空白拖拽 = 框选
});
// ---- v1.2.10 画布交互：选择 / 多选移动 / 编组 / 对齐 / 小地图 / 剪贴 ----
const boardHandActive=()=>mode==='board'&&(boardTool==='hand'||spaceHand);
const nodeHeightOf=n=>$$('.node').find(el=>el.dataset.id===n.id)?.offsetHeight||nodeHeights.get(n.id)||250;
const nodeSizeOf=n=>({w:n.w,h:nodeHeightOf(n)});
function updateBoardSelectionClasses(){$$('.node').forEach(el=>el.classList.toggle('selected',boardSelection.includes(el.dataset.id)));updateGroupFrames();scheduleMinimap();renderNodeActionBar();drawEdges();updateRelationControls()}
function updateBoardToolbar(){
 $('#boardToolbar').dataset.selectionCount=String(boardSelection.length);
 const count=boardSelection.length,label=$('#boardSelCount');
 if(label)label.textContent=count?`已选 ${count} 个节点`:'未选中';
 const grouped=p.boardGroups?.length?groupsForSelection(p.boardGroups,boardSelection).length:0;
 for(const [id,disabled] of [['#boardGroupBtn',count<2],['#boardUngroupBtn',!grouped],['#boardAlignBtn',count<2],['#boardCopyBtn',!count],['#boardDeleteBtn',!count],['#boardPasteBtn',!canvasClipboard]]){const b=$(id);if(b)b.disabled=disabled}
}
function setBoardSelection(ids,{silent=false}={}){
 const next=groupAwareSelection(p,ids,nodeVisible);
 if(next.join('\n')!==boardSelection.join('\n'))nudgeStamp=0;
 boardSelection=next;
 selected=boardSelection.at(-1)??null;selectedEdge=null;updateEdgeSelection();
 updateBoardSelectionClasses();updateBoardToolbar();
 if(!silent){renderProperties();renderSidebar()}
}
function toggleBoardSelection(id){setBoardSelection(boardSelection.includes(id)?boardSelection.filter(x=>x!==id):[...boardSelection,id])}
function pruneBoardSelection(){
 boardSelection=groupAwareSelection(p,boardSelection,nodeVisible);
 if(mode==='board'){
  const primary=p.nodes.find(n=>n.id===selected&&nodeVisible(n));
  if(!boardSelection.length&&primary)boardSelection=[primary.id];
  selected=boardSelection.includes(selected)?selected:boardSelection.at(-1)??null;
 }
 updateBoardToolbar();
}
function updateDraggedNodes(){
 refreshNodeOverlays();
 for(const id of boardSelection){const n=p.nodes.find(v=>v.id===id),el=$$('.node').find(v=>v.dataset.id===id);if(n&&el){el.style.left=n.x+'px';el.style.top=n.y+'px'}}
}
function updateGroupFrames(){
 for(const el of $$('.board-group')){
  const g=(p.boardGroups||[]).find(v=>v.id===el.dataset.group);
  if(!g){el.remove();continue}
  const rect=g.collapsed?groupCardRect(p,g,nodeVisible):groupBounds(bundleMemberIds(p,g).map(id=>p.nodes.find(n=>n.id===id)).filter(n=>n&&nodeVisible(n)),nodeSizeOf);
  if(!rect){el.remove();continue}
  el.style.left=rect.x+'px';el.style.top=rect.y+'px';el.style.width=rect.w+'px';el.style.height=rect.h+'px';
  el.classList.toggle('selected',bundleMemberIds(p,g).every(id=>boardSelection.includes(id)));
 }
}
function setBoardTool(tool,quiet){boardTool=tool;$('#board')?.classList.toggle('hand-tool',tool==='hand');for(const [id,on] of [['#toolSelect',tool==='select'],['#toolHand',tool==='hand']]){const b=$(id);if(b){b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))}}if(!quiet)toast(tool==='hand'?'抓手工具 H：左键拖拽平移画布，按 V 回到选择工具':'选择工具 V：点击或空白框选，Shift / '+K+' 点击加选减选')}
function beginSpaceHand(){if(spaceHand)return;spaceHand=true;$('#board')?.classList.add('hand-temp')}
function endSpaceHand(){if(!spaceHand)return;spaceHand=false;$('#board')?.classList.remove('hand-temp')}
function panBoard(dx,dy){p.board.x+=dx;p.board.y+=dy;boardTransform()}
function startBoardPan(e){
 const b=$('#board');let lastX=e.clientX,lastY=e.clientY,active=true;
 b.classList.add('panning');
 const move=ev=>{if(ev.pointerId!==e.pointerId)return;panBoard(ev.clientX-lastX,ev.clientY-lastY);lastX=ev.clientX;lastY=ev.clientY};
 const finish=()=>{if(!active)return;active=false;b.removeEventListener('pointermove',move);b.removeEventListener('pointerup',finish);b.removeEventListener('pointercancel',finish);window.removeEventListener('blur',finish);if(b.hasPointerCapture(e.pointerId))b.releasePointerCapture(e.pointerId);b.classList.remove('panning');if(boardGesture?.cancel===finish)boardGesture=null;persist()};
 boardGesture={cancel:finish};
 b.setPointerCapture(e.pointerId);b.addEventListener('pointermove',move);b.addEventListener('pointerup',finish);b.addEventListener('pointercancel',finish);window.addEventListener('blur',finish);
}
function startBoardMarquee(e){
 const b=$('#board'),previous=[...boardSelection],base=e.shiftKey?previous:[];
 const rect0=b.getBoundingClientRect(),sx=e.clientX,sy=e.clientY;
 const box=document.createElement('div');box.className='board-marquee';box.hidden=true;b.append(box);
 let dragged=false,closed=false,cur={x:sx,y:sy};
 const draw=()=>{
  const wr={x:(Math.min(sx,cur.x)-rect0.left-p.board.x)/p.board.zoom,y:(Math.min(sy,cur.y)-rect0.top-p.board.y)/p.board.zoom,w:Math.abs(cur.x-sx)/p.board.zoom,h:Math.abs(cur.y-sy)/p.board.zoom};
  box.hidden=false;Object.assign(box.style,{left:(Math.min(sx,cur.x)-rect0.left)+'px',top:(Math.min(sy,cur.y)-rect0.top)+'px',width:Math.abs(cur.x-sx)+'px',height:Math.abs(cur.y-sy)+'px'});
  setBoardSelection([...base,...visibleBoardItems().filter(r=>nodesInRect([r],wr,n=>n).length).flatMap(r=>r.memberIds)],{silent:true}); // 框选 + Shift 在原选择上追加
 };
 const cleanup=()=>{b.removeEventListener('pointermove',move);b.removeEventListener('pointerup',up);b.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);if(b.hasPointerCapture(e.pointerId))b.releasePointerCapture(e.pointerId);box.remove();document.body.classList.remove('board-box-selecting')};
 const finish=cancelled=>{if(closed)return;closed=true;cleanup();boardGesture=null;
  if(cancelled)setBoardSelection(previous); // 指针取消 / Esc：恢复原选择，不留状态
  else if(!dragged){if(!e.shiftKey)select(null)}
  else setBoardSelection(boardSelection);
 };
 const cancel=()=>finish(true),up=ev=>{if(ev.pointerId===e.pointerId)finish(false)};
 const move=ev=>{if(ev.pointerId!==e.pointerId)return;if(!dragged&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<4)return;dragged=true;document.body.classList.add('board-box-selecting');cur={x:ev.clientX,y:ev.clientY};draw()};
 boardGesture={cancel};
 b.setPointerCapture(e.pointerId);b.addEventListener('pointermove',move);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);
}
function beginBoardNodesDrag(e,el,ids){
 const moves=sanitizeSelection(ids,p.nodes).map(id=>p.nodes.find(n=>n.id===id)).map(n=>({n,x:n.x,y:n.y}));
 const sx=e.clientX,sy=e.clientY,historyBefore=history.slice(),futureBefore=future.slice();let moved=false,closed=false;
 const cleanup=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',cancel);el.removeEventListener('lostpointercapture',cancel);window.removeEventListener('blur',cancel);if(el.hasPointerCapture?.(e.pointerId))el.releasePointerCapture(e.pointerId)};
 const finish=cancelled=>{if(closed)return;closed=true;cleanup();boardGesture=null;
  if(cancelled){for(const m of moves){m.n.x=m.x;m.n.y=m.y}if(moved){history=historyBefore;future=futureBefore;updateUndo()} // 取消恢复两条历史分支，含满栈时的最旧记录
   updateDraggedNodes();drawEdges();return}
  if(moved)persist();
  else if(ids.length===1&&!boardHandActive()&&(!$('.modal')||$('.node-tool-panel'))){const node=p.nodes.find(n=>n.id===ids[0]);if(node){if(node.type==='image')aiImageModal(node);else if(node.type==='video')providerVideoModal(node);else if(node.type==='audio'&&node.src)mediaNodePanel(node);else if(['text','actor','scene'].includes(node.type))editCanvasNode(node.id);}}
 };
 const cancel=()=>finish(true),up=ev=>{if(ev.pointerId===e.pointerId)finish(false)};
 const move=ev=>{if(ev.pointerId!==e.pointerId)return;const dx=(ev.clientX-sx)/p.board.zoom,dy=(ev.clientY-sy)/p.board.zoom;
  if(!moved){if(Math.hypot(ev.clientX-sx,ev.clientY-sy)<=3)return;checkpoint();moved=true}
  for(const m of moves){m.n.x=m.x+dx;m.n.y=m.y+dy}
  updateDraggedNodes();drawEdges();
 };
 boardGesture={cancel};el.setPointerCapture(e.pointerId);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',cancel);el.addEventListener('lostpointercapture',cancel);window.addEventListener('blur',cancel);
}
function deleteBoardSelection(){
 if(!boardSelection.length)return;
 dismissNodeUI();
 const count=boardSelection.length;
 checkpoint();
 const ids=new Set(boardSelection);
 p.nodes=p.nodes.filter(n=>!ids.has(n.id)); // 只删画布节点与关联连线；导演台对象 / 镜头 / 动作绝不触碰
 p.edges=p.edges.filter(e=>!ids.has(e.from)&&!ids.has(e.to));
 p.boardGroups=pruneGroups(p.boardGroups||[],p.nodes);
 boardSelection=[];selected=null;
 commit();renderProperties();updateBoardToolbar();
 toast(`已删除 ${count} 个画布节点与关联连线；导演台对象保留，${K}+Z 可撤销`);
}
function nudgeBoardSelection(dx,dy){
 if(!boardSelection.length)return;
 const now=Date.now();
 if(!(nudgeStamp&&now-nudgeStamp<1200))checkpoint(); // 连续按键合并为一次撤销
 nudgeStamp=now;
 for(const id of boardSelection){const n=p.nodes.find(v=>v.id===id);if(n){n.x+=dx;n.y+=dy}}
 updateDraggedNodes();drawEdges();persist();
}
function applyCanvasPaste(plan){
 if((p.boardGroups?.length||0)+plan.groups.length>200)return toast('画布最多支持 200 个分组，本次粘贴未执行');
 pasteSerial++;checkpoint();filter='all'; // 与其它“加入画布”流程一致：切到全部分类，保证新节点可见
 p.nodes.push(...plan.nodes);p.edges.push(...plan.edges);
 if(plan.groups.length)p.boardGroups=[...(p.boardGroups||[]),...plan.groups];
 commit();setBoardSelection(plan.nodes.map(n=>n.id));
 toast(`已粘贴 ${plan.nodes.length} 个节点${plan.edges.length?'及内部连线':''}；已解除与原工程对象的绑定，本地媒体与模型保留`);
}
function copyBoardSelection(){
 if(!boardSelection.length){toast('请先选择要复制的节点');return null}
 canvasClipboard=buildCanvasCopy(p.nodes,p.edges,boardSelection,p.boardGroups||[]);canvasClipboardToken=uid();pasteSerial=0;
 updateBoardToolbar();
 return canvasClipboard;
}
function pasteFromMemory(){
 if(!canvasClipboard)return toast('还没有复制的画布节点');
 let plan;try{plan=pasteCanvasCopy(canvasClipboard,{uid,offset:{x:40*(1+pasteSerial),y:40*(1+pasteSerial)},limit:500-p.nodes.length})}catch(err){return toast(err.message)}
 applyCanvasPaste(plan);
}
document.addEventListener('copy',e=>{
 if(mode!=='board'||managerOpen||transitioning||exporting||boardGesture)return;
 if(editingTarget(e)||e.target.closest?.('.shot-checklist')||$('.modal')||!$('#contextMenu').classList.contains('hidden'))return;
 if(!boardSelection.length)return;
 const clip=copyBoardSelection();if(!clip)return;
 let stored=false;
 if(e.clipboardData){try{const raw=JSON.stringify(clip);if(raw.length<=16*1024*1024){e.clipboardData.setData(CANVAS_CLIP_MIME,raw);e.clipboardData.setData('text/plain','director-canvas-nodes:'+raw)}else{e.clipboardData.setData('text/plain','director-canvas-memory:'+canvasClipboardToken)}stored=true}catch{}}
 if(stored)e.preventDefault(); // 文本标记兼容原生菜单；大素材用当前会话令牌，避免陈旧剪贴数据抢占粘贴
 toast(`已复制 ${clip.nodes.length} 个画布节点${clip.edges.length?'及内部连线':''}；可跨工程粘贴`);
});
document.addEventListener('paste',e=>{
 if(mode!=='board'||managerOpen||transitioning||exporting||boardGesture)return;
 if(editingTarget(e)||e.target.closest?.('.shot-checklist')||$('.modal')||!$('#contextMenu').classList.contains('hidden'))return;
 if(e.clipboardData?.files?.length||[...(e.clipboardData?.items||[])].some(item=>item.kind==='file'))return;
 let raw='';try{raw=e.clipboardData?.getData(CANVAS_CLIP_MIME)||''}catch{}
 if(!raw){
  let plain='';try{plain=e.clipboardData?.getData('text/plain')||''}catch{}
  if(plain.startsWith('director-canvas-nodes:'))raw=plain.slice('director-canvas-nodes:'.length);
  else if(canvasClipboard&&plain==='director-canvas-memory:'+canvasClipboardToken){e.preventDefault();pasteFromMemory();return}
  else return; // 外部文字、文件、空剪贴板都保留系统行为，不使用陈旧内部数据
 }
 if(raw.length>64*1024*1024)return toast('剪贴内容过大，未粘贴');
 let clip;try{clip=JSON.parse(raw)}catch{return toast('剪贴内容不是有效的画布数据')}
 let plan;try{plan=pasteCanvasCopy(clip,{uid,offset:{x:40*(1+pasteSerial),y:40*(1+pasteSerial)},limit:500-p.nodes.length})}catch(err){return toast(err.message)}
 e.preventDefault();applyCanvasPaste(plan);
});
function duplicateBoardSelection(){
 if(!boardSelection.length)return;
 let plan;try{
  plan=pasteCanvasCopy(buildCanvasCopy(p.nodes,p.edges,boardSelection,p.boardGroups||[]),{uid,offset:{x:45,y:45},limit:500-p.nodes.length});
  if((p.boardGroups?.length||0)+plan.groups.length>200)return toast('画布最多支持 200 个分组，本次复制未执行');
  for(const n of plan.nodes)n.title=(n.title+' 副本').slice(0,100);
  for(const g of plan.groups)g.name=(g.name+' 副本').slice(0,100);
 }catch(err){return toast(err.message)}
 checkpoint();filter='all';
 p.nodes.push(...plan.nodes);p.edges.push(...plan.edges);
 if(plan.groups.length)p.boardGroups=[...(p.boardGroups||[]),...plan.groups];
 commit();setBoardSelection(plan.nodes.map(n=>n.id));
 toast(`已复制 ${plan.nodes.length} 个节点及内部连线；副本已解除对象绑定，${K}+Z 可撤销`);
}
function bundleBoardShot(nodeIds=boardSelection){
 if(mode!=='board'||!nodeIds.length)return toast('先选中一个视频入口或镜头版本，再整理镜头');
 try{const plan=planShotBundle(p,{nodeIds,createId:uid});checkpoint();p.boardGroups=plan.boardGroups;commit();setBoardSelection(bundleMemberIds(p,plan.group));focusVersionGroup(plan.group.id);toast((plan.updated?'镜头组已更新':'已整理为镜头组')+'；原节点与连线保留'+(plan.excludedIds.length?'，其他分组中的参考保持原位':''));}catch(e){toast(e.message);}
}
function groupBoardSelection(){
 if(mode!=='board')return;
 if((p.boardGroups||[]).some(g=>g.shotBundle&&bundleMemberIds(p,g).some(id=>boardSelection.includes(id))))return toast('镜头组已包含这些节点；要重新编组，请先解开镜头组');
 if(boardSelection.length<2)return toast('请先选择至少 2 个节点再编组（'+K+'+G）');
 const count=(p.boardGroups||[]).length,next=regroup(p.boardGroups||[],boardSelection,uid(),'分组 '+(count+1));
 if(next.length>200)return toast('画布最多支持 200 个分组，请先解组或合并已有分组');
 checkpoint();p.boardGroups=next;
 commit();
 toast(`已把 ${boardSelection.length} 个节点编组；点组标题选整组，拖标题整体移动，双击标题重命名`);
}
function ungroupBoardSelection(){
 if(mode!=='board')return;
 const outer=(p.boardGroups||[]).filter(g=>g.shotBundle&&g.memberIds.some(id=>boardSelection.includes(id)));
 const hit=outer.length?outer:groupsForSelection(p.boardGroups||[],boardSelection);
 if(!hit.length)return toast('所选节点不在任何分组中');
 checkpoint();
 const ids=new Set(hit.map(g=>g.id));
 p.boardGroups=pruneGroups((p.boardGroups||[]).filter(g=>!ids.has(g.id)),p.nodes);
 commit();
 toast(`已解组 ${hit.length} 个分组；节点与全部连线保留，${K}+Z 可撤销`);
}
function toggleGroupCollapse(id){
 const g=p.boardGroups?.find(g=>g.id===id);if(!g)return;checkpoint();g.collapsed=!g.collapsed;commit();
 requestAnimationFrame(()=>{const rect=g.collapsed?groupCardRect(p,g):groupBounds(bundleMemberIds(p,g).map(id=>p.nodes.find(n=>n.id===id)).filter(Boolean),nodeSizeOf);if(!rect)return;const z=p.board.zoom;p.board.x=$('#board').clientWidth/2-(rect.x+rect.w/2)*z;p.board.y=$('#board').clientHeight/2-(rect.y+Math.min(rect.h,400)/2)*z;boardTransform();persist();});
}
function collapseStoryShots(){
 const trial=structuredClone(p),planned=ensureStoryShotGroup(trial,{force:true});
 if(!planned)return toast('没有可收起的分镜；至少需要 2 个未加入其他分组的分镜节点');
 checkpoint();p.boardGroups=trial.boardGroups;
 for(const node of p.nodes){const next=trial.nodes.find(n=>n.id===node.id);if(!next.storyStandalone)delete node.storyStandalone;}
 commit();setBoardSelection(planned.memberIds);fitBoard();toast(`已把 ${planned.memberIds.length} 个分镜收成一张卡片；内容与连线保留`);
}
function groupNodeList(id){
 const group=p.boardGroups?.find(g=>g.id===id);if(!group)return;
 if(group.videoVersions)return versions().open(id);
 const nodes=bundleMemberIds(p,group).map(id=>p.nodes.find(n=>n.id===id)).filter(Boolean);
 modal(group.shotBundle?'镜头素材':group.storyShots?'分镜列表':'组内节点',`${nodes.length} 个条目。编辑内容不会展开画布；需要继续连线时，可单独显示节点。`,
 `<div class="group-shot-list">${nodes.map((n,i)=>`<article class="group-shot-row"><span class="group-shot-number">${i+1}</span><div><b>${esc(n.title)}</b><p>${esc(n.text.slice(0,300))}</p></div><div class="group-shot-tools"><button data-group-edit="${esc(n.id)}">${n.src?'查看 / 工具':'编辑'}</button>${group.shotBundle?'':`<button data-group-extract="${esc(n.id)}">单独显示</button>`}</div></article>`).join('')}</div>`);
 $$('[data-group-edit]').forEach(b=>b.onclick=()=>{closeModal();const n=p.nodes.find(n=>n.id===b.dataset.groupEdit);if(n?.src&&['image','video','audio'].includes(n.type))return mediaNodePanel(n);if(getCanvasStoryContext(p,b.dataset.groupEdit))openNodeTool(b.dataset.groupEdit);else editCanvasNode(b.dataset.groupEdit)});
 $$('[data-group-extract]').forEach(b=>b.onclick=()=>{checkpoint();detachGroupNode(p,id,b.dataset.groupExtract);closeModal();commit();filter='all';renderBoard();locateCanvasNode(b.dataset.groupExtract);toast('已单独显示，可继续连线；其余节点仍收在组内');});
}
function renameGroupModal(g){
 modal('重命名分组',`此分组包含 ${bundleMemberIds(p,g).length} 个节点。分组只是画布组织方式，不改变 3D 场景与连线。`,`<label class="field">分组名称<input id="groupNameEdit" maxlength="50" value="${esc(g.name)}"></label>`,`<button id="cancelGroupName">取消</button><button class="primary" id="saveGroupName">保存</button>`);
 $('#cancelGroupName').onclick=closeModal;
 $('#saveGroupName').onclick=()=>{const name=$('#groupNameEdit').value.trim();if(!name)return toast('分组名称不能为空');const current=p.boardGroups?.find(v=>v.id===g.id);if(!current)return closeModal();checkpoint();current.name=name;closeModal();commit();toast('分组已重命名')};
}
const ALIGN_MENU=[['left','左对齐'],['hcenter','水平居中'],['right','右对齐'],['top','顶对齐'],['vcenter','垂直居中'],['bottom','底对齐']];
function alignBoardSelectionImpl(kind){
 if(boardSelection.some(id=>collapsedGroupFor(p,id)))return toast('请先展开分组，再对齐组内节点');
 if(boardSelection.length<2)return toast('对齐需要至少 2 个节点');
 const moves=alignSelection(p.nodes,boardSelection,kind,nodeSizeOf);
 if(!moves)return toast('对齐需要至少 2 个节点');
 checkpoint();
 for(const [id,pos] of moves){const n=p.nodes.find(v=>v.id===id);if(n){n.x=pos.x;n.y=pos.y}}
 commit();toast(`已对齐 ${moves.size} 个节点（尺寸不变），${K}+Z 可撤销`);
}
function distributeBoardSelection(axis){
 if(boardSelection.some(id=>collapsedGroupFor(p,id)))return toast('请先展开分组，再调整组内间距');
 if(boardSelection.length<3)return toast('等距分布需要至少 3 个节点');
 let moves;try{moves=distributeSelection(p.nodes,boardSelection,axis,nodeSizeOf)}catch(err){return toast(err.message)}
 if(!moves)return toast('等距分布需要至少 3 个节点');
 checkpoint();
 for(const [id,pos] of moves){const n=p.nodes.find(v=>v.id===id);if(n){n.x=pos.x;n.y=pos.y}}
 commit();toast(`已${axis==='x'?'水平':'垂直'}等距分布 ${moves.size} 个节点，${K}+Z 可撤销`);
}
function focusBoardSelection(){
 const ns=sanitizeSelection(boardSelection,p.nodes).map(id=>p.nodes.find(n=>n.id===id));
 if(!ns.length)return toast('请先选择要聚焦的节点（Shift+2）');
 const chosen=new Set(ns.map(n=>n.id)),rects=visibleBoardItems().filter(item=>item.memberIds.some(id=>chosen.has(id)));
 const minx=Math.min(...rects.map(r=>r.x)),miny=Math.min(...rects.map(r=>r.y)),maxx=Math.max(...rects.map(r=>r.x+r.w)),maxy=Math.max(...rects.map(r=>r.y+r.h));
 const w=$('#board').clientWidth,h=$('#board').clientHeight;
 p.board.zoom=clamp(Math.min((w-80)/Math.max(1,maxx-minx),(h-90)/Math.max(1,maxy-miny)),.2,1.15);
 p.board.x=(w-(maxx-minx)*p.board.zoom)/2-minx*p.board.zoom;
 p.board.y=(h-(maxy-miny)*p.board.zoom)/2-miny*p.board.zoom;
 boardTransform();persist();
}
function boardAnchor(){ // 缩放锚点：鼠标在画布内用鼠标，否则视口中心
 const b=$('#board').getBoundingClientRect();
 if(boardPointer.x!=null&&boardPointer.x>=b.left&&boardPointer.x<=b.right&&boardPointer.y>=b.top&&boardPointer.y<=b.bottom)return {x:boardPointer.x,y:boardPointer.y};
 return {x:null,y:null};
}
function boardZoomStep(delta){const a=boardAnchor();zoom(delta,a.x,a.y)}
function boardZoomTo100(){const a=boardAnchor();zoom(1/p.board.zoom,a.x,a.y)}
function renderMinimap(){
 const cv=$('#minimapCanvas');if(!cv||!minimapOn)return;
 const ctx=cv.getContext('2d');if(!ctx)return;
 const b=$('#board'),bw=b.clientWidth,bh=b.clientHeight;if(!bw||!bh)return;
 const view={x:-p.board.x/p.board.zoom,y:-p.board.y/p.board.zoom,w:bw/p.board.zoom,h:bh/p.board.zoom};
 const rects=visibleBoardItems().map(n=>({...n,sel:n.memberIds.some(id=>boardSelection.includes(id))}));
 const bounds=minimapBounds(rects,view);if(!bounds){minimapProj=null;return}
 const projection=minimapDragProjection||{bounds,scale:Math.min(cv.width/bounds.w,cv.height/bounds.h)};
 const mapBounds=projection.bounds,scale=projection.scale,ox=projection.ox??(cv.width-mapBounds.w*scale)/2,oy=projection.oy??(cv.height-mapBounds.h*scale)/2;
 minimapProj={bounds:mapBounds,scale,ox,oy};
 ctx.clearRect(0,0,cv.width,cv.height);
 for(const r of rects){ctx.fillStyle=r.sel?'#e8bd80':'#5b6a77';ctx.fillRect(ox+(r.x-mapBounds.x)*scale,oy+(r.y-mapBounds.y)*scale,Math.max(2,r.w*scale),Math.max(2,r.h*scale))}
 ctx.strokeStyle='#e8bd80';ctx.lineWidth=1.5;
 ctx.strokeRect(ox+(view.x-mapBounds.x)*scale,oy+(view.y-mapBounds.y)*scale,view.w*scale,view.h*scale);
}
function scheduleMinimap(){if(!minimapOn||minimapRaf)return;minimapRaf=requestAnimationFrame(()=>{minimapRaf=0;renderMinimap()})}
function setMinimap(on){
 minimapOn=on;$('#boardMinimap')?.classList.toggle('hidden',!on);
 const btn=$('#minimapToggle');if(btn){btn.setAttribute('aria-pressed',String(on));btn.classList.toggle('active',on)}
 if(on)scheduleMinimap();
}
{
 const cv=$('#minimapCanvas');if(cv){
  const locate=e=>{
   if(!minimapProj)return;
   const r=cv.getBoundingClientRect(),mx=(e.clientX-r.left)*(cv.width/r.width),my=(e.clientY-r.top)*(cv.height/r.height);
   const wx=minimapProj.bounds.x+(mx-minimapProj.ox)/minimapProj.scale,wy=minimapProj.bounds.y+(my-minimapProj.oy)/minimapProj.scale;
   const b=$('#board');p.board.x=b.clientWidth/2-wx*p.board.zoom;p.board.y=b.clientHeight/2-wy*p.board.zoom;boardTransform();
  };
  cv.addEventListener('pointerdown',e=>{
   if(e.button!==0||boardGesture)return;
   e.preventDefault();e.stopPropagation();minimapDragProjection=minimapProj;cv.setPointerCapture(e.pointerId);locate(e);let closed=false;
   const move=ev=>{if(ev.pointerId===e.pointerId)locate(ev)};
   const finish=()=>{if(closed)return;closed=true;cv.removeEventListener('pointermove',move);cv.removeEventListener('pointerup',finish);cv.removeEventListener('pointercancel',finish);cv.removeEventListener('lostpointercapture',finish);window.removeEventListener('blur',finish);if(cv.hasPointerCapture(e.pointerId))cv.releasePointerCapture(e.pointerId);boardGesture=null;minimapDragProjection=null;scheduleMinimap();persist()};
   boardGesture={cancel:finish};
   cv.addEventListener('pointermove',move);cv.addEventListener('pointerup',finish);cv.addEventListener('pointercancel',finish);cv.addEventListener('lostpointercapture',finish);window.addEventListener('blur',finish);
  });
 }
}
const CANVAS_SHORTCUTS=[
 {group:'工具',items:[['V','选择工具（默认）'],['H','抓手工具 · 左键拖拽平移'],['Space（按住）','临时抓手，松开 / 失焦自动恢复'],['中键拖拽','任意工具下平移画布']]},
 {group:'选择',items:[['点击','选中单个节点'],['Shift / ⌘ + 点击','加选 / 减选'],['空白处拖拽','框选节点'],['框选 + Shift','在原有选择上追加'],['⌘/Ctrl + A','选中当前分类的全部可见节点'],['Esc','清空选择 / 取消拖拽']]},
 {group:'编辑',items:[['⌘/Ctrl + C','复制所选（含所选节点间连线，可跨工程）'],['⌘/Ctrl + V','粘贴（重新编号、位置错开、解除对象绑定）'],['⌘/Ctrl + D','批量复制所选'],['Delete / Backspace','删除所选节点（仅画布与连线，不动导演台）'],['方向键','微调 1 画布单位；连续按合并为一次撤销'],['Shift + 方向键','微调 10 画布单位'],['⌘/Ctrl + G','把所选节点编组'],['⌘/Ctrl + Shift + G','解组所选节点所在的组']]},
 {group:'视图',items:[['F','适应全部内容'],['Shift + 1','适应全部内容'],['Shift + 2','聚焦所选节点'],['Shift + 0','缩放回到 100%'],['⌘/Ctrl + 加 / 减','以鼠标为锚放大 / 缩小'],['滚轮','缩放（保持原习惯）'],['Shift + 滚轮','水平平移'],['小地图','拖动定位视口；工具条 ◫ 开关']]},
 {group:'分组',items:[['点击组标题','选中整组'],['拖动组标题','整组移动（组内外连线保留）'],['双击组标题','重命名分组'],['右键组标题','重命名 / 解组 / 选中整组']]}
];
function canvasShortcutsModal(query=''){
 modal('画布快捷键速查','只收录画布的已实现快捷键；3D 导演台快捷键请看使用指南（顶栏 ?）。',`<label class="field">搜索快捷键<input id="shortcutSearch" type="search" placeholder="例如：编组、缩放、框选、粘贴" value="${esc(query)}"></label><div id="shortcutList" class="shortcut-list" style="margin-top:10px"></div>`);
 const list=$('#shortcutList'),input=$('#shortcutSearch');
 const draw=q=>{const words=q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const groups=CANVAS_SHORTCUTS.map(g=>({...g,items:g.items.filter(([keys,desc])=>!words.length||words.every(w=>(keys+' '+desc).toLowerCase().includes(w)))})).filter(g=>g.items.length);
  list.innerHTML=groups.map(g=>`<div class="shortcut-group"><h3>${esc(g.group)}</h3>${g.items.map(([keys,desc])=>`<div class="shortcut-row"><kbd>${esc(keys)}</kbd><span>${esc(desc)}</span></div>`).join('')}</div>`).join('')||'<p class="help-text">没有匹配的快捷键。</p>';
 };
 draw(query);input.oninput=()=>draw(input.value);input.focus();
}
$('#toolSelect').onclick=()=>setBoardTool('select');
$('#toolHand').onclick=()=>setBoardTool('hand');
$('#collapseStoryBtn').onclick=collapseStoryShots;
$('#bundleShotBtn').onclick=()=>bundleBoardShot();
$('#boardGroupBtn').onclick=groupBoardSelection;
$('#boardUngroupBtn').onclick=ungroupBoardSelection;
$('#boardDeleteBtn').onclick=deleteBoardSelection;
$('#boardCopyBtn').onclick=async()=>{
 const clip=copyBoardSelection();if(!clip)return;const raw=JSON.stringify(clip),payload=raw.length<=16*1024*1024?'director-canvas-nodes:'+raw:'director-canvas-memory:'+canvasClipboardToken;let stored=false;
 try{if(window.directorDesktop?.writeCanvasClipboard)stored=(await window.directorDesktop.writeCanvasClipboard(payload))?.ok===true;else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(payload);stored=true}}catch{}
 if(!stored){try{stored=document.execCommand('copy')}catch{}}
 toast(stored?`已复制 ${clip.nodes.length} 个画布节点；${K}+V 或工具条「粘贴」放置副本`:`已复制 ${clip.nodes.length} 个节点到当前会话；使用工具条「粘贴」放置副本`);
};
$('#boardPasteBtn').onclick=pasteFromMemory;
$('#boardAlignBtn').onclick=e=>{
 e.currentTarget.blur();const r=e.currentTarget.getBoundingClientRect(),n=boardSelection.length;
 showContextMenu($('#contextMenu'),{x:r.left,y:r.bottom+4,title:`对齐与分布 · 已选 ${n} 个节点`,items:[
  ...ALIGN_MENU.map(([kind,label])=>({label,run:()=>alignBoardSelectionImpl(kind),disabled:n<2})),
  {label:'水平等距分布（需 ≥3）',run:()=>distributeBoardSelection('x'),disabled:n<3},
  {label:'垂直等距分布（需 ≥3）',run:()=>distributeBoardSelection('y'),disabled:n<3},
 ]});
};
$('#minimapToggle').onclick=()=>setMinimap(!minimapOn);
$('#canvasKeysBtn').onclick=()=>canvasShortcutsModal();
setBoardTool('select',true);setMinimap(true);updateBoardToolbar();
function vecFields(label,key,v){return `<label class="field">${label}</label><div class="triplet">${v.map((n,i)=>`<label class="axis-label">${['X','Y','Z'][i]}<input type="number" step="0.1" min="-1000" max="1000" value="${Number(n.toFixed(2))}" data-vector="${key}" data-index="${i}" aria-label="${label} ${['X','Y','Z'][i]}"></label>`).join('')}</div>`}
const propertyGroups=new Map();
let propertyContext='';
function propertyGroup(kind,key,title,body,expanded=false){const open=propertyGroups.get(kind+':'+key)??expanded;return `<details class="property-group" data-property-group="${kind}:${key}" ${open?'open':''}><summary>${title}</summary><div class="property-group-body">${body}</div></details>`}
function renderProperties(){
 const previousScroll=$('#properties').scrollTop;
 $$('#properties [data-property-group]').forEach(el=>propertyGroups.set(el.dataset.propertyGroup,el.open));
 $('#previewSection').classList.toggle('hidden',mode!=='stage');$('[data-panel-resize=preview]').classList.toggle('hidden',mode!=='stage');
 $('#groundBtn').disabled=mode!=='stage'||!p.objects.some(o=>o.id===selected&&o.type!=='camera');
 const o=mode==='stage'?p.objects.find(o=>o.id===selected):null,n=mode==='board'?p.nodes.find(n=>n.id===selected):null;
 document.body.classList.toggle('canvas-inspector-empty',mode==='board');
 $('#inspectorTitle').textContent=o?types[o.type]+'属性':n?'资产属性':'创作概览';
 if(o){const s=sampleObject(o,time),group=(key,title,body,open=false)=>propertyGroup(o.type,key,title,body,open);
 $('#properties').innerHTML=`<div class="property-identity"><span class="property-icon">${icons[o.type]}</span><input id="objName" aria-label="对象名称" title="重命名对象" value="${esc(o.name)}" maxlength="100"></div>
 ${group('transform','变换<button type="button" id="transformKey" class="parameter-key transform-key" aria-label="记录全部变换关键帧">◇</button>',`${vecFields('位置 · 米','position',s.position)}${o.type==='camera'?`<label class="field">滚转 · °<input id="objRoll" type="number" value="${s.roll.toFixed(1)}" step="1" min="-3600" max="3600"></label>`:`<label class="field">旋转 · °</label><div class="triplet">${['rotationX','rotation','rotationZ'].map((field,i)=>`<label class="axis-label">${['X','Y','Z'][i]}<input id="${['objRotX','objRot','objRotZ'][i]}" type="number" value="${s[field].toFixed(1)}" step="1" min="-3600" max="3600"></label>`).join('')}</div><label class="field">缩放<input id="objScale" type="number" value="${s.scale.toFixed(2)}" min=".1" max="20" step=".1"></label>`}`,true)}
 ${o.type==='camera'?group('lens','镜头',`<div class="property-columns"><label class="field">画幅<select id="objAspect">${Object.keys(formats).map(f=>`<option ${f===(o.aspect||'16:9')?'selected':''}>${f}</option>`).join('')}</select></label><label class="field">视场角 · °<input id="objFov" type="number" min="10" max="120" value="${s.fov.toFixed(0)}"></label></div>${vecFields('注视点 · 米','target',s.target)}<div class="property-actions"><button id="editTarget" title="用 XYZ 操作杆调整注视点">◎ 调整注视点</button><button id="targetVisibility">${stage?.showTarget?'隐藏':'显示'}红点</button></div><button id="cameraPreset" class="key-button">＋ 运镜预设</button>`,true):''}
 ${o.type==='model'?group('performance','动作',`<div class="property-actions"><button id="walkActionBtn">沿路径行走</button><button id="runActionBtn">沿路径奔跑</button></div><div class="property-actions"><button id="modelActions" class="${stage?.meshes.get(o.id)?.userData.clips?.length?'primary':''}">动作库</button></div><label class="field">默认循环<select title="时间轴动作片段以外播放的默认循环" id="modelClip"><option value="">静态</option></select></label>`,!!stage?.meshes.get(o.id)?.userData.clips?.length):o.type==='actor'?group('performance','动作',`<div class="property-actions"><button id="walkActionBtn">沿路径行走</button><button id="runActionBtn">沿路径奔跑</button></div><label class="field">人物体型<select id="actorVariant">${Object.entries(actorVariants).map(([id,v])=>`<option value="${id}" ${id===(o.actorVariant||'adultMale')?'selected':''}>${v.name} · ${v.height} 米</option>`).join('')}</select></label><label class="field">基础姿态<select id="objPose">${Object.entries(poses).map(([v,t])=>`<option value="${v}" ${s.pose===v?'selected':''}>${t}</option>`).join('')}</select></label><div class="property-actions"><button id="actorPreset">＋ 时间轴动作</button></div>`,true):''}
 ${group('appearance','外观',`${o.type==='camera'?`<label class="field">机位图标大小<input id="objScale" type="number" value="${s.scale.toFixed(2)}" min=".1" max="20" step=".1"></label>`:''}<label class="field">${o.type==='camera'?'机位标识颜色':'颜色'}<input id="objColor" type="color" value="${s.color}"></label>`)}
 ${group('keyframes','关键帧',`<label class="field">过渡<select id="keyEase"><option value="smooth">平滑进出</option><option value="linear">匀速</option><option value="hold">保持至下一帧</option></select></label><button class="key-button" id="keyProperty" title="记录全部参数，包含机位、注视点及视场角">◇ 记录全部参数 · ${time.toFixed(2)}s</button>`)}
 ${group('path','运动路径',`<div class="property-actions"><button title="点击路径点移动位置；选择入柄或出柄调整曲线" id="bezierBtn">编辑曲线</button><button id="bezierNumbers">手柄数值…</button></div>`)}
 <div class="property-footer"><button id="duplicateObject">复制对象</button><button id="deleteObject" class="danger">删除</button></div>`;
 if($('#walkActionBtn'))$('#walkActionBtn').onclick=()=>pathWalkModal(o,undefined,'walk');if($('#runActionBtn'))$('#runActionBtn').onclick=()=>pathWalkModal(o,undefined,'run');
 $('#bezierBtn').onclick=()=>editBezier(o);$('#bezierNumbers').onclick=()=>bezierModal(o);
 if($('#modelTextAction'))$('#modelTextAction').onclick=()=>modelMotionModal(o);if($('#modelActions'))$('#modelActions').onclick=()=>modelActionModal(o);if($('#playModelAction'))$('#playModelAction').onclick=()=>{if(!o.modelClip)return toast('请先从离线动作库选择动作');setTime(0);playing=true;followPlayhead=true;updateFollowButton();last=performance.now();$('#playBtn').textContent='Ⅱ';};
 if($('#actorVariant'))$('#actorVariant').onchange=e=>{if(o.locked)return;checkpoint();o.actorVariant=e.target.value;commit(true);renderProperties()};
 $('#objName').onchange=e=>{checkpoint();o.name=e.target.value.trim()||types[o.type];p.nodes.filter(n=>n.objectId===o.id).forEach(n=>n.title=o.name);commit();renderProperties()};
 $$('[data-vector]').forEach(el=>el.onchange=()=>editObject(o,cur=>{cur[el.dataset.vector][+el.dataset.index]=clamp(+el.value||0,-1000,1000)}));
 for(const [id,field] of Object.entries({objRot:'rotation',objRotX:'rotationX',objRotZ:'rotationZ',objRoll:'roll'}))if($('#'+id))$('#'+id).onchange=e=>editObject(o,cur=>cur[field]=clamp(+e.target.value||0,-3600,3600));$('#objScale').onchange=e=>editObject(o,cur=>cur.scale=clamp(+e.target.value||1,.1,20));$('#objColor').onchange=e=>editObject(o,cur=>cur.color=e.target.value);
 if($('#objFov'))$('#objFov').onchange=e=>editObject(o,cur=>cur.fov=clamp(+e.target.value||45,10,120));if($('#objPose'))$('#objPose').onchange=e=>editObject(o,cur=>cur.pose=e.target.value);
 if($('#editTarget'))$('#editTarget').onclick=()=>{stop();stage?.editingTarget(true);stage?.frameSelection();toast('拖动红点或三轴手柄调整注视点')};if($('#targetVisibility'))$('#targetVisibility').onclick=()=>{stage.showTarget=!stage.showTarget;if(!stage.showTarget)stage.targetEditing=false;stage.select(selected);renderProperties()};if($('#cameraPreset'))$('#cameraPreset').onclick=()=>motionModal(o.id);if($('#actorPreset'))$('#actorPreset').onclick=()=>actionModal(o.id);
 $('#keyProperty').onclick=()=>recordKey();$('#duplicateObject').onclick=()=>{checkpoint();const dup=clone(o);dup.id=uid();dup.name+=' 副本';dup.solo=false;dup.position[0]+=1;dup.keys.forEach(k=>k.position[0]+=1);dup.channels?.positionX?.forEach(k=>k.value+=1);p.objects.push(dup);commit(true);select(dup.id)};$('#deleteObject').onclick=()=>deleteSelected();
 if($('#objAspect'))$('#objAspect').onchange=e=>{if(o.locked)return;checkpoint();o.aspect=e.target.value;commit();renderProperties()};

 if(o.type==='model'){const loaded=stage?.meshes.get(o.id)?.userData;$('#properties').insertAdjacentHTML('afterbegin',`<p class="load-note">${loaded?.loadError?'加载失败：'+esc(loaded.loadError):loaded?.loaded?'':'正在加载本地模型…'}</p>`);mountModelAppearance(o,s);const clips=stage?.meshes.get(o.id)?.userData.clips||[];$('#modelClip').innerHTML='<option value="">静态</option>'+clips.map(c=>`<option value="${esc(c.name)}" ${c.name===o.modelClip?'selected':''}>${esc(clipLabel(c.name))}</option>`).join('');$('#modelClip').onchange=e=>{if(o.locked)return;checkpoint();o.modelClip=e.target.value;commit();renderProperties()};}
 $('#transformKey').onclick=e=>{e.preventDefault();e.stopPropagation();recordTransformKey()};
 mountParameterButtons(o);
 if(o.locked){$$('#properties input,#properties select,#properties button').forEach(el=>el.disabled=true);$('#properties').insertAdjacentHTML('afterbegin',`<p class="lock-note">${lockIcon(true)} 已锁定</p>`);}

 }else if(n){$('#properties').innerHTML=`<div class="inspector-section"><span class="badge">${n.type==='model'?t('node.badge3d'):labels[n.type]}</span><label class="field">${t('node.assetName')}<input id="nodeTitle" value="${esc(n.title)}" maxlength="100"></label><label class="field">${t('node.content')}<textarea id="nodeText" rows="5">${esc(n.text)}</textarea></label>${n.objectId?'<button id="goObject" class="key-button">'+t('node.locateObject')+'</button>':''}${n.type==='director'?'<button id="goDirector" class="key-button">'+t('node.goDirector')+'</button>':''}<div class="row" style="margin-top:15px"><button id="duplicateNode" class="grow">${t('node.duplicate')}</button><button id="deleteNode" class="danger grow">${t('node.delete')}</button></div>${n.src?`<button id="downloadMedia" style="width:100%;margin-top:8px">${t('node.download')}</button>`:''}<button id="clearEdges" style="width:100%;margin-top:8px">${t('node.removeEdges')}</button></div>`;
 if(['text','image','video','audio','actor','scene'].includes(n.type)){$('#properties').insertAdjacentHTML('beforeend','<div class="inspector-section"><h3>'+t('node.videoCreate')+'</h3><button id="generateVideo" class="key-button primary">'+t('node.generateVideo')+'</button><p class="help-text">'+t('node.videoHelp')+'</p></div>');$('#generateVideo').onclick=()=>providerVideoModal(n);}
 if(['video','audio'].includes(n.type)&&n.src)$('#properties').insertAdjacentHTML('beforeend',`<div class="inspector-section"><h3>${t('node.timeline')}</h3><button id="sendToEdit" class="key-button primary">${t('node.sendToEdit',{track:n.type==='video'?'V1':'A1'})}</button><p class="help-text">${t('node.timelineHelp')}</p></div>`);
  $('#nodeTitle').onchange=e=>{const context=getCanvasStoryContext(p,n.id);if(context?.kind==='shot')return;checkpoint();if(context&&['script','asset'].includes(context.kind))editStoryNode(p,n.id,{title:e.target.value.trim()||'未命名资产'});else n.title=e.target.value.trim()||'未命名资产';const o=p.objects.find(o=>o.id===n.objectId);if(o)o.name=n.title;commit();renderProperties()};$('#nodeText').onchange=e=>{const context=getCanvasStoryContext(p,n.id);if(context?.kind==='shot')return;checkpoint();if(context&&['script','asset'].includes(context.kind))editStoryNode(p,n.id,{text:e.target.value});else n.text=e.target.value;commit()};$('#duplicateNode').onclick=()=>duplicateCanvasNode(n);$('#deleteNode').onclick=()=>deleteSelected();$('#clearEdges').onclick=()=>{checkpoint();p.edges=p.edges.filter(e=>e.from!==n.id&&e.to!==n.id);commit()};if($('#sendToEdit'))$('#sendToEdit').onclick=()=>wsShell?.sendCanvasNodeToEdit(n.id);if($('#goObject'))$('#goObject').onclick=()=>{const id=n.objectId;setMode('stage');select(id);stage.frameSelection()};if($('#goDirector'))$('#goDirector').onclick=()=>setMode('stage');if(['image','video','audio'].includes(n.type)){$('#properties').insertAdjacentHTML('beforeend','<div class="inspector-section"><button id="replaceMedia" class="key-button">'+t('node.replaceMedia')+'</button></div>');$('#replaceMedia').onclick=()=>{mediaTarget=n.id;$('#mediaFile').accept=n.type+'/*';$('#mediaFile').click()};}if(['text','image','scene','actor'].includes(n.type)){$('#properties').insertAdjacentHTML('beforeend','<div class="inspector-section"><button id="generateAiImage" class="key-button primary">AI 生图</button><button id="imageCandidates" class="key-button">同源候选</button></div>');$('#generateAiImage').onclick=()=>aiImageModal(n);if(n.type==='image'&&n.generatedTask){$('#imageCandidates').onclick=()=>openImageCandidates(n.imageResultContext?.sourceNodeId||n.id,n.generatedTask);}else{$('#imageCandidates')?.remove();}}if(n.type==='model'){$('#properties').insertAdjacentHTML('beforeend','<div class="inspector-section"><h3>本地 3D 模型</h3><button id="modelToStage" class="key-button primary">加入导演台 / 查看模型</button><button id="downloadModel" class="key-button">下载模型 GLB</button></div>');$('#modelToStage').onclick=()=>enterGeneratedModel(n);$('#downloadModel').onclick=()=>download(n.modelSrc,n.title+'.glb');}if($('#downloadMedia'))$('#downloadMedia').onclick=()=>download(n.src,mediaFileName(n));
 }else{$('#properties').innerHTML=`<div class="inspector-section"><span class="badge">项目设置</span><h2 style="font-size:21px;margin-top:15px">${esc(p.name)}</h2><label class="field">预演时长 / 秒<input id="durationInput" type="number" min="1" max="3600" step="0.1" value="${p.duration}"></label><label class="field">导出帧率<select id="fpsInput">${[24,25,30].map(f=>`<option ${p.fps===f?'selected':''}>${f}</option>`).join('')}</select></label>${mode==='board'?'<div class="row" style="margin-top:15px"><button class="grow" id="overviewAdd">＋ 添加资产</button></div>':''}</div>`;
 $('#durationInput').onchange=e=>{const value=+e.target.value;if(!Number.isFinite(value)||value<1||value>3600){e.target.value=p.duration;return toast('时长须为 1–3600 秒');}if(contentEnd(p)>value){e.target.value=p.duration;durationModal(value);}else applyDuration(value,false)};$('#fpsInput').onchange=e=>{checkpoint();p.fps=+e.target.value;commit()};if($('#overviewAdd'))$('#overviewAdd').onclick=addAssetModal;}
 if(!o&&!n&&mode==='stage'){
 const color=p.groundColor||DEFAULT_GROUND_COLOR;
 $('#properties').insertAdjacentHTML('beforeend',`<div class="inspector-section"><h3>场景地面</h3><div class="ground-swatches" role="group" aria-label="地面配色">${groundColors.map(([name,value])=>`<button data-ground-color="${value}" aria-label="地面颜色：${name}" aria-pressed="${color.toLowerCase()===value}" title="${name}" class="${color.toLowerCase()===value?'active':''}"><i style="background:${value}"></i><span>${name}</span></button>`).join('')}</div><label class="field ground-custom">自定义颜色<input id="groundColor" type="color" aria-label="自定义地面颜色" value="${color}"></label></div>`);
 const change=value=>{if(value===color)return;stop();checkpoint();p.groundColor=value;commit();renderProperties();};$$('[data-ground-color]').forEach(b=>b.onclick=()=>change(b.dataset.groundColor));$('#groundColor').onchange=e=>change(e.target.value);
 }
 if(n){
  const context=getCanvasStoryContext(p,n.id);
  if(context?.kind==='shot'){$('#nodeTitle').readOnly=true;$('#nodeText').readOnly=true;$('#nodeText').title='在分镜编辑器中修改镜头内容';}
  if(context){$('#properties').insertAdjacentHTML('beforeend',`<div class="inspector-section" id="storyContextControls">${canvasNodeActions(context,true)}</div>`);$$('#storyContextControls [data-node-tool]').forEach(button=>button.onclick=()=>openNodeTool(n.id,button.dataset.nodeTool));}
  else if(n.type==='text'){$('#properties').insertAdjacentHTML('beforeend','<button id="useAsScript" class="key-button">'+t('node.useAsScript')+'</button>');$('#useAsScript').onclick=()=>promoteNodeScript(n.id);}
  organizeNodeProperties(n);
 }
 const context=mode+':'+(o?.id||n?.id||'overview');
 $$('#properties [data-property-group]').forEach(el=>el.addEventListener('toggle',()=>{if(el.isConnected)propertyGroups.set(el.dataset.propertyGroup,el.open)}));
 $('#properties').scrollTop=context===propertyContext?previousScroll:0;propertyContext=context;
 renderPathControls();
}
// Reuse existing controls so generation, import and download handlers stay attached.
function organizeNodeProperties(n){
 const root=$('#properties'),controls=new Map([...root.querySelectorAll('button[id]')].map(b=>[b.id,b]));
 const name=$('#nodeTitle').closest('label'),content=$('#nodeText').closest('label');
 const identity=document.createElement('div');identity.className='inspector-section node-identity';identity.append(name);const edit=document.createElement('button');edit.type='button';edit.className='key-button';edit.textContent=getCanvasStoryContext(p,n.id)?.kind==='shot'?t('node.editShot'):t('node.editContent');edit.onclick=()=>editCanvasNode(n.id);identity.append(edit);const disclosure=document.createElement('details');disclosure.className='node-content-disclosure';const summary=document.createElement('summary');summary.textContent=t('node.contentDisclosure');disclosure.append(summary,content);identity.append(disclosure);
 const next=document.createDocumentFragment();next.append(identity);
 const group=(key,title,ids,open=false)=>{const buttons=ids.map(id=>controls.get(id)).filter(Boolean);if(!buttons.length)return;const holder=document.createElement('div');holder.innerHTML=propertyGroup('node-'+n.type,key,title,'',open);const detail=holder.firstElementChild;detail.querySelector('.property-group-body').append(...buttons);next.append(detail);};
 group('source',t('node.sourceGroup'),['manageStoryAsset','useAsScript'],true);
 group('video',t('node.videoGroup'),['generateVideo'],true);
 group('create',t('node.createGroup'),n.type==='image'?['imageToScene','imageToActor','goObject','generateAiImage']:n.type==='model'?['modelToStage']:n.type==='director'?['goDirector']:['generateAiImage','goObject'],true);
 group('files',t('node.filesGroup'),['replaceMedia','downloadMedia','downloadModel','sendToEdit','clearEdges']);
 const footer=document.createElement('div');footer.className='property-footer';footer.append(controls.get('duplicateNode'),controls.get('deleteNode'));next.append(footer);
 root.replaceChildren(next);
}
function editObject(o,fn){if(o.locked){toast('对象已锁定');return}stop();const t=clamp(Math.round(time*p.fps)/p.fps,0,p.duration),before=frame(o,t),cur=clone(before);fn(cur);const changed={};for(const id of parameterIds(o)){const value=parameterValue(cur,id),old=parameterValue(before,id);if(typeof value==='number'?Math.abs(value-old)>1e-7:value!==old)changed[id]=value;}if(!Object.keys(changed).length)return;checkpoint();editParameters(o,t,changed,$('#keyEase')?.value||'smooth');stage.updatePaths();commit();renderProperties()}
function recordKey(){const o=p.objects.find(o=>o.id===selected);if(!o){toast('请先选择人物、道具或摄影机');return}if(o.locked){toast('对象已锁定');return}stop();checkpoint();const t=clamp(Math.round(time*p.fps)/p.fps,0,p.duration),state=sampleBaseObject(o,t);for(const id of parameterIds(o))addParameterKey(o,id,t,parameterValue(state,id),$('#keyEase')?.value||'smooth');stage.updatePaths();commit();renderProperties();toast(`已记录 ${o.name} · ${t.toFixed(2)}s`)}
function recordTransformKey(){
 const o=p.objects.find(o=>o.id===selected);if(!o||o.locked)return;
 stop();const t=clamp(Math.round(time*p.fps)/p.fps,0,p.duration),draft=clone(o);
 try{addTransformKey(draft,t,$('#keyEase')?.value||'smooth')}catch(error){toast(error.message);return}
 checkpoint();o.channels=draft.channels;stage?.updatePaths();commit();renderProperties();toast(`已记录全部变换 · ${t.toFixed(2)}s`);
}
function parameterInputId(el){return el.dataset.vector?el.dataset.vector+['X','Y','Z'][+el.dataset.index]:({objRot:'rotation',objRotX:'rotationX',objRotZ:'rotationZ',objRoll:'roll',objScale:'scale',objColor:'color',modelTint:'modelTint',objFov:'fov',objPose:'pose'}[el.id])}
function parameterButtonState(){const o=mode==='stage'?p.objects.find(o=>o.id===selected):null;$$('[data-parameter-key]').forEach(b=>{const hit=o?.channels?.[b.dataset.parameterKey]?.some(k=>Math.abs(k.t-time)<.0001);b.textContent=hit?'◆':'◇';b.classList.toggle('keyed',!!hit);b.title=`${parameters[b.dataset.parameterKey].name} · ${hit?'更新':'添加'}当前参数关键帧 (${time.toFixed(2)}s)`;});
 const group=$('#transformKey');if(group&&o){
 const t=clamp(Math.round(time*p.fps)/p.fps,0,p.duration),hit=transformParameterIds(o).every(id=>(o.channels?.[id]??o.keys).some(k=>Math.abs(k.t-t)<.0001));
 group.textContent=hit?'◆':'◇';group.classList.toggle('keyed',hit);
 group.title=`${hit?'更新':'记录'}全部变换：${o.type==='camera'?'位置、滚转':'位置、旋转、缩放'} (${t.toFixed(2)}s)`;
 }
}
function mountParameterButtons(o){
 for(const el of $$('#properties input, #properties select')){
  const id=parameterInputId(el);if(!id||el.disabled||!parameterIds(o).includes(id))continue;
  if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label',parameters[id].name);
  const wrap=document.createElement('span');wrap.className='parameter-control';el.before(wrap);wrap.append(el);
  const b=document.createElement('button');b.type='button';b.className='parameter-key';b.dataset.parameterKey=id;b.setAttribute('aria-label',`为${parameters[id].name}添加关键帧`);
  b.onmousedown=e=>{if(e.button===0)e.preventDefault()};
  b.onclick=e=>{e.preventDefault();e.stopPropagation();recordParameter(id,el)};wrap.append(b);
 }
 parameterButtonState();
}
function recordParameter(id,el){
 const o=p.objects.find(o=>o.id===selected);if(!o||o.locked)return;
 const d=parameters[id],wasPlaying=playing;stop();
 const value=wasPlaying?parameterValue(sampleBaseObject(o,time),id):d.kind?el.value:el.valueAsNumber;
 if(!d.kind&&(!Number.isFinite(value)||value<d.min||value>d.max)){toast(`${d.name}须在 ${d.min}–${d.max} 之间`);return}
 const t=clamp(Math.round(time*p.fps)/p.fps,0,p.duration);
 if((o.channels?.[id]?.length||o.keys.length)>=1000&&!o.channels?.[id]?.some(k=>Math.abs(k.t-t)<.0001)){toast('该参数已达到 1000 个关键帧');return}
 checkpoint();addParameterKey(o,id,t,value,$('#keyEase')?.value||'smooth');stage?.updatePaths();commit();renderProperties();toast(`已记录 ${d.name} · ${t.toFixed(2)}s`);
}
function parameterTracks(o){if(!trackExpanded(o))return '';return Object.entries(o.channels||{}).filter(([,keys])=>keys.length).map(([id,keys])=>`<div class="track parameter-track"><span class="track-label param-nav-label" title="${parameters[id].name}"><i class="param-key-state" data-param-state="${o.id}:${id}" aria-hidden="true">◇</i><span class="param-nav-name">${parameters[id].name}</span><button class="param-jump" data-param-nav="${o.id}" data-parameter="${id}" data-direction="-1" aria-label="${parameters[id].name} 前一个关键帧" title="本参数前一个关键帧">◁</button><button class="param-jump" data-param-nav="${o.id}" data-parameter="${id}" data-direction="1" aria-label="${parameters[id].name} 后一个关键帧" title="本参数后一个关键帧">▷</button></span><div class="track-lane" data-scrub>${keys.map((k,i)=>`<button class="key parameter-frame" data-parameter="${id}" data-obj="${o.id}" data-key="${i}" style="left:${k.t/p.duration*100}%" title="${parameters[id].name} · ${k.t.toFixed(2)}s · 双击编辑"></button>`).join('')}</div></div>`).join('')}
function parameterKeyModal(id,parameter,index){
 const o=p.objects.find(o=>o.id===id);if(o.locked){toast('对象已锁定');return}const keys=o.channels[parameter],k=keys[index],d=parameters[parameter];
 const valueControl=d.kind==='pose'?`<select id="paramValueEdit">${Object.entries(poses).map(([v,name])=>`<option value="${v}" ${v===k.value?'selected':''}>${name}</option>`).join('')}</select>`:`<input id="paramValueEdit" type="${d.kind==='color'?'color':'number'}" value="${k.value}" ${d.kind==='color'?'':`min="${d.min}" max="${d.max}" step="${d.step}"`}>`;
 modal('编辑参数关键帧',`${esc(o.name)} · ${d.name} · 仅影响此参数。`,`<label class="field">时间 / 秒<input id="paramTimeEdit" type="number" min="0" max="${p.duration}" step="${1/p.fps}" value="${k.t}"></label><label class="field">${d.name}${valueControl}</label><label class="field">到下一关键帧的过渡<select id="paramEaseEdit" ${d.kind==='pose'?'disabled':''}><option value="smooth">平滑进出</option><option value="linear">匀速</option><option value="hold">保持</option></select></label><p class="help-text">删除该参数最后一个关键帧时，保留当前值并停止此参数的动画。</p>`,`<button id="removeParamKey" class="danger">删除参数关键帧</button><button id="saveParamKey" class="primary">保存参数关键帧</button>`);
 $('#paramEaseEdit').value=k.ease;
 $('#removeParamKey').onclick=()=>{const next=deleteTimelineKey(o,parameter,index,time);checkpoint();p.objects[p.objects.indexOf(o)]=next;timelineSelection=null;closeModal();stage.updatePaths();commit();renderProperties()};
 $('#saveParamKey').onclick=()=>{
  const t=Math.round(+$('#paramTimeEdit').value*p.fps)/p.fps,value=d.kind?$('#paramValueEdit').value:+$('#paramValueEdit').value;
  if(!Number.isFinite(t)||t<0||t>p.duration||!d.kind&&(!Number.isFinite(value)||value<d.min||value>d.max)){toast('请输入范围内的时间和参数值');return}
  if(keys.some((v,i)=>i!==index&&Math.abs(v.t-t)<.0001)){toast('该时间已有此参数的关键帧');return}
  const next=moveTimelineKey(o,parameter,index,t,p.duration,p.fps),nk=next.channels[parameter].find(k=>Math.abs(k.t-t)<.0001);nk.value=value;nk.ease=d.kind==='pose'?'hold':$('#paramEaseEdit').value;checkpoint();p.objects[p.objects.indexOf(o)]=next;timelineSelection=null;closeModal();stage.updatePaths();commit();setTime(t);
 };
}

function renderPreviewSelect(){const sel=$('#previewSelect');sel.innerHTML='<option value="">跟随剪辑</option>'+p.objects.filter(o=>o.type==='camera').map(o=>`<option value="${o.id}">${esc(o.name)}</option>`).join('');if(!p.objects.some(o=>o.id===override))override=null;sel.value=override||''}
function setTime(t,properties=true){time=clamp(Math.round(t*p.fps)/p.fps,0,p.duration);if(properties)renderProperties();updatePlayhead()}
function renderTracks(){const host=$('#tracks'),saved=saveTimelineScroll(host),ts=timelineTicks(p.duration,timelineNav?.zoom()||1).map(({t,label})=>`<span class="tick" style="left:${t/p.duration*100}%">${label}</span>`);$('#tracks').innerHTML=`<div class="timeline-ruler" data-scrub>${ts.join('')}<button class="timeline-cursor" aria-label="播放头" title="拖动定位 · 左右键逐帧 · Home / End"></button></div><div class="track"><span class="track-label">${t('stage.shotTrack')}</span><div class="track-lane" data-scrub>${p.shots.map((s,i)=>`<button class="shot-block" data-shot-id="${s.id}" style="left:${s.start/p.duration*100}%;width:${(s.end-s.start)/p.duration*100}%" title="${esc(p.objects.find(o=>o.id===s.cameraId)?.name)} · ${s.start.toFixed(2)}–${s.end.toFixed(2)}s · 拖动两端调整时长，双击编排"><span class="shot-handle start" data-shot-edge="start" title="拖动调整镜头开始"></span><span class="shot-caption">${String(i+1).padStart(2,'0')} ${esc(p.objects.find(o=>o.id===s.cameraId)?.name?.split('·').at(-1))} · ${(s.end-s.start).toFixed(2)}s</span><span class="shot-handle end" data-shot-edge="end" title="拖动调整镜头结束"></span></button>`).join('')}</div></div>`+p.objects.filter(o=>(o.keys.length||Object.keys(o.channels||{}).length||o.actions?.length||o.id===selected||['actor','camera'].includes(o.type))&&(!animatedOnly||o.id===selected||isAnimatedTrack(o,p.shots))).map(o=>`<div class="track"><span class="track-label"><button class="track-fold" data-track-fold="${o.id}" aria-label="${trackExpanded(o)?t('stage.collapse'):t('stage.expand')} ${esc(o.name)}关键帧" aria-expanded="${trackExpanded(o)}" title="${trackExpanded(o)?'折叠':'展开'}关键帧">${trackExpanded(o)?'⌄':'›'}</button><button class="track-object" data-track-object="${o.id}" title="选择 ${esc(o.name)}">${icons[o.type]} ${esc(o.name)}</button>${['actor','camera','model'].includes(o.type)?`<button class="track-add" data-preset-object="${o.id}" title="${o.type==='camera'?t('stage.cameraPreset'):t('stage.addAction')}">＋</button>`:''}</span><div class="track-lane" data-scrub>${(trackExpanded(o)?o.keys:[]).map((k,i)=>`<button class="key" data-obj="${o.id}" data-key="${i}" style="left:${k.t/p.duration*100}%" title="${k.note?esc(k.note)+' · ':''}${k.t.toFixed(2)}s · 双击编辑时间与过渡"></button>`).join('')}</div></div>${trackExpanded(o)?`<div class="track key-navigation-track"><span class="track-label">${t('stage.keyNav')}</span><div class="key-navigation-controls"><button data-key-jump="${o.id}" data-direction="-1" aria-label="${esc(o.name)} ${t('stage.previousKey')}">${t('stage.previous')}</button><button data-key-jump="${o.id}" data-direction="1" aria-label="${esc(o.name)} ${t('stage.nextKey')}">${t('stage.next')}</button><small>${t('stage.allParams')}</small></div></div>`:''}${parameterTracks(o)}${['actor','model'].includes(o.type)?`<div class="track action-track"><span class="track-label">${t('stage.actionTrack')}</span><div class="track-lane" data-scrub>${(o.actions||[]).map(a=>`<button class="action-block" data-action-object="${o.id}" data-action-id="${a.id}" style="left:${a.start/p.duration*100}%;width:${(a.end-a.start)/p.duration*100}%" title="${esc(o.name)} · ${a.mode==='hold'?'定格于 '+a.holdTime.toFixed(3)+' 秒 · ':''}${esc(a.clip?clipLabel(a.clip):poses[a.pose])} ${a.start.toFixed(2)}–${a.end.toFixed(2)}s · 拖两端调整时长，双击编辑"><span class="action-handle start" data-action-edge="start" title="拖动调整开始时间"></span><span class="action-caption">${a.mode==='hold'?'定格 · ':''}${a.followPath?(pathMotionKind(a)==='run'?'沿路径奔跑 · ':'沿路径行走 · '):''}${esc(a.clip?clipLabel(a.clip):poses[a.pose])} · ${(a.end-a.start).toFixed(2)}s</span><span class="action-handle end" data-action-edge="end" title="拖动调整结束时间"></span></button>`).join('')}</div></div>`:''}`).join('');
 host.insertAdjacentHTML('beforeend','<i class="timeline-playhead" aria-hidden="true"></i>');
 const ruler=$('.timeline-ruler');installPlayheadScrub(host,ruler,{duration:p.duration,fps:p.fps,getTime:()=>time,setTime,enabled:()=>!exporting&&!timelineGesture,onStart(cancel){stop();timelineGesture={cancel};$('.timeline-cursor')?.focus({preventScroll:true});},onFinish(){timelineGesture=null;renderProperties();}});
 $('.timeline-cursor').onkeydown=e=>{const target=e.key==='ArrowLeft'?time-1/p.fps:e.key==='ArrowRight'?time+1/p.fps:e.key==='Home'?0:e.key==='End'?p.duration:null;if(target!==null){e.preventDefault();e.stopPropagation();stop();setTime(target);revealPlayhead();}};
 $$('[data-key-jump]').forEach(el=>el.onclick=()=>{const o=p.objects.find(o=>o.id===el.dataset.keyJump),at=adjacentKeyTime(o,time,+el.dataset.direction);if(at===null)return;stop();selected=o.id;stage?.select(selected);timelineSelection=null;setTime(at);renderSidebar();updateTimelineSelection();revealPlayhead();});
 $$('[data-param-nav]').forEach(el=>el.onclick=()=>{const o=p.objects.find(o=>o.id===el.dataset.paramNav);if(!o)return;const at=adjacentParameterKeyTime(o,el.dataset.parameter,time,+el.dataset.direction);if(at===null)return;stop();selected=o.id;stage?.select(selected);timelineSelection=null;setTime(at);renderSidebar();updateTimelineSelection();revealPlayhead();});
 $$('[data-track-fold]').forEach(el=>el.onclick=()=>{const o=p.objects.find(o=>o.id===el.dataset.trackFold);expandedTracks.set(o.id,!trackExpanded(o));if(timelineSelection?.kind==='keys')timelineSelection.items=timelineSelection.items.filter(r=>r.objectId!==o.id);else if(timelineSelection?.objectId===o.id&&timelineSelection.kind==='key')timelineSelection=null;const top=$('#tracks').scrollTop;renderTracks();$('#tracks').scrollTop=top;});
 $$('[data-track-object]').forEach(el=>el.onclick=()=>select(el.dataset.trackObject));
 $$('[data-preset-object]').forEach(el=>el.onclick=()=>{const o=p.objects.find(o=>o.id===el.dataset.presetObject);o.type==='model'?modelActionModal(o):o.type==='actor'?actionModal(o.id):motionModal(o.id)});
 $$('[data-shot-id]').forEach(installShotDrag);
 installTimelineMarquee();
 $$('.key,[data-action-id]').forEach(installTimelineDrag);updateTimelineSelection();updatePlayhead();restoreTimelineScroll(host,saved);}
function timelineItem(){
 const x=timelineSelection?.kind==='keys'?{...timelineSelection.items[0],kind:'key'}:timelineSelection;if(x?.kind==='shot'){const item=p.shots.find(s=>s.id===x.shotId),o=p.objects.find(o=>o.id===item?.cameraId);return item&&o?{o,item}:null;}const o=p.objects.find(o=>o.id===x?.objectId);if(!o)return null;
 const keys=x.parameter?o.channels?.[x.parameter]:o.keys;
 const index=x.kind==='key'?keys?.findIndex(k=>Math.abs(k.t-x.t)<.0001):-1;
 const item=x.kind==='key'?keys?.[index]:o.actions?.find(a=>a.id===x.actionId);
 return item?{o,item,index}:null;
}
function updateTimelineSelection(){
 if(timelineSelection?.kind==='keys'){
  const hits=resolveKeyRefs(p.objects,timelineSelection.items);timelineSelection.items=hits.map(h=>h.ref);if(!hits.length)timelineSelection=null;
  else {const ids=new Set(hits.map(h=>keyRefId(h.ref)));$$('.key,[data-action-id],[data-shot-id]').forEach(el=>{const ref=el.classList.contains('key')?keyRefFromElement(el):null,on=!!ref&&ids.has(keyRefId(ref));el.classList.toggle('timeline-selected',on);el.setAttribute('aria-pressed',String(on))});$('#deleteTimeline').disabled=hits.some(h=>h.o.locked);$('#timelineHelp').textContent=`已选 ${hits.length} 个关键帧 · 拖动任一选中帧整体移动 · Delete 删除 · Shift 追加 / 取消`;return;}
 }
 const hit=timelineItem();if(!hit)timelineSelection=null;
 $$('.key,[data-action-id],[data-shot-id]').forEach(el=>{const x=timelineSelection;const active=!!x&&(x.kind==='shot'?el.dataset.shotId===x.shotId:x.kind==='action'?el.dataset.actionObject===x.objectId&&el.dataset.actionId===x.actionId:el.dataset.obj===x.objectId&&(el.dataset.parameter||null)===(x.parameter||null)&&+el.dataset.key===hit?.index);el.classList.toggle('timeline-selected',active);el.setAttribute('aria-pressed',String(active));});
 $('#deleteTimeline').disabled=!hit||hit.o.locked||timelineSelection?.kind==='shot';
 $('#timelineHelp').textContent=hit?(timelineSelection.kind==='shot'?`镜头 · ${hit.item.start.toFixed(2)}–${hit.item.end.toFixed(2)}s · ${(hit.item.end-hit.item.start).toFixed(2)} 秒 · 拖两端改时长，双击编排`:timelineSelection.kind==='key'?`已选关键帧 · ${hit.item.t.toFixed(2)}s · 拖动改时间，Delete 删除，双击编辑`:`已选动作 · ${hit.item.start.toFixed(2)}–${hit.item.end.toFixed(2)}s · ${(hit.item.end-hit.item.start).toFixed(2)} 秒 · 拖两端改时长，中间移动`):'左键框选 · Shift 追加 / 滚轮横移 · 标尺拖播放头 · 中键平移';
}
function revealTimelineSelection(){const el=$('#tracks .timeline-selected');if(el)el.scrollIntoView({block:'nearest',inline:'nearest'});}
function deleteTimelineSelected(){
 if(timelineSelection?.kind==='keys'){
  let next;const count=timelineSelection.items.length;try{next=deleteTimelineKeys(p.objects,timelineSelection.items,time)}catch(e){return toast(e.message)}
  stop();checkpoint();p.objects=next;timelineSelection=null;stage?.updatePaths();commit();renderProperties();toast(`已删除 ${count} 个关键帧，${K}+Z 可撤销`);return;
 }
 if(timelineSelection?.kind==='shot'){toast('双击镜头可在镜头编排中删除');return;}const hit=timelineItem();if(!hit){timelineSelection=null;return}if(hit.o.locked)return toast('对象已锁定');
 stop();const x=timelineSelection;let next;
 if(x.kind==='key')next=deleteTimelineKey(hit.o,x.parameter,hit.index,time);
 else {next=clone(hit.o);next.actions=next.actions.filter(a=>a.id!==x.actionId);}
 checkpoint();p.objects[p.objects.indexOf(hit.o)]=next;timelineSelection=null;stage?.updatePaths();commit();renderProperties();toast(x.kind==='key'?`已删除关键帧，${K}+Z 可撤销`:`已删除动作片段，${K}+Z 可撤销`);
}
$('#deleteTimeline').onclick=deleteTimelineSelected;
function installShotDrag(el){
 el.onclick=e=>{e.preventDefault();e.stopPropagation();};
 el.ondblclick=e=>{e.preventDefault();e.stopPropagation();shotsModal();};
 el.onpointerdown=e=>{
  if(e.button!==0||exporting||timelineGesture)return;e.preventDefault();e.stopPropagation();el.focus({preventScroll:true});stop();
  const shot=p.shots.find(s=>s.id===el.dataset.shotId);if(!shot)return;
  timelineSelection={kind:'shot',shotId:shot.id};selected=shot.cameraId;stage?.select(selected);renderSidebar();updateTimelineSelection();
  const initial=p.shots,initialTime=time,edge=e.target.closest('[data-shot-edge]')?.dataset.shotEdge,rect=el.closest('.track-lane').getBoundingClientRect(),x=e.clientX;
  if(!edge){setTime(clamp((x-rect.left)/rect.width*p.duration,shot.start,Math.max(shot.start,shot.end-1/p.fps)));return;}
  if(p.objects.find(o=>o.id===shot.cameraId)?.locked){toast('机位已锁定');renderProperties();return;}
  let draft=null,dragged=false,closed=false,error='';
  const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);el.removeEventListener('lostpointercapture',cancel);if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);document.body.classList.remove('timeline-dragging');timelineGesture=null;};
  const finish=cancelled=>{if(closed)return;closed=true;cleanup();p.shots=initial;
   if(!cancelled&&draft&&JSON.stringify(initial)!==JSON.stringify(draft)){checkpoint();p.shots=draft;commit();}else if(dragged)renderTracks();
   setTime(cancelled?initialTime:time);updateTimelineSelection();if(!cancelled&&error)toast(error);
  };
  const cancel=()=>finish(true),up=ev=>{if(ev.pointerId===e.pointerId)finish(false);};
  const move=ev=>{if(ev.pointerId!==e.pointerId)return;const dx=ev.clientX-x;if(!dragged&&Math.abs(dx)<3)return;dragged=true;document.body.classList.add('timeline-dragging');
   try{draft=shotTiming({...p,shots:initial},shot.id,edge,dx/rect.width*p.duration);p.shots=draft;error='';
    $$('[data-shot-id]').forEach(b=>{const s=draft.find(s=>s.id===b.dataset.shotId);b.style.left=s.start/p.duration*100+'%';b.style.width=(s.end-s.start)/p.duration*100+'%';b.querySelector('.shot-caption').textContent=(p.objects.find(o=>o.id===s.cameraId)?.name||'镜头')+' · '+(s.end-s.start).toFixed(2)+'s';});
    const s=draft.find(s=>s.id===shot.id);setTime(edge==='end'?Math.max(s.start,s.end-1/p.fps):s.start,false);$('#timelineHelp').textContent=`镜头 ${s.start.toFixed(2)}–${s.end.toFixed(2)}s · 松开保存 · Esc 取消`;
   }catch(err){error=err.message;$('#timelineHelp').textContent=error;}
  };
  timelineGesture={cancel};el.setPointerCapture(e.pointerId);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);el.addEventListener('lostpointercapture',cancel);
 };
}
function keyRefFromElement(el){const o=p.objects.find(o=>o.id===el.dataset.obj),parameter=el.dataset.parameter||null,k=(parameter?o?.channels?.[parameter]:o?.keys)?.[+el.dataset.key];return k?{objectId:o.id,parameter,t:k.t}:null;}
function selectedKeyRefs(){return timelineSelection?.kind==='keys'?timelineSelection.items:timelineSelection?.kind==='key'?[timelineSelection]:[];}
function setKeySelection(refs){const items=resolveKeyRefs(p.objects,refs).map(h=>h.ref);timelineSelection=items.length?{kind:'keys',items}:null;updateTimelineSelection();}
function installTimelineMarquee(){
 const host=$('#tracks');host.onpointerdown=e=>{
  if(e.button!==0||exporting||timelineGesture||e.target.closest('button,.track-label,.timeline-ruler')||!e.target.closest('.track-lane')&&e.target!==host)return;
  e.preventDefault();host.tabIndex=-1;host.focus({preventScroll:true});stop();const previous=clone(timelineSelection),base=e.shiftKey?selectedKeyRefs():[],r=host.getBoundingClientRect(),start={x:e.clientX-r.left+host.scrollLeft,y:e.clientY-r.top+host.scrollTop};
  const box=document.createElement('div');box.className='timeline-marquee';box.hidden=true;host.append(box);
  let dragged=false,closed=false,lastX=e.clientX,lastY=e.clientY,raf=0;
  const point=()=>{const r=host.getBoundingClientRect();return {x:clamp(lastX-r.left,0,r.width)+host.scrollLeft,y:clamp(lastY-r.top,0,r.height)+host.scrollTop}};
  const draw=()=>{
   const end=point(),b={left:Math.min(start.x,end.x),top:Math.min(start.y,end.y),right:Math.max(start.x,end.x),bottom:Math.max(start.y,end.y)};
   box.hidden=false;Object.assign(box.style,{left:b.left+'px',top:b.top+'px',width:(b.right-b.left)+'px',height:(b.bottom-b.top)+'px'});
   const r=host.getBoundingClientRect(),candidates=$$('#tracks .key').map(el=>{const ref=keyRefFromElement(el),o=p.objects.find(o=>o.id===ref?.objectId),q=el.getBoundingClientRect();return ref&&!o.locked?{ref,left:q.left-r.left+host.scrollLeft,right:q.right-r.left+host.scrollLeft,top:q.top-r.top+host.scrollTop,bottom:q.bottom-r.top+host.scrollTop}:null;}).filter(Boolean);
   setKeySelection([...base,...keysInBox(candidates,b)]);
  };
  const tick=()=>{if(closed)return;if(dragged){const r=host.getBoundingClientRect(),old=host.scrollTop;if(lastY<r.top+24)host.scrollTop-=9;else if(lastY>r.bottom-24)host.scrollTop+=9;if(host.scrollTop!==old)draw();}raf=requestAnimationFrame(tick)};
  const finish=cancelled=>{if(closed)return;closed=true;cancelAnimationFrame(raf);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);host.removeEventListener('lostpointercapture',cancel);if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);box.remove();document.body.classList.remove('timeline-box-selecting');timelineGesture=null;
   if(cancelled)timelineSelection=previous;
   else if(!dragged){if(!e.shiftKey)timelineSelection=null;const lane=e.target.closest('.track-lane');if(lane){const r=lane.getBoundingClientRect();setTime((e.clientX-r.left)/r.width*p.duration);}}
   updateTimelineSelection();
  };
  const cancel=()=>finish(true),up=ev=>{if(ev.pointerId===e.pointerId)finish(false)},move=ev=>{if(ev.pointerId!==e.pointerId)return;lastX=ev.clientX;lastY=ev.clientY;if(!dragged&&Math.hypot(lastX-e.clientX,lastY-e.clientY)<4)return;dragged=true;document.body.classList.add('timeline-box-selecting');draw()};
  timelineGesture={cancel};host.setPointerCapture(e.pointerId);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);host.addEventListener('lostpointercapture',cancel);raf=requestAnimationFrame(tick);
 };
}
function beginMultiKeyDrag(el,e,ref){
 const refs=clone(selectedKeyRefs()),initial=p.objects,initialTime=time,rect=el.closest('.track-lane').getBoundingClientRect();
 let draft=null,dragged=false,closed=false,error='';
 const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);el.removeEventListener('lostpointercapture',cancel);if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);document.body.classList.remove('timeline-dragging');timelineGesture=null;};
 const finish=cancelled=>{if(closed)return;closed=true;cleanup();p.objects=initial;
  if(!cancelled&&draft&&draft.delta){checkpoint();p.objects=draft.objects;timelineSelection={kind:'keys',items:draft.refs};stage?.updatePaths();commit();}
  else{timelineSelection={kind:'keys',items:refs};if(dragged)renderTracks();}
  setTime(cancelled?initialTime:time);updateTimelineSelection();if(!cancelled&&error)toast(error);
 };
 const cancel=()=>finish(true),up=ev=>{if(ev.pointerId===e.pointerId)finish(false)};
 const elements=$$('#tracks .key').map(el=>({el,ref:keyRefFromElement(el)})).filter(x=>x.ref&&refs.some(r=>keyRefId(r)===keyRefId(x.ref)));
 const move=ev=>{if(ev.pointerId!==e.pointerId)return;const dx=ev.clientX-e.clientX;if(!dragged&&Math.abs(dx)<3)return;dragged=true;document.body.classList.add('timeline-dragging');
  try{draft=moveTimelineKeys(initial,refs,dx/rect.width*p.duration,p.duration,p.fps);p.objects=draft.objects;timelineSelection={kind:'keys',items:draft.refs};for(const x of elements)x.el.style.left=(x.ref.t+draft.delta)/p.duration*100+'%';setTime(ref.t+draft.delta,false);error='';$('#timelineHelp').textContent=`移动 ${refs.length} 个关键帧 · ${draft.delta>=0?'+':''}${draft.delta.toFixed(2)}s · 松开保存 · Esc 取消`;}
  catch(err){error=err.message;$('#timelineHelp').textContent=error;}
 };
 timelineGesture={cancel};el.setPointerCapture(e.pointerId);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);el.addEventListener('lostpointercapture',cancel);
}
function installTimelineDrag(el){
 const isAction=!!el.dataset.actionId;
 el.onclick=e=>{e.preventDefault();e.stopPropagation()};
 el.ondblclick=e=>{e.preventDefault();e.stopPropagation();if(!isAction){const ref=keyRefFromElement(el);if(!ref)return;timelineSelection={kind:'key',...ref};updateTimelineSelection()}const hit=timelineItem();if(!hit)return;if(isAction&&hit.item.followPath){pathWalkModal(hit.o,hit.item);return}if(isAction)hit.o.type==='model'?modelClipModal(hit.o,hit.item.clip,hit.item):actionModal(hit.o.id,hit.item.id);else timelineSelection.parameter?parameterKeyModal(hit.o.id,timelineSelection.parameter,hit.index):keyModal(hit.o.id,hit.index);};
 el.onpointerdown=e=>{
  if(e.button!==0||exporting||timelineGesture)return;e.preventDefault();e.stopPropagation();el.focus({preventScroll:true});stop();
  if(!isAction){const ref=keyRefFromElement(el);if(!ref)return;
   const refs=selectedKeyRefs(),contains=refs.some(r=>keyRefId(r)===keyRefId(ref));
   if(e.shiftKey){if(p.objects.find(o=>o.id===ref.objectId)?.locked)return toast('对象已锁定');setKeySelection(contains?refs.filter(r=>keyRefId(r)!==keyRefId(ref)):[...refs,ref]);return;}
   if(timelineSelection?.kind==='keys'&&contains){beginMultiKeyDrag(el,e,ref);return;}
  }
  const objectId=el.dataset.obj||el.dataset.actionObject,o=p.objects.find(o=>o.id===objectId),parameter=el.dataset.parameter||null,index=+el.dataset.key;
  timelineSelection=isAction?{kind:'action',objectId,actionId:el.dataset.actionId}:{kind:'key',objectId,parameter,t:(parameter?o.channels[parameter]:o.keys)[index].t};
  selected=o.id;stage?.select(o.id);renderSidebar();updateTimelineSelection();
  const initial=clone(o),objectIndex=p.objects.indexOf(o),item=isAction?o.actions.find(a=>a.id===el.dataset.actionId):(parameter?o.channels[parameter]:o.keys)[index],initialTime=time;
  setTime(isAction?item.start:item.t);if(o.locked){toast('对象已锁定');return}
  const rect=el.closest('.track-lane').getBoundingClientRect(),x=e.clientX,edge=e.target.closest('[data-action-edge]')?.dataset.actionEdge||'move';
  let draft=null,dragged=false,error='',closed=false;
  const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);el.removeEventListener('lostpointercapture',cancel);document.body.classList.remove('timeline-dragging');timelineGesture=null;};
  const finish=cancelled=>{if(closed)return;closed=true;cleanup();p.objects[objectIndex]=o;
   if(cancelled){timelineSelection=isAction?{kind:'action',objectId,actionId:item.id}:{kind:'key',objectId,parameter,t:item.t};setTime(initialTime,false);}
   else if(draft&&JSON.stringify(draft)!==JSON.stringify(initial)){checkpoint();p.objects[objectIndex]=draft;}
   if(dragged){stage?.updatePaths();commit();}else updateTimelineSelection();renderProperties();
   if(!cancelled&&error)toast(error);
  };
  const cancel=()=>finish(true),up=ev=>{if(ev.pointerId===e.pointerId)finish(false)};
  const move=ev=>{if(ev.pointerId!==e.pointerId)return;const dx=ev.clientX-x;if(!dragged&&Math.abs(dx)<3)return;dragged=true;document.body.classList.add('timeline-dragging');const delta=dx/rect.width*p.duration;
   try{if(isAction){const next=actionTiming(initial,item.id,edge,delta,p.duration,p.fps);draft=clone(initial);draft.actions=draft.actions.map(a=>a.id===item.id?next:a).sort((a,b)=>a.start-b.start);el.style.left=next.start/p.duration*100+'%';el.style.width=(next.end-next.start)/p.duration*100+'%';el.querySelector('.action-caption').textContent=(next.mode==='hold'?'定格 · ':'')+(next.clip?clipLabel(next.clip):poses[next.pose])+' · '+(next.end-next.start).toFixed(2)+'s';setTime(edge==='end'?Math.max(next.start,next.end-1/p.fps):next.start,false);}
   else {const t=snapTime(item.t+delta,p.fps,p.duration);draft=moveTimelineKey(initial,parameter,index,t,p.duration,p.fps);timelineSelection.t=t;el.style.left=t/p.duration*100+'%';setTime(t,false);}
   p.objects[objectIndex]=draft;error='';$('#timelineHelp').textContent=isAction?'松开保存片段 · Esc 取消 · 与相邻片段自动避让':`关键帧 → ${timelineSelection.t.toFixed(2)}s · 松开保存，Esc 取消`;
   }catch(err){error=err.message;$('#timelineHelp').textContent=error;}
  };
  timelineGesture={cancel};el.setPointerCapture(e.pointerId);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);el.addEventListener('lostpointercapture',cancel);
 };
}

function revealPlayhead(){const host=$('#tracks'),head=$('.timeline-playhead');if(!head)return;const x=parseFloat(head.style.left);if(x<host.scrollLeft+145)host.scrollLeft=Math.max(0,x-145);else if(x>host.scrollLeft+host.clientWidth-30)host.scrollLeft=x-host.clientWidth+30;}
function updatePlayhead(){parameterButtonState();const ruler=$('.timeline-ruler'),head=$('.timeline-playhead'),cursor=$('.timeline-cursor');if(ruler&&head){head.style.left=(ruler.offsetLeft+time/p.duration*ruler.offsetWidth)+'px';const rows=$$('#tracks .track'),bottom=rows.at(-1);head.style.height=Math.max(32,bottom?bottom.offsetTop+bottom.offsetHeight:32)+'px';cursor.style.left=(time/p.duration*100)+'%';cursor.setAttribute('aria-valuetext',frameTimecode(time,p.fps));}$$('[data-key-jump]').forEach(el=>{const o=p.objects.find(o=>o.id===el.dataset.keyJump);el.disabled=!o||adjacentKeyTime(o,time,+el.dataset.direction)===null;});$$('[data-param-state]').forEach(el=>{const [oid,pid]=el.dataset.paramState.split(':');const o=p.objects.find(o=>o.id===oid);const hit=o?.channels?.[pid]?.some(k=>Math.abs(k.t-time)<.0001);el.textContent=hit?'◆':'◇';el.classList.toggle('keyed',!!hit);el.title=hit?'当前帧已有此参数关键帧':'当前帧没有此参数关键帧';});$$('[data-param-nav]').forEach(el=>{const o=p.objects.find(o=>o.id===el.dataset.paramNav);el.disabled=!o||adjacentParameterKeyTime(o,el.dataset.parameter,time,+el.dataset.direction)===null;});$('#timecode').textContent=frameTimecode(time,p.fps);const o=override?p.objects.find(o=>o.id===override):activeCamera(p,time);$('#previewName').textContent=(o?.name||'未设置机位')+'　·　'+(o?.aspect||'16:9');if($('#keyProperty'))$('#keyProperty').textContent=`◇ 记录当前帧 · ${time.toFixed(2)}s`;}
let modalReturnFocus=null,modalBackground=[];
function restoreModalBackground(){for(const [element,inert] of modalBackground)if(element.isConnected)element.inert=inert;modalBackground=[];}
function modal(title,subtitle,body,actions='',options={}){
 $$('#modalRoot video,#modalRoot audio').forEach(m=>m.pause());boardGesture?.cancel();if(!$('.modal'))modalReturnFocus=document.activeElement;
 restoreModalBackground();stop();endSpaceHand();stage?.orbit.clear();
 const heading=`<header class="modal-heading row between"><h2>${esc(title)}</h2><button id="closeModal" class="ghost" aria-label="关闭">${uiIcon('close')}</button></header>`,content=`${subtitle?`<p class="subtitle">${subtitle}</p>`:''}${body}`;
 $('#modalRoot').innerHTML=`<div class="modal-backdrop ${options.nodeId?'node-tool-backdrop':''}"><section class="modal ${options.nodeId?'node-tool-panel':'standard-dialog'}" ${options.nodeId?`data-node-id="${esc(options.nodeId)}"`:''} role="dialog" ${options.nodeId?'':'aria-modal="true"'} aria-label="${esc(title)}">${heading}${options.nodeId?content:`<div class="modal-scroll">${content}</div>`}${actions?`<footer class="modal-actions">${actions}</footer>`:''}</section></div>`;
 if(!options.nodeId){$('#nodeActionBar').hidden=true;for(const element of [$('.app'),$('#projectManager')].filter(Boolean)){modalBackground.push([element,element.inert]);element.inert=true;}}
 $('#closeModal').onclick=closeModal;if(options.nodeId)refreshNodeOverlays();$('.modal-backdrop').onclick=e=>{if(e.target.classList.contains('modal-backdrop')&&!exporting)closeModal();};
 queueMicrotask(()=>{if(document.activeElement?.closest('.modal'))return;if(options.nodeId)nodeAnchor(options.nodeId)?.focus({preventScroll:true});else $('.modal button, .modal input')?.focus({preventScroll:true});});
}
function closeModal({restoreFocus=true}={}){if(exporting)return;$$('#modalRoot video,#modalRoot audio').forEach(m=>m.pause());$('#modalRoot').innerHTML='';restoreModalBackground();if(restoreFocus&&modalReturnFocus?.isConnected)modalReturnFocus.focus({preventScroll:true});modalReturnFocus=null;renderNodeActionBar();}
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&$('.modal')&&!exporting){e.preventDefault();e.stopImmediatePropagation();closeModal();return;}
 const dialog=$('.modal[aria-modal="true"]');if(e.key!=='Tab'||!dialog)return;
 const focusables=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[hidden]'));
 if(!focusables.length)return;const first=focusables[0],last=focusables.at(-1);
 if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){e.preventDefault();first.focus();}
});
function asset(type,extra={}){const b=$('#board'),z=p.board.zoom,origin={x:(b.clientWidth/2-p.board.x)/z-140,y:(b.clientHeight/2-p.board.y)/z-100,w:extra.w||280,h:260};const position=Number.isFinite(extra.x)&&Number.isFinite(extra.y)?{}:freeNodePosition(p.nodes,origin,n=>nodeHeights.get(n.id)||n.h||260);return {id:uid(),type,title:labels[type],text:'',x:origin.x,y:origin.y,w:origin.w,...position,...extra}}
function addAsset(type){
 if(p.nodes.length>=500)return toast('画布节点已达上限，请先移除不需要的节点');
 checkpoint();const n=asset(type,{title:({text:'新文本',actor:'新角色设定',scene:'新场景设定',image:'新图片',video:'新视频',audio:'新音频',director:'3D 导演台'})[type]||labels[type]});
 if(type==='director')n.text='此节点打开当前工程共享的 3D 场景。';
 p.nodes.push(n);filter='all';closeModal();setMode('board');commit();select(n.id);
}
function addAssetModal(){
 const r=$('#quickAdd').getBoundingClientRect();
 showContextMenu($('#contextMenu'),{x:r.left,y:r.bottom+7,title:'新建节点',items:[
  {label:'导入剧本参考',run:scriptReferenceModal},
  ...[['text','文本'],['image','图片'],['video','视频'],['audio','音频'],['actor','角色设定'],['scene','场景设定'],['director','3D 导演台']].map(([type,label])=>({label,run:()=>addAsset(type)})),
  {label:'导入 3D 模型',run:()=>$('#modelFile').click()},
  {label:'从流程模板开始',run:canvasTemplatesModal}
 ]});
}
$('#workflowTemplates').onclick=()=>canvasTemplatesModal();
function addCamera(){if(p.objects.length>=300)return toast('场景对象已达 300 个');stop();checkpoint();const names=new Set(p.objects.map(o=>o.name));let index=1;while(names.has('摄影机 '+index))index++;const o=object('camera','摄影机 '+index,[5,3,6],'#e4b575');p.objects.push(o);commit(true);select(o.id);toast('已添加摄像机，可在右侧调整机位、注视点与画幅');}

function deleteSelected(){if(mode==='stage'){const o=p.objects.find(o=>o.id===selected);if(!o)return;if(o.locked){toast('对象已锁定');return}if(o.type==='camera'&&p.objects.filter(o=>o.type==='camera').length===1){toast('至少保留一个摄影机');return}checkpoint();p.objects=p.objects.filter(v=>v.id!==o.id);p.shots=p.shots.filter(s=>s.cameraId!==o.id);p.nodes.filter(n=>n.objectId===o.id).forEach(n=>delete n.objectId);selected=null;commit(true)}else{deleteBoardSelection()}}
function keyModal(id,index){const o=p.objects.find(o=>o.id===id);if(o.locked){toast('对象已锁定');return}const k=o.keys[index];modal('编辑关键帧',esc(o.name)+' · 修改时间、插值方式，或删除此关键帧。',`<label class="field">时间 / 秒<input id="keyTimeEdit" type="number" step="${1/p.fps}" min="0" max="${p.duration}" value="${k.t}"></label><label class="field">到下一关键帧的过渡<select id="keyEaseEdit"><option value="smooth">平滑进出</option><option value="linear">匀速</option><option value="hold">保持</option></select></label>`,`<button class="danger" id="removeKey">删除关键帧</button><button class="primary" id="saveKey">保存</button>`);$('#keyEaseEdit').value=k.ease;$('#removeKey').onclick=()=>{const next=deleteTimelineKey(o,null,index,time);checkpoint();p.objects[p.objects.indexOf(o)]=next;timelineSelection=null;closeModal();commit(true);renderProperties()};$('#saveKey').onclick=()=>{let next;try{const t=+$('#keyTimeEdit').value;if(!Number.isFinite(t)||t<0||t>p.duration)throw Error('请输入有效时间');next=moveTimelineKey(o,null,index,t,p.duration,p.fps);next.keys.find(k=>Math.abs(k.t-snapTime(t,p.fps,p.duration))<.0001).ease=$('#keyEaseEdit').value;}catch(e){return toast(e.message)}const t=snapTime(+$('#keyTimeEdit').value,p.fps,p.duration);checkpoint();p.objects[p.objects.indexOf(o)]=next;timelineSelection=null;closeModal();commit(true);setTime(t)}}

function shotsModal(){let draft=clone(p.shots);const cameras=p.objects.filter(o=>o.type==='camera');
 const draw=()=>{modal('镜头编排','按时间切换摄影机。区间不能重叠；空白区间会使用第一个机位。',`<div class="shot-row muted"><span>摄影机</span><span>开始 / s</span><span>结束 / s</span><span></span></div><div id="shotRows">${draft.map((s,i)=>`<div class="shot-row" data-row="${i}"><select class="shotCam">${cameras.map(c=>`<option value="${c.id}" ${s.cameraId===c.id?'selected':''}>${esc(clipLabel(c.name))}</option>`).join('')}</select><input class="shotStart" type="number" min="0" max="${p.duration}" step=".1" value="${s.start}" aria-label="镜头 ${i+1} 开始"><input class="shotEnd" type="number" min="0" max="${p.duration}" step=".1" value="${s.end}" aria-label="镜头 ${i+1} 结束"><button class="removeShot ghost" aria-label="删除镜头 ${i+1}">×</button></div>`).join('')}</div><button id="newShot" style="margin-top:16px">＋ 添加镜头区间</button>`,`<button id="cancelShots">取消</button><button class="primary" id="saveShots">保存编排</button>`);
 const read=()=>{$$('[data-row]').forEach(e=>{const s=draft[+e.dataset.row];s.cameraId=e.querySelector('select').value;s.start=+e.querySelector('.shotStart').value;s.end=+e.querySelector('.shotEnd').value})};$$('.removeShot').forEach(e=>e.onclick=()=>{read();draft.splice(+e.closest('[data-row]').dataset.row,1);draw()});$('#newShot').onclick=()=>{read();const start=draft.length?Math.max(...draft.map(s=>s.end)):0;if(start>=p.duration){toast('片段已到工程末尾，可先缩短已有片段或增加工程时长');return}draft.push({id:uid(),cameraId:cameras[0].id,start,end:Math.min(p.duration,start+3)});draw()};$('#cancelShots').onclick=closeModal;$('#saveShots').onclick=()=>{read();try{validateProject({...p,shots:draft})}catch(e){toast(e.message);return}checkpoint();p.shots=draft.sort((a,b)=>a.start-b.start);closeModal();commit()};};draw();}
function presetObjects(type,id){const list=p.objects.filter(o=>o.type===type&&!o.locked),o=list.find(o=>o.id===(id||selected))||list[0];if(!o){toast(type==='actor'?'请先添加角色':'请先添加摄影机');return null}return {list,o}}
function rangeFields(start,end){return `<div class="row"><label class="field grow">开始 / 秒<input id="presetStart" type="number" min="0" max="${p.duration}" step="0.1" value="${start}"></label><label class="field grow">结束 / 秒<input id="presetEnd" type="number" min="0" max="${p.duration}" step="0.1" value="${end}"></label></div>`}
function actionModal(id,clipId){
 const found=presetObjects('actor',id);if(!found)return;const {list,o}=found,clip=(o.actions||[]).find(a=>a.id===clipId);
 const start=clip?.start??Math.min(time,Math.max(0,p.duration-3)),end=clip?.end??Math.min(p.duration,start+3);
 modal(clip?'编辑动作片段':'添加角色动作','动作控制肢体表演；人物移动由位置关键帧控制。拖动绿色片段两端调整时长，中间移动；双击打开详细设置。',`<label class="field">角色<select id="presetObject" ${clip?'disabled':''}>${list.map(a=>`<option value="${a.id}" ${a.id===o.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label><label class="field">基础动作<select id="actionPose">${Object.entries(poses).map(([key,name])=>`<option value="${key}" ${key===(clip?.pose||'walk')?'selected':''}>${name}</option>`).join('')}</select></label>${rangeFields(start,end)}<label class="field">播放速度<input id="actionSpeed" type="number" min=".1" max="4" step=".1" value="${clip?.speed||1}"></label><p class="help-text">同一角色的动作片段不能重叠。片段结束后恢复原姿态；坐姿需自行调整角色高度以匹配座椅。</p>`,`${clip?'<button id="removeAction" class="danger">删除片段</button>':''}<button id="saveAction" class="primary">${clip?'保存修改':'添加到时间轴'}</button>`);
 if(clip)$('#removeAction').onclick=()=>{checkpoint();o.actions=o.actions.filter(a=>a.id!==clip.id);closeModal();commit();select(o.id)};
 $('#saveAction').onclick=()=>{
  const target=p.objects.find(o=>o.id===$('#presetObject').value),a={id:clip?.id||uid(),pose:$('#actionPose').value,start:Math.round(+$('#presetStart').value*p.fps)/p.fps,end:Math.round(+$('#presetEnd').value*p.fps)/p.fps,speed:+$('#actionSpeed').value};
  try{actionRange(target,a,p.duration);if(!Number.isFinite(a.speed)||a.speed<.1||a.speed>4)throw new Error('播放速度须在 0.1–4 倍之间');if((target.actions||[]).length>=500&&!clip)throw new Error('动作片段已达 500 个');}
  catch(e){toast(e.message);return}
  checkpoint();target.actions=(target.actions||[]).filter(v=>v.id!==a.id).concat(a).sort((a,b)=>a.start-b.start);closeModal();select(target.id);timelineSelection={kind:'action',objectId:target.id,actionId:a.id};commit();setTime(a.start);revealTimelineSelection();toast('动作已加入时间轴，可拖动两端调整时长');
 };
}
function motionModal(id){
 const found=presetObjects('camera',id);if(!found)return;const {list,o}=found,start=Math.min(time,Math.max(0,p.duration-3)),end=Math.min(p.duration,start+3);
 modal('基础运镜预设','从开始时刻的机位状态生成可编辑关键帧。可先调整红点，确定注视中心。',`<label class="field">摄影机<select id="presetObject">${list.map(a=>`<option value="${a.id}" ${a.id===o.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label><label class="field">运镜方式<select id="motionKind">${Object.entries(motions).map(([key,m])=>`<option value="${key}">${m.name}</option>`).join('')}</select></label>${rangeFields(start,end)}<label class="field"><span id="amountLabel">幅度 / 米</span><input id="motionAmount" type="number" min=".1" max="100" step=".1" value="2"></label><label class="field">速度变化<select id="motionEase"><option value="smooth">平滑起落</option><option value="linear">匀速</option></select></label><p class="preset-help" id="motionDescription">推进：沿镜头方向靠近注视点，注视点保持不动。</p><p class="help-text">应用后替换所选区间内该机位的关键帧，保留区间外的关键帧；结束后平滑过渡至后续关键帧，或保持最终机位。可整体撤销。运镜不会自动更改「镜头编排」，导出前请确认此机位在相应时间生效。</p>`,`<button id="saveMotion" class="primary">生成运镜关键帧</button>`);
 const describe={push:'推进：沿镜头方向靠近注视点，注视点保持不动。',pull:'拉远：沿镜头方向远离注视点，注视点保持不动。',truckLeft:'左移：机位与注视点同步向镜头左侧平移。',truckRight:'右移：机位与注视点同步向镜头右侧平移。',rise:'升镜头：机位和注视点同步升高，保持拍摄方向。',fall:'降镜头：机位和注视点同步降低，保持拍摄方向。',orbitLeft:'左环绕：围绕红色注视点作水平圆弧运动。',orbitRight:'右环绕：围绕红色注视点作水平圆弧运动。',panLeft:'左摇：机位保持原位，视线向左转动。',panRight:'右摇：机位保持原位，视线向右转动。',zoomIn:'变焦拉近：机位和注视点不动，缩小 FOV。',zoomOut:'变焦拉远：机位和注视点不动，扩大 FOV。'};
 $('#motionKind').onchange=()=>{const kind=$('#motionKind').value,m=motions[kind];$('#amountLabel').textContent='幅度 / '+m.unit;$('#motionAmount').value=m.value;$('#motionAmount').max=m.unit==='度'?360:100;$('#motionDescription').textContent=describe[kind]};
 $('#saveMotion').onclick=()=>{
  const target=p.objects.find(o=>o.id===$('#presetObject').value),start=Math.round(+$('#presetStart').value*p.fps)/p.fps,end=Math.round(+$('#presetEnd').value*p.fps)/p.fps;
  let draft;try{draft=motionDraft(target,$('#motionKind').value,start,end,+$('#motionAmount').value,p.duration,p.fps,$('#motionEase').value)}catch(e){toast(e.message);return}
  checkpoint();target.keys=draft.keys;if(draft.channels)target.channels=draft.channels;override=target.id;closeModal();stage.updatePaths();commit();select(target.id);setTime(start);toast('运镜已写入关键帧，右侧已切到此机位监看');
 };
}

function mediaFileName(n){const mime=n.src?.match(/^data:([^;]+)/)?.[1];const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','audio/mpeg':'mp3','audio/mp3':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/mp4':'m4a','audio/webm':'webm'}[mime]||'bin';return n.title.replace(/\.(png|jpe?g|webp|gif|mp4|webm|mp3|wav|ogg|m4a)$/i,'')+'.'+ext;}
function download(src,name){const a=document.createElement('a');a.href=typeof src==='string'?src:URL.createObjectURL(src);a.download=name.replace(/[\\/:*?"<>|]/g,'_');a.click();if(typeof src!=='string')setTimeout(()=>URL.revokeObjectURL(a.href),30000)}
// v1.3.0 工程备份：剪辑媒体存 IndexedDB，工程 JSON 只有 assetId 引用。
// 导出时把引用到的媒体一并打包为「带媒体备份」（独立 schema 标记），不静默丢失；
// 旧版纯工程 JSON 仍可正常导入（缺失媒体在剪辑页显示为「素材缺失」）。
async function exportProjectFile(project){
 if(!project)return;
 try{
  const {backup,mediaBytes,missingCount,large}=await buildWorkstationBackup(project,wsShell?.mediaStore);
  if(backup.media.length||projectMediaReferences(backup.project).size){
   if(large)toast(`备份包含约 ${(mediaBytes/1024/1024).toFixed(0)} MB 媒体，文件较大，导出可能需要一些时间`);
   if(missingCount)toast(`有 ${missingCount} 个媒体引用在本地媒体库中缺失，备份将不含其内容`);
   download(new Blob([JSON.stringify(backup)],{type:'application/json'}),project.name+'.workstation.json');
   toast('已发起「带媒体备份」导出（工程 + 资产图片 + 剪辑媒体），请确认文件已保存');
   return;
  }
 }catch(e){toast('媒体备份未完成：'+e.message+'。请整理素材后重试');return;}
 download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),project.name+'.directorcanvas.json');
 toast('已发起工程导出，请确认文件已保存');
}
function settingsPage(section,subtitle,body){
 modal(t('settings.title'),subtitle,`<nav class="settings-tabs" aria-label="设置分类">${[['general',t('settings.general')],['api','API'],['storage',t('settings.storage')]].map(([id,name])=>`<button type="button" data-settings-section="${id}" class="${id===section?'active':''}" aria-pressed="${id===section}">${name}</button>`).join('')}</nav><div class="settings-content">${body}</div>`);
 $$('[data-settings-section]').forEach(el=>el.onclick=()=>{if(el.dataset.settingsSection===section)return;({general:settingsModal,api:aiModal,storage:storageSettingsModal})[el.dataset.settingsSection]()});
}
function settingsModal(){
 settingsPage('general','保存与界面偏好，保存在这台电脑上。',`<section class="settings-section"><h3>${t('onboarding.title')}</h3><p class="help-text">${t('onboarding.welcomeSubtitle')}</p><button id="settingsOnboarding">${t('onboarding.start')}</button></section><section class="settings-section"><h3 data-i18n="settings.language">界面语言</h3><p class="help-text" data-i18n="settings.languageHint">默认英文，可随时切换中文。</p><div class="row" style="gap:8px;flex-wrap:wrap"><button data-locale="en-US">English</button><button data-locale="zh-CN">中文</button></div></section><section class="settings-section"><h3 data-i18n="settings.save">保存</h3><label class="field">自动保存<select id="settingsSaveDelay"><option value="350">即时保存（默认）</option><option value="5000">停止编辑 5 秒后保存</option><option value="15000">停止编辑 15 秒后保存</option><option value="30000">停止编辑 30 秒后保存</option><option value="manual">手动保存</option></select></label><p class="help-text" id="settingsSaveNote"></p><button id="settingsBackup">导出当前工程备份</button></section><section class="settings-section"><h3 data-i18n="settings.interface">界面</h3><div class="settings-row"><span>布局预设<small>构图、动画、预演只是面板尺寸组合；也可在工具栏「◱ 布局」切换。</small></span><span class="row settings-layout-row"><button data-layout-preset="compose">构图</button><button data-layout-preset="animate">动画</button><button data-layout-preset="preview">预演</button><button id="settingsCustomLayout">我的布局</button></span></div><div class="settings-row"><span>面板布局<small>恢复左右侧栏、时间轴和机位监看默认大小；收起的面板从工具栏「◱ 布局」或浮出按钮恢复。</small></span><button id="settingsResetLayout">恢复默认布局</button></div></section><section class="settings-section"><h3 data-i18n="settings.help">使用帮助</h3><div class="settings-row"><span>快捷键与操作说明</span><button id="settingsHelp">查看指南</button></div></section>`);
 const note=()=>{$('#settingsSaveNote').textContent=saveDelay===null?`手动模式：点击「保存」或按 ${K}+S。返回项目库时仍会保存。`:'编辑停止后按所选间隔自动保存；底部可查看保存状态。';};$('#settingsSaveDelay').value=saveDelay===null?'manual':String(saveDelay);note();
 $('#settingsSaveDelay').onchange=e=>{saveDelay=e.target.value==='manual'?null:+e.target.value;try{localStorage.setItem(SAVE_PREF,JSON.stringify(saveDelay));}catch{}projectSaver.setDelay(saveDelay);updateSaveMode();if(projectSaver.pending)saveStatus('pending');note();};
 $('#settingsBackup').onclick=()=>exportProjectFile(p);$('#settingsResetLayout').onclick=()=>{panelLayout.reset();toast('面板布局已恢复默认')};
 $$('[data-layout-preset]').forEach(b=>b.onclick=()=>{panelLayout.applyPreset(b.dataset.layoutPreset);toast('已应用布局预设')});
 $('#settingsCustomLayout').onclick=()=>{if(panelLayout.hasCustom()){panelLayout.applyCustom();toast('已应用「我的布局」')}else{panelLayout.saveCustom();toast('已保存当前布局为「我的布局」')}};
 $('#settingsHelp').onclick=helpModal;
 $('#settingsOnboarding').onclick=()=>{closeModal();openOnboarding({modal,closeModal,api,toast});};
 $$('[data-locale]').forEach(button=>{
  if(button.dataset.locale===getLocale())button.classList.add('active');
  button.onclick=async()=>{setLocale(button.dataset.locale);try{await projectSaver.flush()}catch{}location.reload()};
 });
}
async function storageSettingsModal(){
 settingsPage('storage','先保存作品，再管理本机存储。',`<section class="settings-section"><h3>保存位置</h3><p class="settings-value">保存在这台电脑的项目库</p><p class="help-text">项目和导入素材由本机应用或当前浏览器保存。保存不会自动创建独立备份。</p><p id="storageUsage" class="help-text" role="status">正在读取存储用量…</p></section><section class="settings-section"><h3>备份与恢复</h3><p class="help-text">备份包含画布、导演台、动画、分镜、资产图片和剪辑媒体；不包含 API 密钥，也不包含外部路径文件的实体。缺失素材会在导出时提示。</p><div class="row"><button id="storageBackup" class="primary">导出当前工程备份</button><button id="storageRestore">从备份恢复…</button></div><p class="help-text">恢复会添加独立项目，不覆盖已有作品。导出文件的保存位置在下载时选择。</p></section><details class="storage-advanced"><summary>存储详情与保护</summary><section class="settings-section"><h3>项目数据库</h3><p class="help-text">当前站点：<span id="settingsOrigin"></span><br>本地数据库：jingchang-studio（IndexedDB）。物理目录由应用或浏览器管理。</p><p id="storagePersistence" class="help-text"></p><button id="requestPersistentStorage">申请持久存储</button></section><section class="settings-section"><h3>生成素材与任务目录</h3><div id="serverStorageInfo"><p class="help-text">正在读取本地服务目录…</p></div></section></details>`);
 $('#settingsOrigin').textContent=location.origin;$('#storageBackup').onclick=()=>exportProjectFile(p);$('#storageRestore').onclick=async()=>{closeModal();await goProjects();if(managerOpen)$('#projectFile').click();};
 const usage=$('#storageUsage'),status=$('#storagePersistence'),button=$('#requestPersistentStorage'),paths=$('#serverStorageInfo');
 const bytes=n=>Number.isFinite(n)?(n/1024/1024).toFixed(1)+' MB':'不可用';
 const showPersistent=async()=>{try{const enabled=await navigator.storage?.persisted?.();if(!status.isConnected)return;status.textContent=enabled?'已获浏览器持久存储许可；仍建议定期备份。':'持久存储尚未获许可；能否授予由浏览器决定。';button.disabled=!!enabled||!navigator.storage?.persist;}catch{if(status.isConnected)status.textContent='当前浏览器无法读取持久存储状态。';}};
 button.onclick=async()=>{button.disabled=true;try{const granted=await navigator.storage.persist();if(!status.isConnected)return;status.textContent=granted?'已获持久存储许可；仍建议定期备份。':'浏览器未授予持久存储许可，请保留工程备份。';button.disabled=granted;}catch{if(status.isConnected){status.textContent='申请失败，请使用工程备份。';button.disabled=false;}}};
 const readUsage=async()=>{try{const info=await navigator.storage?.estimate?.();if(usage.isConnected)usage.textContent=info?`本站已用约 ${bytes(info.usage)} / 可用配额约 ${bytes(info.quota)}（包含项目，不仅是缓存）`:'此浏览器不支持用量统计。';}catch{if(usage.isConnected)usage.textContent='存储用量暂不可用。';}};
 const readPaths=async()=>{try{
  const response=await fetch('/api/ai/storage');if(!response.ok)throw Error('unavailable');const info=await response.json();if(!paths.isConnected)return;
  if(typeof info.dataDirectory!=='string')throw Error('unavailable');
  paths.innerHTML=[['数据根目录',info.dataDirectory],['生成图片',info.imagesDirectory],['生成模型与任务记录',info.modelsDirectory],['离线资产（程序随附）',info.assetsDirectory]].filter(([,value])=>typeof value==='string').map(([name,value])=>`<label class="field">${name}<input class="storage-path" type="text" readonly value="${esc(value)}" aria-label="${name}"></label>`).join('')+`<p class="help-text">可选中路径复制。生成素材和任务记录用于恢复任务，不提供一键清空。</p><details class="storage-advanced"><summary>更改生成素材目录</summary><p class="help-text">网页版暂不支持在线选择或迁移目录。退出服务后，可通过启动环境变量 <code>JINGCHANG_DATA_DIR</code> 指定绝对路径，再重启服务；迁移时应先完整复制旧目录内容，保留原目录备份。此设置不改变浏览器项目库或离线资产位置。</p></details>`;
 }catch{if(paths.isConnected)paths.innerHTML='<p class="help-text">当前本地服务尚未提供目录信息。保存工程后重新启动本地服务，再打开本页查看。服务重启后需要重新填写仅存在内存中的 API 密钥。</p>';}};
 await Promise.allSettled([readUsage(),showPersistent(),readPaths()]);
}
function projectModal(){modal('工程与保存','保存到本机；导出工程可作为独立备份。',`<div class="modal-grid"><button class="add-tile" id="offlineTaskPack"><b>导出创作参考包</b><span>离线提示词与镜头参考，供外部工具使用。</span></button><button class="add-tile" id="saveProjectNow"><b>保存到本机</b><span>${K}+S</span></button><button class="add-tile" id="saveProjectFile"><b>↓ 导出工程备份</b><span>场景、动画、画布与导入素材。</span></button><button class="add-tile" id="returnProjects"><b>▦ 项目管理</b><span>保存并返回项目列表。</span></button><button class="add-tile" id="projectSaveSettings"><b>保存设置</b><span>自动保存间隔与存储信息。</span></button></div>`);$('#offlineTaskPack').onclick=aiTaskModal;$('#saveProjectNow').onclick=saveNow;$('#saveProjectFile').onclick=()=>exportProjectFile(p);$('#returnProjects').onclick=goProjects;$('#projectSaveSettings').onclick=settingsModal;}

function applyDuration(duration,scale){try{const next=resizeProjectDuration(p,duration,scale);stop();const ratio=duration/p.duration;checkpoint();p=next;time=Math.min(duration,scale?time*ratio:time);timelineSelection=null;stage?.select(selected);commit(true);setTime(time);toast(`时间轴已调整为 ${duration} 秒 · ${K}+Z 可撤销`);return true;}catch(e){toast(e.message);return false;}}
function durationModal(initial=p.duration){
 stop();modal('调整时间轴时长','支持 1 秒至 60 分钟，可随时撤销。',`<label class="field">总时长 / 秒<input id="durationEdit" type="number" min="1" max="3600" step="0.1" value="${initial}"></label><label class="field">调整方式<select id="durationStrategy"><option value="end">仅增减尾部空白</option><option value="scale">按比例缩放全部时间</option></select></label><p class="preset-help" id="durationHint"></p>`,`<button id="cancelDuration">取消</button><button id="applyDuration" class="primary">应用时长</button>`);
 const choose=()=>{$('#durationStrategy').value=+$('#durationEdit').value<contentEnd(p)?'scale':'end';hint();},hint=()=>{$('#durationHint').textContent=$('#durationStrategy').value==='scale'?'关键帧、贝塞尔节点、动作片段与镜头区间同步缩放，不删除内容；动作自身的播放速度保持不变。':`保留现有动画时间。已有内容到 ${contentEnd(p).toFixed(2)} 秒，缩短至此之前需选择按比例缩放。`;};$('#durationEdit').oninput=choose;$('#durationEdit').onchange=choose;$('#durationStrategy').onchange=hint;choose();$('#cancelDuration').onclick=closeModal;$('#applyDuration').onclick=()=>{if(applyDuration(+$('#durationEdit').value,$('#durationStrategy').value==='scale'))closeModal();};
}



function referencePackModal(){
 if(exporting||localWork)return toast('请等待当前操作完成');
 let refs;try{refs=shotReferencePlan(p)}catch(e){return toast(e.message)}
 modal(t('reference.refTitle'),t('reference.refSubtitle'),`<p class="help-text">${t('reference.refCount',{shots:refs.length,frames:refs.length*2})}</p><label class="field"><span><input type="checkbox" id="referenceDepth"> ${t('reference.refDepth')}</span></label><p class="help-text" id="referenceProgress">${t('reference.refProgress')}</p>`,`<button id="referenceCancel">${t('reference.cancel')}</button><button class="primary" id="referenceStart">${t('reference.exportZip')}</button>`);
 const controller=new AbortController();$('#referenceCancel').onclick=()=>{if(!exporting){closeModal();return;}controller.abort();$('#referenceCancel').disabled=true;$('#referenceCancel').textContent=t('reference.cancelling')};
 $('#referenceStart').onclick=async()=>{const project=p,originalTime=time,depth=$('#referenceDepth').checked,progress=$('#referenceProgress');stop();$('#referenceStart').disabled=true;exporting=true;
 try{await withLocalWork(async()=>{await stage.readyAssets();const entries=[],manifest=referenceManifest(project,refs,depth);for(let i=0;i<refs.length;i++){if(controller.signal.aborted||p!==project)throw new DOMException('已取消','AbortError');const ref=refs[i];for(const [kind,t] of [['start',ref.firstTime],['end',ref.lastTime]]){const add=(name,data)=>entries.push({name,data:Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0))});add(`${ref.fileStem}-${kind}.png`,stage.screenshot(t,ref.cameraId));if(depth)add(`${ref.fileStem}-${kind}-depth.png`,stage.depthShot(t,ref.cameraId));}progress.textContent=`正在输出 ${i+1}/${refs.length}：${ref.name}`;await new Promise(resolve=>requestAnimationFrame(resolve));}if(controller.signal.aborted)throw new DOMException('已取消','AbortError');entries.push({name:'manifest.json',data:JSON.stringify(manifest,null,2)});entries.push({name:'shots.csv',data:'shot,camera,start,end,firstFrame,lastFrame\n'+refs.map(r=>[r.number,r.cameraName,r.start,r.end,r.firstTime,r.lastTime].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')});download(new Blob([zipFiles(entries)],{type:'application/zip'}),project.name+'-镜头参考包.zip');});exporting=false;closeModal();toast(t('reference.refDownloaded'));}
 catch(e){if(e.name!=='AbortError')toast(e.message);if($('#referenceStart'))$('#referenceStart').disabled=false;}
 finally{exporting=false;if(controller.signal.aborted)closeModal();setTime(originalTime);stage?.render(time,override,0);}
 };
}

function aiTaskModal(){modal('AI 参考任务包','导出提示词、镜头和素材关系，用于外部创作或交接；不会自动提交生成。',`<span class="badge">离线参考清单</span><label class="field">目标模型名称（选填）<input id="aiModel" placeholder="例如：计划使用的视频模型" value="${esc(p.ai.model)}"></label><label class="field">生成意图与参考规则<textarea rows="6" id="aiPrompt">${esc(p.ai.prompt)}</textarea></label><p class="help-text">任务包包含工程、镜头时间表及画布引用关系。三维工程与渲染视频不同；需要控制运动时，请将预演视频作为生成参考。API 密钥请仅保存在本机模型设置中，不要写进工程内容。</p>`,`<button id="exportReferencePack">按镜头参考包</button><button id="exportTask">导出 AI 任务包</button><button class="primary" id="saveAI">保存设定</button>`);$('#exportReferencePack').onclick=()=>{closeModal();referencePackModal()};const save=()=>{checkpoint();p.ai.model=$('#aiModel').value;p.ai.prompt=$('#aiPrompt').value;persist()};$('#saveAI').onclick=()=>{save();closeModal();toast('生成设定已保存')};$('#exportTask').onclick=()=>{save();const task={schema:'jingchang-ai-task/1',kind:'reference-to-video',provider:null,model:p.ai.model||null,prompt:p.ai.prompt,video:{duration:p.duration,fps:p.fps,width:1280,height:720,referenceFile:p.name+'.webm'},shots:p.shots.map(s=>({...s,camera:p.objects.find(o=>o.id===s.cameraId)})),assets:p.nodes,connections:p.edges,project:p};download(new Blob([JSON.stringify(task,null,2)],{type:'application/json'}),p.name+'.ai-task.json');toast('任务包已导出，尚未调用 AI')};}

function aiModal(){
 settingsPage('api',t('settings.apiSubtitle'),`<section class="settings-section"><h3>${t('settings.seedreamTitle')}</h3><p class="help-text">${t('settings.seedreamHelp')}</p><p class="help-text" id="seedreamStatus">正在读取配置…</p><label class="field">接入方式<select id="seedreamMode"><option value="agent-plan">Agent Plan（套餐内额度）</option><option value="ark">方舟按量（需余额）</option></select></label><label class="field">API Key<input id="seedreamKey" type="password" autocomplete="off" placeholder="已配置时留空保留"></label><label class="field">默认模型<input id="seedreamModel" autocomplete="off" placeholder="doubao-seedream-5.0-flash"></label><div class="row" style="flex-wrap:wrap;gap:8px"><button id="seedreamSave">保存</button><button id="seedreamTest">测试模型列表</button><button id="seedreamClear">清除密钥</button></div><p class="help-text" id="seedreamMessage"></p></section><section class="settings-section"><h3>${t('settings.comfyTitle')}</h3><p class="help-text">${t('settings.comfyHelp')}</p><p class="help-text" id="comfyStatus">${t('settings.comfyStatus')}</p><label class="field">${t('settings.comfyUrl')}<input id="comfyUrl" autocomplete="off" placeholder="http://127.0.0.1:8188"></label><div class="row" style="flex-wrap:wrap;gap:8px"><button id="comfyStart">${t('onboarding.startComfy')}</button><button id="comfyCheck">${t('settings.comfyCheck')}</button><button id="comfySave">${t('settings.comfySave')}</button></div><p class="help-text" id="comfyMessage"></p></section><section class="settings-section"><h3>${t('settings.klingTitle')}</h3><p class="help-text">${t('settings.klingHelp')}</p><p class="help-text" id="klingStatus">${t('settings.klingStatus')}</p><label class="field">${t('settings.accessKey')}<input id="klingAccessKey" type="password" autocomplete="off" placeholder="已配置时留空保留"></label><label class="field">${t('settings.secretKey')}<input id="klingSecretKey" type="password" autocomplete="off" placeholder="已配置时留空保留"></label><label class="field ws-check-field"><input type="checkbox" id="klingEnabled"> ${t('settings.enable')}</label><div class="row"><button id="klingSave" class="primary">${t('settings.save')}</button></div><p class="help-text" id="klingMessage"></p></section>`);
 const sdStatus=$('#seedreamStatus'),sdMsg=$('#seedreamMessage'),sdKey=$('#seedreamKey'),sdModel=$('#seedreamModel'),sdMode=$('#seedreamMode');
 const readSeedream=async()=>{try{const info=await api('/api/providers/config');const cfg=info.config?.seedream||{};if(!sdStatus.isConnected)return;sdStatus.textContent=cfg.configured?`${t('settings.configured')} · ${cfg.mode==='agent-plan'?t('settings.agentPlan'):t('settings.arkPayg')} · ${cfg.model}`:t('settings.notConfigured');sdKey.value='';sdMode.value=cfg.mode||'agent-plan';sdModel.value=cfg.model||'';}catch(e){if(sdStatus.isConnected)sdStatus.textContent=e.message;}};
 readSeedream();
 $('#seedreamSave').onclick=async()=>{sdMsg.textContent=t('settings.saving');try{const info=await api('/api/providers/config',{apiKey:sdKey.value.trim(),mode:sdMode.value,model:sdModel.value.trim()});sdKey.value='';sdMsg.textContent=t('settings.saved');sdStatus.textContent=info.config?.seedream?.configured?`${t('settings.configured')} · ${info.config.seedream.mode==='agent-plan'?t('settings.agentPlan'):t('settings.arkPayg')}`:t('settings.notConfigured');}catch(e){sdMsg.textContent=e.message;}};
 $('#seedreamTest').onclick=async()=>{sdMsg.textContent=t('settings.readingModels');try{const data=await api('/api/providers/seedream/models');sdMsg.textContent=t('settings.modelsCount',{count:data.models?.length||0});}catch(e){sdMsg.textContent=e.message;}};
 $('#seedreamClear').onclick=async()=>{sdMsg.textContent=t('settings.clearing');try{await api('/api/providers/config',{clear:true});sdKey.value='';sdModel.value='';sdMsg.textContent=t('settings.keyCleared');await readSeedream();}catch(e){sdMsg.textContent=e.message;}};

 const comfyStatus=$('#comfyStatus'),comfyMsg=$('#comfyMessage'),comfyUrl=$('#comfyUrl');
 const readComfy=async()=>{try{const info=await api('/api/comfy/status');if(!comfyStatus.isConnected)return;comfyUrl.value=info.baseUrl||'';comfyStatus.textContent=info.ok?t('settings.comfyConnected',{version:info.version||''}):t('settings.comfyDisconnected',{error:info.error||'unknown'});}catch(e){if(comfyStatus.isConnected)comfyStatus.textContent=t('settings.comfyDisconnected',{error:e.message});}};
 readComfy();
 $('#comfyStart').onclick=async()=>{comfyMsg.textContent=t('settings.comfyStarting');try{const info=await api('/api/comfy/start', {});comfyMsg.textContent=info.ok?t('settings.comfyStarted'):t('settings.comfyDisconnected',{error:info.error||'unknown'});await readComfy();}catch(e){comfyMsg.textContent=e.message;}};
 $('#comfyCheck').onclick=async()=>{comfyMsg.textContent=t('settings.comfyChecking');try{const info=await api('/api/comfy/status');comfyMsg.textContent=info.ok?t('settings.comfyConnected',{version:info.version||''}):t('settings.comfyDisconnected',{error:info.error||'unknown'});}catch(e){comfyMsg.textContent=e.message;}};
 $('#comfySave').onclick=async()=>{comfyMsg.textContent=t('settings.saving');try{const info=await api('/api/comfy/config',{baseUrl:comfyUrl.value.trim()});comfyUrl.value=info.status.baseUrl;comfyMsg.textContent=t('settings.comfySaved');await readComfy();}catch(e){comfyMsg.textContent=e.message;}};

 const klingStatus=$('#klingStatus'),klingMsg=$('#klingMessage'),klingAccess=$('#klingAccessKey'),klingSecret=$('#klingSecretKey'),klingEnabled=$('#klingEnabled');
 const readKling=async()=>{try{const info=await api('/api/video/kling/config');const cfg=info.config||{};if(!klingStatus.isConnected)return;klingStatus.textContent=cfg.configured?t('settings.configured',{hint:cfg.accessKeyHint||'****'})+' · '+(cfg.enabled?t('settings.enabled'):t('settings.disabled')):t('settings.notConfigured');klingEnabled.checked=!!cfg.enabled;klingAccess.value='';klingSecret.value='';}catch(e){if(klingStatus.isConnected)klingStatus.textContent=e.message;}};
 readKling();
 $('#klingSave').onclick=async()=>{klingMsg.textContent=t('settings.saving');try{
  const payload={accessKey:klingAccess.value.trim(),secretKey:klingSecret.value.trim(),enabled:klingEnabled.checked};
  const bridge=window.directorDesktop;
  if(bridge?.saveProviderSecrets){await bridge.saveProviderSecrets({kling:payload});}
  else await api('/api/video/kling/config',{...payload,persist:true});
  klingMsg.textContent=t('settings.saved');await readKling();
 }catch(e){klingMsg.textContent=e.message;}};

}
async function captureDepth(options={}){if(!stage){toast('三维渲染器不可用');return}stop();try{await stage.readyAssets()}catch(e){toast(e.message);return}if(p.nodes.length>=500)return toast('画布节点已达上限，请先移除不需要的节点');const src=stage.depthShot(time,override,options),o=override?p.objects.find(o=>o.id===override):activeCamera(p,time);checkpoint();const n=asset('image',{title:`${o?.name||'机位'} · 深度图 ${time.toFixed(2)}s${options.simplifiedCharacterIds?.length?' · 简化角色':''}`,text:`深度参考 · ${formatFor(o).width} × ${formatFor(o).height}\n近黑远白的线性深度图，可作为生成模型的深度控制参考（updream 式双锚点）。`,src});p.nodes.push(n);const d=p.nodes.find(n=>n.type==='director');if(d)p.edges.push({from:d.id,to:n.id});setMode('board');filter='all';commit();select(n.id);fitBoard();toast('深度图已加入画布，可选中后下载')}
async function capture(options={}){if(!stage){toast('三维渲染器不可用');return}stop();try{await stage.readyAssets()}catch(e){toast(e.message);return}if(p.nodes.length>=500)return toast('画布节点已达上限，请先移除不需要的节点');const src=stage.screenshot(time,override,options),o=override?p.objects.find(o=>o.id===override):activeCamera(p,time);checkpoint();const n=asset('image',{title:`${o?.name||'机位'} · ${time.toFixed(2)}s${options.simplifiedCharacterIds?.length?' · 简化角色':''}`,text:`预演截图 · ${formatFor(o).width} × ${formatFor(o).height}\n用于构图、角色站位与场景参考。`,src});p.nodes.push(n);const d=p.nodes.find(n=>n.type==='director');if(d)p.edges.push({from:d.id,to:n.id});setMode('board');filter='all';commit();select(n.id);fitBoard();toast('截图已加入画布，可选中后下载')}
async function exportModal(){
 const outputSourceId=p.nodes.find(n=>n.id===activeDirectorId&&n.type==='director')?.id||p.nodes.find(n=>n.id===(mode==='board'?selected:modeMemory.board?.selected)&&n.type==='director')?.id;
 const project=p;if(!assetCatalog.length){try{const response=await fetch('/assets/manifest.json');if(response.ok){const data=await response.json();assetCatalog=data.assets||data}}catch{}}
 if(p!==project||exporting)return;const candidates=exportCharacterCandidates(p,assetCatalog);
 const cameras=p.objects.filter(o=>o.type==='camera');modal(t('export.title'),t('export.subtitle'),`<label class="field">${t('export.camera')}<select id="exportCamera"><option value="">${t('export.followShots')}</option>${cameras.map(o=>`<option value="${o.id}">${esc(o.name)} · ${o.aspect||'16:9'}</option>`).join('')}</select></label><label class="field">${t('export.format')}<select id="exportVideoFormat"><option value="mp4">H.264 / MP4</option><option value="webm">WebM</option></select></label><label class="field">${t('export.aspect')}<select id="exportAspect">${Object.keys(formats).map(f=>`<option>${f}</option>`).join('')}</select></label><div class="row"><label class="field grow">${t('export.start')}<input type="number" id="exportStart" min="0" max="${p.duration}" step=".1" value="0"></label><label class="field grow">${t('export.end')}<input type="number" id="exportEnd" min="0" max="${p.duration}" step=".1" value="${p.duration}"></label></div><section class="export-simplify"><label class="export-simplify-toggle"><input type="checkbox" id="simplifyCharacters" ${candidates.length?'':'disabled'}><span><b>${t('export.simplify')}</b><small>${t('export.simplifyHint')}</small></span></label><div id="simplifyOptions" hidden><div class="export-character-list">${candidates.map(c=>`<label><input type="checkbox" data-export-character="${c.id}" ${c.automatic?'checked':''}><span>${esc(c.name)}${c.automatic?'':' · 未分类，请确认是人物'}</span></label>`).join('')}</div><p class="help-text">${t('export.simplifyNote')}</p><button id="previewSimplified" type="button">${t('export.preview')}</button><img id="simplifyPreview" alt="当前机位简化角色预览" hidden></div>${!candidates.length?'<p class="help-text">'+t('export.noCharacters')+'</p>':''}</section><p class="help-text" id="exportSize"></p><p class="help-text">${t('export.sizeHelp')}</p><div id="exportProgress"></div>`,`<button id="exportReferencePack">${t('export.refPack')}</button><button id="exportScreenshot">${t('export.screenshot')}</button><button class="primary" id="startExport">${t('export.startRecord')}</button>`);
 $('#exportReferencePack').onclick=()=>{closeModal();referencePackModal()};const update=()=>{const camera=cameras.find(o=>o.id===$('#exportCamera').value);if(camera)$('#exportAspect').value=camera.aspect||'16:9';$('#exportAspect').disabled=!!camera;const f=formats[$('#exportAspect').value];$('#exportSize').textContent=`${f.width} × ${f.height} · ${p.fps} fps · ${$('#exportVideoFormat').value==='mp4'?'H.264 / MP4':'WebM'}`;};$('#exportCamera').onchange=update;$('#exportAspect').onchange=update;$('#exportVideoFormat').onchange=update;try{recordingFormat('mp4',m=>MediaRecorder.isTypeSupported(m))}catch{$('#exportVideoFormat').value='webm';$('#exportVideoFormat option[value=mp4]').disabled=true;}update();
 const simplifyOptions=()=>{if(!$('#simplifyCharacters').checked)return {};const ids=$$('[data-export-character]:checked').map(el=>el.dataset.exportCharacter);if(!ids.length){toast('请至少选择一个需要简化的人物');return null}return {simplifiedCharacterIds:ids};};
 $('#simplifyCharacters').onchange=()=>{$('#simplifyOptions').hidden=!$('#simplifyCharacters').checked;$('#simplifyPreview').hidden=true;};
 const invalidatePreview=()=>{$('#simplifyPreview').hidden=true;};$$('[data-export-character]').forEach(el=>el.onchange=invalidatePreview);$('#exportCamera').addEventListener('change',invalidatePreview);
 $('#previewSimplified').onclick=async()=>{const options=simplifyOptions();if(!options||!stage)return;const image=$('#simplifyPreview'),button=$('#previewSimplified'),cameraId=$('#exportCamera').value;button.disabled=true;try{await stage.readyAssets();if(!image.isConnected||p!==project)return;image.src=stage.screenshot(time,cameraId||null,options);image.hidden=false;}catch(e){toast(e.message)}finally{button.disabled=false}};
 $('#exportScreenshot').onclick=async()=>{const options=simplifyOptions();if(!options)return;const choice=$('#exportCamera').value,prior=override;override=choice||null;closeModal();try{await withLocalWork(()=>capture(options))}finally{override=prior;renderPreviewSelect();}};
 $('#startExport').onclick=async()=>{
  const options=simplifyOptions();if(!options)return;
  const start=Math.round(+$('#exportStart').value*p.fps)/p.fps,end=Math.round(+$('#exportEnd').value*p.fps)/p.fps,cameraId=$('#exportCamera').value,format=formats[$('#exportAspect').value];
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>p.duration||end<=start){toast('请填写有效导出区间');return}if(!stage)return;
  const container=$('#exportVideoFormat').value,originalTime=time,controller=new AbortController(),camera=cameras.find(o=>o.id===cameraId),name=p.name+(camera?' · '+camera.name:' · 镜头编排')+(options.simplifiedCharacterIds?.length?' · 简化角色':'');exporting=true;$$('.modal input,.modal select,.modal button').forEach(e=>e.disabled=true);$('#exportScreenshot').disabled=false;$('#exportScreenshot').textContent=t('export.cancelRecord');$('#exportScreenshot').onclick=()=>controller.abort();$('#exportProgress').innerHTML='<div class="export-progress"><i style="width:0%"></i></div><p class="help-text" id="exportText">'+t('export.preparing')+'</p>';const hidden=()=>{if(document.hidden)controller.abort()};document.addEventListener('visibilitychange',hidden);
  try{const blob=await stage.exportVideo(p,v=>{$('.export-progress i').style.width=v*100+'%';$('#exportText').textContent=t('export.recording',{percent:Math.round(v*100)})},controller.signal,{start,end,cameraId,format,container,...options});download(blob,name+'.'+container);const src=await readDataURL(blob);if(p.nodes.length+(p.nodes.some(n=>n.type==='director')?1:2)>500){exporting=false;closeModal();toast(t('export.downloadedFull'));return;}checkpoint();const n=asset('video',{src,title:name+' · 白模预演',text:`${start}–${end}s · ${p.fps}fps · ${format.width} × ${format.height}\n${camera?'单机位输出':'按镜头编排输出'}`});appendDirectorVideo(p,n,outputSourceId);exporting=false;closeModal();setMode('board');filter='all';commit();select(n.id);fitBoard();toast('视频已下载并加入画布');}
  catch(e){exporting=false;closeModal();toast(e.name==='AbortError'?t('export.cancelRecord'):t('export.exportFailed',{error:e.message}))}finally{document.removeEventListener('visibilitychange',hidden);exporting=false;setTime(originalTime);}
 };
}
let aiToken=null;
async function api(path,data,{signal}={}){if(data&&!aiToken){const status=await api('/api/ai/text/status',undefined,{signal});aiToken=status.token;}const timeout=AbortSignal.timeout(180000),combined=signal?AbortSignal.any([signal,timeout]):timeout;let response;try{response=await fetch(path,{...(data?{method:'POST',headers:{'Content-Type':'application/json','X-Jingchang-Token':aiToken},body:JSON.stringify(data)}:{}),signal:combined});}catch(e){if(signal?.aborted)throw new DOMException('已取消','AbortError');if(timeout.aborted)throw Error(translateToast('本机服务响应超时，请先在任务中心核对生成记录，再手动重试'));throw Error(translateToast('本机服务连接中断，请重新打开软件后核对任务记录'));}const result=await response.json();if(!response.ok)throw Error(translateToast(result.error||'本地服务请求失败'));return result;}

async function generationPanel(source,mode='image'){
 const project=p,projectId=p.id,sourceId=source?.id,projectTitle=p.name||'';
 let providerId='',models=[],quote=null,busy=false,resultUrl=null,providerList=[];
 nodeToolModal(source?.id,mode==='image'?'生成图片':'生成视频','统一生成面板：参考 → 参数 → 费用 → 提交 → 结果。',`<div class="image-composer"><p class="help-text" id="genHelp"></p><div class="composer-scroll"><div class="field"><span>参考</span><div id="genRefs" class="help-text">正在读取参考…</div></div><label class="field">描述<textarea id="genPrompt" rows="5" maxlength="6000"></textarea></label><div class="composer-settings image-settings"><label class="field grow">服务商<select id="genProvider"></select></label><label class="field grow">模型<select id="genModel"></select></label><label class="field" id="genSizeField">尺寸<select id="genSize"><option>1024x1024</option><option>1280x720</option><option>720x1280</option><option>768x768</option></select></label><label class="field" id="genDurationField" hidden>时长<select id="genDuration"><option>2</option><option>4</option><option>5</option><option>10</option></select></label><label class="field" id="genStepsField">步数<input id="genSteps" type="number" min="1" max="60" value="20"></label></div><p id="genStatus" class="help-text" role="status">正在读取服务商…</p><div id="genResult"></div><details class="generation-history" style="margin-top:10px"><summary>最近生成</summary><div id="genHistory" class="help-text">正在读取…</div></details></div></div>`,`<span id="genPrice" class="composer-price" role="status"></span><button id="genCancel">取消</button><button id="genRun" class="primary" disabled>查看费用</button>`);
 const panel=document.querySelector('#genPrompt')?.closest('.modal');if(!panel)return;const q=sel=>panel.querySelector(sel);
 const escValue=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const setStatus=text=>{if(q('#genStatus'))q('#genStatus').textContent=text;};
 const live=()=>panel.isConnected&&p===project;
 const resetQuote=()=>{quote=null;q('#genPrice').textContent='';q('#genRun').textContent='查看费用';};
 q('#genPrompt').value=typeof source?.imagePromptDraft==='string'?source.imagePromptDraft:canvasImagePrompt(p,source);
 q('#genHelp').textContent=mode==='image'?'使用本地 ComfyUI 或云端 Seedream 生成图片；提交后结果自动加入画布。':'使用 Provider 生成视频；Fake 免费，云端视频按实际计费。';
 q('#genCancel').onclick=()=>closeModal();
 const refs=p.nodes.filter(n=>n.type==='image'&&n.src&&n.id!==sourceId&&p.edges.some(e=>(e.from===sourceId&&e.to===n.id)||(e.to===sourceId&&e.from===n.id))).slice(0,6);
 const referenceSrc=refs[0]?.src||(source?.type==='image'&&source.src?source.src:null);
 const updateRefNote=()=>{const info=providerList.find(x=>x.id===providerId);const supports=mode==='image'?providerId==='comfyui':!!info?.capabilities?.video?.imageToVideo;q('#genRefs').innerHTML=referenceSrc?`<img src="${escValue(referenceSrc)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:4px;margin:2px"> <span>参考图已连入；${supports?'当前 Provider 会使用它':'当前 Provider 不支持图片参考，仅使用文字描述'}。</span>`:'无连线参考。当前 Provider 以文字描述生成为主。';};
 updateRefNote();
 q('#genSizeField').hidden=mode!=='image';q('#genDurationField').hidden=mode!=='video';q('#genStepsField').hidden=mode!=='image';
 const prices={};const quotePaths={comfyui:'/api/comfy/quote',seedream:'/api/providers/seedream/quote'};
 const submitPaths={comfyui:'/api/comfy/generate',seedream:'/api/providers/seedream/generate'};
 const pollPath=(pid,id)=>pid==='comfyui'?`/api/comfy/task/${encodeURIComponent(id)}`:pid==='seedream'?`/api/providers/task/${encodeURIComponent(id)}`:`/api/video/task/${encodeURIComponent(pid)}/${encodeURIComponent(id)}`;
 const filePath=(pid,id)=>pid==='comfyui'?`/api/comfy/task/${encodeURIComponent(id)}/file/0`:pid==='seedream'?`/api/providers/task/${encodeURIComponent(id)}/file/0`:`/api/video/task/${encodeURIComponent(pid)}/${encodeURIComponent(id)}/file/0`;
 async function loadModels(){
  const pid=q('#genProvider').value;providerId=pid;q('#genModel').innerHTML='<option>正在读取…</option>';q('#genRun').disabled=true;
  try{
   const data=pid==='comfyui'?await api('/api/comfy/models'):pid==='seedream'?await api('/api/providers/seedream/models'):await api('/api/video/models?providerId='+encodeURIComponent(pid));
   models=(data.models||[]).filter(m=>mode==='image'?m.kind!=='video':m.kind==='video');
   if(!models.length)throw Error('该服务商没有可用模型');
   q('#genModel').innerHTML=models.map(m=>`<option value="${escValue(m.id)}">${escValue(m.name)}</option>`).join('');
   q('#genRun').disabled=false;updateRefNote();setStatus('就绪。第一步查看费用，第二步确认生成。');
  }catch(e){q('#genModel').innerHTML='';setStatus(e.message);}
 }
 async function loadProviders(){
  try{
   if(mode==='image'){
    const [comfy,cfg]=await Promise.all([api('/api/comfy/status'),api('/api/providers/config')]);
    providerList=[{id:'comfyui',label:'ComfyUI（本地）',enabled:!!comfy.ok},{id:'seedream',label:'Seedream（云端）',enabled:!!cfg.config?.seedream?.configured}];
   }else{
    const data=await api('/api/video/providers');providerList=(data.providers||[]).filter(x=>x.enabled).map(x=>({id:x.id,label:x.label,enabled:true,capabilities:x.capabilities}));
   }
   const enabled=providerList.filter(x=>x.enabled);
   if(!enabled.length)throw Error('未配置可用服务商，请先到设置 → API 服务配置');
   q('#genProvider').innerHTML=enabled.map(x=>`<option value="${escValue(x.id)}">${escValue(x.label)}</option>`).join('');
   q('#genProvider').onchange=()=>{resetQuote();loadModels();};
   q('#genModel').onchange=resetQuote;q('#genSize').onchange=resetQuote;q('#genDuration').onchange=resetQuote;q('#genSteps').oninput=resetQuote;
   await loadModels();
  }catch(e){setStatus(e.message);q('#genRun').disabled=true;}
 }
 
 async function loadHistory(){
  try{
   const [a,b,c]=await Promise.all([
    api('/api/providers/tasks?projectId='+encodeURIComponent(projectId)),
    api('/api/comfy/tasks?projectId='+encodeURIComponent(projectId)),
    api('/api/video/tasks?projectId='+encodeURIComponent(projectId)),
   ]);
   const tasks=[
    ...(a.tasks||[]).map(x=>({...x,providerId:'seedream'})),
    ...(b.tasks||[]).map(x=>({...x,providerId:'comfyui'})),
    ...(c.tasks||[]),
   ].filter(t=>t.kind===mode&&t.status==='succeeded').sort((x,y)=>(y.createdAt||0)-(x.createdAt||0)).slice(0,8);
   if(!q('#genHistory'))return;
   q('#genHistory').innerHTML=tasks.length?tasks.map(t=>`<div class="gen-history-row" style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #2d2c31"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escValue(t.providerId)} · ${escValue((t.prompt||'').slice(0,40))}</span><button type="button" data-gen-recover="${escValue(t.id)}" data-gen-provider="${escValue(t.providerId)}">加入画布</button></div>`).join(''):'暂无已完成的生成。';
   q('#genHistory').querySelectorAll('[data-gen-recover]').forEach(button=>button.onclick=()=>recoverTask(button.dataset.genRecover,button.dataset.genProvider));
  }catch(e){if(q('#genHistory'))q('#genHistory').textContent=e.message;}
 }
 async function recoverTask(taskId,pid){
  try{
   setStatus('正在恢复任务结果…');
   const response=await fetch(filePath(pid,taskId));if(!response.ok)throw Error('结果读取失败');
   const src=await readDataURL(await response.blob());if(!live())return;
   if(mode==='image'){
    const plan=planCanvasImageResult(project,{sourceId,taskId,src,prompt:q('#genPrompt').value.trim(),context:imageAssetContext(project,sourceId),createNode:extra=>asset('image',{title:`${pid} · 恢复结果`,...extra})});
    if(plan.already){setStatus('该结果已在画布中');return;}
    checkpoint();const node=plan.node;if(plan.replace)p.nodes[p.nodes.findIndex(v=>v.id===node.id)]=node;else p.nodes.push(node);if(plan.edge)p.edges.push(plan.edge);
    setMode('board');filter='all';commit();select(node.id);fitBoard();
   }else{
    if(p.nodes.some(n=>n.generatedTask===taskId)){setStatus('该视频已在画布中');return;}
    checkpoint();const node=asset('video',{title:`${pid} · 恢复结果`,src,generatedTask:taskId});p.nodes.push(node);setMode('board');filter='all';commit();select(node.id);fitBoard();
   }
   setStatus('已恢复到画布。');
  }catch(e){setStatus(e.message);}
 }

async function quoteNow(){
  const prompt=q('#genPrompt').value.trim(),modelId=q('#genModel').value;
  if(!prompt)throw Error('请填写描述');
  if(mode==='image')return providerId==='comfyui'?api(quotePaths.comfyui,{modelId,prompt,size:q('#genSize').value,steps:Number(q('#genSteps').value)||20,projectId,reference:referenceSrc||undefined,denoise:0.65}):api(quotePaths.seedream,{modelId,prompt,size:q('#genSize').value,projectId});
  const info=providerList.find(x=>x.id===providerId);
  return api('/api/video/quote',{providerId,modelId,prompt,duration:Number(q('#genDuration').value)||2,kind:'video',projectId,image:info?.capabilities?.video?.imageToVideo&&referenceSrc?referenceSrc:undefined});
 }
 async function run(){
  if(busy)return;const button=q('#genRun');
  try{
   if(!quote){busy=true;button.disabled=true;setStatus('正在获取费用…');quote=await quoteNow();if(!live())return;q('#genPrice').textContent=quote.cost===0?'本地生成，不产生云端费用':quote.note||'按服务商实际计费';button.textContent='确认生成';setStatus('确认后将提交生成；提交后不可撤销。');busy=false;button.disabled=false;return;}
   busy=true;button.disabled=true;q('#genCancel').disabled=true;setStatus('正在提交…');
   const submitted=mode==='image'?await api(submitPaths[providerId],{quoteId:quote.quoteId,projectId,sourceId}):await api('/api/video/generate',{quoteId:quote.quoteId,projectId,sourceId});
   const taskId=submitted.taskId;let task=null;setStatus('正在生成…');
   for(let i=0;i<300;i++){
    await new Promise(r=>setTimeout(r,2000));if(!live())return;
    task=await api(pollPath(providerId,taskId));
    if(task.status==='succeeded')break;
    if(task.status==='failed')throw Error(task.error?.message||task.message||'生成失败');
    if(task.message)setStatus(task.message);
   }
   if(!task||task.status!=='succeeded')throw Error('生成超时');
   const response=await fetch(filePath(providerId,taskId));if(!response.ok)throw Error('结果读取失败');
   const src=await readDataURL(await response.blob());if(!live())return;
   if(mode==='image'){
    const context=imageAssetContext(project,sourceId);
    const plan=planCanvasImageResult(project,{sourceId,taskId,src,prompt:q('#genPrompt').value.trim(),context,createNode:extra=>asset('image',{title:`${providerId} · `+q('#genPrompt').value.trim().slice(0,24),...extra})});
    if(plan.already){setStatus('该图片已在画布中');return;}
    checkpoint();const node=plan.node;if(plan.replace)p.nodes[p.nodes.findIndex(v=>v.id===node.id)]=node;else p.nodes.push(node);if(plan.edge)p.edges.push(plan.edge);
   }else{
    checkpoint();const node=asset('video',{title:`${providerId} · `+q('#genPrompt').value.trim().slice(0,24),text:`Provider: ${providerId}\nModel: ${q('#genModel').value}`,src,generatedTask:taskId});p.nodes.push(node);
   }
   const resultNode=mode==='image'?p.nodes.find(n=>n.generatedTask===taskId):p.nodes.at(-1);
   setMode('board');filter='all';commit();if(resultNode)select(resultNode.id);fitBoard();resultUrl=src;
   q('#genResult').innerHTML=`<div class="generation-result" style="display:flex;gap:10px;align-items:center;margin-top:10px;padding:8px;border:1px solid #39393c;border-radius:8px">${mode==='image'?`<img src="${src}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:6px">`:`<video src="${src}" controls style="width:96px;height:64px;object-fit:cover;border-radius:6px"></video>`}<div><b>${providerId} · ${escValue(q('#genModel').value)}</b><div class="help-text">已加入画布 · ${quote?.cost===0?'本地免费':'按服务商实际计费'}</div><div class="help-text">任务 ${taskId.slice(0,8)}…</div></div>${mode==='image'?`<div class="property-actions" style="margin-left:auto;flex-wrap:wrap"><button type="button" id="genCandidates">同源候选</button><button type="button" id="genAdoptVersion">加入资产版本</button><button type="button" id="genAdoptOfficial">设为正式图</button></div>`:''}</div>`;
   if(mode==='image'&&resultNode){q('#genCandidates').onclick=()=>openImageCandidates(sourceId,taskId);q('#genAdoptVersion').onclick=()=>openImageAdoption(resultNode,false);q('#genAdoptOfficial').onclick=()=>openImageAdoption(resultNode,true);}
   setStatus('生成完成。');button.textContent='再次生成';quote=null;q('#genPrice').textContent='';q('#genCancel').disabled=false;loadHistory();
  }catch(e){setStatus(e.message);}
  finally{busy=false;if(live()){button.disabled=false;q('#genCancel').disabled=false;}}
 }
 q('#genPrompt').oninput=resetQuote;
 q('#genRun').onclick=run;
 loadProviders();
 loadHistory();
}

async function aiImageModal(source,{promptOverride}={}){
 if(source&&typeof promptOverride==='string')source.imagePromptDraft=promptOverride;
 return generationPanel(source,'image');
}
async function providerVideoModal(source){return generationPanel(source,'video');}

let taskCenterFilter='all',taskCenterSelected=null,taskCenterBusy=new Set();
function taskRecords(){return collectTaskRecords({project:p});}
function renderTaskCenter(){
 const root=$('#unifiedTasks');if(!root?.isConnected||root.dataset.project!==p.id)return;
 const records=taskRecords(),counts=taskCenterCounts(records),focused=document.activeElement?.closest('[data-task-key]')?.dataset.taskKey,scroll=root.scrollTop;
 const selected=records.find(r=>r.key===taskCenterSelected),rows=filterTaskRecords(records,taskCenterFilter);
 root.innerHTML=`<nav class="task-filters" aria-label="筛选任务">${[['all',t('task.all')],['active',t('task.active')],['ready',t('task.ready')],['attention',t('task.attention')],['finished',t('task.finished')]].map(([id,label])=>`<button type="button" data-task-filter="${id}" aria-pressed="${taskCenterFilter===id}">${label}${counts[id]?' '+counts[id]:''}</button>`).join('')}</nav><p class="task-announcement" role="status" aria-live="polite">${counts.active?t('task.activeCount',{count:counts.active})+' · ':''}${counts.ready?t('task.readyCount',{count:counts.ready}):records.length?t('task.totalCount',{count:records.length}):t('task.empty')}</p>
 <div class="task-list">${rows.map(r=>`<button type="button" class="task-row" data-task-key="${esc(r.key)}" aria-pressed="${taskCenterSelected===r.key}"><span><b>${esc(r.title)}</b><small>${esc(r.typeLabel)}${r.createdAt?' · '+new Date(r.createdAt).toLocaleString(getLocale(),{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):''}</small></span><span class="task-label" data-busy="${r.busy}">${esc(r.label)}</span></button>`).join('')||(!records.length?'':'<p class="help-text">'+t('task.none')+'</p>')}</div>
 ${selected?`<section class="task-detail" aria-label="所选任务详情"><header><h3>${esc(selected.typeLabel)}</h3><button type="button" data-task-collapse aria-label="收起任务详情">${t('task.collapse')}</button></header><p><b>${esc(selected.title)}</b></p><p>${esc(selected.label)}${selected.message?' · '+esc(selected.message):''}</p>${selected.queryError?`<p class="task-query-error" role="status">${t('task.queryIncomplete',{error:esc(selected.queryError)})}</p>`:''}${selected.progress!==null?`<progress value="${selected.progress}" max="1" aria-label="${t('task.progress')}"></progress>`:''}<p class="help-text">${esc(selected.cost)}<br>${esc(selected.recoveryNote)}<br>${esc(selected.cancelNote)}</p><div class="task-actions">${selected.actions.open?'<button type="button" class="primary" data-task-open>在对话中查看</button>':''}${selected.actions.query?`<button type="button" data-task-query ${taskCenterBusy.has(selected.key)?'disabled':''}>${taskCenterBusy.has(selected.key)?'正在查询…':selected.actions.addToCanvas?'查询并接收结果':'查询最新状态'}</button>`:''}${selected.nodeId?'<button type="button" data-task-locate>定位画布节点</button>':''}${selected.outputUrl?`<a href="${esc(selected.outputUrl)}" download>保存结果文件</a>`:''}</div><details><summary>任务编号</summary><code>${esc(selected.id)}</code></details></section>`:''}`;
 root.scrollTop=scroll;
 root.querySelectorAll('[data-task-filter]').forEach(b=>b.onclick=()=>{taskCenterFilter=b.dataset.taskFilter;renderTaskCenter();});
 root.querySelectorAll('[data-task-key]').forEach(b=>b.onclick=()=>{taskCenterSelected=b.dataset.taskKey;renderTaskCenter();root.querySelector('.task-detail')?.scrollIntoView({block:'nearest'});});
 root.querySelector('[data-task-collapse]')?.addEventListener('click',()=>{taskCenterSelected=null;renderTaskCenter();});
 root.querySelector('[data-task-open]')?.addEventListener('click',()=>{closeModal();wsShell.openCreativeTask(selected.id);});
 root.querySelector('[data-task-locate]')?.addEventListener('click',()=>{closeModal();wsShell.setPage('canvas');setMode('board');filter='all';locateCanvasNode(selected.nodeId);});
 root.querySelector('[data-task-query]')?.addEventListener('click',async()=>{
  if(taskCenterBusy.has(selected.key))return;const project=p;taskCenterBusy.add(selected.key);renderTaskCenter();
  try{if(selected.kind==='export'){const receipt=await queryTaskRecord(selected,api);if(p!==project)return;const task=project.workstation.deliver.tasks.find(t=>t.id===selected.id);if(task){Object.assign(task,receipt,{updatedAt:Date.now()});persist();}}
  }catch(e){if($('#taskCenterStatus')?.isConnected)$('#taskCenterStatus').textContent=e.message+'；未重新提交任务。';}
  finally{taskCenterBusy.delete(selected.key);renderTaskCenter();}
 });
 if(focused)root.querySelectorAll('[data-task-key]').forEach(b=>{if(b.dataset.taskKey===focused)b.focus({preventScroll:true});});
}
function renderCreativeJobs(){renderTaskCenter();}
document.addEventListener('creative-tasks-changed',renderTaskCenter);
let creativeSaveChain=Promise.resolve();
function saveCreativeTasks(projectId,records){
 const incoming=normalizeCreativeTasks(records);
 const merge=()=>{
  const merged=new Map(normalizeCreativeTasks(p.workstation.creativeTasks).map(t=>[t.id,t]));
  for(const t of incoming){const old=merged.get(t.id);if(!old||t.updatedAt>=old.updatedAt)merged.set(t.id,t);}
  p.workstation.creativeTasks=normalizeCreativeTasks([...merged.values()]);persist();renderCreativeJobs();
 };
 const operation=creativeSaveChain.catch(()=>{}).then(async()=>{
  if(p.id===projectId){merge();return;}
  // Update only tasks inside one database transaction, never a stale whole-project snapshot.
  await library.patchCreativeTasks(projectId,incoming);
  if(p.id===projectId)merge();
 });
 creativeSaveChain=operation;return operation;
}

async function modelTasksModal(){
 const projectId=p.id;taskCenterSelected=null;taskCenterFilter='all';
 modal(t('task.title'),t('task.subtitle'),`<div id="unifiedTasks" data-project="${esc(projectId)}"></div><p id="taskCenterStatus" class="help-text" role="status"></p><section id="providerVideoTasksSection" class="settings-section" hidden><h3>${t('task.providerTasks')}</h3><div id="providerVideoTasks"></div></section>`);
 renderTaskCenter();renderProviderVideoTasks(projectId);
}
async function renderProviderVideoTasks(projectId){
 const section=$('#providerVideoTasksSection'),body=$('#providerVideoTasks');if(!section||!body)return;
 try{const data=await api('/api/video/tasks?projectId='+encodeURIComponent(projectId));if(!body.isConnected)return;const tasks=data.tasks||[];section.hidden=!tasks.length;body.innerHTML=tasks.map(task=>`<div class="task-row" style="cursor:default"><span><b>${esc(task.providerId)} · ${esc(task.modelId)}</b><small>${esc(task.prompt||'').slice(0,80)}</small></span><span class="task-label">${esc(task.status)}</span></div>`).join('')||`<p class="help-text">${t('task.providerEmpty')}</p>`;}
 catch(e){if(body.isConnected)body.innerHTML=`<p class="help-text">${esc(e.message)}</p>`;}
}
function enterGeneratedModel(node){
 try{checkpoint();const o=modelNodeToStage(p,node);p.objects.filter(x=>x.type!=='camera').forEach(x=>x.solo=false);o.hidden=false;focusAfterLoad=o.id;setMode('stage');commit(true);select(o.id);stage?.frameSelection();toast('模型已加入导演台，可摆放、旋转、缩放和打走位关键帧');}catch(e){toast(e.message)}
}

function showLibraryPanel(open){
 if(open&&mode!=='stage')setMode('stage');libraryOpen=open;syncSidebarMode();requestAnimationFrame(()=>stage?.resize());
}

async function libraryModal(group){
 closeModal();showLibraryPanel(true);if(typeof group==='string')libraryGroup=group;
 try{if(!assetCatalog.length){$('#assetGrid').innerHTML='<p class="asset-empty">正在读取本地模型…</p>';const response=await fetch('/assets/manifest.json');if(!response.ok)throw Error('模型清单尚未就绪');const data=await response.json();assetCatalog=Array.isArray(data)?data:data.assets;}}
 catch(e){$('#assetGrid').innerHTML=`<p class="asset-empty">${esc(e.message)}。请重新打开离线库重试。</p>`;return;}
 renderAssetLibrary();
}
function renderAssetLibrary(){
 const groups=[['','全部模型'],...assetGroups],inGroup=(a,id)=>!id||a.libraryGroup===id;
 $('#libraryCount').textContent=assetCatalog.length+' 个';
 $('#assetCategories').innerHTML=groups.map(([id,name])=>`<button data-library-group="${id}" class="${id===libraryGroup?'active':''}" aria-pressed="${id===libraryGroup}">${name}<small>${assetCatalog.filter(a=>inGroup(a,id)).length}</small></button>`).join('');
 const words=libraryQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const assets=assetCatalog.filter(a=>inGroup(a,libraryGroup)&&words.every(w=>(a.name+' '+(a.description||'')+' '+(a.gender==='female'?'女性':a.gender==='male'?'男性':'')).toLowerCase().includes(w))).sort((a,b)=>Number(!!b.adultBase)-Number(!!a.adultBase)||({female:0,male:1}[a.gender]??2)-({female:0,male:1}[b.gender]??2));
 $('#assetGroupNote').textContent=libraryGroup==='character-realistic'?'成人比例预演模型，非照片级写实。女性基础人偶与服装角色均可选。':libraryGroup==='animal-realistic'?'此分类暂未收录，现有动物在「卡通动物」。':['geometry','furniture'].includes(libraryGroup)?'点击缩略图加入导演台，可移动、旋转、缩放和修改颜色。':'选中模型后，在右侧动作库中编排表演。';
 $('#assetGrid').innerHTML=assets.length?assets.map(a=>`<button class="add-tile" data-library="${esc(a.id)}" title="${esc(a.description||a.name)}"><img class="asset-thumbnail" src="/assets/${esc(a.thumbnail)}" alt="${esc(a.name)}预览" loading="lazy"><b>${esc(a.name)}</b><span>${a.animations?.length?a.animations.length+' 动作/姿态':a.animated?'带原生动作':'静态模型'}</span></button>`).join(''):'<p class="asset-empty">'+(words.length?'没有匹配的模型，试试其他名称。':'此分类暂无模型，可导入自己的 GLB。')+'</p>';
 $('#assetGrid').scrollTop=0;
 $$('[data-library-group]').forEach(b=>b.onclick=()=>{libraryGroup=b.dataset.libraryGroup;renderAssetLibrary();});
 $$('[data-library]').forEach(b=>b.onclick=()=>{const a=assetCatalog.find(a=>a.id===b.dataset.library);insertModel(a.name,a.file.startsWith('/assets/')?a.file:'/assets/'+a.file,a.size||a.modelSize||({character:1.8,animal:1.8,vehicle:4.5,building:8})[a.category]||3);});
}

function mountModelAppearance(o,s){
 const row=$('#objColor').closest('label');row.innerHTML=`模型颜色模式<select title="纹理染色保留图案；统一纯色覆盖整体。颜色可打关键帧，模式对整段生效。" id="modelColorMode" aria-label="模型颜色模式"><option value="original">保留原材质</option><option value="tint">纹理染色</option><option value="solid">统一纯色</option></select>`;
 $('#modelColorMode').value=o.modelColorMode||'original';
 row.insertAdjacentHTML('afterend',`<label class="field">模型颜色<input id="modelTint" type="color" aria-label="模型颜色" value="${s.modelTint||'#ffffff'}" ${!o.modelColorMode||o.modelColorMode==='original'?'disabled':''}></label><div class="row model-color-presets"><button id="modelBlue">蓝色</button><button id="modelRed">红色</button><button id="modelWhite">白色</button><button id="restoreModelColor">恢复原色</button></div>`);
 const setMode=value=>{if(o.locked)return;checkpoint();o.modelColorMode=value;commit();renderProperties();};
 $('#modelColorMode').onchange=e=>setMode(e.target.value);$('#restoreModelColor').onclick=()=>setMode('original');
 $('#modelTint').onchange=e=>editObject(o,cur=>cur.modelTint=e.target.value);
 for(const [id,color] of Object.entries({modelBlue:'#4285f4',modelRed:'#e85d62',modelWhite:'#ffffff'}))$('#'+id).onclick=()=>{if(o.locked)return;stop();checkpoint();if(!o.modelColorMode||o.modelColorMode==='original')o.modelColorMode='tint';editParameters(o,time,{modelTint:color},'smooth');commit();renderProperties();};
}
function modelMotionModal(o){
 if(o.locked)return toast('对象已锁定，请先解锁');stop();
 const data=stage?.meshes.get(o.id)?.userData,draft=o.motionDraft||{prompt:'',duration:5},clips=data?.clips||[];
 const status=data?.loadError?'加载失败：'+data.loadError:!data?.loaded?'模型正在加载，请稍后关闭并重新打开检查。':data.skinnedMeshes?`检测到蒙皮网格 ${data.skinnedMeshes} 个、骨骼 ${data.bones} 个；骨骼结构仍需与动作服务匹配。`:'未检测到蒙皮骨骼，肢体动画需要先完成绑骨蒙皮。';
 modal('文字动作 · '+o.name,'先检查骨骼，再描述动作；生成后才能加入时间轴。',`<p class="preset-help">${esc(status)}<br>当前模型自带动作：${clips.length} 个。</p><label class="field">动作描述<textarea id="modelMotionPrompt" rows="4" maxlength="1000" placeholder="人物缓慢向前走，停下后抬起右手挥手。">${esc(draft.prompt)}</textarea></label><label class="field">目标时长 / 秒<input id="modelMotionDuration" type="number" min="1" max="12" step="1" value="${draft.duration}"></label><p class="help-text">描述和时长可随工程保存。此入口尚未连接云端绑骨或文生动作，不会上传模型或扣费，也不会写入未生成的动画。</p><p class="help-text">云端绑骨与文字动作生成尚未接入；可使用已有骨骼和模型自带动作。</p><button id="motionExisting" class="key-button" ${clips.length?'':'disabled'}>使用模型自带动作（${clips.length}）</button>`,`<button id="saveMotionDraft" class="primary">保存动作描述</button>`);
 $('#saveMotionDraft').onclick=()=>{if(!p.objects.includes(o)||o.locked)return toast('对象已变化，请重新打开');const duration=+$('#modelMotionDuration').value;if(!Number.isInteger(duration)||duration<1||duration>12)return toast('时长请输入 1–12 的整数');checkpoint();o.motionDraft={prompt:$('#modelMotionPrompt').value.trim().slice(0,1000),duration};commit();closeModal();renderProperties();toast('动作描述已保存，尚未生成动画');};
 $('#motionExisting').onclick=()=>modelActionModal(o);
}
function modelActionModal(o){
 const data=stage?.meshes.get(o.id)?.userData;if(!data?.loaded)return toast(data?.loadError||'模型还在加载，请稍后打开动作库');if(o.locked)return toast('对象已锁定');
 const clips=data.clips||[];
 modal('离线动作库 · '+o.name,'选择动作后设置起止时间，添加到导演台时间轴。动作完全离线，不需要 API。',`<p class="help-text">行走与跑步等肢体动作可配合位置关键帧走位。片段两端拖动调整时长，中间拖动移动；双击可改速度。不同骨架的动作不能直接互换。</p><label class="field">搜索动作<input id="clipSearch" placeholder="例如：走、跳、挥手、Idle"></label><div class="modal-grid" id="clipChoices">${clips.map((c,i)=>`<button class="add-tile" data-clip-index="${i}"><b>${esc(clipLabel(c.name))}</b><span>${esc(c.name)} · ${c.duration.toFixed(2)} 秒 / 循环</span></button>`).join('')}</div>${!clips.length?'<p class="help-text">此模型没有自带动作。可保存文字动作描述，待接入云端动作服务。</p>':''}`,`<button id="libraryMotionDraft">文字动作描述</button>`);
 $('#libraryMotionDraft').onclick=()=>modelMotionModal(o);
 $('#clipSearch').oninput=e=>{$$('[data-clip-index]').forEach(b=>b.hidden=!b.textContent.toLowerCase().includes(e.target.value.trim().toLowerCase()))};
 $$('[data-clip-index]').forEach(b=>b.onclick=()=>modelClipModal(o,clips[+b.dataset.clipIndex].name));
}
function pathWalkModal(o,existing,requestedKind){
 if(o.locked)return toast('对象已锁定');stop();
 const clips=stage?.meshes.get(o.id)?.userData.clips||[];
 if(o.type==='model'&&!clips.length)return toast('此模型暂无骨骼动作，请选用自带行走 / 跑步动作的离线角色，或先为模型绑骨并导入动作');
 let range;try{range=pathWalkRange(o)}catch(e){return toast(e.message)}
 let kind=requestedKind||pathMotionKind(existing),replace=false;
 existing??=(o.actions||[]).find(a=>a.followPath&&pathMotionKind(a)===kind);
 const preferred=()=>kind==='run'?preferredRunClip(clips):preferredWalkClip(clips);
 const chosen=existing?.clip||preferred()?.name||'';
 modal(existing?'编辑沿路径动作':'沿路径动作',esc(o.name),`<div class="path-gait" role="group" aria-label="沿路径动作类型"><button type="button" data-path-gait="walk">沿路径行走</button><button type="button" data-path-gait="run">沿路径奔跑</button></div>${o.type==='model'?`<label class="field">骨骼动作<select id="walkClip"><option value="" disabled ${chosen?'':'selected'}>请选择对应的原地循环动作</option>${clips.map(c=>`<option value="${esc(c.name)}" ${c.name===chosen?'selected':''}>${esc(clipLabel(c.name))}</option>`).join('')}</select></label><p id="pathClipNotice" class="help-text"></p>`:''}${rangeFields(existing?.start??range.start,existing?.end??range.end)}<div class="row"><label class="field grow">步频 / 倍速<input id="walkSpeed" type="number" min=".1" max="4" step=".1" value="${existing?.speed||1}"></label><label class="field grow">朝向修正 / °<input id="walkHeading" type="number" min="-180" max="180" step="1" value="${existing?.headingOffset||0}"></label></div><section id="pathConflict" class="path-conflict" hidden aria-label="重叠动作处理"><strong id="pathConflictTitle"></strong><ul id="pathConflictList"></ul><button type="button" id="replaceWalk" aria-pressed="false">替换重叠动作</button><p>仅替换所选时间内的动作，区间外部分保留。可撤销。</p></section><p class="help-text">自动沿位置与贝塞尔路径转向。位移速度由位置关键帧决定，切换奔跑不会改变到达时间。背对路径时将朝向修正设为 180°。请使用原地循环动作。</p>`,`${existing?'<button id="removeWalk" class="danger">删除动作片段</button>':''}<button id="saveWalk" class="primary">${existing?'保存修改':'添加到时间轴'}</button>`);
 const readRange=()=>({id:existing?.id,start:snapTime(+$('#presetStart').value,p.fps,p.duration),end:snapTime(+$('#presetEnd').value,p.fps,p.duration)});
 const refreshConflicts=()=>{
 const overlaps=overlappingPathActions(o,readRange());$('#pathConflict').hidden=!overlaps.length;
 if(!overlaps.length)replace=false;
 $('#pathConflictTitle').textContent=`当前时间范围与 ${overlaps.length} 段已有动作重叠`;
 $('#pathConflictList').innerHTML=overlaps.map(a=>`<li>${esc(a.clip?clipLabel(a.clip):poses[a.pose])}<span>${a.start.toFixed(2)}–${a.end.toFixed(2)} 秒</span></li>`).join('');
 $('#replaceWalk').textContent=replace?'✓ 已选择替换 · 点击取消':`替换这 ${overlaps.length} 段重叠动作`;
 $('#replaceWalk').setAttribute('aria-pressed',String(replace));$('#pathConflict').classList.toggle('confirmed',replace);
 $('#saveWalk').disabled=!!overlaps.length&&!replace;
 $('#saveWalk').textContent=replace?(existing?'替换并保存':'替换并添加到时间轴'):(existing?'保存修改':'添加到时间轴');
 };
 const refreshKind=()=>{
 $$('[data-path-gait]').forEach(b=>{const on=b.dataset.pathGait===kind;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
 if($('#pathClipNotice')){$('#pathClipNotice').textContent=!$('#walkClip').value?`未找到可自动匹配的${kind==='run'?'跑步':'行走'}动作，请手动选择模型自带动作。`:'';$('#pathClipNotice').hidden=!!$('#walkClip').value;}
 };
 $$('[data-path-gait]').forEach(b=>b.onclick=()=>{if(kind===b.dataset.pathGait)return;kind=b.dataset.pathGait;if($('#walkClip'))$('#walkClip').value=preferred()?.name||'';refreshKind()});
 if($('#walkClip'))$('#walkClip').onchange=refreshKind;
 $('#replaceWalk').onclick=()=>{replace=!replace;refreshConflicts()};
 for(const id of ['presetStart','presetEnd'])$('#'+id).oninput=()=>{replace=false;refreshConflicts()};
 refreshKind();refreshConflicts();
 if(existing)$('#removeWalk').onclick=()=>{checkpoint();o.actions=o.actions.filter(a=>a.id!==existing.id);timelineSelection=null;closeModal();commit();renderProperties()};
 $('#saveWalk').onclick=()=>{
 if(o.type==='model'&&!clips.some(c=>c.name===$('#walkClip').value))return toast(`请先选择一个${kind==='run'?'跑步':'行走'}动作`);
 const a={...readRange(),id:existing?.id||uid(),...(o.type==='model'?{clip:$('#walkClip').value,idleClip:preferredIdleClip(clips)}:{pose:kind}),gait:kind,speed:+$('#walkSpeed').value,followPath:true,headingOffset:+$('#walkHeading').value};
 let actions;try{actions=pathWalkActions(o,a,p.duration,replace)}catch(e){return toast(e.message)}
 checkpoint();o.actions=actions;closeModal();select(o.id);timelineSelection={kind:'action',objectId:o.id,actionId:a.id};commit();setTime(a.start);revealTimelineSelection();renderProperties();toast(`沿路径${kind==='run'?'奔跑':'行走'}已加入时间轴，点击播放即可预览`);
 };
}
function modelClipModal(o,clipName,existing){
 if(o.locked)return toast('对象已锁定');
 const clips=(stage?.meshes.get(o.id)?.userData.clips||[]).filter(c=>Number.isFinite(c.duration)&&c.duration>=0),source=clips.find(c=>c.name===clipName);if(!source)return toast('模型动作尚未加载或不存在');
 let start=existing?.start??Math.min(time,p.duration-1/p.fps);
 if(!existing)for(const a of [...(o.actions||[])].sort((a,b)=>a.start-b.start))if(start>=a.start&&start<a.end)start=a.end;
 if(start>=p.duration)return toast('动作已到工程末尾，请先移动播放头或增加工程时长');
 const limit=Math.min(p.duration,...(o.actions||[]).filter(a=>a.id!==existing?.id&&a.start>start).map(a=>a.start));
 const end=existing?.end??Math.min(limit,snapTime(start+Math.max(source.duration,1/p.fps),p.fps,p.duration));
 modal(existing?'编辑模型动作片段':'添加模型动作',esc(o.name)+' · '+esc(clipLabel(clipName)),`<label class="field">骨骼动作<select id="modelClipChoice">${clips.map(c=>`<option value="${esc(c.name)}" ${c.name===clipName?'selected':''}>${esc(clipLabel(c.name))}</option>`).join('')}</select></label><label class="field">片段模式<select id="modelClipMode"><option value="play">播放动作</option><option value="hold" ${existing?.mode==='hold'?'selected':''}>定格姿势</option></select></label>${rangeFields(start,end)}<label class="field" id="modelSpeedField">播放速度<input id="modelClipSpeed" type="number" min=".1" max="4" step=".1" value="${existing?.speed||1}"></label><div id="modelHoldFields"><label class="field">动作源帧（从 0 开始）<input id="modelHoldFrame" type="number" min="0" step="1" value="${Math.round((existing?.holdTime||0)*p.fps)}"></label><input id="modelHoldSlider" aria-label="选择定格姿势帧" type="range" min="0" step="1"><p id="modelHoldInfo" class="help-text"></p><button id="modelHoldCurrent">取当前播放帧</button><p class="muted">实时姿势预览 · 拖动滑块或输入帧数即可查看</p><img id="modelHoldPreview" hidden alt="所选动作帧的机位预览" style="width:100%;max-height:220px;object-fit:contain;margin-top:10px"></div><p class="help-text" id="modelActionHelp"></p>`,`${existing?'<button id="removeModelClip" class="danger">删除片段</button>':''}<button id="saveModelClip" class="primary">${existing?'保存修改':'添加到时间轴'}</button>`);
 const currentClip=()=>clips.find(c=>c.name===$('#modelClipChoice').value);
 const updateHold=()=>{const clip=currentClip(),last=holdFrameLimit(clip.duration,p.fps),frame=Math.max(0,Math.min(last,Math.round(Number($('#modelHoldFrame').value)||0)));$('#modelHoldFrame').max=last;$('#modelHoldFrame').value=frame;$('#modelHoldSlider').max=last;$('#modelHoldSlider').value=frame;$('#modelHoldInfo').textContent=`第 ${frame} 帧 / ${last} 帧 · 动作内 ${holdFrameTime(frame,clip.duration,p.fps).toFixed(3)} 秒 · 按工程 ${p.fps} fps 选帧`};
 const image=$('#modelHoldPreview');let previewRequest=0;
 const queuePreview=()=>{if(previewRequest)return;previewRequest=requestAnimationFrame(()=>{previewRequest=0;if(!image.isConnected||$('#modelClipMode').value!=='hold')return;
  const raw=$('#modelHoldFrame').value,frame=Number(raw),at=Number($('#presetStart').value),clip=currentClip();if(!raw.trim()||!Number.isFinite(frame)||!Number.isFinite(at)||at<0||at>p.duration)return;
  const previous=stage.paramPreview;
  try{const sourceTime=holdFrameTime(Math.max(0,Math.min(holdFrameLimit(clip.duration,p.fps),Math.round(frame))),clip.duration,p.fps);stage.paramPreview={id:o.id,state:{...sampleObject(o,at),modelClip:clip.name,actionTime:sourceTime}};image.src=stage.screenshot(at,override,{previewWidth:640});image.hidden=false;}catch(e){toast(e.message)}finally{stage.paramPreview=previous;stage.apply(time)}
 })};
 const updateMode=()=>{const hold=$('#modelClipMode').value==='hold';$('#modelSpeedField').hidden=hold;$('#modelHoldFields').hidden=!hold;$('#modelActionHelp').textContent=hold?'所选姿势在片段起止时间内保持不动，人物走位与镜头仍可运动。拖动两端只改变保持时长。结束后接下一片段或恢复片段外默认动作，不自动续播源动作。':'动作按所设速度循环，不改变场景走位。拖动两端改变持续时长；片段结束后恢复片段外默认动作。';updateHold();queuePreview()};
 $('#modelClipMode').onchange=updateMode;
 $('#modelClipChoice').onchange=()=>{updateHold();queuePreview()};
 $('#modelHoldFrame').oninput=()=>{const frame=Number($('#modelHoldFrame').value),clip=currentClip();if($('#modelHoldFrame').value.trim()&&Number.isInteger(frame)&&frame>=0&&frame<=holdFrameLimit(clip.duration,p.fps)){$('#modelHoldSlider').value=frame;$('#modelHoldInfo').textContent=`第 ${frame} 帧 · 动作内 ${holdFrameTime(frame,clip.duration,p.fps).toFixed(3)} 秒 · 按工程 ${p.fps} fps 选帧`;}queuePreview()};
 $('#modelHoldFrame').onchange=()=>{updateHold();queuePreview()};
 $('#modelHoldFrame').addEventListener('blur',()=>{updateHold();queuePreview()});
 $('#modelHoldSlider').oninput=()=>{$('#modelHoldFrame').value=$('#modelHoldSlider').value;updateHold();queuePreview()};
 $('#presetStart').addEventListener('input',queuePreview);
 $('#presetStart').addEventListener('blur',queuePreview);
 $('#modelHoldCurrent').onclick=()=>{const s=sampleObject(o,time),clip=currentClip();if(s.modelClip!==clip.name)return toast('当前人物播放的不是所选动作，请先选择相应动作');const t=s.actionTime??time;$('#modelHoldFrame').value=clip.duration===0?0:Math.round((t%clip.duration)*p.fps);updateHold();queuePreview()};
 updateMode();
 if(existing)$('#removeModelClip').onclick=()=>{checkpoint();o.actions=o.actions.filter(a=>a.id!==existing.id);timelineSelection=null;closeModal();commit();renderProperties()};
 $('#saveModelClip').onclick=()=>{const hold=$('#modelClipMode').value==='hold',a={id:existing?.id||uid(),clip:$('#modelClipChoice').value,start:Math.round(+$('#presetStart').value*p.fps)/p.fps,end:Math.round(+$('#presetEnd').value*p.fps)/p.fps,speed:hold?1:+$('#modelClipSpeed').value};
  try{if(hold){a.mode='hold';a.holdTime=holdFrameTime(+$('#modelHoldFrame').value,currentClip().duration,p.fps)}actionRange(o,a,p.duration);if(!Number.isFinite(a.speed)||a.speed<.1||a.speed>4)throw Error('速度须为 0.1–4 倍');if(!existing&&(o.actions?.length||0)>=500)throw Error('动作片段已达 500 个');}catch(e){return toast(e.message)}
  checkpoint();o.actions=(o.actions||[]).filter(v=>v.id!==a.id).concat(a).sort((a,b)=>a.start-b.start);closeModal();select(o.id);timelineSelection={kind:'action',objectId:o.id,actionId:a.id};commit();setTime(a.start);revealTimelineSelection();toast(hold?'定格姿势已加入时间轴，拖动两端调整保持时长':'模型动作已加入时间轴，拖动两端即可调整时长');
 };
}

function addModelNode(name,src,size,at){if(p.nodes.length>=500)throw Error('画布节点已达上限，请先删除不需要的节点');const n=asset('model',{title:name||'本地 3D 模型',text:'本地导入的 3D 模型（GLB）。\n拖线到导演台节点即可加入场景；选中节点可在右侧加入导演台。',modelSrc:src,modelSize:size,modelKind:'scene',...(at?{x:at.x,y:at.y}:{})});p.nodes.push(n);return n}
function insertModelNode(name,src,size,at){if(p.nodes.length>=500){toast('画布节点已达上限，请先删除不需要的节点');return}checkpoint();let n;try{n=addModelNode(name,src,size,at)}catch(e){toast(e.message);return}filter='all';closeModal();if(mode!=='board')setMode('board');commit(true);select(n.id);toast('已创建 3D 模型节点，拖线接入导演台 ↗');return n}
function insertModel(name,src,size){if(p.objects.length>=300){toast('场景对象已达 300 个');return}checkpoint();const o=object('model',name);o.modelSrc=src;o.modelSize=size;const assetInfo=assetCatalog.find(a=>(a.file.startsWith('/assets/')?a.file:'/assets/'+a.file)===src);if(assetInfo?.defaultClip)o.modelClip=assetInfo.defaultClip;else if(assetInfo?.proportions==='realistic'&&assetInfo.animations?.some(c=>c.name==='idle'))o.modelClip='idle';p.objects.push(o);p.objects.filter(x=>x.type!=='camera').forEach(x=>x.solo=false);focusAfterLoad=o.id;closeModal();if(mode!=='stage')setMode('stage');commit(true);select(o.id);toast('模型已加入场景，正在读取本地资源');}
async function readGLBFile(file){const verdict=classifyImportFile(file);if(!verdict.ok)throw Error(verdict.error);if(verdict.kind!=='glb')throw Error('请选择 GLB 格式的 3D 模型文件');const buffer=await file.arrayBuffer();checkGLB(buffer);const src=await readDataURL(new Blob([buffer],{type:'model/gltf-binary'}));return {name:file.name.replace(/\.glb$/i,''),src}}
$('#modelFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const {name,src}=await readGLBFile(f);if(mode==='board')insertModelNode(name,src,2);else insertModel(name,src,2);}catch(err){toast(err.message)}};
function editBezier(o,kind=null,focus=true){
 if(o.locked)return toast('对象已锁定');stop();const t=stage.pathSelection?.id===o.id?stage.pathSelection.t:time;
 let handles;try{handles=pathHandleDefaults(o,t);}catch(e){return toast(e.message);}
 if(!o.pathHandles?.some(k=>Math.abs(k.t-t)<.0001)){checkpoint();const position=sampleObject(o,t).position;['positionX','positionY','positionZ'].forEach((key,i)=>addParameterKey(o,key,t,position[i]));o.pathHandles=(o.pathHandles||[]).concat(handles).sort((a,b)=>a.t-b.t);commit();}
 stage.updatePaths();stage.selectPath({id:o.id,t,kind:kind||(positionTimes(o).some(v=>v>t)?'out':'in')});setTime(t);if(focus)stage.frameSelection();
}
function renderPathControls(){
 const bar=$('#pathControls'),data=stage?.pathSelection,o=p.objects.find(o=>o.id===data?.id);bar.classList.toggle('hidden',mode!=='stage'||!o||!!o.locked);if(!o)return;
 $$('[data-transform]').forEach(b=>{const on=b.dataset.transform==='translate';b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});const times=positionTimes(o);bar.innerHTML=`<span>${data.t.toFixed(2)}s</span>${[['point','位置'],['in','入柄'],['out','出柄']].map(([kind,label])=>`<button data-path-kind="${kind}" aria-pressed="${data.kind===kind}" class="${data.kind===kind?'active':''}" ${kind==='in'&&!times.some(t=>t<data.t)||kind==='out'&&!times.some(t=>t>data.t)?'disabled':''}>${label}</button>`).join('')}<button id="exitPathEdit" title="返回对象 XYZ 移动，也可按快捷键 1">移动对象</button>`;
 $$('[data-path-kind]').forEach(b=>b.onclick=()=>{if(b.dataset.pathKind==='point'){stage.selectPath({...data,kind:'point'});renderPathControls();}else editBezier(o,b.dataset.pathKind,false);});
 $('#exitPathEdit').onclick=()=>{stage.mode('translate');renderPathControls();};
}
function bezierModal(o){
 if(o.locked)return;const t=time,s=sampleObject(o,t),times=positionTimes(o);if(times.length<2){toast('请先在两个不同时间添加位置关键帧，再编辑贝塞尔路径');return;}
 const old=o.pathHandles?.find(k=>Math.abs(k.t-t)<.0001),prev=sampleObject(o,times.filter(v=>v<t).at(-1)??t).position,next=sampleObject(o,times.find(v=>v>t)??t).position;
 const into=old?.in||prev.map((v,i)=>(v-s.position[i])/3),out=old?.out||next.map((v,i)=>(v-s.position[i])/3);
 modal('贝塞尔路径手柄',`${esc(o.name)} · ${t.toFixed(2)} 秒。手柄数值是相对关键位置的偏移；场景中可以直接拖动。`,`${vecFields('入柄偏移 / 米','bezierIn',into)}${vecFields('出柄偏移 / 米','bezierOut',out)}<p class="help-text">贝塞尔控制空间曲线，此区间按时间匀速推进曲线参数；其他未设置手柄的区间保留原过渡。可在任意时间插入路径点。</p>`,`<button id="removeBezier">移除此点的曲线手柄</button><button class="primary" id="saveBezier">保存并显示手柄</button>`);
 $('#removeBezier').onclick=()=>{checkpoint();o.pathHandles=(o.pathHandles||[]).filter(k=>Math.abs(k.t-t)>.0001);closeModal();stage.updatePaths();commit();};
 $('#saveBezier').onclick=()=>{const read=key=>$$(`[data-vector="${key}"]`).map(e=>e.valueAsNumber),a=read('bezierIn'),b=read('bezierOut');if([...a,...b].some(v=>!Number.isFinite(v)||Math.abs(v)>1000)){toast('请输入 -1000 至 1000 的数值');return}checkpoint();['positionX','positionY','positionZ'].forEach((id,i)=>addParameterKey(o,id,t,s.position[i]));o.pathHandles=(o.pathHandles||[]).filter(k=>Math.abs(k.t-t)>.0001).concat({t,in:a,out:b}).sort((a,b)=>a.t-b.t);closeModal();stage.updatePaths();commit();stage.selectPath({id:o.id,t,kind:positionTimes(o).some(v=>v>t)?'out':'in'});renderProperties();};
}
function connectionTargetModal(nodeId,port){
 const source=p.nodes.find(n=>n.id===nodeId);if(!source)return;const project=p;
 const candidates=p.nodes.filter(n=>n.id!==nodeId&&!p.edges.some(e=>port==='out'?e.from===nodeId&&e.to===n.id:e.from===n.id&&e.to===nodeId));
 modal(port==='out'?'连接到节点':'选择来源节点','连线建立参考关系，不会自动调用生成服务。3D 模型连入导演台时会加入当前工程共享场景。',`<label class="field">${port==='out'?'目标节点':'来源节点'}<select id="connectionTarget" ${candidates.length?'':'disabled'}>${candidates.map(n=>`<option value="${esc(n.id)}">${esc(n.title)} · ${esc(nodePresentation(p,n).label)}</option>`).join('')}</select></label>${candidates.length?'':'<p class="help-text">暂无可连接的节点，请先新建其他节点。</p>'}`,`<button id="cancelConnection">取消</button><button class="primary" id="confirmConnection" ${candidates.length?'':'disabled'}>建立连线</button>`);
 $('#cancelConnection').onclick=closeModal;$('#confirmConnection').onclick=()=>{if(p!==project)return;const target=$('#connectionTarget').value;closeModal();connectBoardEdge(port==='out'?{from:nodeId,to:target}:{from:target,to:nodeId});};
}
function connectBoardEdge(edge){
 checkpoint();try{const result=connectCanvasNodes(p,edge);if(result.imported)p.objects.filter(o=>o.type!=='camera').forEach(o=>o.solo=false);commit(result.imported);renderProperties();toast(result.objectId?'已连接并接入导演台；双击导演台节点查看，重复连接不会复制模型':'参考连线已建立；从节点操作中选择生成，不会自动调用模型');}
 catch(e){p=history.pop();updateUndo();toast(e.message);}
}
function connectNewDirector(n){
 if(p.nodes.length>=500)return toast('画布节点已达上限');
 checkpoint();try{const director=asset('director',{title:n.title+' · 3D 导演台',text:'连入模型后即可在导演台使用。此节点打开当前工程共享场景。',...freeNodePosition(p.nodes,{x:n.x+n.w+380,y:n.y,w:280,h:260},n=>nodeHeights.get(n.id)||n.h||260)});p.nodes.push(director);const result=connectCanvasNodes(p,{from:n.id,to:director.id});if(result.imported)p.objects.filter(o=>o.type!=='camera').forEach(o=>o.solo=false);filter='all';commit(result.imported);select(director.id);fitBoard();toast('已新建导演台节点并连接；双击进入');}
 catch(e){p=history.pop();updateUndo();toast(e.message);}
}
function imageForModel(n,purpose){
 const hint=purpose==='scene'?'生成适合 3D 建模的场景参考图，突出一处建筑或局部场景，结构清晰。':'生成适合 3D 建模的角色参考图，可以是人物、动物或怪物；单个主体，全身完整，四肢清楚，干净背景。';
 aiImageModal(n,{promptOverride:(n.text||n.title)+'\n\n'+hint});
}
function duplicateCanvasNode(n){ // 单节点复制语义与多选复制统一：安全副本 + 解除工程对象绑定
 if(!p.nodes.some(v=>v.id===n.id))return;
 select(n.id);duplicateBoardSelection();
}
function nodeMoreMenu(n,x,y){
 const shown=new Set(visibleNodeActions(p,n).map(a=>a.id));
 const items=nodeQuickActions(p,n).filter(a=>!shown.has(a.id)).map(a=>({label:a.label,run:()=>runNodeQuickAction(n,a.id)}));
 if(n.src&&['image','video','audio'].includes(n.type))items.push({label:'替换素材',run:()=>runNodeQuickAction(n,'import')});
 if(!shown.has('content'))items.push({label:'编辑名称与说明',run:()=>editCanvasNode(n.id)});
 items.push({label:'复制节点',run:()=>duplicateCanvasNode(n)});
 showContextMenu($('#contextMenu'),{x,y,title:n.title,items});
}
function nodeContextMenu(n,x,y){
 select(n.id);const items=[],imagePresent=n.type==='image'&&!!n.src;
 const leaf=(label,run,disabled=false,hint)=>({label,run,disabled,hint});
 const context=getCanvasStoryContext(p,n.id);
 if(n.type==='video'&&n.src)items.push(...nodeQuickActions(p,n).filter(a=>['frames','trim','audio','depth','mute','compatibility'].includes(a.id)).map(a=>leaf(a.label,()=>runNodeQuickAction(n,a.id))));
 if(['text','image','video','audio'].includes(n.type))items.push(leaf('整理为镜头组',()=>bundleBoardShot([n.id])));
 if(n.src&&['image','video','audio'].includes(n.type))items.push(leaf('预览素材',()=>mediaNodePanel(n)));
 if(['text','actor','scene'].includes(n.type))items.push(leaf('创作用途模板',canvasTemplatesModal));
 if(['text','image','video','audio','actor','scene'].includes(n.type))items.push(leaf('生成视频',()=>providerVideoModal(n)));
 if(context?.kind==='script')items.push(leaf('编辑剧本参考',()=>scriptReferenceModal()));
 else if(context?.kind==='shot')items.push(leaf('编辑这个分镜',()=>openNodeTool(n.id)));
 else if(context)items.push(leaf('管理资产图片与版本',()=>openNodeTool(n.id)));
 else if(n.type==='text')items.push(leaf('用作项目剧本',()=>promoteNodeScript(n.id)));
 if(['text','scene','actor','image'].includes(n.type))items.push({label:'生成参考图片',children:[leaf('场景参考图',()=>imageForModel(n,'scene')),leaf('角色参考图 · 人物 / 动物 / 怪物',()=>imageForModel(n,'actor'))]});
 if(['text','actor','scene'].includes(n.type))items.push(leaf('打开离线模型库',libraryModal));
 if(n.type==='model'||n.objectId||n.sceneObjectIds?.length){
  const directors=p.nodes.filter(v=>v.type==='director'&&v.id!==n.id);
  items.push({label:'连接到 3D 导演台',children:[...directors.map(d=>leaf((p.edges.some(e=>e.from===n.id&&e.to===d.id)?'✓ ':'')+d.title,()=>connectBoardEdge({from:n.id,to:d.id}))),leaf('＋ 新建导演台并连接',()=>connectNewDirector(n))]});
 }
 if(n.type==='model')items.push({label:'模型操作',children:[leaf('在导演台查看 / 调整',()=>enterGeneratedModel(n)),leaf('文字动作 · 骨骼检查',()=>{let o=p.objects.find(o=>o.id===n.objectId);if(o){setMode('stage');select(o.id);}else{enterGeneratedModel(n);o=p.objects.find(o=>o.id===n.objectId);}if(o)modelMotionModal(o);}),leaf('下载模型 GLB',()=>download(n.modelSrc,n.title+'.glb'))]});
 if(n.type==='director'){
  items.push({label:'导演台操作',children:[leaf('进入 3D 导演台',()=>setMode('stage')),leaf('导出预演 / 单机位',exportModal),leaf('截取当前机位到画布',capture)]});
  const models=p.nodes.filter(v=>v.type==='model');items.push({label:'接入已有 3D 模型',children:models.length?models.map(m=>leaf((p.edges.some(e=>e.from===m.id&&e.to===n.id)?'✓ ':'')+m.title,()=>connectBoardEdge({from:m.id,to:n.id}))):[leaf('导入 GLB 模型',()=>$('#modelFile').click())]});
 }
 if(['image','video','audio'].includes(n.type))items.push({label:'素材操作',children:[leaf('导入 / 替换'+labels[n.type],()=>{mediaTarget=n.id;$('#mediaFile').accept=n.type+'/*';$('#mediaFile').click();}),leaf('下载素材',()=>download(n.src,mediaFileName(n)),!n.src)]});
 if(['video','audio'].includes(n.type)&&n.src)items.push({label:'送入剪辑时间线',children:[leaf(n.type==='video'?'导入媒体库并追加到 V1':'导入媒体库并追加到 A1',()=>wsShell?.sendCanvasNodeToEdit(n.id))]});
 items.push({label:'节点操作',children:[leaf('编辑名称与描述',()=>editCanvasNode(n.id)),leaf('复制节点',()=>duplicateCanvasNode(n)),leaf('断开此节点的全部连线',()=>{checkpoint();p.edges=p.edges.filter(e=>e.from!==n.id&&e.to!==n.id);commit();toast('连线已断开；导演台中已有的对象保留');}),leaf('删除节点',deleteSelected)]});
 showContextMenu($('#contextMenu'),{x,y,title:labels[n.type]+' · '+n.title,items});
}
function arrangeBoard(){
 if(!p.nodes.length)return toast('画布还没有节点');
 filter='all';renderBoard();
 const positions=planCanvasArrangement(p,nodeHeightOf);
 const changed=positions.some(pos=>{const node=p.nodes.find(n=>n.id===pos.id);return Math.abs(node.x-pos.x)>.01||Math.abs(node.y-pos.y)>.01;});
 if(changed){checkpoint();for(const pos of positions){const node=p.nodes.find(n=>n.id===pos.id);node.x=pos.x;node.y=pos.y;}}
 filter='all';commit();fitBoard();toast(changed?'已整理画布，保留分组与连线；可撤销恢复原布局':'画布已整理');
}
$('#board').addEventListener('contextmenu',e=>{
 if(e.target.closest('input,textarea,.shot-checklist'))return;e.preventDefault();
 const groupTitle=e.target.closest('.board-group-title');
 if(groupTitle){const g=(p.boardGroups||[]).find(v=>v.id===groupTitle.dataset.groupTitle);if(g){setBoardSelection(bundleMemberIds(p,g));showContextMenu($('#contextMenu'),{x:e.clientX,y:e.clientY,title:'分组 · '+g.name,items:[{label:'选中整组',run:()=>setBoardSelection(bundleMemberIds(p,g))},{label:g.collapsed?'展开全部':'收成一张卡片',run:()=>toggleGroupCollapse(g.id)},{label:'查看组内节点',run:()=>groupNodeList(g.id)},{label:'重命名分组',run:()=>renameGroupModal(g)},{label:'解组（保留节点与连线）',run:ungroupBoardSelection}]});return}}
 const el=e.target.closest('.node');if(el){const n=p.nodes.find(n=>n.id===el.dataset.id);if(n)nodeContextMenu(n,e.clientX,e.clientY);return;}
 const r=$('#board').getBoundingClientRect(),x=(e.clientX-r.left-p.board.x)/p.board.zoom,y=(e.clientY-r.top-p.board.y)/p.board.zoom;
 const creationNames={text:'文本',image:'图片',video:'视频',audio:'音频',scene:'场景设定',actor:'角色设定',director:'3D 导演台'};
 const items=[{label:'≡ 新建项目剧本',run:()=>createScriptNode({x,y})},...['text','image','video','audio','scene','actor','director'].map(type=>({label:icons[type]+' 新建'+creationNames[type],run:()=>{if(p.nodes.length>=500)return toast('画布节点已达上限');checkpoint();const n=asset(type,{...freeNodePosition(p.nodes,{x,y,w:280,h:260},n=>nodeHeights.get(n.id)||n.h||260),text:type==='director'?'此节点打开当前工程共享的 3D 场景；其他导演台入口打开同一场景。':''});p.nodes.push(n);filter='all';commit();select(n.id);}})),{label:'▤ 流程模板…',run:()=>canvasTemplatesModal({x,y})},{label:'▦ 整理画布',run:arrangeBoard,disabled:!p.nodes.length}];
 showContextMenu($('#contextMenu'),{x:e.clientX,y:e.clientY,title:'画布',items});
});
const resizeNodeOverlayViewport=()=>{const panel=$('.node-tool-panel');if(panel)framedNodePanels.delete(panel);refreshNodeOverlays();};
window.addEventListener('resize',resizeNodeOverlayViewport);new ResizeObserver(resizeNodeOverlayViewport).observe($('#board'));
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#contextMenu'))$('#contextMenu').classList.add('hidden')});

function helpModal(){
 modal(t('help.title'),t('help.subtitle'),`<div class="help-guide">
 <section><h3>${t('help.canvasTitle')}</h3><p>${t('help.canvasP1')}</p><p>${t('help.canvasP2')}</p><p>${t('help.canvasP3')}</p></section>
 <section><h3>${t('help.directorTitle')}</h3><p>${t('help.directorP1')}</p><p>${t('help.directorP2')}</p><p>${t('help.directorP3')}</p></section>
 <section><h3>${t('help.produceTitle')}</h3><p>${t('help.produceP1')}</p><p>${t('help.produceP2')}</p><p>${t('help.produceP3')}</p></section>
 <details><summary>${t('help.shortcuts')}</summary><div class="help-guide-details"><p>画布：V 选择，H 抓手；空白拖拽框选，Shift 或 ${K}+点击加选；按住 Space 临时平移；滚轮缩放，F 适应。${K}+C / V 复制粘贴，${K}+D 复制节点，${K}+G 编组。方向键微调，Shift 十倍。选中连线后 Delete 剪断，Esc 取消当前操作。</p><p>导演台：0 / 1 / 2 / 3 选择、移动、旋转、缩放；WASD 移动，QE 升降；IJKL 或左拖转向，右拖平移；Alt＋滚轮调整导演视角，F 聚焦，G 落地。导演视角导航不会修改拍摄机位。Space 播放暂停，${K}+Z / ${K}+Shift+Z 撤销重做，${K}+S 保存。</p><p>时间轴：Alt＋滚轮以指针为中心缩放，Shift＋滚轮横移，中键平移。「适应全部」可返回细节；手动横滚暂停跟随，「播放杆」可找回当前位置。Delete 删除所选关键帧或动作。</p><p>图片、视频、音频每个不超过 25 MB，GLB 不超过 40 MB。批量导入逐项报告失败，成功部分保留。云端图片转 3D 接口已移除；模型动作跨骨架使用仍需外部重定向。未提交草稿的保存方式以所在面板提示为准。</p></div></details>
 </div>`,`<button id="canvasKeysLink">${t('help.canvasKeys')}</button>`);
 $('#canvasKeysLink').onclick=()=>canvasShortcutsModal();
}
const readDataURL=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(f)});
// Shared media importer for the toolbar button, per-node replace and drops.
// One checkpoint per batch so a single undo reverts the whole import.
async function importMediaBatch(files,{target=null,at=null}={}){
 const projectId=p.id,entries=[],errors=[];
 for(const f of files){
  const verdict=classifyImportFile(f);
  if(!verdict.ok){errors.push(verdict.error);continue}
  if(verdict.kind==='glb'){errors.push(`「${f.name}」是 3D 模型，请从离线模型库导入或直接拖到画布`);continue}
  if(target&&target.type!==verdict.kind){errors.push(`「${f.name}」与「${labels[target.type]}」节点类型不匹配，已跳过`);continue}
  entries.push({file:f,kind:verdict.kind,mime:verdict.mime});
 }
 const loaded=[];
 for(const entry of entries){try{entry.src=await readMediaFile(entry.file,entry.mime);loaded.push(entry)}catch{errors.push(`「${entry.file.name}」读取失败`)}} // 替换模式沿用第一个读取成功的文件
 if(managerOpen||transitioning||p.id!==projectId){toast('工程已切换，本次导入已取消');return 0}
 if(!loaded.length){if(errors.length)toast(errors.join('；'));return 0}
 if(target){target=p.nodes.find(n=>n.id===target.id);if(!target||target.type!==loaded[0].kind){toast('目标素材已删除或类型已变化，本次替换已取消');return 0}}
 if(!target&&p.nodes.length>=500){toast('画布节点已达上限，本次导入未添加');return 0}
 checkpoint();
 let added=0,lastNode=null;
 if(target){target.src=loaded[0].src;target.title=loaded[0].file.name;delete target.mediaId;added=1;}
 else{
  const origins=at?staggeredNodeOrigins(loaded.length,{x:at.x-140,y:at.y-30}):null;
  for(const [i,entry] of loaded.entries()){
   if(p.nodes.length>=500){errors.push(`画布节点已达上限，剩余 ${loaded.length-i} 个未导入`);break}
   lastNode=asset(entry.kind,{title:entry.file.name,text:'本地导入的参考素材',src:entry.src,...(origins?{x:origins[i].x,y:origins[i].y}:{x:80+added*310,y:80})});p.nodes.push(lastNode);added++;
  }
 }
 if(added){filter='all';if(mode!=='board')setMode('board');commit();if(target)select(target.id);else if(at&&lastNode)select(lastNode.id);else fitBoard();}
 toast(added?`已导入 ${added} 个素材${errors.length?`；${errors.join('；')}`:''}`:errors.join('；'));
 return added;
}
$('#mediaFile').onchange=async e=>{const files=[...e.target.files];e.target.value='';if(!files.length)return;const target=p.nodes.find(n=>n.id===mediaTarget);mediaTarget=null;await importMediaBatch(files,{target})};
// ---- Finder 文件拖入画布：图片 / 视频 / 音频 / GLB 混合批次 ----
function summarizeDropErrors(errors){const shown=errors.slice(0,3).join('；');return errors.length>3?`${shown} 等 ${errors.length} 项未导入`:`${shown}，未导入`;}
async function readMediaFile(file,mime){ // 以解析出的具体 MIME 重建 data URL，空 / 通用 MIME 文件导入后才能通过工程校验
 return readDataURL(new Blob([await file.arrayBuffer()],{type:mime}));
}
async function importDroppedBatch(files,at){
 const projectId=p.id,plan=planImportBatch(files),loaded=[];
 for(const entry of plan.media){try{entry.src=await readMediaFile(entry.file,entry.mime);loaded.push(entry)}catch{plan.errors.push(`「${entry.file.name}」读取失败`)}}
 for(const entry of plan.glbs){try{const buffer=await entry.file.arrayBuffer();checkGLB(buffer);entry.src=await readDataURL(new Blob([buffer],{type:'model/gltf-binary'}));entry.title=entry.file.name.replace(/\.glb$/i,'');loaded.push(entry)}catch(err){plan.errors.push(`「${entry.file.name}」：${err.message}`)}}
 if(managerOpen||transitioning||p.id!==projectId){toast('工程已切换，本次拖入已取消');return}
 if(!loaded.length){if(plan.errors.length)toast(summarizeDropErrors(plan.errors));return}
 checkpoint();
 const origins=staggeredNodeOrigins(loaded.length,at?{x:at.x-140,y:at.y-30}:{x:80,y:80});
 let added=0,lastNode=null;
 for(let i=0;i<loaded.length;i++){
  const entry=loaded[i];
  if(p.nodes.length>=500){plan.errors.push(`画布节点已达上限，剩余 ${loaded.length-i} 个未导入`);break}
  if(entry.kind==='glb')lastNode=addModelNode(entry.title,entry.src,2,{x:origins[i].x,y:origins[i].y}); // 画布模型节点，不自动进入导演台
  else{lastNode=asset(entry.kind,{title:entry.file.name,text:'本地导入的参考素材',src:entry.src,x:origins[i].x,y:origins[i].y});p.nodes.push(lastNode);}
  added++;
 }
 if(added){filter='all';if(mode!=='board')setMode('board');commit();if(lastNode)select(lastNode.id);}
 toast(added?`已拖入 ${added} 个节点${plan.errors.length?`；${summarizeDropErrors(plan.errors)}`:''}`:summarizeDropErrors(plan.errors));
}
async function handleDroppedFiles(files,clientX,clientY){
 if(managerOpen)return toast('请先打开一个项目，再拖入素材');
 if(transitioning)return toast('正在切换项目，请稍后再拖入素材');
 if(exporting)return toast('正在导出，请完成后再拖入素材');
 if(localWork)return toast('正在读取素材，请完成后再拖入新文件');
 if($('.modal'))return toast('请先关闭弹窗，再拖入素材');
 const at=boardPointFromClient(clientX,clientY,$('#board').getBoundingClientRect(),p.board);
 await withLocalWork(()=>importDroppedBatch(files,at));
}
const hasFileDrag=e=>!!e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files');
window.addEventListener('dragover',e=>{if(hasFileDrag(e))e.preventDefault();});
window.addEventListener('drop',e=>{if(hasFileDrag(e))e.preventDefault();}); // 画布外的文件落点不触发浏览器打开 / 导航
{
 const boardEl=$('#board');let dragDepth=0;
 boardEl.addEventListener('dragenter',e=>{if(!hasFileDrag(e))return;e.preventDefault();dragDepth++;boardEl.classList.add('drag-over');});
 boardEl.addEventListener('dragover',e=>{if(!hasFileDrag(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';});
 boardEl.addEventListener('dragleave',e=>{if(!hasFileDrag(e))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)boardEl.classList.remove('drag-over');});
 boardEl.addEventListener('drop',async e=>{
  e.preventDefault();e.stopPropagation();dragDepth=0;boardEl.classList.remove('drag-over');
  if(!hasFileDrag(e))return;
  const files=[...e.dataTransfer.files];if(!files.length)return; // 只处理文件拖拽
  await handleDroppedFiles(files,e.clientX,e.clientY);
 });
}$('#projectFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
 try{
  let raw;try{raw=JSON.parse(await f.text());}catch{return toast('文件不是有效的 JSON 工程 / 备份')}
  if(raw?.schema===BACKUP_SCHEMA){ // v1.3.0 带媒体备份：先恢复媒体库再导入工程
   if(f.size>1200*1024*1024)return toast('带媒体备份超过 1.2 GB，未导入');
   const restored=await restoreWorkstationBackup(raw,wsShell?.mediaStore);
   const added=await library.add(validateProject(restored.project));
   await manager.select(added.id);
   toast(`带媒体备份已导入（恢复 ${restored.mediaRestored}/${restored.mediaTotal} 个剪辑媒体）；同名或相同 ID 的已有工程不会被覆盖`);
   return;
  }
  if(f.size>200*1024*1024)return toast('工程超过 200 MB，未导入');
  const next=validateProject(raw);const added=await library.add(next);await manager.select(added.id);toast('项目已导入并选中；同名或相同 ID 的已有工程不会被覆盖');
 }catch(err){toast(err.message)}};
function undo(redo=false){const stack=redo?future:history,other=redo?history:future;if(!stack.length)return;stop();other.push(clone(p));p=stack.pop();const restored=restoreSelection(saveSelection({selected,timelineSelection,selectedEdge}),p,mode);selected=restored.selected;timelineSelection=restored.timelineSelection;selectedEdge=restored.selectedEdge;time=clamp(time,0,p.duration);commit(true);renderProperties();updateUndo();wsShell?.refresh()}
$('#stageNav')?.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>jumpToStage(b.dataset.stage));
$('#boardTab').onclick=()=>setMode('board');$('#stageTab').onclick=()=>setMode('stage');$('#addBtn').onclick=addAssetModal;$('#addCameraBtn').onclick=addCamera;$('#saveBtn').onclick=saveNow;$('#saveStatus').onclick=projectModal;$('#timelineDuration').onclick=()=>durationModal();$('#offlineAssetsTab').onclick=()=>libraryModal();$('#projectAssetsTab').onclick=()=>showLibraryPanel(false);function clearNodeSearch(){nodeQuery='';const el=$('#nodeSearch');if(el)el.value='';renderSidebar();}
$('#assetSearch').oninput=e=>{libraryQuery=e.target.value;renderAssetLibrary();};
$('#nodeSearch').addEventListener('input',e=>{nodeQuery=e.target.value;const clear=$('#nodeSearchClear');if(clear)clear.hidden=!nodeQuery;renderSidebar();});
$('#nodeSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('[data-board-asset]')?.click();}else if(e.key==='Escape'&&nodeQuery){e.preventDefault();clearNodeSearch();e.stopPropagation();}});
$('#nodeSearchClear').onclick=clearNodeSearch;
const versionsBatchButton=document.createElement('button');versionsBatchButton.id='sendVideoVersions';versionsBatchButton.textContent='采用镜头 → 剪辑';versionsBatchButton.onclick=()=>versions().batch();$('#workflowTemplates').after(versionsBatchButton);
$('#taskCenterBtn').onclick=modelTasksModal;$('#importGLB').onclick=()=>$('#modelFile').click();$('#clearSolo').onclick=()=>{checkpoint();p.objects.forEach(o=>o.solo=false);stage?.select(selected);commit();renderProperties()};$('#quickAdd').onclick=addAssetModal;$('#importMedia').onclick=()=>{mediaTarget=null;$('#mediaFile').accept='image/*,video/*,audio/*';$('#mediaFile').click()};$('#helpBtn').onclick=helpModal;$('#projectBtn').onclick=projectModal;$('#projectsHome').onclick=goProjects;$('#settingsBtn').onclick=settingsModal;$('#exportBtn').onclick=exportModal;$('#captureBtn').onclick=()=>withLocalWork(capture);$('#depthBtn').onclick=()=>withLocalWork(captureDepth);$('#undoBtn').onclick=()=>undo();$('#redoBtn').onclick=()=>undo(true);$('#zoomOut').onclick=()=>zoom(.85);$('#zoomIn').onclick=()=>zoom(1.15);$('#zoomLabel').onclick=fitBoard;$('#fitBoard').onclick=fitBoard;$('#focusRelations').onclick=focusCanvasRelations;$('#returnRelationView').onclick=returnCanvasRelationView;$('#projectName').value=p.name;$('#projectName').onchange=e=>{checkpoint();p.name=e.target.value.trim()||'未命名创作';persist();renderProperties()};$('#previewSelect').onchange=e=>{override=e.target.value||null;updatePlayhead()};$('#goStart').onclick=()=>{stop();setTime(0)};$('#playBtn').onclick=()=>{if(playing){stop();return}if(time>=p.duration)time=0;playing=true;followPlayhead=true;updateFollowButton();last=performance.now();$('#playBtn').textContent='Ⅱ'};$('#addKeyBtn').onclick=recordKey;$('#shotsBtn').onclick=shotsModal;$('#actionPresetBtn').onclick=()=>{const o=p.objects.find(o=>o.id===selected);o?.type==='model'?modelActionModal(o):o?.type==='actor'?actionModal():libraryModal('character-realistic');};$('#motionPresetBtn').onclick=()=>motionModal();
let viewIndex=0;$('#viewPreset').onclick=()=>{viewIndex=(viewIndex+1)%3;stage?.viewPreset(['perspective','top','front'][viewIndex]);$('#viewPreset').textContent=['透视 ▾','顶视 ▾','正视 ▾'][viewIndex]};$('#frameSelection').onclick=()=>stage?.frameSelection();$$('[data-transform]').forEach(e=>e.onclick=()=>{$$('[data-transform]').forEach(b=>{b.classList.toggle('active',b===e);b.setAttribute('aria-pressed',String(b===e))});stage?.mode(e.dataset.transform);renderPathControls()});
function beginStageInteraction(id){timelineSelection=null;updateTimelineSelection();stop();if(p.objects.some(o=>o.id===id&&o.type==='camera')){override=id;renderPreviewSelect();updatePlayhead()}}
function groundSelected(){
 const o=p.objects.find(o=>o.id===selected);if(!o||o.locked||o.type==='camera')return;
 stop();const pos=stage?.groundPosition(o.id);if(pos)editObject(o,cur=>cur.position=pos);
}
$('#groundBtn').onclick=groundSelected;$('#groundBtn').disabled=true;
const editingTarget=e=>e.target instanceof Element&&e.target.closest('input,textarea,select,video,audio,[contenteditable="true"]');
document.addEventListener('keydown',e=>{
 if(managerOpen||transitioning||exporting||e.isComposing)return;
 if(timelineGesture){if(e.key==='Escape')timelineGesture.cancel();e.preventDefault();return;}
 if(boardGesture){if(e.key==='Escape')boardGesture.cancel();e.preventDefault();return;} // 画布拖拽中：Esc 取消，其余按键不劫持为编辑
 if(e.key==='Escape'&&wsShell?.tool()&&!$('.modal'))return;
 if(e.key==='Escape'){stage?.orbit.clear();timelineSelection=null;updateTimelineSelection();closeModal();selectedEdge=null;$('#contextMenu').classList.add('hidden');if(mode==='board'&&boardSelection.length){boardSelection=[];selected=null;updateBoardSelectionClasses();updateBoardToolbar();renderProperties()}renderBoard();return}
 if((e.metaKey||e.ctrlKey)&&e.code==='KeyS'&&!$('.modal')){e.preventDefault();saveNow();return;}
 if(wsShell&&!wsShell.onCanvas())return; // v1.3.0 非画布页：快捷键由工作站模块按活动页处理，编辑文本时不抢按键
 if(e.target.closest?.('[data-panel-resize]')||editingTarget(e)||$('.modal:not(.node-tool-panel)')||e.target.closest?.('.node-tool-panel,.ws-canvas-dock,.shot-checklist')||!$('#contextMenu').classList.contains('hidden'))return;
 if(e.metaKey||e.ctrlKey){
  if(e.code==='KeyZ'){e.preventDefault();if(!e.repeat)undo(e.shiftKey)}
  else if(mode==='board'&&e.code==='KeyD'){e.preventDefault();if(!e.repeat)duplicateBoardSelection()}
  else if(mode==='board'&&e.code==='KeyA'){e.preventDefault();if(!e.repeat)setBoardSelection(p.nodes.filter(n=>nodeVisible(n)).map(n=>n.id))} // 选中当前分类可见节点
  else if(mode==='board'&&e.code==='KeyG'){e.preventDefault();if(!e.repeat)(e.shiftKey?ungroupBoardSelection:groupBoardSelection)()}
  else if(mode==='board'&&['Equal','Minus','NumpadAdd','NumpadSubtract'].includes(e.code)){e.preventDefault();if(!e.repeat)boardZoomStep(e.code==='Equal'||e.code==='NumpadAdd'?1.2:1/1.2)}
  else if(e.code==='KeyD'){e.preventDefault();if(!e.repeat)$('#duplicateObject')?.click();}
  stage?.orbit.clear();return;
 }
 if(mode==='board'&&e.altKey&&['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();if(!e.repeat)navigateCanvasRelation(e.code==='ArrowLeft'?'in':'out');return;}
 if(e.altKey)return;
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();if(!e.repeat){if(mode==='stage'&&timelineSelection)deleteTimelineSelected();else if(mode==='board'&&selectedEdge&&!boardSelection.length)cutSelectedEdge();else if(mode==='board')deleteBoardSelection();else deleteSelected();}return}
 if(e.code==='KeyF'&&!e.repeat){e.preventDefault();mode==='board'?fitBoard():stage?.frameSelection();return;}
 if(mode==='board'){ // 画布专用键；编辑文字/表单/媒体焦点/弹窗/菜单已在上方排除，舞台原键盘操作不受影响
  if(e.shiftKey){
   if(e.code==='Digit1'){e.preventDefault();if(!e.repeat)fitBoard();return}
   if(e.code==='Digit2'){e.preventDefault();if(!e.repeat)focusBoardSelection();return}
   if(e.code==='Digit0'){e.preventDefault();if(!e.repeat)boardZoomTo100();return}
  }
  if(e.code==='KeyV'&&!e.repeat){e.preventDefault();setBoardTool('select');return}
  if(e.code==='KeyH'&&!e.repeat){e.preventDefault();setBoardTool('hand');return}
  if(e.code==='Space'){if(e.target.closest?.('button,a[href],select,.edge-hit'))return;e.preventDefault();beginSpaceHand();return} // 按住临时抓手；焦点在按钮等控件上时不劫持其 Space 激活
  const nudge={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.code];
  if(nudge){e.preventDefault();nudgeBoardSelection(nudge[0]*(e.shiftKey?10:1),nudge[1]*(e.shiftKey?10:1));return}
  return;
 }
 if(mode!=='stage'||!stage||stage.transform.dragging||stage.targetTransform.dragging||stage.targetDrag)return;
 if(navigationCodes.has(e.code)||(e.code||'').startsWith('Shift')){
  e.preventDefault();stage.orbit.keys.add(e.code);
  if(e.shiftKey)stage.orbit.keys.add('ShiftLeft');return;
 }
 if(e.code==='Space'){e.preventDefault();if(!e.repeat)$('#playBtn').click();return}
 const tool={Digit0:'select',Digit1:'translate',Digit2:'rotate',Digit3:'scale'}[e.code];
 if(tool){e.preventDefault();if(!e.repeat)$(`[data-transform="${tool}"]`).click();return}
 if(e.code==='KeyG'){e.preventDefault();if(!e.repeat)groundSelected();return}
 const step={ArrowUp:[2,-.1],ArrowDown:[2,.1],ArrowLeft:[0,-.1],ArrowRight:[0,.1]}[e.code];
 if(step){e.preventDefault();const o=p.objects.find(o=>o.id===selected);if(o)editObject(o,cur=>cur.position[step[0]]=clamp(cur.position[step[0]]+step[1],-1000,1000));}
});
document.addEventListener('keyup',e=>{stage?.orbit.keys.delete(e.code);if(e.code==='Space')endSpaceHand();if((e.code||'').startsWith('Shift')){stage?.orbit.keys.delete('ShiftLeft');stage?.orbit.keys.delete('ShiftRight')}});
window.addEventListener('blur',()=>{stage?.orbit.clear();endSpaceHand()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stage?.orbit.clear();endSpaceHand()}});
document.addEventListener('focusin',e=>{if(editingTarget(e)){stage?.orbit.clear();endSpaceHand()}});
window.addEventListener('beforeunload',e=>{try{saveWorkspaceUI(true)}catch{};if(dirty||exporting){e.preventDefault();e.returnValue=''}});
function ensureStage(){if(stage){stage.rebuild(p);return;}
try{stage=new Stage($('#stage'),$('#preview'),id=>{stop();select(id);renderTracks()},(id,pos,rot,scale,target,roll)=>{const o=p.objects.find(o=>o.id===id);if(o)editObject(o,cur=>{cur.position=pos;if(o.type!=='camera'){cur.rotationX=rot[0];cur.rotation=rot[1];cur.rotationZ=rot[2];}if(roll!==null)cur.roll=roll;cur.scale=scale;if(target)cur.target=target})},(id,target)=>{const o=p.objects.find(o=>o.id===id);if(o)editObject(o,cur=>cur.target=target)},beginStageInteraction);stage.rebuild(p);$('#renderStatus').textContent='WebGL 就绪'}catch(e){$('#renderStatus').textContent='WebGL 不可用';toast('无法初始化三维渲染，请使用支持 WebGL 的 Chrome / Edge。');console.error(e)}
if(stage){
 stage.onAssetError=(name,message)=>{toast(`${name}：${message}`);renderProperties()};stage.onAssetLoaded=(id)=>{if(selected===id)renderProperties();if(focusAfterLoad===id){focusAfterLoad=null;if(mode==='stage'&&selected===id)stage.frameSelection();toast('模型加载完成，已定位到模型；可在右侧选择离线动作')}};
 stage.onPathSelect=data=>{stop();if(data.kind!=='line')setTime(data.t);renderPathControls();};
 stage.onPathEdit=(data,pos)=>{const o=p.objects.find(o=>o.id===data.id);if(!o||o.locked)return;let draft;try{draft=draftPathEdit(o,data,pos);}catch(e){toast(e.message);stage.updatePaths();return;}checkpoint();p.objects[p.objects.indexOf(o)]=draft;stage.updatePaths();commit();setTime(data.t);};
}
}
installNumberFields(document);
timelineNav=createTimelineNav($('#tracks'),{
 onZoom(z){$('#timelineZoomLabel').textContent=Math.round(z*100)+'%';renderTracks();updateFitButton();},
 // 按钮缩放锚点：可见播放杆优先（不被左侧固定标签栏遮住才算可见），否则视口中心。
 anchorClientX(){const host=$('#tracks'),head=$('.timeline-playhead');if(!host||!head)return null;const x=parseFloat(head.style.left);if(!Number.isFinite(x))return null;const r=host.getBoundingClientRect();if(!r.width)return null;const sx=r.left+x-host.scrollLeft;return sx>=r.left+135&&sx<=r.right-8?sx:null;},
});
$('#timelineZoomIn').onclick=()=>{timelineNav.zoomIn();updateFitButton();};$('#timelineZoomOut').onclick=()=>{timelineNav.zoomOut();updateFitButton();};
$('#timelineFit').onclick=()=>{timelineNav.fitToggle();updateFitButton();};
function updateFitButton(){const s=timelineNav?.fitState?.()||{fit:true,canReturn:false};const b=$('#timelineFit');if(!b)return;b.textContent=s.fit?(s.canReturn?'↩ 返回细节':'已适应全部'):'适应全部';b.disabled=s.fit&&!s.canReturn;b.title=s.fit?(s.canReturn?'返回之前的细节缩放和滚动位置':'当前已显示全部时长'):'缩放到全部时长，并记住当前细节视图';}
function updateFollowButton(){const b=$('#followToggle');if(!b)return;b.textContent=followPlayhead?'◉ 跟随':'↩ 播放杆';b.setAttribute('aria-pressed',String(followPlayhead));b.classList.toggle('active',!followPlayhead);b.title=followPlayhead?'播放时自动滚动保持播放杆可见；手动横滚会暂停跟随':'已暂停跟随：点击回到播放杆并恢复跟随';}
$('#followToggle').onclick=()=>{followPlayhead=!followPlayhead;if(followPlayhead)revealPlayhead();updateFollowButton();};
$('#timelineLoop').onclick=()=>{loopPlayback=!loopPlayback;const b=$('#timelineLoop');b.setAttribute('aria-pressed',String(loopPlayback));b.classList.toggle('active',loopPlayback);toast(loopPlayback?'循环播放已开启：到结尾后回到开头继续，不影响导出':'循环播放已关闭');};
$('#animatedOnlyBtn').onclick=()=>{animatedOnly=!animatedOnly;const b=$('#animatedOnlyBtn');b.setAttribute('aria-pressed',String(animatedOnly));b.classList.toggle('active',animatedOnly);renderTracks();toast(animatedOnly?'仅显示有动画的轨道（姿态键、参数键、动作/路径或镜头用到），不改工程':'已显示全部轨道');};
updateFitButton();updateFollowButton();
// 用户主动横滚（Shift+滚轮 / 触控板横滚 / 中键平移）时暂停自动跟随；Alt 缩放不算横滚。
$('#tracks').addEventListener('wheel',e=>{if(playing&&!e.altKey&&(e.shiftKey||Math.abs(e.deltaX||0)>Math.abs(e.deltaY||0))){followPlayhead=false;updateFollowButton();}},{passive:true});
$('#tracks').addEventListener('pointerdown',e=>{if(playing&&e.button===1){followPlayhead=false;updateFollowButton();}},true);
const trackSizeObserver=new ResizeObserver(()=>{const host=$('#tracks');host.style.setProperty('--tl-base',Math.max(120,host.clientWidth-154)+'px');updatePlayhead();});trackSizeObserver.observe($('#tracks'));
installNumberScrub({onStart(){beginStageInteraction(selected);stage?.orbit.clear()},onPreview(el){
 const o=mode==='stage'?p.objects.find(o=>o.id===selected):null;if(!o||!stage||!el.closest('#properties'))return;
 const state=clone(sampleObject(o,time)),value=el.valueAsNumber;if(!Number.isFinite(value))return;
 if(el.dataset.vector)state[el.dataset.vector][+el.dataset.index]=value;
 else{const field={objRot:'rotation',objRotX:'rotationX',objRotZ:'rotationZ',objRoll:'roll',objScale:'scale',objFov:'fov'}[el.id];if(!field)return;state[field]=value}
 stage.paramPreview={id:o.id,state};
},onEnd(){if(stage)stage.paramPreview=null}});
function loop(now){if(!managerOpen&&!transitioning&&!exporting){if(playing){const next=advancePlayTime(time,(now-last)/1000,p.duration,loopPlayback);time=next.time;if(!next.playing){stop();renderProperties()}updatePlayhead();if(followPlayhead)revealPlayhead()}if(!document.hidden&&wsShell?.onCanvas())stage?.render(time,override,mode==='stage'&&!$('.modal')?(now-last)/1000:0);saveWorkspaceUI()}last=now;requestAnimationFrame(loop)}
startI18nDom();
renderSidebar();renderBoard();renderProperties();renderPreviewSelect();renderTracks();updateStats();updateUndo();requestAnimationFrame(loop);

async function withLocalWork(fn){localWork++;try{return await fn()}finally{localWork--}}
for(const input of [$('#mediaFile'),$('#modelFile'),$('#projectFile')]){const handler=input.onchange;input.onchange=e=>withLocalWork(()=>handler(e));}
async function saveProjectCover(){
 if(!stage||!activeProject)return;
 try{stage.render(time,override,0);const src=stage.previewRenderer.domElement,c=document.createElement('canvas');c.width=480;c.height=Math.round(480*src.height/src.width)||270;c.getContext('2d').drawImage(src,0,0,c.width,c.height);await library.cover(p.id,c.toDataURL('image/jpeg',.7));}catch{/* Preview is optional; the full project has already been saved. */}
}
async function lockProject(id){
 if(!navigator.locks)return ()=>{};
 return new Promise((resolve,reject)=>{navigator.locks.request('director-project:'+id,{ifAvailable:true},lock=>{if(!lock){reject(Error('该项目已在另一个窗口打开，请先在那里返回项目管理'));return;}return new Promise(release=>resolve(release));}).catch(reject)});
}
async function goProjects(){
 if(managerOpen){await manager.show();return;}
 if(transitioning)return;if(exporting||localWork)return toast('正在导出或读取素材，请完成后再切换项目');
 boardGesture?.cancel();endSpaceHand();transitioning=true;try{document.activeElement?.blur();stop();wsShell?.onProjectsView();saveWorkspaceUI(true);stage?.orbit.clear();closeModal();$('#contextMenu').classList.add('hidden');do{await projectSaver.flush()}while(projectSaver.pending);await saveProjectCover();managerOpen=true;activeProject=false;$('.app').inert=true;document.body.classList.add('project-home');releaseProjectLock?.();releaseProjectLock=null;await manager.show(p.id);}catch(e){toast('未切换项目：'+e.message)}finally{transitioning=false}
}
async function openManagedProject(id){
 if(transitioning)return;transitioning=true;let unlock;
 try{unlock=await lockProject(id);const next=await library.read(id),meta=(await library.list()).find(row=>row.id===id);if(!next||!meta)throw Error('项目不存在');if(meta.archived)throw Error('项目已移入回收站，请先恢复');
 // 切工程：先保存旧工程的工作现场，再按工程 ID 恢复新工程 UI 状态；缺失或损坏一律回退默认，播放不自动继续。
 boardGesture?.cancel();endSpaceHand();if(activeProject&&!managerOpen)saveWorkspaceUI(true);
 const ws=loadWorkspaceState(id,typeof localStorage!=='undefined'?localStorage:undefined);
 p=next;relationReturnView=null;relationProject=p.id;shotListFocus=null;shotListReturnView=null;objectFilter='all';activeDirectorId=null;libraryOpen=false;expandedTracks.clear();dirty=false;lastSavedAt=null;activeProject=true;managerOpen=false;selected=null;selectedEdge=null;modeMemory.board=null;modeMemory.stage=null;override=null;time=0;playing=false;history=[];future=[];filter='all';focusAfterLoad=null;mediaTarget=null;nodeQuery='';animatedOnly=false;wsSavedAt=0;boardSelection=[];boardGesture=null;endSpaceHand();nudgeStamp=0;nodeHeights.clear();timelineNav?.clearFitMemory();timelineNav?.setZoom(1,{resetScroll:true});$('#tracks').scrollTop=0;const searchInput=$('#nodeSearch');if(searchInput){searchInput.value='';const clearBtn=$('#nodeSearchClear');if(clearBtn)clearBtn.hidden=true;}loopPlayback=false;followPlayhead=true;pendingTimelineScroll=null;
 if(ws){
  if(['all','text','image','video','audio','actor','scene','model','director'].includes(ws.filter))filter=ws.filter;
  if(ws.time!=null)time=clamp(ws.time,0,p.duration);
  if(ws.board){if(Number.isFinite(ws.board.x))p.board.x=ws.board.x;if(Number.isFinite(ws.board.y))p.board.y=ws.board.y;if(Number.isFinite(ws.board.zoom))p.board.zoom=clamp(ws.board.zoom,.2,2);}
  for(const oid of ws.expanded)if(p.objects.some(o=>o.id===oid))expandedTracks.set(oid,true);
  for(const oid of ws.collapsed||[])if(p.objects.some(o=>o.id===oid))expandedTracks.set(oid,false);
  if(ws.timeline?.zoom!=null&&timelineNav)timelineNav.setZoom(clampTimelineZoom(ws.timeline.zoom),{anchor:false});
  if(ws.timeline?.scrollLeft!=null)pendingTimelineScroll={left:ws.timeline.scrollLeft,top:ws.timeline.scrollTop||0};
 }
 updateFollowButton();$('#timelineLoop').setAttribute('aria-pressed','false');$('#timelineLoop').classList.remove('active');$('#animatedOnlyBtn').setAttribute('aria-pressed','false');$('#animatedOnlyBtn').classList.remove('active');
 manager.hide();closeModal();document.body.classList.remove('project-home');$('.app').inert=false;ensureStage();
 setMode(ws?.mode==='stage'?'stage':'board');
 if(ws?.selectedId&&(ws.mode==='stage'?p.objects:p.nodes).some(x=>x.id===ws.selectedId))select(ws.selectedId);
 renderSidebar();renderBoard();renderProperties();renderPreviewSelect();renderTracks();updateStats();updateUndo();stage?.resize();applyPendingTimelineScroll();requestAnimationFrame(applyPendingTimelineScroll);renderShotChecklist();
 releaseProjectLock=unlock;$('#saveStatus').textContent='● 项目已打开';$('#boardTab').focus();wsShell?.onProjectOpened();}
 catch(e){unlock?.();throw e}finally{transitioning=false}
}
const manager=createProjectManager({library,withProjectLock:async(id,fn)=>{const release=await lockProject(id);try{return await fn()}finally{release()}},open:openManagedProject,async create(name,type){const next=demoProject();next.id=uid();next.name=name;if(type==='blank'||type==='script'){next.nodes=[];next.edges=[];next.objects=[object('camera','主机位',[7,4,8])];next.shots=[{id:uid(),cameraId:next.objects[0].id,start:0,end:12}];}const added=await library.add(next);await openManagedProject(added.id);if(type==='script')setTimeout(()=>scriptReferenceModal(),450);},importFile:()=>$('#projectFile').click(),exportProject:exportProjectFile,modal,closeModal,toast,help:helpModal,onboarding:()=>openOnboarding({modal,closeModal,api,toast,onDone:()=>manager.refresh?.()})});
// Canvas tools and a rough-cut workspace with on-demand export.
function locateCanvasNode(id){const n=p.nodes.find(n=>n.id===id);if(!n)return;let group=collapsedGroupFor(p,id);if(group){checkpoint();while(group){group.collapsed=false;group=collapsedGroupFor(p,id);}commit();}if(wsShell&&!wsShell.onCanvas())wsShell.setPage('canvas');if(mode!=='board')setMode('board');select(id);const element=$$('.node').find(el=>el.dataset.id===id),z=p.board.zoom;p.board.x=$('#board').clientWidth/2-(n.x+n.w/2)*z;p.board.y=$('#board').clientHeight/2-(n.y+(element?.offsetHeight||250)/2)*z;boardTransform();persist();}
let planningSendBusy=false;
async function sendPlanningToCanvas(kind,ids,{keepTool=false}={}){
 if(planningSendBusy)return false;
 planningSendBusy=true;
 try{const records=kind==='shots'?p.workstation.story.shots:p.workstation.story.assets;const selectedIds=ids.filter(id=>records.some(r=>r.id===id));if(!selectedIds.length)return toast('请先选择要送入画布的条目');
 const origin=p,signature=JSON.stringify(p.workstation.story);
 const options=await hydrateAssetImages(p,kind==='assets'?selectedIds:[],wsShell.mediaStore);
 if(p!==origin||JSON.stringify(p.workstation.story)!==signature)throw Error('项目或资产已变化，请重新送入画布');
 sendStoryToCanvas(structuredClone(p),kind,selectedIds,options);
 checkpoint();const nodes=sendStoryToCanvas(p,kind,selectedIds,options);commit();if(!keepTool){wsShell.setPage('canvas');if(mode!=='board')setMode('board');filter='all';renderBoard();renderSidebar();setBoardSelection(nodes);fitBoard();}toast(`已把 ${selectedIds.length} 个条目及正式图片送入画布，再次送入会更新对应节点`);return true;
 }catch(e){toast(e.message);return false;}finally{planningSendBusy=false;}
}
async function sendPlanningPackage(){
 if(planningSendBusy)return;
 planningSendBusy=true;
 try{
  if(!p.workstation.script.trim()&&!p.workstation.story.shots.length&&!p.workstation.story.assets.length)return toast('请先创建项目剧本或准备分镜、资产');
  const origin=p,signature=JSON.stringify(p.workstation.story);
  const options=await hydrateAssetImages(p,p.workstation.story.assets.map(a=>a.id),wsShell.mediaStore);
  if(p!==origin||JSON.stringify(p.workstation.story)!==signature)throw Error('项目或资产已变化，请重新同步');
  // Preflight on a copy before opening a single undo checkpoint.
  sendStoryPackageToCanvas(structuredClone(p),options);
  checkpoint();const nodes=sendStoryPackageToCanvas(p,options);commit();
  wsShell.setPage('canvas');if(mode!=='board')setMode('board');filter='all';
  renderBoard();renderSidebar();setBoardSelection(nodes);fitBoard();
  toast(`已同步 ${nodes.length} 个创作节点，来源已连线`);
 }catch(e){toast(e.message);}finally{planningSendBusy=false;}
}
function directorClipCatalog(){return Object.fromEntries(p.objects.filter(o=>o.type==='model').map(o=>[o.id,(stage?.meshes.get(o.id)?.userData.clips||[]).map(c=>({name:c.name,duration:c.duration}))]));}
let directorPreviewBusy=false;
async function captureDirectorFrames({scope='shot',signal}={}){
 if(directorPreviewBusy)throw Error('本机预览尚未完成，请稍后截取');
 directorPreviewBusy=true;
 try{return await withLocalWork(async()=>{
  if(exporting||transitioning)throw Error('请等待当前导出或工程切换完成');
  const owner=p,signature=directorSignature(p),originalTime=time,originalOverride=override;stop();
  const ensure=()=>{if(signal?.aborted)throw Error('已停止截取');if(p!==owner||directorSignature(p)!==signature)throw Error('截取期间工程已变化，请重试');};
  try{
   await stage.readyAssets();ensure();
   const samples=directorFrameSamples(owner,{time:originalTime,scope,cameraId:originalOverride});
   return samples.map(sample=>{ensure();return {...sample,phase:'current',image:stage.screenshot(sample.time,sample.cameraId,{previewWidth:640})};});
  }finally{time=p===owner?originalTime:Math.min(time,p.duration);override=p===owner?originalOverride:override;stage.render(time,override);stage.select(mode==='stage'?selected:null);updatePlayhead();}
 });}finally{directorPreviewBusy=false;}
}
async function previewDirectorPlan(candidate,{signal}={}){if(directorPreviewBusy)throw Error('上一轮预览尚在收尾，请稍后再试');directorPreviewBusy=true;try{return await withLocalWork(async()=>{
 if(exporting||transitioning)throw Error('请等待当前导出或工程切换完成');
 const owner=p,originalTime=time,originalOverride=override;stop();await stage.readyAssets();
 const edit=prepareDirectorEdit(owner,candidate.plan,{signature:candidate.signature,clips:directorClipCatalog()});
 const times=edit.samples.length?edit.samples:[time],before=[],result=[];
 const cameraFor=(scene,t)=>{const changed=[...edit.plan.operations].reverse().find(op=>(op.tool==='camera'||op.tool==='set'&&scene.objects.find(o=>o.id===op.objectId)?.type==='camera')&&Math.abs(op.time-t)<.05)||[...edit.plan.operations].reverse().find(op=>op.tool==='createCamera');return scene.objects.find(o=>o.id===(changed?.objectId||changed?.cameraId))||activeCamera(scene,t);};
 const ensure=()=>{if(signal?.aborted)throw Error('已停止预览');if(p!==owner||candidate.signature!==directorSignature(p))throw Error('工程已变化，请重新生成方案');};
 try{
  ensure();
  for(const t of times){const camera=cameraFor(owner,t);before.push(stage.screenshot(t,camera?.id,{previewWidth:640}));}
  stage.rebuild({...owner,objects:edit.objects,shots:edit.shots});await stage.readyAssets();ensure();
  for(let i=0;i<times.length;i++){ensure();const t=times[i],camera=cameraFor(stage.p,t);result.push({time:t,label:camera?.name||'镜头预览',before:before[i],after:stage.screenshot(t,camera?.id,{previewWidth:640})});}
  return result;
 }finally{stage.rebuild(p);await stage.readyAssets();time=p===owner?originalTime:Math.min(time,p.duration);override=p===owner?originalOverride:override;stage.render(time,override);stage.select(mode==='stage'?selected:null);updatePlayhead();}
});}finally{directorPreviewBusy=false;}}
wsShell=installWorkstation({project:()=>p,isProjectActive:()=>activeProject&&!managerOpen&&!transitioning,checkpoint,commit,persist,toast,undo,locateCanvasNode,
 directorClipCatalog,
 directorSelectionLabel(){const o=p.objects.find(o=>o.id===selected);return o?`已选：${o.name} · ${time.toFixed(2)}秒`:`导演台 · ${time.toFixed(2)}秒`;},
 async readDirectorContext({candidate}={}){if(directorPreviewBusy)throw Error('本机预览尚未完成，请稍后发送');const owner=p;await stage.readyAssets();if(p!==owner)throw Error('工程已切换');const clips=directorClipCatalog(),edit=candidate?prepareDirectorEdit(p,candidate.plan,{signature:candidate.signature,clips}):null;return directorContext(edit?{...p,objects:edit.objects,shots:edit.shots}:p,{time,selectedId:p.objects.some(o=>o.id===selected)?selected:null,clips});},
 captureDirectorFrames,
 showDirector(){setMode('stage');stage?.resize();},
 previewDirectorPlan,
 adoptDirectorPlan(candidate){
  if(exporting||localWork||transitioning)throw Error('当前正在处理素材，请稍后采用');
  const edit=prepareDirectorEdit(p,candidate.plan,{signature:candidate.signature,clips:directorClipCatalog()});
  stop();checkpoint();const snapshot=history.at(-1);p.objects=edit.objects;p.shots=edit.shots;commit(true);renderProperties();
  return {snapshot,signature:directorSignature(p)};
 },
 undoDirectorEdit(token){if(localWork||exporting||history.at(-1)!==token?.snapshot||directorSignature(p)!==token.signature)throw Error('已有其他修改，请使用顶部撤销按钮按顺序撤销');undo();wsShell.openTool('assistant',{mode:'director'});},

 ensureScriptNode:ensureProjectScriptNode,
 getCanvasSelection(){const n=p.nodes.find(n=>n.id===selected);return n?{nodeId:n.id,title:n.title,kind:getCanvasStoryContext(p,n.id)?.kind||n.type}:null;},
 openTaskCenter:modelTasksModal,saveCreativeTasks,
 adoptCreativeTask(task){
  const next=prepareCreativeAdoption(p,task);
  checkpoint();p.workstation=next.workstation;p.nodes=next.nodes;p.edges=next.edges;p.boardGroups=next.boardGroups||[];
  commit();renderProperties();renderCreativeJobs();return true;
 },
 prepareCanvasTool(options={}){finishInlineNodeText();if(shotListOpen)toggleShotChecklist(false);if(options.mode!=='director'&&mode!=='board')setMode('board');},
 onToolShown(kind){if($('.node-tool-panel'))closeModal();requestAnimationFrame(()=>{stage?.resize();refreshNodeOverlays();const board=$('#board'),dock=$('.ws-canvas-dock');if(!dock||dock.hidden||mode!=='board')return;if(dock.classList.contains('node-assistant-floating')){const n=p.nodes.find(n=>n.id===dock.dataset.nodeId);if(n){p.board={...p.board,...composerView(n,{width:board.clientWidth,height:board.clientHeight},p.board.zoom)};boardTransform();const anchor=nodeAnchor(n.id)?.getBoundingClientRect();if(anchor)p.board.y+=board.getBoundingClientRect().top+150-anchor.top;boardTransform();saveWorkspaceUI();}refreshNodeOverlays();return;}const candidate=p.nodes.find(n=>n.id===selected),node=candidate||getScriptNode(p);if(!node)return;const rect=board.getBoundingClientRect(),available=rect.width;if(available<100)return;const z=p.board.zoom,group=collapsedGroupFor(p,node.id),item=group?groupCardRect(p,group):{x:node.x,y:node.y,w:node.w,h:nodeHeights.get(node.id)||240};p.board.x=available/2-(item.x+item.w/2)*z;p.board.y=rect.height/2-(item.y+item.h/2)*z;boardTransform();persist();});},
 syncGeneratedToCanvas:(kind,ids)=>sendPlanningToCanvas(kind,ids||p.workstation.story[kind].map(record=>record.id),{keepTool:true}),
 sendStoryPackageToCanvas:sendPlanningPackage,
 generateStoryAsset:async id=>{const origin=p,a=p.workstation.story.assets.find(a=>a.id===id);if(!a?.prompt?.trim())return toast('请先生成或填写图片提示词');if(!await sendPlanningToCanvas('assets',[id])||p!==origin)return;const current=p.workstation.story.assets.find(a=>a.id===id),n=p.nodes.find(n=>n.id===current?.canvasNodeId);if(n)aiImageModal(n);},
 sendStoryShotsToCanvas:ids=>sendPlanningToCanvas('shots',ids),sendStoryAssetsToCanvas:ids=>sendPlanningToCanvas('assets',ids),
 async addCutToCanvas(blob,info){return withLocalWork(async()=>{
  if(blob.size>300*1024*1024)throw Error('视频超过 300 MB，请导出文件后分段使用');
  const src=await readDataURL(new Blob([blob],{type:'video/mp4'}));
  const release=activeProject&&p.id===info.projectId?()=>{}:await lockProject(info.projectId);
  let writtenId=null;
  try{
   const target=activeProject&&p.id===info.projectId?p:await library.read(info.projectId);
   if(!target)throw Error('原项目已不存在，成片仍可从导出记录下载');
   const existing=target.nodes.find(n=>n.cutExportId===info.jobId);
   if(existing){if(activeProject&&p.id===target.id){wsShell.setPage('canvas');setMode('board');filter='all';select(existing.id);fitBoard();}return existing.id;}
   const result=prepareCutCanvasResult(target,{...info,src,size:blob.size});
   result.node.cutExportId=info.jobId;
   await wsShell.mediaStore.put({...result.asset,blob:new Blob([blob],{type:'video/mp4'})});writtenId=result.asset.id;
   // Navigation may have changed during the write: use a fresh owning project.
   const currentTarget=activeProject&&p.id===info.projectId?p:await library.read(info.projectId);
   if(!currentTarget)throw Error('原项目已不存在');
   if(currentTarget.nodes.length>=500||currentTarget.workstation.assets.length>=500)throw Error('画布或素材库已满，请整理后从导出记录重试');
   const sourceIds=new Set(currentTarget.nodes.map(n=>n.id));
   if(activeProject&&p.id===info.projectId)checkpoint();
   currentTarget.nodes.push(result.node);currentTarget.edges.push(...result.edges.filter(e=>sourceIds.has(e.from)));currentTarget.workstation.assets.push(result.asset);
   if(activeProject&&p.id===info.projectId){commit();wsShell.setPage('canvas');if(mode!=='board')setMode('board');filter='all';renderBoard();select(result.node.id);fitBoard();}
   else await library.save(currentTarget);
   writtenId=null;return result.node.id;
  }finally{if(writtenId)await wsShell.mediaStore.delete(writtenId).catch(()=>{});release();}
 });},
 async updateExportTask(projectId,patch){
  const loaded=activeProject&&p.id===projectId?p:await library.read(projectId);
  const target=activeProject&&p.id===projectId?p:loaded;if(!target)return;
  const tasks=target.workstation.deliver.tasks,existing=tasks.find(t=>t.id===patch.id);
  if(existing)Object.assign(existing,patch);else if(patch.createdAt)tasks.push(patch);
  target.workstation.deliver.tasks=tasks.slice(-20);
  if(activeProject&&p.id===projectId){persist();renderTaskCenter();}else await library.save(target);
 },onCanvasHidden(){if($('.node-tool-panel'))closeModal();},onCanvasShown(){renderProperties();renderNodeActionBar();stage?.resize();requestAnimationFrame(()=>stage?.resize());}});
$('.app').inert=true;
try{await library.initialize();await manager.show()}catch(e){manager.error(e)}
setTimeout(()=>{if(shouldShowOnboarding())openOnboarding({modal,closeModal,api,toast,onDone:()=>manager.refresh?.()})},700);
