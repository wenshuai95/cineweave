# 造梦工坊 CLI（供其他智能体使用）

CLI 是本地服务的轻量 HTTP 客户端：**先启动造梦工坊桌面应用**，CLI 连它的 `127.0.0.1:41974`。

## 安装/运行

仓库内直接运行：

```bash
node bin/zaomeng.mjs health
```

需要全局命令时：

```bash
npm link
zaomeng health
```

默认地址 `http://127.0.0.1:41974`，可用 `--url` 或环境变量 `ZAOMENG_URL` 覆盖。

## 常用命令

```bash
# 服务与能力
zaomeng health
zaomeng capabilities --pretty
zaomeng jobs --limit 20 --pretty

# 提交并等待
zaomeng image --prompt "雨夜庭院，电影感" --workflow qwen21-t2i --width 1024 --height 1024 --wait
zaomeng video --prompt "镜头缓慢推近" --model h3-ultimate --duration 5 --wait
zaomeng relayvsr --video /api/generation/assets/xxx.mp4 --wait

# 任务控制
zaomeng job <id>
zaomeng cancel <id>
zaomeng retry <id>

# 原始请求
zaomeng submit --json job.json --wait
cat job.json | zaomeng submit --json - --wait

# 提示词
zaomeng optimize --prompt "雨夜追车" --mode video
zaomeng translate --prompt "雨夜追车"
zaomeng assistant --message "这场戏怎么分镜？"
```

## 智能体约定

- **stdout 只有最终 JSON**，进度写 stderr；适合被程序解析。
- 退出码：`0` 成功，`1` 失败（错误写 stderr）。
- 任务成功返回完整 job，其中 `result.url` 是本地相对地址，如 `/api/generation/assets/xxx.mp4`。
- 视频/图片输入可以直接用画布资产 URL；CLI 不读本地文件，文件请先上传或使用 `submit`。
- `--wait` 默认最多等 30 分钟，可用 `--timeout 秒` 调整。
- RelayVSR 需要源视频已在画布资产中；建议「先出片，再超分」，不要与 H3 生成并行。

## 快捷参数

| 命令 | 关键参数 |
|---|---|
| `image` | `--prompt --workflow --width --height --image --megapixels --ref-mode` |
| `video` | `--prompt --model --width --height --duration --fps --first-frame --last-frame --ref-image a.png,b.png --megapixels` |
| `relayvsr` | `--video --variant upscale\|short\|rife --detail` |
| `export-timeline` | `--items items.json --preset landscape\|portrait\|draft --out out.mp4` |

## 直接 HTTP

不装 CLI 也可以直接调：

- `GET /api/health`
- `GET /api/generation/capabilities`
- `POST /api/generation/jobs`
- `GET /api/generation/jobs/:id`
- `POST /api/generation/jobs/:id/cancel|retry`
- `POST /api/generation/timeline/export`

与 CLI 使用同一套 JSON 契约。
