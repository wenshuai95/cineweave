# 当前 AI 接口

v0.5 已接入 旧版媒体 CLI CLI 文生图和可配置的 DeepSeek 规划 API。以 [v0.5 使用说明](V0.5-GUIDE.md) 为准。以下 v0.1 任务包文档为历史设计，不代表当前入口状态。

# AI 接口扩展约定

当前版本不调用任何生成服务，不收集或保存密钥。工具栏的 AI 接口页保存模型意图，并导出 `jingchang-ai-task/1` JSON。它是集成契约，不是已实现的服务商适配器。

任务包字段：
- `kind`: `reference-to-video`
- `provider`: 当前为 null，后续由适配器指定。
- `model`、`prompt`: 用户填写的模型名与生成意图。
- `video`: 目标宽高、帧率、时长、另行导出的参考视频文件名。注意：这里不包含预演视频本体，必须先导出 WebM，再由适配器上传。
- `assets`: 画布节点，包含内嵌参考图 / 视频数据。
- `connections`: 参考关系，不是执行图。
- `shots`: 镜头时间表与相机信息。
- `project`: 完整可编辑工程。

后续建议在 `server.mjs` 实现服务商适配层：
1. 检查服务商支持的素材格式、时长和尺寸，必要时在本地转换 WebM 到 MP4。
2. 在服务端从环境变量或系统钥匙串读取密钥；不要把密钥写入浏览器、项目 JSON 或日志。
3. 上传用户选择的参考素材，并提交生成请求，返回任务 ID。
4. 使用显式状态接口轮询任务，保留失败原因与计费信息。
5. 用户确认结果后下载到本机，将结果作为图片 / 视频节点回填。

建议接口：GET /api/providers、POST /api/generate、GET /api/jobs/:id、POST /api/jobs/:id/cancel。目前仅 GET /api/health 已实现；其他路径不会伪装返回成功。

桌面封装：保留当前前端和本地数据模型，可使用 Electron 或 Tauri；应将 IndexedDB 数据迁移为应用目录文件，并加上系统文件选择器、备份与媒体转码。这些功能不属于 v0.1。

自 v0.4 起，场景对象可包含 `channels`：键为 `positionX/Y/Z`、`targetX/Y/Z`、`rotation`、`scale`、`color`、`fov` 或 `pose`，值为排序后的 `{t, value, ease}` 数组。采样时独立通道覆盖旧 `keys` 的对应参数；角色 `actions` 在片段区间内进一步覆盖 pose。适配器应使用工程采样函数或导出的预演视频，不应只读取旧 `keys`。
