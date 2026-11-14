# Blender 渲染桥接（v1.22）

把工程交给本机 Blender 后台重渲，成片回到画布。用于在 WebGL 预览确认之后，出一版光照、阴影、景深更可控的参考视频。

## 使用

1. 打开「导出预演」。
2. 勾选「用 Blender 渲染整片」。
3. 点「开始录制」——实际会提交给本机 Blender，进度条显示导出场景 / 搭建 / 渲染 / 编码四个阶段与镜头进度。
4. 完成后自动下载整片 mp4，并在画布上生成一个「· Blender 白模」视频节点（挂在导演台连线后）。
5. 中途可点「取消渲染」。

## 前置条件

- 本机安装 Blender 4.x / 5.x。默认检测 `/Applications/Blender.app/Contents/MacOS/Blender`。
- 可用环境变量覆盖：
  - `BLENDER_PATH`：Blender 可执行文件路径
  - `BRIDGE_PYTHON`：Python（默认 `python3`）
  - `BRIDGE_FFMPEG`：ffmpeg（默认沿用工作站的 ffmpeg）
- 服务端只接受本机同源请求；工程上限 150MB / 300 对象 / 300 镜头 / 1–3600 秒；采样 8–64；分辨率缩放 0.25–1。

## 还原范围

| 工程数据 | Blender 侧 |
|---|---|
| 机位位置 / 注视点 / FOV / 关键帧运镜 | 逐帧采样，垂直视场对齐 |
| 场景对象位置 / 旋转 / 缩放 / 隐藏 | 逐帧还原；隐藏对象连子对象一起隐藏 |
| 模型 `modelSize` | 最长边归一化，XZ 居中、底面贴地 |
| 材质 | `solid` 纯色覆盖、`original` 保留原材质 |
| 角色动作片段 | 按 `[start,end)` 与 speed / hold 切片段，逐角色独立时间轴 |
| 镜头编排 | 按 shots 的起止时间逐镜渲染 |

## 已知边界（v1.22）

- 只输出整片（所选区间暂未生效）；画幅固定 1280×720。
- 动作切换为硬切，无交叉淡化。
- `actor` 程序化火柴人、路径动画 `pathHandles` 尚未接入。
- 逐镜 mp4 已生成在任务目录，界面暂未逐镜回填。
- 首次运行需要 Blender 启动与场景构建（约 5–15 秒），随后约 0.4–0.6 秒/帧（M1 Max 实测）。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/bridge/status` | Blender / Python / ffmpeg 可用性与上限 |
| POST | `/api/bridge/jobs` | `{ project, options: { samples, scale, shots } }`，返回任务 |
| GET | `/api/bridge/jobs/:id` | 状态、阶段、进度、镜头完成情况 |
| POST | `/api/bridge/jobs/:id/cancel` | 取消 |
| GET | `/api/bridge/jobs/:id/reel` | 整片 mp4 |
| GET | `/api/bridge/jobs/:id/clip/:shot` | 逐镜 mp4 |

任务目录：`$JINGCHANG_DATA_DIR/bridge/<jobId>/`（默认 `.local/bridge/`），含 `scene.json`、`scene.blend`、`frames/`、`clips/`、`reel.mp4`。最多保留 6 个任务，超出按时间清理。

## 实现文件

```
tools/bridge/export_workstation.py   工程 JSON → scene.json + assets/*.glb
tools/bridge/bw_common.py            three.js↔Blender 坐标与关键帧采样
tools/bridge/bw_build.py             导入 / 归一化 / 材质 / 灯光 / 相机
tools/bridge/bw_render.py            逐镜逐帧渲染
tools/bridge/bw_package.py           PNG 序列 → 逐镜 mp4 + 全片
bridge-server.mjs                    /api/bridge/* 与渲染队列
```
