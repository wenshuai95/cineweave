# 本机资产库（v1.22 第二步）

工程 JSON 里不再内嵌 base64 模型与图片，改为内容寻址引用：

```
/api/assets/<sha256>.<ext>        png / jpg / webp / gif / mp4 / webm / mp3 / wav / ogg / m4a / glb
/api/model-assets/<sha256>.glb    旧路径别名（模型），仍可读，便于旧工程与旧链接兼容
```

文件落在 `$JINGCHANG_DATA_DIR/model-assets/`（默认 `source/.local/model-assets/`），同名内容只存一份。

## 为什么这么做

《玉印》v05 工程实测：57.2 MB → **3.6 MB（15.9 倍）**。
其中模型内嵌 28.7 MB、参考图内嵌 24.9 MB；视频/音频只有 3.5 MB，暂不迁移（工作站媒体库仍按老路径工作）。

## 什么时候迁移

| 时机 | 行为 |
|---|---|
| 打开工程 | 自动把内嵌 GLB / 图片上传到资产库并改写引用，随后保存；失败的对象保留内嵌数据，不丢内容 |
| 导入工程 / 备份 | 同上，导入前迁移，落库即瘦身 |
| 导入 GLB 文件 | 优先上传资产库，失败才退回内嵌 |
| 完成 Blender 渲染 | 任务目录与工程无关，不影响 |

迁移是**幂等**的：已经是 `/api/assets/...` 的引用会被跳过。

## 导出与备份

导出工程 / 带媒体备份前，会把 `/api/assets/...` 引用**重新内嵌**成 base64，生成的文件仍是「一个 JSON 拿走就能用」。
如果本机服务不可用、取不回某个资产，导出继续但会提示「有 N 个模型未能内嵌，备份需要同一台机器上的本机资产库」。

## 服务端接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/assets` | `Content-Type` 决定扩展名；返回 `{hash,url,size,deduped}` |
| POST | `/api/model-assets` | 模型专用，等价于 glb |
| GET | `/api/assets/<hash>.<ext>` | 返回文件，长缓存（内容不可变） |
| GET | `/api/model-assets/<hash>.glb` | 同上（兼容旧路径） |
| GET | `/api/assets/<hash>.<ext>/meta` | 元数据 |

限制：单文件 ≤300 MB（`WORKSTATION_MODEL_MAX_BYTES`）；仅本机同源；hash 与扩展名白名单校验。

## 客户端实现

`src/model-assets.mjs`

- `migrateProjectAssets(project)`：内嵌 → URL（模型 + 图片节点）
- `embedProjectAssets(project)`：URL → 内嵌（导出用）
- `uploadDataUri / uploadModelBytes / uploadAssetBytes`：上传
- 兼容旧名 `migrateProjectModels / embedProjectModels`

## 已知边界

- 视频/音频画布节点仍内嵌（与工作站媒体库、版本逻辑耦合），下一步可一起迁移。
- 资产库只增不删：目前没有孤儿回收。工程删除后文件仍在，需要时可按引用做 GC。
- 资产库目录与工程库绑定同一台机器；换机请用「导出工程备份」（会自动内嵌）。

## 动作库重定向（v1.22 新增工具）

内置动作库的片段分布在不同骨架上（UAL2 人偶 85 段、成年角色 24 段），
`tools/retarget/` 可以把前者重定向到后者：实测 61/61 根骨骼映射、85 段烘焙 14.8 秒、
导出 109 段动作的单个 GLB。详见 [tools/retarget/README.md](../tools/retarget/README.md)。

## 内置扩展动作角色（v1.23）

`adult-female-casual-actions.glb` / `adult-male-casual-hoodie-actions.glb`：
把 UAL2 动作库 85 段重定向到角色骨架上生成，各 109 段动作（24 原有 + 85 `RT_`），每个约 6.3–6.4MB。
来源同 Quaternius（CC0-1.0），许可说明见 `public/assets/licenses/quaternius-retarget-derivative.txt`。
