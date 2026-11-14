// 首次启动的示例画布。
import { createCanvasDocument, addNode, connect } from './document.mjs';

export function seedDocument() {
  let doc = createCanvasDocument({ viewport: { x: 520, y: 300, zoom: 0.8 } });
  doc = addNode(doc, {
    id: 'node_text', type: 'text', title: '剧本 / 镜头说明',
    layout: { x: -480, y: -120, width: 320, height: 320 },
    text: 'INT. 庭院 · 傍晚\n\n男演员穿过庭院，在旧友面前停下。\n镜头缓慢推进。',
  });
  doc = addNode(doc, {
    id: 'node_img', type: 'image', title: '研究 · 图片生成',
    layout: { x: 0, y: 0, width: 569, height: 320 },
    generation: {
      mode: 't2i', prompt: '电影感写实画面：黄昏庭院，一位穿深色夹克的男演员走向旧友，灰白墙面与长桌，自然侧光，克制构图，真实材质。',
      model: '未配置后端', ratio: '16:9', resolution: '2K', outputCount: 1,
    },
  });
  doc = addNode(doc, {
    id: 'node_vid', type: 'video', title: '研究 · 图生视频',
    layout: { x: 700, y: 40, width: 569, height: 320 },
    generation: {
      mode: 'i2v', prompt: '参考 {{node:node_img}} 的构图与人物站位，生成黄昏庭院中两人缓慢对视的电影镜头；镜头轻推，自然侧光，真实材质。',
      model: '未配置后端', ratio: '16:9', resolution: '480P', durationSeconds: 5, outputCount: 1,
    },
  });
  doc = connect(doc, 'node_img', 'node_vid').doc;
  return doc;
}
