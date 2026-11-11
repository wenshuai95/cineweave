// 造梦工坊 · 流水线界面（阶段 0+1 原型）
// 故事 / 分镜两屏可用；资产 / 预演 / 生成 / 剪辑为下一阶段占位。
// 与旧界面并存：通过 /pipeline.html 打开，读写同一个项目库。
import './design-system.css';
import './canvas2-overlay.css';
import {projectLibrary} from '../project-library.mjs';
import {demoProject, validateProject} from '../model.mjs';
import {shotRows, projectSummary, durationLabel, scriptScenes} from './shot-model.mjs';
import {addTransformKey, addParameterKey, sampleObject} from '../model.mjs';
import {draftPathEdit} from '../path-edit.mjs';
import {addShot, updateShot, removeShot, moveShot, setShotDescription, applyStoryboard, appendScript, sortedShots} from './story-edit.mjs';
import {generateText, scriptProposal, storyboardProposal, assetProposal, proposalSummary} from './assistant.mjs';
import {projectAssets, applyAssetProposal, extractAssetsPrompt, assetImagePrompt, assetKindLabel} from './assets.mjs';
import {EMPTY_BIBLE, normalizeBible, readBible, writeBible, bibleIsEmpty, biblePrompt, bibleStyleSuffix, bibleSummary} from './bible.mjs';
import {textStatus as fetchTextStatus, textPost, connectionLabel} from '../workstation/text-settings.mjs';
import {videoModels, pickVideoModel, quoteVideo, generateVideo, waitForVideo, fetchVideoBlob, shotVideoPrompt} from './video-jobs.mjs';
import {collectCutSegments, startCut, waitForCut, fetchCutBlob, toBase64} from './cut-jobs.mjs';
import {buildGraph, canConnect, addEdge, removeEdge, edgeKey, inputsFor, sanitizeSavedGraph, NODE_SIZE} from './generation-graph.mjs';
import {imageModels, quoteImage, generateImage, waitForImage, fetchImageBlob, imageSize} from './image-jobs.mjs';
import {createMediaStore} from '../workstation/media-store.mjs';
import {addAssetImageVersions, normalizeAssetImages} from '../workstation/asset-images.mjs';
import {Stage} from '../stage.js';
import {clipsForObject, cameraPresets, addCamera, cameraObjects, assignCameras, shotCameraRows, modelObjects} from './previz-model.mjs';
import {trackObjects, keyTimes, shotBars, moveKey, deleteKey, addAction, moveAction, resizeAction, deleteAction, clipOptions, parameterTracks, moveChannelKey, deleteChannelKey} from './timeline-model.mjs';

const library = projectLibrary();
const state = {
  project: null,
  metas: [],
  stage: 'story',
  selectedShot: null,
  saveTimer: 0,
  saving: false,
  assistantOpen: false,
  proposal: null,
  manifest: null,
  lastSnapshot: '',
  askSkill: 'script',
  generateView: 'canvas',
  pendingFrom: null,
  videoModels: null,
  genConfig: {},
  previzExpanded: new Set(),
  pathSelection: null,
  showArchived: false,
};

let mediaInstance = null;
const media = () => (mediaInstance ??= createMediaStore());

const STAGES = [
  ['story', '故事'],
  ['shots', '分镜'],
  ['assets', '资产'],
  ['previz', '预演'],
  ['generate', '生成'],
  ['cut', '剪辑'],
];

const ICONS = {
  story: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M9 8h7M9 12h7"/>',
  shots: '<rect x="3" y="5" width="7" height="6" rx="1"/><rect x="14" y="5" width="7" height="6" rx="1"/><rect x="3" y="14" width="7" height="6" rx="1"/><rect x="14" y="14" width="7" height="6" rx="1"/>',
  assets: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  previz: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M10 9l4 2-4 2V9zM8 21h8"/>',
  generate: '<path d="M12 3l1.8 4.6L18 9.5l-4.2 1.9L12 16l-1.8-4.6L6 9.5l4.2-1.9L12 3z"/><path d="M18 16l.9 2.3L21 19l-2.1.8L18 22l-.9-2.2L15 19l2.1-.7L18 16z"/>',
  cut: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 8l12 10M8 16L20 6"/>',
};

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

function toast(message, action) {
  let node = $('.toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'toast';
    document.body.append(node);
  }
  node.innerHTML = '';
  const text = document.createElement('span');
  text.textContent = message;
  node.append(text);
  if (action) {
    const button = document.createElement('button');
    button.className = 'toast-action';
    button.textContent = action.label;
    button.onclick = () => { action.run(); node.classList.remove('on'); };
    node.append(button);
  }
  node.classList.add('on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('on'), action ? 7000 : 2200);
}

/* ---------------- 启动与项目选择 ---------------- */

async function boot() {
  await library.initialize();
  state.metas = (await library.list()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const hash = /^#p\/([\w-]+)/.exec(location.hash);
  if (hash) {
    const project = await library.read(hash[1]);
    if (project) return openProject(project);
  }
  if (location.hash === '#new') return createDemo();
  renderPicker();
}

function renderPicker() {
  document.body.className = 'picker-mode';
  const active = state.metas.filter(meta => state.showArchived ? meta.archived : !meta.archived)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const archivedCount = state.metas.filter(meta => meta.archived).length;
  document.body.innerHTML = `
    <div class="main" style="width:100%">
      <div class="stage">
        <div class="picker">
          <header class="picker-head">
            <div><h1>造梦工坊</h1><p class="sub">从故事开始，一条流水线走到成片。</p></div>
            <div class="picker-actions">
              <button class="btn" id="pickerSettings">设置</button>
              <button class="btn" id="pickerImport">导入工程</button>
              <button class="btn" id="pickerArchive">${state.showArchived ? '返回项目' : `回收站${archivedCount ? ' · ' + archivedCount : ''}`}</button>
            </div>
          </header>
          <div class="projects">
            ${active.map(meta => `
              <div class="project-card ${meta.archived ? 'archived' : ''}" data-open="${esc(meta.id)}" role="button" tabindex="0">
                <b>${esc(meta.name || '未命名影片')}</b>
                <span>${meta.shots || 0} 镜 · ${durationLabel(meta.duration || 0)} · ${meta.archived ? '回收站' : '修改于 ' + (meta.updatedAt ? new Date(meta.updatedAt).toLocaleDateString('zh-CN') : '未知')}</span>
                <div class="project-actions">
                  ${meta.archived ? `<button data-restore="${esc(meta.id)}" title="恢复项目">恢复</button>` : `
                    <button data-rename="${esc(meta.id)}" title="重命名">改名</button>
                    <button data-export="${esc(meta.id)}" title="导出工程备份">导出</button>
                    <button data-archive="${esc(meta.id)}" title="移到回收站">归档</button>`}
                </div>
              </div>`).join('')}
            ${state.showArchived ? '' : `<button class="project-card" data-new><b>＋ 新建示例影片</b><span>包含机位与三镜，便于体验流水线</span></button>`}
          </div>
          ${active.length ? '' : `<div class="empty-card" style="margin-top:16px">${state.showArchived ? '回收站是空的。' : '项目库还是空的，先新建一个示例影片。'}</div>`}
          <input type="file" id="pickerFile" accept=".json,application/json" hidden>
          <p class="note" style="margin-top:22px;color:#8e8e93;font-size:12.5px">工程保存在本机；导出 JSON 可作为独立备份，导入不会覆盖已有工程。</p>
        </div>
      </div>
    </div>`;
  const refresh = async () => { state.metas = await library.list(); renderPicker(); };
  document.querySelectorAll('[data-open]').forEach(card => {
    card.onclick = async event => {
      if (event.target.closest('[data-rename],[data-export],[data-archive],[data-restore]')) return;
      const project = await library.read(card.dataset.open);
      if (project) openProject(project);
    };
    card.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') card.click(); };
  });
  $('[data-new]')?.addEventListener('click', createDemo);
  $('#pickerSettings').onclick = () => openSettings();
  $('#pickerImport').onclick = () => $('#pickerFile').click();
  $('#pickerArchive').onclick = () => { state.showArchived = !state.showArchived; renderPicker(); };
  $('#pickerFile').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const added = await library.add(validateProject(data));
      toast('已导入工程：' + (added.name || '未命名'));
      await refresh();
    } catch (error) { toast('导入失败：' + error.message); }
  };
  document.querySelectorAll('[data-rename]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      const meta = state.metas.find(item => item.id === button.dataset.rename);
      if (meta) openRenameDialog(meta, refresh);
    };
  });
  document.querySelectorAll('[data-export]').forEach(button => {
    button.onclick = async event => {
      event.stopPropagation();
      try {
        const project = await library.read(button.dataset.export);
        if (!project) throw Error('项目不存在');
        const blob = new Blob([JSON.stringify(project, null, 2)], {type: 'application/json'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = (project.name || '工程') + '.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
        toast('已导出工程备份');
      } catch (error) { toast('导出失败：' + error.message); }
    };
  });
  document.querySelectorAll('[data-archive]').forEach(button => {
    button.onclick = async event => {
      event.stopPropagation();
      try { await library.archive(button.dataset.archive, true); toast('已移入回收站'); await refresh(); }
      catch (error) { toast('归档失败：' + error.message); }
    };
  });
  document.querySelectorAll('[data-restore]').forEach(button => {
    button.onclick = async event => {
      event.stopPropagation();
      try { await library.archive(button.dataset.restore, false); toast('已恢复项目'); await refresh(); }
      catch (error) { toast('恢复失败：' + error.message); }
    };
  });
}

function openRenameDialog(meta, after) {
  const sheet = document.createElement('div');
  sheet.className = 'name-sheet';
  sheet.innerHTML = `<div class="panel">
    <h2>重命名工程</h2>
    <label class="field">工程名称<input id="renameInput" value="${esc(meta.name || '')}" maxlength="200"></label>
    <div class="actions"><button class="btn" data-cancel-rename>取消</button><button class="btn primary" id="confirmRename">保存</button></div>
  </div>`;
  document.body.append(sheet);
  const close = () => sheet.remove();
  sheet.onclick = event => { if (event.target === sheet || event.target.dataset.cancelRename !== undefined) close(); };
  const input = sheet.querySelector('#renameInput');
  input.focus();
  input.select();
  const save = async () => {
    const name = input.value.trim();
    if (!name) { toast('请输入工程名称'); return; }
    try { await library.rename(meta.id, name); close(); toast('已改名'); await after(); }
    catch (error) { toast('改名失败：' + error.message); }
  };
  sheet.querySelector('#confirmRename').onclick = save;
  input.onkeydown = event => { if (event.key === 'Enter') save(); };
}

async function openSettings(initialTab = 'text') {
  let status = null;
  try { status = await fetchTextStatus(); } catch (error) { status = null; }
  const sheet = document.createElement('div');
  sheet.className = 'settings-sheet';
  sheet.innerHTML = `<div class="panel">
    <header class="settings-head"><h2>设置</h2><span class="grow"></span><button class="btn ghost" data-close-settings aria-label="关闭设置">✕</button></header>
    <nav class="settings-tabs" aria-label="设置分类">
      <button data-settings-tab="text" class="active">文字模型</button>
      <button data-settings-tab="media">媒体生成</button>
      <button data-settings-tab="storage">存储</button>
      <button data-settings-tab="advanced">高级</button>
    </nav>
    <div class="settings-body" id="settingsBody"></div>
  </div>`;
  document.body.append(sheet);
  const close = () => sheet.remove();
  sheet.onclick = event => { if (event.target === sheet || event.target.dataset.closeSettings !== undefined) close(); };
  const body = sheet.querySelector('#settingsBody');
  const showTab = tab => {
    sheet.querySelectorAll('[data-settings-tab]').forEach(button => button.classList.toggle('active', button.dataset.settingsTab === tab));
    if (tab === 'text') renderTextTab(body, status, async fresh => { status = fresh; });
    if (tab === 'media') renderMediaTab(body);
    if (tab === 'storage') renderStorageTab(body);
    if (tab === 'advanced') renderAdvancedTab(body, close);
  };
  sheet.querySelectorAll('[data-settings-tab]').forEach(button => { button.onclick = () => showTab(button.dataset.settingsTab); });
  showTab(initialTab);
}

function renderTextTab(body, status, onStatus) {
  const config = status?.config || {};
  body.innerHTML = `<section class="settings-section">
    <h3>文字模型</h3>
    <p class="sub">DeepSeek / 兼容接口 · 密钥只保存在本机，不进入工程文件或备份。</p>
    <label class="field">接口地址<input id="setBase" value="${esc(config.base || '')}" placeholder="https://api.deepseek.com" autocomplete="off"></label>
    <label class="field">模型名称<input id="setModel" value="${esc(config.model || '')}" placeholder="deepseek-chat" autocomplete="off"></label>
    <label class="field">API Key<input id="setKey" type="password" placeholder="${config.configured ? '已配置，留空保留当前密钥' : '在此填写密钥'}" autocomplete="off"></label>
    <label class="settings-check"><input type="checkbox" id="setRemember" ${config.remembered ? 'checked' : ''}> 记住在本机（不勾选仅本次运行有效）</label>
    <p class="settings-status" id="setStatus">${esc(connectionLabel(config))}</p>
    <div class="settings-actions">
      <button class="btn" id="setSave">保存</button>
      <button class="btn" id="setTest">保存并测试连接</button>
      <button class="btn" id="setClear">清除密钥</button>
    </div>
  </section>`;
  const statusEl = body.querySelector('#setStatus');
  let busy = false;
  const run = async (test, clear) => {
    if (busy) return;
    busy = true;
    const buttons = [...body.querySelectorAll('button')];
    buttons.forEach(button => { button.disabled = true; });
    statusEl.textContent = test ? '正在保存并测试…' : clear ? '正在清除密钥…' : '正在保存…';
    try {
      const result = await textPost('config', {
        base: body.querySelector('#setBase').value.trim(),
        model: body.querySelector('#setModel').value.trim(),
        remember: body.querySelector('#setRemember').checked,
        ...(clear ? {clear: true} : {key: body.querySelector('#setKey').value.trim()}),
      });
      body.querySelector('#setKey').value = '';
      statusEl.textContent = clear ? '密钥已清除' : '设置已保存';
      if (test) {
        statusEl.textContent = '正在测试连接…（最多约 30 秒）';
        const verification = await textPost('generate', {kind: 'test', prompt: '', script: ''});
        statusEl.textContent = verification.verification === 'models' ? '接口连接成功，密钥和模型名称已验证' : '连接成功，可以开始创作';
      }
      onStatus(await fetchTextStatus());
    } catch (error) {
      statusEl.textContent = error.message;
    } finally {
      busy = false;
      buttons.forEach(button => { button.disabled = false; });
    }
  };
  body.querySelector('#setSave').onclick = () => run(false, false);
  body.querySelector('#setTest').onclick = () => run(true, false);
  body.querySelector('#setClear').onclick = () => run(false, true);
}

async function renderMediaTab(body) {
  body.innerHTML = '<section class="settings-section"><h3>媒体生成</h3><p class="sub">正在读取服务状态…</p></section>';
  try {
    const response = await fetch('/api/ai/status', {signal: AbortSignal.timeout(8000)});
    const data = await response.json();
    if (!response.ok) throw Error(data.error || '媒体服务不可用');
    body.innerHTML = `<section class="settings-section">
      <h3>媒体生成</h3>
      <div class="settings-kv"><span>OiiOii 授权</span><b>${data.oiioii ? '已授权' : '未授权'}</b></div>
      <div class="settings-kv"><span>任务令牌</span><b>${data.token ? '已就绪' : '未就绪'}</b></div>
      <p class="sub">图片与视频生成沿用旧界面的 OiiOii 授权；先报价、确认后才提交，不会静默扣积分。</p>
      <p class="sub">未授权时，在终端运行：<code>oiioii auth login</code></p>
      <div class="settings-actions"><button class="btn" id="setMediaRefresh">刷新状态</button></div>
    </section>`;
    body.querySelector('#setMediaRefresh').onclick = () => renderMediaTab(body);
  } catch (error) {
    body.innerHTML = `<section class="settings-section"><h3>媒体生成</h3><p class="settings-status">${esc(error.message)}</p><div class="settings-actions"><button class="btn" id="setMediaRetry">重试</button></div></section>`;
    body.querySelector('#setMediaRetry').onclick = () => renderMediaTab(body);
  }
}

async function renderStorageTab(body) {
  body.innerHTML = '<section class="settings-section"><h3>存储</h3><p class="sub">正在读取数据目录…</p></section>';
  try {
    const response = await fetch('/api/ai/storage', {signal: AbortSignal.timeout(8000)});
    const data = await response.json();
    if (!response.ok) throw Error(data.error || '存储信息不可用');
    const rows = [['数据根目录', data.dataDirectory], ['生成图片', data.imagesDirectory], ['生成模型与任务', data.modelsDirectory], ['离线资产', data.assetsDirectory]].filter(([, value]) => typeof value === 'string');
    body.innerHTML = `<section class="settings-section">
      <h3>存储</h3>
      ${rows.map(([name, value]) => `<label class="field">${esc(name)}<input readonly value="${esc(value)}"></label>`).join('')}
      <p class="sub">数据目录由启动环境变量 <code>JINGCHANG_DATA_DIR</code> 指定；网页内暂不支持在线迁移目录。切换目录前请先完整备份。</p>
      <div class="settings-actions"><button class="btn" id="setStorageRefresh">刷新</button></div>
    </section>`;
    body.querySelector('#setStorageRefresh').onclick = () => renderStorageTab(body);
  } catch (error) {
    body.innerHTML = `<section class="settings-section"><h3>存储</h3><p class="settings-status">${esc(error.message)}</p><div class="settings-actions"><button class="btn" id="setStorageRetry">重试</button></div></section>`;
    body.querySelector('#setStorageRetry').onclick = () => renderStorageTab(body);
  }
}

function renderAdvancedTab(body, close) {
  body.innerHTML = `<section class="settings-section">
    <h3>高级</h3>
    <p class="sub">新版界面已覆盖故事、分镜、资产、预演、生成、剪辑、项目库和设置。以下能力仍在旧界面，作为临时入口：</p>
    <ul class="settings-list">
      <li>媒体导入与素材库管理（从访达拖入视频/音频/图片）</li>
      <li>任务中心与 AI 参考任务包、成片导出</li>
      <li>离线资产包与 Blender 预演导出</li>
    </ul>
    <div class="settings-actions"><button class="btn" id="openLegacy">打开旧界面（临时）</button></div>
    <p class="sub">这些能力迁完后，旧入口会彻底移除。</p>
  </section>`;
  body.querySelector('#openLegacy').onclick = () => { close(); location.href = '/'; };
}

async function createDemo() {
  const project = demoProject();
  project.name = '新影片';
  project.workstation = project.workstation || {};
  project.workstation.script = project.workstation.script || '场景 1 · 雨后会面\n\n林舟穿过庭院，在旧友面前停下。\n';
  const added = await library.add(project);
  state.metas = await library.list();
  openProject(added);
}

async function openProject(project) {
  state.project = project;
  state.selectedShot = null;
  history.replaceState(null, '', `#p/${project.id}`);
  renderShell();
}

/* ---------------- 保存 ---------------- */

function markDirty() {
  const status = $('.status');
  if (status) { status.classList.add('dirty'); status.innerHTML = '<i></i>保存中…'; }
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveNow, 450);
}

async function saveNow() {
  if (!state.project) return true;
  if (state.saving) { state.saveQueued = true; return true; }
  state.saving = true;
  let ok = true;
  try {
    await library.save(state.project);
    const status = $('.status');
    if (status) { status.classList.remove('dirty'); status.innerHTML = '<i></i>已保存'; }
  } catch (error) {
    ok = false;
    toast('保存失败：' + error.message);
    const status = $('.status');
    if (status) status.innerHTML = '<i></i>保存失败';
  } finally {
    state.saving = false;
    if (state.saveQueued) {
      state.saveQueued = false;
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(saveNow, 0);
    }
  }
  return ok;
}

/* ---------------- 外壳 ---------------- */

function renderShell() {
  document.body.className = '';
  document.body.innerHTML = `
    <nav class="rail" aria-label="创作阶段">
      <div class="logo">梦</div>
      ${STAGES.map(([id, name]) => `
        <button data-stage="${id}" class="${state.stage === id ? 'active' : ''}" title="${name} ⌘${STAGES.findIndex(s => s[0] === id) + 1}">
          <svg viewBox="0 0 24 24">${ICONS[id]}</svg>${name}
        </button>`).join('')}
      <button data-canvas title="片段画布（即梦风：节点 / 连线 / 生成）">
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="8" height="6" rx="1.5"></rect><rect x="13" y="14" width="8" height="6" rx="1.5"></rect><path d="M11 7h4a2 2 0 0 1 2 2v5"></path></svg>画布
      </button>
      <div class="spacer"></div>
      <button data-switch title="切换项目">项目</button>
    </nav>
    <div class="main">
      <header class="topbar">
        <span class="project" id="projectName"></span>
        <span class="crumb">/ <b id="stageName"></b></span>
        <span class="grow"></span>
        <span class="status"><i></i>已保存</span>
        <button class="btn ghost" id="openSettings" title="设置：文字模型、媒体服务、存储">设置</button>
        <button class="btn ghost" id="askBtn">⌘K 助手</button>
        <button class="btn primary" id="nextBtn">下一步 →</button>
      </header>
      <section class="stage" id="stageBody"></section>
      <div class="askbar">
        <span>✦</span>
        <input id="askInput" placeholder="描述下一步，或按 ⌘K 问助手…" aria-label="助手输入">
        <kbd>⌘K</kbd>
      </div>
    </div>
    <aside class="ask-drawer" id="askSheet" aria-hidden="true" aria-label="创作助手">
      <div class="ask-drawer-grip" id="askGrip" title="拖动调整助手宽度"></div>
      <div class="ask-drawer-inner">
        <header class="ask-drawer-head"><h2>助手</h2><span class="grow"></span><button class="btn ghost" id="askMaximize" title="加宽助手">⇤</button><button class="btn ghost" data-close-sheet aria-label="关闭助手">✕</button></header>
        <p class="sub" id="askHint">当前阶段：故事</p>
        <label class="field" style="margin-top:12px">你的要求<textarea id="askPrompt" rows="3" placeholder="例如：把这一场改成雨夜，女修被击飞后先失神再捏诀。"></textarea></label>
        <div class="ask-modes" role="group" aria-label="助手技能">
          <button class="chip" data-skill-mode="script">续写剧本</button>
          <button class="chip" data-skill-mode="storyboard">生成分镜</button>
          <button class="chip" data-skill-mode="assets">提取资产</button>
        </div>
        <div class="row" style="display:flex;gap:8px;margin-top:10px">
          <button class="btn primary" id="askSend">发送</button>
          <button class="btn ghost" data-close-sheet>关闭</button>
        </div>
        <div id="askStatus" class="sub" style="margin-top:10px"></div>
        <div id="askProposal"></div>
      </div>
    </aside>
    <footer class="foot"><span>造梦工坊 · 流水线界面</span><span>1–6 切阶段</span><span>⌘K 助手</span></footer>`;

  $('#projectName').textContent = state.project.name || '未命名影片';
  document.querySelectorAll('[data-stage]').forEach(button => {
    button.onclick = () => switchStage(button.dataset.stage);
  });
  $('[data-switch]').onclick = () => { location.hash = ''; renderPicker(); };
  $('[data-canvas]').onclick = openCanvas2;
  $('#askBtn').onclick = openAssistant;
  $('#openSettings').onclick = () => openSettings();
  $('#askInput').addEventListener('focus', openAssistant);
  $('#askInput').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      const drafted = $('#askInput').value.trim();
      openAssistant();
      setAskSkill(state.stage === 'shots' ? 'storyboard' : state.stage === 'assets' ? 'assets' : 'script');
      if (drafted) { $('#askPrompt').value = drafted; $('#askInput').value = ''; setTimeout(() => $('#askPrompt').focus(), 40); }
    }
  });
  document.querySelectorAll('[data-close-sheet]').forEach(button => { button.onclick = () => closeAssistant(); });
  $('#askGrip').addEventListener('pointerdown', event => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = askWidth();
    const move = e => setAskWidth(startWidth + (startX - e.clientX));
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
  document.querySelectorAll('[data-skill-mode]').forEach(button => { button.onclick = () => setAskSkill(button.dataset.skillMode); });
  $('#askSend').onclick = () => runAssistant(state.askSkill);
  $('#askMaximize').onclick = () => { setAskWidth(askWidth() >= 560 ? 380 : 620); };
  $('#askPrompt').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); runAssistant(state.askSkill); }
  });
  $('#nextBtn').onclick = nextStage;
  renderStage();
}

/* ---------------- 片段画布（即梦风，iframe 集成） ---------------- */
let canvasOverlay = null;
let canvasFrame = null;
let canvasSaveTimer = 0;

function ensureCanvasOverlay() {
  if (canvasOverlay && document.body.contains(canvasOverlay)) return;
  canvasOverlay = document.createElement('section');
  canvasOverlay.id = 'canvas2Overlay';
  canvasOverlay.hidden = true;
  canvasOverlay.innerHTML = '<iframe id="canvas2Frame" src="/canvas2.html?embed=1" title="片段画布"></iframe><button id="canvas2Close" title="关闭画布" aria-label="关闭画布">✕</button>';
  document.body.appendChild(canvasOverlay);
  canvasFrame = canvasOverlay.querySelector('#canvas2Frame');
  canvasOverlay.querySelector('#canvas2Close').onclick = closeCanvas2;
}

function postCanvasDoc() {
  const win = canvasFrame?.contentWindow;
  if (!win || !state.project) return;
  win.postMessage({ type: 'canvas-load-doc', doc: state.project.workstation?.canvas || null }, location.origin);
}

function openCanvas2() {
  if (!state.project) return;
  ensureCanvasOverlay();
  canvasOverlay.hidden = false;
  document.body.classList.add('canvas2-open');
  postCanvasDoc();
}

function closeCanvas2() {
  if (!canvasOverlay) return;
  canvasOverlay.hidden = true;
  document.body.classList.remove('canvas2-open');
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return;
  const data = event.data || {};
  if (data.type === 'canvas-ready') postCanvasDoc();
  if (data.type === 'canvas-doc-change' && data.doc && state.project) {
    state.project.workstation = state.project.workstation || {};
    state.project.workstation.canvas = data.doc;
    clearTimeout(canvasSaveTimer);
    canvasSaveTimer = setTimeout(() => { library.save(state.project).catch(() => {}); }, 500);
  }
});

async function switchStage(stage) {
  if (!STAGES.some(([id]) => id === stage)) return;
  const leavingEmbed = ['previz', 'generate', 'cut'].includes(state.stage);
  stopPrevizLoop();
  if (leavingEmbed) await refreshProjectFromLibrary();
  state.enteringFromEmbed = leavingEmbed;
  state.stage = stage;
  state.selectedShot = null;
  document.querySelectorAll('[data-stage]').forEach(button => button.classList.toggle('active', button.dataset.stage === stage));
  $('#stageName').textContent = STAGES.find(([id]) => id === stage)[1];
  renderStage();
}

function nextStage() {
  const index = STAGES.findIndex(([id]) => id === state.stage);
  switchStage(STAGES[Math.min(STAGES.length - 1, index + 1)][0]);
}

function renderStage() {
  document.body.classList.toggle('embed-view', ['previz', 'generate', 'cut'].includes(state.stage));
  document.body.classList.toggle('view-story', state.stage === 'story');
  const body = $('#stageBody');
  const name = STAGES.find(([id]) => id === state.stage)[1];
  $('#stageName').textContent = name;
  $('#nextBtn').textContent = state.stage === 'cut' ? '导出 →' : '下一步 →';
  body.innerHTML = '';
  if (state.stage === 'story') renderStory(body);
  else if (state.stage === 'shots') renderShots(body);
  else if (state.stage === 'assets') renderAssets(body);
  else if (state.stage === 'generate') renderGenerate(body);
  else if (state.stage === 'previz') renderPreviz(body);
  else if (state.stage === 'cut') renderCut(body);
  else renderPlaceholder(body, state.stage);
}

function setAskSkill(skill) {
  if (!['script', 'storyboard', 'assets'].includes(skill)) return;
  state.askSkill = skill;
  document.querySelectorAll('[data-skill-mode]').forEach(button => button.classList.toggle('active', button.dataset.skillMode === skill));
}

const ASK_WIDTH_KEY = 'cw:ask-width';
function askWidth() {
  const stored = Number(localStorage.getItem(ASK_WIDTH_KEY));
  return Number.isFinite(stored) && stored >= 280 ? Math.min(620, stored) : 380;
}
function setAskWidth(width) {
  const value = Math.max(300, Math.min(620, Math.round(width)));
  document.documentElement.style.setProperty('--ask-width', value + 'px');
  try { localStorage.setItem(ASK_WIDTH_KEY, String(value)); } catch {}
}
function openAssistant() {
  const name = STAGES.find(([id]) => id === state.stage)[1];
  const hint = $('#askHint');
  const agentName = state.stage === 'story' ? '编剧 Agent' : state.stage === 'shots' ? '分镜 Agent' : state.stage === 'assets' ? '资产 Agent' : '创作助手';
  if (hint) hint.textContent = `${agentName} · 当前阶段：${name} · 写要求后点发送`;
  setAskSkill(state.stage === 'shots' ? 'storyboard' : state.stage === 'assets' ? 'assets' : (state.askSkill || 'script'));
  setAskWidth(askWidth());
  document.body.classList.add('ask-open');
  $('#askSheet').setAttribute('aria-hidden', 'false');
  setTimeout(() => $('#askPrompt')?.focus(), 30);
}
function closeAssistant() {
  document.body.classList.remove('ask-open');
  $('#askSheet').setAttribute('aria-hidden', 'true');
}

async function runAssistant(skill) {
  const prompt = ($('#askPrompt')?.value || '').trim();
  const status = $('#askStatus');
  if (!prompt) return toast('先写下你的要求');
  if (!['script', 'storyboard', 'assets'].includes(skill)) return toast('这个阶段暂不支持该助手技能');
  status.textContent = '正在请求模型…';
  $('#askProposal').innerHTML = '';
  state.proposal = null;
  try {
    const script = state.project.workstation?.script || '';
    if (skill === 'storyboard' && !script.trim()) throw Error('剧本还是空的，先写点内容再生成分镜');
    const bible = readBible(state.project);
    const bibleText = bibleIsEmpty(bible) ? '' : biblePrompt(bible);
    const fullPrompt = [bibleText, prompt].filter(Boolean).join('\n\n');
    const result = await generateText({
      kind: skill === 'storyboard' ? 'storyboard' : skill === 'assets' ? 'assets' : 'generate',
      prompt: fullPrompt, script,
      ...(skill === 'assets' ? {shots: (state.project.shots || []).map((shot, index) => ({id: shot.id, scene: `镜 ${index + 1}`, characters: [], description: shot.description || ''}))} : {}),
    });
    state.proposal = skill === 'storyboard' ? storyboardProposal(result) : skill === 'assets' ? assetProposal(result) : scriptProposal(result);
    status.textContent = '提案已生成：' + proposalSummary(state.proposal);
    renderProposal();
  } catch (error) {
    status.textContent = '没有生成提案：' + error.message;
  }
}

function openTextOverlay(title, text) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.innerHTML = `<div class="text-overlay">
    <header><b>${esc(title)}</b><span class="grow"></span><button class="btn" data-close-overlay>关闭</button></header>
    <pre class="text-overlay-body">${esc(text)}</pre>
  </div>`;
  document.body.append(overlay);
  const close = () => overlay.remove();
  overlay.onclick = event => { if (event.target === overlay || event.target.dataset.closeOverlay !== undefined) close(); };
  const body = overlay.querySelector('.text-overlay-body');
  requestAnimationFrame(() => {
    const columns = text.length > 1100 ? 3 : text.length > 420 ? 2 : 1;
    body.style.columnCount = String(columns);
    let size = 13.5;
    body.style.fontSize = size + 'px';
    while (body.scrollHeight > body.clientHeight + 2 && size > 10.5) {
      size -= 0.5;
      body.style.fontSize = size + 'px';
    }
    if (body.scrollHeight > body.clientHeight + 2) body.style.overflow = 'auto';
  });
}

function renderProposal() {
  const box = $('#askProposal');
  const proposal = state.proposal;
  if (!proposal) { box.innerHTML = ''; return; }
  if (proposal.type === 'script') {
    const preview = proposal.text.trim().slice(0, 1600);
    box.innerHTML = `<pre class="proposal-text" id="proposalText">${esc(preview)}${proposal.text.length > 1600 ? '\n…' : ''}</pre>
      <div class="row" style="display:flex;gap:8px;margin-top:10px">
        <button class="btn primary" id="applyAppend">追加到剧本</button>
        <button class="btn" id="applyReplace">替换剧本</button>
        <button class="btn ghost" id="expandProposal">展开全文</button>
      </div>`;
    $('#expandProposal').onclick = () => openTextOverlay('助手提案 · 全文', proposal.text);
    $('#applyAppend').onclick = () => applyProposal({replace: false});
    $('#applyReplace').onclick = () => applyProposal({replace: true});
  } else if (proposal.type === 'assets') {
    const label = {character: '角色', scene: '场景', prop: '道具'};
    const rows = proposal.assets.slice(0, 16).map(asset => `<div class="kv"><span>${label[asset.kind] || asset.kind} · ${esc(asset.name)}</span><span>${esc(String(asset.prompt || '').slice(0, 40))}</span></div>`).join('');
    box.innerHTML = `<div class="proposal-summary">${proposalSummary(proposal)}</div>${rows}
      <p class="sub" style="font-size:12px;margin-top:8px">应用后会合并进资产（同名更新，不删除手工资产）。</p>
      <div class="row" style="display:flex;gap:8px;margin-top:10px"><button class="btn primary" id="applyAssets">合并资产</button></div>`;
    $('#applyAssets').onclick = () => applyProposal({});
  } else {
    const rows = proposal.shots.slice(0, 12).map((shot, index) =>
      `<div class="kv"><span>${String(index + 1).padStart(2, '0')} · ${Number(shot.duration).toFixed(1)}s</span><span>${esc(String(shot.description || '').slice(0, 46))}</span></div>`).join('');
    box.innerHTML = `<div class="proposal-summary">${proposalSummary(proposal)}${proposal.shots.length > 12 ? '（仅显示前 12 个）' : ''}</div>${rows}
      <p class="sub" style="font-size:12px;margin-top:8px">应用后会替换当前全部分镜；当前机位保留。</p>
      <div class="row" style="display:flex;gap:8px;margin-top:10px"><button class="btn primary" id="applyStoryboard">应用分镜</button></div>`;
    $('#applyStoryboard').onclick = () => applyProposal({});
  }
}

function applyProposal({replace = false} = {}) {
  const proposal = state.proposal;
  if (!proposal) return;
  state.lastSnapshot = JSON.stringify(state.project);
  try {
    if (proposal.type === 'script') appendScript(state.project, proposal.text, {replace});
    else if (proposal.type === 'assets') applyAssetProposal(state.project, proposal.assets);
    else applyStoryboard(state.project, proposal.shots);
    state.proposal = null;
    markDirty();
    closeAssistant();
    renderStage();
    toast('已应用助手提案', {label: '撤销', run: () => {
      if (!state.lastSnapshot) return;
      state.project = JSON.parse(state.lastSnapshot);
      markDirty();
      renderStage();
      toast('已撤销');
    }});
  } catch (error) {
    toast('应用失败：' + error.message);
  }
}

/* ---------------- 故事 ---------------- */

function renderStory(body) {
  const summary = projectSummary(state.project);
  const script = state.project.workstation?.script || '';
  const scenes = scriptScenes(script);
  body.innerHTML = `
    <div class="toolbar"><div><h1>故事</h1><div class="sub">${summary.scriptLength ? `${scenes.length} 个场景 · ${summary.scriptLength} 字` : '还没有剧本内容'}</div></div>
      <span class="grow"></span><button class="btn" id="editBible">项目圣经</button><button class="btn" id="editMeta">影片信息</button></div>
    <div class="story">
      <article class="panel doc">
        <div class="doc-head"><b>剧本</b><span class="hint">自动保存 · ⌘K 让助手续写</span></div>
        <textarea id="storyEditor" placeholder="场景 1 · 深山树林\n\n女修被巨力击飞，落入林间空地……" spellcheck="false">${esc(script)}</textarea>
      </article>
      <aside class="panel inspector">
        <h3>影片信息</h3>
        <div class="kv"><span>时长</span><span>${durationLabel(summary.duration)}</span></div>
        <div class="kv"><span>画幅 / 帧率</span><span>16:9 · ${summary.fps} fps</span></div>
        <div class="kv"><span>镜头</span><span>${summary.shots} 个</span></div>
        <div class="kv"><span>角色</span><span>${summary.characters} 个</span></div>
        <h3>项目圣经</h3>
        <div class="kv"><span>约束字段</span><span id="bibleState">${bibleSummary(readBible(state.project)).filled} / ${bibleSummary(readBible(state.project)).total}</span></div>
        <p class="sub" style="font-size:12px;margin:2px 0 8px">人物、场景、风格会带进助手与生成任务，保证跨镜头一致。</p>
        <h3>场景大纲</h3>
        ${scenes.length ? scenes.map(scene => `<div class="kv"><span>${esc(scene.title.slice(0, 18))}</span><span>${scene.chars} 字</span></div>`).join('') : '<p class="sub" style="font-size:12.5px">写下以「场景 N」开头的段落，这里会出现大纲。</p>'}
      </aside>
    </div>`;
  const editor = $('#storyEditor');
  editor.addEventListener('input', () => {
    state.project.workstation = state.project.workstation || {};
    state.project.workstation.script = editor.value;
    markDirty();
    const hint = $('.doc-head .hint');
    if (hint) hint.textContent = '正在编辑…';
  });
  editor.addEventListener('blur', () => { const hint = $('.doc-head .hint'); if (hint) hint.textContent = '自动保存 · ⌘K 让助手续写'; });
  $('#editMeta').onclick = showMeta;
  $('#editBible').onclick = () => openBibleEditor(body);
}

function openBibleEditor(after) {
  const bible = readBible(state.project);
  const sheet = document.createElement('div');
  sheet.className = 'bible-sheet on';
  sheet.innerHTML = `<div class="panel">
    <header class="bible-head"><h2>项目圣经</h2><span class="sub">全片共享，写一次各处引用</span></header>
    <div class="bible-grid">
      <label class="field">一句话故事<input id="bibleLogline" value="${esc(bible.logline)}" placeholder="例：女修被击落凡间，在雨夜庭院与旧友重逢"></label>
      <label class="field">人物设定<textarea id="bibleCharacters" rows="4" placeholder="林舟：青年修士，青灰长衫，左眉有旧疤，寡言…">${esc(bible.characters)}</textarea></label>
      <label class="field">场景设定<textarea id="bibleScenes" rows="4" placeholder="雨夜庭院：青石板、灰瓦粉墙、檐下灯笼…">${esc(bible.scenes)}</textarea></label>
      <label class="field">画面风格<textarea id="bibleStyle" rows="3" placeholder="东方仙侠，低饱和青灰色调，35mm 胶片质感…">${esc(bible.style)}</textarea></label>
      <label class="field">镜头语言<textarea id="bibleCamera" rows="3" placeholder="多用中近景与缓慢推镜，低机位…">${esc(bible.camera)}</textarea></label>
      <label class="field">负面提示词<textarea id="bibleNegative" rows="2" placeholder="现代元素、卡通感、多余手指、文字水印…">${esc(bible.negative)}</textarea></label>
    </div>
    <div class="actions"><button class="btn" data-cancel-bible>取消</button><button class="btn primary" id="saveBible">保存圣经</button></div>
  </div>`;
  document.body.append(sheet);
  const close = () => sheet.remove();
  sheet.onclick = event => { if (event.target === sheet || event.target.dataset.cancelBible !== undefined) close(); };
  sheet.querySelector('#saveBible').onclick = () => {
    const next = {};
    for (const field of Object.keys(EMPTY_BIBLE)) next[field] = sheet.querySelector('#bible' + field[0].toUpperCase() + field.slice(1))?.value || '';
    writeBible(state.project, next);
    markDirty();
    close();
    toast('项目圣经已保存');
    if (after) renderStory(after); else renderStage();
  };
}

function showMeta() {
  const summary = projectSummary(state.project);
  const sheet = document.createElement('div');
  sheet.className = 'name-sheet';
  sheet.innerHTML = `<div class="panel">
    <h2>影片信息</h2>
    <label class="field">影片名称<input id="metaName" value="${esc(summary.name)}" maxlength="200" placeholder="给这部影片起个名字"></label>
    <p class="sub">时长 ${durationLabel(summary.duration)} · ${summary.shots} 个镜头 · ${summary.fps} fps</p>
    <div class="actions"><button class="btn" data-cancel-meta>取消</button><button class="btn primary" id="saveMeta">保存</button></div>
  </div>`;
  document.body.append(sheet);
  const close = () => sheet.remove();
  sheet.onclick = event => { if (event.target === sheet || event.target.dataset.cancelMeta !== undefined) close(); };
  sheet.querySelector('#metaName').focus();
  sheet.querySelector('#saveMeta').onclick = () => {
    const name = sheet.querySelector('#metaName').value.trim();
    if (name) {
      state.project.name = name;
      $('#projectName').textContent = name;
      markDirty();
      toast('影片名称已更新');
    }
    close();
  };
}

function overlayTop() {
  return [...document.querySelectorAll('.lightbox, .bible-sheet, .name-sheet, .settings-sheet, .sheet.on')].at(-1) || null;
}

function closeTopOverlay() {
  const overlay = overlayTop();
  if (overlay) {
    // 弹窗可能挂着 Promise（确认生成、添加动作等）：优先点取消，避免悬空。
    const cancel = overlay.querySelector('[data-cancel], [data-cancel-bible], [data-cancel-meta], [data-cancel-asset], [data-cancel-action], [data-cancel-prompt], [data-close-settings]');
    if (cancel) cancel.click(); else overlay.remove();
    return true;
  }
  if (document.body.classList.contains('ask-open')) { closeAssistant(); return true; }
  return false;
}

/* ---------------- 分镜 ---------------- */

function renderShots(body) {
  const rows = shotRows(state.project);
  const summary = projectSummary(state.project);
  body.innerHTML = `
    <div class="toolbar">
      <div><h1>分镜</h1><div class="sub">${rows.length} 镜 · ${durationLabel(summary.duration)} · ${summary.cameras} 个机位</div></div>
      <span class="grow"></span>
      <button class="btn" id="addShotHint">＋ 镜头</button>
      <button class="btn primary" id="toPreviz">送入预演 →</button>
    </div>
    ${rows.length ? `<div class="panel shots">${rows.map(row => {
      const cameras = (state.project.objects || []).filter(object => object.type === 'camera');
      return `<div class="shot ${state.selectedShot === row.id ? 'selected' : ''}" data-shot="${esc(row.id)}">
        <span class="no">${row.number}</span>
        <div class="thumb"></div>
        <div class="shot-inline-main">
          <input class="shot-inline-desc" data-shot-desc="${esc(row.id)}" value="${esc(row.description)}" placeholder="点击直接写画面描述…" aria-label="镜 ${row.number} 画面描述">
          <div class="desc">${esc(row.aspect)} · 镜 ${row.number}</div>
        </div>
        <input class="shot-inline-duration" data-shot-duration="${esc(row.id)}" type="number" min="0.2" max="600" step="0.1" value="${row.duration}" aria-label="镜 ${row.number} 时长">
        <select class="shot-inline-camera" data-shot-camera="${esc(row.id)}" aria-label="镜 ${row.number} 机位">${cameras.map(camera => `<option value="${camera.id}" ${camera.id === row.cameraId ? 'selected' : ''}>${esc(camera.name)}</option>`).join('')}</select>
        <span class="pill">草稿</span>
      </div>`;
    }).join('')}</div>` : `<div class="panel placeholder" style="margin:8vh auto"><h2>还没有镜头</h2><p>先在故事里写完剧本，再让助手生成分镜，或点「＋ 镜头」。</p></div>`}`;
  document.querySelectorAll('[data-shot]').forEach(row => {
    row.onclick = event => {
      if (event.target.closest('input,select,textarea')) return;
      state.selectedShot = row.dataset.shot;
      renderShots(body);
    };
  });
  document.querySelectorAll('[data-shot-desc]').forEach(input => {
    input.addEventListener('mousedown', event => event.stopPropagation());
    input.onchange = () => {
      try { setShotDescription(state.project, input.dataset.shotDesc, input.value); markDirty(); renderShots(body); }
      catch (error) { toast('描述保存失败：' + error.message); }
    };
  });
  document.querySelectorAll('[data-shot-duration]').forEach(input => {
    input.addEventListener('mousedown', event => event.stopPropagation());
    input.onchange = () => {
      const shot = (state.project.shots || []).find(item => item.id === input.dataset.shotDuration);
      const current = shot ? (shot.end - shot.start) : 3;
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 0.2) {
        input.value = current.toFixed(1);
        toast('时长需在 0.2 秒以上，已恢复原值');
        return;
      }
      try { updateShot(state.project, input.dataset.shotDuration, {duration: value}); markDirty(); renderShots(body); }
      catch (error) {
        input.value = current.toFixed(1);
        toast('时长无效：' + error.message);
      }
    };
  });
  document.querySelectorAll('[data-shot-camera]').forEach(select => {
    select.addEventListener('mousedown', event => event.stopPropagation());
    select.onchange = () => {
      try { updateShot(state.project, select.dataset.shotCamera, {cameraId: select.value}); markDirty(); renderShots(body); }
      catch (error) { toast('机位切换失败：' + error.message); }
    };
  });
  $('#addShotHint').onclick = () => {
    try {
      addShot(state.project, {duration: 3});
      markDirty();
      state.selectedShot = sortedShots(state.project).at(-1).id;
      renderShots(body);
    } catch (error) { toast('新建失败：' + error.message); }
  };
  $('#toPreviz').onclick = () => switchStage('previz');
  if (state.selectedShot) renderShotInspector(body);
}

function renderShotInspector(body) {
  const row = shotRows(state.project).find(item => item.id === state.selectedShot);
  if (!row) return;
  const cameras = (state.project.objects || []).filter(object => object.type === 'camera');
  const aside = document.createElement('aside');
  aside.className = 'panel inspector';
  aside.style.marginTop = '14px';
  aside.innerHTML = `<h3>镜 ${row.number} · 编辑</h3>
    <label class="field">时长（秒）<input id="shotDuration" type="number" min="0.2" max="600" step="0.1" value="${row.duration}"></label>
    <label class="field">机位<select id="shotCamera">${cameras.map(camera => `<option value="${camera.id}" ${camera.id === row.cameraId ? 'selected' : ''}>${esc(camera.name)}</option>`).join('')}</select></label>
    <label class="field">画面描述<textarea id="shotDesc" rows="4" placeholder="这一镜看到什么">${esc(row.description)}</textarea></label>
    <div class="row" style="display:flex;gap:6px;margin-top:10px">
      <button class="btn" id="shotUp">上移</button><button class="btn" id="shotDown">下移</button>
      <button class="btn" id="shotDelete" style="color:#d64545">删除</button>
    </div>
    <p class="sub" style="font-size:12px;margin-top:10px">修改会自动保存；删除后时间轴自动接上。</p>`;
  body.append(aside);
  const refresh = () => { markDirty(); renderShots(body); };
  $('#shotDuration').onchange = event => {
    try { updateShot(state.project, row.id, {duration: Number(event.target.value)}); refresh(); }
    catch (error) { toast('时长无效：' + error.message); }
  };
  $('#shotCamera').onchange = event => { updateShot(state.project, row.id, {cameraId: event.target.value}); refresh(); };
  $('#shotDesc').onchange = event => { setShotDescription(state.project, row.id, event.target.value); refresh(); };
  $('#shotUp').onclick = () => { moveShot(state.project, row.id, -1); refresh(); };
  $('#shotDown').onclick = () => { moveShot(state.project, row.id, 1); refresh(); };
  $('#shotDelete').onclick = () => {
    state.lastSnapshot = JSON.stringify(state.project);
    removeShot(state.project, row.id);
    state.selectedShot = null;
    markDirty(); renderShots(body);
    toast('已删除镜头', {label: '撤销', run: () => { state.project = JSON.parse(state.lastSnapshot); markDirty(); renderShots(body); }});
  };
}

/* ---------------- 资产 / 生成 ---------------- */

async function loadManifest() {
  if (state.manifest) return state.manifest;
  try {
    const response = await fetch('/assets/manifest.json');
    state.manifest = response.ok ? (await response.json()).assets || [] : [];
  } catch { state.manifest = []; }
  return state.manifest;
}

function confirmSheet({title, detail, confirmLabel = '确认'}) {
  return new Promise(resolve => {
    const sheet = document.createElement('div');
    sheet.className = 'sheet on';
    sheet.innerHTML = `<div class="panel"><h2>${esc(title)}</h2><p class="sub" style="margin-top:8px">${detail}</p>
      <div class="actions"><button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>${esc(confirmLabel)}</button></div></div>`;
    document.body.append(sheet);
    const close = value => { sheet.remove(); resolve(value); };
    sheet.querySelector('[data-cancel]').onclick = () => close(false);
    sheet.querySelector('[data-ok]').onclick = () => close(true);
    sheet.onclick = event => { if (event.target === sheet) close(false); };
  });
}

function openExtractAssets() {
  openAssistant();
  const prompt = $('#askPrompt');
  if (prompt) prompt.value = extractAssetsPrompt(state.project);
  runAssistant('assets');
}

async function renderAssets(body) {
  const assets = projectAssets(state.project);
  if (!assets.length) {
    body.innerHTML = `<div class="toolbar"><div><h1>资产</h1><div class="sub">还没有资产 · 提取后可逐项生成资产图</div></div></div>
    <div class="placeholder">
      <div class="icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS.assets}</svg></div>
      <h2>还没有资产</h2>
      <p>让助手根据剧本与分镜提取角色、场景、道具，并给出可直接用于文生图的提示词。</p>
      <p class="note">提取后可逐项生成资产图（先报价、再确认）。</p>
      <button class="btn primary" id="extractAssets" style="margin-top:16px">从剧本提取资产</button>
    </div>`;
    $('#extractAssets').onclick = openExtractAssets;
    return;
  }
  body.innerHTML = `<div class="toolbar"><div><h1>资产</h1><div class="sub">${assets.length} 个资产 · ${assets.filter(asset => normalizeAssetImages(asset).imageVersions.length).length} 个已有图片</div></div>
    <span class="grow"></span><button class="btn" id="extractAssets">提取资产</button><button class="btn primary" id="genAllHint">全部生成图</button></div>
    <div class="cards">${assets.map(asset => {
      const versions = normalizeAssetImages(asset).imageVersions;
      const prompt = String(asset.prompt || '').trim();
      return `<div class="panel card asset-card" data-asset="${esc(asset.id)}">
        <div class="asset-thumb-wrap asset-thumb-tall">
          ${versions.length ? '' : '<div class="asset-placeholder"><span>未生成图</span><small>点下方按钮生成</small></div>'}
          <img class="asset-thumb clickable" data-asset-img="${esc(asset.id)}" alt="" style="display:none" title="点击放大">
          <span class="asset-kind-chip">${assetKindLabel(asset.kind)}</span>
          <span class="asset-version-chip">${versions.length ? 'v' + versions.length : '未生成图'}</span>
        </div>
        <div class="body">
          <div class="asset-head"><b>${esc(asset.name)}</b></div>
          <p class="asset-prompt" data-prompt-view="${esc(asset.id)}">${esc(prompt || '还没有提示词，点「编辑提示词」补上')}</p>
          <div class="asset-actions">
            <button class="btn primary" data-gen="${esc(asset.id)}">生成资产图</button>
            <button class="btn" data-edit-prompt="${esc(asset.id)}">编辑提示词</button>
          </div>
          <div class="asset-prompt-edit" data-prompt-edit="${esc(asset.id)}" hidden>
            <textarea rows="5" placeholder="描述外观、服装、光线、画风…">${esc(prompt)}</textarea>
            <div class="row" style="display:flex;gap:6px;margin-top:6px">
              <button class="btn primary" data-save-prompt="${esc(asset.id)}">保存</button>
              <button class="btn" data-cancel-prompt="${esc(asset.id)}">取消</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
  $('#extractAssets').onclick = openExtractAssets;
  $('#genAllHint').onclick = () => toast('逐项生成即可；批量生成与费用上限在下一步接入');
  const findAsset = id => projectAssets(state.project).find(item => item.id === id);
  document.querySelectorAll('[data-edit-prompt]').forEach(button => {
    button.onclick = () => {
      const asset = findAsset(button.dataset.editPrompt);
      const box = document.querySelector(`[data-prompt-edit="${button.dataset.editPrompt}"]`);
      const input = box?.querySelector('textarea');
      if (!asset || !box || !input) return;
      input.value = asset.prompt || '';
      box.hidden = false;
      const fit = () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight + 2, Math.round(window.innerHeight * 0.58)) + 'px';
      };
      input.oninput = fit;
      requestAnimationFrame(fit);
      input.focus();
    };
  });
  document.querySelectorAll('[data-cancel-prompt]').forEach(button => {
    button.onclick = () => { const box = document.querySelector(`[data-prompt-edit="${button.dataset.cancelPrompt}"]`); if (box) box.hidden = true; };
  });
  document.querySelectorAll('[data-save-prompt]').forEach(button => {
    button.onclick = () => {
      const asset = findAsset(button.dataset.savePrompt);
      const box = document.querySelector(`[data-prompt-edit="${button.dataset.savePrompt}"]`);
      const input = box?.querySelector('textarea');
      if (!asset || !input) return;
      asset.prompt = input.value.slice(0, 6000);
      markDirty();
      renderAssets(body);
      toast('提示词已保存');
    };
  });
  document.querySelectorAll('[data-gen]').forEach(button => {
    button.onclick = () => {
      const asset = projectAssets(state.project).find(item => item.id === button.dataset.gen);
      if (asset) openAssetGenerateSheet(asset);
    };
  });
  for (const asset of assets) {
    const version = normalizeAssetImages(asset).imageVersions.find(item => item.id === asset.selectedImageId)
      || normalizeAssetImages(asset).imageVersions[0];
    if (!version) continue;
    const url = await media().url(version.mediaId);
    const image = document.querySelector(`[data-asset-img="${asset.id}"]`);
    if (image && url) {
      image.src = url;
      image.style.display = 'block';
      image.onclick = () => openImageLightbox(url, asset.name);
    }
  }
}

function openImageLightbox(url, name) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.innerHTML = `<div class="lightbox-inner">
    <img src="${url}" alt="${esc(name)}">
    <div class="lightbox-bar"><span>${esc(name)}</span><a class="btn" href="${url}" download="${esc(name)}.png">下载</a><button class="btn" data-close-lightbox>关闭</button></div>
  </div>`;
  document.body.append(overlay);
  overlay.onclick = event => { if (event.target === overlay || event.target.dataset.closeLightbox !== undefined) overlay.remove(); };
}

async function openAssetGenerateSheet(asset) {
  let models;
  try { models = await imageModels(); }
  catch (error) { return toast('读取图片模型失败：' + error.message); }
  if (!models.length) return toast('没有可用的图片模型，请先在旧界面检查 oiioii');
  const sheet = document.createElement('div');
  sheet.className = 'sheet on';
  sheet.innerHTML = `<div class="panel">
    <h2>生成资产图</h2>
    <p class="sub">${esc(asset.name)} · 先选模型，再查报价</p>
    <label class="field">模型<select id="assetModel">${models.map(model => `<option value="${esc(model.id)}">${esc(model.name || model.id)}</option>`).join('')}</select></label>
    <p class="sub" id="assetQuote">选择模型后查询报价；确认前不会扣积分。</p>
    <div class="actions"><button class="btn" data-cancel-asset>取消</button><button class="btn" id="assetQuoteBtn">查询报价</button><button class="btn primary" id="assetConfirmBtn" disabled>确认生成</button></div>
  </div>`;
  document.body.append(sheet);
  const close = () => sheet.remove();
  let quote = null, picked = null;
  sheet.querySelector('[data-cancel-asset]').onclick = close;
  sheet.onclick = event => { if (event.target === sheet) close(); };
  const modelSelect = sheet.querySelector('#assetModel');
  const quoteText = sheet.querySelector('#assetQuote');
  const confirmButton = sheet.querySelector('#assetConfirmBtn');
  modelSelect.onchange = () => {
    quote = null; picked = null; confirmButton.disabled = true;
    quoteText.textContent = '模型已切换，请重新查询报价。';
  };
  sheet.querySelector('#assetQuoteBtn').onclick = async () => {
    const model = models.find(item => item.id === modelSelect.value);
    quoteText.textContent = '正在报价…';
    try {
      picked = {
        model,
        resolution: (model.sizes || [])[0] || '',
        aspect: (model.aspects || []).includes('16:9') ? '16:9' : (model.aspects || [])[0] || '1:1',
      };
      quote = await quoteImage({modelId: model.id, resolution: picked.resolution, aspect: picked.aspect});
      quoteText.textContent = `预计 ${quote.points} 积分 · ${quote.sufficient ? '余额充足' : '余额可能不足'} · ${picked.aspect}`;
      confirmButton.disabled = false;
      confirmButton.textContent = `确认生成（${quote.points} 积分）`;
    } catch (error) {
      quoteText.textContent = '报价失败：' + error.message;
    }
  };
  confirmButton.onclick = async () => {
    if (!quote || !picked) return;
    close();
    await doAssetGenerate(asset, picked, quote);
  };
}

async function doAssetGenerate(asset, picked, quote) {
  try {
    toast('已提交，正在生成资产图…');
    const prompt = [assetImagePrompt(asset), bibleStyleSuffix(readBible(state.project))].filter(Boolean).join('\n').slice(0, 6000);
    const job = await generateImage({quoteId: quote.quoteId, prompt});
    const done = await waitForImage(job.id);
    const blob = await fetchImageBlob(done.imageUrl);
    const size = await imageSize(blob);
    const mediaId = crypto.randomUUID();
    const mime = blob.type || 'image/png';
    await media().put({id: mediaId, kind: 'image', name: asset.name, mime, size: blob.size, width: size.width, height: size.height, blob});
    addAssetImageVersions(asset, [{id: crypto.randomUUID(), mediaId, name: asset.name + ' 资产图', mime, size: blob.size, width: size.width, height: size.height, prompt}]);
    markDirty();
    renderStage();
    toast('资产图已生成并采用');
  } catch (error) {
    toast('生成失败：' + error.message);
  }
}

function videoUrlFor(shot, images) {
  return shot?.render?.videoMediaId ? media().url(shot.render.videoMediaId) : null;
}

async function renderGenerate(body) {
  return renderEmbedded(body, 'canvas', '画布', '旧画布：节点、连线、素材与生成任务');
}

async function renderGenerateList(body) {
  const rows = shotRows(state.project);
  body.innerHTML = `<div class="toolbar"><div><h1>生成</h1><div class="sub">${rows.length} 镜 · 逐镜生成视频 · 先报价再确认</div></div>
    <span class="grow"></span><button class="btn" id="genViewToggle">画布视图</button><button class="btn" id="genPrevizLink">去预演</button></div>
    ${rows.length ? `<div class="panel gen">${rows.map(row => {
      const video = state.project.shots.find(shot => shot.id === row.id)?.render?.videoMediaId;
      return `<div class="genrow" data-gen-row="${esc(row.id)}">
        <span class="no">${row.number}</span>
        ${video ? `<div class="thumb video-thumb"><video data-gen-video="${esc(row.id)}" muted playsinline></video></div>` : '<div class="thumb"></div>'}
        <div class="thumb"></div>
        <div><div class="name">${esc(row.description || '未写画面描述')}</div><div class="desc">${esc(row.camera)} · ${row.duration}s</div></div>
        <span class="pill ${video ? 'ok' : ''}" data-gen-status="${esc(row.id)}">${video ? '已生成' : '未生成'}</span>
        <button class="btn ${video ? '' : 'primary'}" data-gen-video="${esc(row.id)}">${video ? '重新生成' : '生成视频'}</button>
      </div>`;
    }).join('')}</div>` : '<div class="placeholder"><h2>还没有镜头</h2><p>先在分镜里加镜头，再逐镜生成。</p></div>'}`;
  $('#genPrevizLink').onclick = () => switchStage('previz');
  $('#genViewToggle').onclick = () => { state.generateView = 'canvas'; renderGenerate(body); };
  document.querySelectorAll('[data-gen-video]').forEach(button => {
    const shot = state.project.shots.find(item => item.id === button.dataset.genVideo);
    button.onclick = () => generateShotVideo(shot, body);
  });
  for (const row of rows) {
    const shot = state.project.shots.find(item => item.id === row.id);
    if (!shot?.render?.videoMediaId) continue;
    const url = await videoUrlFor(shot);
    const video = document.querySelector(`[data-gen-video="${row.id}"]`);
    const element = document.querySelector(`video[data-gen-video="${row.id}"]`);
    if (element && url) element.src = url;
  }
}

async function generateShotVideo(shot, body) {
  if (!shot) return;
  const status = document.querySelector(`[data-gen-status="${shot.id}"]`);
  const setStatus = text => { if (status) status.textContent = text; };
  try {
    const models = await videoModels();
    const picked = pickVideoModel(models, shot.end - shot.start);
    if (!picked) throw Error('没有可用的文生视频模型，请先在旧界面检查 oiioii');
    const prompt = shotVideoPrompt(state.project, shot, projectAssets(state.project));
    const quote = await quoteVideo({
      projectId: state.project.id,
      prompt,
      modelId: picked.model.id,
      duration: picked.duration,
      resolution: picked.resolution,
      aspect: picked.aspect,
    });
    const ok = await confirmSheet({
      title: '生成镜头视频',
      detail: `${esc(picked.model.name || picked.model.id)} · ${picked.duration}s · ${esc(picked.aspect)} · 预计 ${esc(String(quote.points))} 积分 · ${quote.sufficient ? '余额充足' : '余额可能不足'}`,
      confirmLabel: `确认生成（${quote.points} 积分）`,
    });
    if (!ok) return;
    setStatus('提交中…');
    const job = await generateVideo({quoteId: quote.quoteId});
    setStatus('生成中…');
    const done = await waitForVideo(job.id, {onProgress: value => setStatus(value.status === 'pending' ? '生成中…' : (value.phase || '生成中…'))});
    const blob = await fetchVideoBlob(done.id);
    const mediaId = crypto.randomUUID();
    await media().put({id: mediaId, kind: 'video', name: `镜 ${shot.id.slice(0, 6)}`, mime: 'video/mp4', size: blob.size, durationSec: picked.duration, blob});
    shot.render = {videoMediaId: mediaId, prompt, modelId: picked.model.id, duration: picked.duration, createdAt: Date.now()};
    markDirty();
    renderGenerate(body);
    toast('镜头视频已生成并保存');
  } catch (error) {
    setStatus('失败');
    toast('生成失败：' + error.message);
  }
}

const graphKey = () => 'cw:gen-graph:' + state.project.id;

function loadGraph() {
  try { return sanitizeSavedGraph(JSON.parse(localStorage.getItem(graphKey()) || 'null')); } catch { return null; }
}

function saveGraph(graph) {
  try {
    localStorage.setItem(graphKey(), JSON.stringify({
      nodes: Object.fromEntries(graph.nodes.map(node => [node.id, {x: Math.round(node.x), y: Math.round(node.y)}])),
      edges: graph.edges,
    }));
  } catch {}
}

async function ensureVideoModels() {
  if (state.videoModels) return state.videoModels;
  try { state.videoModels = await videoModels(); }
  catch (error) { state.videoModels = []; toast('读取视频模型失败：' + error.message); }
  return state.videoModels;
}

function nodeMarkup(node, project) {
  const portOut = ['asset', 'shot', 'previz', 'result'].includes(node.kind) ? `<button class="gnode-port out" data-out="${esc(node.id)}" title="从这里拖线"></button>` : '';
  const portIn = node.kind === 'generate' ? '<button class="gnode-port in" data-in="1" title="连接素材到这"></button>' : '';
  let body = '';
  if (node.kind === 'asset') {
    body = node.imageVersion
      ? `<img class="gnode-img" data-gimg="${esc(node.id)}" alt="">`
      : '<div class="gnode-placeholder">未生成图</div>';
  } else if (node.kind === 'shot') {
    const row = shotRows(project).find(item => item.id === node.refId);
    body = `<p class="gnode-desc">${esc(row?.description || '未写画面描述')}</p><span class="gnode-meta">${esc(row?.camera || '')}</span>`;
  } else if (node.kind === 'previz') {
    body = '<p class="gnode-desc">整段预演，可作为多参考视频素材</p>';
  } else if (node.kind === 'result') {
    body = `<video class="gnode-img" data-gvideo="${esc(node.id)}" muted playsinline></video>`;
  } else if (node.kind === 'generate') {
    body = `<div class="gnode-inputs" id="inputs-${esc(node.id)}">正在计算输入…</div>
      <select class="gnode-select" data-model="${esc(node.id)}"><option>读取模型…</option></select>
      <textarea class="gnode-prompt" data-prompt="${esc(node.id)}" rows="2" placeholder="这一镜的画面要求">${esc(shotRows(project).find(item => item.id === node.refId)?.description || '')}</textarea>
      <div class="row" style="display:flex;gap:6px"><button class="btn primary" data-gen-node="${esc(node.id)}">报价并生成</button><span class="gnode-meta" data-gen-status="${esc(node.id)}"></span></div>`;
  }
  return `<div class="gnode gnode-${node.kind}" data-node="${esc(node.id)}" style="left:${node.x}px;top:${node.y}px;width:${node.w}px;min-height:${node.h}px">
    ${portIn}<div class="gnode-head"><b>${esc(node.title)}</b><span>${esc(node.subtitle || '')}</span></div>${body}${portOut}
  </div>`;
}

function edgeMarkup(edge, byId) {
  const a = byId.get(edge.from), b = byId.get(edge.to);
  if (!a || !b) return '';
  const x1 = a.x + a.w, y1 = a.y + 46;
  const x2 = b.x, y2 = b.y + 46;
  const d = `M ${x1} ${y1} C ${x1 + 90} ${y1}, ${x2 - 90} ${y2}, ${x2} ${y2}`;
  return `<path class="gen-edge edge-${edge.kind}" data-edge="${esc(edgeKey(edge))}" d="${d}"></path>`;
}

async function renderGenerateCanvas(body) {
  const assets = projectAssets(state.project);
  let graph;
  try { graph = buildGraph(state.project, {assets}, loadGraph()); }
  catch (error) { localStorage.setItem('genErr', 'buildGraph: ' + (error.stack || error)); throw error; }
  state.graph = graph;
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  body.innerHTML = `<div class="toolbar"><div><h1>生成</h1><div class="sub">素材节点连线到视频生成 · ${graph.nodes.length} 个节点 · ${graph.edges.length} 条连线</div></div>
    <span class="grow"></span><button class="btn" id="autoLayout">重置连线</button><button class="btn" id="genListView">列表视图</button><button class="btn" id="genPrevizLink">去预演</button></div>
    <div class="gen-canvas" id="genCanvas">
      <div class="gen-canvas-inner" id="canvasInner">
        <svg class="gen-edges" id="genEdges">${graph.edges.map(edge => edgeMarkup(edge, byId)).join('')}</svg>
        ${
          (() => {
            try { return graph.nodes.map(node => nodeMarkup(node, state.project)).join(''); }
            catch (error) { localStorage.setItem('genErr', 'nodeMarkup: ' + (error.stack || error)); throw error; }
          })()
        }
      </div>
      <div class="gen-canvas-hint">拖节点排布 · 点右侧圆点再点生成节点连线 · 点连线删除 · 滚轮缩放</div>
    </div>`;
  $('#genListView').onclick = () => { state.generateView = 'list'; renderGenerate(body); };
  $('#genPrevizLink').onclick = () => switchStage('previz');
  $('#autoLayout').onclick = () => {
    localStorage.removeItem(graphKey());
    state.pendingFrom = null;
    state.genConfig = {};
    renderGenerate(body);
    toast('已重置为自动排布与默认连线');
  };

  // 媒体填充
  for (const node of graph.nodes) {
    if (node.kind === 'asset' && node.imageVersion) {
      const url = await media().url(node.imageVersion.mediaId);
      const image = document.querySelector(`[data-gimg="${node.id}"]`);
      if (image && url) image.src = url;
    }
    if (node.kind === 'result') {
      const shot = state.project.shots.find(item => item.id === node.refId);
      const url = shot?.render?.videoMediaId ? await media().url(shot.render.videoMediaId) : null;
      const video = document.querySelector(`[data-gvideo="${node.id}"]`);
      if (video && url) video.src = url;
    }
    if (node.kind === 'generate') {
      const inputs = inputsFor(node, graph.nodes, graph.edges);
      const box = document.querySelector(`#inputs-${CSS.escape(node.id)}`);
      if (box) box.innerHTML = inputs.length ? inputs.map(input => `<span class="chip small">${esc(input.title)}</span>`).join('') : '<span class="gnode-meta">尚未连接素材</span>';
    }
  }

  // 模型列表
  const models = await ensureVideoModels();
  document.querySelectorAll('[data-model]').forEach(select => {
    const nodeId = select.dataset.model;
    const node = byId.get(nodeId);
    const inputs = node ? inputsFor(node, graph.nodes, graph.edges) : [];
    const needsImage = inputs.some(input => input.kind === 'asset' && input.imageVersion);
    const needsVideo = inputs.some(input => input.kind === 'previz' || input.kind === 'result');
    const suitable = models.filter(model => (!needsImage || model.media?.image) && (!needsVideo || model.media?.video));
    const current = state.genConfig[nodeId]?.modelId;
    if (!current) {
      const preferred = suitable[0] || models.find(model => model.promptOnly) || models[0];
      if (preferred) state.genConfig[nodeId] = {modelId: preferred.id};
    }
    const selected = state.genConfig[nodeId]?.modelId;
    select.innerHTML = models.length
      ? models.map(model => `<option value="${esc(model.id)}" ${model.id === selected ? 'selected' : ''}>${esc((model.name || model.id) + (model.promptOnly ? ' · 文生' : ' · 参考'))}</option>`).join('')
      : '<option value="">没有可用模型</option>';
    select.onchange = () => { state.genConfig[nodeId] = {modelId: select.value}; };
  });

  // 节点拖动 + 端口 + 连线
  const inner = $('#canvasInner');
  const canvas = $('#genCanvas');
  let drag = null;
  inner.querySelectorAll('.gnode').forEach(element => {
    element.addEventListener('mousedown', event => {
      if (event.target.closest('button,input,select,textarea')) return;
      const node = byId.get(element.dataset.node);
      if (!node) return;
      drag = {node, element, startX: event.clientX, startY: event.clientY, x: node.x, y: node.y};
      event.preventDefault();
    });
    element.querySelector('[data-in]')?.addEventListener('click', event => {
      event.stopPropagation();
      if (!state.pendingFrom) return toast('先点素材节点右侧的圆点');
      const from = byId.get(state.pendingFrom);
      const to = byId.get(element.dataset.node);
      const result = addEdge(graph.edges, from, to);
      if (result.error) return toast(result.error);
      graph.edges = result.edges;
      state.pendingFrom = null;
      saveGraph(graph);
      renderGenerateCanvas(body);
    });
    element.querySelector('[data-gen-node]')?.addEventListener('click', () => generateOnNode(byId.get(element.dataset.node), graph, body));
  });
  inner.querySelectorAll('[data-out]').forEach(port => {
    port.addEventListener('click', event => {
      event.stopPropagation();
      state.pendingFrom = port.dataset.out;
      document.querySelectorAll('[data-out]').forEach(item => item.classList.remove('pending'));
      port.classList.add('pending');
      toast('已选中素材，点生成节点左侧圆点完成连线');
    });
  });
  document.querySelectorAll('[data-edge]').forEach(path => {
    path.addEventListener('click', () => {
      graph.edges = removeEdge(graph.edges, path.dataset.edge);
      saveGraph(graph);
      renderGenerateCanvas(body);
      toast('已删除连线');
    });
  });
  canvas.addEventListener('mousedown', event => {
    if (event.target !== canvas && event.target !== inner && event.target.tagName !== 'svg') return;
    canvas.dataset.panning = '1';
    canvas.dataset.panX = event.clientX - Number(canvas.dataset.tx || 0);
    canvas.dataset.panY = event.clientY - Number(canvas.dataset.ty || 0);
  });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const next = Math.min(1.6, Math.max(0.5, Number(canvas.dataset.scale || 1) * (event.deltaY < 0 ? 1.08 : 0.93)));
    canvas.dataset.scale = next;
    applyCanvasTransform(canvas);
  }, {passive: false});
  applyCanvasTransform(canvas);
  document.addEventListener('mousemove', moveHandler = event => {
    if (drag) {
      const node = drag.node;
      node.x = drag.x + (event.clientX - drag.startX);
      node.y = drag.y + (event.clientY - drag.startY);
      drag.element.style.left = node.x + 'px';
      drag.element.style.top = node.y + 'px';
      document.getElementById('genEdges').innerHTML = graph.edges.map(edge => edgeMarkup(edge, byId)).join('');
      return;
    }
    const activeCanvas = document.getElementById('genCanvas');
    if (activeCanvas?.dataset.panning === '1') {
      activeCanvas.dataset.tx = event.clientX - Number(activeCanvas.dataset.panX || 0);
      activeCanvas.dataset.ty = event.clientY - Number(activeCanvas.dataset.panY || 0);
      applyCanvasTransform(activeCanvas);
    }
  });
  document.addEventListener('mouseup', () => {
    if (drag) { saveGraph(graph); drag = null; }
    const activeCanvas = document.getElementById('genCanvas');
    if (activeCanvas) activeCanvas.dataset.panning = '0';
  });
}

let moveHandler = null;

function applyCanvasTransform(canvas) {
  const inner = canvas.querySelector('.gen-canvas-inner');
  if (!inner) return;
  const x = Number(canvas.dataset.tx || 0), y = Number(canvas.dataset.ty || 0), scale = Number(canvas.dataset.scale || 1);
  inner.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

async function generateOnNode(node, graph, body) {
  if (!node) return;
  const status = document.querySelector(`[data-gen-status="${CSS.escape(node.id)}"]`);
  const setStatus = text => { if (status) status.textContent = text; };
  const shot = state.project.shots.find(item => item.id === node.refId);
  if (!shot) return;
  const inputs = inputsFor(node, graph.nodes, graph.edges);
  const models = await ensureVideoModels();
  const picked = models.find(model => model.id === state.genConfig[node.id]?.modelId) || models[0];
  if (!picked) return toast('没有可用的视频模型');
  try {
    setStatus('准备参考…');
    const references = [];
    for (const input of inputs) {
      if (input.kind === 'asset' && input.imageVersion) {
        const blob = await media().blob(input.imageVersion.mediaId);
        if (!blob) continue;
        references.push({
          nodeId: input.refId, kind: 'image',
          purpose: input.subtitle === '场景' ? 'scene' : 'appearance',
          data: 'data:' + (blob.type || 'image/png') + ';base64,' + toBase64(await blob.arrayBuffer()),
        });
      }
      if (input.kind === 'shot') continue;
      if (input.kind === 'result' || input.kind === 'previz') {
        const source = input.kind === 'result' ? state.project.shots.find(item => item.id === input.refId) : null;
        const mediaId = source?.render?.videoMediaId;
        if (!mediaId) continue;
        const blob = await media().blob(mediaId);
        if (!blob) continue;
        references.push({nodeId: input.refId, kind: 'video', purpose: 'motion', data: 'data:video/mp4;base64,' + toBase64(await blob.arrayBuffer()), duration: source.render.duration || shot.end - shot.start});
      }
    }
    const row = shotRows(state.project).find(item => item.id === shot.id);
    for (let index = references.length - 1; index >= 0; index--) {
      if (!picked.media?.[references[index].kind]) references.splice(index, 1);
    }
    if (!references.length && !picked.promptOnly) {
      setStatus('');
      return toast('这个模型需要参考素材；请连接素材或换一个支持文生的模型');
    }
    const prompt = document.querySelector(`[data-prompt="${CSS.escape(node.id)}"]`)?.value?.trim()
      || [row?.description, ...inputs.filter(item => item.kind === 'asset').map(item => item.title)].filter(Boolean).join('；')
      || '镜头画面';
    setStatus('报价中…');
    const allowed = [];
    for (const range of picked.durations || []) {
      const parts = String(range).split('-').map(Number);
      if (parts.length === 2) for (let v = Math.ceil(parts[0]); v <= Math.min(parts[1], 180); v++) allowed.push(v);
      else if (Number.isFinite(parts[0])) allowed.push(parts[0]);
    }
    const duration = allowed.length ? allowed.reduce((best, value) => Math.abs(value - (shot.end - shot.start)) < Math.abs(best - (shot.end - shot.start)) ? value : best, allowed[0]) : Math.max(1, Math.round(shot.end - shot.start));
    const quote = await quoteVideo({
      projectId: state.project.id, prompt, modelId: picked.id, duration,
      resolution: (picked.sizes || [])[0] || '',
      aspect: (picked.aspects || []).includes('16:9') ? '16:9' : (picked.aspects || [])[0] || '16:9',
      references,
    });
    const ok = await confirmSheet({
      title: '生成镜头视频',
      detail: `${esc(picked.name || picked.id)} · ${duration}s · 参考 ${references.length} 个 · 预计 ${quote.points} 积分 · ${quote.sufficient ? '余额充足' : '余额可能不足'}`,
      confirmLabel: `确认生成（${quote.points} 积分）`,
    });
    if (!ok) { setStatus(''); return; }
    setStatus('提交中…');
    const job = await generateVideo({quoteId: quote.quoteId});
    const done = await waitForVideo(job.id, {onProgress: value => setStatus(value.status === 'pending' ? '生成中…' : (value.phase || '生成中…'))});
    const blob = await fetchVideoBlob(done.id);
    const mediaId = crypto.randomUUID();
    await media().put({id: mediaId, kind: 'video', name: '镜 ' + shot.id.slice(0, 6), mime: 'video/mp4', size: blob.size, durationSec: duration, blob});
    shot.render = {videoMediaId: mediaId, prompt, modelId: picked.id, duration, createdAt: Date.now()};
    markDirty();
    renderGenerate(body);
    toast('镜头视频已生成并采用');
  } catch (error) {
    setStatus('失败');
    toast('生成失败：' + error.message);
  }
}

async function renderCut(body) {
  return renderEmbedded(body, 'edit', '剪辑', '旧剪辑面板：时间轴、版本与导出');
}

async function renderFinalCut(body, rows, ready) {
  const status = $('#cutStatus');
  if (ready < rows.length) return toast(`还有 ${rows.length - ready} 镜没有视频，先到生成页逐镜生成；也可以只导出已生成的部分`);
  status.textContent = '读取镜头视频…';
  try {
    const segments = await collectCutSegments(state.project, id => media().blob(id));
    if (!segments.length) throw Error('没有可合成的视频');
    status.textContent = '提交合成…';
    const job = await startCut({segments, width: 1280, height: 720, fps: 24});
    status.textContent = '合成中…';
    const done = await waitForCut(job.id, {onProgress: value => { status.textContent = value.message || '合成中…'; }});
    const blob = await fetchCutBlob(done.id);
    const mediaId = crypto.randomUUID();
    await media().put({id: mediaId, kind: 'video', name: '成片 · ' + (state.project.name || '未命名'), mime: 'video/mp4', size: blob.size, blob});
    state.lastCutMediaId = mediaId;
    status.textContent = `完成：${(blob.size / 1e6).toFixed(1)} MB`;
    renderCut(body);
    toast('成片已合成，可下载');
  } catch (error) {
    status.textContent = '合成失败：' + error.message;
    toast('合成失败：' + error.message);
  }
}

/* ---------------- 预演 ---------------- */

const previz = {viewer: null, time: 0, playing: false, raf: 0, camera: ''};

function stopPreviz() {
  if (previz.raf) cancelAnimationFrame(previz.raf);
  previz.raf = 0; previz.playing = false;
  previz.viewer?.dispose?.();
  previz.viewer = null;
}

function addSampleCharacters() {
  const project = state.project;
  const make = (name, src, size, x, color) => ({
    id: crypto.randomUUID(), type: 'model', name,
    position: [x, 0, 2], target: [0, 1, 0], rotation: 0, scale: 1, fov: 45,
    color, pose: 'stand', keys: [], actions: [],
    modelSrc: src, modelSize: size, modelKind: 'character', modelColorMode: 'original', modelClip: 'Adult_Idle_Neutral',
  });
  project.objects.push(
    make('女修', '/assets/models/adult-female-casual-actions.glb', 1.7, -1.4, '#f06b5c'),
    make('男修', '/assets/models/adult-male-casual-hoodie-actions.glb', 1.85, 1.4, '#398cff'),
  );
  if (!cameraObjects(project).length) addCamera(project, 'wide');
  if (!(project.shots || []).length) addShot(project, {duration: Math.min(project.duration || 12, 12)});
  assignCameras(project);
  markDirty();
  renderStage();
}

function destroyPreviz() {
  stopPreviz();
  const stage = state.previzStage;
  if (stage) {
    try { stage.transform.detach(); } catch {}
  }
}

let previzStageCallbacks = null;

function ensurePrevizStage() {
  if (state.previzStage) return state.previzStage;
  const host = document.createElement('div');
  host.className = 'previz-host';
  const preview = document.createElement('div');
  preview.className = 'previz-preview';
  const onSelect = id => {
    previz.selected = id;
    const select = $('#previzObject');
    if (select) select.value = id || '';
    if (id) state.previzStage?.select(id);
    renderPrevizFields();
  };
  const onTransform = (id, position, rotation, scale, target, roll) => {
    const object = (state.project.objects || []).find(item => item.id === id);
    if (!object) return;
    object.position = position.map(value => Math.round(value * 1000) / 1000);
    if (object.type !== 'camera') {
      object.rotationX = Math.round(rotation[0] * 10) / 10;
      object.rotation = Math.round(rotation[1] * 10) / 10;
      object.rotationZ = Math.round(rotation[2] * 10) / 10;
    }
    if (roll !== null && roll !== undefined) object.roll = roll;
    object.scale = Math.max(0.1, Math.round(scale * 1000) / 1000);
    if (target) object.target = target.map(value => Math.round(value * 1000) / 1000);
    markDirty();
    renderPrevizFields();
  };
  const onTarget = (id, target) => {
    const object = (state.project.objects || []).find(item => item.id === id);
    if (!object) return;
    object.target = target;
    markDirty();
    renderPrevizFields();
  };
  const stage = new Stage(host, preview, onSelect, onTransform, onTarget, () => markDirty());
  state.previzStage = stage;
  window.__previzStage = stage;
  stage.onPathSelect = data => {
    previz.pathSelection = data;
    if (data.kind !== 'line') seekPreviz(data.t);
    renderPathPanel();
  };
  stage.onPathEdit = (data, position) => {
    const object = (state.project.objects || []).find(item => item.id === data.id);
    if (!object || object.locked) return;
    try {
      const draft = draftPathEdit(object, data, position);
      Object.assign(object, draft);
      state.previzStage?.updatePaths();
      markDirty();
      renderPathPanel();
      state.previzStage?.render(previz.time, state.previzOverride);
      renderPrevizTimeline();
    } catch (error) {
      toast(error.message);
      state.previzStage?.updatePaths();
    }
  };
  state.previzHost = host;
  state.previzPreview = preview;
  return stage;
}

function seekPreviz(time) {
  stopPrevizPlayback();
  const duration = Math.max(0.1, state.project.duration);
  previz.time = Math.max(0, Math.min(duration, time));
  const range = $('#previzTime');
  if (range) range.value = previz.time;
  const clock = $('#previzClock');
  if (clock) clock.textContent = durationLabel(previz.time);
  const playhead = $('#tlPlayhead');
  if (playhead) playhead.style.left = tlPercent(previz.time, duration) + '%';
  state.previzStage?.render(previz.time, state.previzOverride);
}

function pathKeyTimes(object) {
  const times = new Set([...(object.keys || []).map(key => key.t), ...((object.channels?.positionX) || []).map(key => key.t)]);
  return [...times].sort((a, b) => a - b);
}

function renderPathPanel() {
  const box = $('#pathPanel');
  if (!box) return;
  const object = (state.project.objects || []).find(item => item.id === previz.selected);
  if (!object) { box.innerHTML = ''; return; }
  const times = pathKeyTimes(object);
  if (times.length < 2) {
    box.innerHTML = `<h3>路径 / 贝塞尔</h3><p class="sub" style="font-size:12px">至少需要两个位置关键帧才能形成路径。</p>
      <button class="btn" id="addPathPoint">在 ${previz.time.toFixed(2)}s 添加路径点</button>`;
    $('#addPathPoint').onclick = () => addPathPoint(object);
    return;
  }
  const selection = previz.pathSelection?.id === object.id ? previz.pathSelection : {id: object.id, t: times[0], kind: 'point'};
  const handles = (object.pathHandles || []).find(item => Math.abs(item.t - selection.t) < 0.001) || {in: [0, 0, 0], out: [0, 0, 0]};
  box.innerHTML = `<h3>路径 / 贝塞尔</h3>
    <p class="sub" style="font-size:11.5px">路径点 ${times.map(time => `<button class="chip small ${Math.abs(time - selection.t) < 0.001 ? 'active' : ''}" data-path-time="${time}">${time.toFixed(2)}s</button>`).join('')}</p>
    <div class="row" style="display:flex;gap:6px">
      <button class="btn" data-path-kind="point" aria-pressed="${selection.kind === 'point'}">位置</button>
      <button class="btn" data-path-kind="in" aria-pressed="${selection.kind === 'in'}">入柄</button>
      <button class="btn" data-path-kind="out" aria-pressed="${selection.kind === 'out'}">出柄</button>
    </div>
    <div class="field">入柄偏移<div class="previz-pos">
      <input id="pathInX" type="number" step="0.1" value="${handles.in[0]}"><input id="pathInY" type="number" step="0.1" value="${handles.in[1]}"><input id="pathInZ" type="number" step="0.1" value="${handles.in[2]}"></div></div>
    <div class="field">出柄偏移<div class="previz-pos">
      <input id="pathOutX" type="number" step="0.1" value="${handles.out[0]}"><input id="pathOutY" type="number" step="0.1" value="${handles.out[1]}"><input id="pathOutZ" type="number" step="0.1" value="${handles.out[2]}"></div></div>
    <div class="row" style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn primary" id="savePathHandles">保存手柄</button>
      <button class="btn" id="removePathHandles">删除手柄</button>
    </div>
    <p class="sub" style="font-size:11.5px;margin-top:6px">视口里直接拖手柄也可以；点“位置/入柄/出柄”切换要拖的手柄。</p>`;
  box.querySelectorAll('[data-path-time]').forEach(button => {
    button.onclick = () => {
      previz.pathSelection = {id: object.id, t: Number(button.dataset.pathTime), kind: selection.kind};
      seekPreviz(Number(button.dataset.pathTime));
      state.previzStage?.selectPath(previz.pathSelection);
      renderPathPanel();
    };
  });
  box.querySelectorAll('[data-path-kind]').forEach(button => {
    button.onclick = () => {
      previz.pathSelection = {id: object.id, t: selection.t, kind: button.dataset.pathKind};
      state.previzStage?.selectPath(previz.pathSelection);
      renderPathPanel();
    };
  });
  const read = prefix => [ $('#' + prefix + 'X').value, $('#' + prefix + 'Y').value, $('#' + prefix + 'Z').value ].map(Number);
  $('#savePathHandles').onclick = () => {
    try {
      const t = selection.t;
      const position = sampleObject(object, t).position;
      ['positionX', 'positionY', 'positionZ'].forEach((id, index) => addParameterKey(object, id, t, Math.round(position[index] * 1000) / 1000));
      const entry = {t, in: read('pathIn'), out: read('pathOut')};
      object.pathHandles = (object.pathHandles || []).filter(item => Math.abs(item.t - t) > 0.001).concat(entry).sort((a, b) => a.t - b.t);
      state.previzStage?.updatePaths();
      markDirty();
      renderPrevizTimeline();
      renderPathPanel();
      state.previzStage?.render(previz.time, state.previzOverride);
      toast('已保存贝塞尔手柄');
    } catch (error) { toast(error.message); }
  };
  $('#removePathHandles').onclick = () => {
    object.pathHandles = (object.pathHandles || []).filter(item => Math.abs(item.t - selection.t) > 0.001);
    state.previzStage?.updatePaths();
    markDirty();
    renderPathPanel();
    toast('已删除手柄');
  };
}

function addPathPoint(object) {
  const time = Math.round(previz.time * 100) / 100;
  const position = sampleObject(object, time).position.map(value => Math.round(value * 1000) / 1000);
  ['positionX', 'positionY', 'positionZ'].forEach((id, index) => addParameterKey(object, id, time, position[index]));
  const times = [...new Set([...(object.keys || []).map(key => key.t), ...((object.channels?.positionX) || []).map(key => key.t)])].sort((a, b) => a - b);
  const previous = sampleObject(object, times.filter(value => value < time).at(-1) ?? time).position;
  const next = sampleObject(object, times.find(value => value > time) ?? time).position;
  const entry = {t: time, in: previous.map((value, index) => Math.round((value - position[index]) / 3 * 100) / 100), out: next.map((value, index) => Math.round((value - position[index]) / 3 * 100) / 100)};
  object.pathHandles = (object.pathHandles || []).filter(item => Math.abs(item.t - time) > 0.001).concat(entry).sort((a, b) => a.t - b.t);
  previz.pathSelection = {id: object.id, t: time, kind: 'out'};
  state.previzStage?.updatePaths();
  markDirty();
  renderPrevizTimeline();
  renderPathPanel();
  state.previzStage?.render(previz.time, state.previzOverride);
  toast('已添加路径点与手柄');
}

function renderPrevizFields() {
  const fields = $('#objectFields');
  if (!fields) return;
  const project = state.project;
  const object = (project.objects || []).find(item => item.id === previz.selected);
  if (!object) { fields.innerHTML = '<p class="sub" style="font-size:12px;margin-top:8px">在视口里点人物或机位，也可以直接选中；拖动手柄移动/旋转。</p>'; return; }
  const position = object.position || [0, 0, 0];
  const isCamera = object.type === 'camera';
  const manifest = state.manifest || [];
  fields.innerHTML = `
    <div class="field">位置 X / Y / Z<div class="previz-pos">
      <input id="objX" type="number" step="0.1" value="${position[0]}"><input id="objY" type="number" step="0.1" value="${position[1]}"><input id="objZ" type="number" step="0.1" value="${position[2]}">
    </div></div>
    ${isCamera ? `<div class="field">看向 X / Y / Z<div class="previz-pos">
      <input id="tgtX" type="number" step="0.1" value="${(object.target || [0, 1, 0])[0]}"><input id="tgtY" type="number" step="0.1" value="${(object.target || [0, 1, 0])[1]}"><input id="tgtZ" type="number" step="0.1" value="${(object.target || [0, 1, 0])[2]}">
    </div></div>
    <div class="field">焦段<input id="camFov" type="number" min="10" max="120" value="${object.fov || 45}"></div>` : `
    <div class="field">朝向（度）<input id="objRotation" type="number" step="5" value="${Math.round(Number(object.rotation) || 0)}"></div>`}
    ${object.type === 'model' ? `<div class="field">动作<select id="objClip">${['', ...clipsForObject(object, manifest).map(clip => clip.name)].map(name => `<option value="${esc(name)}" ${name === (object.modelClip || '') ? 'selected' : ''}>${name ? esc(name) : '不指定'}</option>`).join('')}</select></div>` : ''}
    <div class="row" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
      <button class="btn" data-nudge="forward">前</button><button class="btn" data-nudge="back">后</button>
      <button class="btn" data-nudge="left">左</button><button class="btn" data-nudge="right">右</button>
      ${isCamera ? '<button class="btn" id="previewCamera">预览该机位</button>' : ''}
    </div>`;
  const apply = () => {
    object.position = [Number($('#objX').value), Number($('#objY').value), Number($('#objZ').value)];
    if (isCamera) {
      object.target = [Number($('#tgtX').value), Number($('#tgtY').value), Number($('#tgtZ').value)];
      object.fov = Math.min(120, Math.max(10, Number($('#camFov').value) || 45));
    } else {
      object.rotation = Number($('#objRotation').value) || 0;
    }
    markDirty();
    state.previzStage?.render(previz.time, state.previzOverride);
  };
  for (const field of ['objX', 'objY', 'objZ', 'tgtX', 'tgtY', 'tgtZ', 'camFov', 'objRotation']) {
    const input = $('#' + field);
    if (input) input.onchange = apply;
  }
  const clip = $('#objClip');
  if (clip) clip.onchange = () => {
    object.modelClip = clip.value;
    markDirty();
    state.previzStage?.rebuild(state.project);
    state.previzStage?.render(previz.time, state.previzOverride);
  };
  for (const button of fields.querySelectorAll('[data-nudge]')) {
    button.onclick = () => {
      const step = 0.5;
      const [x, y, z] = object.position;
      const delta = {forward: [0, 0, -step], back: [0, 0, step], left: [-step, 0, 0], right: [step, 0, 0]}[button.dataset.nudge];
      object.position = [x + delta[0], y + delta[1], z + delta[2]];
      markDirty();
      state.previzStage?.apply(previz.time);
      state.previzStage?.render(previz.time, state.previzOverride);
      renderPrevizFields();
    };
  }
  const preview = $('#previewCamera');
  if (preview) preview.onclick = () => {
    state.previzOverride = object.id;
    const select = $('#previzOverride');
    if (select) select.value = object.id;
    state.previzStage?.render(previz.time, state.previzOverride);
  };
}

async function refreshProjectFromLibrary() {
  await new Promise(resolve => setTimeout(resolve, 400));
  try {
    const latest = await library.read(state.project.id);
    if (latest) {
      state.project = latest;
      state.manifest = null;
      const title = $('#projectName');
      if (title) title.textContent = latest.name || '未命名影片';
    }
  } catch {}
}

async function renderEmbedded(body, kind, title, subtitle) {
  stopPrevizLoop();
  if (!state.enteringFromEmbed) await saveNow();
  state.enteringFromEmbed = false;
  const projectId = state.project.id;
  const url = '/?embed=' + kind + '&project=' + encodeURIComponent(projectId);
  body.innerHTML = `<div class="previz-embed">
    <div class="previz-embed-bar">
      <b>${esc(title)}</b><span class="sub">${esc(subtitle)}</span>
      <span class="grow"></span>
      <button class="btn" id="reloadEmbed">重新载入</button>
      <button class="btn" id="openEmbedWindow">新窗口打开</button>
    </div>
    <iframe id="embedFrame" title="${esc(title)}" src="${url}"></iframe>
  </div>`;
  $('#reloadEmbed').onclick = () => { $('#embedFrame').src = url + '&t=' + Date.now(); };
  $('#openEmbedWindow').onclick = () => window.open(url, '_blank', 'width=1440,height=900');
}

async function renderPreviz(body) {
  return renderEmbedded(body, 'stage', '3D 导演台', '完整版：快捷键 · 时间轴 · 离线素材库 · 属性面板');
}

/* ---------------- 时间轴 ---------------- */

function tlPercent(time, duration) { return Math.max(0, Math.min(100, time / Math.max(0.1, duration) * 100)); }

function renderPrevizTimeline() {
  const project = state.project;
  const duration = Math.max(0.1, project.duration);
  const ruler = $('#tlRuler');
  const tracks = $('#tlTracks');
  if (!ruler || !tracks) return;
  const step = duration <= 12 ? 1 : duration <= 30 ? 2 : Math.ceil(duration / 15);
  const ticks = [];
  for (let t = 0; t <= duration + 0.001; t += step) ticks.push(`<span class="tl-tick" style="left:${tlPercent(t, duration)}%">${durationLabel(t)}</span>`);
  ruler.innerHTML = `<div class="tl-ruler-inner">${ticks.join('')}<i class="tl-playhead" id="tlPlayhead" style="left:${tlPercent(previz.time, duration)}%"></i></div>`;
  const rows = [];
  const shots = shotBars(project);
  rows.push(`<div class="tl-row tl-shot-row"><span class="tl-label">镜头</span><div class="tl-lane">${shots.map(shot => `<div class="tl-shot" style="left:${tlPercent(shot.start, duration)}%;width:${tlPercent(shot.end - shot.start, duration)}%" title="镜 ${shot.index}">${shot.index}</div>`).join('')}</div></div>`);
  for (const object of trackObjects(project)) {
    const keys = keyTimes(object);
    const actions = object.actions || [];
    const params = parameterTracks(object);
    const expanded = state.previzExpanded?.has(object.id);
    rows.push(`<div class="tl-row" data-tl-object="${esc(object.id)}">
      <span class="tl-label"><i class="tl-fold" data-fold="${esc(object.id)}">${params.length ? (expanded ? '▾' : '▸') : ''}</i><span data-select-object="${esc(object.id)}">${esc(object.name || object.type)}</span></span>
      <div class="tl-lane" data-lane="${esc(object.id)}">
        ${keys.map((time, index) => `<i class="tl-key" data-key-object="${esc(object.id)}" data-key-index="${index}" style="left:${tlPercent(time, duration)}%" title="${time.toFixed(2)}s"></i>`).join('')}
        ${actions.map(action => `<div class="tl-action" data-action-object="${esc(object.id)}" data-action-id="${esc(action.id)}" style="left:${tlPercent(action.start, duration)}%;width:${tlPercent(action.end - action.start, duration)}%" title="${esc(action.clip)}">
          <span>${esc(action.clip)}</span><i class="tl-action-end" data-action-end="1"></i>
        </div>`).join('')}
      </div>
    </div>`);
    if (expanded) {
      for (const track of params) {
        const values = track.keys.map(key => Number(key.value));
        const min = Math.min(...values), max = Math.max(...values);
        const span = max - min || 1;
        const points = track.keys.map(key => `${tlPercent(key.t, duration)},${(24 - ((Number(key.value) - min) / span) * 18).toFixed(1)}`).join(' ');
        rows.push(`<div class="tl-row tl-param-row"><span class="tl-label tl-param-label">${esc(track.label)}</span>
          <div class="tl-lane" data-param-lane="${esc(object.id)}:${esc(track.id)}">
            <svg class="tl-curve" viewBox="0 0 100 28" preserveAspectRatio="none"><polyline points="${points}"></polyline></svg>
            ${track.keys.map((key, index) => `<i class="tl-key tl-param-key" data-param-object="${esc(object.id)}" data-param-id="${esc(track.id)}" data-param-index="${index}" style="left:${tlPercent(key.t, duration)}%" title="${Number(key.value).toFixed(2)}"></i>`).join('')}
          </div></div>`);
      }
    }
  }
  tracks.innerHTML = rows.join('');
  if (previz.scrollToSelection && previz.selected) {
    previz.scrollToSelection = false;
    const row = tracks.querySelector(`[data-tl-object="${CSS.escape(previz.selected)}"]`);
    if (row) row.scrollIntoView({block: 'nearest'});
  }
  const colors = ['#0a84ff', '#5e5ce6', '#30a46c', '#c98a00', '#d64545', '#8e8e93'];
  tracks.querySelectorAll('.tl-lane').forEach((lane, index) => { lane.style.setProperty('--lane-color', colors[index % colors.length]); });

  const seek = time => {
    stopPrevizPlayback();
    previz.time = Math.max(0, Math.min(duration, time));
    const range = $('#previzTime');
    if (range) range.value = previz.time;
    const clock = $('#previzClock');
    if (clock) clock.textContent = durationLabel(previz.time);
    state.previzStage?.render(previz.time, state.previzOverride);
    const playhead = $('#tlPlayhead');
    if (playhead) playhead.style.left = tlPercent(previz.time, duration) + '%';
  };
  ruler.onclick = event => {
    const rect = ruler.getBoundingClientRect();
    seek((event.clientX - rect.left) / rect.width * duration);
  };
  tracks.querySelectorAll('[data-fold]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      const id = button.dataset.fold;
      if (state.previzExpanded.has(id)) state.previzExpanded.delete(id); else state.previzExpanded.add(id);
      renderPrevizTimeline();
    };
  });
  tracks.querySelectorAll('.tl-param-key').forEach(key => {
    key.addEventListener('pointerdown', event => {
      event.stopPropagation();
      const object = (state.project.objects || []).find(item => item.id === key.dataset.paramObject);
      if (!object) return;
      previz.selection = {kind: 'param', object, id: key.dataset.paramId, index: Number(key.dataset.paramIndex)};
      previz.drag = {kind: 'param', object, id: key.dataset.paramId, index: Number(key.dataset.paramIndex), lane: key.parentElement, duration};
      key.setPointerCapture(event.pointerId);
    });
  });
  tracks.querySelectorAll('[data-select-object]').forEach(label => {
    label.onclick = () => {
      previz.selected = label.dataset.selectObject;
      const select = $('#previzObject');
      if (select) select.value = previz.selected;
      state.previzStage?.select(previz.selected);
      renderPrevizFields();
      state.previzStage?.render(previz.time, state.previzOverride);
    };
  });
  tracks.querySelectorAll('.tl-lane').forEach(lane => {
    lane.addEventListener('pointerdown', event => {
      if (event.target.closest('.tl-key,.tl-action,.tl-shot')) return;
      const rect = lane.getBoundingClientRect();
      seek((event.clientX - rect.left) / rect.width * duration);
    });
  });
  tracks.querySelectorAll('.tl-key').forEach(key => {
    key.addEventListener('pointerdown', event => {
      event.stopPropagation();
      const object = (state.project.objects || []).find(item => item.id === key.dataset.keyObject);
      if (object) {
        previz.drag = {kind: 'key', object, index: Number(key.dataset.keyIndex), lane: key.parentElement, duration};
        previz.selection = {kind: 'key', object, index: Number(key.dataset.keyIndex)};
        key.setPointerCapture(event.pointerId);
      }
    });
  });
  tracks.querySelectorAll('.tl-action').forEach(bar => {
    bar.addEventListener('pointerdown', event => {
      event.stopPropagation();
      const object = (state.project.objects || []).find(item => item.id === bar.dataset.actionObject);
      if (!object) return;
      const action = (object.actions || []).find(item => item.id === bar.dataset.actionId);
      if (!action) return;
      const rect = bar.parentElement.getBoundingClientRect();
      previz.selection = {kind: 'action', object, action};
      previz.drag = {
        kind: event.target.dataset.actionEnd ? 'resize' : 'move',
        object, action,
        lane: bar.parentElement, duration,
        offset: event.clientX - rect.left - (action.start / duration) * rect.width,
      };
      bar.setPointerCapture(event.pointerId);
    });
  });
  if (!window.__previzTimelineBound) {
    window.__previzTimelineBound = true;
    document.addEventListener('pointermove', event => {
      const drag = previz.drag;
      if (!drag) return;
      const rect = drag.lane.getBoundingClientRect();
      const time = Math.max(0, Math.min(drag.duration, (event.clientX - rect.left - (drag.offset || 0)) / rect.width * drag.duration));
      try {
        if (drag.kind === 'key') { moveKey(drag.object, drag.index, time, drag.duration); previz.selection = {kind: 'key', object: drag.object, index: drag.index}; }
        else if (drag.kind === 'param') { moveChannelKey(drag.object, drag.id, drag.index, time, drag.duration); previz.selection = {kind: 'param', object: drag.object, id: drag.id, index: drag.index}; }
        else if (drag.kind === 'move') { moveAction(drag.object, drag.action.id, time, drag.duration); previz.selection = {kind: 'action', object: drag.object, action: drag.action}; }
        else {
          const end = Math.max(0, Math.min(drag.duration, (event.clientX - rect.left) / rect.width * drag.duration));
          resizeAction(drag.object, drag.action.id, end, drag.duration);
          previz.selection = {kind: 'action', object: drag.object, action: drag.action};
        }
        renderPrevizTimeline();
        state.previzStage?.render(previz.time, state.previzOverride);
      } catch {}
    });
    document.addEventListener('pointerup', () => {
      if (!previz.drag) return;
      previz.drag = null;
      markDirty();
      renderPrevizTimeline();
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
      const drag = previz.selection;
      if (!drag) return;
      try {
        if (drag.kind === 'key') deleteKey(drag.object, drag.index);
        else if (drag.kind === 'param') deleteChannelKey(drag.object, drag.id, drag.index);
        else deleteAction(drag.object, drag.action.id);
        markDirty();
        renderPrevizTimeline();
        state.previzStage?.render(previz.time, state.previzOverride);
      } catch (error) { toast(error.message); }
    });
  }
}

function previzNavigationActive() {
  return state.stage === 'previz' && !!document.querySelector('.previz-host canvas') && !!state.previzStage?.orbit;
}

document.addEventListener('keydown', event => {
  if (!previzNavigationActive()) return;
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
  if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'Minus', 'Equal'].includes(event.code)) return;
  state.previzStage.orbit.keys.add(event.code);
  if (event.shiftKey) state.previzStage.orbit.keys.add('ShiftLeft');
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) event.preventDefault();
});
document.addEventListener('keyup', event => {
  state.previzStage?.orbit?.keys?.delete(event.code);
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') state.previzStage?.orbit?.keys?.delete('ShiftLeft');
});
window.addEventListener('blur', () => state.previzStage?.orbit?.clear?.());

function startPrevizLoop() {
  stopPrevizLoop();
  const frame = () => {
    if (state.stage !== 'previz' || !state.previzStage) { state.previzRafLoop = 0; return; }
    state.previzStage.render(previz.time, state.previzOverride, 1 / 60);
    state.previzRafLoop = requestAnimationFrame(frame);
  };
  state.previzRafLoop = requestAnimationFrame(frame);
}

function stopPrevizLoop() {
  if (state.previzRafLoop) cancelAnimationFrame(state.previzRafLoop);
  state.previzRafLoop = 0;
}

function stopPrevizPlayback() {
  if (previz.raf) cancelAnimationFrame(previz.raf);
  previz.raf = 0;
  previz.playing = false;
  const play = $('#previzPlay');
  if (play) play.textContent = '▶';
}

async function openActionSheet(project) {
  const object = (project.objects || []).find(item => item.id === previz.selected);
  if (!object) return toast('先选中一个人物或模型');
  if (!['model', 'actor'].includes(object.type)) return toast('机位不能加动作');
  const options = clipOptions(object, await loadManifest());
  if (!options.length) return toast('这个模型没有动作片段');
  const sheet = document.createElement('div');
  sheet.className = 'sheet on';
  sheet.innerHTML = `<div class="panel"><h2>添加动作 · ${esc(object.name || '')}</h2>
    <label class="field">动作<select id="actionClip">${options.map(option => `<option value="${esc(option.clip)}">${esc(option.label)}</option>`).join('')}</select></label>
    <label class="field">开始时间<input id="actionStart" type="number" step="0.1" value="${Math.round(previz.time * 10) / 10}" min="0" max="${project.duration}"></label>
    <label class="field">时长（秒）<input id="actionDuration" type="number" step="0.1" value="2" min="0.1" max="60"></label>
    <div class="actions"><button class="btn" data-cancel-action>取消</button><button class="btn primary" id="confirmAction">添加</button></div></div>`;
  document.body.append(sheet);
  const close = () => sheet.remove();
  sheet.querySelector('[data-cancel-action]').onclick = close;
  sheet.onclick = event => { if (event.target === sheet) close(); };
  sheet.querySelector('#confirmAction').onclick = () => {
    try {
      addAction(object, {
        clip: sheet.querySelector('#actionClip').value,
        start: Number(sheet.querySelector('#actionStart').value),
        duration: Number(sheet.querySelector('#actionDuration').value),
      });
      markDirty();
      close();
      state.previzStage?.render(previz.time, state.previzOverride);
      renderPrevizTimeline();
      toast('已添加动作');
    } catch (error) { toast(error.message); }
  };
}

/* ---------------- 离线素材库 ---------------- */

async function renderPrevizLibrary(body) {
  const manifest = await loadManifest();
  const groups = [
    ['all', '全部'], ['character', '角色'], ['animal', '动物'], ['furniture', '道具'],
    ['environment', '场景'], ['building', '建筑'], ['geometry', '几何'],
  ];
  const stateLib = {category: 'character', search: ''};
  const paint = () => {
    const tabs = $('#assetTabs');
    const grid = $('#assetGrid');
    if (!tabs || !grid) return;
    tabs.innerHTML = groups.map(([id, label]) => `<button data-asset-cat="${id}" class="${id === stateLib.category ? 'on' : ''}">${label}</button>`).join('');
    tabs.querySelectorAll('[data-asset-cat]').forEach(button => {
      button.onclick = () => { stateLib.category = button.dataset.assetCat; paint(); };
    });
    const keyword = stateLib.search.trim().toLowerCase();
    const items = manifest.filter(item => (stateLib.category === 'all' || item.category === stateLib.category) && (!keyword || item.name.toLowerCase().includes(keyword)));
    grid.innerHTML = items.length ? items.map(item => `<button class="lib-card" data-lib-add="${esc(item.id)}" title="加入舞台：${esc(item.name)}">
      <img src="/assets/${esc(item.thumbnail || '')}" alt="" loading="lazy">
      <span>${esc(item.name)}</span>
    </button>`).join('') : '<p class="sub" style="font-size:12px">没有匹配的素材</p>';
    grid.querySelectorAll('[data-lib-add]').forEach(card => {
      card.onclick = () => addLibraryModel(manifest.find(item => item.id === card.dataset.libAdd), body);
    });
  };
  const search = $('#assetSearch');
  if (search) search.oninput = () => { stateLib.search = search.value; paint(); };
  paint();
}

function addLibraryModel(entry, body) {
  if (!entry) return;
  const animations = entry.animations || [];
  const object = {
    id: crypto.randomUUID(), type: 'model', name: entry.name,
    position: [0, 0, 0], target: [0, 1, 0], rotation: 0, scale: 1, fov: 45,
    color: '#cfd4d9', pose: 'stand', keys: [], actions: [],
    modelSrc: '/assets/' + entry.file, modelSize: entry.modelSize || 1.8,
    modelKind: 'scene', modelColorMode: 'original', modelClip: animations[0]?.name || '',
  };
  state.project.objects.push(object);
  previz.selected = object.id;
  markDirty();
  renderPreviz(body);
  toast(`已加入：${entry.name}`);
}

/* ---------------- 占位阶段 ---------------- */

/* ---------------- 占位阶段 ---------------- */

const PLACEHOLDERS = {
  assets: {
    title: '资产',
    body: '角色、场景、道具的提示词与定稿图。生成资产图会先报价、再确认，结果进入版本与引用。',
    note: '阶段 2 接入：资产卡、版本、被引用镜头、批量生成。',
    icon: ICONS.assets,
  },
  previz: {
    title: '预演',
    body: '表演和机位分两层：AI 根据剧本与分镜生成整段表演（动作、走位、朝向），机位由你自己摆放——可以摆十几个、二十几个机位把整段拍下来。助手不会移动你的摄影机。',
    note: '阶段 3 接入：表演时间轴、机位列表、多机位录制。',
    icon: ICONS.previz,
  },
  generate: {
    title: '生成',
    body: '逐镜生成首尾帧，然后走两条路线：首尾帧图生视频，或预演视频 + 资产图 + 提示词生视频。报价、任务、采用都在同一页。',
    note: '阶段 2 接入：生成工单、费用确认、结果版本。',
    icon: ICONS.generate,
  },
  cut: {
    title: '剪辑',
    body: '把采用的镜头按顺序放进时间轴，加字幕与声音，导出成片。',
    note: '阶段 4 接入：时间轴、替换版本、导出。',
    icon: ICONS.cut,
  },
};

function renderPlaceholder(body, stage) {
  const info = PLACEHOLDERS[stage];
  body.innerHTML = `
    <div class="placeholder">
      <div class="icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${info.icon}</svg></div>
      <h2>${info.title}</h2>
      <p>${info.body}</p>
      <p class="note">${info.note}</p>
      ${stage === 'previz' ? '<p class="note" style="margin-top:8px">当前表演引擎已完成：动作库重定向 + 剧情→节拍编排（v1.23），界面在阶段 3 接上。</p>' : ''}
    </div>`;
}

/* ---------------- 键盘 ---------------- */

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (state.project) openAssistant();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveNow();
    return;
  }
  if (event.key === 'Escape') { closeTopOverlay(); return; }
  if (!state.project || event.metaKey || event.ctrlKey) return;
  if (overlayTop()) return;
  if (/^[1-6]$/.test(event.key) && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
    switchStage(STAGES[Number(event.key) - 1][0]);
  }
});

setAskWidth(askWidth());
window.__pipelineFlushSave = async () => {
  const frame = document.querySelector('#embedFrame');
  const embedded = ['previz', 'generate', 'cut'].includes(state.stage) && frame?.contentWindow;
  if (embedded) {
    try {
      const doc = frame.contentWindow.document;
      doc.querySelector('#saveBtn')?.click();
      // 等旧应用完成自己的保存（最长 3 秒），再让父页面重读，绝不写回旧状态
      for (let i = 0; i < 30; i++) {
        const text = doc.querySelector('#saveStatus')?.textContent || '';
        if (/已保存|项目已打开/.test(text) && !/保存中/.test(text)) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch {}
    await refreshProjectFromLibrary();
    return {ok: true};
  }
  for (let i = 0; i < 40 && state.saving; i++) await new Promise(resolve => setTimeout(resolve, 50));
  return {ok: await saveNow()};
};
if (window.directorDesktop?.onSaveRequest) {
  window.directorDesktop.onSaveRequest(async () => { await saveNow(); return {ok: true}; });
}
if (window.directorDesktop?.onCommand) {
  window.directorDesktop.onCommand(command => {
    if (command === 'save') saveNow();
    else if (command === 'project') { location.hash = ''; renderPicker(); }
  });
}
boot().catch(error => {
  document.body.innerHTML = `<div style="padding:40px;font:14px -apple-system"><h2>界面启动失败</h2><p>${esc(error.message)}</p></div>`;
});
