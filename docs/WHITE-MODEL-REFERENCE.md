# 白模整段参考：模型能力与接入方案

## 结论

白模预演要作为**整段视频参考**，不能只用首帧。必须使用支持
`reference-to-video` / `video reference` 的模型：

1. **即梦 Seedance 2.0 / 2.5**（云端）
2. **ComfyUI MiniMax Hailuo 03 Reference**（ComfyUI API 节点）

当前造梦工坊只支持：

- Seedance **1.0**（文本/首帧）
- Kling（首帧）
- ComfyUI SDXL 图生图

都**不支持整段白模视频参考**。UI 里的“白模参考”目前实际只是首帧参考。

## 一、即梦 Seedance 2.0 / 2.5

官方教程：
- https://docs.volcengine.com/docs/ark/seedance-2-0?lang=zh
- https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh

能力要点：

| 项 | Seedance 2.0 | Seedance 2.5 |
|---|---|---|
| 参考视频 | 单段 2–15s，最多 3 段，总 ≤15s | 单段 2–30s，最多 10 段，总 ≤30s |
| 生成时长 | ≤15s | ≤30s |
| 参考素材总数 | 12 | 50 |
| 白模控制 | 支持白模插件导出的预演视频 | 支持，且是主推链路 |

白模链路：

1. 3D 预演导出**干净的白模视频**（24fps、无轨迹线/坐标轴/相机锥体、无 UI）。
2. 通过 API 作为参考视频提交，提示词声明：
   - 继承：运动轨迹、运镜、站位、镜头切接、节奏
   - 不继承：白模材质、灰色场景、占位人物外观
3. 每个参考素材都必须写“继承什么 / 不继承什么”。

接入需要：
- 火山方舟 API Key
- Seedance 2.0/2.5 模型权限
- 参考视频上传/可访问 URL（按 API 要求）
- 费用确认

## 二、ComfyUI MiniMax Hailuo 03

官方节点文档：
- https://docs.comfy.org/zh/built-in-nodes/MinimaxHailuo03ReferenceNode

相关节点：
- `MinimaxHailuo03ReferenceNode`：多模态参考生视频
- `MinimaxHailuo03FirstLastFrameNode`：首尾帧
- `MinimaxHailuo03TextToVideoNode`
- `MinimaxHailuo03RegenerateNode`

工作流参考：
- https://comfy.org/zh-TW/workflows/cb783cb4c20c-cb783cb4c20c/
- https://comfy.org/zh/workflows/ef37c26c9bbf-ef37c26c9bbf/

重要边界：
- H3 是 **ComfyUI 的 API Partner 节点**，不是本地 SDXL checkpoint。
- 需要 Comfy API Key / 额度；当前本地 8188 的 SDXL 工作流不能直接跑 H3。
- 接入需要固定 workflow JSON 和节点输入输出映射，不能只换模型名。

## 三、造梦工坊要补的链路

### 1. 白模预演导出

3D 导演台按镜头导出：

- MP4，24fps
- 2–15s（Seedance 2.0）或 2–30s（2.5）
- 干净白模，无轨迹线/坐标轴/相机锥体/UI
- 每镜一个视频，带镜头号、时长、机位

当前已有“导出视频并创建白模预演节点”，需要补：

- 按镜头切分
- 干净渲染选项
- 规格校验
- 参考视频元数据

### 2. 生成面板参考视频

新增：

- 参考视频槽（选择画布白模预演节点）
- Provider 能力矩阵：只有 2.0/2.5 或 H3 才启用
- 参考视频规格检查
- 提示词自动插入“继承/不继承”声明
- 费用确认

### 3. Provider

建议顺序：

1. **Seedance 2.5**（复用现有方舟 Provider/API Key，改动最小）
2. Seedance 2.0（兼容旧账号）
3. ComfyUI H3 Reference（需要 Comfy API 和 workflow）

## 四、需要确认

1. 你有火山方舟 Seedance 2.0/2.5 的模型权限吗？
2. 你的 ComfyUI 是否已安装 H3 Reference 节点，并有 Comfy API 额度？
3. 先做哪条链路：Seedance 2.5（推荐）还是 ComfyUI H3？
