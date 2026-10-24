# 即梦 Seedance 2.5 多素材参考研究

## 能力事实

Canvas CLI 的 `seedance_2.5` / `m2v` 规格：

- 参考素材总数：1–50
- 图片：0–30
- 视频：0–10
- 音频：0–10
- 至少需要 image / video / audio 其中一种
- 时长：4–30s
- 分辨率：480p / 720p / 1080p（4K 视账号）
- 提示词中用 `<Picture 1>`、`<Video 1>`、`<Audio 1>` 定位

参考顺序就是节点连线顺序；不是简单“首帧参考”，而是**画布图结构直接成为生成上下文**。

## 造梦工坊目标交互

### 视频节点

视频节点上游可以连接：

- 多张图片节点（角色、场景、构图、风格）
- 多段视频节点（运镜、动作、白模预演）
- 多段音频节点（配音、音乐、音效）

节点卡显示参考缩略图组，而不是一个“参考图”下拉。

### 底部生成卡

- 参考区：按类型分组显示已连接素材，可移除/排序
- Prompt 区：自动提示可用的 `<Picture n>` / `<Video n>` / `<Audio n>` 标签
- 模型/时长/比例/分辨率
- 能力校验：超过 Provider 上限时禁用并解释
- 费用 + 生成

### Provider 能力矩阵

每个视频 Provider 必须声明：

```js
video: {
  textToVideo: true,
  imageToVideo: true,
  videoReference: true,
  firstLastFrame: true,
  referenceLimits: {images:30, videos:10, audios:10, total:50}
}
```

当前：
- Seedance 2.5（云端）：支持多素材，需 API/CLI 测试
- ComfyUI H3：支持参考视频/图片/音频，接口保留
- Seedance 1.0 / Kling / Fake：仅首帧或文本，不能伪装支持

### 画布

- 视频节点被多根连线指向时，显示参考缩略图堆叠
- 连线类型用图标区分图片/视频/音频
- 删除/断线立即更新参考列表
- 生成时保存引用快照，重生成使用同一批参考

## 开发拆解

Phase 2A：数据与能力
- 视频节点支持多上游引用
- Provider 能力矩阵与上限校验
- 参考快照持久化

Phase 2B：生成卡
- 参考分组缩略图
- `<Picture n>` / `<Video n>` / `<Audio n>` 提示
- 费用与错误提示

Phase 2C：测试
- 2 图 + 1 视频 + 1 音频 mock
- 超上限
- 删除连线
- 重生成复用参考

不实现：把不支持多参考的模型伪装成支持。
