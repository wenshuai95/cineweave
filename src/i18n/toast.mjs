// 迁移期 toast 翻译桥：先覆盖高频短句，后续逐步改为 t() key。
import {getLocale} from './index.mjs';

const EN = {
  '对象已锁定': 'Object is locked',
  '画布节点已达上限，请先移除不需要的节点': 'Canvas node limit reached. Remove some nodes first.',
  '画布节点已达上限': 'Canvas node limit reached',
  '三维渲染器不可用': '3D renderer is unavailable',
  '已保存当前布局为「我的布局」': 'Saved current layout as “My layout”',
  '已应用「我的布局」': 'Applied “My layout”',
  '面板布局已恢复默认': 'Panel layout reset to default',
  '已应用布局预设': 'Layout preset applied',
  '等距分布需要至少 3 个节点': 'Even spacing needs at least 3 nodes',
  '对齐需要至少 2 个节点': 'Alignment needs at least 2 nodes',
  '场景对象已达 300 个': 'Scene object limit (300) reached',
  '镜头组已包含这些节点；要重新编组，请先解开镜头组': 'Shot group already contains these nodes; ungroup it before regrouping.',
  '镜头参考包已下载': 'Shot reference pack downloaded',
  '连线已断开；导演台中已有的对象保留': 'Connection cut; existing director objects are kept.',
  '这个镜头还没有可送入剪辑的视频': 'This shot has no video to send to Edit yet.',
  '这个操作暂时不可用': 'This action is temporarily unavailable.',
  '还没有复制的画布节点': 'No canvas nodes copied yet.',
  '还没有保存过「我的布局」': 'No saved “My layout” yet.',
  '请选择要设为正式图的资产': 'Choose an asset to set as the official image.',
  '请选择要加入的资产': 'Choose an asset to add.',
  '请输入范围内的时间和参数值': 'Enter a time and value within range.',
  '请输入 -1000 至 1000 的数值': 'Enter a value from -1000 to 1000.',
  '请至少选择一个需要简化的人物': 'Select at least one character to simplify.',
  '请等待当前操作完成': 'Wait for the current operation to finish.',
  '请填写有效导出区间': 'Enter a valid export range.',
  '请先选择要送入画布的条目': 'Choose an item to send to the canvas first.',
  '请先选择要聚焦的节点（Shift+2）': 'Select a node to focus first (Shift+2).',
  '已保存到本机': 'Saved locally',
  '保存失败，请重试或导出工程备份': 'Save failed. Try again or export a project backup.',
  '任务正在跟进': 'Task is already being tracked.',
  '任务已完成，请切回原工程后恢复任务以加入画布': 'Task finished. Return to the original project to add it to the canvas.',
  '该图片已在画布中': 'This image is already on the canvas.',
  '生成图片读取失败': 'Failed to read the generated image.',
  '已取消': 'Cancelled',
  '录制已取消': 'Recording cancelled',
};

const PATTERNS = [
  [/^已保存到本机$/, () => 'Saved locally'],
  [/^已将 (\d+) 个模型加入导演台，并在画布创建预演节点；可撤销$/, m => `Added ${m[1]} models to the director and created a previz node; undo is available.`],
  [/^已把 (\d+) 个节点编组/, m => `Grouped ${m[1]} nodes`],
  [/^已加入「(.+)」的资产版本/, m => `Added an asset version to “${m[1]}”`],
];

export function translateToast(message) {
  if (getLocale() !== 'en-US' || typeof message !== 'string') return message;
  if (EN[message]) return EN[message];
  for (const [re, fn] of PATTERNS) {
    const match = message.match(re);
    if (match) return fn(match);
  }
  return message;
}
