// 节点工具栏：动作清单与 HTML。
import { toolIcon } from './canvas-icons.mjs';

export function nodeToolActions(type) {
  return {
    image: ['智能改图', '局部重绘', '扩图', '抠图', '预设', '工具', '智能超清', '修脸', '智能打光', '版本', '下载'],
    video: ['视频修剪', '截取帧', '分离音频', '视频超分', '版本', '下载'],
    audio: ['生成配音', '音色库', '裁剪音频', '版本', '下载'],
    text: ['复制', '删除'],
    stage: ['打开导演台'],
    timeline: ['打开时间线'],
  }[type] || ['下载'];
}

export function nodeToolsHtml(node) {
  return nodeToolActions(node?.type).map((label) => {
    const icon = toolIcon(label);
    return `<button data-tool="${label}" title="${label}">${icon ? `<span class="cv-tool-icon">${icon}</span>` : ''}${label}</button>`;
  }).join('<span class="cv-tool-sep"></span>');
}

export function multiToolLabels(inGroup) {
  return [inGroup ? '解组' : '编组', '堆叠', '布局', '下载'];
}

export function multiToolsHtml(labels) {
  return labels.map((label) => `<button data-tool="${label}">${label}</button>`).join('<span class="cv-tool-sep"></span>');
}
