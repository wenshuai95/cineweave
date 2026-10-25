# 本地即梦客户端反推记录（REA）

日期：2026-10-25
工具：REA 6.4.0

## 客户端

- 路径：`/Applications/即梦 AI.app`
- 版本：1.0.53
- Bundle ID：`com.dreamina.desktop`
- Electron 37.10.3 / Chrome 138
- `app.asar` 仅 1.6 MB，是 **Electron 壳**；画布前端从 `https://jimeng.jianying.com` 远程加载。
- 画布路由：`/ai-tool/ai-canvas/<projectId>`
- 客户端通过新窗口打开画布。

## REA 取证

```bash
# 启动客户端并开 CDP
env -u ELECTRON_RUN_AS_NODE \
  "/Applications/即梦 AI.app/Contents/MacOS/即梦 AI" \
  --remote-debugging-port=9223

# 列出目标
rea list-browser-targets http://127.0.0.1:9223

# 打开画布（客户端会新建 target）
# 再用 REA 连接新 target，抓 screenshot/dom/accessibility
```

## 真实画布观察

- 顶栏是悬浮透明层：左侧 logo + 项目名 + 节点数 + 已保存；不是实心导航条。
- 左侧创建 dock 悬浮在画布左中，深色半透明圆角。
- 节点无标题栏/类型 badge：
  - 类型标签在节点外上方（`研究 · 图片生成`、`视频 1`、`剧本 / 镜头说明`）。
  - 空节点为深灰渐变卡片 + 类型图标。
  - 结果图/视频铺满卡片。
  - 失败节点卡内显示原因 + `重新生成`。
- 画布是 React Flow（`react-flow__node`），底层点阵。
- 样式大量使用 Tailwind design tokens，核心变量：
  - 背景：`--dreamina-color-bg-body:#121212`
  - 卡片：`--dreamina-color-gray-dark-110:#1a1a1a`
  - 文本：`#fff` / `#ffffffb2` / `#ffffff99`
  - 品牌蓝：`#009efa`
  - 错误：`#f35`
- 关键类名：
  - `workspace-name-*`
  - `canvas-media-node-preview`
  - `canvas-bottom-dock`
  - `canvas-navigation-dock`
  - `dreamina-canvas-navigation-dock`
  - `react-flow__node`

## 产物

- `docs/jimeng-parity/05-local-app-canvas.png` 真实画布截图
- `docs/jimeng-parity/06-local-app-canvas-dom.html` 真实 DOM
- `docs/jimeng-parity/07-canvas-view.css` React Flow 画布 CSS

## 对造梦工坊的要求

1. 顶栏改成透明悬浮层，不再用实心 header。
2. 左侧 dock 改成悬浮圆角，图标/间距按真实画布。
3. 节点外标签、空态、结果铺满、失败态按真实截图逐项对齐。
4. 底部 dock（缩放/选择/抓手）与右侧 AI 入口按真实层级。
5. 用真实 DOM 的类名/尺寸做对照，不再凭印象。
