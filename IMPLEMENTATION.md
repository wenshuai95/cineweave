> 交付路径说明：任务要求写入 `../tasks/IMPLEMENTATION.md`。当前 headless 沙箱对 `source/` 父目录的写入被拒绝，且没有可用的审批通道；本文件是同一份交付说明，暂放在 `source/IMPLEMENTATION.md`，Codex 集成时可原样复制为 `../tasks/IMPLEMENTATION.md`。

# 造梦工坊 1.21.0 · 第一批实现说明

实现范围：C01 镜头生产清单、C02 节点操作与编辑入口、C03 生成图片与资产版本联通、C12 一致性收尾。未改动导演台动作、运镜、渲染业务，未恢复腾讯 3D 接口，未做第二/三批功能。

## 结果概览

- 镜头清单：画布工具条新增「镜头清单」入口，可折叠、可滚动、全量显示分镜；每镜只读推导资产正式图、白模/生成视频、剪辑使用、参考待复核，并给出下一位可执行动作。
- 节点工具条：改为按“到选中节点的距离”优先定位；忙碌低倍画布空间不足时停靠到画布边缘并显示「关联「节点名」」，不再被无关节点推到远处；保留原有横图、竖图、靠边、尺寸变化和下方对话框避让。
- 编辑入口：移除侧栏重复的「创作助手」，保留顶部创作助手；文稿与分镜节点统一进入「文稿与分镜」工作台，文字原位编辑、下方 AI 要求、文稿/分镜表编辑和原有助手功能均保留。
- 图片与资产版本：从资产/镜头上下文发起的生成结果会记录来源资产/镜头；节点工具条出现「加入资产版本」「设为正式图」。更换正式图前列出关联镜头、旧正式图、既有视频与剪辑影响；旧版本、旧节点来源和媒体字节保留；不重写旧视频、剪辑或已提交任务。
- 参考复核：提交视频报价时捕获参考素材的真实身份快照（资产+版本 ID，或短素材指纹），随报价写入本机任务记录；结果落地、重启恢复和任务中心查询都复用提交时快照，不会用当前图片版本冒充历史。
- 独立审核修正：镜头视频归属改为只认镜头自身节点与显式生成入口；同一生成图重复加入资产时复用版本；提交参考快照持久化；删除资产后的复核可确认清除。详见下方「本轮独立审核修正」。

## 本轮独立审核修正

1. **P1 镜头归属混算**
   - `sourceIdsForShot` 不再把镜头关联资产、资产图片节点作为视频归属根。根集合只包含 `storyRef.kind==='shot'` 的镜头节点、从这些节点直接连出的空视频生成入口，以及这些根直接连出的视频结果。
   - 版本组和镜头组仍按生成入口 `sourceNodeId` / `shotSourceId` 归属；共享角色/场景图只作为参考关系，不再把 s1 的产物分给使用同一资产的 s2。
   - 复核也只遍历该镜头自己的视频，因此复核 s2 不会顺带确认 s1 的参考变化。新增「两镜共享同一资产、仅 s1 有产物」回归。
2. **P1 重复资产版本**
   - 新增 `planGeneratedImageAdoption`：在读取媒体前先检查 `node.assetImageRef` 指向的版本是否仍存在，并用版本/节点上的 `srcHash` 判断图片真实内容是否变化。
   - `main.js adoptGeneratedImage` 使用该计划：同一张图先「仅加入版本」再「设为正式图」、或重复仅加入，都复用原版本，不重复写 `mediaStore`，不追加新版本；设为正式图只切换资产 `selectedImageId`、写当前节点 `storyImageRef` 并走 `checkpoint()`。
   - 只有节点 `src` 真实变化或原版本已被移除时才写入一个新版本；旧版本和退役图片节点的 `storyImageRef` 保留。
   - 新增真实计划函数回归，覆盖「首次加入 → 设正式 → 重复加入」版本数不变，以及替换图片后允许新版本。
3. **P1 提交参考快照**
   - 视频报价提交时，前端用 `referenceSnapshotFor(project,captured.refs)` 捕获实际提交的参考身份，并把 `referenceSnapshot` 放进 quote 请求。
   - `旧版媒体 CLI-video-service.mjs` 校验并只保留 `nodeId/kind/assetId/versionId` 或 16 位 `srcHash`，随任务写入现有 `jobs.json`；不保存 base64、密钥或大图字节。旧任务缺快照时返回 `legacy:true, unknown:true`，不读取当前工程冒充历史。
   - `planVideoResult` 直接使用任务记录里的提交快照；提交 A 后用户换成 B，结果返回仍记录 A，镜头清单按 B 提示复核。报价签名、云端防重提、任务查询与恢复路径未改变。
   - 新增「提交 A → 换 B → 结果仍记录 A 并提示复核」、任务保存/重启往返、旧任务 unknown 回归。
4. **P2 删除资产后无法清复核**
   - 参考节点缺失与参考资产缺失统一使用 `missing:true` + 参考节点 ID（`review.missing`）作为确认键。
   - `reviewShotReferenceChanges` 在资产缺失但图片节点仍在时也记录该节点 ID，再次渲染即可清除 pending；资产恢复且正式图/素材再次变化时会重新提示。恢复后确认时会清理过期 missing 标记，之后再次删除仍能重新提示。
   - 新增「删除资产但图片节点仍在 → 复核清除 → 恢复并换图重新提示」回归。

## 改动文件

### 新增

- `src/shot-production.mjs`：镜头清单只读推导、参考变更比较与复核记录。
- `src/shot-checklist-ui.mjs`：清单摘要、镜头行、状态与下一步按钮的纯 HTML 渲染。
- `src/shot-checklist.css`：镜头清单、参考复核和正式图影响对话框样式。
- `src/workstation/asset-image-context.mjs`：图片来源上下文、可加入资产解析、正式图影响汇总、生成图片版本复用计划与写入、参考快照。
- `tests/shot-production.test.mjs`：未完成镜头、采用版本、正式图变更、旧版推导、白模预演、复核不重写视频/剪辑。
- `tests/shot-checklist-ui.test.mjs`：14 镜全量渲染、空状态、状态文字、转义与读屏文本。
- `tests/asset-image-context.test.mjs`：错误资产拒绝、非资产不绑定、候选/正式图、旧版本保留、撤销、图片链接重连。
- `tests/node-overlay-docking.test.mjs`：忙碌低倍画布停靠、源节点不遮挡、横竖图/靠边/尺寸变化回归。

### 修改

- `src/main.js`：镜头清单入口与面板、镜头定位/返回视角、清单动作、图片结果资产采用流程、清单与画布事件隔离、编辑入口路由。
- `src/node-popover.mjs`：按节点距离排序、画布边缘/角落停靠槽、停靠方向与关联提示、源节点硬避让、障碍重叠最小化。
- `src/node-popover.css`：停靠状态与「关联「节点」」标签样式。
- `src/node-ui.mjs`：节点状态显示正式图/旧正式图/资产候选图/已加入资产版本；图片结果提供资产版本动作。
- `src/canvas-content.mjs`：资产版本动作复用图片图标。
- `src/canvas-image-result.mjs`：图片结果可携带来源上下文 `imageResultContext`，空白/非资产不携带。
- `src/video-generation.mjs`：报价时捕获参考提交快照，视频结果使用任务提交快照 `referenceSnapshot`；旧任务显式标记 `legacy/unknown`。
- `src/workstation/asset-images.mjs`：图片版本元数据保留 16 位 `srcHash`，用于判断同一内容复用版本。
- `旧版媒体 CLI-video-service.mjs`：报价/任务记录校验并持久化小型参考快照；旧任务返回显式 unknown；收费防重提与查询恢复路径不变。
- `src/workstation/story-canvas.mjs`：正式图节点优先选择当前版本；导出 `syncAssetImageLinks` 复用既有图片连线；退役节点保留自己的版本来源。
- `src/workstation/shell.mjs`：侧栏工具入口改为「文稿与分镜」，去除重复创作助手；分镜上游变化提示绑定到文稿工具。
- `src/workstation/assets-page.mjs`：更换/移除正式图前显示关联镜头、旧正式图、视频和剪辑影响；确认后才修改，提示复核；移除官方版本也走同一影响确认。
- `package.json`、`package-lock.json`、`server.mjs`、`workstation-server.mjs`：版本同步为 1.21.0；构建脚本使用 `vite build --configLoader native`，避免在共享只读 `node_modules` 写临时配置文件（本机沙箱限制），`dev` 同步使用 native 配置加载。
- `tests/final-review.test.mjs`：把新依赖 `imageAssetContext` 注入既有 shipped-handler 测试环境，仍然执行真实 `watchImage` 代码。
- `tests/video-generation.test.mjs`：增加视频结果参考快照断言。
- `tests/node-ui.test.mjs`：增加图片结果的资产采用动作可见性测试。
- `tests/workstation-server.test.mjs`：服务版本断言同步为 1.21.0。
- `dist/`：`npm run build` 生成产物。

## C01 镜头生产清单

- 入口：顶部画布工具条「镜头清单」，面板可收起/展开/关闭；Esc 可关闭；打开时焦点进入第一镜。
- 全量：直接遍历 `workstation.story.shots`，不做前 8 组截断；14 镜和更多镜头都渲染，内部滚动。
- 每镜只读推导：
  - 资产：`shot.assetIds` 与 `asset.shotIds` 双向关联；正式图是否在 `imageVersions` 中存在且等于 `selectedImageId`；失效资产 ID 单独统计。
  - 画面：只从该镜头自己的节点、从镜头节点直接连出的空视频生成入口、这些入口直接连出的结果，以及按 `sourceNodeId` / `shotSourceId` 关联的版本组/镜头组收集真实视频节点；共享资产负债不参与归属。标题/说明含「白模/预演」的算白模，带 `generatedTask` 或 `generatedProvider` 的算生成视频。
  - 剪辑：按版本组 ID、画布节点 ID、媒体 ID 三种真实引用检查 `workstation.sequence.video`。
  - 复核：读取生成视频的 `referenceSnapshot`；资产图比较 `assetId + versionId`，普通素材比较短指纹；旧视频没有快照时用图片节点版本与 `createdAt` 做保守推导。
- 下一步优先级：修复资产关联 → 关联资产 → 补正式图 → 整理到画布 → 生成/白模 → 复核参考 → 送入剪辑 → 查看镜头。
- 定位：点击镜号或标题定位到镜头节点（无节点时定位关联资产节点）；重置画布分类为全部；收起分组沿用现有 `locateCanvasNode` 展开语义并形成一次可撤销操作。“返回原视角”使用独立的 `shotListReturnView`，不与关系聚焦的返回视角互相覆盖。
- 不伪造：没有百分比、没有“完成”布尔表；只有实际计数和当前缺失。复核记录写在视频节点的 `referenceReview` 中，保存的是当前 `assetId/versionId` 或素材指纹，不是易过期布尔值。

## C02 节点操作与编辑入口

- 工具条定位 `nodeOverlayPosition`：
  - 候选位置按到选中节点的最短距离排序，距离相同再按原位置距离排序，优先贴近选中内容。
  - 新增画布边缘/角落停靠槽；当节点仍在画布内但最近可用位置仍被推远（>200px）时返回 `placement: 'docked'` 和 `dock` 方向。
  - 工具条始终硬性避开源节点；障碍（其他节点、已打开的下方对话框）优先完全避开，确实无空位时才选重叠面积最小的位置。
  - 保留既有 composer/panel 定位、顶部 60px / 底部 85px 安全带、横图/竖图/靠边/窄画布行为；原有 21 个 node-popover 测试全部通过。
  - 停靠时工具条显示「关联「节点名」」，并设置虚线边框与 `aria-live` 文本。
- 编辑路线：
  - `openNodeTool` 中文稿/剧本节点统一进入 `script` 工具：编辑文稿打开「文稿」页签，设计分镜进入分镜表；镜头节点进入对应镜头的分镜表。
  - 文字节点仍保留原位编辑（`inlineNodeText`）；资产提示词仍进入素材页；所有原有助手、版本、视频、素材动作保留。
  - 侧栏工具条原「创作助手」改为「文稿与分镜」，全局创作助手只保留顶部入口；导演台白模助手不变。
- 键盘和事件：
  - 镜头清单内 Delete/Backspace 不会删除画布节点；面板内 Esc 关闭；点击、滚轮、右键不会触发画布框选或画布菜单。
  - 输入框/文本域中的 Delete 继续不删除节点；节点 Delete/Backspace、Esc/空白关闭、焦点可见和对话框 Tab/焦点行为保持不变。

## C03 生成图片与资产版本联通

- 来源绑定：
  - 打开图片生成时，若源节点是资产提示词/资产正式图片，记录 `{kind:'asset', assetId}`；若是镜头节点，记录 `{kind:'shot', shotId, assetIds}`；空白或普通节点不记录。
  - 提交图片任务时捕获该上下文并写入本机图片任务记录；任务完成、从任务中心恢复、关闭后再恢复都使用同一来源，不会因为源节点后来变化而误绑其他资产。
  - 结果节点带 `imageResultContext`；没有上下文时节点工具条不出现资产采用动作。
- 采用：
  - 节点工具条「加入资产版本」「设为正式图」；一个镜头关联多个资产时必须在对话框中选择，选择列表只来自该来源上下文，`applyGeneratedImageToAsset` 再次校验来源，拒绝改加到其他资产。
  - “仅加入版本”只在需要时新增版本，不改变正式图；“设为正式图”复用同一版本并切换 `selectedImageId`、写 `storyImageRef`，让 `imageNodeFor` 优先当前版本；旧正式图节点保留自己的版本指针、像素和媒体字节。
  - 采用前先调用 `planGeneratedImageAdoption`：同一节点、同一资产且 `srcHash` 未变时复用 `node.assetImageRef` 指向的仍存在版本；此时不再写 `mediaStore`、不再追加版本，只在需要正式图时切换指针并走 `checkpoint()`。
  - 只有首次采用、原版本已删除或图片真实内容变化时才把生成图写入现有 `mediaStore` 并新增一个版本；失败会回滚工程并删除刚写入的媒体；撤销恢复工程快照，旧版本/旧节点/旧字节仍在。
  - 只改动资产版本、图片节点来源和 `assetImageLink` 连线；不改视频 `src`、剪辑 `sequence`、任务记录或已提交任务。
- 正式图变更影响：
  - 素材页「选为正式图」和移除官方版本都会显示影响对话框：关联镜头（镜号+场景）、既有旧正式图、引用该资产的视频数量、剪辑使用段数；明确说明旧视频、剪辑、任务不会被静默重写，并提示去镜头清单复核。
  - 取消不修改；确认后才 `checkpoint` 修改。
- 复核：
  - 参考快照 `referenceSnapshot` 在报价/提交时捕获每个参考节点的 `assetId/versionId` 或 16 位短素材指纹，随任务记录持久化；结果节点使用任务里的提交快照，而不是落地时的当前工程。
  - 待复核由当前 `selectedImageId` 与提交快照版本比较推导；旧视频没有快照时标记 `legacy/unknown`，只用图片节点版本与 `createdAt` 做保守推导，不把当前数据冒充历史。
  - 清单「复核参考变更」逐条列出视频与原因；确认后把当前版本 ID/指纹写入该视频的 `referenceReview`，再次更换正式图会重新待复核。参考节点或参考资产缺失统一用参考节点 ID 记录到 `review.missing`，确认后在资产仍缺失时不会重复 pending；节点/资产恢复且内容再变化会重新提示。

## 测试结果

实际执行（2026-10-18，本机隔离副本）：

- `npm test`
  - tests 609 / pass 599 / fail 0 / skipped 10 / todo 0
  - 新增覆盖：未完成镜头、已采用版本、正式图更换影响镜头、复核不重写视频/剪辑、旧版推导、白模预演、错误资产拒绝、非资产不绑定、撤销保留旧版本、14 镜全量渲染、忙碌低倍画布停靠、横竖图/靠边/尺寸变化回归；本轮新增共享资产双镜归属、生成图版本复用（含 20 版本上限下设正式）、提交快照 A→B、任务保存/重启往返、旧任务 unknown、删资产后复核清除与恢复重提示。
- `npm run build`
  - 成功，123 modules transformed。
  - 产物：`dist/index.html`、`dist/assets/index-*.css`、`dist/assets/index-*.js`、`dist/assets/three-*.js`。
  - 仅有 Vite 的 chunk >500KB 提示，无错误。
- `npm run test:server`
  - tests 11 / pass 11 / fail 0。
  - 包含本机服务健康版本 1.21.0、静态产物、工作台 API、上传限制与真实 ffmpeg 导出。

未修改原测试来掩盖失败：`final-review` 仅注入新增依赖，仍执行真实 `watchImage`；`workstation-server` 的版本断言是版本同步的一部分；其余为新增断言/新增测试文件。

## 未完成、依赖与取舍

- 浏览器/桌面真实布局验收未由本开发者执行（按任务由 Codex 独立验收）。已按 1440×940 / 1080×720 写响应式 CSS，并让清单以浮层覆盖、打开侧栏工具时自动收起，但未做真实截图比对。
- C01 的低倍摘要优化未做（任务标注“如易做可优化”），本批优先保证清单信息完整和操作正确。
- 镜头定位在命中收起分组时沿用既有 `locateCanvasNode`：会展开分组并产生一次可撤销操作；视角返回与它独立，分组展开状态不会自动恢复。这样保留“定位到具体镜头”的精确性，但会改变分组收起状态。
- 旧工程中已经生成、且没有 `referenceSnapshot` / `generatedAt` 的视频，无法百分百还原当时参考；任务接口将其标记为 `legacy/unknown`，只做保守推导，不读取当前工程冒充历史。新生成的视频都有提交时快照。
- 缺失参考被确认后，只要节点/资产仍缺失就不会重复 pending；节点或资产恢复时会清理过期 missing 标记，之后再次缺失或内容变化会重新提示。
- 素材页更换正式图后，画布图片节点仍沿用原有「更新画布节点」同步路线；本次没有自动改写画布节点。镜头清单和视频参考变更会立即按资产当前正式图推导，避免静默覆盖。
- 撤销采用操作后，新写入的媒体字节不会自动删除（沿用现有“历史/撤销不丢字节”策略，可能留下本机未引用媒体）；已删除版本的旧字节同样保留。
- 构建脚本改为 `vite build --configLoader native` 是本机共享只读 `node_modules` 的沙箱限制所需；Vite 6.4.4 支持该参数，产物与普通 build 一致。
- 未调用任何付费图片/视频服务；测试使用固定 base64 图片与本地 Blob，不读取密钥、不修改账号或授权配置。
