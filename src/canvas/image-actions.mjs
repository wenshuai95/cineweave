// 图片工具动作：扩图 / 打光 / 抠图 / 超清 / 修脸。
export function createImageActions({
  submitJob,
  pollJob,
  setNode,
  toast = () => {},
  getPrompt = () => '',
  translate = async (text) => text,
} = {}) {
  async function run(node, payload, runningPatch, successMessage) {
    const media = node?.resources?.[0];
    if (!media?.url) { toast('先生成一张图片'); return false; }
    setNode(node.id, { status: 'running', progress: 0, jobMessage: runningPatch });
    try {
      const data = await submitJob({ ...payload, imageUrl: media.url });
      toast(successMessage);
      pollJob(data.id, node.id);
      return true;
    } catch (error) {
      setNode(node.id, { status: 'failed', error: error.message || String(error) });
      toast(error.message || String(error), true);
      return false;
    }
  }

  function outcrop(node, direction) {
    return run(node, {
      kind: 'comfyui-outpaint', direction, pixels: 256,
      prompt: getPrompt() || node.generation?.prompt || '',
    }, '扩图中…', '已提交扩图');
  }

  async function relight(node, variant) {
    const media = node?.resources?.[0];
    if (!media?.url) { toast('先生成一张图片'); return false; }
    let lightPrompt = getPrompt();
    if (lightPrompt) {
      try { lightPrompt = await translate(lightPrompt); } catch { /* 翻译失败就用原文 */ }
    }
    return run(node, { kind: 'comfyui-relight', prompt: lightPrompt, variant }, variant === 'light' ? '轻补光中…' : '重打光中…', '已提交智能打光任务');
  }

  function matte(node) {
    return run(node, { kind: 'comfyui-matte' }, '抠图中…', '已提交抠图任务');
  }

  function postProcess(node, mode) {
    const isUpscale = mode === 'upscale';
    return run(node, {
      kind: isUpscale ? 'comfyui-upscale' : 'comfyui-detail',
      prompt: node.generation?.prompt || '',
      upscaleBy: 1.5,
      denoise: 0.4,
    }, isUpscale ? '放大中…' : '修脸中…', isUpscale ? '已提交放大任务' : '已提交修脸任务');
  }

  function relightMenu(node, showMenu) {
    if (!node?.resources?.[0]?.url) { toast('先生成一张图片'); return; }
    showMenu?.([
      ['强打光（白底重打光）', () => relight(node, 'fg')],
      ['轻补光（保留背景）', () => relight(node, 'light')],
    ], 420, 300);
  }

  function outpaintMenu(node, showMenu) {
    if (!node?.resources?.[0]?.url) { toast('先生成一张图片'); return; }
    showMenu?.(['左', '上', '右', '下'].map((label) => [`向${label}扩图`, () => outcrop(node, { 左: 'left', 上: 'top', 右: 'right', 下: 'bottom' }[label])]), 420, 300);
  }

  return { outcrop, relight, matte, postProcess, relightMenu, outpaintMenu };
}
