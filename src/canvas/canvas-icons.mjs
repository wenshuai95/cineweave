// 画布图标与类型/状态文案：纯函数/SVG 常量。

export const ICONS = {
  text: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3h10M8 3v10M5.5 13h5"/></svg>',
  image: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/><circle cx="6" cy="6" r="1.2"/><path d="M3 12l3.2-3.4 2.3 2.2L11 7.5l2 2.2"/></svg>',
  video: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="3.5" width="8" height="9" rx="2"/><path d="M10.5 7l3-1.8v5.6l-3-1.8"/></svg>',
  audio: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 10v-4M6 12V4M9 10.5v-5M12 13V3"/></svg>',
  stage: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2l5.5 3.2v5.6L8 14l-5.5-3.2V5.2L8 2z"/><path d="M8 2v6M8 8l5.5 3.2M8 8l-5.5 3.2"/></svg>',
  timeline: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="3" width="11" height="10" rx="2"/><path d="M2.5 6.5h11M6 6.5V13"/></svg>',
  upload: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 11V3.5M5 6.5L8 3.5l3 3M3 12.5h10"/></svg>',
  assets: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 5.5h5l1.2 1.5H14v6H2z"/><path d="M2 5.5V3.5h4"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 3L5 8l5 5"/></svg>',
  send: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12.5V3.5M4 7l4-4 4 4"/></svg>',
};

export function toolIcon(label) {
  const icons = {
    智能改图: '<svg viewBox="0 0 16 16"><path d="M8 2l1.2 3.1L12 6.3 9.2 7.5 8 10.6 6.8 7.5 4 6.3l2.8-1.2z"/><path d="M12.2 10.5l.7 1.7 1.6.6-1.6.6-.7 1.7-.6-1.7-1.7-.6 1.7-.6z"/></svg>',
    局部重绘: '<svg viewBox="0 0 16 16"><path d="M3 13l1.2-3.5L11 2.7a1.4 1.4 0 012 2L6.2 11.5z"/><path d="M9.8 4l2.2 2.2"/></svg>',
    扩图: '<svg viewBox="0 0 16 16"><path d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3"/></svg>',
    抠图: '<svg viewBox="0 0 16 16"><circle cx="4" cy="4" r="2"/><circle cx="4" cy="12" r="2"/><path d="M5.6 5.4L13 12M5.6 10.6L13 4"/></svg>',
    预设: '<svg viewBox="0 0 16 16"><rect x="3" y="3" width="4" height="4" rx="1"/><rect x="9" y="3" width="4" height="4" rx="1"/><rect x="3" y="9" width="4" height="4" rx="1"/><rect x="9" y="9" width="4" height="4" rx="1"/></svg>',
    工具: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2"/><path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2M4.1 4.1l1.4 1.4M10.5 10.5l1.4 1.4M11.9 4.1l-1.4 1.4M5.5 10.5l-1.4 1.4"/></svg>',
    智能超清: '<svg viewBox="0 0 16 16"><path d="M8 12V4M5 7l3-3 3 3"/><path d="M3 13h10"/></svg>',
    修脸: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/><path d="M5.8 6.3h.01M10.2 6.3h.01M5.8 9.6c.6.9 1.4 1.4 2.2 1.4s1.6-.5 2.2-1.4"/></svg>',
    智能打光: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.4"/><path d="M8 2v1.6M8 12.4V14M2 8h1.6M12.4 8H14M3.8 3.8l1.1 1.1M11.1 11.1l1.1 1.1M12.2 3.8l-1.1 1.1M4.9 11.1l-1.1 1.1"/></svg>',
    版本: '<svg viewBox="0 0 16 16"><path d="M8 2.8L13 5.6 8 8.4 3 5.6z"/><path d="M3 8.2l5 2.8 5-2.8"/><path d="M3 10.8l5 2.8 5-2.8"/></svg>',
    下载: '<svg viewBox="0 0 16 16"><path d="M8 3v8M5 8.5l3 3 3-3M3 13h10"/></svg>',
    视频修剪: '<svg viewBox="0 0 16 16"><circle cx="4" cy="4" r="1.8"/><circle cx="4" cy="12" r="1.8"/><path d="M5.5 5.2L13 12M5.5 10.8L13 4"/></svg>',
    截取帧: '<svg viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="9" rx="1.5"/><path d="M2.5 8h11M8 3.5v9"/></svg>',
    分离音频: '<svg viewBox="0 0 16 16"><path d="M6 12V4l6-1.4v7.6"/><circle cx="4.4" cy="12" r="1.6"/><circle cx="10.4" cy="10.2" r="1.6"/></svg>',
    生成配音: '<svg viewBox="0 0 16 16"><rect x="6" y="2.5" width="4" height="7" rx="2"/><path d="M4 8.5a4 4 0 008 0M8 12.5V14"/></svg>',
    音色库: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="1.3"/></svg>',
    裁剪音频: '<svg viewBox="0 0 16 16"><path d="M3 8h10M5 5v6M11 5v6"/></svg>',
    复制: '<svg viewBox="0 0 16 16"><rect x="5" y="3" width="8" height="8" rx="1.5"/><path d="M3 5v8h8"/></svg>',
    删除: '<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  };
  return icons[label] || '';
}

export function typeLabel(type) {
  return { text: '文本', image: '图片', video: '视频', audio: '音频', stage: '导演台', timeline: '时间线' }[type] || type;
}

export function statusLabel(status) {
  return { empty: '未生成', running: '生成中', success: '已生成', failed: '失败', canceled: '已取消' }[status] || '';
}
