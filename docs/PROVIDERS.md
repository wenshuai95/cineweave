# Provider 适配器规范（Sprint 1）

所有生图/生视频厂商都实现同一组接口，界面和任务中心只依赖 `id`、`capabilities` 和方法，不出现厂商分支。

## 契约

```js
{
  id, label, enabled,
  capabilities: {
    image: { textToImage, imageToImage, reference, sizes, aspects },
    video: { textToVideo, imageToVideo, firstLastFrame, durations, resolutions }
  },
  listModels(),
  quote(input),
  submit(input),
  poll(taskId),
  cancel(taskId),
  download(taskId, index),
  health()
}
```

- `providers/contracts.mjs`：校验、能力归一化、`ProviderError`
- `providers/registry.mjs`：注册/查找/启用列表
- `providers/task-store.mjs`：统一任务状态机
- `providers/fake.mjs`：本地假提供商（不联网、不花钱）
- `providers/seedream.mjs`：Seedream 骨架（Sprint 1 只做模型列表）

## 任务状态

`queued → running → succeeded | failed | cancelled`

- 终态不可再迁移
- 任务字段：`id/providerId/modelId/kind/projectId/sourceId/prompt/status/progress/outputs/error/cost/createdAt/updatedAt`
- 未开通模型显示为「未启用」，不隐藏、不报错

## Fake Provider

用于 UI 全链路和测试：

- 图片/视频各一个模型
- `quote` 费用 0
- `submit` 创建任务，`poll` 在 `stepMs` 后完成
- `download` 返回本地占位 SVG/MP4 字节
- 不访问网络

## Seedream（Sprint 2）

- **Agent Plan 模式（推荐，套餐内额度）**：Base URL `https://ark.cn-beijing.volces.com/api/plan/v3`，模型 `doubao-seedream-5.0-flash` / `doubao-seedream-5.0-pro`，使用 Agent Plan 专属 Key
- **方舟按量模式**：Base URL `https://ark.cn-beijing.volces.com/api/v3`，动态模型列表，需要方舟余额
- 已实现：模型列表、报价、同步生成、任务查询、下载、健康检查
- 接口：`/api/providers/seedream/models`、`/quote`、`/generate`、`/api/providers/task/:id/file/:index`
- 配置：`POST /api/providers/config`，密钥存本机 `providers.json`（0600），页面不回传明文
- 错误码：`UNAUTHORIZED / MODEL_NOT_OPEN / RATE_LIMITED / PAYMENT_REQUIRED / NETWORK / UPSTREAM`
- 账户欠费会返回 `PAYMENT_REQUIRED`，需要先充值
- 真实测试：Agent Plan 模式已验证可出图并入画布；方舟按量模式需余额
- 本地 ComfyUI 用于免费回归

## 新增一个厂商

1. 新建 `providers/<id>.mjs`
2. 实现契约方法，返回统一任务/输出结构
3. 在注册表注册，`enabled` 由配置/密钥决定
4. 加契约测试：模型列表、参数校验、提交、轮询、失败、取消、下载
5. 未完成的能力在 `capabilities` 中标 `false`，不要假装可用

## 安全

- 密钥不进入工程、日志、仓库
- 仅允许本机回环服务访问
- 错误统一为 `ProviderError(code, message)`


## ComfyUI（Sprint 4，本地免费）

- 默认地址：`http://127.0.0.1:8188`
- 探测：`/system_stats`
- 模型：`/object_info/CheckpointLoaderSimple` → checkpoint 列表（当前 `sd_xl_base_1.0.safetensors`）
- 生成：`POST /prompt`（SDXL 基础工作流：Checkpoint → CLIP → KSampler → VAE → SaveImage）
- 轮询：`GET /history/{prompt_id}`；下载：`GET /view?filename=...`
- 路由：`/api/comfy/status|models|config|quote|generate|tasks|task/:id|task/:id/file/:index`
- 仅允许本机/局域网地址；无云端费用；不占用 Seedream 额度


## 视频 Provider（Sprint 5）

- 统一能力：`textToVideo / imageToVideo / firstLastFrame / durations / resolutions`
- **Fake**：默认启用，免费，生成 2 秒占位 MP4，用于 UI/任务链路回归
- **Seedance**：默认 feature flag 关闭（`ARK_SEEDANCE_ENABLED=1` 才启用）；使用方舟视频任务接口，按量计费
  - `POST /contents/generations/tasks`
  - `GET /contents/generations/tasks/{id}`
  - `DELETE /contents/generations/tasks/{id}`
- 路由：`/api/video/providers|models|health|quote|generate|tasks|task/:provider/:id|task/:provider/:id/file/:index`
- 画布视频节点：Provider → 模型 → 提示词/时长 → 生成 → 加入画布


## Kling（Sprint 6 骨架，默认关闭）

- Base URL：`https://api-beijing.klingai.com`
- 鉴权：AccessKey / SecretKey 生成 HS256 JWT（`iss=ak`, `exp=+30min`）
- 接口：`POST /v1/videos/text2video`、`GET /v1/videos/text2video/{task_id}`
- 启用：`KLING_ENABLED=1`，并设置 `KLING_ACCESS_KEY`、`KLING_SECRET_KEY`
- 默认关闭，不发送请求、不产生费用
- 任务中心新增 Provider 视频任务列表（Fake / Seedance / Kling 共用）

## 密钥安全

- 当前服务端密钥保存在本机数据目录（0600）或环境变量
- Electron `safeStorage` 加密迁移留到打包阶段；不会把密钥写进工程或日志
