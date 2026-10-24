# 造梦工坊 v1.28.0 交付验收

日期：2026-10-24
版本：1.28.0
主题：即梦同构画布 + 多素材参考

## 一、产品边界

延续 v1.27.0：服务已有剧本/分镜的创作者，不生成剧本/大纲/对白。

本版新增：

- 即梦式画布与节点视觉（外部类型标签、空画布、左侧创建栏、顶部 HUD、底部小生成卡）
- 视频节点多素材参考（图片/视频/音频，顺序、上限、快照、画布连线堆叠）
- Seedance 2.5 可配置 Provider（默认关闭，未配置禁用，不把 1.0 伪装成 2.5）

## 二、验证结果

### 测试与构建

- `npm test`：608 tests / 599 pass / 0 fail / 9 skipped
- `npm run build`：成功（仅既有 chunk size 提示）
- `npm run package:mac`：成功（macOS arm64）
- `npm run package:dmg`：成功

### 安装与健康检查

- 打包目录：`work/release-1.28.0/packaged/造梦工坊-darwin-arm64/造梦工坊.app`
- 安装路径：`/Applications/造梦工坊.app`
- `defaults read ... CFBundleShortVersionString` → `1.28.0`
- `codesign --verify --deep --strict` → 通过
- 临时数据目录 / 临时端口启动，`GET /api/health`：

```json
{"app":"ai-video-workstation","version":"1.28.0","displayName":"造梦工坊","local":true}
```

- 安装/启动验证使用临时 `DIRECTOR_CANVAS_TEST_DATA`，未读写用户工程数据。

### 实机 UI（1440×900 / 1024×768）

- 底部生成卡：1440 下 840×360、bottom 距底 64、top=476（画布上半部完整可见）；1024 下 840×307、top=397；无横向溢出、无背景模糊遮罩。
- 选中图片/视频节点出现卡片；点空白收起；切换节点更新；Esc 关闭。
- 顶部六阶段大 pill 已改为小面包屑（画布 / 创作流程 ▾），菜单保留六阶段。
- 视频节点多参考分组显示 2/30、1/10、1/10（2.5 启用态）；图片/视频/音频引用顺序与 `<Picture n>`/`<Video n>`/`<Audio n>` 标签保留。
- Seedance 2.5 启用态：模型下拉出现「Seedance 2.5（多素材参考）」，时长 4–30、分辨率 480p/720p/1080p；查看费用成功进入确认生成（本地 quote，无网络/无费用）。
- 未启用态：模型置灰并提示 `ARK_SEEDANCE_25_ENABLED=1`；provider 未配置时 Seedance 选项禁用并说明。
- console error：0。

截图证据（本机临时目录，不随仓库分发）：

- `/tmp/cineweave-phase3/01-dock-1440.png`
- `/tmp/cineweave-phase3/02-image-dock-1440.png`
- `/tmp/cineweave-phase3/05-dock-1024.png`
- `/tmp/cineweave-phase3/seedance25-1440.png`
- `/tmp/cineweave-phase3/seedance25-1024.png`
- `/tmp/cineweave-phase3/seedance25-model-1440.png`
- `/tmp/cineweave-phase3/seedance25-disabled-1440.png`

### 发布产物

- DMG：`work/造梦工坊-v1.28.0-AppleSilicon.dmg`
- 大小：199 MB
- SHA-256：`b126f16ac729240013e85aa30fd89408c051c9487ef9ec6eb85a20c364103550`
- DMG 挂载验证：app 版本 1.28.0，codesign 通过，可正常挂载/卸载。

## 三、已知限制

1. **Seedance 2.5 视频/音频参考 URL 未打通**：官方接口要求可访问 URL；当前画布视频/音频多为本地内嵌 data URL，生成前会明确提示需要 http(s) URL，不会静默降级。图片参考支持 base64。
2. **真实 Seedance 2.5 付费调用未执行**：发布流程只用 mock fetch 验证请求体（`image_url`/`video_url`/`audio_url` + `role: reference_*`）与能力上限；未用真实 Key 产生费用。
3. **H3 仅接口**：保留能力声明与缺失项检测，不自动下载/安装模型。
4. **Seedance 1.0 限制**：仅 1 张图片参考；多素材必须显式选择 2.5。
5. 1024 为视口模拟（应用最小宽度约束）；白模参考包依赖本机 ffmpeg；Windows 版本暂停。
6. 失败/取消历史行只展示原因，不自动重试；Provider 文案按上游原文展示。

## 四、安全与合规

- 未调用付费 API；未安装 H3 模型；未修改即梦 CLI。
- 安装验证使用临时数据目录/端口，不清理用户项目。
- 未打包签名开发者证书（本机临时签名）。

## 五、CI

- GitHub Actions `.github/workflows/ci.yml`：push 后执行 `npm ci`、`npm test`、`npm run build`；结果以 push 后 CI 运行记录为准。
