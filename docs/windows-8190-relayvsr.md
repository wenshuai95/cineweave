# Windows ComfyUI 环境（2026-11-13 交接）

来源：`Z:\AI拍电影\ComfyUI-工作流速查表与架构补强.md`、`Windows-8188停用与回退说明.md`、`Windows-P0治理与RelayVSR超分-回执.md`、`P1新增模型-sha256清单.txt`。

## 必须记住

- **8190 是当前唯一在线实例**：`http://192.168.3.27:8190`，ComfyUI 0.45 / 1173 节点 / `--offline`。
- **8188 已停用**：服务、守护进程、计划任务 `ComfyUI-LAN` 均已停；旧 H3 基础版 / Ref2VA / Wan / LTX / FramePack / SDXL 系工作流当前不可用。恢复见交接文档第 6 节，不要改端口硬提交。
- **绝不删** `D:\ComfyUI_windows_portable\ComfyUI\models\`：8190 的 274 GB 权重全部通过 `extra_model_paths.yaml` 指向这里。
- **不要同时跑重任务**：H3 峰值 RAM 27–30 GiB；Qwen depth 峰值显存 11.06 GiB。
- 跨域必须显式 origin，不要 `*`；只允许 `192.168.3.0/24`。

## RelayVSR X2（已接入本应用）

- 能力 ID：`relayvsr-x2`，端点 `parallel045`，模式 `upscale`。
- 工作流：`generation/workflows/relayvsr-x2-upscale.json`。
- 主模型 + VAE 必须同为 x2；步数 1 / CFG 1；音轨与 fps 原样保留。
- 本应用实测：640×352 / 24fps / 5.167s 源视频 → **1280×704 / 24fps / 5.167s / AAC**。
- 使用：选中已有视频节点 → 工具栏「视频超分」。
- 长片段先分段；连续跑多任务 RAM 会累积，必要时 `/free` 或重启 8190。
