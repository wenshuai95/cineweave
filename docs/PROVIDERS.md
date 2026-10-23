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

## Seedream（Sprint 1 范围）

- 基础地址：`https://ark.cn-beijing.volces.com/api/v3`
- 已实现：能力声明、`listModels()`（动态过滤 Seedream 模型）、`health()`
- 未实现：`quote/submit/poll/cancel/download`，调用会抛出 `NOT_IMPLEMENTED`
- 生成链路在 Sprint 2 接入；真实测试预算 ¥50，只测 flash

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
