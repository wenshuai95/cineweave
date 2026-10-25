# 造梦工坊 v1.29.0 交付验收

日期：2026-10-25
版本：1.29.0
主题：画布同构 A1/A2/A4 + 剪辑/素材库 B1/B2

## 一、本版范围

### 画布 A1 壳层
- 顶栏完全透明，点阵从 y=0 开始；仅两个悬浮胶囊：标题 **287×36**（项目名/节点数/已保存，blur80）、右侧控制组 **264×36**（blur40）
- 左创建 dock **48×444**、底部导航 dock **164×36**、右下 AI **120×36**

### 画布 A2 节点
- 文本/音频 **243.8×243.8**，图片/视频 **433.4×243.8**
- 外部标签 13px / rgba(255,255,255,.35) / top -32；空节点图标/结果铺满/失败原因保留
- handle 命中区约 **42×85**；连线 **rgb(0,142,229) 1px** 贝塞尔

### 画布 A4 生成卡
- 空节点选中：生成卡 **680×206**，距节点底 **80**，圆角20、blur24
- 结果图片选中：节点上方 12 项编辑工具栏，不显示生成卡
- 删除固定屏幕底部大卡；多参考/历史/失败/停止保留

### 剪辑 B1 / B2
- V1/A1、视频/音频/图片导入、拖动、裁切、分割、删除/闭合、吸附
- J/K/L、空格播放、←/→、Home/End、I/O、⌘K/S 分割、⌘Z/⌘⇧Z、F、+/-
- inspector 位置/入出点/音量/静音；保存/恢复；导出 MP4（文件/画布）
- 素材库：缩略图/名称/时长/来源、搜索/筛选、预览、拖入/双击、删除、缺失恢复

## 二、验证结果

### 测试与构建
- `npm test`：**625 tests / 616 pass / 0 fail / 9 skipped**
- `npm run build`：成功
- `npm run package:mac`：成功（macOS arm64）

### 画布真机验收（Electron 临时数据）
- 1440：board y=0；topbar 背景透明、无底边线；标题 287×36、控制组 264×36、仅 2 个胶囊
- 1024：innerWidth=1024、scrollWidth=1024；title 240×36
- 生成卡 680×206、gap80、圆角20、blur24；结果图工具栏位于节点上方
- 节点拖动 +50/+30、Delete、⌘Z、保存全部通过
- 截图：`/tmp/cineweave-canvas/topbar-final3-1440.png`、`topbar-final2-1024.png`、`03-composer-1440.png`、`04-result-toolbar-1440.png`、`02-nodes-1440.png`、`06-edges-1440.png`

### 剪辑/素材库真机验收（Electron 临时数据）
- 导入 4 个素材（2 视频/1 音频/1 图片）→ 双击/拖入 → 裁切（out 3.0s→2.791667s）→ ⌘K 分割 → Delete → ⌘Z → I/O → J/K/L/缩放 → 重新加载恢复
- 实际导出到画布：720p/24fps/2.0s 完成并生成画布视频节点
- 图片筛选/预览、图片删除+撤销、素材缺失恢复（重载后选择原文件）均通过
- 截图：`/tmp/cineweave-edit/b1-final-1440.png`、`b1b2-final-1024.png`、`b2-library-recovered-1440.png`、`b1-trim-clean2-1440.png`、`b1-export-result3-1440.png`

### 安装与健康检查
- 安装路径：`/Applications/造梦工坊.app`
- `CFBundleShortVersionString` → `1.29.0`
- `codesign --verify --deep --strict` → 通过
- 临时数据目录启动，`GET /api/health` 返回 1.29.0
- 未改写用户工程数据

## 三、文档

- [ZCode 缺陷报告](ZCODE-BUG-REPORT-1.28.1.md)
- [即梦交互规格](JIMENG-INTERACTION-SPEC.md)
- [画布/剪辑计划](CANVAS-EDIT-PLAN.md)
- [真实客户端逆向记录](JIMENG-LOCAL-APP-REVERSE.md)
- `docs/jimeng-parity/05–13` 真实客户端截图、DOM/CSS 附件

## 四、已知限制

1. Seedance 2.5 视频/音频参考 URL 托管仍未打通；真实付费调用未在发布流程执行。
2. H3 仍仅接口，未安装模型。
3. 此前保存失败未落库的工程无法恢复；1.28.1 起已修复重试与诊断。
4. 生成卡内多参考/历史内容在 206px 高度内滚动查看。
5. 其余沿用 1.28.x 限制（ffmpeg 依赖、Windows 暂停等）。

## 五、发布产物

- DMG：`work/造梦工坊-v1.29.0-AppleSilicon.dmg`
- 大小：199 MB
- SHA-256：`6ceffb70263a4b85b02f3dea36a94fc1a183bc95ca7810d57c8bbcf657bf11b9`
- DMG 挂载：版本 1.29.0，codesign 通过，可正常挂载/卸载

## 六、CI

- GitHub Actions `.github/workflows/ci.yml`：push 后执行 `npm ci`、`npm test`、`npm run build`；结果以 push 后 CI 运行记录为准。
