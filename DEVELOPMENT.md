# 开发说明（经典版 v1.21）

这是后续持续开发的主目录。代码、许可证、资产清单都在这里；离线模型另行下载。

## 环境

- macOS（打包脚本以 macOS 为主）
- Node.js 20+
- 首次准备：

```bash
npm install
```

## 日常开发（不需要 DMG）

方式 A：最接近生产，改完代码重新 build：

```bash
npm run build
npm start          # http://127.0.0.1:4173
```

方式 B：前端热更新（两个终端）：

```bash
# 终端 1：后端 API
npm start

# 终端 2：Vite 热更新
npm run dev        # http://127.0.0.1:5173，/api 自动代理到 4173
```

注意：浏览器 `127.0.0.1:4173` / `:5173` 的 IndexedDB 与 Electron App 的数据目录相互独立；
要迁移工程用「导出工程 JSON → 导入」。

DMG 只在发布/交付时构建，日常开发不需要。

## 常用命令

```bash
npm run build     # Vite 构建
npm test          # Node 测试
npm start         # 本地启动 http://127.0.0.1:4173
```

桌面版：

```bash
npm run package:mac
npm run package:dmg
```

## 提交前检查

```bash
git status --short
git diff
npm test
```

确认没有出现以下文件（已在 `.gitignore` 中，但不要强行 `git add -f`）：

- `node_modules/`、`dist/`、`release/`
- `*.dmg`、`*.app`
- `public/assets/models/`、`public/assets/thumbnails/`
- `text-model.json`、`.local/`、`.env`、`credentials*`、`*.pem`、`*.key`

## 发布新版本

1. 修改 `package.json` 的 `version`，更新 `CHANGELOG.md`
2. 提交：

```bash
git add -A
git commit -m "chore: v1.21.1"
```

3. 打 tag 并推送：

```bash
git tag v1.21.1
git push origin main --tags
```

4. 建 GitHub Release：

```bash
gh release create v1.21.1 --title "v1.21.1" --notes "更新说明"
```

资产库有变化时才重新上传：

```bash
gh release upload v1.21.1 /路径/assets-cc0.zip
```

也可以直接用 `scripts/release.sh 1.21.1 "更新说明"`（会检查工作区干净、版本号一致、自动打 tag/推送/建 Release）。

## 目录

```text
src/                前端源码
desktop/            Electron 主进程与打包
public/assets/      manifest + 许可证（模型需另行下载）
docs/               开发/设计文档
tests/              Node 测试
server.mjs          本地服务入口
```

## 许可

- 代码：AGPL-3.0，商业授权联系 `wenshuai95@126.com`
- 离线资产：CC0-1.0，来源和许可证见 `ASSETS.md`

## 注意

- 不要把 API Key、`text-model.json`、旧版媒体 CLI 授权文件提交进仓库
- 资产来源/许可证文件要随资产包一起分发
