# 镜场 AI 接入调研与建议

核实日期：2026-10-10。仅调研官方资料、读取安装脚本与 CLI 包；未提交任何收费生成任务。

## 推荐组合

| 需求 | 建议 | 实际输出与边界 |
|---|---|---|
| 中文描述变成人物动作 | 先用已有 DeepSeek 编排现有动作、位置关键帧；需要新骨骼动作时接 HY-Motion 云 API | 编排是现有动作组合；HY-Motion 才生成骨骼动作，需导入 FBX、骨架映射和重定向 |
| 图片生成 | Oiioii 官方 CLI，使用现有账号浏览器授权 | 下载图片后进入本地画布；不依赖把密钥放进网页 |
| 图片/文字生成单个模型 | Meshy 或 Tripo API | 生成可导入的模型资产；完整场景仍需布局、拆分和整理 |
| 图片+文字搭建可编辑预演场景 | DeepSeek 分析参考图→资产清单与布局 JSON→本地资产库实例化 | 最适合当前软件，每个角色、房子、车辆可独立选择与动画；属于布局规划，不是精确重建 |
| 大环境生成 | HY-World 作为后续独立适配器 | 导航式 3DGS/网格世界，不保证每个物体天然独立、可绑定或可动画 |

## DeepSeek：可以直接利用已有 API

官方当前将 **DeepSeek-V4.1-Flash** 对应为 `deepseek-flash`，基础地址 `https://api.deepseek.com`；支持图像与文字输入，输出为文字。适合输出经过约束的场景布局、动作时间表、关键帧 JSON，不能直接替代骨骼动画或网格生成服务。`deepseek-v4-pro` 的官方能力表目前不支持视觉输入。第三方转发站的模型别名应从该服务的 `/models` 确认。

来源：[官方能力表](https://api-docs.deepseek.com/quick_start/pricing/)、[模型发现与输入输出模态](https://api-docs.deepseek.com/api/list-models/)。

推荐将模型输出限制为白名单动作、资产 ID、有限时长和坐标；本地验证后显示可编辑预览，再写入工程。不要执行模型产生的 JavaScript、Shell 或任意文件路径。

## 人物动作模型

**优先接 HY-Motion 云 API**。腾讯云提供 `SubmitHunyuanTo3DMotionJob`，输入描述，输出含动画的 FBX。相比在这台 Mac 上直接部署大型模型，云端接入更容易落地。需用户开通对应腾讯云服务，并在本机服务端配置凭证。[官方提交文生动作接口](https://cloud.tencent.com/document/product/1804/131256)、[TokenHub HY-3D-Motion 调用](https://cloud.tencent.cn/document/product/1823/137780)。

**本地选 HY-Motion-1.0 / Lite**。官方仓库提供推理代码和权重，标注最低显存约 26GB / 24GB，且这些数值不包括提示词改写用语言模型。是否适合当前 Mac 要实际检查芯片、内存、后端兼容性后再决定，不承诺开箱即跑。[官方仓库](https://github.com/Tencent-Hunyuan/HY-Motion-1.0)。

**SayMotion 是商业备选**，支持文字生动作及自定义角色，API 需申请伙伴访问，不应显示为人人已可调用。[官方 API 说明](https://www.deepmotion.com/saymotion-api)、[官方 REST 示例](https://github.com/DeepMotion/SayMotion-REST-API)。

无论哪家，动作导入后都要处理骨骼映射、尺度、朝向、脚底接地和动作根位移；人物移动轨迹与骨骼动作须明确分工，避免两次叠加位移。

## 模型与场景生成

- **Meshy**：文生 3D 是预览网格→纹理精修的异步流程；也提供图生 3D，可输出 GLB。适合生成房子、车辆、道具等独立资产。模型版本会退役，应按当前目录选，不把旧 ID 写死。[文生 3D](https://docs.meshy.ai/en/api/text-to-3d)、[图生 3D 快速接入](https://docs.meshy.ai/en/api/quick-start)。
- **Tripo**：官方提供文字、单图、多视图生成模型及开发接口，是单物体生成的另一候选。不要把其模型生成宣传为完整分层场景重建。[官方开发者文档](https://developers.tripo3d.ai/en/docs/introduction)。
- **Hunyuan3D-2.1**：可自行部署图生模型和 PBR 材质管线；官方说明形状约需 10GB 显存、纹理约 21GB、两者合计约 29GB。适合有 GPU 的本地或私有服务器，Mac 兼容性需验证。[官方仓库](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1)。
- **HY-World 2.0**：官方有文字/图像生成可导航 3D 世界的流程，可输出 3DGS/网格。作为大环境背景有价值；“可导航”不等于每件物体均有独立拓扑、绑定和动作能力。相关代码仓库已有 2.1 产品更新提示，应以实际可调用接口为准。[官方仓库](https://github.com/Tencent-Hunyuan/HY-World-2.0)。

## Oiioii 精确接入指南（已核对 0.1.8 源码）

用户提供的[官方安装脚本](https://static-oiioii-sg.hogiai.cn/cli/install.sh)使用 npm `@oiioii/cli`。调研下载该脚本并读取，未执行；从其指定 npm 源下载 0.1.8 包，并以 registry 提供的 SHA-512 完整性值验证一致。以下命令和字段来自包内 README 与源码。[npm 包说明](https://www.npmjs.com/package/@oiioii/cli)。

本地服务器使用 `execFile(可配置CLI路径, 参数数组, {shell:false})`。不拼接 Shell；CLI 不在 PATH 时提示选择路径或安装。凭证由官方 CLI 保管，不读取或向前端转发密钥。

### 授权、目录和工作空间

```sh
oiioii auth status --json
oiioii auth login
oiioii inspect models --domain image --json
oiioii workspace current --json
```

`auth status` 的 `data.authenticated` 只说明已配置凭证，不代表远程验证有效；未配置时退出码 1。`auth login` 为浏览器授权，有 PKCE 与 loopback 回调。可显式创建工作空间：

```sh
oiioii workspace create --name "镜场图片" --language zh --set-current --json
```

模型列表位于 `data.models`，每行含 `id`、`name`、`key`、`variant`、`aspect_ratios`、`sizes`、`generation_input_contract` 等。以实际列表构造下拉框，优先 `--model-id`，不写死可用模型或价格。

### 验证、报价、提交和轮询

以下尖括号是占位值，调用时由参数数组传入：

```sh
oiioii image text --prompt <描述> --model-id <模型ID> --aspect-ratio 16:9 --resolution 2K --workspace <工作空间ID> --dry-run --json
oiioii points quote --model-id <模型ID> --resolution 2K --json
oiioii image text --prompt <描述> --model-id <模型ID> --aspect-ratio 16:9 --resolution 2K --workspace <工作空间ID> --json
oiioii task status <任务ID> --json
oiioii record open <hogi图片URI> --output <受控输出路径> --no-open --json
```

`--dry-run` 不提交生成，但仍需要授权与工作空间。报价仅估算，界面注明实际以结算为准，点击生成才提交。成功提交 JSON 为 `ok:true`，`data.task_id` 是后端任务 ID、`data.local_task_id` 是本地 ID；生成结果也可能同步返回 `data.artifacts`。

`task status` 返回 `data.task`，其 **`resourceUris` 是驼峰字段**。终态为 `succeeded`、`failed`、`cancelled`。只向前端返回白名单 ID、状态、错误和结果，不暴露原始任务对象的内部请求元数据。只接受 `hogi://image/…` 结果。下载命令返回 `data.path`、`bytes`、`mime_type`；校验它在应用受控目录中，加入本地画布素材。

提交结果不确定时使用已保存任务 ID 与 CLI 的幂等恢复流程，禁止自动重新创建生成任务导致重复扣点。`task status` 可非阻塞轮询；不要让网页 HTTP 请求长期等待 `task wait`。

### 尚需用户配置

- Oiioii 在本机完成官方浏览器授权；选择实际工作空间及图片模型。
- DeepSeek 的服务地址和模型 ID；密钥在本机服务端环境变量或安全设置中配置，不贴聊天、不写工程 JSON。
- 如果要真正生成新骨骼动作/新网格，另需选定并开通 HY-Motion / Meshy / Tripo 等服务。已有 DeepSeek API 不包含这些服务额度。

### 本机只读验证

当前已安装 `oiioii` 0.1.7，路径 `~/.local/bin/oiioii`。只读检查显示凭证已配置；随后模型列表与积分报价远程请求成功，已确认当前授权可用且已设置工作空间。已有版本支持本方案常规文生图所需参数，无需为此重复安装或覆盖账号。0.1.8 新增的透明背景参数不能直接传给 0.1.7。

0.1.7 的 `workspace` **没有 `list` 子命令**；使用 `workspace current` 读取当前空间，或用户输入现有 ID，或明确点击新建后执行 `workspace create`。`workspace current --json` 成功返回 `data.workspace_id`、`source`；未设置时返回 `WORKSPACE_REQUIRED`。

`points quote` 返回 `type: "points_quote"`，`data` 中包含 `estimated_points`、`estimate`、`caveat`、`model`、`available_points`、`sufficient`。前端展示估算和可用余额即可，不依赖更多内部计价字段。


### 实际目录与报价验证

只读目录返回 16 个图片模型。以用户账号当前返回为准：Seedream 4.5 为 `model-id 50`，实际 key 为 `seedream`、variant 为 `4.5`；分辨率选项为 `2048x2048`、`2560x1440`、`1440x2560`。直接传示例中的 `2K` 会被拒绝，不能把文档示例的分辨率当成所有模型的通用值。正确的横屏报价命令为：

```sh
oiioii points quote --model-id 50 --resolution 2560x1440 --json
```

当前估算为 **7 积分**（随目录、会员等级、活动变化，不是固定承诺），`sufficient:true`。此报价不需要 `--workspace`。结果是平台积分，无货币代码。Seedream 5.0 Pro 当前为 `model-id 49`，目录支持 `1K`、`2K`；其他模型 `sizes` 可能为空，此时让 CLI 决定缺省值或在 dry-run 验证，而非自行猜测。

运行本次只读检查时使用 `OIIOII_LOG_DISABLED=1` 与 `OIIOII_TELEMETRY_DISABLED=1`。账号标识和完整余额不写入交付文档。
