# 即梦画布研究台账

画布：`造梦工坊 · 即梦对标研究`
projectId：`b02f4b43-8bfc-46e1-b36d-c3c5a13356b4`
账号：VIP / 高阶会员
预算：500 积分

## 已执行

| 项目 | 模型 | 参数 | 结果 | 记录积分 |
|---|---|---|---|---:|
| 图片 | Seedream 5.0 Lite | t2i / 2K / 16:9 / 1 张 | 成功，2560×1440 | 0 |
| 视频 | Seedance 2.5 | t2v / 5s / 480p / 16:9 | 失败，serviceCode 20115 | 60（记录） |
| 视频 | Seedance 2.5 | m2v / 5s / 480p / 16:9 / 图片参考 | 成功 | 60 |
| 视频 | Seedance 2.5 | m2v / 5s / 480p / 图片+视频参考 | 成功 | 90 |
| 节点 | 文本/图片/视频/音频 | 创建 | 全部成功 | 0 |

**记录累计：约 210 / 500 积分。**

## 观测

- 图片生成报价为 0，账号可能包含免费额度/活动额度。
- t2v 失败仍然在资源的 `creditsAmount` 记录 60；未在本轮核对实际余额扣减。
- m2v 成功，说明图片参考视频链路可用。
- 失败节点在 UI 卡内显示失败原因与“重新生成”。
- 成功视频节点直接显示视频画面和播放按钮；类型标签浮在节点外。
- 空节点仅有深灰卡片 + 类型图标。
- 左侧竖排工具、底部**导航 dock**（选择工具/小地图/显示连线/缩放）与右下“与 AI 对话”是画布壳层。
- 生成卡贴在选中空节点下方（680×206），不是屏幕底部。
- 已生成图片选中后显示顶部编辑工具栏，不显示生成卡。
- 双击创建菜单 200×444，右键菜单 200×372。
- 2.5 已实测图片+视频混合参考成功（90 积分）。

## 截图

- `docs/jimeng-parity/01-empty-canvas.png`
- `docs/jimeng-parity/02-node-anatomy.png`
- `docs/jimeng-parity/03-video-result.png`
- `docs/jimeng-parity/04-video-failed.png`
- `docs/jimeng-parity/05-local-app-canvas.png` 真实客户端画布
- `docs/jimeng-parity/08-node-attached-composer.png` 节点生成卡
- `docs/jimeng-parity/09-create-menu.png` 创建菜单
- `docs/jimeng-parity/10-video-composer.png` 视频生成卡
- `docs/jimeng-parity/12-context-menu.png` 右键菜单
- `docs/jimeng-parity/13-marquee-select.png` 框选多选

## 未覆盖

- 连线真实拖拽建立/断线（React Flow 指针捕获，CDP 合成拖拽未稳定复现）
- 音频参考生成
- 长视频与多人参考
- 实际积分余额对账
- 生成中/停止/失败重试的完整卡内状态

## 结论

即梦的关键不是功能数量，而是：**轻壳层、节点即内容、类型外置、工具按需出现、失败才显示错误。**
