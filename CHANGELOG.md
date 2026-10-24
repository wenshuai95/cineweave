## 1.23.2

- 统一生成面板结果卡（预览/服务商/模型/任务号）
- 阶段“生成”未选节点时直接打开生成面板
- 删除旧 ComfyUI/Seedream 独立弹窗代码
- v1.23.2 安装验证

## 1.23.1

- Phase 2 起步：统一生成面板（图片/视频）
- 服务商、模型、尺寸/时长、参考状态、费用、提交、结果入画布
- 图片：ComfyUI / Seedream；视频：Provider
- v1.23.1 安装验证

## 1.23.0

- Phase 1 完成：旧创作助手/剧本生成页面与文件删除
- 空画布改为“导入剧本 / 新建镜头 / 导入素材”专业起点
- 移除 AI 场景编排、提示词助手、AI 模板与文字模型设置
- 保留剧本参考、手工镜头表、导演台、生成、剪辑

## 1.22.9

- Phase 1 第三批：删除旧创作助手/剧本页面文件与测试
- 移除 AI 场景编排、提示词助手、AI 模板入口
- 保留剧本参考、手工镜头表、导演台、生成与剪辑
- v1.22.9 安装验证

## 1.22.8

- Phase 1 第二批：手工镜头工作表；移除深层创作助手/旧剧本页入口
- 设置移除文字模型区块，API 设置只保留图片/视频 Provider
- 镜头清单编辑改用手工镜头表

## 1.22.7

- Phase 1 起步：移除创作助手顶栏入口，新增六阶段导航（剧本/镜头/资产/预演/生成/剪辑）
- 新建项目支持“导入已有剧本”，剧本仅作参考，不生成
- 移除侧栏“文稿与分镜”工具入口

## 1.22.6

- 修复：启动 ComfyUI 按钮误发 GET 导致“接口不存在”
- 启动按钮改为 POST；连接成功后不再显示误导性的启动提示

## 1.22.5

- 配置向导升级 v2：项目库新增「配置向导」入口
- 向导支持直接启动 ComfyUI（检测到已运行则不重复启动）

## 1.22.4

- 配置向导/设置页新增「启动 ComfyUI」：由应用直接拉起本机 ~/ComfyUI
- 自动定位 .venv Python、等待服务就绪并返回版本
- 检测到已运行时不重复启动

## 1.22.3

- 首次启动配置向导：ComfyUI → 云端生图 → 云端视频 → 完成
- 项目库首屏后自动出现，可跳过；设置→常规可重新运行
- 云端生图/视频状态复用现有 Provider 配置

## 1.22.2

- 彻底移除旧版媒体 CLI：删除图片/视频模块、路由、任务账本、测试与文档引用
- 图片统一 AI 生图（ComfyUI / Seedream），视频统一 Provider
- 源码、测试、文档中旧版媒体 CLI 引用为 0

## 1.22.1

- 修复：画布图片节点“生成图片”不再调用 旧版媒体 CLI CLI
- 图片节点统一为 AI 生图选择器：ComfyUI 本地 / Seedream 云端
- 视频生成入口统一为 Provider 视频；旧版媒体 CLI `/api/旧版媒体 CLI` 已停用（410）

## 1.22.0

- 安装包包含 Sprint 1–6：Provider/i18n/Seedream Agent Plan/ComfyUI/Kling/Fake 视频
- 修复打包缺少 providers 目录、服务端版本号与安装包不一致

# Changelog

## v1.21.0 (2026-10-23)

- 首次开源：画布 + 剪辑经典版源码
- 许可证：AGPL-3.0 + 商业授权（`COMMERCIAL-LICENSE.md`）
- 离线 CC0 资产单独发布（GitHub Release `assets-cc0.zip`）
- 清理个人路径与本地配置，仓库不含 API Key / 旧版媒体 CLI CLI

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
