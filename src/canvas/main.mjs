import './view.css';
import {
  createCanvasDocument, addNode, removeNode, moveNode, connect,
  findNode, updateNode, validateCanvasDocument, addReference, referenceLabel,
  disconnect, removeReference, addGroup, removeGroup, groupOf,
} from './document.mjs';
import {
  screenToWorld, worldToScreen, zoomAt, fitViewport, edgePath, nodeRect, nodesInRect,
} from './engine.mjs';
import {
  modelDefaultsKey, pickSavedParams, estimateForModel, missingH3Sections,
  promptTemplateFor, requiresH3Sections, qwenModeNeedsImage,
} from './generation-catalog.mjs';
import { normalizeTimelineItems, scanTimelineItems as scanTimelineNodes, timelineTotalDuration, formatTimelineTime, splitTimelineItem, dragTimelineItem } from './timeline-model.mjs';

const EMBED = new URLSearchParams(location.search).has('embed');
if (EMBED) document.body.classList.add('embed');
const STORAGE_KEY = 'zaomeng-canvas2-doc';
const BOARD_PREFIX = 'zaomeng-canvas2-boards';
let boardProjectId = 'local';
let boardList = [];
let currentBoardId = null;

const ICONS = {
  text: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3h10M8 3v10M5.5 13h5"/></svg>',
  image: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/><circle cx="6" cy="6" r="1.2"/><path d="M3 12l3.2-3.4 2.3 2.2L11 7.5l2 2.2"/></svg>',
  video: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="3.5" width="8" height="9" rx="2"/><path d="M10.5 7l3-1.8v5.6l-3-1.8"/></svg>',
  audio: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 10v-4M6 12V4M9 10.5v-5M12 13V3"/></svg>',
  stage: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2l5.5 3.2v5.6L8 14l-5.5-3.2V5.2L8 2z"/><path d="M8 2v6M8 8l5.5 3.2M8 8l-5.5 3.2"/></svg>',
  timeline: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="3" width="11" height="10" rx="2"/><path d="M2.5 6.5h11M6 6.5V13"/></svg>',
  upload: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 11V3.5M5 6.5L8 3.5l3 3M3 12.5h10"/></svg>',
  assets: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 5.5h5l1.2 1.5H14v6H2z"/><path d="M2 5.5V3.5h4"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 3L5 8l5 5"/></svg>',
  send: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12.5V3.5M4 7l4-4 4 4"/></svg>',
};

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

function seedDocument() {
  let doc = createCanvasDocument({ viewport: { x: 520, y: 300, zoom: 0.8 } });
  doc = addNode(doc, {
    id: 'node_text', type: 'text', title: '剧本 / 镜头说明',
    layout: { x: -480, y: -120, width: 320, height: 320 },
    text: 'INT. 庭院 · 傍晚\n\n男演员穿过庭院，在旧友面前停下。\n镜头缓慢推进。',
  });
  doc = addNode(doc, {
    id: 'node_img', type: 'image', title: '研究 · 图片生成',
    layout: { x: 0, y: 0, width: 569, height: 320 },
    generation: {
      mode: 't2i', prompt: '电影感写实画面：黄昏庭院，一位穿深色夹克的男演员走向旧友，灰白墙面与长桌，自然侧光，克制构图，真实材质。',
      model: '未配置后端', ratio: '16:9', resolution: '2K', outputCount: 1,
    },
  });
  doc = addNode(doc, {
    id: 'node_vid', type: 'video', title: '研究 · 图生视频',
    layout: { x: 700, y: 40, width: 569, height: 320 },
    generation: {
      mode: 'i2v', prompt: '参考 {{node:node_img}} 的构图与人物站位，生成黄昏庭院中两人缓慢对视的电影镜头；镜头轻推，自然侧光，真实材质。',
      model: '未配置后端', ratio: '16:9', resolution: '480P', durationSeconds: 5, outputCount: 1,
    },
  });
  doc = connect(doc, 'node_img', 'node_vid').doc;
  return doc;
}

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
let drag = null;
let tempLink = null;
let dragPos = null;
let toastTimer = null;
let menuOpenedAt = 0;
let dreaminaCatalog = { image: [], video: [], audio: [] };
let marquee = null;
let selectedEdge = null;
let spaceHeld = false;
let dragPositions = null;
let history = [];
let future = [];
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
app.querySelector('#aiDockBtn').addEventListener('click', openAIPanel);
app.querySelector('#aiClose').addEventListener('click', () => app.querySelector('#aiPanel').classList.remove('open'));
app.querySelector('#aiSend').addEventListener('click', sendAIMessage);
app.querySelector('#aiInput').addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendAIMessage(); } });
app.querySelector('#shortcutsClose').addEventListener('click', () => app.querySelector('#shortcutsModal').classList.remove('open'));
app.querySelector('#assetsClose').addEventListener('click', () => app.querySelector('#assetsModal').classList.remove('open'));
app.querySelector('#assetsUpload').addEventListener('click', () => { app.querySelector('#assetsModal').classList.remove('open'); app.querySelector('#cvFileInput').click(); });
app.querySelector('#dockMention').addEventListener('click', openMentionMenu);
app.querySelector('#dockOptimize').addEventListener('click', optimizePrompt);
app.querySelector('#dockTranslate').addEventListener('click', translatePrompt);
app.querySelector('#dockTemplate').addEventListener('click', openPromptTemplateMenu);
app.querySelectorAll('#optimizeLangs [data-lang]').forEach((button) => button.addEventListener('click', () => switchOptimizeLang(button.dataset.lang)));
app.querySelector('#optimizeCancel').addEventListener('click', () => app.querySelector('#optimizeModal').classList.remove('open'));
app.querySelector('#optimizeApply').addEventListener('click', applyOptimizedPrompt);
app.querySelector('#camCancel').addEventListener('click', () => app.querySelector('#cameraModal').classList.remove('open'));
app.querySelector('#camConfirm').addEventListener('click', applyCamera);
app.querySelector('#paletteCancel').addEventListener('click', () => app.querySelector('#paletteModal').classList.remove('open'));
app.querySelector('#paletteConfirm').addEventListener('click', applyPalette);
app.querySelector('#styleCancel').addEventListener('click', () => app.querySelector('#styleModal').classList.remove('open'));
app.querySelector('#styleConfirm').addEventListener('click', applyStyle);
app.querySelector('#trimEnd').addEventListener('input', drawTrimWave);
app.querySelector('#maskClear').addEventListener('click', () => { maskRects = []; drawMask(); });
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
app.querySelector('#dockRes').addEventListener('click', openPicturePopover);
app.querySelector('#dockModel').addEventListener('click', () => openParamMenu('model'));
app.querySelector('#dockRatio').addEventListener('click', openPicturePopover);
app.querySelector('#dockCount').addEventListener('click', openPicturePopover);
app.querySelector('#picturePopover').addEventListener('click', (event) => event.stopPropagation());
app.querySelector('#timelineCancel').addEventListener('click', closeTimelineView);
app.querySelector('#timelineCancel').addEventListener('pointerdown', () => { if (document.body.classList.contains('timeline-open')) { closeTimelineView(); } });
app.querySelector('#timelineClose').addEventListener('click', closeTimelineView);
app.querySelector('#timelineClose').addEventListener('pointerdown', () => { if (document.body.classList.contains('timeline-open')) { closeTimelineView(); } });
app.querySelector('#timelinePlay').addEventListener('click', playTimelineClip);
app.querySelector('#timelineExport').addEventListener('click', openTimelineExportMenu);
app.querySelector('#timelineRescan').addEventListener('click', () => { renderTimelineRows(); });
app.querySelector('#timelineImport').addEventListener('click', () => app.querySelector('#cvFileInput').click());
app.querySelectorAll('.cv-timeline-filters [data-kind]').forEach((button) => button.addEventListener('click', () => { timelineAssetFilter = button.dataset.kind; app.querySelectorAll('.cv-timeline-filters [data-kind]').forEach((item) => item.classList.toggle('active', item === button)); renderTimelineRows(); }));
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
  if (!event.target.closest('#picturePopover') && !event.target.closest('#dockRatio') && !event.target.closest('#dockRes') && !event.target.closest('#dockCount')) closePicturePopover();
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

render();
probeProviders();
loadDreaminaCatalog();
if (EMBED) parent.postMessage({ type: 'canvas-ready' }, location.origin);

function render() {
  clearGuides();
  renderGroups();
  renderNodes();
  renderEdges();
  renderAudioWaveforms();
  updateSelectionUi();
  updateDock();
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
      ${node.status === 'running' && node.resources?.length ? `<div class="cv-generation-overlay"><div class="cv-gen-card"><span>生成中…</span><b>${Math.round(Number(node.progress) || 0)}%</b><div class="cv-gen-bar"><i style="width:${Math.max(3, Math.min(100, Number(node.progress) || 0))}%"></i></div></div></div>` : ''}
      <div class="cv-card">
        <div class="cv-node-body">${nodeBody(node)}</div>
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

function nodeBody(node) {
  if (node.type === 'text') return `<div class="cv-text-inner">${escapeHtml(node.text || '双击输入文本')}</div>`;
  if (node.type === 'timeline') {
    const items = node.timelineItems || [];
    const total = Math.max(1, ...items.map((item) => (Number(item.start) || 0) + (Number(item.duration) || 0)));
    const clips = items.map((item) => {
      const left = ((Number(item.start) || 0) / total) * 100;
      const width = Math.max(2, ((Number(item.duration) || 0) / total) * 100);
      return `<span class="cv-mini-clip ${item.type}" style="left:${left}%;width:${width}%" title="${escapeHtml(item.label || item.type)} · ${item.duration}s"></span>`;
    }).join('');
    return `<div class="cv-mini-timeline"><div class="cv-mini-bar"><span>▶ 00:00 / ${total.toFixed(1)}s</span><button class="cv-mini-expand">全屏编辑 ↗</button></div><div class="cv-mini-ruler">${[0, .25, .5, .75, 1].map((p) => `<i style="left:${p * 100}%"></i>`).join('')}</div><div class="cv-mini-track">${clips}<b class="cv-mini-add">${items.length ? '' : '+ 添加素材到时间线'}</b></div></div>`;
  }
  const media = node.resources?.[0];
  if (media?.url && media.type === 'image') {
    return `<img class="cv-node-image" src="${escapeHtml(media.url)}" alt="${escapeHtml(node.title || '')}">`;
  }
  if (media?.url && media.type === 'video') {
    return `<video class="cv-node-media" src="${escapeHtml(media.url)}" controls playsinline preload="metadata"></video>`;
  }
  if (media?.url && media.type === 'audio') {
    return `<div class="cv-wave-wrap"><canvas class="cv-wave" data-audio-url="${escapeHtml(media.url)}"></canvas><audio class="cv-node-media" src="${escapeHtml(media.url)}" controls preload="metadata"></audio></div>`;
  }
  if (node.status === 'running') {
    return `<div class="cv-placeholder">${ICONS[node.type] || ICONS.image}<span>生成中… ${Math.round(node.progress || 0)}%</span></div>`;
  }
  if (node.status === 'failed') {
    const reason = String(node.error || '生成失败').slice(0, 80);
    return `<div class="cv-placeholder">${ICONS[node.type] || ICONS.image}<span>生成失败 · ${escapeHtml(reason)}</span></div>`;
  }
  const label = { image: '图片节点', video: '视频节点', audio: '音频节点', stage: '导演台', timeline: '时间线' }[node.type] || '节点';
  return `<div class="cv-placeholder">${ICONS[node.type] || ICONS.image}<span>${label} · 选中后生成</span></div>`;
}

function renderEdges() {
  const paths = [];
  const positionOf = (id) => {
    const node = findNode(doc, id);
    if (!node) return null;
    if (dragPositions && dragPositions.has(id)) return { ...nodeRect(node), x: dragPositions.get(id).x, y: dragPositions.get(id).y };
    if (dragPos && dragPos.id === id) return { ...nodeRect(node), x: dragPos.x, y: dragPos.y };
    return nodeRect(node);
  };
  for (const edge of doc.edges) {
    const from = positionOf(edge.from);
    const to = positionOf(edge.to);
    if (!from || !to) continue;
    const selected = selectedEdge === edge.id ? ' class="selected"' : '';
    paths.push(`<path${selected} d="${edgePath({ x: from.x + from.width, y: from.y + from.height / 2 }, { x: to.x, y: to.y + to.height / 2 })}" data-edge="${edge.id}"></path>`);
  }
  if (tempLink) {
    const from = positionOf(tempLink.from);
    if (from) {
      paths.push(`<path class="cv-edge-temp" d="${edgePath({ x: from.x + from.width, y: from.y + from.height / 2 }, tempLink.to)}"></path>`);
    }
  }
  edgesSvg.innerHTML = paths.join('');
}

function clearGuides() {
  guidesSvg.innerHTML = '';
}

function snapToGuides(x, y, width, height, exclude) {
  const threshold = 6 / Math.max(0.25, doc.viewport.zoom);
  const others = doc.nodes.filter((node) => !exclude.has(node.id));
  const movingX = [x, x + width / 2, x + width];
  const movingY = [y, y + height / 2, y + height];
  const candidatesX = [];
  const candidatesY = [];
  for (const node of others) {
    const r = nodeRect(node);
    candidatesX.push(r.x, r.x + r.width / 2, r.x + r.width);
    candidatesY.push(r.y, r.y + r.height / 2, r.y + r.height);
  }
  let bestX = null;
  let bestY = null;
  for (const mx of movingX) {
    for (const cx of candidatesX) {
      const diff = cx - mx;
      if (Math.abs(diff) <= threshold && (!bestX || Math.abs(diff) < Math.abs(bestX.diff))) bestX = { diff, at: cx };
    }
  }
  for (const my of movingY) {
    for (const cy of candidatesY) {
      const diff = cy - my;
      if (Math.abs(diff) <= threshold && (!bestY || Math.abs(diff) < Math.abs(bestY.diff))) bestY = { diff, at: cy };
    }
  }
  const lines = [];
  if (bestX) {
    const minY = Math.min(...others.map((node) => nodeRect(node).y), y);
    const maxY = Math.max(...others.map((node) => nodeRect(node).y + nodeRect(node).height), y + height);
    lines.push({ x1: bestX.at, y1: minY - 40, x2: bestX.at, y2: maxY + 40 });
  }
  if (bestY) {
    const minX = Math.min(...others.map((node) => nodeRect(node).x), x);
    const maxX = Math.max(...others.map((node) => nodeRect(node).x + nodeRect(node).width), x + width);
    lines.push({ x1: minX - 40, y1: bestY.at, x2: maxX + 40, y2: bestY.at });
  }
  return { x: x + (bestX?.diff || 0), y: y + (bestY?.diff || 0), lines };
}

function drawGuides(lines) {
  guidesSvg.innerHTML = lines.map((line) => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}"></line>`).join('');
}

function minimapBounds() {
  const stageRect = stage.getBoundingClientRect();
  const viewport = {
    x: -doc.viewport.x / doc.viewport.zoom,
    y: -doc.viewport.y / doc.viewport.zoom,
    width: stageRect.width / doc.viewport.zoom,
    height: stageRect.height / doc.viewport.zoom,
  };
  const boxes = doc.nodes.map(nodeRect).concat([viewport]);
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return { minX: minX - 80, minY: minY - 80, width: maxX - minX + 160, height: maxY - minY + 160, viewport };
}

function drawMinimap() {
  const canvas = app.querySelector('#minimapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b0e12';
  ctx.fillRect(0, 0, width, height);
  if (!doc.nodes.length) {
    ctx.fillStyle = '#4a5360';
    ctx.font = '10px sans-serif';
    ctx.fillText('空画布', 12, 24);
    return;
  }
  const bounds = minimapBounds();
  const scale = Math.min((width - 16) / bounds.width, (height - 16) / bounds.height);
  const offsetX = 8 - bounds.minX * scale + (width - 16 - bounds.width * scale) / 2;
  const offsetY = 8 - bounds.minY * scale + (height - 16 - bounds.height * scale) / 2;
  const colors = { text: '#5b6b7f', image: '#4b8dff', video: '#9d7bff', audio: '#42b883', stage: '#e0a35c', timeline: '#d9d2c3' };
  for (const node of doc.nodes) {
    const rect = nodeRect(node);
    ctx.fillStyle = colors[node.type] || '#6b7280';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(offsetX + rect.x * scale, offsetY + rect.y * scale, Math.max(2, rect.width * scale), Math.max(2, rect.height * scale));
  }
  ctx.globalAlpha = 1;
  const viewport = bounds.viewport;
  ctx.strokeStyle = 'rgba(120,180,255,.95)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(offsetX + viewport.x * scale, offsetY + viewport.y * scale, Math.max(4, viewport.width * scale), Math.max(4, viewport.height * scale));
}

function bindMinimap() {
  const canvas = app.querySelector('#minimapCanvas');
  if (!canvas) return;
  let dragging = false;
  const moveTo = (event) => {
    const bounds = minimapBounds();
    const rect = canvas.getBoundingClientRect();
    const width = canvas.width;
    const height = canvas.height;
    const scale = Math.min((width - 16) / bounds.width, (height - 16) / bounds.height);
    const offsetX = 8 - bounds.minX * scale + (width - 16 - bounds.width * scale) / 2;
    const offsetY = 8 - bounds.minY * scale + (height - 16 - bounds.height * scale) / 2;
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
  if (single) {
    renderDockChips(single);
    app.querySelector('#dockTitle').textContent = single.title || single.type;
    app.querySelector('#dockMeta').textContent = `${typeLabel(single.type)}${single.generation ? ` · ${single.generation.mode}` : ''}`;
    app.querySelector('#dockState').textContent = statusLabel(single.status);
    promptEl.value = single.generation?.prompt ?? single.text ?? '';
    app.querySelector('#dockRatio').textContent = single.generation?.ratio || '16:9';
    const providerForRes = single.generation?.backend?.provider;
    const modelPill = app.querySelector('#dockModel');
    const ratioPill = app.querySelector('#dockRatio');
    const countPill = app.querySelector('#dockCount');
    if (single.generation) {
      modelPill.style.display = '';
      modelPill.textContent = `模型：${modelLabel(single)}`;
      const showLayout = ['image', 'video'].includes(single.type);
      ratioPill.style.display = showLayout ? '' : 'none';
      countPill.style.display = showLayout ? '' : 'none';
      app.querySelector('#dockRes').style.display = showLayout ? '' : 'none';
    } else {
      modelPill.style.display = 'none';
      ratioPill.style.display = 'none';
      countPill.style.display = 'none';
      app.querySelector('#dockRes').style.display = 'none';
    }
    if (single.type === 'video' && providerForRes === 'comfyui') {
      const model = single.generation?.model || 'h3';
      const labels = {
        wan22: 'Wan 2.2 · 832×480 · 16fps',
        ltx23: 'LTX-2.3 · 640×384 · 24fps',
        framepack: 'FramePack · 首帧 · 30fps',
        'h3-ref2v': 'H3 Ref2VA · 640×352 · 参考生视频',
        'h3-ultimate': 'H3 Ultimate · 640×352 · 0.22MP',
        h3: single.generation?.h3Size === '480P' ? 'H3 480P · 848×480' : 'H3 360P · 640×352',
      };
      const resPill = app.querySelector('#dockRes');
      resPill.textContent = labels[model] || labels.h3;
      resPill.disabled = false;
    } else {
      const resPill = app.querySelector('#dockRes');
      resPill.textContent = single.generation?.resolution || '分辨率';
      resPill.disabled = !single.generation;
    }
    const imageProvider = single.generation?.backend?.provider || (single.type === 'image' ? 'comfyui' : 'dreamina');
    const imageModelPill = app.querySelector('#dockImageModel');
    imageModelPill.style.display = 'none';
    const refPill = app.querySelector('#dockRefMode');
    const hasImageRefs = (single.generation?.references || []).some((ref) => findNode(doc, ref.id)?.type === 'image');
    if (single.type === 'image' && hasImageRefs && imageProvider !== 'dreamina') {
      const labels = { '': 'i2i', i2i: 'i2i', depth: 'ControlNet 深度', canny: 'ControlNet 线稿', openpose: 'ControlNet 姿态', ipadapter: 'IPAdapter 风格' };
      refPill.style.display = '';
      refPill.textContent = `参考：${labels[single.generation?.refMode || ''] || 'i2i'}`;
    } else {
      refPill.style.display = 'none';
    }
    const durationPill = app.querySelector('#dockDuration');
    if (single.type === 'video') {
      durationPill.style.display = '';
      durationPill.textContent = `${single.generation?.durationSeconds || 5}s`;
    } else {
      durationPill.style.display = 'none';
    }
    app.querySelector('#dockCount').textContent = `${single.generation?.outputCount || 1} 个`;
    const backendMode = app.querySelector('#dockBackendMode');
    if (single.generation && ['image', 'video', 'audio'].includes(single.type)) {
      backendMode.style.display = '';
      if (single.type === 'audio') {
        backendMode.textContent = '生成后端：即梦 API（唯一） ▾';
        backendMode.disabled = false;
      } else {
        const provider = single.generation?.backend?.provider || (single.type === 'image' ? 'comfyui' : 'dreamina');
        backendMode.textContent = `生成后端：${provider === 'comfyui' ? 'ComfyUI（本地/远程）' : '即梦 API'} ▾`;
        backendMode.disabled = false;
      }
    } else {
      backendMode.style.display = 'none';
    }
    const cost = app.querySelector('#dockCost');
    if ((single.generation?.mode === 't2i' || single.generation?.mode === 'i2i') && single.type === 'image') {
      const provider = single.generation?.backend?.provider || 'comfyui';
      if (provider === 'dreamina') {
        cost.textContent = '即梦 Seedream API · 报价后确认扣积分';
        cost.classList.remove('cv-warn');
      } else {
        cost.textContent = `${hasCJK(promptEl.value) ? 'ComfyUI（Flux/SDXL）对中文理解弱，建议英文' : 'ComfyUI · 免费'}${estimateFor(single) ? ` · ${estimateFor(single)}` : ''}`;
        cost.classList.toggle('cv-warn', hasCJK(promptEl.value));
      }
    } else if (single.type === 'video') {
      const provider = single.generation?.backend?.provider || 'dreamina';
      const videoModel = single.generation?.model || 'h3';
      const videoLabels = { h3: 'H3', wan22: 'Wan 2.2 · 约 5 分钟/5 秒', ltx23: 'LTX-2.3 · 约 2 分钟', framepack: 'FramePack · 长镜头 · 较慢', 'h3-ref2v': 'H3 Ref2VA · 多模态参考 · 约 3 分钟', 'h3-ultimate': 'H3 Ultimate · 0.45 实例 · 约 3–5 分钟' };
      cost.textContent = provider === 'comfyui'
        ? `ComfyUI 视频 · 免费（${videoLabels[videoModel] || videoLabels.h3} · Windows）${estimateFor(single) ? ` · ${estimateFor(single)}` : ''}`
        : '即梦 CLI · 报价后确认扣积分';
      cost.classList.remove('cv-warn');
    } else if (single.type === 'audio') {
      const voiceName = single.generation?.voiceName;
      cost.textContent = `即梦 TTS${voiceName ? ` · 音色：${voiceName}` : ''} · 报价后确认扣积分`;
      cost.classList.remove('cv-warn');
    } else if (single.generation) {
      cost.textContent = '这个节点暂未接生成后端';
      cost.classList.remove('cv-warn');
    } else if (single.type === 'text') {
      cost.textContent = '文本节点 · 可在左侧工具栏新建图片 / 视频 / 音频节点';
      cost.classList.remove('cv-warn');
    } else {
      cost.textContent = '选择节点后显示生成参数';
      cost.classList.remove('cv-warn');
    }
    app.querySelector('#dockSend').disabled = !single.generation;
  } else {
    renderDockChips(null);
  }
}

function updateDock() { /* 由 updateSelectionUi 负责，保留占位 */ }

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

function onNodePointerDown(event) {
  if (event.button !== 0) return;
  const nodeEl = event.currentTarget;
  const nodeId = nodeEl.dataset.id;
  const conn = event.target.closest('.cv-conn');
  event.stopPropagation();
  if (conn?.dataset.conn === 'out') {
    startLink(nodeId, event);
    return;
  }
  if (conn?.dataset.conn === 'in') return;
  if (event.shiftKey) {
    selection.has(nodeId) ? selection.delete(nodeId) : selection.add(nodeId);
  } else {
    const group = groupOf(doc, nodeId);
    if (group) selection = new Set(group.nodeIds);
    else if (!selection.has(nodeId)) selection = new Set([nodeId]);
  }
  updateSelectionUi();
  layer.querySelectorAll('.cv-node').forEach((el) => el.classList.toggle('selected', selection.has(el.dataset.id)));
  const node = findNode(doc, nodeId);
  const rect = nodeRect(node);
  if (!event.shiftKey && selection.has(nodeId) && selection.size > 1) {
    dragPositions = new Map();
    for (const id of selection) {
      const item = findNode(doc, id);
      if (!item) continue;
      const r = nodeRect(item);
      dragPositions.set(id, { x: r.x, y: r.y });
    }
    drag = { kind: 'nodes', ids: [...selection], startX: event.clientX, startY: event.clientY, moved: false };
  } else {
    drag = {
      kind: 'node', id: nodeId, startX: event.clientX, startY: event.clientY,
      originX: rect.x, originY: rect.y, moved: false,
    };
    dragPos = { id: nodeId, x: rect.x, y: rect.y };
  }
  try { nodeEl.setPointerCapture?.(event.pointerId); } catch { /* 合成事件无活动指针 */ }
  stage.classList.add('panning');
}

function startLink(fromId, event) {
  const node = findNode(doc, fromId);
  const rect = nodeRect(node);
  tempLink = {
    from: fromId,
    to: screenToWorld({ x: event.clientX - stage.getBoundingClientRect().left, y: event.clientY - stage.getBoundingClientRect().top }, doc.viewport),
    pointerId: event.pointerId,
  };
  drag = { kind: 'link' };
  renderEdges();
}

function onPointerDown(event) {
  if (event.button !== 0 && event.button !== 1) return;
  const edgeEl = event.target.closest('[data-edge]');
  if (edgeEl && event.button === 0) {
    selectedEdge = edgeEl.dataset.edge;
    selection = new Set();
    updateSelectionUi();
    renderEdges();
    return;
  }
  if (event.target.closest('.cv-node')) return;
  selectedEdge = null;
  if (event.button === 1 || spaceHeld) {
    drag = { kind: 'pan', startX: event.clientX, startY: event.clientY, originX: doc.viewport.x, originY: doc.viewport.y };
    stage.classList.add('panning');
    try { stage.setPointerCapture?.(event.pointerId); } catch { /* 合成事件无活动指针 */ }
    selection = new Set();
    updateSelectionUi();
    layer.querySelectorAll('.cv-node').forEach((el) => el.classList.remove('selected'));
    return;
  }
  // 空白左键拖动 = 框选（即梦同款）；空格/中键拖动 = 平移。
  drag = { kind: 'marquee', startX: event.clientX, startY: event.clientY, additive: event.shiftKey };
  if (!event.shiftKey) {
    selection = new Set();
    updateSelectionUi();
    layer.querySelectorAll('.cv-node').forEach((el) => el.classList.remove('selected'));
  }
  marquee = document.createElement('div');
  marquee.className = 'cv-marquee';
  document.body.appendChild(marquee);
  positionMarquee();
  try { stage.setPointerCapture?.(event.pointerId); } catch { /* 合成事件无活动指针 */ }
}

function positionMarquee() {
  if (!marquee || drag?.kind !== 'marquee') return;
  const x = Math.min(drag.startX, drag.currentX ?? drag.startX);
  const y = Math.min(drag.startY, drag.currentY ?? drag.startY);
  const w = Math.abs((drag.currentX ?? drag.startX) - drag.startX);
  const h = Math.abs((drag.currentY ?? drag.startY) - drag.startY);
  Object.assign(marquee.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, display: w > 2 && h > 2 ? 'block' : 'none' });
}

function onPointerMove(event) {
  if (!drag) return;
  const rect = stage.getBoundingClientRect();
  if (drag.kind === 'pan') {
    doc.viewport = {
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
      zoom: doc.viewport.zoom,
    };
    applyViewport();
    return;
  }
  if (drag.kind === 'marquee') {
    drag.currentX = event.clientX;
    drag.currentY = event.clientY;
    positionMarquee();
    return;
  }
  if (drag.kind === 'nodes') {
    const dx = (event.clientX - drag.startX) / doc.viewport.zoom;
    const dy = (event.clientY - drag.startY) / doc.viewport.zoom;
    drag.moved = true;
    const starts = [...drag.ids].map((id) => dragPositions?.get(id)).filter(Boolean);
    if (!starts.length) return;
    const minX = Math.min(...starts.map((p) => p.x));
    const minY = Math.min(...starts.map((p) => p.y));
    const width = Math.max(...drag.ids.map((id) => nodeRect(findNode(doc, id)).width));
    const height = Math.max(...drag.ids.map((id) => nodeRect(findNode(doc, id)).height));
    const snapped = snapToGuides(Math.round((minX + dx) / 8) * 8, Math.round((minY + dy) / 8) * 8, width, height, new Set(drag.ids));
    const offsetX = snapped.x - minX;
    const offsetY = snapped.y - minY;
    for (const id of drag.ids) {
      const start = dragPositions?.get(id);
      if (!start) continue;
      const x = Math.round((start.x + offsetX) / 8) * 8;
      const y = Math.round((start.y + offsetY) / 8) * 8;
      dragPositions.set(id, { x, y });
      const el = layer.querySelector(`.cv-node[data-id="${id}"]`);
      if (el) { el.style.left = `${x}px`; el.style.top = `${y}px`; }
    }
    drawGuides(snapped.lines);
    renderEdges();
    return;
  }
  if (drag.kind === 'node') {
    const dx = (event.clientX - drag.startX) / doc.viewport.zoom;
    const dy = (event.clientY - drag.startY) / doc.viewport.zoom;
    const node = findNode(doc, drag.id);
    if (!node) return;
    const rawX = Math.round((drag.originX + dx) / 8) * 8;
    const rawY = Math.round((drag.originY + dy) / 8) * 8;
    const snapped = snapToGuides(rawX, rawY, node.layout.width, node.layout.height, new Set([drag.id]));
    dragPos = { id: drag.id, x: snapped.x, y: snapped.y };
    drag.moved = true;
    const el = layer.querySelector(`.cv-node[data-id="${drag.id}"]`);
    if (el) { el.style.left = `${snapped.x}px`; el.style.top = `${snapped.y}px`; }
    drawGuides(snapped.lines);
    renderEdges();
    return;
  }
  if (drag.kind === 'link' && tempLink) {
    tempLink.to = screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, doc.viewport);
    renderEdges();
  }
}

function onPointerUp(event) {
  if (!drag) return;
  clearGuides();
  const finished = drag;
  drag = null;
  stage.classList.remove('panning');
  if (finished.kind === 'marquee') {
    const currentX = finished.currentX ?? finished.startX;
    const currentY = finished.currentY ?? finished.startY;
    marquee?.remove();
    marquee = null;
    const rect = stage.getBoundingClientRect();
    const a = screenToWorld({ x: finished.startX - rect.left, y: finished.startY - rect.top }, doc.viewport);
    const b = screenToWorld({ x: currentX - rect.left, y: currentY - rect.top }, doc.viewport);
    const box = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
    if (box.width > 4 || box.height > 4) {
      const hit = nodesInRect(doc.nodes, box).map((node) => node.id);
      selection = finished.additive ? new Set([...selection, ...hit]) : new Set(hit);
      updateSelectionUi();
      layer.querySelectorAll('.cv-node').forEach((el) => el.classList.toggle('selected', selection.has(el.dataset.id)));
    }
    renderEdges();
    return;
  }
  if (finished.kind === 'nodes' && dragPositions) {
    pushHistory();
    for (const id of finished.ids) {
      const pos = dragPositions.get(id);
      if (pos) doc = moveNode(doc, id, pos.x, pos.y);
    }
    dragPositions = null;
    render();
    return;
  }
  if (finished.kind === 'node' && dragPos) {
    const { id, x, y } = dragPos;
    dragPos = null;
    pushHistory();
    doc = moveNode(doc, id, x, y);
    const dragged = findNode(doc, id);
    if (dragged && (dragged.type === 'video' || dragged.type === 'audio')) {
      const draggedRect = nodeRect(dragged);
      const target = doc.nodes.find((node) => node.type === 'timeline' && node.id !== dragged.id && (() => {
        const r = nodeRect(node);
        return draggedRect.x < r.x + r.width && draggedRect.x + draggedRect.width > r.x && draggedRect.y < r.y + r.height && draggedRect.y + draggedRect.height > r.y;
      })());
      if (target) {
        const items = [...(target.timelineItems || [])];
        if (!items.some((item) => item.id === dragged.id)) {
          const end = items.reduce((max, item) => Math.max(max, (Number(item.start) || 0) + (Number(item.duration) || 0)), 0);
          items.push({ id: dragged.id, label: dragged.title || dragged.type, type: dragged.type, start: end, duration: Number(dragged.generation?.durationSeconds) || 5, sourceStart: 0 });
          doc = updateNode(doc, target.id, { timelineItems: items });
          toast('已加入时间线');
        }
      }
    }
    render();
    return;
  }
  if (finished.kind === 'link' && tempLink) {
    const fromId = tempLink.from;
    tempLink = null;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cv-conn.left');
    const toId = target?.dataset.id;
    if (toId && toId !== fromId) {
      try {
        const fromNode = findNode(doc, fromId);
        const targetNode = findNode(doc, toId);
        // 图片→视频自动切 i2v，视频/音频参考自动切 m2v（即梦同款行为）。
        if (targetNode?.generation) {
          let mode = targetNode.generation.mode;
          if (targetNode.type === 'video') {
            mode = fromNode?.type === 'image' ? 'i2v' : fromNode?.type === 'video' || fromNode?.type === 'audio' ? 'm2v' : mode;
          } else if (targetNode.type === 'image' && fromNode?.type === 'image') {
            mode = 'i2i';
          }
          if (mode !== targetNode.generation.mode) doc = updateNode(doc, toId, { generation: { mode } });
        }
        pushHistory();
        doc = connect(doc, fromId, toId).doc;
        if (fromNode) doc = addReference(doc, toId, { id: fromId, type: fromNode.type });
        toast('已连接');
      } catch (error) {
        toast(error.message, true);
      }
      render();
      return;
    }
    renderEdges();
    return;
  }
  if (finished.kind === 'pan') {
    persist(false);
    return;
  }
  renderEdges();
}

function onWheel(event) {
  event.preventDefault();
  const rect = stage.getBoundingClientRect();
  const factor = Math.exp(-event.deltaY * 0.0012);
  doc.viewport = zoomAt(doc.viewport, { x: event.clientX - rect.left, y: event.clientY - rect.top }, doc.viewport.zoom * factor);
  applyViewport();
  persist(false);
}

function onKeyDown(event) {
  const editing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
  if (editing) return;
  if (event.code === 'Space' && !event.repeat) { spaceHeld = true; event.preventDefault(); return; }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedEdge) {
      event.preventDefault();
      const edge = doc.edges.find((item) => item.id === selectedEdge);
      pushHistory();
      if (edge) {
        doc = disconnect(doc, edge.id);
        const target = findNode(doc, edge.to);
        if (target) doc = removeReference(doc, edge.to, edge.from);
      }
      selectedEdge = null;
      render();
      toast('已删除连线');
      return;
    }
    if (!selection.size) return;
    event.preventDefault();
    pushHistory();
    for (const id of selection) doc = removeNode(doc, id);
    selection = new Set();
    render();
    toast('已删除');
    return;
  }
  if (event.key === 'Escape') {
    selection = new Set();
    selectedEdge = null;
    render();
    return;
  }
  const meta = event.metaKey || event.ctrlKey;
  const inAiPanel = Boolean(document.activeElement?.closest?.('#aiPanel') || window.getSelection()?.anchorNode?.parentElement?.closest?.('#aiPanel'));
  if (inAiPanel && meta && ['c', 'a'].includes(event.key.toLowerCase())) return; // 让浏览器复制/全选 AI 对话
  const textSelected = Boolean(window.getSelection()?.toString());
  if (textSelected && meta && event.key.toLowerCase() === 'c') return; // 有文本选区时不抢复制
  if (meta && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
    return;
  }
  if (meta && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
  if (meta && event.key.toLowerCase() === 'a') { event.preventDefault(); selection = new Set(doc.nodes.map((node) => node.id)); updateSelectionUi(); layer.querySelectorAll('.cv-node').forEach((el) => el.classList.toggle('selected', selection.has(el.dataset.id))); return; }
  if (!meta && event.key.toLowerCase() === 'f') { event.preventDefault(); fitCanvas(); return; }
  if (meta && event.key.toLowerCase() === 'c') { event.preventDefault(); copySelected(); return; }
  if (meta && event.key.toLowerCase() === 'v') { event.preventDefault(); pasteNode(); return; }
  if (meta && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelected(); return; }
}

function pushHistory() {
  history.push(JSON.stringify(doc));
  if (history.length > HISTORY_LIMIT) history.shift();
  future = [];
}

function undo() {
  if (!history.length) { toast('没有可撤销的操作'); return; }
  future.push(JSON.stringify(doc));
  doc = JSON.parse(history.pop());
  selection = new Set();
  render();
}

function redo() {
  if (!future.length) { toast('没有可重做的操作'); return; }
  history.push(JSON.stringify(doc));
  doc = JSON.parse(future.pop());
  selection = new Set();
  render();
}

function copySelected() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node) { toast('先选中一个节点'); return; }
  clipboard = JSON.parse(JSON.stringify(node));
  toast('已复制节点');
}

function pasteNode() {
  if (!clipboard) { toast('剪贴板为空'); return; }
  const copy = JSON.parse(JSON.stringify(clipboard));
  delete copy.id;
  copy.layout = { ...copy.layout, x: (copy.layout?.x || 0) + 40, y: (copy.layout?.y || 0) + 40 };
  copy.resources = copy.resources || [];
  pushHistory();
  doc = addNode(doc, copy);
  selection = new Set([doc.nodes.at(-1).id]);
  render();
  clipboard = JSON.parse(JSON.stringify(findNode(doc, doc.nodes.at(-1).id)));
  toast('已粘贴节点');
}

function duplicateSelected() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node) { toast('先选中一个节点'); return; }
  clipboard = JSON.parse(JSON.stringify(node));
  pasteNode();
}

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

async function probeProviders() {
  const pill = app.querySelector('#dockBackend');
  try {
    const response = await fetch('/api/generation/providers');
    const data = await response.json();
    if (data.comfyui?.ok) {
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

const IMAGE_PRESETS = {
  '场景俯视图': '俯视全景视角，清晰展示空间布局与人物站位，电影感布光',
  '连续分镜图': '同一角色连续动作分镜，保持人物与场景一致，电影分镜风格',
  '多机位九宫格': '九宫格多机位构图，同一场景九个不同机位，统一光线与色调',
  '人物三视图': '角色三视图：正面、侧面、背面，统一服装与比例，干净背景',
  '面部三视图': '角色面部三视图：正面、四分之三侧、侧面，细节一致',
  '产品三视图': '产品三视图：正面、侧面、背面，棚拍布光，干净背景',
};

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
let trimNode = null;
let trimPeaks = null;
let trimDuration = 0;

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

let videoTrimNode = null;

function openVideoTrim(node) {
  const media = node.resources?.[0];
  if (!media?.url) { toast('先生成视频'); return; }
  videoTrimNode = node;
  const preview = app.querySelector('#videoTrimPreview');
  preview.src = media.url;
  app.querySelector('#videoTrimModal').classList.add('open');
  const start = app.querySelector('#videoTrimStart');
  const end = app.querySelector('#videoTrimEnd');
  preview.onloadedmetadata = () => {
    const duration = Number.isFinite(preview.duration) ? preview.duration : 5;
    start.max = String(duration);
    end.max = String(duration);
    start.value = '0';
    end.value = String(duration);
    drawVideoTrimInfo();
  };
  preview.load();
}

function drawVideoTrimInfo() {
  const preview = app.querySelector('#videoTrimPreview');
  const start = Number(app.querySelector('#videoTrimStart').value) || 0;
  const end = Number(app.querySelector('#videoTrimEnd').value) || preview.duration || 0;
  app.querySelector('#videoTrimInfo').textContent = `保留 ${start.toFixed(1)}s – ${end.toFixed(1)}s（共 ${(preview.duration || 0).toFixed(1)}s）`;
  try { preview.currentTime = start; } catch { /* ignore */ }
}

async function confirmVideoTrim() {
  if (!videoTrimNode) return;
  const media = videoTrimNode.resources?.[0];
  const start = Number(app.querySelector('#videoTrimStart').value) || 0;
  const end = Number(app.querySelector('#videoTrimEnd').value) || 0;
  if (end <= start + 0.3) { toast('终点要大于起点'); return; }
  app.querySelector('#videoTrimModal').classList.remove('open');
  try {
    const response = await fetch('/api/generation/video/trim', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoUrl: media.url, start, end }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '修剪失败');
    commitResource(videoTrimNode.id, { id: data.filename, type: 'video', url: data.url, source: 'trim' });
    doc = updateNode(doc, videoTrimNode.id, { status: 'success' });
    render();
    toast('视频已修剪');
  } catch (error) {
    toast(error.message || String(error), true);
  }
}

async function openAudioTrim(node) {
  const media = node.resources?.[0];
  if (!media?.url) { toast('先生成音频'); return; }
  trimNode = node;
  const modal = app.querySelector('#audioTrimModal');
  modal.classList.add('open');
  app.querySelector('#trimInfo').textContent = '读取波形…';
  try {
    const result = await peaksFor(media.url);
    trimPeaks = result.peaks;
    trimDuration = result.duration;
    const canvas = app.querySelector('#trimWave');
    canvas.width = 600;
    canvas.height = 90;
    const start = app.querySelector('#trimStart');
    const end = app.querySelector('#trimEnd');
    start.max = String(trimDuration);
    end.max = String(trimDuration);
    start.value = '0';
    end.value = String(trimDuration);
    drawTrimWave();
  } catch (error) {
    app.querySelector('#trimInfo').textContent = `读取失败：${error.message}`;
  }
}

function drawTrimWave() {
  if (!trimPeaks) return;
  const start = Number(app.querySelector('#trimStart').value) || 0;
  const end = Number(app.querySelector('#trimEnd').value) || trimDuration;
  const canvas = app.querySelector('#trimWave');
  drawWave(canvas, trimPeaks, start, end, trimDuration);
  app.querySelector('#trimInfo').textContent = `保留 ${start.toFixed(1)}s – ${end.toFixed(1)}s（共 ${trimDuration.toFixed(1)}s）`;
}

async function confirmAudioTrim() {
  if (!trimNode) return;
  const media = trimNode.resources?.[0];
  const start = Number(app.querySelector('#trimStart').value) || 0;
  const end = Number(app.querySelector('#trimEnd').value) || trimDuration;
  if (end <= start + 0.2) { toast('终点要大于起点'); return; }
  app.querySelector('#audioTrimModal').classList.remove('open');
  try {
    const response = await fetch('/api/generation/audio/trim', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audioUrl: media.url, start, end }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '裁剪失败');
    doc = updateNode(doc, trimNode.id, {
      status: 'success',
      resources: [{ id: data.filename, type: 'audio', url: data.url, source: 'trim' }],
    });
    render();
    toast('已裁剪');
  } catch (error) {
    toast(error.message || String(error), true);
  }
}

let maskNode = null;
let maskRects = [];
let maskImage = null;
let maskScale = 1;

function openMaskEditor(node) {
  const media = node.resources?.[0];
  if (!media?.url) { toast('先生成一张图片'); return; }
  maskNode = node;
  maskRects = [];
  const modal = app.querySelector('#maskModal');
  const img = app.querySelector('#maskImage');
  const canvas = app.querySelector('#maskCanvas');
  img.onload = () => {
    const maxW = Math.min(760, window.innerWidth - 160);
    const maxH = Math.min(520, window.innerHeight - 260);
    maskScale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const width = Math.round(img.naturalWidth * maskScale);
    const height = Math.round(img.naturalHeight * maskScale);
    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    drawMask();
  };
  img.src = media.url;
  modal.classList.add('open');
  if (!canvas.dataset.bound) {
    canvas.dataset.bound = '1';
    let start = null;
    canvas.addEventListener('pointerdown', (event) => {
      const rect = canvas.getBoundingClientRect();
      start = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      try { canvas.setPointerCapture?.(event.pointerId); } catch { /* 合成事件无活动指针 */ }
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!start) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      drawMask({ x: Math.min(start.x, x), y: Math.min(start.y, y), w: Math.abs(x - start.x), h: Math.abs(y - start.y) });
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!start) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const w = Math.abs(x - start.x);
      const h = Math.abs(y - start.y);
      if (w > 4 && h > 4) maskRects.push({ x: Math.min(start.x, x) / canvas.width, y: Math.min(start.y, y) / canvas.height, w: w / canvas.width, h: h / canvas.height });
      start = null;
      drawMask();
    });
  }
}

function drawMask(preview = null) {
  const canvas = app.querySelector('#maskCanvas');
  if (!canvas?.width) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255, 70, 90, 0.45)';
  ctx.strokeStyle = 'rgba(255, 120, 140, 0.9)';
  for (const r of maskRects) {
    ctx.fillRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
    ctx.strokeRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
  }
  if (preview) {
    ctx.fillStyle = 'rgba(255, 70, 90, 0.35)';
    ctx.strokeStyle = 'rgba(255, 120, 140, 0.8)';
    ctx.fillRect(preview.x, preview.y, preview.w, preview.h);
    ctx.strokeRect(preview.x, preview.y, preview.w, preview.h);
  }
}

function closeMaskEditor() {
  app.querySelector('#maskModal').classList.remove('open');
  maskNode = null;
}

async function confirmInpaint() {
  if (!maskNode) return;
  if (!maskRects.length) { toast('先在图片上拖出要重绘的区域'); return; }
  const node = maskNode;
  const media = node.resources?.[0];
  const out = document.createElement('canvas');
  const source = app.querySelector('#maskImage');
  out.width = source.naturalWidth || 768;
  out.height = source.naturalHeight || 512;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.fillStyle = '#fff';
  for (const r of maskRects) ctx.fillRect(r.x * out.width, r.y * out.height, r.w * out.width, r.h * out.height);
  const dataUrl = out.toDataURL('image/png');
  closeMaskEditor();
  doc = updateNode(doc, node.id, { status: 'running', progress: 0, jobMessage: '局部重绘中…' });
  render();
  try {
    const upload = await fetch('/api/generation/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
    const uploaded = await upload.json();
    if (!upload.ok) throw new Error(uploaded.error || '蒙版上传失败');
    const prompt = promptEl.value.trim() || (node.generation?.prompt || '');
    const response = await fetch('/api/generation/jobs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'comfyui-inpaint', imageUrl: media.url, maskUrl: uploaded.url, prompt }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '提交失败');
    toast('已提交局部重绘');
    pollJob(data.id, node.id);
  } catch (error) {
    doc = updateNode(doc, node.id, { status: 'failed', error: error.message || String(error) });
    render();
    toast(error.message || String(error), true);
  }
}

function outpaintMenu(node) {
  if (!node.resources?.[0]?.url) { toast('先生成一张图片'); return; }
  showContextMenu(['左', '上', '右', '下'].map((label) => [`向${label}扩图`, () => runOutpaint(node, { 左: 'left', 上: 'top', 右: 'right', 下: 'bottom' }[label])]), 420, 300);
}

async function runOutpaint(node, direction) {
  doc = updateNode(doc, node.id, { status: 'running', progress: 0, jobMessage: '扩图中…' });
  render();
  try {
    const response = await fetch('/api/generation/jobs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'comfyui-outpaint', imageUrl: node.resources[0].url, direction, pixels: 256, prompt: promptEl.value.trim() || node.generation?.prompt || '' }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '提交失败');
    toast('已提交扩图');
    pollJob(data.id, node.id);
  } catch (error) {
    doc = updateNode(doc, node.id, { status: 'failed', error: error.message || String(error) });
    render();
    toast(error.message || String(error), true);
  }
}

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

async function extractVideoFrame(node) {
  const media = node.resources?.[0];
  if (!media?.url) { toast('视频还没有生成'); return; }
  toast('截取帧中…');
  try {
    const response = await fetch('/api/generation/video/frame', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoUrl: media.url, time: 1 }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '截取帧失败');
    await addResourceNode(node, 'image', data, '截取帧');
    toast('已生成截取帧节点');
  } catch (error) { toast(error.message, true); }
}

async function extractVideoAudio(node) {
  const media = node.resources?.[0];
  if (!media?.url) { toast('视频还没有生成'); return; }
  toast('分离音频中…');
  try {
    const response = await fetch('/api/generation/video/audio', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoUrl: media.url }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '分离音频失败');
    await addResourceNode(node, 'audio', data, '分离音频');
    toast('已生成音频节点');
  } catch (error) { toast(error.message, true); }
}

function relightMenu(node) {
  if (!node.resources?.[0]?.url) { toast('先生成一张图片'); return; }
  showContextMenu([
    ['强打光（白底重打光）', () => startRelight(node, 'fg')],
    ['轻补光（保留背景）', () => startRelight(node, 'light')],
  ], 420, 300);
}

async function startRelight(node, variant) {
  const media = node.resources?.[0];
  if (!media?.url) { toast('先生成一张图片'); return; }
  let lightPrompt = promptEl.value.trim();
  if (lightPrompt && hasCJK(lightPrompt)) {
    toast('正在翻译光照描述…');
    try {
      const response = await fetch('/api/generation/prompt/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: lightPrompt }) });
      const data = await response.json();
      if (response.ok && data.translated) lightPrompt = data.translated;
    } catch { /* 翻译失败就用原文 */ }
  }
  doc = updateNode(doc, node.id, { status: 'running', progress: 0, jobMessage: variant === 'light' ? '轻补光中…' : '重打光中…' });
  render();
  try {
    const response = await fetch('/api/generation/jobs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'comfyui-relight', imageUrl: media.url, prompt: lightPrompt, variant }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '提交失败');
    toast('已提交智能打光任务');
    pollJob(data.id, node.id);
  } catch (error) {
    doc = updateNode(doc, node.id, { status: 'failed', error: error.message || String(error) });
    render();
    toast(error.message || String(error), true);
  }
}

async function startMatte(node) {
  const media = node.resources?.[0];
  if (!media?.url) { toast('先生成一张图片'); return; }
  doc = updateNode(doc, node.id, { status: 'running', progress: 0, jobMessage: '抠图中…' });
  render();
  try {
    const response = await fetch('/api/generation/jobs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'comfyui-matte', imageUrl: media.url }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '提交失败');
    toast('已提交抠图任务');
    pollJob(data.id, node.id);
  } catch (error) {
    doc = updateNode(doc, node.id, { status: 'failed', error: error.message || String(error) });
    render();
    toast(error.message || String(error), true);
  }
}

async function startPostProcess(node, mode) {
  const media = node.resources?.[0];
  if (!media?.url) { toast('先生成一张图片'); return; }
  const isUpscale = mode === 'upscale';
  doc = updateNode(doc, node.id, { status: 'running', progress: 0, jobMessage: isUpscale ? '放大中…' : '修脸中…' });
  render();
  try {
    const response = await fetch('/api/generation/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: isUpscale ? 'comfyui-upscale' : 'comfyui-detail',
        imageUrl: media.url,
        prompt: node.generation?.prompt || '',
        upscaleBy: 1.5,
        denoise: 0.4,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '提交失败');
    toast(isUpscale ? '已提交放大任务' : '已提交修脸任务');
    pollJob(data.id, node.id);
  } catch (error) {
    doc = updateNode(doc, node.id, { status: 'failed', error: error.message || String(error) });
    render();
    toast(error.message || String(error), true);
  }
}

async function generateSelected() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node) { toast('先选中一个节点'); return; }
  if (!node.generation) { toast('这个节点没有生成配置'); return; }
  if (node.type === 'audio') { await startAudioQuote(node); return; }
  if (node.type === 'video') {
    const provider = node.generation?.backend?.provider || 'dreamina';
    if (provider === 'comfyui') { await startComfyVideo(node); return; }
    await startVideoQuote(node);
    return;
  }
  if (node.type !== 'image') { toast('这个节点暂不支持生成'); return; }
  const provider = node.generation?.backend?.provider || 'comfyui';
  if (provider === 'dreamina') {
    const imageRefs = (node.generation?.references || [])
      .map((ref) => findNode(doc, ref.id))
      .filter((refNode) => refNode?.type === 'image');
    if (imageRefs.length) { toast('即梦 API 图片暂不支持本地参考图，请切回 ComfyUI'); return; }
    await startImageQuote(node);
    return;
  }
  const imageWorkflow = node.generation?.imageWorkflow || '';
  rememberModelParams(node);
  const prompt = promptEl.value.trim();
  if (!prompt && imageWorkflow !== 'qwen21-rmbg') { toast('先写提示词'); return; }
  const frames = videoFrameRefs(node);
  if ((node.generation?.references || []).length && !frames.first) {
    toast('参考图节点还没有生成图片');
    return;
  }
  const imageUrl = frames.first?.resource?.url;
  if (qwenModeNeedsImage(imageWorkflow) && !imageUrl) { toast('先连接一张参考图，再生成 Qwen 编辑/控制模式'); return; }
  if (frames.last) toast('H3 当前只支持首帧，尾帧会忽略');
  const send = app.querySelector('#dockSend');
  send.disabled = true;
  doc = updateNode(doc, id, { status: 'running', progress: 0 });
  render();
  try {
    const response = await fetch('/api/generation/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'comfyui-image', prompt, width: comfyImageSize(node).width, height: comfyImageSize(node).height, imageUrl,
        workflow: node.generation?.imageWorkflow || undefined,
        megapixels: node.generation?.imageWorkflow?.startsWith('qwen21-') ? 1 : undefined,
        refMode: imageUrl ? (node.generation?.refMode || 'i2i') : undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '提交失败');
    toast('已提交 ComfyUI');
    pollJob(data.id, id);
  } catch (error) {
    doc = updateNode(doc, id, { status: 'failed', error: error.message || String(error) });
    render();
    toast(error.message || String(error), true);
  } finally {
    send.disabled = false;
    probeProviders();
  }
}

let pendingQuote = null;

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
  const rects = items.map(nodeRect);
  const left = Math.min(...rects.map((r) => r.x));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const top = Math.min(...rects.map((r) => r.y));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  pushHistory();
  for (const node of items) {
    const r = nodeRect(node);
    let x = r.x;
    let y = r.y;
    if (mode === 'left') x = left;
    if (mode === 'right') x = right - r.width;
    if (mode === 'centerX') x = (left + right) / 2 - r.width / 2;
    if (mode === 'top') y = top;
    if (mode === 'bottom') y = bottom - r.height;
    if (mode === 'centerY') y = (top + bottom) / 2 - r.height / 2;
    doc = moveNode(doc, node.id, Math.round(x / 8) * 8, Math.round(y / 8) * 8);
  }
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

function dreaminaSpecFor(node) {
  const model = node?.generation?.model;
  if (!model) return null;
  const type = node.type === 'image' ? 'image' : node.type === 'video' ? 'video' : node.type === 'audio' ? 'audio' : null;
  return (dreaminaCatalog[type] || []).find((item) => item.model === model) || null;
}

function dreaminaModeFor(node) {
  const spec = dreaminaSpecFor(node);
  if (!spec) return null;
  if (node.type === 'image') return spec.modes?.find((mode) => mode.name === 't2i') || spec.modes?.[0] || null;
  if (node.type === 'video') {
    const frameCount = videoFrameRefs(node).last ? 2 : videoFrameRefs(node).first ? 1 : 0;
    return (spec.modes || []).find((mode) => mode.name === (frameCount ? 'first_last_frame' : 't2v') && (mode.references?.max ?? 0) >= frameCount) || spec.modes?.[0] || null;
  }
  return spec.modes?.[0] || null;
}

function dreaminaValues(node, flag) {
  const mode = dreaminaModeFor(node);
  return (mode?.flags || []).find((item) => item.flag === flag)?.values || [];
}

function dreaminaRange(node, flag, fallbackMin, fallbackMax) {
  const mode = dreaminaModeFor(node);
  const item = (mode?.flags || []).find((entry) => entry.flag === flag);
  return {
    min: Number.isFinite(Number(item?.min)) ? Number(item.min) : fallbackMin,
    max: Number.isFinite(Number(item?.max)) ? Number(item.max) : fallbackMax,
  };
}

function dreaminaModelLabel(node) {
  return dreaminaSpecFor(node)?.displayName || '';
}

function chooseDreaminaModel(spec, type) {
  const t2i = spec.modes?.find((mode) => mode.name === (type === 'video' ? 't2v' : 't2i')) || spec.modes?.[0] || null;
  const resolutions = (t2i?.flags || []).find((flag) => flag.flag === '--resolution')?.values || [];
  const duration = (t2i?.flags || []).find((flag) => flag.flag === '--duration');
  const count = (t2i?.flags || []).find((flag) => flag.flag === '--count');
  const patch = { model: spec.model };
  if (resolutions.length) patch.resolution = resolutions[0];
  if (type === 'video') patch.durationSeconds = Number(duration?.min) >= 4 ? Math.min(5, Number(duration.max) || 5) : 5;
  if (count) patch.outputCount = Math.min(Number(count.max) || 1, 4);
  setGeneration(withSavedParams(`${type}:dreamina:${spec.model}`, patch));
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
  if (node.type === 'image') {
    return provider === 'dreamina'
      ? (dreaminaCatalog.image.length
        ? dreaminaCatalog.image.map((spec) => [`${spec.displayName}`, () => chooseDreaminaModel(spec, 'image')])
        : [
          ['Seedream 5.0 Flash', () => setGeneration({ model: 'high_aes_general_v50_flash' })],
          ['Seedream 4.1', () => setGeneration({ model: 'seedream_4.1' })],
          ['即梦 ImageMax 1.0', () => setGeneration({ model: 'jimeng_smart_image_v1' })],
        ])
      : [
        ['Qwen 2.1 · 文生图（1MP/2K）', () => setGeneration(withSavedParams('image:comfyui:qwen21-t2i', { imageWorkflow: 'qwen21-t2i', resolution: '1024 高清' }))],
        ['Qwen 2.1 · 图片编辑', () => setGeneration(withSavedParams('image:comfyui:qwen21-edit', { imageWorkflow: 'qwen21-edit', resolution: '1024 高清' }))],
        ['Qwen 2.1 · 去背景', () => setGeneration(withSavedParams('image:comfyui:qwen21-rmbg', { imageWorkflow: 'qwen21-rmbg', resolution: '1024 高清' }))],
        ['Qwen 2.1 · 姿态', () => setGeneration(withSavedParams('image:comfyui:qwen21-pose', { imageWorkflow: 'qwen21-pose', resolution: '1024 高清' }))],
        ['Qwen 2.1 · 深度', () => setGeneration(withSavedParams('image:comfyui:qwen21-depth', { imageWorkflow: 'qwen21-depth', resolution: '1024 高清' }))],
        ['Qwen 2.1 · 线稿', () => setGeneration(withSavedParams('image:comfyui:qwen21-edges', { imageWorkflow: 'qwen21-edges', resolution: '1024 高清' }))],
        ['Z-Image Turbo（快，1024²）', () => setGeneration({ imageWorkflow: 'zimage-turbo' })],
        ['Flux', () => setGeneration({ imageWorkflow: 'flux-t2i' })],
        ['Juggernaut（写实）', () => setGeneration({ imageWorkflow: 'photoreal-juggernaut' })],
        ['RealVis（写实）', () => setGeneration({ imageWorkflow: 'photoreal-realvis' })],
      ];
  }
  return provider === 'dreamina'
    ? (dreaminaCatalog.video.length
      ? dreaminaCatalog.video.map((spec) => [`${spec.displayName}`, () => chooseDreaminaModel(spec, 'video')])
      : [
        ['Seedance 2.5', () => setGeneration({ model: 'seedance_2.5_draft' })],
        ['Seedance 2.5 Flash', () => setGeneration({ model: 'seedance_2.5_flash' })],
        ['Seedance 2.5 VIP', () => setGeneration({ model: 'seedance_2.5' })],
      ])
    : [
      ['H3（快，640×352）', () => setGeneration(withSavedParams('video:comfyui:h3', { model: 'h3', durationSeconds: 5, h3Size: '360P' }))],
      ['Wan 2.2（质量，832×480）', () => setGeneration(withSavedParams('video:comfyui:wan22', { model: 'wan22', durationSeconds: 5, resolution: '480P' }))],
      ['LTX-2.3（快，640×384）', () => setGeneration(withSavedParams('video:comfyui:ltx23', { model: 'ltx23', durationSeconds: 2.7, resolution: '384P' }))],
      ['FramePack（长镜头，需首帧）', () => setGeneration(withSavedParams('video:comfyui:framepack', { model: 'framepack', durationSeconds: 3, resolution: '640P' }))],
      ['H3 多模态参考（Ref2VA）', () => setGeneration(withSavedParams('video:comfyui:h3-ref2v', { model: 'h3-ref2v', durationSeconds: 5, resolution: '352P' }))],
      ['H3 Ultimate（首尾帧/续写）', () => setGeneration(withSavedParams('video:comfyui:h3-ultimate', { model: 'h3-ultimate', durationSeconds: 5, resolution: '352P', megapixels: 0.22 }))],
    ];
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

let pictureOpenedAt = 0;

function closePicturePopover() {
  app.querySelector('#picturePopover')?.classList.remove('open');
}

function openPicturePopover() {
  const id = [...selection][0];
  const node = id ? findNode(doc, id) : null;
  if (!node?.generation) { toast('先选中一个生成节点'); return; }
  pictureOpenedAt = Date.now();
  renderPicturePopover(node);
  const pop = app.querySelector('#picturePopover');
  const dockRect = dock.getBoundingClientRect();
  pop.style.left = `${Math.max(16, Math.min(window.innerWidth - 650, dockRect.left + (dockRect.width - 620) / 2))}px`;
  pop.style.bottom = `${Math.max(12, window.innerHeight - dockRect.top + 8)}px`;
  pop.classList.add('open');
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

function renderPicturePopover(node) {
  const gen = node.generation || {};
  const ratios = ['智能', '1:1', '3:4', '16:9', '4:3', '9:16', '2:3', '3:2', '21:9'];
  app.querySelector('#picRatios').innerHTML = ratios.map((ratio) => {
    const active = (gen.ratio || '16:9') === ratio ? ' active' : '';
    let shape = '<span class="cv-ratio-shape smart">✦</span>';
    if (ratio !== '智能') {
      const [w, h] = ratio.split(':').map(Number);
      const bw = 30;
      const bh = Math.max(10, Math.min(30, Math.round(bw * h / w)));
      shape = `<span class="cv-ratio-shape" style="width:${bw}px;height:${bh}px"></span>`;
    }
    return `<button class="cv-pic-ratio${active}" data-ratio="${ratio}">${shape}<span>${ratio}</span></button>`;
  }).join('');
  const resolutions = pictureResolutions(node);
  app.querySelector('#picRes').innerHTML = resolutions.map((value) => `<button class="cv-pic-res-btn${(gen.resolution || resolutions[0]) === value ? ' active' : ''}" data-res="${value}">${value}</button>`).join('');
  const maxCount = node.type === 'image' ? dreaminaRange(node, '--count', 1, 8).max : dreaminaRange(node, '--count', 1, 4).max;
  const minCount = node.type === 'image' ? dreaminaRange(node, '--count', 1, 8).min : 1;
  const counts = Array.from({ length: Math.max(0, maxCount - minCount + 1) }, (_, index) => index + minCount);
  app.querySelector('#picCounts').innerHTML = counts.map((value) => `<button class="cv-pic-count${(gen.outputCount || 1) === value ? ' active' : ''}" data-count="${value}">${value}</button>`).join('');
  app.querySelector('#picRatios').querySelectorAll('[data-ratio]').forEach((button) => button.addEventListener('click', () => {
    doc = updateNode(doc, node.id, { generation: { ratio: button.dataset.ratio } });
    render();
    renderPicturePopover(findNode(doc, node.id));
  }));
  app.querySelector('#picRes').querySelectorAll('[data-res]').forEach((button) => button.addEventListener('click', () => {
    doc = updateNode(doc, node.id, { generation: { resolution: button.dataset.res, h3Size: node.type === 'video' ? button.dataset.res : node.generation?.h3Size } });
    render();
    renderPicturePopover(findNode(doc, node.id));
  }));
  app.querySelector('#picCounts').querySelectorAll('[data-count]').forEach((button) => button.addEventListener('click', () => {
    doc = updateNode(doc, node.id, { generation: { outputCount: Number(button.dataset.count) } });
    render();
    renderPicturePopover(findNode(doc, node.id));
  }));
}

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

async function startComfyVideo(node) {
  const prompt = promptEl.value.trim();
  rememberModelParams(node);
  if (!prompt) { toast('先写提示词'); return; }
  const frames = videoFrameRefs(node);
  const model = ['h3', 'wan22', 'ltx23', 'framepack', 'h3-ref2v', 'h3-ultimate'].includes(node.generation?.model) ? node.generation.model : 'h3';
  if (requiresH3Sections(model)) {
    const missing = missingH3Sections(prompt);
    if (missing.length) toast(`H3 提示词建议补齐六段结构（缺：${missing.join('、')}），可点「模板」`, true);
  }
  if ((model === 'h3' || model === 'framepack') && (node.generation?.references || []).length && !frames.first) {
    toast('参考图节点还没有生成图片');
    return;
  }
  if (model === 'framepack' && !frames.first?.resource?.url) { toast('FramePack 需要先连接一张图片作为首帧'); return; }
  const referenceAssets = videoReferenceAssets(node);
  const refImages = referenceAssets.filter((item) => item.nodeType === 'image' || item.type === 'image');
  const refVideos = referenceAssets.filter((item) => item.nodeType === 'video' && item.type !== 'image');
  const refAudios = referenceAssets.filter((item) => item.nodeType === 'audio');
  const sourceVideo = refVideos[0]?.url || '';
  const imageRefEntries = (node.generation?.references || []).map((ref) => ({ ref, node: findNode(doc, ref.id) })).filter((entry) => entry.node?.resources?.[0]?.url && entry.node.type === 'image');
  const explicitFirst = imageRefEntries.find((entry) => entry.ref.role === '首帧')?.node.resources[0]?.url || '';
  const explicitLast = imageRefEntries.find((entry) => entry.ref.role === '尾帧')?.node.resources[0]?.url || '';
  if (model === 'h3-ultimate' && !refImages.length && !refVideos.length) { toast('H3 Ultimate：先连接首帧/首尾帧/参考图，或源视频'); return; }
  if (model === 'h3-ultimate' && !frames.first?.resource?.url && !sourceVideo && refImages.length < 2) { toast('H3 Ultimate：首帧、首尾帧、双参考或源视频任选一种'); return; }
  if (model === 'h3-ref2v' && !refImages.length && !refVideos.length && !refAudios.length) { toast('H3 多模态参考：先连接参考图 / 视频 / 音频节点'); return; }
  const imageUrl = model === 'h3' || model === 'framepack' ? frames.first?.resource?.url : undefined;
  if (frames.last && model !== 'h3') toast('这个视频模型只使用首帧，尾帧会忽略');
  if (model === 'h3' && frames.last) toast('H3 当前只支持首帧，尾帧会忽略');
  const specs = {
    h3: { width: node.generation?.h3Size === '480P' ? 848 : 640, height: node.generation?.h3Size === '480P' ? 480 : 352, fps: 24, duration: node.generation?.durationSeconds || 5 },
    wan22: { width: 832, height: 480, fps: 16, duration: node.generation?.durationSeconds || 5 },
    ltx23: { width: 640, height: 384, fps: 24, duration: node.generation?.durationSeconds || 2.7 },
    framepack: { width: 608, height: 640, fps: 30, duration: node.generation?.durationSeconds || 3 },
    'h3-ref2v': { width: 640, height: 352, fps: 24, duration: node.generation?.durationSeconds || 5 },
    'h3-ultimate': { width: 640, height: 352, fps: 24, duration: node.generation?.durationSeconds || 5 },
  };
  const spec = specs[model];
  doc = updateNode(doc, node.id, { status: 'running', progress: 0 });
  render();
  try {
    const response = await fetch('/api/generation/jobs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'comfyui-video', prompt, model,
        width: spec.width, height: spec.height, fps: spec.fps,
        duration: spec.duration,
        imageUrl,
        refImages: model === 'h3-ref2v' ? refImages.slice(0, 9).map((item) => ({ url: item.url, filename: item.id || item.filename })) : undefined,
        refVideos: model === 'h3-ref2v' ? refVideos.slice(0, 3).map((item) => ({ url: item.url, filename: item.id || item.filename })) : undefined,
        refAudios: model === 'h3-ref2v' ? refAudios.slice(0, 3).map((item) => ({ url: item.url, filename: item.id || item.filename })) : undefined,
        firstFrameUrl: model === 'h3-ultimate' ? (explicitFirst || frames.first?.resource?.url || refImages[0]?.url) : undefined,
        lastFrameUrl: model === 'h3-ultimate' ? (explicitLast || undefined) : undefined,
        refImages: model === 'h3-ultimate' && !explicitLast ? refImages.slice(0, 2).map((item) => item.url) : undefined,
        sourceVideoUrl: model === 'h3-ultimate' ? sourceVideo : undefined,
        megapixels: model === 'h3-ultimate' ? (Number(node.generation?.megapixels) > 0 ? Number(node.generation.megapixels) : 0.22) : undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '提交失败');
    toast('已提交 ComfyUI 视频任务');
    pollJob(data.id, node.id);
  } catch (error) {
    doc = updateNode(doc, node.id, { status: 'failed', error: error.message || String(error) });
    render();
    toast(error.message || String(error), true);
  }
}

async function startImageQuote(node) {
  rememberModelParams(node);
  const prompt = promptEl.value.trim();
  if (!prompt) { toast('先写提示词'); return; }
  doc = updateNode(doc, node.id, { status: 'running', progress: 0, jobMessage: '报价中…' });
  render();
  try {
    const response = await fetch('/api/generation/quote', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'dreamina-image', prompt,
        model: node.generation?.model || undefined,
        ratio: node.generation?.ratio || '16:9',
        resolution: (() => { const allowed = dreaminaValues(node, '--resolution'); return allowed.length && !allowed.includes(node.generation?.resolution) ? allowed[0] : (node.generation?.resolution || '2K'); })(),
        count: Math.min(node.generation?.outputCount || 1, dreaminaRange(node, '--count', 1, 4).max),
      }),
    });
    const quote = await response.json();
    if (!response.ok) throw new Error(quote.error || '报价失败');
    pendingQuote = { ...quote, nodeId: node.id };
    doc = updateNode(doc, node.id, { status: 'empty' });
    render();
    openQuote(quote, '即梦图片');
  } catch (error) {
    doc = updateNode(doc, node.id, { status: 'failed' });
    render();
    toast(error.message || String(error), true);
  }
}

async function startVideoQuote(node) {
  rememberModelParams(node);
  const prompt = promptEl.value.trim();
  if (!prompt) { toast('先写提示词'); return; }
  doc = updateNode(doc, node.id, { status: 'running', progress: 0, jobMessage: '报价中…' });
  render();
  try {
    const response = await fetch('/api/generation/quote', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'dreamina-video', prompt,
        model: node.generation?.model && node.generation.model !== 'h3' ? node.generation.model : undefined,
        firstFrameUrl: videoFrameRefs(node).first?.resource?.url || undefined,
        lastFrameUrl: videoFrameRefs(node).last?.resource?.url || undefined,
        ratio: node.generation?.ratio || '16:9',
        resolution: (() => { const allowed = dreaminaValues(node, '--resolution'); const raw = String(node.generation?.resolution || '480p'); return allowed.length && !allowed.includes(raw) && !allowed.includes(raw.toLowerCase()) ? allowed[0] : raw.toLowerCase(); })(),
        duration: Math.min(Math.max(node.generation?.durationSeconds || 4, dreaminaRange(node, '--duration', 4, 15).min), dreaminaRange(node, '--duration', 4, 15).max),
      }),
    });
    const quote = await response.json();
    if (!response.ok) throw new Error(quote.error || '报价失败');
    pendingQuote = { ...quote, nodeId: node.id };
    doc = updateNode(doc, node.id, { status: 'empty' });
    render();
    openQuote(quote);
  } catch (error) {
    doc = updateNode(doc, node.id, { status: 'failed' });
    render();
    toast(error.message || String(error), true);
  }
}

async function startAudioQuote(node) {
  const prompt = promptEl.value.trim();
  if (!prompt) { toast('先写台词 / 声音描述'); return; }
  doc = updateNode(doc, node.id, { status: 'running', progress: 0 });
  render();
  try {
    const response = await fetch('/api/generation/quote', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'dreamina-audio', prompt, model: node.generation?.model || 'legacy_tts', voiceName: node.generation?.voiceName || undefined }),
    });
    const quote = await response.json();
    if (!response.ok) throw new Error(quote.error || '报价失败');
    pendingQuote = { ...quote, nodeId: node.id };
    doc = updateNode(doc, node.id, { status: 'empty' });
    render();
    openQuote(quote, '即梦音频');
  } catch (error) {
    doc = updateNode(doc, node.id, { status: 'failed', error: error.message || String(error) });
    render();
    toast(error.message || String(error), true);
  }
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
  if (!confirmed || !pendingQuote) { pendingQuote = null; return; }
  const quote = pendingQuote;
  pendingQuote = null;
  submitDreaminaJob(quote).catch((error) => toast(error.message || String(error), true));
}

async function submitDreaminaJob(quote) {
  doc = updateNode(doc, quote.nodeId, { status: 'running', progress: 0 });
  render();
  try {
    const response = await fetch('/api/generation/jobs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: quote.kind || 'dreamina-video', quoteId: quote.quoteId, creditCeiling: quote.credits }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '提交失败');
    toast('已提交即梦生成');
    await pollJob(data.id, quote.nodeId);
  } catch (error) {
    doc = updateNode(doc, quote.nodeId, { status: 'failed', error: error.message || String(error) });
    render();
    toast(error.message || String(error), true);
  }
}

let jobsRefreshTimer = null;
const pollingJobs = new Set();
let resumedJobs = false;

async function refreshJobsPanel() {
  const host = app.querySelector('#jobsList');
  if (!host) return;
  try {
    const response = await fetch('/api/generation/jobs?limit=30');
    const data = await response.json();
    const list = Array.isArray(data.jobs) ? data.jobs : [];
    const labels = { prepare: '准备', sampling: '生成中', finalize: '收尾', done: '结束' };
    host.innerHTML = list.length ? list.map((job) => {
      const terminal = ['success', 'failed', 'canceled'].includes(job.status);
      const status = job.status === 'success' ? '完成' : job.status === 'failed' ? '失败' : job.status === 'canceled' ? '已取消' : '运行中';
      const model = job.meta?.model || job.type || '';
      const progress = Math.max(0, Math.min(100, Number(job.progress) || 0));
      const eta = job.etaSeconds ? ` · 约剩 ${job.etaSeconds}s` : '';
      return `<div class="cv-job-row" data-job="${escapeHtml(job.id)}">
        <div class="cv-job-top"><b>${escapeHtml(model)}</b><span>${status}${eta}</span></div>
        <div class="cv-job-msg">${escapeHtml(job.message || labels[job.stage] || '')}</div>
        <div class="cv-job-bar"><i style="width:${terminal && job.status === 'success' ? 100 : progress}%"></i></div>
        <div class="cv-job-actions">
          ${terminal ? (job.status === 'failed' && job.meta?.request ? '<button data-job-retry>重试</button>' : '') : '<button data-job-cancel>取消</button>'}
        </div>
      </div>`;
    }).join('') : '<div class="cv-status">还没有生成任务。</div>';
    host.querySelectorAll('[data-job-cancel]').forEach((button) => button.addEventListener('click', async () => {
      const row = button.closest('[data-job]');
      button.disabled = true;
      await fetch(`/api/generation/jobs/${encodeURIComponent(row.dataset.job)}/cancel`, { method: 'POST' }).catch(() => null);
      await refreshJobsPanel();
    }));
    host.querySelectorAll('[data-job-retry]').forEach((button) => button.addEventListener('click', async () => {
      const row = button.closest('[data-job]');
      button.disabled = true;
      const response = await fetch(`/api/generation/jobs/${encodeURIComponent(row.dataset.job)}/retry`, { method: 'POST' }).catch(() => null);
      if (response && !response.ok) toast('重试失败', true);
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
  try {
  for (;;) {
    const response = await fetch(`/api/generation/jobs/${jobId}`);
    const job = await response.json();
    const node = findNode(doc, nodeId);
    if (!node) return;
    if (job.status === 'success') {
      commitResource(nodeId, { id: job.result.filename, type: job.result.type || 'image', url: job.result.url, source: job.result.provider || 'comfyui' });
      doc = updateNode(doc, nodeId, { status: 'success', progress: 100 });
      render();
      toast('生成完成');
      return;
    }
    if (job.status === 'failed' || job.status === 'canceled') {
      doc = updateNode(doc, nodeId, { status: 'failed', error: job.message || job.error?.message || '生成失败' });
      render();
      toast(job.message || '生成失败', true);
      return;
    }
    doc = updateNode(doc, nodeId, { status: 'running', progress: job.progress || 0 });
    render();
    await new Promise((resolve) => setTimeout(resolve, 1200));
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
      const response = await fetch(`/api/generation/jobs/${node.jobId}`);
      if (!response.ok) { doc = updateNode(doc, node.id, { status: 'failed', error: '任务已失效' }); render(); continue; }
      const job = await response.json();
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

function toolIcon(label) {
  const icons = {
    智能改图: '<svg viewBox="0 0 16 16"><path d="M8 2l1.2 3.1L12 6.3 9.2 7.5 8 10.6 6.8 7.5 4 6.3l2.8-1.2z"/><path d="M12.2 10.5l.7 1.7 1.6.6-1.6.6-.7 1.7-.6-1.7-1.7-.6 1.7-.6z"/></svg>',
    局部重绘: '<svg viewBox="0 0 16 16"><path d="M3 13l1.2-3.5L11 2.7a1.4 1.4 0 012 2L6.2 11.5z"/><path d="M9.8 4l2.2 2.2"/></svg>',
    扩图: '<svg viewBox="0 0 16 16"><path d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3"/></svg>',
    抠图: '<svg viewBox="0 0 16 16"><circle cx="4" cy="4" r="2"/><circle cx="4" cy="12" r="2"/><path d="M5.6 5.4L13 12M5.6 10.6L13 4"/></svg>',
    预设: '<svg viewBox="0 0 16 16"><rect x="3" y="3" width="4" height="4" rx="1"/><rect x="9" y="3" width="4" height="4" rx="1"/><rect x="3" y="9" width="4" height="4" rx="1"/><rect x="9" y="9" width="4" height="4" rx="1"/></svg>',
    工具: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2"/><path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2M4.1 4.1l1.4 1.4M10.5 10.5l1.4 1.4M11.9 4.1l-1.4 1.4M5.5 10.5l-1.4 1.4"/></svg>',
    智能超清: '<svg viewBox="0 0 16 16"><path d="M8 12V4M5 7l3-3 3 3"/><path d="M3 13h10"/></svg>',
    修脸: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/><path d="M5.8 6.3h.01M10.2 6.3h.01M5.8 9.6c.6.9 1.4 1.4 2.2 1.4s1.6-.5 2.2-1.4"/></svg>',
    智能打光: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.4"/><path d="M8 2v1.6M8 12.4V14M2 8h1.6M12.4 8H14M3.8 3.8l1.1 1.1M11.1 11.1l1.1 1.1M12.2 3.8l-1.1 1.1M4.9 11.1l-1.1 1.1"/></svg>',
    版本: '<svg viewBox="0 0 16 16"><path d="M8 2.8L13 5.6 8 8.4 3 5.6z"/><path d="M3 8.2l5 2.8 5-2.8"/><path d="M3 10.8l5 2.8 5-2.8"/></svg>',
    下载: '<svg viewBox="0 0 16 16"><path d="M8 3v8M5 8.5l3 3 3-3M3 13h10"/></svg>',
    视频修剪: '<svg viewBox="0 0 16 16"><circle cx="4" cy="4" r="1.8"/><circle cx="4" cy="12" r="1.8"/><path d="M5.5 5.2L13 12M5.5 10.8L13 4"/></svg>',
    截取帧: '<svg viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="9" rx="1.5"/><path d="M2.5 8h11M8 3.5v9"/></svg>',
    分离音频: '<svg viewBox="0 0 16 16"><path d="M6 12V4l6-1.4v7.6"/><circle cx="4.4" cy="12" r="1.6"/><circle cx="10.4" cy="10.2" r="1.6"/></svg>',
    生成配音: '<svg viewBox="0 0 16 16"><rect x="6" y="2.5" width="4" height="7" rx="2"/><path d="M4 8.5a4 4 0 008 0M8 12.5V14"/></svg>',
    音色库: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="1.3"/></svg>',
    裁剪音频: '<svg viewBox="0 0 16 16"><path d="M3 8h10M5 5v6M11 5v6"/></svg>',
    复制: '<svg viewBox="0 0 16 16"><rect x="5" y="3" width="8" height="8" rx="1.5"/><path d="M3 5v8h8"/></svg>',
    删除: '<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  };
  return icons[label] || '';
}

function renderNodeTools(node) {
  const tools = app.querySelector('#nodeTools');
  if (!node) { tools.classList.remove('open'); tools.innerHTML = ''; return; }
  const actions = {
    image: ['智能改图', '局部重绘', '扩图', '抠图', '预设', '工具', '智能超清', '修脸', '智能打光', '版本', '下载'],
    video: ['视频修剪', '截取帧', '分离音频', '版本', '下载'],
    audio: ['生成配音', '音色库', '裁剪音频', '版本', '下载'],
    text: ['复制', '删除'],
    stage: ['打开导演台'],
    timeline: ['打开时间线'],
  }[node.type] || ['下载'];
  tools.innerHTML = actions.map((label) => `<button data-tool="${label}" title="${label}">${toolIcon(label) ? `<span class="cv-tool-icon">${toolIcon(label)}</span>` : ''}${label}</button>`).join('<span class="cv-tool-sep"></span>');
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

async function onNodeTool(node, tool) {
  if (tool === '删除') { doc = removeNode(doc, node.id); selection = new Set(); render(); toast('已删除'); return; }
  if (tool === '复制') { copySelected(); return; }
  if (tool === '生成配音' && node.type === 'audio') { await startAudioQuote(node); return; }
  if (tool === '下载') {
    const media = node.resources?.[0];
    if (!media?.url) { toast('还没有生成结果'); return; }
    const link = document.createElement('a');
    link.href = media.url;
    link.download = media.id || 'canvas-result';
    link.click();
    return;
  }
  if (tool === '版本') { openVersions(node); return; }
  if (tool === '裁剪音频' && node.type === 'audio') { openAudioTrim(node); return; }
  if (tool === '智能超清' && node.type === 'image') { await startPostProcess(node, 'upscale'); return; }
  if (tool === '修脸' && node.type === 'image') { await startPostProcess(node, 'detail'); return; }
  if (tool === '局部重绘' && node.type === 'image') { openMaskEditor(node); return; }
  if (tool === '抠图' && node.type === 'image') { await startMatte(node); return; }
  if (tool === '智能打光' && node.type === 'image') { relightMenu(node); return; }
  if (tool === '扩图' && node.type === 'image') { outpaintMenu(node); return; }
  if (tool === '智能改图' && node.type === 'image') {
    const hasRefs = (node.generation?.references || []).some((ref) => findNode(doc, ref.id)?.type === 'image');
    if (!hasRefs) { toast('先从图片节点连一条参考线'); return; }
    if (!promptEl.value.trim()) { promptEl.focus(); toast('写一句改图要求，再点一次「智能改图」'); return; }
    if (!node.generation?.refMode) doc = updateNode(doc, node.id, { generation: { refMode: 'i2i' } });
    await generateSelected();
    return;
  }
  if (tool === '预设' && node.type === 'image') { showPresetMenu(node); return; }
  if (tool === '工具' && node.type === 'image') { showImageToolMenu(node); return; }
  if (tool === '视频修剪' && node.type === 'video') { openVideoTrim(node); return; }
  if (tool === '截取帧' && node.type === 'video') { await extractVideoFrame(node); return; }
  if (tool === '分离音频' && node.type === 'video') { await extractVideoAudio(node); return; }
  if (tool === '打开时间线' && node.type === 'timeline') { openTimeline(node); return; }
  if (tool === '打开导演台') { openDirectorStage(); return; }
  toast(`${tool} 将在后续接入`);
}

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

const CAMERA_OPTIONS = {
  camera: ['自动', 'ARRI Alexa 65', 'RED Komodo', 'Sony Venice', 'Blackmagic Ursa'],
  lens: ['自动', '定焦 35mm', '定焦 50mm', '变焦 24-70mm', '微距 100mm'],
  focal: ['自动', '广角', '中景', '特写', '远景'],
  aperture: ['自动', 'f/1.4', 'f/2.8', 'f/4', 'f/8'],
};

const PALETTES = [
  ['日系清新', ['#d9e7df', '#a8c6b8', '#f2e9dc', '#7d9f92']],
  ['雾蓝米白', ['#cfd9e2', '#8fa6b8', '#f3efe7', '#5f7588']],
  ['复古糖果', ['#f2b6c1', '#f6d365', '#8fd3c7', '#c48f9f']],
  ['暖黄灰褐', ['#e6c79c', '#b58b63', '#f4ead9', '#7b614c']],
  ['冷青琥珀', ['#8fc7c9', '#e0a35c', '#20343a', '#d9d2c3']],
  ['南法假日', ['#f2d8a7', '#7fb6b0', '#e38b6d', '#f7f1e3']],
  ['沙漠史诗', ['#e0a562', '#b8753f', '#f2dfc2', '#5e412b']],
];

const STYLES = ['复古对称美学', '电影胶片', '赛博霓虹', '水墨东方', '清新日系', '暗黑史诗'];

let selectedPalette = 0;
let selectedStyle = 0;

function appendPrompt(text) {
  const value = promptEl.value.trimEnd();
  promptEl.value = `${value}${value ? '\n' : ''}${text}`;
  onPromptInput();
  promptEl.focus();
}

function openCameraModal(node) {
  const camera = node.generation?.camera || {};
  for (const key of ['camera', 'lens', 'focal', 'aperture']) {
    const select = app.querySelector({ camera: '#camCamera', lens: '#camLens', focal: '#camFocal', aperture: '#camAperture' }[key]);
    select.innerHTML = CAMERA_OPTIONS[key].map((value) => `<option${value === (camera[key] || '自动') ? ' selected' : ''}>${value}</option>`).join('');
  }
  app.querySelector('#cameraModal').dataset.node = node.id;
  app.querySelector('#cameraModal').classList.add('open');
}

function applyCamera() {
  const modal = app.querySelector('#cameraModal');
  const node = findNode(doc, modal.dataset.node);
  if (!node) return;
  const camera = {
    camera: app.querySelector('#camCamera').value,
    lens: app.querySelector('#camLens').value,
    focal: app.querySelector('#camFocal').value,
    aperture: app.querySelector('#camAperture').value,
  };
  doc = updateNode(doc, node.id, { generation: { camera } });
  const parts = [];
  if (camera.camera !== '自动') parts.push(`相机 ${camera.camera}`);
  if (camera.lens !== '自动') parts.push(`镜头 ${camera.lens}`);
  if (camera.focal !== '自动') parts.push(`${camera.focal}景别`);
  if (camera.aperture !== '自动') parts.push(`光圈 ${camera.aperture}`);
  if (parts.length) appendPrompt(`镜头语言：${parts.join('，')}`);
  modal.classList.remove('open');
  render();
  toast('已应用相机参数');
}

function openPaletteModal(node) {
  const grid = app.querySelector('#paletteGrid');
  grid.innerHTML = PALETTES.map(([name, colors], index) => `<button class="cv-palette${index === selectedPalette ? ' active' : ''}" data-index="${index}"><b>${name}</b><span>${colors.map((color) => `<i style="background:${color}"></i>`).join('')}</span></button>`).join('');
  grid.querySelectorAll('[data-index]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedPalette = Number(button.dataset.index);
      grid.querySelectorAll('.cv-palette').forEach((el) => el.classList.toggle('active', el === button));
    });
  });
  app.querySelector('#paletteModal').dataset.node = node.id;
  app.querySelector('#paletteModal').classList.add('open');
}

function applyPalette() {
  const modal = app.querySelector('#paletteModal');
  const node = findNode(doc, modal.dataset.node);
  if (!node) return;
  const [name, colors] = PALETTES[selectedPalette];
  doc = updateNode(doc, node.id, { generation: { palette: name } });
  appendPrompt(`配色：${name}（${colors.join(' / ')}）`);
  modal.classList.remove('open');
  render();
  toast(`已应用配色：${name}`);
}

function openStyleModal(node) {
  const list = app.querySelector('#styleList');
  list.innerHTML = STYLES.map((name, index) => `<button class="cv-style${index === selectedStyle ? ' active' : ''}" data-index="${index}">${name}</button>`).join('');
  list.querySelectorAll('[data-index]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedStyle = Number(button.dataset.index);
      list.querySelectorAll('.cv-style').forEach((el) => el.classList.toggle('active', el === button));
    });
  });
  app.querySelector('#styleModal').dataset.node = node.id;
  app.querySelector('#styleModal').classList.add('open');
}

function applyStyle() {
  const modal = app.querySelector('#styleModal');
  const node = findNode(doc, modal.dataset.node);
  if (!node) return;
  const name = STYLES[selectedStyle];
  doc = updateNode(doc, node.id, { generation: { style: name } });
  appendPrompt(`风格：${name}`);
  modal.classList.remove('open');
  render();
  toast(`已应用风格：${name}`);
}

const CAMERA_MOVES = {
  '推镜头': '镜头缓慢推近，主体逐渐占据画面',
  '拉镜头': '镜头缓慢拉远，逐渐展现环境',
  '摇镜头': '镜头水平摇移，扫过场景',
  '移镜头': '镜头横向平移，跟随主体',
  '跟拍': '镜头跟随主体移动，保持中景',
  '环绕': '镜头围绕主体环绕，背景旋转',
  '升降': '镜头垂直升降，改变视角高度',
};

function openCameraMoveMenu(node) {
  showContextMenu(Object.keys(CAMERA_MOVES).map((label) => [label, () => {
    appendPrompt(`运镜：${CAMERA_MOVES[label]}`);
    toast(`已加入运镜：${label}`);
  }]), 420, 300);
}

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
      let mode = current.generation.mode;
      if (current.type === 'image' && source.type === 'image') mode = 'i2i';
      if (current.type === 'video') mode = source.type === 'image' ? 'i2v' : 'm2v';
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

let timelineNode = null;
let timelineDraft = [];
let timelineSelected = null;
let timelineDrag = null;
let timelineAssetFilter = 'all';


function openTimeline(node) {
  try {
    timelineNode = node;
    timelineDraft = Array.isArray(node.timelineItems) && node.timelineItems.length
      ? normalizeTimelineItems(node.timelineItems)
      : scanTimelineNodes(doc.nodes);
    timelineSelected = timelineDraft[0]?.id || null;
    renderTimelineRows();
    app.querySelector('#timelineModal').classList.add('open');
  } catch (error) {
    toast(error.message || String(error), true);
  }
}


function timelineAssetNodes() {
  return doc.nodes.filter((node) => node.resources?.[0]?.url && (node.type === 'image' || node.type === 'video' || node.type === 'audio'));
}

function addAssetToTimeline(node) {
  if (!node) return;
  if (timelineDraft.some((item) => item.id === node.id)) { timelineSelected = node.id; renderTimelineRows(); return; }
  const end = timelineDraft.reduce((max, item) => Math.max(max, (Number(item.start) || 0) + (Number(item.duration) || 0)), 0);
  const duration = node.type === 'image' ? 3 : (Number(node.generation?.durationSeconds) || 5);
  timelineDraft.push({ id: node.id, label: node.title || node.type, type: node.type, start: end, duration, sourceStart: 0, transition: 'none' });
  timelineSelected = node.id;
  renderTimelineRows();
}

function renderTimelineRows() {
  const total = timelineTotalDuration(timelineDraft);
  const assets = timelineAssetNodes().filter((node) => timelineAssetFilter === 'all' || node.type === timelineAssetFilter);
  const assetHost = app.querySelector('#timelineAssets');
  assetHost.innerHTML = assets.length ? assets.map((node) => `<button class="cv-timeline-asset" data-asset="${node.id}">${node.resources?.[0]?.url && node.type !== 'audio' ? `<img src="${escapeHtml(node.resources[0].url)}" alt="">` : '<span class="cv-timeline-asset-audio">♫</span>'}<b>${escapeHtml(node.title || node.type)}</b><em>${node.type === 'video' ? '视频' : node.type === 'audio' ? '音频' : '图片'}</em></button>`).join('') : '<div class="cv-timeline-asset-empty">将文件拖至此处添加</div>';
  assetHost.querySelectorAll('[data-asset]').forEach((button) => button.addEventListener('click', () => addAssetToTimeline(findNode(doc, button.dataset.asset))));
  const ruler = app.querySelector('#timelineRuler');
  const step = total > 30 ? 5 : total > 12 ? 2 : 1;
  const ticks = [];
  for (let t = 0; t <= total; t += step) ticks.push(`<span style="left:${(t / total) * 100}%">${formatTimelineTime(t)}</span>`);
  ruler.innerHTML = ticks.join('');
  const lanes = ['video', 'audio'];
  const host = app.querySelector('#timelineLanes');
  host.innerHTML = lanes.map((type) => {
    const clips = timelineDraft.filter((item) => (type === 'video' ? (item.type === 'video' || item.type === 'image') : item.type === 'audio')).map((item) => {
      const left = ((Number(item.start) || 0) / total) * 100;
      const width = Math.max(1, ((Number(item.duration) || 0) / total) * 100);
      const selected = timelineSelected === item.id ? ' selected' : '';
      return `<div class="cv-tl-clip ${type}${selected}" data-item="${item.id}" style="left:${left}%;width:${width}%"><span class="handle left" data-edge="start"></span><b>${escapeHtml(item.label || item.type)}</b><span class="handle right" data-edge="end"></span></div>`;
    }).join('');
    return `<div class="cv-timeline-lane"><div class="cv-timeline-lane-label">${type === 'video' ? '视频' : '音频'}</div><div class="cv-timeline-lane-track">${clips}<button class="cv-timeline-add" title="添加素材">+</button></div></div>`;
  }).join('');
  const totalSeconds = timelineDraft.reduce((max, item) => Math.max(max, (Number(item.start) || 0) + (Number(item.duration) || 0)), 0);
  app.querySelector('#timelineTotal').textContent = `${timelineDraft.length} 个片段 · ${totalSeconds.toFixed(1)}s`;
  host.querySelectorAll('.cv-timeline-add').forEach((button) => button.addEventListener('click', () => { const first = timelineAssetNodes()[0]; if (first) addAssetToTimeline(first); }));
  host.querySelectorAll('.cv-tl-clip').forEach((clip) => {
    const item = timelineDraft.find((entry) => entry.id === clip.dataset.item);
    if (!item) return;
    clip.addEventListener('click', (event) => {
      event.stopPropagation();
      timelineSelected = item.id;
      updateTimelinePreview(item);
      renderTimelineRows();
    });
    clip.addEventListener('pointerdown', (event) => {
      if (event.target.closest('.handle')) return;
      startTimelineDrag(event, item, 'move');
    });
    clip.querySelectorAll('.handle').forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => startTimelineDrag(event, item, handle.dataset.edge === 'start' ? 'trim-start' : 'trim-end'));
    });
    clip.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      showContextMenu([
        [item.transition === 'fade' ? '✓ 淡入淡出' : '淡入淡出', () => { item.transition = item.transition === 'fade' ? 'none' : 'fade'; renderTimelineRows(); }],
        [item.transition === 'black' ? '✓ 黑场' : '黑场', () => { item.transition = item.transition === 'black' ? 'none' : 'black'; renderTimelineRows(); }],
        ['无转场', () => { item.transition = 'none'; renderTimelineRows(); }],
        ['移除片段', () => { timelineDraft = timelineDraft.filter((entry) => entry.id !== item.id); timelineSelected = timelineDraft[0]?.id || null; renderTimelineRows(); }],
      ], event.clientX, event.clientY);
    });
  });
  if (timelineSelected) {
    const item = timelineDraft.find((entry) => entry.id === timelineSelected);
    if (item) updateTimelinePreview(item);
  }
}


function splitTimelineClip() {
  const item = timelineDraft.find((entry) => entry.id === timelineSelected);
  if (!item) { toast('先选一个片段'); return; }
  const parts = splitTimelineItem(item);
  if (!parts) return;
  const index = timelineDraft.indexOf(item);
  timelineDraft.splice(index, 1, ...parts);
  timelineSelected = parts[0].id;
  renderTimelineRows();
}

function deleteTimelineClip() {
  if (!timelineSelected) { toast('先选一个片段'); return; }
  timelineDraft = timelineDraft.filter((entry) => entry.id !== timelineSelected);
  timelineSelected = timelineDraft[0]?.id || null;
  renderTimelineRows();
}

function updateTimelinePreview(item) {
  const preview = app.querySelector('#timelinePreview');
  const image = app.querySelector('#timelinePreviewImage');
  const empty = app.querySelector('#timelinePreviewEmpty');
  const url = findNode(doc, item.id)?.resources?.[0]?.url;
  const isImage = item.type === 'image';
  preview.hidden = !url || isImage;
  image.hidden = !url || !isImage;
  empty.hidden = Boolean(url);
  if (url && image.dataset.clip !== item.id) {
    image.dataset.clip = item.id;
    if (isImage) image.src = url;
  }
  if (!isImage && url && preview.dataset.clip !== item.id) {
    preview.dataset.clip = item.id;
    preview.src = url;
    preview.load();
  }
  app.querySelector('#timelinePlayhead').textContent = `${formatTimelineTime(item.start)} / ${formatTimelineTime((Number(item.start) || 0) + (Number(item.duration) || 0))}`;
}

function startTimelineDrag(event, item, mode) {
  event.preventDefault();
  event.stopPropagation();
  const lane = app.querySelector('#timelineLanes');
  const width = lane.getBoundingClientRect().width || 1;
  timelineSelected = item.id;
  timelineDrag = { id: item.id, mode, startX: event.clientX, pxPerSecond: width / timelineTotalDuration(timelineDraft), origin: { ...item } };
  document.addEventListener('pointermove', onTimelineDragMove);
  document.addEventListener('pointerup', onTimelineDragUp, { once: true });
  updateTimelinePreview(item);
}

function onTimelineDragMove(event) {
  if (!timelineDrag) return;
  const item = timelineDraft.find((entry) => entry.id === timelineDrag.id);
  if (!item) return;
  const delta = (event.clientX - timelineDrag.startX) / timelineDrag.pxPerSecond;
  const next = dragTimelineItem(item, timelineDrag.origin, timelineDrag.mode, delta);
  if (next) Object.assign(item, next);
  renderTimelineRows();
}

function onTimelineDragUp() {
  document.removeEventListener('pointermove', onTimelineDragMove);
  timelineDrag = null;
  renderTimelineRows();
}

function playTimelineClip() {
  const item = timelineDraft.find((entry) => entry.id === timelineSelected);
  if (!item) { toast('先选一个片段'); return; }
  const preview = app.querySelector('#timelinePreview');
  if (!preview.src) { toast('这个片段还没有素材'); return; }
  const button = app.querySelector('#timelinePlay');
  if (!preview.paused) { preview.pause(); button.textContent = '▶'; return; }
  try {
    if (Math.abs(preview.currentTime - (Number(item.sourceStart) || 0)) > 0.2) preview.currentTime = Number(item.sourceStart) || 0;
    preview.play();
    button.textContent = '❚❚';
    window.clearTimeout(playTimelineClip.timer);
    playTimelineClip.timer = window.setTimeout(() => { preview.pause(); button.textContent = '▶'; }, Math.max(300, (Number(item.duration) || 1) * 1000));
  } catch { toast('预览失败'); }
}

function openTimelineExportMenu() {
  const button = app.querySelector('#timelineExport');
  const rect = button.getBoundingClientRect();
  showContextMenu([
    ['横屏 1080p（1920×1080）', () => exportTimelineMovie('landscape')],
    ['竖屏 1080p（1080×1920）', () => exportTimelineMovie('portrait')],
    ['草稿 720p（1280×720）', () => exportTimelineMovie('draft')],
  ], rect.left, rect.bottom + 6);
}

async function exportTimelineMovie(preset = 'landscape') {
  const items = timelineDraft.filter((item) => item.type === 'video' || item.type === 'image').map((item) => ({
    type: item.type,
    videoUrl: item.type === 'video' ? findNode(doc, item.id)?.resources?.[0]?.url : undefined,
    imageUrl: item.type === 'image' ? findNode(doc, item.id)?.resources?.[0]?.url : undefined,
    sourceStart: Number(item.sourceStart) || 0,
    duration: Number(item.duration) || (item.type === 'image' ? 3 : 5),
    transition: item.transition || 'none',
  })).filter((item) => item.videoUrl || item.imageUrl);
  if (!items.length) { toast('时间线里没有可导出的片段'); return; }
  const button = app.querySelector('#timelineExport');
  button.disabled = true;
  button.textContent = '导出中…';
  try {
    const response = await fetch('/api/generation/timeline/export', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items, preset }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '导出失败');
    showTimelineExportChoice(data);
  } catch (error) {
    toast(error.message || String(error), true);
  } finally {
    button.disabled = false;
    button.textContent = '导出 MP4';
  }
}

function showTimelineExportChoice(data) {
  const button = app.querySelector('#timelineExport');
  const rect = button.getBoundingClientRect();
  showContextMenu([
    ['加入画布（生成视频节点）', () => addExportedVideoToCanvas(data)],
    ['导出到文件夹…', () => saveExportedVideoToFolder(data)],
    ['直接下载', () => { const link = document.createElement('a'); link.href = data.url; link.download = data.filename || 'timeline.mp4'; link.click(); }],
  ], rect.left, rect.bottom + 6);
}

function addExportedVideoToCanvas(data) {
  saveTimeline();
  app.querySelector('#timelineModal').classList.remove('open');
  document.body.classList.remove('timeline-open');
  const timeline = timelineNode;
  const rect = timeline ? nodeRect(timeline) : { x: 0, y: 0, width: 600, height: 320 };
  pushHistory();
  doc = addNode(doc, {
    type: 'video',
    title: '时间线成片',
    layout: { x: Math.round(rect.x + rect.width + 48), y: Math.round(rect.y), width: 569, height: 320 },
    resources: [{ id: data.filename, type: 'video', url: data.url, source: 'timeline' }],
    generation: { mode: 't2v', prompt: '时间线成片', model: 'h3', ratio: '16:9', resolution: '480P', durationSeconds: 5, outputCount: 1 },
  });
  selection = new Set([doc.nodes.at(-1).id]);
  render();
  toast('时间线成片已加入画布');
}

function saveExportedVideoToFolder(data) {
  if (EMBED) {
    try {
      parent.postMessage({ type: 'canvas-save-file', url: data.url, filename: data.filename || 'timeline.mp4' }, location.origin);
      toast('请选择保存文件夹');
      return;
    } catch { /* fall through */ }
  }
  const link = document.createElement('a');
  link.href = data.url;
  link.download = data.filename || 'timeline.mp4';
  link.click();
}

function closeTimelineView() {
  saveTimeline();
  app.querySelector('#timelineModal').classList.remove('open');
  document.body.classList.remove('timeline-open');
}

function saveTimeline() {
  if (!timelineNode) return;
  doc = updateNode(doc, timelineNode.id, { timelineItems: timelineDraft, status: 'success' });
  app.querySelector('#timelineModal').classList.remove('open');
  document.body.classList.remove('timeline-open');
  render();
  toast('时间线已保存');
}

function openVersions(node) {
  const grid = app.querySelector('#versionsGrid');
  const items = [];
  if (node.resources?.[0]?.url) items.push({ ...node.resources[0], current: true });
  items.push(...(node.versions || []));
  grid.innerHTML = items.length ? items.map((item, index) => `<button class="cv-version${item.current ? ' current' : ''}" data-index="${index}">${item.type === 'video' ? '<video src="' + item.url + '" muted></video>' : item.type === 'audio' ? '<span class="cv-version-audio">♪</span>' : '<img src="' + item.url + '" alt="">'}<span>${item.current ? '当前' : new Date(item.createdAt || Date.now()).toLocaleTimeString()}</span></button>`).join('') : '<div class="cv-status">还没有生成结果</div>';
  grid.querySelectorAll('[data-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = items[Number(button.dataset.index)];
      if (!item || item.current) return;
      commitResource(node.id, { id: item.id, type: item.type, url: item.url, source: item.source || 'version' });
      app.querySelector('#versionsModal').classList.remove('open');
      render();
      toast('已切换版本');
    });
  });
  app.querySelector('#versionsModal').classList.add('open');
}

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

function openAssetsPanel() {
  const grid = app.querySelector('#assetsGrid');
  const assets = collectAssets();
  grid.innerHTML = assets.length ? assets.map((asset, index) => `<button class="cv-asset" data-index="${index}">${asset.type === 'video' ? '<video src="' + asset.url + '" muted></video>' : asset.type === 'audio' ? '<span class="cv-version-audio">♪</span>' : '<img src="' + asset.url + '" alt="">'}<span>${escapeHtml(asset.nodeTitle || '')}</span></button>`).join('') : '<div class="cv-status">画布里还没有生成资产</div>';
  grid.querySelectorAll('[data-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const asset = assets[Number(button.dataset.index)];
      if (!asset) return;
      const center = screenToWorld({ x: stage.clientWidth / 2, y: stage.clientHeight / 2 }, doc.viewport);
      const type = asset.type === 'video' ? 'video' : asset.type === 'audio' ? 'audio' : 'image';
      pushHistory();
      doc = addNode(doc, {
        type,
        title: `资产 · ${asset.nodeTitle || type}`,
        layout: { x: Math.round(center.x - (type === 'audio' ? 160 : 284)), y: Math.round(center.y - 160), width: type === 'audio' ? 320 : 569, height: 320 },
        resources: [{ ...asset, source: 'asset' }],
        generation: type === 'image' ? { mode: 'i2i', prompt: '', model: 'comfyui', ratio: '16:9', resolution: '2K', outputCount: 1 } : type === 'video' ? { mode: 't2v', prompt: '', model: 'dreamina', ratio: '16:9', resolution: '480P', durationSeconds: 5, outputCount: 1 } : { mode: 'tts', prompt: '', model: 'dreamina', ratio: '16:9', resolution: '2K', outputCount: 1 },
      });
      selection = new Set([doc.nodes.at(-1).id]);
      app.querySelector('#assetsModal').classList.remove('open');
      render();
      toast('已从资产库加入画布');
    });
  });
  app.querySelector('#assetsModal').classList.add('open');
}

let optimizeVersions = { zh: '', en: '' };
let optimizeLang = 'zh';

function switchOptimizeLang(lang) {
  const textarea = app.querySelector('#optimizeText');
  optimizeVersions[optimizeLang] = textarea.value;
  optimizeLang = lang;
  textarea.value = optimizeVersions[lang] || '';
  app.querySelectorAll('#optimizeLangs [data-lang]').forEach((button) => button.classList.toggle('active', button.dataset.lang === lang));
}

let aiMessages = [];
let aiBusy = false;

function aiContextLabel() {
  const node = [...selection][0] ? findNode(doc, [...selection][0]) : null;
  if (!node) return 'DeepSeek · 未选中节点';
  return `DeepSeek · 上下文：${node.title || node.type}`;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return; } catch { /* fallback */ }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

function openAIPanel() {
  app.querySelector('#aiPanel').classList.add('open');
  app.querySelector('#aiContext').textContent = aiContextLabel();
  app.querySelector('#aiInput').focus();
  renderAIMessages();
}

function renderAIMessages() {
  const host = app.querySelector('#aiMessages');
  if (!aiMessages.length) {
    host.innerHTML = '<div class="cv-ai-hint">可以问：这场戏怎么分镜？/ 帮我写一段雨夜追车的提示词 / 这个镜头用什么景别？</div>';
    return;
  }
  host.innerHTML = aiMessages.map((message, index) => `<div class="cv-ai-msg ${message.role}">${escapeHtml(message.content).replace(/\n/g, '<br>')}${`<button data-ai-copy="${index}">复制</button>`}${message.role === 'assistant' ? `<button data-ai-insert="${index}">插入提示词</button><button data-ai-apply="${index}">应用到节点</button>` : ''}</div>`).join('');
  host.querySelectorAll('[data-ai-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const message = aiMessages[Number(button.dataset.aiCopy)];
      if (!message) return;
      try { await copyText(message.content); toast('已复制'); }
      catch { toast('复制失败，请手动选中复制', true); }
    });
  });
  host.querySelectorAll('[data-ai-insert]').forEach((button) => {
    button.addEventListener('click', () => {
      const message = aiMessages[Number(button.dataset.aiInsert)];
      if (!message) return;
      promptEl.value = `${promptEl.value ? promptEl.value + '\n' : ''}${message.content}`;
      onPromptInput();
      toast('已插入提示词');
    });
  });
  host.querySelectorAll('[data-ai-apply]').forEach((button) => {
    button.addEventListener('click', () => {
      const message = aiMessages[Number(button.dataset.aiApply)];
      const node = [...selection][0] ? findNode(doc, [...selection][0]) : null;
      if (!message) return;
      if (!node) { toast('先选中一个节点'); return; }
      if (node.generation) doc = updateNode(doc, node.id, { generation: { prompt: message.content } });
      else if (node.type === 'text') doc = updateNode(doc, node.id, { text: message.content });
      promptEl.value = message.content;
      render();
      toast('已写入选中节点');
    });
  });
  host.scrollTop = host.scrollHeight;
}

function aiContext() {
  const node = [...selection][0] ? findNode(doc, [...selection][0]) : null;
  return {
    canvas: { nodes: doc.nodes.length, boards: boardList.length, projectId: boardProjectId },
    selection: node ? {
      type: node.type,
      title: node.title,
      status: node.status,
      prompt: node.generation?.prompt || node.text || '',
      mode: node.generation?.mode,
      model: node.generation?.model,
      ratio: node.generation?.ratio,
      resolution: node.generation?.resolution,
      references: (node.generation?.references || []).map((ref) => ({ type: ref.type, role: ref.role || '通用', title: findNode(doc, ref.id)?.title })),
    } : null,
  };
}

async function sendAIMessage() {
  const input = app.querySelector('#aiInput');
  const text = input.value.trim();
  if (!text || aiBusy) return;
  aiBusy = true;
  aiMessages.push({ role: 'user', content: text });
  input.value = '';
  renderAIMessages();
  const send = app.querySelector('#aiSend');
  send.disabled = true;
  send.textContent = '思考中…';
  try {
    const response = await fetch('/api/generation/assistant', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: aiMessages, context: aiContext() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'AI 助手失败');
    aiMessages.push({ role: 'assistant', content: data.reply });
  } catch (error) {
    aiMessages.push({ role: 'assistant', content: `出错了：${error.message}` });
  } finally {
    aiBusy = false;
    send.disabled = false;
    send.textContent = '发送';
    renderAIMessages();
  }
}

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
  const items = [[template.label, () => applyPromptTemplate(template.text)]];
  const button = app.querySelector('#dockTemplate');
  const rect = button.getBoundingClientRect();
  showContextMenu(items, rect.left, Math.max(80, rect.top - 100));
}

async function optimizePrompt() {
  const prompt = promptEl.value.trim();
  if (!prompt) { toast('先写提示词'); return; }
  const node = findNode(doc, [...selection][0]);
  const button = app.querySelector('#dockOptimize');
  button.disabled = true;
  const original = button.textContent;
  button.textContent = '优化中…';
  const modal = app.querySelector('#optimizeModal');
  const status = app.querySelector('#optimizeStatus');
  const textarea = app.querySelector('#optimizeText');
  modal.classList.add('open');
  textarea.value = prompt;
  status.textContent = '正在调用 DeepSeek…';
  status.classList.remove('bad');
  try {
    const response = await fetch('/api/generation/prompt/optimize', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, mode: node?.type === 'video' ? 'video' : node?.type === 'audio' ? 'audio' : 'image' }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '优化失败');
    optimizeVersions = { zh: data.optimized || prompt, en: data.optimizedEn || '' };
    optimizeLang = /[\u3400-\u9fff]/.test(prompt) ? 'zh' : 'en';
    textarea.value = optimizeVersions[optimizeLang];
    app.querySelectorAll('#optimizeLangs [data-lang]').forEach((button) => button.classList.toggle('active', button.dataset.lang === optimizeLang));
    status.textContent = `已由 ${data.model || 'DeepSeek'} 优化${optimizeVersions.en ? '（中文/英文双版）' : ''}`;
  } catch (error) {
    status.textContent = `优化失败：${error.message}`;
    status.classList.add('bad');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function translatePrompt() {
  const prompt = promptEl.value.trim();
  if (!prompt) { toast('先写提示词'); return; }
  const button = app.querySelector('#dockTranslate');
  button.disabled = true;
  try {
    const response = await fetch('/api/generation/prompt/translate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '翻译失败');
    promptEl.value = data.translated;
    onPromptInput();
    toast('已翻译成英文');
  } catch (error) {
    toast(error.message || String(error), true);
  } finally {
    button.disabled = false;
  }
}

function applyOptimizedPrompt() {
  optimizeVersions[optimizeLang] = app.querySelector('#optimizeText').value;
  const text = app.querySelector('#optimizeText').value.trim();
  if (!text) { toast('优化结果为空'); return; }
  promptEl.value = text;
  onPromptInput();
  app.querySelector('#optimizeModal').classList.remove('open');
  toast('已应用优化后的提示词');
  promptEl.focus();
}

function moveReference(node, referenceId, direction) {
  const refs = [...(node.generation?.references || [])];
  const index = refs.findIndex((ref) => ref.id === referenceId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= refs.length) { toast('已经到边界'); return; }
  const [item] = refs.splice(index, 1);
  refs.splice(target, 0, item);
  const reindexed = refs.map((ref, i) => ({ ...ref, index: i }));
  doc = updateNode(doc, node.id, { generation: { references: reindexed } });
  render();
  toast(direction < 0 ? '引用已上移' : '引用已下移');
}

function setReferenceRole(node, referenceId, role) {
  const refs = (node.generation?.references || []).map((ref) => ref.id === referenceId ? { ...ref, role } : ref);
  doc = updateNode(doc, node.id, { generation: { references: refs } });
  render();
  toast(`引用角色：${role}`);
}

function removeNodeReference(node, referenceId) {
  const edge = doc.edges.find((item) => item.from === referenceId && item.to === node.id);
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
  menu.innerHTML = items.map(([label, action, heading, disabled]) => {
    if (label === 'sep') return '<div class="cv-menu-sep"></div>';
    if (heading) return `<div class="cv-menu-label">${label}</div>`;
    return `<button data-action="${label}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  }).join('');
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.add('open');
  menu.querySelectorAll('button').forEach((button, index) => {
    const entry = items.filter((item) => item[1] && !item[2])[index];
    if (!entry || entry[3]) return;
    button.addEventListener('click', () => { hideContextMenu(); entry[1](); });
  });
}

function downloadNode(node) {
  const media = node?.resources?.[0];
  if (!media?.url) { toast('还没有生成结果'); return; }
  const link = document.createElement('a');
  link.href = media.url;
  link.download = media.id || 'canvas-result';
  link.click();
}

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
      ['重做', redo, false, !future.length],
      ['撤销', undo, false, !history.length],
      ['删除', () => { pushHistory(); doc = removeNode(doc, node.id); selection = new Set(); render(); }, false, false],
    ], event.clientX, event.clientY);
    return;
  }
  const rect = stage.getBoundingClientRect();
  const world = screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, doc.viewport);
  showContextMenu([
    ['撤销', undo, false, !history.length],
    ['重做', redo, false, !future.length],
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
  const labels = [inGroup ? '解组' : '编组', '堆叠', '布局', '下载'];
  tools.innerHTML = labels.map((label) => `<button data-tool="${label}">${label}</button>`).join('<span class="cv-tool-sep"></span>');
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
        const left = Math.min(...items.map((node) => node.layout.x));
        let top = Math.min(...items.map((node) => node.layout.y));
        pushHistory();
        for (const node of items) { doc = moveNode(doc, node.id, left, top); top += (node.layout.height || 320) + 24; }
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
    if (providers.comfyui?.ok) {
      status.textContent = `ComfyUI 已连接（${providers.comfyui.version || 'unknown'}）`;
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

let voiceCache = null;
let voicePickerNodeId = null;

async function openVoicePicker(nodeId) {
  voicePickerNodeId = nodeId;
  const modal = app.querySelector('#voiceModal');
  const list = app.querySelector('#voiceList');
  modal.classList.add('open');
  list.innerHTML = '<div class="cv-status">读取音色库…</div>';
  try {
    if (!voiceCache) {
      const response = await fetch('/api/generation/voices');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '读取失败');
      voiceCache = Array.isArray(data.voices) ? data.voices : [];
    }
    const node = findNode(doc, nodeId);
    const current = node?.generation?.voiceName || '';
    list.innerHTML = voiceCache.map((voice, index) => {
      const tags = [voice.tags?.gender, voice.tags?.age, voice.tags?.accent].filter(Boolean).join(' · ');
      const active = voice.voiceName === current ? ' active' : '';
      return `<button class="cv-voice-item${active}" data-index="${index}"><b>${escapeHtml(voice.voiceName || voice.voiceId)}</b><span>${escapeHtml(tags)}</span></button>`;
    }).join('') || '<div class="cv-status">没有可用音色（请确认即梦 CLI 已登录）</div>';
    list.querySelectorAll('[data-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const voice = voiceCache[Number(button.dataset.index)];
        const node = findNode(doc, voicePickerNodeId);
        if (!node) return;
        doc = updateNode(doc, node.id, { generation: { voiceName: voice.voiceName, voiceId: voice.voiceId } });
        app.querySelector('#voiceModal').classList.remove('open');
        render();
        toast(`已选择音色：${voice.voiceName}`);
      });
    });
  } catch (error) {
    list.innerHTML = `<div class="cv-status bad">${escapeHtml(error.message || '读取失败')}</div>`;
  }
}

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
    history = [];
    future = [];
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
  history = [];
  future = [];
  render();
  postBoards();
  window.setTimeout(resumePendingJobs, 400);
}

function switchBoard(id) {
  if (id === currentBoardId) return;
  saveBoardState();
  const next = readBoardDoc(id);
  if (!next) { toast('画布读取失败'); return; }
  currentBoardId = id;
  localStorage.setItem(boardCurrentKey(), id);
  doc = next;
  selection = new Set();
  history = [];
  future = [];
  updateBoardButton();
  render();
  persist(false);
  postBoards();
  toast('已切换画布');
}

function makeBoard(name = '新画布') {
  saveBoardState();
  const id = `board_${Date.now().toString(36)}`;
  boardList.push({ id, name, updatedAt: Date.now() });
  currentBoardId = id;
  doc = createCanvasDocument({ viewport: { x: 520, y: 300, zoom: 0.8 } });
  selection = new Set();
  history = [];
  future = [];
  updateBoardButton();
  saveBoardState();
  render();
  persist(false);
  postBoards();
  toast('已新建画布');
}

function duplicateBoard() {
  saveBoardState();
  const id = `board_${Date.now().toString(36)}`;
  const source = boardList.find((item) => item.id === currentBoardId);
  boardList.push({ id, name: `${source?.name || '画布'} 副本`, updatedAt: Date.now() });
  currentBoardId = id;
  doc = structuredClone(doc);
  selection = new Set();
  history = [];
  future = [];
  updateBoardButton();
  saveBoardState();
  render();
  persist(false);
  postBoards();
  toast('已复制画布');
}

function renameBoard() {
  const board = boardList.find((item) => item.id === currentBoardId);
  if (!board) return;
  app.querySelector('#boardRenameInput').value = board.name;
  app.querySelector('#boardRenameModal').classList.add('open');
  app.querySelector('#boardRenameInput').focus();
  app.querySelector('#boardRenameInput').select();
}

function confirmBoardRename() {
  const board = boardList.find((item) => item.id === currentBoardId);
  const value = app.querySelector('#boardRenameInput').value.trim();
  if (!board || !value) return;
  board.name = value.slice(0, 40);
  app.querySelector('#boardRenameModal').classList.remove('open');
  updateBoardButton();
  saveBoardState();
  postBoards();
  toast('已重命名');
}

function deleteBoard() {
  if (boardList.length <= 1) { toast('至少保留一个画布'); return; }
  const removed = currentBoardId;
  boardList = boardList.filter((item) => item.id !== removed);
  localStorage.removeItem(boardDocKey(removed));
  currentBoardId = boardList[0].id;
  doc = readBoardDoc(currentBoardId) || createCanvasDocument();
  selection = new Set();
  history = [];
  future = [];
  updateBoardButton();
  saveBoardState();
  render();
  persist(false);
  postBoards();
  toast('已删除画布');
}

function openBoardMenu(event) {
  saveBoardState();
  const items = boardList.map((board) => [`${board.id === currentBoardId ? '✓ ' : ''}${board.name}`, () => switchBoard(board.id)]);
  items.push(['sep']);
  items.push(['新建画布', () => makeBoard(`画布 ${boardList.length + 1}`)]);
  items.push(['复制当前画布', duplicateBoard]);
  items.push(['重命名当前画布', renameBoard]);
  items.push(['删除当前画布', deleteBoard]);
  const rect = event.currentTarget.getBoundingClientRect();
  showContextMenu(items, rect.left, rect.bottom + 6);
}

function saveNodeToOtherBoard(node) {
  const targets = boardList.filter((item) => item.id !== currentBoardId);
  const items = targets.map((board) => [board.name, () => {
    writeNodeToBoard(node, board.id);
  }]);
  items.push(['新建画布并保存', () => {
    saveBoardState();
    const id = `board_${Date.now().toString(36)}`;
    boardList.push({ id, name: `画布 ${boardList.length + 1}`, updatedAt: Date.now() });
    saveBoardState();
    writeNodeToBoard(node, id);
  }]);
  showContextMenu(items, 440, 340);
}

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

function typeLabel(type) {
  return { text: '文本', image: '图片', video: '视频', audio: '音频', stage: '导演台', timeline: '时间线' }[type] || type;
}

function statusLabel(status) {
  return { empty: '未生成', running: '生成中', success: '已生成', failed: '失败', canceled: '已取消' }[status] || '';
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
