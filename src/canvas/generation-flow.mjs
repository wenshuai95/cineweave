// 即梦报价/提交控制流：不做 DOM，不直接读全局状态。
export function createGenerationFlow({
  requestQuote,
  submitJob,
  pollJob,
  setNode,
  toast = () => {},
  showQuote = () => {},
  buildImagePayload,
  buildVideoPayload,
  buildAudioPayload,
} = {}) {
  let pending = null;

  async function quote(kind, node, prompt, build, label) {
    if (!node) return;
    setNode(node.id, { status: 'running', progress: 0, jobMessage: '报价中…' });
    try {
      const body = build(node, prompt);
      const result = await requestQuote({ kind, ...body });
      pending = { ...result, nodeId: node.id };
      setNode(node.id, { status: 'empty' });
      showQuote(result, label);
      return result;
    } catch (error) {
      setNode(node.id, { status: 'failed', error: error.message || String(error) });
      toast(error.message || String(error), true);
      return null;
    }
  }

  function startImage(node, prompt) {
    return quote('dreamina-image', node, prompt, buildImagePayload, '即梦图片');
  }

  function startVideo(node, prompt) {
    return quote('dreamina-video', node, prompt, buildVideoPayload, '即梦视频');
  }

  function startAudio(node, prompt) {
    return quote('dreamina-audio', node, prompt, buildAudioPayload, '即梦音频');
  }

  async function confirm(confirmed) {
    if (!confirmed || !pending) { pending = null; return false; }
    const current = pending;
    pending = null;
    setNode(current.nodeId, { status: 'running', progress: 0 });
    try {
      const data = await submitJob({ kind: current.kind || 'dreamina-video', quoteId: current.quoteId, creditCeiling: current.credits });
      toast('已提交即梦生成');
      await pollJob(data.id, current.nodeId);
      return true;
    } catch (error) {
      setNode(current.nodeId, { status: 'failed', error: error.message || String(error) });
      toast(error.message || String(error), true);
      return false;
    }
  }

  return { startImage, startVideo, startAudio, confirm, get pending() { return pending; } };
}
