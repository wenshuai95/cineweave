// 生成坞选中状态视图模型：纯函数，main 只负责写 DOM。
import { typeLabel, statusLabel } from './canvas-icons.mjs';

export function buildDockViewModel({
  node,
  prompt = '',
  modelLabel = '',
  hasImageRefs = false,
  promptHasCJK = false,
  estimate = '',
} = {}) {
  if (!node) return { open: false };
  const generation = node.generation || null;
  const provider = generation?.backend?.provider || (node.type === 'image' ? 'comfyui' : 'dreamina');
  const showLayout = ['image', 'video'].includes(node.type) && Boolean(generation);
  const view = {
    open: true,
    title: node.title || node.type,
    meta: `${typeLabel(node.type)}${generation ? ` · ${generation.mode}` : ''}`,
    state: statusLabel(node.status),
    ratio: generation?.ratio || '16:9',
    showModel: Boolean(generation),
    modelText: `模型：${modelLabel}`,
    showLayout,
    showRes: showLayout,
    showRef: false,
    refText: '',
    showDuration: node.type === 'video',
    durationText: `${generation?.durationSeconds || 5}s`,
    countText: `${generation?.outputCount || 1} 个`,
    showBackend: Boolean(generation && ['image', 'video', 'audio'].includes(node.type)),
    backendText: '',
    backendDisabled: false,
    costText: '',
    costWarn: false,
    sendDisabled: !generation,
  };

  if (node.type === 'video' && provider === 'comfyui') {
    const model = generation?.model || 'h3';
    const labels = {
      wan22: 'Wan 2.2 · 832×480 · 16fps',
      ltx23: 'LTX-2.3 · 640×384 · 24fps',
      framepack: 'FramePack · 首帧 · 30fps',
      'h3-ref2v': 'H3 Ref2VA · 640×352 · 参考生视频',
      'h3-ultimate': 'H3 Ultimate · 640×352 · 0.22MP',
      h3: generation?.h3Size === '480P' ? 'H3 480P · 848×480' : 'H3 360P · 640×352',
    };
    view.resText = labels[model] || labels.h3;
    view.resDisabled = false;
  } else {
    view.resText = generation?.resolution || '分辨率';
    view.resDisabled = !generation;
  }

  if (node.type === 'image' && hasImageRefs && provider !== 'dreamina') {
    const labels = { '': 'i2i', i2i: 'i2i', depth: 'ControlNet 深度', canny: 'ControlNet 线稿', openpose: 'ControlNet 姿态', ipadapter: 'IPAdapter 风格' };
    view.showRef = true;
    view.refText = `参考：${labels[generation?.refMode || ''] || 'i2i'}`;
  }

  if (view.showBackend) {
    if (node.type === 'audio') view.backendText = '生成后端：即梦 API（唯一） ▾';
    else view.backendText = `生成后端：${provider === 'comfyui' ? 'ComfyUI（本地/远程）' : '即梦 API'} ▾`;
  }

  if ((generation?.mode === 't2i' || generation?.mode === 'i2i') && node.type === 'image') {
    if (provider === 'dreamina') view.costText = '即梦 Seedream API · 报价后确认扣积分';
    else {
      view.costText = `${promptHasCJK ? 'ComfyUI（Flux/SDXL）对中文理解弱，建议英文' : 'ComfyUI · 免费'}${estimate ? ` · ${estimate}` : ''}`;
      view.costWarn = promptHasCJK;
    }
  } else if (node.type === 'video') {
    const videoModel = generation?.model || 'h3';
    const labels = { h3: 'H3', wan22: 'Wan 2.2 · 约 5 分钟/5 秒', ltx23: 'LTX-2.3 · 约 2 分钟', framepack: 'FramePack · 长镜头 · 较慢', 'h3-ref2v': 'H3 Ref2VA · 多模态参考 · 约 3 分钟', 'h3-ultimate': 'H3 Ultimate · 0.45 实例 · 约 3–5 分钟' };
    view.costText = provider === 'comfyui'
      ? `ComfyUI 视频 · 免费（${labels[videoModel] || labels.h3} · Windows）${estimate ? ` · ${estimate}` : ''}`
      : '即梦 CLI · 报价后确认扣积分';
  } else if (node.type === 'audio') {
    view.costText = `即梦 TTS${generation?.voiceName ? ` · 音色：${generation.voiceName}` : ''} · 报价后确认扣积分`;
  } else if (generation) {
    view.costText = '这个节点暂未接生成后端';
  } else if (node.type === 'text') {
    view.costText = '文本节点 · 可在左侧工具栏新建图片 / 视频 / 音频节点';
  } else {
    view.costText = '选择节点后显示生成参数';
  }
  return view;
}
