// 节点工具栏动作分发：只负责判断并调用注入的处理器。
export function createNodeActions(handlers = {}) {
  return async function run(node, tool) {
    if (!node) return false;
    if (tool === '删除') { handlers.remove?.(node); return true; }
    if (tool === '复制') { handlers.copy?.(node); return true; }
    if (tool === '下载') { handlers.download?.(node); return true; }
    if (tool === '版本') { handlers.versions?.(node); return true; }
    if (tool === '生成配音' && node.type === 'audio') { await handlers.audioQuote?.(node); return true; }
    if (tool === '裁剪音频' && node.type === 'audio') { handlers.audioTrim?.(node); return true; }
    if (tool === '智能超清' && node.type === 'image') { await handlers.postProcess?.(node, 'upscale'); return true; }
    if (tool === '修脸' && node.type === 'image') { await handlers.postProcess?.(node, 'detail'); return true; }
    if (tool === '局部重绘' && node.type === 'image') { handlers.maskEditor?.(node); return true; }
    if (tool === '抠图' && node.type === 'image') { await handlers.matte?.(node); return true; }
    if (tool === '智能打光' && node.type === 'image') { handlers.relightMenu?.(node); return true; }
    if (tool === '扩图' && node.type === 'image') { handlers.outpaintMenu?.(node); return true; }
    if (tool === '智能改图' && node.type === 'image') { await handlers.smartEdit?.(node); return true; }
    if (tool === '预设' && node.type === 'image') { handlers.presetMenu?.(node); return true; }
    if (tool === '工具' && node.type === 'image') { handlers.imageToolMenu?.(node); return true; }
    if (tool === '视频修剪' && node.type === 'video') { handlers.videoTrim?.(node); return true; }
    if (tool === '截取帧' && node.type === 'video') { await handlers.extractFrame?.(node); return true; }
    if (tool === '分离音频' && node.type === 'video') { await handlers.extractAudio?.(node); return true; }
    if (tool === '视频超分' && node.type === 'video') { await handlers.relayVSR?.(node); return true; }
    if (tool === '打开时间线' && node.type === 'timeline') { handlers.openTimeline?.(node); return true; }
    if (tool === '打开导演台') { handlers.openStage?.(); return true; }
    handlers.fallback?.(tool);
    return false;
  };
}
