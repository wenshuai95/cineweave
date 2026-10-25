# 造梦工坊 v1.28.2 交付验收

日期：2026-10-25
版本：1.28.2（历史版本；最新见 [RELEASE-ACCEPTANCE-1.29.0.md](RELEASE-ACCEPTANCE-1.29.0.md)）
主题：ZCode 缺陷修复（不扩展功能）

ZCode 原始静态测试报告：[ZCODE-BUG-REPORT-1.28.1.md](ZCODE-BUG-REPORT-1.28.1.md)；复跑说明：[zcode-test/README.txt](zcode-test/README.txt)。

## 一、修复项

1. **P1-1** 视频生成失败后重开底部生成卡：优先回填 `source.videoDraft` 的 prompt / modelId / duration / resolution / provider。
2. **P2-3** 中文输入法组词期间按 Esc 不再关闭生成卡（全局 keydown 增加 `isComposing` / keyCode 229 保护）。
3. **P2-1** 保存失败自动重试最多 1 次；之后保持错误状态，仅用户点击状态栏手动重试。
4. **P2-4** 图片结果“已在画布中”早退时清空已消费报价并复位主按钮。
5. **P2-2** BrowserWindow `minWidth` 1080 → **1024**（`minHeight` 720），真实 1024×768 窗口验证。
6. **P3-1** 节点失败徽标不再 8 秒自动消失，保留到重试/关闭。

## 二、测试与构建

- `npm test`：**618 tests / 609 pass / 0 fail / 9 skipped**
- `npm run build`：成功
- `npm run package:mac`：成功（macOS arm64）
- 新增 `tests/zcode-fixes.test.mjs`（6 项）：草稿恢复、IME Esc 守卫、早退 quote 复位、minWidth、失败徽标常驻、自动重试仅 1 次

## 三、Electron 真交互复验

使用临时数据目录 + Fake Provider，不触碰用户数据、不调用付费 API：

- **P1-1**：视频卡设提示词「测试提示词 ABC」、时长 4、模型 Fake Video；提交后通过 CDP Fetch 强制 poll 失败；关闭再开，恢复 `prompt=测试提示词 ABC / model=fake-video / duration=4 / provider=fake`。
  - `/tmp/cineweave-phase5/zcode-p1-restored.png`
  - `/tmp/cineweave-phase5/zcode-p1-failure-poll.png`
- **P2-3**：真实 Electron 窗口内用 CDP `Input.imeSetComposition` 进入中文组词后按 Esc，生成卡保持打开且输入保留；结束组词后普通 Esc 关闭。
  - `/tmp/cineweave-phase5/zcode-ime-real.png`
- **P2-2**：真实窗口调整为 1024×768，`innerWidth=1024`、`documentElement.scrollWidth=1024`，无横向溢出。
  - `/tmp/cineweave-phase5/zcode-1024-window.png`
- **P3-1**：失败后等待 9 秒，节点失败徽标与「重新生成」仍在。
  - `/tmp/cineweave-phase5/zcode-p3-badge-poll.png`
- console：无 Runtime exception；仅强制失败接口产生预期 HTTP 500 resource log。

## 四、安装与发布产物

- 安装路径：`/Applications/造梦工坊.app`
- `CFBundleShortVersionString` → `1.28.2`
- `codesign --verify --deep --strict` → 通过
- 临时数据目录启动，`GET /api/health`：

```json
{"app":"ai-video-workstation","version":"1.28.2","displayName":"造梦工坊","local":true}
```

- DMG：`work/造梦工坊-v1.28.2-AppleSilicon.dmg`
- 大小：198 MB
- SHA-256：`31eebb96c34e93566ef3da432b237d3ba784b46ae05851444aec3154042033b2`
- DMG 挂载验证：app 版本 1.28.2，codesign 通过，可正常挂载/卸载。

## 五、已知限制

- 之前保存失败未落库的「即梦同构验收」工程无法从内存恢复；本版只防止再次发生并让失败可诊断。
- Seedance 2.5 视频/音频参考 URL 托管仍未打通；真实付费调用未在发布流程执行。
- H3 仅接口，未安装模型。
- 其余沿用 v1.28.1（ffmpeg 依赖、Windows 暂停、1024 为真实窗口已改为 minWidth 1024）。

## 六、CI

- GitHub Actions `.github/workflows/ci.yml`：push 后执行 `npm ci`、`npm test`、`npm run build`；结果以 push 后 CI 运行记录为准。
