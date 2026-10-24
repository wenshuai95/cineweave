# 造梦工坊 v1.28.1 交付验收

日期：2026-10-24
版本：1.28.1
主题：导航去重与保存失败修复

## 一、本版范围

- 导航只保留一套：左上项目名 + 一个「工作区 / 创作阶段」下拉
- 修复保存失败提示不真实、点击不重试、失败后不再恢复的问题
- 不新增功能；Phase 1–4 的画布、多素材参考、Seedance 2.5 Provider 保持不变

## 二、验证结果

### 测试与构建

- `npm test`：612 tests / 603 pass / 0 fail / 9 skipped
- `npm run build`：成功
- `npm run package:mac`：成功（macOS arm64）

### 安装与健康检查

- 安装路径：`/Applications/造梦工坊.app`
- `CFBundleShortVersionString` → `1.28.1`
- `codesign --verify --deep --strict` → 通过
- 用临时数据目录/端口启动，`GET /api/health`：

```json
{"app":"ai-video-workstation","version":"1.28.1","displayName":"造梦工坊","local":true}
```

- 安装版实机打开空白工程：顶部只有 `画布 ▾`，无 board/stage tabs、无中央阶段 pill、无底部画布/剪辑导航；点「保存」后状态「已保存 / 已保存到本机」，console 0。
- 安装验证使用临时 `DIRECTOR_CANVAS_TEST_DATA`，未改写用户工程数据。

### 导航验收截图

- `/tmp/cineweave-phase5/nav-1440.png`：1440 唯一导航
- `/tmp/cineweave-phase5/nav-menu-1440.png`：统一工作区/阶段下拉
- `/tmp/cineweave-phase5/stage-1440.png`：3D 导演台可达
- `/tmp/cineweave-phase5/edit-1440.png`：剪辑可达
- `/tmp/cineweave-phase5/nav-1024.png`：1024 无溢出
- `/tmp/cineweave-phase5/installed-1281-nav.png`：安装版 v1.28.1 实机

### 保存修复验收

- 注入一次 IndexedDB 写入失败：状态栏显示真实错误（tooltip/HUD 同步）；点击状态栏后重试成功，恢复「已保存」。
  - `/tmp/cineweave-phase5/save-error.png`
  - `/tmp/cineweave-phase5/save-retry.png`
- 真实工程（56 节点、约 55MB 媒体）打开 → 移动节点 → 保存成功。
  - `/tmp/cineweave-phase5/real-save.png`
- 用户此前未落库的「即梦同构验收」工程不存在于 IndexedDB，无法从内存恢复；修复目标是防止再次发生并让失败可诊断/可重试。

### 发布产物

- DMG：`work/造梦工坊-v1.28.1-AppleSilicon.dmg`
- 大小：199 MB
- SHA-256：`be4605cce97879731de52a5e4c1e26c1124aeec1f10e57553ebd12fc0bd64607`
- DMG 挂载验证：app 版本 1.28.1，codesign 通过，可正常挂载/卸载。

## 三、已知限制

1. 之前保存失败时未落库的内存工程无法恢复（无磁盘副本）。
2. Seedance 2.5 视频/音频参考 URL 托管仍未打通；图片参考支持 base64；真实付费调用未在发布流程执行。
3. H3 仍仅接口，未安装模型。
4. 其余沿用 v1.28.0 限制（ffmpeg 依赖、Windows 暂停、1024 为视口模拟等）。

## 四、CI

- GitHub Actions `.github/workflows/ci.yml`：push 后执行 `npm ci`、`npm test`、`npm run build`；结果以 push 后 CI 运行记录为准。
