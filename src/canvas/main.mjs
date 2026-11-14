import './view.css';
import {
  createCanvasDocument, addNode, removeNode, moveNode, connect,
  findNode, updateNode, validateCanvasDocument, addReference, referenceLabel,
  disconnect, removeReference, addGroup, removeGroup, groupOf,
} from './document.mjs';
import {
  screenToWorld, worldToScreen, zoomAt, fitViewport, nodeRect, nodesInRect,
} from './engine.mjs';
import {
  modelDefaultsKey, pickSavedParams, estimateForModel, missingH3Sections,
  promptTemplateFor, requiresH3Sections, qwenModeNeedsImage,
} from './generation-catalog.mjs';
import { getJob, listJobs, cancelJob, retryJob, waitForJob } from './job-client.mjs';
import { submitJob, requestQuote, uploadDataUrl } from './generation-request.mjs';
import { buildModelOptions, IMAGE_PRESETS } from './generation-options.mjs';
import { buildAIContext } from './ai-context.mjs';
import { createAIPanel } from './ai-panel.mjs';
import { jobsListHtml } from './job-view.mjs';
import { buildDockViewModel } from './dock-view.mjs';
import { createGenerationFlow } from './generation-flow.mjs';
import { createImageActions } from './image-actions.mjs';
import { createPicturePopover } from './picture-popover.mjs';
import { createClipboardActions } from './clipboard-actions.mjs';
import { computeSnap, guidesHtml } from './snap-view.mjs';
import { createAssetsPanel } from './assets-view.mjs';
import { createHistory } from './history.mjs';
import { createBoardManager } from './board-manager.mjs';
import { alignPositions, stackPositions } from './layout-actions.mjs';
import { minimapBounds, paintMinimap, minimapTransform } from './minimap.mjs';
import { createNodeActions } from './node-actions.mjs';
import { createPromptTools } from './prompt-tools.mjs';
import { createStyleTools } from './style-tools.mjs';
import { createTrimTools } from './trim-tools.mjs';
import { createVoicePicker } from './voice-picker.mjs';
import { createMaskEditor } from './mask-editor.mjs';
import { createVersionsView, downloadNodeResource } from './versions-view.mjs';
import { createTimelineUI } from './timeline-ui.mjs';
import { createGenerationSubmit } from './generation-submit.mjs';
import { createComfyVideoSubmit } from './comfy-video.mjs';
import { createCanvasGestures } from './canvas-gestures.mjs';
import { createShortcuts } from './shortcuts.mjs';
import { seedDocument } from './seed-document.mjs';
import { createMediaExtract } from './media-extract.mjs';
import { reorderReferences, applyReferenceRole, findReferenceEdge, mentionMode } from './reference-actions.mjs';
import { dreaminaSpecFor as findDreaminaSpec, dreaminaModeFor as findDreaminaMode, dreaminaValues as findDreaminaValues, dreaminaRange as findDreaminaRange, dreaminaModelLabel as findDreaminaModelLabel, chooseDreaminaPatch } from './dreamina-model.mjs';
import { nodeToolsHtml, multiToolLabels, multiToolsHtml } from './node-tools.mjs';
import { contextMenuHtml, actionableMenuEntries } from './menu-view.mjs';
import { nodeBodyHtml, generationOverlayHtml } from './node-view.mjs';
import { edgePathsHtml } from './edge-view.mjs';
import { ICONS, toolIcon, typeLabel, statusLabel } from './canvas-icons.mjs';

const EMBED = new URLSearchParams(location.search).has('embed');
if (EMBED) document.body.classList.add('embed');
const STORAGE_KEY = 'zaomeng-canvas2-doc';
const BOARD_PREFIX = 'zaomeng-canvas2-boards';
let boardProjectId = 'local';
let boardList = [];
let currentBoardId = null;

const TOOLBAR = [
  { id: 'text', label: '文本' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'audio', label: '音频' },
  { id: 'sep' },
  { id: 'assets', label: '资产', note: '工程资产库' },
  { id: 'stage', label: '导演台', note: '3D 导演台（复用现有）' },
  { id: 'timeline', label: '时间线' },
  { id: 'sep' },
  { id: 'upload', label: '上传', note: '上传本机素材' },
];

function loadDocument() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const doc = JSON.parse(raw);
      if (!validateCanvasDocument(doc).length) return doc;
    }
  } catch { /* 忽略损坏缓存，回退到种子 */ }
  return seedDocument();
}

let doc = EMBED ? seedDocument() : loadDocument();
let embedLoaded = false;
let selection = new Set();
let toastTimer = null;
let menuOpenedAt = 0;
let dreaminaCatalog = { image: [], video: [], audio: [] };
let selectedEdge = null;
let spaceHeld = false;
let clipboard = null;
const HISTORY_LIMIT = 60;

const app = document.createElement('div');
app.className = 'cv-app';
app.innerHTML = `
  <header class="cv-top">
    <a class="cv-back" href="/" title="返回">${ICONS.back}</a>
    <button class="cv-title cv-board-btn" id="cvBoardBtn" title="画布管理">画布 ▾</button>
    <span class="cv-badge" id="nodeCount">节点 0</span>
    <button class="cv-gear" id="cvJobsBtn" title="生成任务">任务</button>
    <span class="cv-save" id="saveState">已保存到本机</span>
    <span class="cv-spacer"></span>
    <button class="cv-gear" id="shortcutsBtn" title="快捷键">?</button>
    <button class="cv-gear" id="settingsBtn" title="生成服务设置">⚙</button>
    <div class="cv-zoom">
      <button id="zoomOut" title="缩小">−</button>
      <span class="cv-zoom-value" id="zoomValue">100%</span>
      <button id="zoomIn" title="放大">+</button>
      <button id="zoomFit" title="适应画布" style="width:auto;padding:0 8px;font-size:12px">适应</button>
    </div>
  </header>
  <aside class="cv-rail" id="rail"></aside>
  <main class="cv-stage" id="stage">
    <div class="cv-layer" id="layer">
      <svg class="cv-edges" id="edges" width="1" height="1"></svg>
      <svg class="cv-guides" id="guides" width="1" height="1"></svg>
    </div>
    <div class="cv-hint" id="hint">左侧添加节点 · 拖节点移动 · 空白拖动框选 · 空格/中键平移 · 滚轮缩放</div>
  </main>
  <section class="cv-dock" id="dock">
    <div class="cv-dock-head"><b id="dockTitle">生成</b><span id="dockMeta"></span><span class="cv-spacer"></span><span id="dockState"></span></div>
    <div class="cv-dock-chips" id="dockChips"></div>
    <textarea id="dockPrompt" placeholder="描述你想要的画面 / 声音…"></textarea>
    <div class="cv-dock-bar">
      <button class="cv-pill" id="dockBackend" title="生成服务设置">后端：检查中…</button>
      <button class="cv-pill" id="dockBackendMode" style="display:none">生成后端：即梦 CLI</button>
      <button class="cv-pill" id="dockImageModel" style="display:none">模型：Flux</button>
      <button class="cv-pill" id="dockRefMode" style="display:none">参考：i2i</button>
      <button class="cv-pill" id="dockModel">模型</button>
      <button class="cv-pill" id="dockRatio">16:9</button>
      <button class="cv-pill" id="dockDuration" style="display:none">5s</button>
      <button class="cv-pill" id="dockRes">分辨率</button>
      <button class="cv-pill" id="dockCount">1 个</button>
      <button class="cv-pill" id="dockMention" title="引用节点">@</button>
      <button class="cv-pill" id="dockOptimize" title="用 DeepSeek 优化提示词">✨ 优化</button>
      <button class="cv-pill" id="dockTranslate" title="翻译成英文">译</button>
      <button class="cv-pill" id="dockTemplate" title="按模型插入提示词模板">模板</button>
      <span class="cv-cost" id="dockCost">M1 画布原型 · 后端在 M4 接入</span>
      <button class="cv-send" id="dockSend" title="生成">${ICONS.send}</button>
    </div>
  </section>
  <div class="cv-node-tools" id="nodeTools"></div>
  <div class="cv-menu" id="ctxMenu"></div>
  <div class="cv-modal" id="voiceModal">
    <div class="cv-modal-card" role="dialog" aria-label="选择音色">
      <h3>选择音色</h3>
      <div class="cv-modal-sub">来自即梦音色库（Seed TTS）</div>
      <div class="cv-voice-list" id="voiceList"></div>
      <div class="cv-modal-actions">
        <button class="cv-btn" id="voiceCancel">取消</button>
      </div>
    </div>
  </div>
  <div class="cv-modal" id="optimizeModal">
    <div class="cv-modal-card">
      <h3>提示词优化</h3>
      <div class="cv-modal-sub">DeepSeek 优化结果，可继续编辑后应用</div>
      <div class="cv-lang-tabs" id="optimizeLangs"><button data-lang="zh" class="active">中文版</button><button data-lang="en">English</button></div>
      <textarea id="optimizeText" rows="8" placeholder="优化结果"></textarea>
      <div class="cv-status" id="optimizeStatus"></div>
      <div class="cv-modal-actions">
        <button class="cv-btn" id="optimizeCancel">取消</button>
        <button class="cv-btn primary" id="optimizeApply">应用到输入框</button>
      </div>
    </div>
  </div>
  <div class="cv-modal" id="jobsModal">
    <div class="cv-modal-card" role="dialog" aria-label="生成任务">
      <h3>生成任务</h3>
      <div class="cv-modal-sub">ComfyUI / 即梦任务进度；失败可重试，运行中可取消。</div>
      <div class="cv-job-list" id="jobsList"></div>
      <div class="cv-modal-actions">
        <button class="cv-btn" id="jobsRefresh">刷新</button>
        <button class="cv-btn" id="jobsClose">关闭</button>
      </div>
    </div>
  </div>
  <div class="cv-modal" id="shortcutsModal">
    <div class="cv-modal-card">
      <h3>快捷键与操作</h3>
      <div class="cv-modal-sub">画布内使用</div>
      <div class="cv-shortcuts">
        <div><kbd>空白拖动</kbd><span>框选节点（Shift 追加）</span></div>
        <div><kbd>空格 / 中键拖动</kbd><span>平移画布</span></div>
        <div><kbd>滚轮</kbd><span>缩放</span></div>
        <div><kbd>双击节点</kbd><span>激活工具条 / 生成坞</span></div>
        <div><kbd>⌘ C / V / D</kbd><span>复制 / 粘贴 / 复制副本</span></div>
        <div><kbd>⌘ Z / ⇧⌘Z</kbd><span>撤销 / 重做</span></div>
        <div><kbd>⌘ A</kbd><span>全选节点</span></div>
        <div><kbd>Delete</kbd><span>删除节点或选中连线</span></div>
        <div><kbd>F</kbd><span>适应画布</span></div>
      </div>
      <div class="cv-modal-actions"><button class="cv-btn" id="shortcutsClose">知道了</button></div>
    </div>
  </div>
  <div class="cv-minimap" id="minimap" title="点击/拖动小地图移动视图"><canvas id="minimapCanvas" width="220" height="150"></canvas><span>小地图</span></div>
  <button class="cv-ai-dock" id="aiDockBtn">与 AI 对话</button>
  <section class="cv-ai-panel" id="aiPanel" aria-label="AI 助手">
    <div class="cv-ai-head"><b>AI 助手</b><span id="aiContext">DeepSeek</span><button id="aiClose" title="关闭">×</button></div>
    <div class="cv-ai-messages" id="aiMessages"></div>
    <div class="cv-ai-input"><textarea id="aiInput" rows="2" placeholder="问剧本、分镜、镜头或提示词…"></textarea><button id="aiSend">发送</button></div>
  </section>
  <div class="cv-modal" id="boardRenameModal">
    <div class="cv-modal-card">
      <h3>重命名画布</h3>
      <label class="cv-field"><span>名称</span><input id="boardRenameInput" maxlength="40" placeholder="画布名称"></label>
      <div class="cv-modal-actions"><button class="cv-btn" id="boardRenameCancel">取消</button><button class="cv-btn primary" id="boardRenameConfirm">保存</button></div>
    </div>
  </div>
  <div class="cv-picture-popover" id="picturePopover">
    <div class="cv-pic-title">画面设置</div>
    <div class="cv-pic-label">画面比例</div>
    <div class="cv-pic-ratios" id="picRatios"></div>
    <div class="cv-pic-label">分辨率</div>
    <div class="cv-pic-res" id="picRes"></div>
    <div class="cv-pic-label">选择生成数量</div>
    <div class="cv-pic-counts" id="picCounts"></div>
  </div>
  <div class="cv-timeline-overlay" id="timelineModal">
    <div class="cv-timeline-shell">
      <header class="cv-timeline-top"><button class="cv-btn" id="timelineCancel" title="返回画布">← 返回画布</button><b>时间线</b><span id="timelineTotal"></span><span class="cv-spacer"></span><button class="cv-btn" id="timelineExport">导出</button><button class="cv-timeline-close" id="timelineClose" title="关闭时间线">×</button></header>
      <div class="cv-timeline-body">
        <aside class="cv-timeline-assets">
          <div class="cv-timeline-tabs"><button class="active">已导入资产</button><button>画布资产</button></div>
          <div class="cv-timeline-filters"><button class="active" data-kind="all">全部</button><button data-kind="image">图片</button><button data-kind="video">视频</button><button data-kind="audio">音频</button><button id="timelineRescan" title="刷新">↻</button><button id="timelineImport" title="导入">+</button></div>
          <div class="cv-timeline-asset-list" id="timelineAssets"></div>
        </aside>
        <main class="cv-timeline-main">
          <div class="cv-timeline-preview" id="timelinePreviewBox">
            <video id="timelinePreview" preload="metadata"></video>
            <img id="timelinePreviewImage" alt="" hidden>
            <div class="cv-timeline-preview-empty" id="timelinePreviewEmpty">没有媒体可供预览</div>
          </div>
          <div class="cv-timeline-transport"><button id="timelinePlay">▶</button><span id="timelinePlayhead">00:00 / 00:00</span><span class="cv-spacer"></span><button id="timelineMute" title="静音">🔊</button></div>
          <div class="cv-timeline-editor">
            <div class="cv-timeline-toolrow"><button id="timelineSplit" title="分割选中片段">✂</button><button id="timelineDelete" title="删除选中片段">⌫</button><span class="cv-spacer"></span><button id="timelineZoomFit">适应</button></div>
            <div class="cv-timeline-ruler" id="timelineRuler"></div>
            <div class="cv-timeline-lanes" id="timelineLanes"></div>
          </div>
        </main>
      </div>
    </div>
  </div>
  <div class="cv-modal" id="cameraModal">
    <div class="cv-modal-card">
      <h3>相机</h3>
      <div class="cv-modal-sub">镜头语言预设会写入提示词</div>
      <label class="cv-field"><span>相机</span><select id="camCamera"></select></label>
      <label class="cv-field"><span>镜头</span><select id="camLens"></select></label>
      <label class="cv-field"><span>焦距</span><select id="camFocal"></select></label>
      <label class="cv-field"><span>光圈</span><select id="camAperture"></select></label>
      <div class="cv-modal-actions"><button class="cv-btn" id="camCancel">取消</button><button class="cv-btn primary" id="camConfirm">确认</button></div>
    </div>
  </div>
  <div class="cv-modal" id="paletteModal">
    <div class="cv-modal-card">
      <h3>配色</h3>
      <div class="cv-modal-sub">选一个调色板写入提示词</div>
      <div class="cv-palette-grid" id="paletteGrid"></div>
      <div class="cv-modal-actions"><button class="cv-btn" id="paletteCancel">取消</button><button class="cv-btn primary" id="paletteConfirm">确认</button></div>
    </div>
  </div>
  <div class="cv-modal" id="styleModal">
    <div class="cv-modal-card">
      <h3>风格</h3>
      <div class="cv-modal-sub">风格会作为提示词前缀</div>
      <div class="cv-style-list" id="styleList"></div>
      <div class="cv-modal-actions"><button class="cv-btn" id="styleCancel">取消</button><button class="cv-btn primary" id="styleConfirm">确认</button></div>
    </div>
  </div>
  <div class="cv-modal" id="versionsModal">
    <div class="cv-modal-card">
      <h3>版本</h3>
      <div class="cv-modal-sub">每次生成都会保留上一个结果</div>
      <div class="cv-versions" id="versionsGrid"></div>
      <div class="cv-modal-actions"><button class="cv-btn" id="versionsClose">关闭</button></div>
    </div>
  </div>
  <div class="cv-modal" id="assetsModal">
    <div class="cv-modal-card">
      <h3>资产库</h3>
      <div class="cv-modal-sub">工程里已有的图片 / 视频 / 音频，点击加入画布</div>
      <div class="cv-assets-grid" id="assetsGrid"></div>
      <div class="cv-modal-actions">
        <button class="cv-btn" id="assetsUpload">本地上传</button>
        <button class="cv-btn" id="assetsClose">关闭</button>
      </div>
    </div>
  </div>
  <div class="cv-modal" id="videoTrimModal">
    <div class="cv-modal-card">
      <h3>视频修剪</h3>
      <div class="cv-modal-sub">拖滑块选择要保留的区间，导出新视频</div>
      <video id="videoTrimPreview" controls style="width:100%;max-height:320px;border-radius:8px;background:#0b0d11"></video>
      <label class="cv-field"><span>起点</span><input id="videoTrimStart" type="range" min="0" max="10" step="0.1" value="0"></label>
      <label class="cv-field"><span>终点</span><input id="videoTrimEnd" type="range" min="0" max="10" step="0.1" value="10"></label>
      <div class="cv-status" id="videoTrimInfo"></div>
      <div class="cv-modal-actions"><button class="cv-btn" id="videoTrimCancel">取消</button><button class="cv-btn primary" id="videoTrimConfirm">修剪</button></div>
    </div>
  </div>
  <div class="cv-modal" id="audioTrimModal">
    <div class="cv-modal-card" role="dialog" aria-label="裁剪音频">
      <h3>裁剪音频</h3>
      <div class="cv-modal-sub">拖滑块选择要保留的区间</div>
      <canvas id="trimWave" width="600" height="90"></canvas>
      <label class="cv-field"><span>起点</span><input id="trimStart" type="range" min="0" max="10" step="0.1" value="0"></label>
      <label class="cv-field"><span>终点</span><input id="trimEnd" type="range" min="0" max="10" step="0.1" value="10"></label>
      <div class="cv-status" id="trimInfo"></div>
      <div class="cv-modal-actions">
        <button class="cv-btn" id="trimCancel">取消</button>
        <button class="cv-btn primary" id="trimConfirm">裁剪</button>
      </div>
    </div>
  </div>
  <div class="cv-modal" id="maskModal">
    <div class="cv-modal-card cv-mask-card" role="dialog" aria-label="局部重绘">
      <h3>局部重绘</h3>
      <div class="cv-modal-sub">在图片上拖拽矩形选区；白色区域 = 重绘，可多选</div>
      <div class="cv-mask-stage"><img id="maskImage" alt=""><canvas id="maskCanvas"></canvas></div>
      <div class="cv-modal-actions">
        <button class="cv-btn" id="maskClear">清空</button>
        <button class="cv-btn" id="maskCancel">取消</button>
        <button class="cv-btn primary" id="maskConfirm">开始重绘</button>
      </div>
    </div>
  </div>
  <div class="cv-modal" id="quoteModal">
    <div class="cv-modal-card" role="dialog" aria-label="生成报价">
      <h3>生成报价</h3>
      <div class="cv-modal-sub" id="quoteMeta">即梦 CLI · 视频生成</div>
      <div class="cv-status" id="quoteText"></div>
      <div class="cv-credit-line" id="quoteCredits"></div>
      <div class="cv-modal-actions">
        <button class="cv-btn" id="quoteCancel">取消</button>
        <button class="cv-btn primary" id="quoteConfirm">确认并生成</button>
      </div>
    </div>
  </div>
  <div class="cv-modal" id="settingsModal">
    <div class="cv-modal-card" role="dialog" aria-label="生成服务设置">
      <h3>生成服务</h3>
      <div class="cv-modal-sub">配置本机或局域网另一台电脑的 ComfyUI；即梦 CLI 使用本机登录态。</div>
      <label class="cv-field"><span>ComfyUI 地址</span><input id="settingsComfyUrl" placeholder="http://127.0.0.1:8188" autocomplete="off"></label>
      <label class="cv-field"><span>ComfyUI 0.45 并行地址（H3 Ultimate / Qwen 2.1）</span><input id="settingsComfyUrl045" placeholder="留空自动用同主机 8190" autocomplete="off"></label>
      <label class="cv-field"><span>即梦 CLI</span><input id="settingsDreamina" disabled></label>
      <label class="cv-field"><span>ComfyUI 图像 workflow</span><input id="settingsImageWorkflow" list="workflowOptions" placeholder="sdxl-t2i" autocomplete="off"></label>
      <label class="cv-field"><span>ComfyUI 视频 workflow</span><input id="settingsVideoWorkflow" list="workflowOptions" placeholder="h3-t2v" autocomplete="off"></label>
      <label class="cv-field"><span>DeepSeek API Key（中文自动翻译，可选）</span><input id="settingsDeepseekKey" type="password" placeholder="sk-…（已配置留空保持不变）" autocomplete="off"></label>
      <label class="cv-field"><span>DeepSeek 模型</span><input id="settingsDeepseekModel" placeholder="deepseek-chat" autocomplete="off"></label>
      <datalist id="workflowOptions"></datalist>
      <div class="cv-status" id="settingsStatus"></div>
      <div class="cv-modal-sub" style="margin:14px 0 6px">生成配置</div>
      <div class="cv-modal-actions" style="justify-content:flex-start;margin:0 0 4px">
        <button class="cv-btn" id="configExport">导出生成配置</button>
        <button class="cv-btn" id="configImport">导入生成配置</button>
        <input type="file" id="configImportFile" accept=".json,application/json" hidden>
      </div>
      <div class="cv-modal-sub" style="margin:14px 0 6px">画布文件</div>
      <div class="cv-modal-actions" style="justify-content:flex-start;margin:0 0 4px">
        <button class="cv-btn" id="canvasExport">导出画布 JSON</button>
        <button class="cv-btn" id="canvasImport">导入画布 JSON</button>
        <input type="file" id="canvasImportFile" accept=".json,application/json" hidden>
      </div>
      <div class="cv-modal-actions">
        <button class="cv-btn" id="settingsTest">测试连接</button>
        <button class="cv-btn" id="settingsCancel">取消</button>
        <button class="cv-btn primary" id="settingsSave">保存</button>
      </div>
    </div>
  </div>
  <input type="file" id="cvFileInput" accept="image/*,video/*,audio/*" hidden>
  <div class="cv-toast" id="toast"></div>
`;
document.body.appendChild(app);
if (EMBED) {
  const back = app.querySelector('.cv-back');
  if (back) back.style.display = 'none';
  const title = app.querySelector('.cv-title');
  if (title) title.textContent = '画布';
}

const stage = app.querySelector('#stage');
const layer = app.querySelector('#layer');
const edgesSvg = app.querySelector('#edges');
const guidesSvg = app.querySelector('#guides');
const rail = app.querySelector('#rail');
const dock = app.querySelector('#dock');
const toastEl = app.querySelector('#toast');
const promptEl = app.querySelector('#dockPrompt');

for (const tool of TOOLBAR) {
  if (tool.id === 'sep') {
    rail.insertAdjacentHTML('beforeend', '<div class="cv-sep"></div>');
    continue;
  }
  const button = document.createElement('button');
  button.dataset.tool = tool.id;
  button.title = tool.note || tool.label;
  button.innerHTML = `${ICONS[tool.id] || ICONS.image}<span class="cv-tip">${tool.label}</span>`;
  button.addEventListener('click', () => onToolClick(tool.id));
  rail.appendChild(button);
}

app.querySelector('#zoomIn').addEventListener('click', () => zoomBy(1.2));
app.querySelector('#zoomOut').addEventListener('click', () => zoomBy(1 / 1.2));
app.querySelector('#zoomFit').addEventListener('click', fitCanvas);
app.querySelector('#cvBoardBtn').addEventListener('click', openBoardMenu);
bindMinimap();
promptEl.addEventListener('input', onPromptInput);
app.querySelector('#dockSend').addEventListener('click', () => {
  generateSelected().catch((error) => toast(error.message || String(error), true));
});
app.querySelector('#settingsBtn').addEventListener('click', openSettings);
app.querySelector('#dockBackend').addEventListener('click', openSettings);
app.querySelector('#quoteCancel').addEventListener('click', () => closeQuote(false));
app.querySelector('#maskCancel').addEventListener('click', () => closeMaskEditor());
app.querySelector('#trimCancel').addEventListener('click', () => app.querySelector('#audioTrimModal').classList.remove('open'));
app.querySelector('#videoTrimCancel').addEventListener('click', () => app.querySelector('#videoTrimModal').classList.remove('open'));
app.querySelector('#videoTrimConfirm').addEventListener('click', confirmVideoTrim);
app.querySelector('#videoTrimStart').addEventListener('input', drawVideoTrimInfo);
app.querySelector('#videoTrimEnd').addEventListener('input', drawVideoTrimInfo);
app.querySelector('#trimConfirm').addEventListener('click', confirmAudioTrim);
app.querySelector('#trimStart').addEventListener('input', drawTrimWave);
app.querySelector('#versionsClose').addEventListener('click', () => app.querySelector('#versionsModal').classList.remove('open'));
app.querySelector('#cvJobsBtn').addEventListener('click', openJobsPanel);
app.querySelector('#jobsClose').addEventListener('click', closeJobsPanel);
app.querySelector('#jobsRefresh').addEventListener('click', refreshJobsPanel);
app.querySelector('#shortcutsBtn').addEventListener('click', () => app.querySelector('#shortcutsModal').classList.add('open'));
app.querySelector('#shortcutsClose').addEventListener('click', () => app.querySelector('#shortcutsModal').classList.remove('open'));
app.querySelector('#assetsClose').addEventListener('click', () => app.querySelector('#assetsModal').classList.remove('open'));
app.querySelector('#assetsUpload').addEventListener('click', () => { app.querySelector('#assetsModal').classList.remove('open'); app.querySelector('#cvFileInput').click(); });
app.querySelector('#dockMention').addEventListener('click', openMentionMenu);
app.querySelector('#dockOptimize').addEventListener('click', () => promptTools.optimize());
app.querySelector('#dockTranslate').addEventListener('click', () => promptTools.translate());
app.querySelector('#dockTemplate').addEventListener('click', openPromptTemplateMenu);
app.querySelectorAll('#optimizeLangs [data-lang]').forEach((button) => button.addEventListener('click', () => promptTools.switchLang(button.dataset.lang)));
app.querySelector('#optimizeCancel').addEventListener('click', () => app.querySelector('#optimizeModal').classList.remove('open'));
app.querySelector('#optimizeApply').addEventListener('click', () => promptTools.apply());
app.querySelector('#camCancel').addEventListener('click', () => app.querySelector('#cameraModal').classList.remove('open'));
app.querySelector('#camConfirm').addEventListener('click', applyCamera);
app.querySelector('#paletteCancel').addEventListener('click', () => app.querySelector('#paletteModal').classList.remove('open'));
app.querySelector('#paletteConfirm').addEventListener('click', applyPalette);
app.querySelector('#styleCancel').addEventListener('click', () => app.querySelector('#styleModal').classList.remove('open'));
app.querySelector('#styleConfirm').addEventListener('click', applyStyle);
app.querySelector('#trimEnd').addEventListener('input', drawTrimWave);
app.querySelector('#maskClear').addEventListener('click', () => maskEditor.clear());
app.querySelector('#maskConfirm').addEventListener('click', confirmInpaint);
app.querySelector('#voiceCancel').addEventListener('click', () => app.querySelector('#voiceModal').classList.remove('open'));
app.querySelector('#settingsCancel').addEventListener('click', closeSettings);
app.querySelector('#settingsSave').addEventListener('click', saveSettings);
app.querySelector('#settingsTest').addEventListener('click', testSettings);
app.querySelector('#cvFileInput').addEventListener('change', onLocalUpload);
app.querySelector('#canvasExport').addEventListener('click', exportCanvasJson);
app.querySelector('#canvasImport').addEventListener('click', () => app.querySelector('#canvasImportFile').click());
app.querySelector('#canvasImportFile').addEventListener('change', importCanvasJson);
app.querySelector('#dockBackendMode').addEventListener('click', openBackendMenu);
app.querySelector('#dockImageModel').addEventListener('click', toggleImageModel);
app.querySelector('#dockRefMode').addEventListener('click', openRefModeMenu);
app.querySelector('#dockDuration').addEventListener('click', openDurationMenu);
app.querySelector('#dockRes').addEventListener('click', () => picturePopover.open());
app.querySelector('#dockModel').addEventListener('click', () => openParamMenu('model'));
app.querySelector('#dockRatio').addEventListener('click', () => picturePopover.open());
app.querySelector('#dockCount').addEventListener('click', () => picturePopover.open());
app.querySelector('#picturePopover').addEventListener('click', (event) => event.stopPropagation());
app.querySelector('#timelineCancel').addEventListener('click', closeTimelineView);
app.querySelector('#timelineCancel').addEventListener('pointerdown', () => { if (document.body.classList.contains('timeline-open')) { closeTimelineView(); } });
app.querySelector('#timelineClose').addEventListener('click', closeTimelineView);
app.querySelector('#timelineClose').addEventListener('pointerdown', () => { if (document.body.classList.contains('timeline-open')) { closeTimelineView(); } });
app.querySelector('#timelinePlay').addEventListener('click', playTimelineClip);
app.querySelector('#timelineExport').addEventListener('click', openTimelineExportMenu);
app.querySelector('#timelineRescan').addEventListener('click', () => { renderTimelineRows(); });
app.querySelector('#timelineImport').addEventListener('click', () => app.querySelector('#cvFileInput').click());
app.querySelectorAll('.cv-timeline-filters [data-kind]').forEach((button) => button.addEventListener('click', () => { timelineUI.setFilter(button.dataset.kind); app.querySelectorAll('.cv-timeline-filters [data-kind]').forEach((item) => item.classList.toggle('active', item === button)); }));
app.querySelector('#timelineSplit').addEventListener('click', splitTimelineClip);
app.querySelector('#timelineDelete').addEventListener('click', deleteTimelineClip);
app.querySelector('#timelineMute').addEventListener('click', () => { const preview = app.querySelector('#timelinePreview'); preview.muted = !preview.muted; app.querySelector('#timelineMute').textContent = preview.muted ? '🔇' : '🔊'; });

app.querySelector('#timelineZoomFit').addEventListener('click', () => { saveTimeline(); document.body.classList.remove('timeline-open'); });
app.querySelector('#boardRenameCancel').addEventListener('click', () => app.querySelector('#boardRenameModal').classList.remove('open'));
app.querySelector('#boardRenameConfirm').addEventListener('click', confirmBoardRename);

app.querySelector('#configExport').addEventListener('click', exportGenerationConfig);
app.querySelector('#configImport').addEventListener('click', () => app.querySelector('#configImportFile').click());
app.querySelector('#configImportFile').addEventListener('change', importGenerationConfig);
stage.addEventListener('contextmenu', onContextMenu);
document.addEventListener('click', (event) => {
  if (Date.now() - menuOpenedAt < 80) return; // 本次点击刚刚打开菜单，不要立刻关掉
  if (!event.target.closest('#ctxMenu')) hideContextMenu();
  if (!event.target.closest('#picturePopover') && !event.target.closest('#dockRatio') && !event.target.closest('#dockRes') && !event.target.closest('#dockCount')) picturePopover.close();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { hideContextMenu(); closeSettings(); if (document.body.classList.contains('timeline-open')) closeTimelineView(); }
});

stage.addEventListener('pointerdown', onPointerDown);
stage.addEventListener('pointermove', onPointerMove);
stage.addEventListener('pointerup', onPointerUp);
stage.addEventListener('pointercancel', onPointerUp);
stage.addEventListener('wheel', onWheel, { passive: false });
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', (event) => { if (event.code === 'Space') spaceHeld = false; });
window.addEventListener('resize', applyViewport);

function render() {
  clearGuides();
  renderGroups();
  renderNodes();
  renderEdges();
  renderAudioWaveforms();
  updateSelectionUi();
  applyViewport();
  drawMinimap();
  document.title = '造梦工坊 · 画布';
  app.querySelector('#nodeCount').textContent = `节点 ${doc.nodes.length}`;
  app.querySelector('#hint').style.display = doc.nodes.length ? 'none' : '';
  persist(false);
}

function renderGroups() {
  layer.querySelectorAll('.cv-group-outline').forEach((el) => el.remove());
  for (const group of doc.groups || []) {
    const items = group.nodeIds.map((id) => findNode(doc, id)).filter(Boolean);
    if (!items.length) continue;
    const rects = items.map(nodeRect);
    const x = Math.min(...rects.map((r) => r.x)) - 18;
    const y = Math.min(...rects.map((r) => r.y)) - 34;
    const width = Math.max(...rects.map((r) => r.x + r.width)) - x + 18;
    const height = Math.max(...rects.map((r) => r.y + r.height)) - y + 18;
    const el = document.createElement('div');
    el.className = 'cv-group-outline';
    el.dataset.group = group.id;
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` });
    layer.insertBefore(el, layer.firstChild);
  }
}

function renderNodes() {
  layer.querySelectorAll('.cv-node').forEach((el) => el.remove());
  for (const node of doc.nodes) {
    const rect = nodeRect(node);
    const el = document.createElement('div');
    el.className = `cv-node ${node.type}${node.status === 'empty' && !node.resources?.length ? ' empty' : ''}${selection.has(node.id) ? ' selected' : ''}`;
    el.dataset.id = node.id;
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    el.innerHTML = `
      <div class="cv-node-title">${ICONS[node.type] || ICONS.image}<span class="cv-node-name">${escapeHtml(node.title || node.type)}</span></div>
      ${generationOverlayHtml(node)}
      <div class="cv-card">
        <div class="cv-node-body">${nodeBodyHtml(node)}</div>
        <span class="cv-conn left" data-conn="in" data-id="${node.id}"></span>
        <span class="cv-conn right" data-conn="out" data-id="${node.id}"></span>
      </div>`;
    el.addEventListener('pointerdown', onNodePointerDown);
    if (node.type === 'timeline') {
      el.querySelector('.cv-mini-expand')?.addEventListener('click', (event) => { event.stopPropagation(); openTimeline(node); });
      el.querySelector('.cv-mini-timeline')?.addEventListener('dblclick', () => openTimeline(node));
    }
    layer.appendChild(el);
  }
}

function renderEdges() {
  const positions = new Map();
  for (const node of doc.nodes) {
    const rect = nodeRect(node);
    const dragPositions = gestures.getDragPositions();
    const dragPos = gestures.getDragPos();
    const moved = (dragPositions && dragPositions.get(node.id)) || (dragPos && dragPos.id === node.id ? dragPos : null);
    positions.set(node.id, moved ? { ...rect, x: moved.x, y: moved.y } : rect);
  }
  edgesSvg.innerHTML = edgePathsHtml({ edges: doc.edges, positions, selectedEdge, tempLink: gestures.getTempLink() });
}

function clearGuides() {
  guidesSvg.innerHTML = '';
}

function snapToGuides(x, y, width, height, exclude) {
  return computeSnap({
    x, y, width, height,
    rects: doc.nodes.map((node) => ({ id: node.id, ...nodeRect(node) })),
    exclude,
    zoom: doc.viewport.zoom,
  });
}

function drawGuides(lines) {
  guidesSvg.innerHTML = guidesHtml(lines);
}

function currentMinimapBounds() {
  const stageRect = stage.getBoundingClientRect();
  return minimapBounds({ nodes: doc.nodes, nodeRect, stageWidth: stageRect.width, stageHeight: stageRect.height, viewport: doc.viewport });
}

function drawMinimap() {
  const canvas = app.querySelector('#minimapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  paintMinimap(ctx, { width: canvas.width, height: canvas.height, nodes: doc.nodes, nodeRect, bounds: currentMinimapBounds() });
}

function bindMinimap() {
  const canvas = app.querySelector('#minimapCanvas');
  if (!canvas) return;
  let dragging = false;
  const moveTo = (event) => {
    const bounds = currentMinimapBounds();
    const rect = canvas.getBoundingClientRect();
    const width = canvas.width;
    const height = canvas.height;
    const { scale, offsetX, offsetY } = minimapTransform(bounds, width, height);
    const worldX = (event.clientX - rect.left) / scale - offsetX / scale;
    const worldY = (event.clientY - rect.top) / scale - offsetY / scale;
    const stageRect = stage.getBoundingClientRect();
    doc.viewport = {
      x: stageRect.width / 2 - worldX * doc.viewport.zoom,
      y: stageRect.height / 2 - worldY * doc.viewport.zoom,
      zoom: doc.viewport.zoom,
    };
    applyViewport();
  };
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    try { canvas.setPointerCapture?.(event.pointerId); } catch { /* 合成事件无活动指针 */ }
    moveTo(event);
  });
  canvas.addEventListener('pointermove', (event) => { if (dragging) moveTo(event); });
  canvas.addEventListener('pointerup', () => { dragging = false; persist(false); });
}

function applyViewport() {
  const vp = doc.viewport;
  layer.style.transform = `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`;
  stage.style.backgroundPosition = `${vp.x}px ${vp.y}px`;
  stage.style.backgroundSize = `${24 * vp.zoom}px ${24 * vp.zoom}px`;
  app.querySelector('#zoomValue').textContent = `${Math.round(vp.zoom * 100)}%`;
  positionNodeTools();
  drawMinimap();
}

function updateSelectionUi() {
  layer.querySelectorAll('.cv-node').forEach((el) => el.classList.toggle('selected', selection.has(el.dataset.id)));
  const single = selection.size === 1 ? findNode(doc, [...selection][0]) : null;
  dock.classList.toggle('open', Boolean(single));
  if (selection.size > 1) renderMultiTools(); else renderNodeTools(single);
  if (!single) { renderDockChips(null); return; }
  renderDockChips(single);
  promptEl.value = single.generation?.prompt ?? single.text ?? '';
  const hasImageRefs = (single.generation?.references || []).some((ref) => findNode(doc, ref.id)?.type === 'image');
  const view = buildDockViewModel({
    node: single,
    prompt: promptEl.value,
    modelLabel: modelLabel(single),
    hasImageRefs,
    promptHasCJK: hasCJK(promptEl.value),
    estimate: estimateFor(single),
  });
  app.querySelector('#dockTitle').textContent = view.title;
  app.querySelector('#dockMeta').textContent = view.meta;
  app.querySelector('#dockState').textContent = view.state;
  app.querySelector('#dockRatio').textContent = view.ratio;
  const modelPill = app.querySelector('#dockModel');
  modelPill.style.display = view.showModel ? '' : 'none';
  modelPill.textContent = view.modelText;
  const ratioPill = app.querySelector('#dockRatio');
  const countPill = app.querySelector('#dockCount');
  const resPill = app.querySelector('#dockRes');
  ratioPill.style.display = view.showLayout ? '' : 'none';
  countPill.style.display = view.showLayout ? '' : 'none';
  resPill.style.display = view.showRes ? '' : 'none';
  resPill.textContent = view.resText;
  resPill.disabled = view.resDisabled;
  const refPill = app.querySelector('#dockRefMode');
  refPill.style.display = view.showRef ? '' : 'none';
  refPill.textContent = view.refText;
  const durationPill = app.querySelector('#dockDuration');
  durationPill.style.display = view.showDuration ? '' : 'none';
  durationPill.textContent = view.durationText;
  countPill.textContent = view.countText;
  const backendMode = app.querySelector('#dockBackendMode');
  backendMode.style.display = view.showBackend ? '' : 'none';
  backendMode.textContent = view.backendText;
  backendMode.disabled = view.backendDisabled;
  const cost = app.querySelector('#dockCost');
  cost.textContent = view.costText;
  cost.classList.toggle('cv-warn', view.costWarn);
  app.querySelector('#dockSend').disabled = view.sendDisabled;
}

function onToolClick(tool) {
  if (tool === 'upload') {
    toast('上传功能将在 M2 接入本机素材库');
    return;
  }
  if (tool === 'stage') {
    openDirectorStage();
    return;
  }
  if (tool === 'assets') { openAssetsPanel(); return; }
  const center = screenToWorld({ x: stage.clientWidth / 2, y: stage.clientHeight / 2 }, doc.viewport);
  const jitter = (doc.nodes.length % 6) * 26;
  pushHistory();
  const generation = ['image', 'video', 'audio'].includes(tool)
    ? { mode: tool === 'video' ? 't2v' : tool === 'audio' ? 'tts' : 't2i', prompt: '', model: '未配置后端', ratio: '16:9', resolution: tool === 'video' ? '480P' : '2K', durationSeconds: tool === 'video' ? 5 : null, outputCount: 1 }
    : null;
  doc = addNode(doc, {
    type: tool,
    title: tool === 'text' ? '文本' : `${typeLabel(tool)} 1`,
    layout: { x: Math.round(center.x - 285 + jitter), y: Math.round(center.y - 160 + jitter), width: tool === 'audio' ? 320 : 569, height: 320 },
    text: tool === 'text' ? '写一段剧本 / 镜头说明…' : '',
    generation,
  });
  selection = new Set([doc.nodes.at(-1).id]);
  render();
}

const gestures = createCanvasGestures({
  stage,
  layer,
  getDoc: () => doc,
  setDoc: (next) => { doc = next; },
  getSelection: () => selection,
  setSelection: (next) => { selection = next; },
  getSelectedEdge: () => selectedEdge,
  setSelectedEdge: (next) => { selectedEdge = next; },
  getSpaceHeld: () => spaceHeld,
  render,
  renderEdges,
  updateSelectionUi,
  applyViewport,
  persist,
  pushHistory,
  toast,
  nodeRect,
  screenToWorld,
  zoomAt,
  nodesInRect,
  groupOf,
  findNode,
  connect,
  addReference,
  moveNode,
  updateNode,
  snapToGuides,
  drawGuides,
  clearGuides,
});

function onNodePointerDown(event) { return gestures.onNodePointerDown(event); }
function onPointerDown(event) { return gestures.onPointerDown(event); }
function onPointerMove(event) { return gestures.onPointerMove(event); }
function onPointerUp(event) { return gestures.onPointerUp(event); }
function onWheel(event) { return gestures.onWheel(event); }

const shortcuts = createShortcuts({
  getDoc: () => doc,
  setDoc: (next) => { doc = next; },
  getSelection: () => selection,
  setSelection: (next) => { selection = next; },
  getSelectedEdge: () => selectedEdge,
  setSelectedEdge: (next) => { selectedEdge = next; },
  setSpaceHeld: (value) => { spaceHeld = value; },
  pushHistory,
  undo,
  redo,
  render,
  updateSelectionUi,
  layer,
  toast,
  fitCanvas,
  copySelected,
  pasteNode,
  duplicateSelected,
  disconnect,
  findNode,
  removeNode,
  removeReference,
});

function onKeyDown(event) { return shortcuts.onKeyDown(event); }

const historyState = createHistory({
  limit: HISTORY_LIMIT,
  getDoc: () => doc,
  setDoc: (next) => { doc = next; },
  onRestore: () => { selection = new Set(); render(); },
  toast,
});

function pushHistory() { historyState.push(); }
function undo() { historyState.undo(); }
function redo() { historyState.redo(); }

const clipboardActions = createClipboardActions({
  getSelectedNode: () => {
    const id = [...selection][0];
    return id ? findNode(doc, id) : null;
  },
  getClipboard: () => clipboard,
  setClipboard: (value) => { clipboard = value; },
  pushHistory,
  addNodeToDoc: (node) => { doc = addNode(doc, node); return doc; },
  render,
  toast,
  onPasted: (node) => { if (node) selection = new Set([node.id]); },
});

function copySelected() { return clipboardActions.copy(); }
function pasteNode() { return clipboardActions.paste(); }
function duplicateSelected() { return clipboardActions.duplicate(); }

function onPromptInput() {
  const id = [...selection][0];
  if (!id) return;
  const node = findNode(doc, id);
  if (!node) return;
  if (node.generation) doc = updateNode(doc, id, { generation: { prompt: promptEl.value } });
  else if (node.type === 'text') {
    doc = updateNode(doc, id, { text: promptEl.value });
    const textEl = layer.querySelector(`.cv-node[data-id="${id}"] .cv-text-inner`);
    if (textEl) textEl.textContent = promptEl.value;
  }
  persist(false);
}

function zoomBy(factor) {
  const center = { x: stage.clientWidth / 2, y: stage.clientHeight / 2 };
  doc.viewport = zoomAt(doc.viewport, center, doc.viewport.zoom * factor);
  applyViewport();
  persist(false);
}

function fitCanvas() {
  doc.viewport = fitViewport(doc.nodes, { width: stage.clientWidth, height: stage.clientHeight }, 120);
  applyViewport();
  persist(false);
}

let providerHealth = {};

async function probeProviders() {
  const pill = app.querySelector('#dockBackend');
  try {
    const response = await fetch('/api/generation/providers');
    const data = await response.json();
    providerHealth = data;
    if (data.comfyui045?.ok) {
      pill.textContent = `后端：ComfyUI 0.45（8190）${data.comfyui045.version ? ' · v' + data.comfyui045.version : ''}`;
      pill.classList.add('accent');
      pill.disabled = false;
    } else if (data.comfyui?.ok) {
      pill.textContent = `后端：ComfyUI ${data.comfyui.version ? 'v' + data.comfyui.version : ''}`.trim();
      pill.classList.add('accent');
      pill.disabled = false;
    } else {
      pill.textContent = '后端：ComfyUI 未连接';
      pill.disabled = true;
    }
  } catch {
    pill.textContent = '后端：生成服务未启动';
    pill.disabled = true;
  }
}

function showPresetMenu(node) {
  showContextMenu(Object.keys(IMAGE_PRESETS).map((label) => [label, () => {
    promptEl.value = `${promptEl.value ? promptEl.value + '\n' : ''}${IMAGE_PRESETS[label]}`;
    onPromptInput();
    toast(`已加入预设：${label}`);
  }]), 420, 300);
}

function showImageToolMenu(node) {
  showContextMenu([
    ['电影级镜头设计', () => {
      promptEl.value = `${promptEl.value ? promptEl.value + '，' : ''}电影级镜头设计，35mm 胶片质感，浅景深，自然侧光，构图克制`;
      onPromptInput();
      toast('已加入镜头设计提示词');
    }],
    ['来点灵感', () => {
      const sparks = ['黄昏逆光，空气中有尘埃颗粒', '低机位广角，人物居中，强烈对称', '雨夜霓虹反射，湿润地面，冷色调'];
      promptEl.value = `${promptEl.value ? promptEl.value + '，' : ''}${sparks[Math.floor(Math.random() * sparks.length)]}`;
      onPromptInput();
      toast('已加入灵感提示词');
    }],
  ], 420, 300);
}

const waveCache = new Map();

async function peaksFor(url) {
  if (waveCache.has(url)) return waveCache.get(url);
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const audio = await ctx.decodeAudioData(buffer);
  const data = audio.getChannelData(0);
  const bars = 500;
  const step = Math.max(1, Math.floor(data.length / bars));
  const peaks = [];
  for (let i = 0; i < bars; i += 1) {
    let max = 0;
    for (let j = 0; j < step; j += 1) max = Math.max(max, Math.abs(data[i * step + j] || 0));
    peaks.push(max);
  }
  const result = { peaks, duration: audio.duration };
  waveCache.set(url, result);
  ctx.close?.();
  return result;
}

function drawWave(canvas, peaks, start = 0, end = null, duration = null) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const total = peaks.length;
  const span = duration || end || 1;
  const from = Math.max(0, Math.min(total, Math.floor((start / span) * total)));
  const to = Math.max(from, Math.min(total, Math.ceil(((end ?? span) / span) * total)));
  ctx.fillStyle = 'rgba(110,150,200,.45)';
  for (let i = 0; i < total; i += 1) {
    const x = (i / total) * w;
    const amp = Math.max(1, peaks[i] * h * 0.9);
    ctx.fillRect(x, (h - amp) / 2, Math.max(1, w / total - 1), amp);
  }
  ctx.fillStyle = 'rgba(120,180,255,.9)';
  for (let i = from; i < to; i += 1) {
    const x = (i / total) * w;
    const amp = Math.max(1, peaks[i] * h * 0.9);
    ctx.fillRect(x, (h - amp) / 2, Math.max(1, w / total - 1), amp);
  }
}

function renderAudioWaveforms() {
  for (const canvas of layer.querySelectorAll('.cv-wave')) {
    if (canvas.dataset.drawn) continue;
    canvas.dataset.drawn = '1';
    const url = canvas.dataset.audioUrl;
    peaksFor(url).then((result) => {
      canvas.width = 280;
      canvas.height = 54;
      drawWave(canvas, result.peaks, 0, result.duration, result.duration);
    }).catch(() => {});
  }
}

const trimTools = createTrimTools({
  app,
  getNode: (id) => findNode(doc, id),
  commitResource,
  setNode: (id, patch) => { doc = updateNode(doc, id, patch); },
  render,
  toast,
  peaksFor,
  drawWave,
});

function openVideoTrim(node) { return trimTools.openVideo(node); }
function drawVideoTrimInfo() { return trimTools.drawVideoInfo(); }
function confirmVideoTrim() { return trimTools.confirmVideo(); }
function openAudioTrim(node) { return trimTools.openAudio(node); }
function drawTrimWave() { return trimTools.drawAudioInfo(); }
function confirmAudioTrim() { return trimTools.confirmAudio(); }

const maskEditor = createMaskEditor({
  app,
  setNode: (id, patch) => { doc = updateNode(doc, id, patch); },
  render,
  toast,
  getPrompt: () => promptEl.value,
  uploadDataUrl,
  submitJob,
  pollJob,
});

function openMaskEditor(node) { return maskEditor.open(node); }
function closeMaskEditor() { return maskEditor.close(); }
async function confirmInpaint() { return maskEditor.confirm(); }

function outpaintMenu(node) { return imageActions.outpaintMenu(node, showContextMenu); }

async function translateLightPrompt(text) {
  try {
    const response = await fetch('/api/generation/prompt/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: text }) });
    const data = await response.json();
    return response.ok && data.translated ? data.translated : text;
  } catch { return text; }
}

const imageActions = createImageActions({
  submitJob,
  pollJob,
  setNode: (id, patch) => { doc = updateNode(doc, id, patch); render(); },
  toast,
  getPrompt: () => promptEl.value.trim(),
  translate: translateLightPrompt,
});

async function addResourceNode(sourceNode, type, resource, title) {
  pushHistory();
  const rect = nodeRect(sourceNode);
  doc = addNode(doc, {
    type,
    title,
    layout: { x: Math.round(rect.x + rect.width + 48), y: Math.round(rect.y), width: type === 'audio' ? 320 : 569, height: 320 },
    resources: [{ id: resource.filename, type: resource.type, url: resource.url, source: 'extract' }],
    generation: type === 'image' ? { mode: 'i2i', prompt: '', model: 'comfyui', ratio: '16:9', resolution: '2K', outputCount: 1 } : { mode: 'tts', prompt: '', model: 'dreamina', ratio: '16:9', resolution: '2K', outputCount: 1 },
  });
  selection = new Set([doc.nodes.at(-1).id]);
  render();
}

const mediaExtract = createMediaExtract({ addResourceNode, toast });

async function extractVideoFrame(node) { return mediaExtract.frame(node); }
async function extractVideoAudio(node) { return mediaExtract.audio(node); }

async function upscaleVideo(node) {
  const media = node?.resources?.[0];
  if (!media?.url) { toast('视频还没有生成'); return; }
  doc = updateNode(doc, node.id, { status: 'running', progress: 0, jobMessage: 'RelayVSR 超分中…' });
  render();
  try {
    const data = await submitJob({ kind: 'comfyui-relayvsr', videoUrl: media.url, detail: 1 });
    toast('已提交视频超分');
    pollJob(data.id, node.id);
  } catch (error) {
    doc = updateNode(doc, node.id, { status: 'failed', error: error.message || String(error) });
    render();
    toast(error.message || String(error), true);
  }
}

function relightMenu(node) { return imageActions.relightMenu(node, showContextMenu); }

async function startRelight(node, variant) { return imageActions.relight(node, variant); }
async function startMatte(node) { return imageActions.matte(node); }
async function startPostProcess(node, mode) { return imageActions.postProcess(node, mode); }

const generationSubmit = createGenerationSubmit({
  getNodeById: (id) => findNode(doc, id),
  getPrompt: () => promptEl.value,
  setNode: (id, patch) => { doc = updateNode(doc, id, patch); },
  render,
  toast,
  submitJob,
  pollJob,
  probeProviders,
  setSendDisabled: (disabled) => { app.querySelector('#dockSend').disabled = disabled; },
  frameRefs: videoFrameRefs,
  comfyImageSize,
  rememberModelParams,
  startAudioQuote,
  startVideoQuote,
  startComfyVideo,
  startImageQuote,
});

async function generateSelected() {
  const node = [...selection][0] ? findNode(doc, [...selection][0]) : null;
  return generationSubmit.generate(node);
}

function openBackendMenu() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node?.generation) { toast('先选中一个生成节点'); return; }
  const current = node.generation?.backend?.provider || (node.type === 'image' ? 'comfyui' : 'dreamina');
  const options = node.type === 'audio'
    ? [['即梦 API（唯一）', 'dreamina']]
    : [['ComfyUI（本地/远程）', 'comfyui'], ['即梦 API', 'dreamina']];
  const button = app.querySelector('#dockBackendMode');
  const rect = button.getBoundingClientRect();
  showContextMenu(options.map(([label, provider]) => [`${provider === current ? '✓ ' : ''}${label}`, () => {
    if (provider === current) return;
    doc = updateNode(doc, node.id, { generation: { backend: { provider, instance: provider === 'comfyui' ? 'comfyui' : 'dreamina' } } });
    render();
    toast(`生成后端：${provider === 'comfyui' ? 'ComfyUI' : '即梦 API'}`);
  }]), rect.left, Math.max(80, rect.top - 110));
}

function toggleVideoBackend() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node || !['video', 'image', 'audio'].includes(node.type)) return;
  if (node.type === 'audio') { toast('音频只有即梦 API，没有 ComfyUI 后端'); return; }
  const current = node.generation?.backend?.provider || (node.type === 'image' ? 'comfyui' : 'dreamina');
  const next = current === 'comfyui' ? 'dreamina' : 'comfyui';
  doc = updateNode(doc, node.id, { generation: { backend: { provider: next, instance: next === 'comfyui' ? 'comfyui' : 'dreamina' }, ...(next === 'comfyui' && node.type === 'video' ? { model: 'h3', durationSeconds: 5 } : {}) } });
  render();
  const label = node.type === 'image' ? '图片' : '视频';
  toast(next === 'comfyui' ? `已切换到 ComfyUI ${label}后端` : `已切换到即梦 API ${label}后端`);
}

function toggleRefMode() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node || node.type !== 'image') return;
  const hasImageRefs = (node.generation?.references || []).some((ref) => findNode(doc, ref.id)?.type === 'image');
  if (!hasImageRefs) { toast('先从图片节点连一条参考线'); return; }
  const order = ['i2i', 'depth', 'canny', 'openpose', 'ipadapter'];
  const current = node.generation?.refMode || 'i2i';
  const next = order[(order.indexOf(current) + 1) % order.length];
  doc = updateNode(doc, node.id, { generation: { refMode: next } });
  render();
  const labels = { i2i: '图生图', depth: 'ControlNet 深度', canny: 'ControlNet 线稿', openpose: 'ControlNet 姿态', ipadapter: 'IPAdapter 风格' };
  toast(`参考方式：${labels[next]}`);
}

function alignSelection(mode) {
  const items = [...selection].map((id) => findNode(doc, id)).filter(Boolean);
  if (items.length < 2) return;
  const positions = alignPositions(items.map((node) => ({ id: node.id, ...nodeRect(node) })), mode);
  pushHistory();
  items.forEach((node, index) => {
    const position = positions[index];
    if (position) doc = moveNode(doc, node.id, position.x, position.y);
  });
  render();
  toast('已对齐');
}

async function loadDreaminaCatalog() {
  try {
    const response = await fetch('/api/generation/models');
    if (!response.ok) return;
    const data = await response.json();
    if (data?.image || data?.video || data?.audio) {
      dreaminaCatalog = { image: data.image || [], video: data.video || [], audio: data.audio || [] };
    }
  } catch { /* CLI 未登录时保留原有菜单 */ }
}

function dreaminaFrameCount(node) {
  return videoFrameRefs(node).last ? 2 : videoFrameRefs(node).first ? 1 : 0;
}
function dreaminaSpecFor(node) { return findDreaminaSpec(node, dreaminaCatalog); }
function dreaminaModeFor(node) { return findDreaminaMode(node, dreaminaCatalog, dreaminaFrameCount(node)); }
function dreaminaValues(node, flag) { return findDreaminaValues(node, flag, dreaminaCatalog, dreaminaFrameCount(node)); }
function dreaminaRange(node, flag, fallbackMin, fallbackMax) { return findDreaminaRange(node, flag, fallbackMin, fallbackMax, dreaminaCatalog, dreaminaFrameCount(node)); }
function dreaminaModelLabel(node) { return findDreaminaModelLabel(node, dreaminaCatalog); }
function chooseDreaminaModel(spec, type) {
  setGeneration(withSavedParams(`${type}:dreamina:${spec.model}`, chooseDreaminaPatch(spec, type)));
}

function modelLabel(node) {
  const provider = node.generation?.backend?.provider || (node.type === 'image' ? 'comfyui' : 'dreamina');
  if (node.type === 'audio') return dreaminaModelLabel(node) || 'SeedAudio 1.0';
  if (provider === 'dreamina') {
    const catalogLabel = dreaminaModelLabel(node);
    if (catalogLabel) return catalogLabel;
    const model = node.generation?.model || '';
    if (node.type === 'image') {
      if (model === 'seedream_4.1') return 'Seedream 4.1';
      if (model === 'jimeng_smart_image_v1') return '即梦 ImageMax';
      return 'Seedream 5.0 Flash';
    }
    return 'Seedance 2.5';
  }
  if (node.type === 'image') {
    const wf = node.generation?.imageWorkflow || '';
    if (wf.startsWith('qwen21-')) return { 'qwen21-t2i': 'Qwen 2.1 T2I', 'qwen21-edit': 'Qwen 2.1 编辑', 'qwen21-rmbg': 'Qwen 2.1 去背景', 'qwen21-pose': 'Qwen 2.1 姿态', 'qwen21-depth': 'Qwen 2.1 深度', 'qwen21-edges': 'Qwen 2.1 线稿' }[wf] || 'Qwen 2.1';
    if (wf === 'zimage-turbo') return 'Z-Image Turbo';
    return wf === 'photoreal-juggernaut' ? 'Juggernaut' : wf === 'photoreal-realvis' ? 'RealVis' : 'Flux';
  }
  const videoModel = node.generation?.model || 'h3';
  if (videoModel === 'wan22') return 'Wan 2.2';
  if (videoModel === 'ltx23') return 'LTX-2.3';
  if (videoModel === 'framepack') return 'FramePack';
  if (videoModel === 'h3-ref2v') return 'H3 Ref2VA';
  if (videoModel === 'h3-ultimate') return 'H3 Ultimate';
  return 'H3';
}

function modelOptions(node) {
  const provider = node.generation?.backend?.provider || (node.type === 'image' ? 'comfyui' : 'dreamina');
  if (node.type === 'audio') {
    const list = dreaminaCatalog.audio.filter((spec) => (spec.modes || []).some((mode) => mode.name === 'tts'));
    return list.length ? list.map((spec) => [spec.displayName, () => setGeneration({ model: spec.model })]) : [['SeedAudio 1.0', () => setGeneration({ model: 'legacy_tts' })]];
  }
  if (provider !== 'dreamina') {
    const mainDown = providerHealth.comfyui && !providerHealth.comfyui.ok;
    return buildModelOptions({ type: node.type, provider }).map((option) => {
      const legacy = !/qwen21|h3-ultimate/.test(option.key);
      return [`${option.label}${mainDown && legacy ? '（8188 停用）' : ''}`, () => setGeneration(withSavedParams(option.key, option.patch))];
    });
  }
  if (node.type === 'image') {
    return dreaminaCatalog.image.length
      ? dreaminaCatalog.image.map((spec) => [`${spec.displayName}`, () => chooseDreaminaModel(spec, 'image')])
      : [['Seedream 5.0 Flash', () => setGeneration({ model: 'high_aes_general_v50_flash' })], ['Seedream 4.1', () => setGeneration({ model: 'seedream_4.1' })], ['即梦 ImageMax 1.0', () => setGeneration({ model: 'jimeng_smart_image_v1' })]];
  }
  return dreaminaCatalog.video.length
    ? dreaminaCatalog.video.map((spec) => [`${spec.displayName}`, () => chooseDreaminaModel(spec, 'video')])
    : [['Seedance 2.5', () => setGeneration({ model: 'seedance_2.5_draft' })], ['Seedance 2.5 Flash', () => setGeneration({ model: 'seedance_2.5_flash' })], ['Seedance 2.5 VIP', () => setGeneration({ model: 'seedance_2.5' })]];
}

const MODEL_DEFAULTS_KEY = 'zaomeng-canvas2:model-defaults';

function readModelDefaults() {
  try { return JSON.parse(localStorage.getItem(MODEL_DEFAULTS_KEY) || '{}'); } catch { return {}; }
}

function defaultsKey(node) {
  const provider = node.generation?.backend?.provider || (node.type === 'image' ? 'comfyui' : 'dreamina');
  return modelDefaultsKey({ type: node.type, provider, model: node.generation?.model, workflow: node.generation?.imageWorkflow });
}

function savedParamsFor(key) {
  return pickSavedParams(readModelDefaults()[key]);
}

function rememberModelParams(node) {
  if (!node?.generation) return;
  const key = defaultsKey(node);
  const all = readModelDefaults();
  all[key] = {
    ratio: node.generation.ratio,
    resolution: node.generation.resolution,
    durationSeconds: node.generation.durationSeconds,
    outputCount: node.generation.outputCount,
    megapixels: node.generation.megapixels,
  };
  try { localStorage.setItem(MODEL_DEFAULTS_KEY, JSON.stringify(all)); } catch { /* 忽略 */ }
}

function withSavedParams(key, patch) {
  return { ...patch, ...savedParamsFor(key) };
}

function estimateFor(node) {
  return estimateForModel(defaultsKey(node));
}

function setGeneration(patch) {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node) return;
  pushHistory();
  doc = updateNode(doc, node.id, { generation: patch });
  render();
}

function comfyImageSize(node) {
  const ratio = node?.generation?.ratio || '16:9';
  const resolution = node?.generation?.resolution || '1024 高清';
  const base = String(resolution).includes('768') ? 768 : 1024;
  const [w, h] = ratio.split(':').map(Number);
  const safeW = Number.isFinite(w) && w > 0 ? w : 16;
  const safeH = Number.isFinite(h) && h > 0 ? h : 9;
  const scale = base / Math.sqrt(safeW * safeH);
  return {
    width: Math.round((safeW * scale) / 64) * 64,
    height: Math.round((safeH * scale) / 64) * 64,
  };
}

function openDurationMenu() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node || node.type !== 'video') return;
  const button = app.querySelector('#dockDuration');
  const rect = button.getBoundingClientRect();
  showContextMenu([5, 10, 15].map((seconds) => [`${seconds}s`, () => {
    doc = updateNode(doc, node.id, { generation: { durationSeconds: seconds } });
    render();
    toast(`${seconds} 秒`);
  }]), rect.left, Math.max(80, rect.top - 120));
}

function openRefModeMenu() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node || node.type !== 'image') return;
  const refs = (node.generation?.references || []).filter((ref) => findNode(doc, ref.id)?.type === 'image');
  if (!refs.length) { toast('先从图片节点连一条参考线'); return; }
  const options = [['i2i', '图生图'], ['depth', 'ControlNet 深度'], ['canny', 'ControlNet 线稿'], ['openpose', 'ControlNet 姿态'], ['ipadapter', 'IPAdapter 风格']];
  const button = app.querySelector('#dockRefMode');
  const rect = button.getBoundingClientRect();
  showContextMenu(options.map(([value, label]) => [label, () => {
    doc = updateNode(doc, node.id, { generation: { refMode: value } });
    render();
    toast(`参考方式：${label}`);
  }]), rect.left, Math.max(80, rect.top - 190));
}

function pictureResolutions(node) {
  const provider = node.generation?.backend?.provider || (node.type === 'image' ? 'comfyui' : 'dreamina');
  if (provider === 'dreamina') {
    const values = dreaminaValues(node, '--resolution');
    if (values.length) return values;
  }
  if (node.type === 'image') return ['768 标准', '1024 高清'];
  if (node.type === 'video') return ['360P', '480P'];
  return ['标准'];
}

function pictureCountRange(node) {
  const max = dreaminaRange(node, '--count', 1, node.type === 'image' ? 8 : 4).max;
  const min = dreaminaRange(node, '--count', 1, 8).min;
  return { min, max };
}

const picturePopover = createPicturePopover({
  app,
  dock,
  getNode: () => {
    const node = [...selection][0] ? findNode(doc, [...selection][0]) : null;
    return node?.generation ? node : null;
  },
  toast,
  resolutionOptions: pictureResolutions,
  countRange: pictureCountRange,
  onChange: (node, patch) => {
    doc = updateNode(doc, node.id, { generation: patch });
    render();
    const next = findNode(doc, node.id);
    if (next) picturePopover.render(next);
  },
});

function openParamMenu(kind) {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node?.generation) { toast('先选中一个生成节点'); return; }
  const provider = node.generation?.backend?.provider || (node.type === 'image' ? 'comfyui' : 'dreamina');
  let items = [];
  if (kind === 'model') items = modelOptions(node);
  if (kind === 'ratio') {
    const values = node.type === 'video' ? ['16:9', '9:16', '1:1'] : ['16:9', '1:1', '3:4', '4:3', '9:16', '21:9'];
    items = values.map((value) => [value, () => setGeneration({ ratio: value })]);
  }
  if (kind === 'resolution') {
    let values;
    if (provider === 'dreamina') values = dreaminaValues(node, '--resolution');
    if (!values?.length) values = node.type === 'image' ? (provider === 'dreamina' ? ['1.5K', '2K'] : ['768 标准', '1024 高清']) : node.type === 'video' ? (provider === 'dreamina' ? ['480P', '720P', '1080P'] : ['360P', '480P']) : ['标准'];
    items = values.map((value) => [value, () => setGeneration({ resolution: value, h3Size: node.type === 'video' ? value : node.generation?.h3Size })]);
  }
  if (kind === 'count') {
    const values = node.type === 'image' ? [1, 2, 4, 8] : [1, 2, 3, 4];
    const max = node.type === 'image' ? dreaminaRange(node, '--count', 1, 8).max : dreaminaRange(node, '--count', 1, 4).max;
    items = values.filter((value) => value <= max).map((value) => [`${value} 个`, () => setGeneration({ outputCount: value })]);
  }
  if (!items.length) return;
  const button = app.querySelector(kind === 'model' ? '#dockModel' : kind === 'ratio' ? '#dockRatio' : kind === 'resolution' ? '#dockRes' : '#dockCount');
  const rect = button.getBoundingClientRect();
  showContextMenu(items, rect.left, Math.max(80, rect.top - items.length * 34 - 12));
}

function toggleImageModel() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node || node.type !== 'image') return;
  const order = ['', 'photoreal-juggernaut', 'photoreal-realvis'];
  const current = node.generation?.imageWorkflow || '';
  const next = order[(order.indexOf(current) + 1) % order.length];
  doc = updateNode(doc, node.id, { generation: { imageWorkflow: next } });
  render();
  toast(next ? `写实模型：${next === 'photoreal-juggernaut' ? 'JuggernautXL' : 'RealVisXL'}` : '图像模型：Flux.1');
}

function toggleVideoDuration() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node || node.type !== 'video') return;
  const presets = [5, 10, 15];
  const current = node.generation?.durationSeconds || 5;
  const next = presets[(presets.indexOf(current) + 1) % presets.length] ?? 5;
  doc = updateNode(doc, node.id, { generation: { durationSeconds: next } });
  render();
  toast(next > 5 ? `${next}s 时长：即梦会按秒计费；H3 长时长更慢、显存压力更大` : '5s 时长');
}

function toggleH3Resolution() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node || node.type !== 'video' || node.generation?.backend?.provider !== 'comfyui') return;
  const next = node.generation?.h3Size === '480P' ? '360P' : '480P';
  doc = updateNode(doc, node.id, { generation: { h3Size: next } });
  render();
  toast(next === '480P' ? 'H3 480P（848×480）尚未在 Windows 做基准，可能更慢或 OOM' : 'H3 360P（640×352）');
}

function videoFrameRefs(node) {
  const entries = (node.generation?.references || [])
    .map((ref) => ({ ref, resource: findNode(doc, ref.id)?.resources?.[0] }))
    .filter((entry) => entry.resource?.url && entry.resource.type === 'image');
  const first = entries.find((entry) => entry.ref.role === '首帧') || entries[0] || null;
  const last = entries.find((entry) => entry.ref.role === '尾帧') || entries.find((entry) => entry !== first) || null;
  return { first, last };
}

function videoReferenceAssets(node) {
  return (node.generation?.references || [])
    .map((ref) => ({ ref, node: findNode(doc, ref.id) }))
    .filter((entry) => entry.node?.resources?.[0]?.url)
    .sort((a, b) => (Number(a.ref.index) || 0) - (Number(b.ref.index) || 0))
    .map((entry) => ({ ...entry.node.resources[0], nodeType: entry.node.type, role: entry.ref.role || '' }));
}

const comfyVideoSubmit = createComfyVideoSubmit({
  getPrompt: () => promptEl.value,
  rememberModelParams,
  toast,
  getFrames: videoFrameRefs,
  getReferenceAssets: videoReferenceAssets,
  getImageRefEntries: (node) => (node.generation?.references || []).map((ref) => ({ ref, node: findNode(doc, ref.id) })).filter((entry) => entry.node?.resources?.[0]?.url && entry.node.type === 'image'),
  setNode: (id, patch) => { doc = updateNode(doc, id, patch); },
  render,
  submitJob,
  pollJob,
});

async function startComfyVideo(node) { return comfyVideoSubmit.start(node); }

function buildImageQuotePayload(node, prompt) {
  const allowed = dreaminaValues(node, '--resolution');
  return {
    prompt,
    model: node.generation?.model || undefined,
    ratio: node.generation?.ratio || '16:9',
    resolution: allowed.length && !allowed.includes(node.generation?.resolution) ? allowed[0] : (node.generation?.resolution || '2K'),
    count: Math.min(node.generation?.outputCount || 1, dreaminaRange(node, '--count', 1, 4).max),
  };
}

function buildVideoQuotePayload(node, prompt) {
  const allowed = dreaminaValues(node, '--resolution');
  const raw = String(node.generation?.resolution || '480p');
  const range = dreaminaRange(node, '--duration', 4, 15);
  return {
    prompt,
    model: node.generation?.model && node.generation.model !== 'h3' ? node.generation.model : undefined,
    firstFrameUrl: videoFrameRefs(node).first?.resource?.url || undefined,
    lastFrameUrl: videoFrameRefs(node).last?.resource?.url || undefined,
    ratio: node.generation?.ratio || '16:9',
    resolution: allowed.length && !allowed.includes(raw) && !allowed.includes(raw.toLowerCase()) ? allowed[0] : raw.toLowerCase(),
    duration: Math.min(Math.max(node.generation?.durationSeconds || 4, range.min), range.max),
  };
}

function buildAudioQuotePayload(node, prompt) {
  return { prompt, model: node.generation?.model || 'legacy_tts', voiceName: node.generation?.voiceName || undefined };
}

const generationFlow = createGenerationFlow({
  requestQuote,
  submitJob,
  pollJob,
  setNode: (id, patch) => { doc = updateNode(doc, id, patch); render(); },
  toast,
  showQuote: (quote, label) => openQuote(quote, label),
  buildImagePayload: buildImageQuotePayload,
  buildVideoPayload: buildVideoQuotePayload,
  buildAudioPayload: buildAudioQuotePayload,
});

async function startImageQuote(node) {
  rememberModelParams(node);
  const prompt = promptEl.value.trim();
  if (!prompt) { toast('先写提示词'); return; }
  await generationFlow.startImage(node, prompt);
}

async function startVideoQuote(node) {
  rememberModelParams(node);
  const prompt = promptEl.value.trim();
  if (!prompt) { toast('先写提示词'); return; }
  await generationFlow.startVideo(node, prompt);
}

async function startAudioQuote(node) {
  const prompt = promptEl.value.trim();
  if (!prompt) { toast('先写台词 / 声音描述'); return; }
  await generationFlow.startAudio(node, prompt);
}

function openQuote(quote, label = '即梦视频') {
  const modal = app.querySelector('#quoteModal');
  modal.classList.add('open');
  const parts = [label, quote.model || '', quote.voiceName ? `音色：${quote.voiceName}` : ''];
  if (quote.duration) parts.push(`${quote.duration}s`);
  if (quote.ratio) parts.push(quote.ratio);
  if (quote.resolution) parts.push(quote.resolution);
  app.querySelector('#quoteMeta').textContent = parts.filter(Boolean).join(' · ');
  app.querySelector('#quoteText').textContent = '确认后将从你的即梦账号扣除相应积分，失败不重复扣费。';
  app.querySelector('#quoteCredits').textContent = `预计消耗：${quote.credits ?? '—'} 积分`;
  app.querySelector('#quoteConfirm').onclick = () => closeQuote(true);
}

function closeQuote(confirmed) {
  app.querySelector('#quoteModal').classList.remove('open');
  generationFlow.confirm(confirmed);
}

let jobsRefreshTimer = null;
const pollingJobs = new Set();
let resumedJobs = false;

async function refreshJobsPanel() {
  const host = app.querySelector('#jobsList');
  if (!host) return;
  try {
    const list = await listJobs({ limit: 30 });
    host.innerHTML = jobsListHtml(list);
    host.querySelectorAll('[data-job-cancel]').forEach((button) => button.addEventListener('click', async () => {
      const row = button.closest('[data-job]');
      button.disabled = true;
      await cancelJob(row.dataset.job).catch(() => null);
      await refreshJobsPanel();
    }));
    host.querySelectorAll('[data-job-retry]').forEach((button) => button.addEventListener('click', async () => {
      const row = button.closest('[data-job]');
      button.disabled = true;
      const result = await retryJob(row.dataset.job).catch(() => null);
      if (!result) toast('重试失败', true);
      await refreshJobsPanel();
    }));
  } catch {
    host.innerHTML = '<div class="cv-status">读取任务失败，请检查本地服务。</div>';
  }
}

function openJobsPanel() {
  app.querySelector('#jobsModal').classList.add('open');
  refreshJobsPanel();
  window.clearInterval(jobsRefreshTimer);
  jobsRefreshTimer = window.setInterval(() => {
    if (app.querySelector('#jobsModal')?.classList.contains('open')) refreshJobsPanel();
  }, 2000);
}

function closeJobsPanel() {
  app.querySelector('#jobsModal').classList.remove('open');
  window.clearInterval(jobsRefreshTimer);
  jobsRefreshTimer = null;
}

async function pollJob(jobId, nodeId) {
  if (pollingJobs.has(jobId)) return;
  pollingJobs.add(jobId);
  doc = updateNode(doc, nodeId, { jobId });
  let missing = false;
  try {
    const job = await waitForJob(jobId, {
      onUpdate: (current) => {
        if (!findNode(doc, nodeId)) { missing = true; return; }
        if (['success', 'failed', 'canceled'].includes(current.status)) return;
        doc = updateNode(doc, nodeId, { status: 'running', progress: current.progress || 0 });
        render();
      },
    });
    if (missing || !findNode(doc, nodeId)) return;
    if (job.status === 'success' && job.result) {
      commitResource(nodeId, { id: job.result.filename, type: job.result.type || 'image', url: job.result.url, source: job.result.provider || 'comfyui' });
      doc = updateNode(doc, nodeId, { status: 'success', progress: 100 });
      render();
      toast('生成完成');
    } else {
      doc = updateNode(doc, nodeId, { status: job.status === 'canceled' ? 'canceled' : 'failed', error: job.message || job.error?.message || '生成失败' });
      render();
      toast(job.message || '生成失败', job.status !== 'canceled');
    }
  } catch (error) {
    if (findNode(doc, nodeId)) {
      doc = updateNode(doc, nodeId, { status: 'failed', error: error.message || String(error) });
      render();
      toast(error.message || String(error), true);
    }
  } finally { pollingJobs.delete(jobId); }
}

async function resumePendingJobs() {
  if (resumedJobs) return;
  resumedJobs = true;
  const pending = doc.nodes.filter((node) => node.status === 'running' && node.jobId);
  for (const node of pending) {
    if (pollingJobs.has(node.jobId)) continue;
    try {
      const job = await getJob(node.jobId);
      if (!job) { doc = updateNode(doc, node.id, { status: 'failed', error: '任务已失效' }); render(); continue; }
      if (job.status === 'success' && job.result) {
        commitResource(node.id, { id: job.result.filename, type: job.result.type || 'image', url: job.result.url, source: job.result.provider || 'comfyui' });
        doc = updateNode(doc, node.id, { status: 'success', progress: 100 });
        render();
      } else if (job.status === 'failed' || job.status === 'canceled') {
        doc = updateNode(doc, node.id, { status: 'failed', error: job.message || job.error?.message || '任务已结束' });
        render();
      } else {
        pollJob(node.jobId, node.id);
      }
    } catch { /* 服务未就绪时等下次 */ }
  }
}

async function refreshProviderStatus() {
  await probeProviders();
}

function renderNodeTools(node) {
  const tools = app.querySelector('#nodeTools');
  if (!node) { tools.classList.remove('open'); tools.innerHTML = ''; return; }
  tools.innerHTML = nodeToolsHtml(node);
  tools.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => onNodeTool(node, button.dataset.tool));
  });
  tools.classList.add('open');
  positionNodeTools();
}

function positionNodeTools() {
  const tools = app.querySelector('#nodeTools');
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node) { tools.classList.remove('open'); return; }
  const rect = nodeRect(node);
  const screen = worldToScreen({ x: rect.x + rect.width / 2, y: rect.y }, doc.viewport);
  tools.style.left = `${screen.x}px`;
  tools.style.top = `${screen.y - 8}px`;
}

const runNodeAction = createNodeActions({
  remove: (node) => { doc = removeNode(doc, node.id); selection = new Set(); render(); toast('已删除'); },
  copy: () => copySelected(),
  download: downloadNode,
  versions: (node) => openVersions(node),
  audioQuote: (node) => startAudioQuote(node),
  audioTrim: (node) => openAudioTrim(node),
  postProcess: (node, mode) => startPostProcess(node, mode),
  maskEditor: (node) => openMaskEditor(node),
  matte: (node) => startMatte(node),
  relightMenu: (node) => relightMenu(node),
  outpaintMenu: (node) => outpaintMenu(node),
  presetMenu: (node) => showPresetMenu(node),
  imageToolMenu: (node) => showImageToolMenu(node),
  videoTrim: (node) => openVideoTrim(node),
  extractFrame: (node) => extractVideoFrame(node),
  extractAudio: (node) => extractVideoAudio(node),
  relayVSR: (node) => upscaleVideo(node),
  openTimeline: (node) => openTimeline(node),
  openStage: () => openDirectorStage(),
  smartEdit: async (node) => {
    const hasRefs = (node.generation?.references || []).some((ref) => findNode(doc, ref.id)?.type === 'image');
    if (!hasRefs) { toast('先从图片节点连一条参考线'); return; }
    if (!promptEl.value.trim()) { promptEl.focus(); toast('写一句改图要求，再点一次「智能改图」'); return; }
    if (!node.generation?.refMode) doc = updateNode(doc, node.id, { generation: { refMode: 'i2i' } });
    await generateSelected();
  },
  fallback: (tool) => toast(`${tool} 将在后续接入`),
});

async function onNodeTool(node, tool) { return runNodeAction(node, tool); }

function renderDockChips(node) {
  const chips = app.querySelector('#dockChips');
  if (!node) { chips.innerHTML = ''; return; }
  const presets = {
    image: ['相机', '配色', '风格'],
    video: ['配色', '风格', '运镜'],
    audio: ['音频生成', '全能配音', '音色库'],
  }[node.type] || [];
  const refs = node.generation?.references || [];
  const gen = node.generation || {};
  const active = { 相机: Boolean(gen.camera), 配色: Boolean(gen.palette), 风格: Boolean(gen.style) };
  chips.innerHTML = [
    ...presets.map((label) => `<button class="cv-chip${active[label] ? ' active' : ''}" data-preset="${label}">${label}</button>`),
    ...refs.map((ref) => `<button class="cv-chip ref" data-ref="${ref.id}" title="点击设置引用角色">${escapeHtml(referenceLabel(ref.index ?? 0, ref.type))}${ref.role && ref.role !== '通用' ? ` · ${escapeHtml(ref.role)}` : ''}<span class="cv-chip-x">×</span></button>`),
  ].join('');
  chips.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = button.dataset.preset;
      if (preset === '音色库') { openVoicePicker(node.id); return; }
      if (preset === '相机') { openCameraModal(node); return; }
      if (preset === '配色') { openPaletteModal(node); return; }
      if (preset === '风格') { openStyleModal(node); return; }
      if (preset === '运镜') { openCameraMoveMenu(node); return; }
      if (preset === '音频生成') { startAudioQuote(node); return; }
      if (preset === '全能配音') { openVoicePicker(node.id); return; }
      toast(`${preset}预设将在后续接入`);
    });
  });
  chips.querySelectorAll('[data-ref]').forEach((button) => {
    button.addEventListener('click', () => {
      const ref = refs.find((item) => item.id === button.dataset.ref);
      if (!ref) return;
      const label = referenceLabel(ref.index ?? 0, ref.type);
      showContextMenu([
        ['插入引用文字', () => insertReference(label)],
        ['角色：通用', () => setReferenceRole(node, ref.id, '通用')],
        ['角色：人物', () => setReferenceRole(node, ref.id, '人物')],
        ['角色：构图', () => setReferenceRole(node, ref.id, '构图')],
        ['角色：风格', () => setReferenceRole(node, ref.id, '风格')],
        ['角色：首帧', () => setReferenceRole(node, ref.id, '首帧')],
        ['角色：尾帧', () => setReferenceRole(node, ref.id, '尾帧')],
        ['sep'],
        ['上移引用', () => moveReference(node, ref.id, -1)],
        ['下移引用', () => moveReference(node, ref.id, 1)],
        ['sep'],
        ['移除引用', () => removeNodeReference(node, ref.id)],
      ], 420, 300);
    });
  });
}

function appendPrompt(text) {
  const value = promptEl.value.trimEnd();
  promptEl.value = `${value}${value ? '\n' : ''}${text}`;
  onPromptInput();
  promptEl.focus();
}

const styleTools = createStyleTools({
  app,
  getNode: (id) => (id ? findNode(doc, id) : (([...selection][0]) ? findNode(doc, [...selection][0]) : null)),
  updateNode: (id, patch) => { doc = updateNode(doc, id, patch); },
  appendPrompt,
  render,
  toast,
});

function openCameraModal(node) { return styleTools.openCamera(node); }
function applyCamera() { return styleTools.applyCamera(); }
function openPaletteModal(node) { return styleTools.openPalette(node); }
function applyPalette() { return styleTools.applyPalette(); }
function openStyleModal(node) { return styleTools.openStyle(node); }
function applyStyle() { return styleTools.applyStyle(); }
function openCameraMoveMenu() { return styleTools.openCameraMoveMenu(showContextMenu); }

function openMentionMenu(event) {
  const currentId = [...selection][0];
  const current = currentId ? findNode(doc, currentId) : null;
  if (!current) { toast('先选中一个节点'); return; }
  const candidates = doc.nodes.filter((node) => node.id !== current.id);
  showContextMenu(candidates.length ? candidates.map((node) => [`${typeLabel(node.type)} · ${node.title || node.type}`, () => insertMention(current, node)]) : [['没有可引用节点', null, false, true]], event.clientX, event.clientY);
}

function insertMention(current, source) {
  const refs = current.generation?.references || [];
  const label = referenceLabel(refs.length, source.type);
  try {
    if (current.generation && (current.type === 'image' || current.type === 'video') && (source.type === 'image' || source.type === 'video' || source.type === 'audio')) {
      const mode = mentionMode({ currentType: current.type, currentMode: current.generation.mode, sourceType: source.type });
      if (mode !== current.generation.mode) doc = updateNode(doc, current.id, { generation: { mode } });
      pushHistory();
      doc = connect(doc, source.id, current.id).doc;
      doc = addReference(doc, current.id, { id: source.id, type: source.type });
      appendPrompt(label);
      render();
      toast('已引用节点');
      return;
    }
  } catch (error) {
    toast(error.message || String(error), true);
    return;
  }
  appendPrompt(`@${source.title || source.type}`);
}

function commitResource(nodeId, resource) {
  const node = findNode(doc, nodeId);
  if (!node) return;
  const current = node.resources?.[0];
  const versions = [...(node.versions || [])];
  if (current?.url && current.url !== resource.url) versions.unshift({ ...current, createdAt: Date.now() });
  const seen = new Set();
  const next = [];
  for (const item of versions) {
    if (!item?.url || seen.has(item.url)) continue;
    seen.add(item.url);
    next.push(item);
  }
  doc = updateNode(doc, nodeId, { resources: [resource], versions: next.slice(0, 30) });
}

const timelineUI = createTimelineUI({
  app,
  getNodes: () => doc.nodes,
  getNode: (id) => findNode(doc, id),
  updateNode: (id, patch) => { doc = updateNode(doc, id, patch); },
  render,
  toast,
  showContextMenu,
  pushHistory,
  addNodeToDoc: (payload) => {
    pushHistory();
    doc = addNode(doc, payload);
    const added = doc.nodes.at(-1);
    if (added) selection = new Set([added.id]);
    return added?.id || null;
  },
  setSelection: (id) => { selection = id ? new Set([id]) : new Set(); },
  nodeRect,
  embed: EMBED,
  parentWindow: parent,
});

function openTimeline(node) { return timelineUI.open(node); }
function renderTimelineRows() { return timelineUI.renderRows(); }
function splitTimelineClip() { return timelineUI.split(); }
function deleteTimelineClip() { return timelineUI.removeSelected(); }
function playTimelineClip() { return timelineUI.play(); }
function openTimelineExportMenu() { return timelineUI.openExportMenu(); }
function closeTimelineView() { return timelineUI.close(); }
function saveTimeline() { return timelineUI.save(); }

function openVersions(node) { return versionsView.open(node); }

function collectAssets() {
  const map = new Map();
  for (const node of doc.nodes) {
    for (const resource of node.resources || []) {
      if (!resource?.url || map.has(resource.url)) continue;
      map.set(resource.url, { ...resource, nodeTitle: node.title });
    }
  }
  return [...map.values()];
}

const assetsPanel = createAssetsPanel({
  app,
  collectAssets,
  center: () => screenToWorld({ x: stage.clientWidth / 2, y: stage.clientHeight / 2 }, doc.viewport),
  toast,
  onAdd: (node) => {
    pushHistory();
    doc = addNode(doc, node);
    selection = new Set([doc.nodes.at(-1).id]);
    render();
  },
});

function openAssetsPanel() { assetsPanel.open(); }

function applyPromptTemplate(text) {
  promptEl.value = text;
  onPromptInput();
  promptEl.focus();
  toast('已套用提示词模板');
}

function openPromptTemplateMenu() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node?.generation) { toast('先选中一个生成节点'); return; }
  const template = promptTemplateFor({
    type: node.type,
    model: node.generation?.model || '',
    workflow: node.generation?.imageWorkflow || '',
  });
  const rect = app.querySelector('#dockTemplate').getBoundingClientRect();
  showContextMenu([[template.label, () => applyPromptTemplate(template.text)]], rect.left, Math.max(80, rect.top - 100));
}

const promptTools = createPromptTools({
  app,
  getPrompt: () => promptEl.value,
  getNodeType: () => findNode(doc, [...selection][0])?.type,
  toast,
  onApply: (text, options = {}) => {
    promptEl.value = text;
    onPromptInput();
    if (options.optimized) promptEl.focus();
  },
});

function moveReference(node, referenceId, direction) {
  const refs = reorderReferences(node.generation?.references || [], referenceId, direction);
  if (!refs) { toast('已经到边界'); return; }
  doc = updateNode(doc, node.id, { generation: { references: refs } });
  render();
  toast(direction < 0 ? '引用已上移' : '引用已下移');
}

function setReferenceRole(node, referenceId, role) {
  const refs = applyReferenceRole(node.generation?.references || [], referenceId, role);
  doc = updateNode(doc, node.id, { generation: { references: refs } });
  render();
  toast(`引用角色：${role}`);
}

function removeNodeReference(node, referenceId) {
  const edge = findReferenceEdge(doc.edges, referenceId, node.id);
  pushHistory();
  doc = removeReference(doc, node.id, referenceId);
  if (edge) doc = disconnect(doc, edge.id);
  render();
  toast('已移除引用');
}

function insertReference(label) {
  const text = promptEl.value;
  promptEl.value = `${text}${text && !text.endsWith(' ') ? ' ' : ''}${label} `;
  onPromptInput();
  promptEl.focus();
}

function showContextMenu(items, x, y) {
  menuOpenedAt = Date.now();
  const menu = app.querySelector('#ctxMenu');
  menu.innerHTML = contextMenuHtml(items);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.add('open');
  menu.querySelectorAll('button').forEach((button, index) => {
    const entry = actionableMenuEntries(items)[index];
    if (!entry || entry[3]) return;
    button.addEventListener('click', () => { hideContextMenu(); entry[1](); });
  });
}

function downloadNode(node) { return downloadNodeResource(node, toast); }

function onContextMenu(event) {
  event.preventDefault();
  const nodeEl = event.target.closest('.cv-node');
  if (nodeEl) {
    const node = findNode(doc, nodeEl.dataset.id);
    if (!node) return;
    selection = new Set([node.id]);
    updateSelectionUi();
    layer.querySelectorAll('.cv-node').forEach((el) => el.classList.toggle('selected', el.dataset.id === node.id));
    showContextMenu([
      ['复制', copySelected, false, false],
      ['复制副本', duplicateSelected, false, false],
      ['粘贴', pasteNode, false, !clipboard],
      ['下载', () => downloadNode(node), false, !node.resources?.length],
      ['保存到其他画布', () => saveNodeToOtherBoard(node), false, false],
      ['sep'],
      ['重做', redo, false, !historyState.canRedo],
      ['撤销', undo, false, !historyState.canUndo],
      ['删除', () => { pushHistory(); doc = removeNode(doc, node.id); selection = new Set(); render(); }, false, false],
    ], event.clientX, event.clientY);
    return;
  }
  const rect = stage.getBoundingClientRect();
  const world = screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, doc.viewport);
  showContextMenu([
    ['撤销', undo, false, !historyState.canUndo],
    ['重做', redo, false, !historyState.canRedo],
    ['粘贴', pasteNode, false, !clipboard],
    ['sep'],
    ['新建节点', null, true],
    ['文本', () => addNodeAt('text', world)],
    ['图片', () => addNodeAt('image', world)],
    ['视频', () => addNodeAt('video', world)],
    ['音频', () => addNodeAt('audio', world)],
    ['时间线', () => addNodeAt('timeline', world)],
    ['导演台', openDirectorStage],
    ['sep'],
    ['从资产库选择', openAssetsPanel],
    ['本地上传', () => app.querySelector('#cvFileInput').click()],
  ], event.clientX, event.clientY);
}

function renderMultiTools() {
  const tools = app.querySelector('#nodeTools');
  const ids = [...selection];
  const inGroup = ids.length && ids.every((id) => { const group = groupOf(doc, id); return group && ids.every((other) => group.nodeIds.includes(other)); });
  const labels = multiToolLabels(inGroup);
  tools.innerHTML = multiToolsHtml(labels);
  tools.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.tool;
      if (action === '下载') {
        for (const id of selection) downloadNode(findNode(doc, id));
        return;
      }
      if (action === '编组') {
        pushHistory();
        doc = addGroup(doc, [...selection]);
        render();
        toast('已编组');
        return;
      }
      if (action === '解组') {
        const group = ids.length ? groupOf(doc, ids[0]) : null;
        if (group) { pushHistory(); doc = removeGroup(doc, group.id); render(); toast('已解组'); }
        return;
      }
      if (action === '布局') {
        showContextMenu([
          ['左对齐', () => alignSelection('left')],
          ['水平居中', () => alignSelection('centerX')],
          ['右对齐', () => alignSelection('right')],
          ['顶对齐', () => alignSelection('top')],
          ['垂直居中', () => alignSelection('centerY')],
          ['底对齐', () => alignSelection('bottom')],
        ], 440, 380);
        return;
      }
      const items = ids.map((id) => findNode(doc, id)).filter(Boolean);
      if (action === '堆叠') {
        const positions = stackPositions(items.map((node) => ({ id: node.id, ...nodeRect(node) })));
        pushHistory();
        items.forEach((node, index) => { doc = moveNode(doc, node.id, positions[index].x, positions[index].y); });
        render();
        toast('已堆叠');
      }
    });
  });
  tools.classList.add('open');
  const items = [...selection].map((id) => findNode(doc, id)).filter(Boolean);
  if (!items.length) { tools.classList.remove('open'); return; }
  const minX = Math.min(...items.map((node) => nodeRect(node).x));
  const minY = Math.min(...items.map((node) => nodeRect(node).y));
  const maxX = Math.max(...items.map((node) => nodeRect(node).x + nodeRect(node).width));
  const screen = worldToScreen({ x: (minX + maxX) / 2, y: minY }, doc.viewport);
  tools.style.left = `${screen.x}px`;
  tools.style.top = `${screen.y - 8}px`;
}

function hideContextMenu() {
  app.querySelector('#ctxMenu').classList.remove('open');
}

function addNodeAt(type, world) {
  pushHistory();
  if (type === 'text') {
    doc = addNode(doc, { type, title: '文本', layout: { x: Math.round(world.x), y: Math.round(world.y), width: 320, height: 220 }, text: '写一段剧本 / 镜头说明…' });
  } else {
    doc = addNode(doc, {
      type, title: `${typeLabel(type)} 1`,
      layout: { x: Math.round(world.x), y: Math.round(world.y), width: type === 'audio' ? 320 : 569, height: 320 },
      generation: { mode: type === 'video' ? 't2v' : type === 'audio' ? 'tts' : 't2i', prompt: '', model: '未配置后端', ratio: '16:9', resolution: type === 'video' ? '480P' : '2K', durationSeconds: type === 'video' ? 5 : null, outputCount: 1 },
    });
  }
  selection = new Set([doc.nodes.at(-1).id]);
  render();
}

function onLocalUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const url = URL.createObjectURL(file);
  const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
  const world = screenToWorld({ x: stage.clientWidth / 2, y: stage.clientHeight / 2 }, doc.viewport);
  pushHistory();
  doc = addNode(doc, {
    type, title: file.name,
    layout: { x: Math.round(world.x - 285), y: Math.round(world.y - 160), width: type === 'audio' ? 320 : 569, height: 320 },
    resources: [{ id: file.name, type, url, source: 'upload' }],
  });
  selection = new Set([doc.nodes.at(-1).id]);
  render();
  toast('已加入画布（本地上传，刷新后需重新上传）');
}

async function openSettings() {
  const modal = app.querySelector('#settingsModal');
  modal.classList.add('open');
  const status = app.querySelector('#settingsStatus');
  status.textContent = '读取配置…';
  status.className = 'cv-status';
  try {
    const [configResponse, providerResponse, workflowResponse] = await Promise.all([
      fetch('/api/generation/config'),
      fetch('/api/generation/providers'),
      fetch('/api/generation/workflows').catch(() => null),
    ]);
    const config = await configResponse.json();
    const providers = await providerResponse.json();
    const workflows = workflowResponse ? await workflowResponse.json() : { workflows: [] };
    app.querySelector('#settingsComfyUrl').value = config.comfyui?.baseUrl || 'http://127.0.0.1:8188';
    app.querySelector('#settingsComfyUrl045').value = config.comfyui?.baseUrl045 || '';
    app.querySelector('#settingsDreamina').value = config.dreamina?.command || 'dreamina-canvas';
    app.querySelector('#settingsImageWorkflow').value = config.comfyui?.workflow || 'sdxl-t2i';
    app.querySelector('#settingsVideoWorkflow').value = config.comfyui?.videoWorkflow || 'h3-t2v';
    app.querySelector('#settingsDeepseekModel').value = config.deepseek?.model || 'deepseek-chat';
    const keyInput = app.querySelector('#settingsDeepseekKey');
    keyInput.value = '';
    keyInput.placeholder = config.deepseek?.hasKey ? '已配置（留空保持不变）' : 'sk-…（可留空，之后也可用 ~/.zaomeng/deepseek.key）';
    app.querySelector('#workflowOptions').innerHTML = (workflows.workflows || [])
      .map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}${item.hasMapping ? '' : '（缺映射）'}</option>`)
      .join('');
    if (providers.comfyui045?.ok || providers.comfyui?.ok) {
      const parts = [];
      if (providers.comfyui045?.ok) parts.push(`8190 v${providers.comfyui045.version || '?'} 在线`);
      if (providers.comfyui?.ok) parts.push(`8188 v${providers.comfyui.version || '?'} 在线`);
      else parts.push('8188 未连接（旧模型停用）');
      status.textContent = `ComfyUI：${parts.join(' · ')}`;
      status.classList.add('ok');
    } else {
      status.textContent = `ComfyUI 未连接：${providers.comfyui?.error || '请检查地址'}`;
      status.classList.add('bad');
    }
  } catch (error) {
    status.textContent = `生成服务未启动：${error.message}`;
    status.classList.add('bad');
  }
}

function closeSettings() {
  app.querySelector('#settingsModal').classList.remove('open');
}

async function saveSettings() {
  const status = app.querySelector('#settingsStatus');
  const baseUrl = app.querySelector('#settingsComfyUrl').value.trim();
  const baseUrl045 = app.querySelector('#settingsComfyUrl045').value.trim();
  const workflow = app.querySelector('#settingsImageWorkflow').value.trim();
  const videoWorkflow = app.querySelector('#settingsVideoWorkflow').value.trim();
  try {
    const response = await fetch('/api/generation/config', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        comfyui: { baseUrl, baseUrl045, workflow, videoWorkflow },
        deepseek: {
          model: app.querySelector('#settingsDeepseekModel').value.trim() || 'deepseek-chat',
          baseUrl: 'https://api.deepseek.com',
          ...(app.querySelector('#settingsDeepseekKey').value.trim() ? { apiKey: app.querySelector('#settingsDeepseekKey').value.trim() } : {}),
        },
      }),
    });
    if (!response.ok) throw new Error('保存失败');
    status.textContent = '已保存';
    status.className = 'cv-status ok';
    probeProviders();
  } catch (error) {
    status.textContent = error.message;
    status.className = 'cv-status bad';
  }
}

async function testSettings() {
  const status = app.querySelector('#settingsStatus');
  status.textContent = '测试中…';
  status.className = 'cv-status';
  try {
    const response = await fetch('/api/generation/providers');
    const data = await response.json();
    if (data.comfyui?.ok) {
      status.textContent = `ComfyUI 已连接（${data.comfyui.version || 'unknown'}）`;
      status.className = 'cv-status ok';
    } else {
      status.textContent = `连接失败：${data.comfyui?.error || ''}`;
      status.className = 'cv-status bad';
    }
  } catch (error) {
    status.textContent = error.message;
    status.className = 'cv-status bad';
  }
}

function hasCJK(text) {
  return /[\u3400-\u9fff]/.test(String(text || ''));
}

function exportCanvasJson() {
  try {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zaomeng-canvas-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已导出画布 JSON');
  } catch (error) {
    toast(`导出失败：${error.message}`, true);
  }
}

async function importCanvasJson(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const errors = validateCanvasDocument(parsed);
    if (errors.length) throw new Error(errors[0]);
    pushHistory();
    doc = parsed;
    selection = new Set();
    render();
    toast('已导入画布');
  } catch (error) {
    toast(`导入失败：${error.message}`, true);
  }
}

function openDirectorStage() {
  if (EMBED) {
    try {
      parent.postMessage({ type: 'canvas-open-stage' }, location.origin);
      toast('正在打开 3D 导演台…');
    } catch {
      toast('无法连接到主应用');
    }
    return;
  }
  toast('3D 导演台在主应用的「片段画布」入口内使用');
}

async function exportGenerationConfig() {
  try {
    const config = await (await fetch('/api/generation/config')).json();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zaomeng-generation-config.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已导出生成配置');
  } catch (error) {
    toast(`导出失败：${error.message}`, true);
  }
}

async function importGenerationConfig(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const patch = {};
    for (const key of ['comfyui', 'dreamina', 'defaults']) {
      if (parsed[key] && typeof parsed[key] === 'object') patch[key] = parsed[key];
    }
    const response = await fetch('/api/generation/config', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch),
    });
    if (!response.ok) throw new Error('保存失败');
    toast('已导入生成配置');
    probeProviders();
  } catch (error) {
    toast(`导入失败：${error.message}`, true);
  }
}

const voicePicker = createVoicePicker({
  app,
  getNode: (id) => findNode(doc, id),
  setNode: (id, patch) => { doc = updateNode(doc, id, patch); },
  render,
  toast,
});

async function openVoicePicker(nodeId) { return voicePicker.open(nodeId); }

function boardIndexKey() { return `${BOARD_PREFIX}:${boardProjectId}:index`; }
function boardDocKey(id) { return `${BOARD_PREFIX}:${boardProjectId}:doc:${id}`; }
function boardCurrentKey() { return `${BOARD_PREFIX}:${boardProjectId}:current`; }

function readBoardIndex() {
  try { return JSON.parse(localStorage.getItem(boardIndexKey()) || '[]') || []; } catch { return []; }
}

function readBoardDoc(id) {
  try {
    const raw = localStorage.getItem(boardDocKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validateCanvasDocument(parsed).length ? null : parsed;
  } catch { return null; }
}

function saveBoardState() {
  if (!currentBoardId) return;
  try {
    localStorage.setItem(boardDocKey(currentBoardId), JSON.stringify(doc));
    localStorage.setItem(boardCurrentKey(), currentBoardId);
    localStorage.setItem(boardIndexKey(), JSON.stringify(boardList));
  } catch { /* 存储满时忽略 */ }
}

function collectBoards() {
  return boardList.map((board) => ({
    id: board.id,
    name: board.name,
    doc: board.id === currentBoardId ? structuredClone(doc) : readBoardDoc(board.id),
  })).filter((board) => board.doc);
}

function postBoards() {
  if (!EMBED) return;
  try { parent.postMessage({ type: 'canvas-boards-change', canvases: { currentId: currentBoardId, boards: collectBoards() } }, location.origin); } catch { /* parent 不可用 */ }
}

function updateBoardButton() {
  const board = boardList.find((item) => item.id === currentBoardId);
  app.querySelector('#cvBoardBtn').textContent = `画布：${board?.name || '未命名'} ▾`;
}

function initBoards(projectId, incomingDoc, incomingBoards = null) {
  resumedJobs = false;
  boardProjectId = projectId || 'local';
  if (incomingBoards?.boards?.length) {
    boardList = incomingBoards.boards.map((board) => ({ id: board.id, name: board.name || '画布', updatedAt: Date.now() }));
    for (const board of incomingBoards.boards) {
      if (!board?.id || !board.doc) continue;
      try { localStorage.setItem(boardDocKey(board.id), JSON.stringify(board.doc)); } catch { /* 忽略存储失败 */ }
    }
    currentBoardId = boardList.some((board) => board.id === incomingBoards.currentId) ? incomingBoards.currentId : boardList[0].id;
    doc = readBoardDoc(currentBoardId) || (incomingDoc && !validateCanvasDocument(incomingDoc).length ? incomingDoc : createCanvasDocument());
    saveBoardState();
    updateBoardButton();
    selection = new Set();
    historyState.clear();
    render();
    postBoards();
    window.setTimeout(resumePendingJobs, 400);
    return;
  }
  boardList = readBoardIndex();
  if (!boardList.length) {
    currentBoardId = `board_${Date.now().toString(36)}`;
    boardList = [{ id: currentBoardId, name: '画布 1', updatedAt: Date.now() }];
    if (incomingDoc && !validateCanvasDocument(incomingDoc).length) doc = incomingDoc;
    saveBoardState();
  } else {
    const saved = localStorage.getItem(boardCurrentKey());
    currentBoardId = boardList.some((item) => item.id === saved) ? saved : boardList[0].id;
    const savedDoc = readBoardDoc(currentBoardId);
    if (savedDoc) doc = savedDoc;
    else if (incomingDoc && !validateCanvasDocument(incomingDoc).length) doc = incomingDoc;
    saveBoardState();
  }
  updateBoardButton();
  selection = new Set();
  historyState.clear();
  render();
  postBoards();
  window.setTimeout(resumePendingJobs, 400);
}

const boardManager = createBoardManager({
  state: {
    get boards() { return boardList; },
    set boards(value) { boardList = value; },
    get currentId() { return currentBoardId; },
    set currentId(value) { currentBoardId = value; },
    get doc() { return doc; },
    set doc(value) { doc = value; },
    currentKey: () => boardCurrentKey(),
  },
  storage: localStorage,
  app,
  readDoc: readBoardDoc,
  removeDoc: (id) => localStorage.removeItem(boardDocKey(id)),
  saveState: saveBoardState,
  updateButton: updateBoardButton,
  render,
  persist,
  postBoards,
  createDocument: createCanvasDocument,
  resetView: () => { selection = new Set(); historyState.clear(); },
  toast,
});

function switchBoard(id) { return boardManager.switchBoard(id); }
function makeBoard(name) { return boardManager.makeBoard(name); }
function duplicateBoard() { return boardManager.duplicateBoard(); }
function renameBoard() { return boardManager.startRename(); }
function confirmBoardRename() { return boardManager.confirmRename(); }
function deleteBoard() { return boardManager.deleteBoard(); }

function openBoardMenu(event) { return boardManager.openMenu(showContextMenu, event); }

function saveNodeToOtherBoard(node) { return boardManager.saveNodeToOtherBoard(node, showContextMenu, writeNodeToBoard); }

function writeNodeToBoard(node, boardId) {
  const target = readBoardDoc(boardId) || createCanvasDocument({ viewport: { x: 520, y: 300, zoom: 0.8 } });
  const clone = structuredClone(node);
  delete clone.id;
  clone.layout = { ...clone.layout, x: 120, y: 120 };
  const next = addNode(target, clone);
  localStorage.setItem(boardDocKey(boardId), JSON.stringify(next));
  postBoards();
  toast(`已保存到画布：${boardList.find((item) => item.id === boardId)?.name || boardId}`);
}

function persist(showToast = true) {
  try {
    saveBoardState();
    if (!EMBED) localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    const saved = app.querySelector('#saveState');
    saved.textContent = EMBED ? '已同步到工程' : '已保存到本机';
    if (showToast) toast('已保存');
    postEmbedDoc();
  } catch {
    app.querySelector('#saveState').textContent = '保存失败';
  }
}

let embedTimer = null;
function postEmbedDoc() {
  if (!EMBED || !embedLoaded) return;
  clearTimeout(embedTimer);
  embedTimer = setTimeout(() => {
    try { parent.postMessage({ type: 'canvas-doc-change', doc }, location.origin); } catch { /* 父窗口不可用 */ }
  }, 250);
}

function toast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle('error', isError);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

if (!EMBED) initBoards('local', null);

if (EMBED) {
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin) return;
    const data = event.data || {};
    if (data.type === 'canvas-save-file-result') {
      toast(data.ok ? `已保存：${data.path}` : (data.message || '保存已取消'));
      return;
    }
    if (data.type === 'canvas-close-timeline') {
      if (app.querySelector('#timelineModal')?.classList.contains('open')) closeTimelineView();
      return;
    }
    if (data.type !== 'canvas-load-doc') return;
    embedLoaded = true;
    initBoards(data.projectId, data.doc && typeof data.doc === 'object' ? data.doc : null, data.boards ? { boards: data.boards, currentId: data.currentBoardId } : null);
  });
}

probeProviders();
loadDreaminaCatalog();
if (EMBED) parent.postMessage({ type: 'canvas-ready' }, location.origin);
