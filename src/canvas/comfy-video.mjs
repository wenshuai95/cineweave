// ComfyUI 视频提交：H3 / Wan / LTX / FramePack / Ref2VA / Ultimate。
import { requiresH3Sections, missingH3Sections } from './generation-catalog.mjs';

export const VIDEO_MODELS = ['h3', 'wan22', 'ltx23', 'framepack', 'h3-ref2v', 'h3-ultimate'];

export function comfyVideoSpecs(node) {
  return {
    h3: { width: node.generation?.h3Size === '480P' ? 848 : 640, height: node.generation?.h3Size === '480P' ? 480 : 352, fps: 24, duration: node.generation?.durationSeconds || 5 },
    wan22: { width: 832, height: 480, fps: 16, duration: node.generation?.durationSeconds || 5 },
    ltx23: { width: 640, height: 384, fps: 24, duration: node.generation?.durationSeconds || 2.7 },
    framepack: { width: 608, height: 640, fps: 30, duration: node.generation?.durationSeconds || 3 },
    'h3-ref2v': { width: 640, height: 352, fps: 24, duration: node.generation?.durationSeconds || 5 },
    'h3-ultimate': { width: 640, height: 352, fps: 24, duration: node.generation?.durationSeconds || 5 },
  };
}

export function buildComfyVideoRequest({ node, prompt, model, frames, referenceAssets, imageRefEntries }) {
  const refImages = referenceAssets.filter((item) => item.nodeType === 'image' || item.type === 'image');
  const refVideos = referenceAssets.filter((item) => item.nodeType === 'video' && item.type !== 'image');
  const refAudios = referenceAssets.filter((item) => item.nodeType === 'audio');
  const sourceVideo = refVideos[0]?.url || '';
  const explicitFirst = imageRefEntries.find((entry) => entry.ref.role === '首帧')?.node.resources[0]?.url || '';
  const explicitLast = imageRefEntries.find((entry) => entry.ref.role === '尾帧')?.node.resources[0]?.url || '';
  const spec = comfyVideoSpecs(node)[model];
  return {
    request: {
      kind: 'comfyui-video', prompt, model,
      width: spec.width, height: spec.height, fps: spec.fps,
      duration: spec.duration,
      imageUrl: model === 'h3' || model === 'framepack' ? frames.first?.resource?.url : undefined,
      refImages: model === 'h3-ref2v' ? refImages.slice(0, 9).map((item) => ({ url: item.url, filename: item.id || item.filename })) : undefined,
      refVideos: model === 'h3-ref2v' ? refVideos.slice(0, 3).map((item) => ({ url: item.url, filename: item.id || item.filename })) : undefined,
      refAudios: model === 'h3-ref2v' ? refAudios.slice(0, 3).map((item) => ({ url: item.url, filename: item.id || item.filename })) : undefined,
      firstFrameUrl: model === 'h3-ultimate' ? (explicitFirst || frames.first?.resource?.url || refImages[0]?.url) : undefined,
      lastFrameUrl: model === 'h3-ultimate' ? (explicitLast || undefined) : undefined,
      refImages: model === 'h3-ultimate' && !explicitLast ? refImages.slice(0, 2).map((item) => item.url) : undefined,
      sourceVideoUrl: model === 'h3-ultimate' ? sourceVideo : undefined,
      megapixels: model === 'h3-ultimate' ? (Number(node.generation?.megapixels) > 0 ? Number(node.generation.megapixels) : 0.22) : undefined,
    },
    refImages, refVideos, refAudios, sourceVideo, explicitFirst, explicitLast,
  };
}

export function comfyVideoValidation({ node, model, frames, refImages, refVideos, refAudios, sourceVideo }) {
  if ((model === 'h3' || model === 'framepack') && (node.generation?.references || []).length && !frames.first) return '参考图节点还没有生成图片';
  if (model === 'framepack' && !frames.first?.resource?.url) return 'FramePack 需要先连接一张图片作为首帧';
  if (model === 'h3-ultimate' && !refImages.length && !refVideos.length) return 'H3 Ultimate：先连接首帧/首尾帧/参考图，或源视频';
  if (model === 'h3-ultimate' && !frames.first?.resource?.url && !sourceVideo && refImages.length < 2) return 'H3 Ultimate：首帧、首尾帧、双参考或源视频任选一种';
  if (model === 'h3-ref2v' && !refImages.length && !refVideos.length && !refAudios.length) return 'H3 多模态参考：先连接参考图 / 视频 / 音频节点';
  return '';
}

export function createComfyVideoSubmit({
  getPrompt,
  rememberModelParams = () => {},
  toast = () => {},
  getFrames,
  getReferenceAssets,
  getImageRefEntries,
  setNode,
  render,
  submitJob,
  pollJob,
} = {}) {
  async function start(node) {
    rememberModelParams(node);
    const prompt = String(getPrompt?.() || '').trim();
    if (!prompt) { toast('先写提示词'); return false; }
    const frames = getFrames?.(node) || {};
    const model = VIDEO_MODELS.includes(node.generation?.model) ? node.generation.model : 'h3';
    if (requiresH3Sections(model)) {
      const missing = missingH3Sections(prompt);
      if (missing.length) toast(`H3 提示词建议补齐六段结构（缺：${missing.join('、')}），可点「模板」`, true);
    }
    const referenceAssets = getReferenceAssets?.(node) || [];
    const imageRefEntries = getImageRefEntries?.(node) || [];
    const built = buildComfyVideoRequest({ node, prompt, model, frames, referenceAssets, imageRefEntries });
    const error = comfyVideoValidation({ node, model, frames, refImages: built.refImages, refVideos: built.refVideos, refAudios: built.refAudios, sourceVideo: built.sourceVideo });
    if (error) { toast(error); return false; }
    if (frames.last && model !== 'h3') toast('这个视频模型只使用首帧，尾帧会忽略');
    if (model === 'h3' && frames.last) toast('H3 当前只支持首帧，尾帧会忽略');
    setNode?.(node.id, { status: 'running', progress: 0 });
    render?.();
    try {
      const data = await submitJob(built.request);
      toast('已提交 ComfyUI 视频任务');
      pollJob?.(data.id, node.id);
      return true;
    } catch (submitError) {
      setNode?.(node.id, { status: 'failed', error: submitError.message || String(submitError) });
      render?.();
      toast(submitError.message || String(submitError), true);
      return false;
    }
  }
  return { start };
}
