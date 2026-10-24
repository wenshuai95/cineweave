// 迁移期 toast 翻译桥：先覆盖高频短句，后续逐步改为 t() key。
import {getLocale} from './index.mjs';

const EN = {
  '请拖到 V1 / A1 轨道上松开': 'Drop on the V1 / A1 track.',
  '视频轨只能放视频素材': 'The video track only accepts video.',
  '音轨只能放音频素材': 'The audio track only accepts audio.',
  '当前剧本和分镜已存为版本': 'Current script and storyboard saved as a version.',
  '请先填写或生成剧本': 'Write or generate a script first.',
  '已取消本次请求': 'This request was cancelled.',
  '已采用候选结果并更新画布': 'Candidate adopted and canvas updated.',
  '已恢复': 'Restored',
  '已保存版本': 'Version saved',
  '没有待恢复的任务': 'No task to restore.',
  '任务已完成，请切回原工程后恢复任务以加入画布': 'Task finished. Return to the original project to add it to the canvas.',
  '已导入': 'Imported',

  '火山方舟账户余额不足或已欠费，请先充值后再生成': 'Volcengine Ark account is overdue or out of balance. Top up before generating.',
  'Seedream API Key 无效或无权限': 'Seedream API key is invalid or unauthorized.',
  '当前账号未开通该 Seedream 模型，请到火山方舟控制台开通': 'This Seedream model is not enabled for the account. Enable it in the Ark console.',
  'Seedream 额度已用完或触发限流，请调整安心体验模式或稍后重试': 'Seedream quota or rate limit reached. Adjust Safe Experience mode or retry later.',
  '请先在设置中填写 Seedream API Key': 'Enter a Seedream API key in Settings first.',
  '报价已过期，请重新获取': 'Quote expired. Request a new quote.',
  'Seedream 没有返回图片地址': 'Seedream returned no image URL.',
  '任务尚未完成': 'Task is not finished yet.',
  '任务不存在': 'Task not found.',
  '本地服务请求失败': 'Local service request failed.',
  '本机服务响应超时，请先在任务中心核对生成记录，再手动重试': 'Local service timed out. Check Tasks for existing records before retrying.',
  '本机服务连接中断，请重新打开软件后核对任务记录': 'Local service disconnected. Reopen the app and check task records.',
  '三维渲染器不可用': '3D renderer is unavailable',
  '项目操作失败，请重试': 'Project operation failed. Try again.',
  '请输入项目名称': 'Enter a project name.',
  '请先填写图片描述': 'Enter an image description first.',
  '请先填写画面描述': 'Enter a scene description first.',
  '请填写有效导出区间': 'Enter a valid export range.',
  '请至少选择一个需要简化的人物': 'Select at least one character to simplify.',
  '请选择有效模型、尺寸和画幅': 'Choose a valid model, size and aspect.',
  '描述需为 1–6000 字符': 'Description must be 1–6000 characters.',
  '请选择 Seedream 模型': 'Choose a Seedream model.',
  '提示词不能为空': 'Prompt cannot be empty.',
  '提示词不能超过 6000 字符': 'Prompt cannot exceed 6000 characters.',
  '不支持的尺寸': 'Unsupported size.',
  'API Key 格式无效': 'Invalid API key format.',
  '模型 ID 格式无效': 'Invalid model ID format.',

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
  [/^已导入 (\d+) 个素材(?:，.*)?$/, m => `Imported ${m[1]} media item(s).`],
  [/^已把「(.+)」放到(V1|A1)$/, m => `Placed “${m[1]}” on ${m[2]}.`],
  [/^已将 (\d+) 个模型加入导演台.*$/, m => `Added ${m[1]} models to the Director.`],
  [/^已把 (\d+) 个节点编组.*$/, m => `Grouped ${m[1]} nodes.`],
  [/^已恢复「(.+)」；恢复前内容已自动保存。$/, m => `Restored “${m[1]}”; the previous content was saved.`],
  [/^已选中 (\d+) 字；.*$/, m => `Selected ${m[1]} characters.`],
  [/^已导入 (\d+) 个素材，点.*$/, m => `Imported ${m[1]} media items; use + or drag to a track.`],

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
