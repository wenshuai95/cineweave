// 生成提交编排：按节点类型/后端分流，并提交 ComfyUI 图片任务。
import { qwenModeNeedsImage } from './generation-catalog.mjs';

export function createGenerationSubmit({
  getNodeById,
  getPrompt,
  setNode,
  render,
  toast = () => {},
  submitJob,
  pollJob,
  probeProviders,
  setSendDisabled = () => {},
  frameRefs,
  comfyImageSize,
  rememberModelParams = () => {},
  startAudioQuote,
  startVideoQuote,
  startComfyVideo,
  startImageQuote,
  findNodeType = () => null,
} = {}) {
  async function generate(node) {
    if (!node) { toast('先选中一个节点'); return false; }
    if (!node.generation) { toast('这个节点没有生成配置'); return false; }
    if (node.type === 'audio') { await startAudioQuote?.(node); return true; }
    if (node.type === 'video') {
      const provider = node.generation?.backend?.provider || 'dreamina';
      if (provider === 'comfyui') await startComfyVideo?.(node);
      else await startVideoQuote?.(node);
      return true;
    }
    if (node.type !== 'image') { toast('这个节点暂不支持生成'); return false; }
    const provider = node.generation?.backend?.provider || 'comfyui';
    if (provider === 'dreamina') {
      const imageRefs = (node.generation?.references || []).map((ref) => getNodeById?.(ref.id)).filter((refNode) => refNode?.type === 'image');
      if (imageRefs.length) { toast('即梦 API 图片暂不支持本地参考图，请切回 ComfyUI'); return false; }
      await startImageQuote?.(node);
      return true;
    }
    const imageWorkflow = node.generation?.imageWorkflow || '';
    rememberModelParams(node);
    const prompt = String(getPrompt?.() || '').trim();
    if (!prompt && imageWorkflow !== 'qwen21-rmbg') { toast('先写提示词'); return false; }
    const frames = frameRefs?.(node) || {};
    if ((node.generation?.references || []).length && !frames.first) {
      toast('参考图节点还没有生成图片');
      return false;
    }
    const imageUrl = frames.first?.resource?.url;
    if (qwenModeNeedsImage(imageWorkflow) && !imageUrl) { toast('先连接一张参考图，再生成 Qwen 编辑/控制模式'); return false; }
    if (frames.last) toast('H3 当前只支持首帧，尾帧会忽略');
    setSendDisabled(true);
    setNode?.(node.id, { status: 'running', progress: 0 });
    render?.();
    try {
      const size = comfyImageSize?.(node) || { width: 1024, height: 1024 };
      const data = await submitJob({
        kind: 'comfyui-image', prompt, width: size.width, height: size.height, imageUrl,
        workflow: node.generation?.imageWorkflow || undefined,
        megapixels: node.generation?.imageWorkflow?.startsWith('qwen21-') ? 1 : undefined,
        refMode: imageUrl ? (node.generation?.refMode || 'i2i') : undefined,
      });
      toast('已提交 ComfyUI');
      await pollJob?.(data.id, node.id);
      return true;
    } catch (error) {
      setNode?.(node.id, { status: 'failed', error: error.message || String(error) });
      render?.();
      toast(error.message || String(error), true);
      return false;
    } finally {
      setSendDisabled(false);
      probeProviders?.();
    }
  }

  return { generate };
}
