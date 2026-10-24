# Changelog

## v1.21.0 (2026-10-23)

- 首次开源：画布 + 剪辑经典版源码
- 许可证：AGPL-3.0 + 商业授权（`COMMERCIAL-LICENSE.md`）
- 离线 CC0 资产单独发布（GitHub Release `assets-cc0.zip`）
- 清理个人路径与本地配置，仓库不含 API Key / oiioii CLI

## Unreleased · Sprint 6

- Kling 视频骨架：JWT 鉴权、任务提交/轮询/下载，默认 feature flag 关闭
- 任务中心新增 Provider 视频任务列表（Fake/Seedance/Kling）
- 默认关闭，不产生任何 Kling 费用
- Kling 设置页：Key/启用开关，Electron safeStorage 加密；浏览器模式 0600 回退
- safeStorage 运行时桥接已接入；打包后需在 Electron 环境做一次最终验收

## Unreleased · Sprint 5

- 视频 Provider 抽象：Fake 视频全链路 + Seedance 骨架（feature flag 默认关闭）
- 统一 `/api/video` 路由与任务下载
- 画布「Video」入口：Provider/模型/时长/提示词生成并加入画布
- Fake 视频 UI 全链路验证；Seedance 默认不产生费用

## Unreleased · Sprint 4

- ComfyUI 本地生图：探测、checkpoint 列表、SDXL 工作流、轮询、下载
- 画布「ComfyUI」入口：本地生成免费，自动加入画布
- 设置 → API 新增 ComfyUI 地址检测/保存
- 任务存储支持厂商 remoteId

## Unreleased · Sprint 2

- 支持 Agent Plan 模式：`/api/plan/v3` + `doubao-seedream-5.0-flash/pro`，套餐内额度直接生图
- 修复 Seedream provider 传入 `planMode` 时 base URL 仍走 `/api/v3` 的问题

- Seedream（即梦/方舟）图片适配器：模型、报价、生成、下载、错误码
- Provider 服务：密钥本机 0600 存储、配置接口、任务记录
- 软件内「Seedream 生图」：画布节点入口、模型/尺寸、报价确认、结果入画布
- 设置页新增 Seedream API Key 配置与模型测试
- 账号欠费返回 PAYMENT_REQUIRED，不再误报 Key 无效
