你负责继续修复造梦工坊1.21.0第一批的独立审核缺陷。工作目录是隔离 source，允许修改这里的源码/测试/IMPLEMENTATION.md，绝对不要尝试写父目录（headless限制，上一轮已浪费大量尝试，父目录报告由Codex复制即可）。不改旧版本/正式工程/账号/共享node_modules，不安装依赖，不调用收费API。无需重新研究整个项目，聚焦下面4项，先读相关函数及现有测试。

1. P1 镜头归属混算：shot-production.mjs sourceIdsForShot 包含镜头关联资产的所有文字/图片，两个镜头共享角色图时，s1的视频会让s2也显示已生成/已剪辑；复核s2还会把s1的视频一起复核。共享资产只能证明参考关系，不能证明归属。以镜头自身节点、明确从该镜头连出的生成入口、该入口自己的结果/版本组为根。没有明确shot归属的资产视频不要分给每个用该资产的镜头，宁可显示未关联。新增2镜共享同asset但只有s1产物的行为回归。

2. P1 重复资产版本：main.js adoptGeneratedImage 每次随机生成version/media。用户同一生成图先“仅加入版本”后“设为正式图”，或反复仅加入会产生重复，20个上限也无法设正式。复用 node.assetImageRef 对应的仍存在版本；已采用到相同资产且src未变时不写新的media/版本，设正式只是select指针且走checkpoint。若图片已被替换需检测真实内容改变允许新版本。applyGeneratedImageToAsset 虽按传入同id去重，但调用方从不传同id。需真实调用方回归或提取可测计划函数，不仅手动传同version掩盖问题。不要删除旧image storyImageRef；上一轮已自修这一点，应保留。

3. P1 提交参考快照：video-generation.mjs planVideoResult 在结果落地时 referenceSnapshotFor(project,job.references) 读取当前图片版本，任务执行期间用户换图会错误标记生成用了新图。必须在报价/确认提交时捕获真实参考src身份和asset/version，并与quote真实payload对应，持久化到现有任务记录或项目中任务关联（不放密钥/大图字节），结果恢复/重启仍用提交时快照。旧任务缺快照不要用当前数据冒充历史，可以保守推断并明确未知。不要改变云端收费防重提/查询恢复。新增提交A后换B结果返回仍记录A且提示复核、恢复保存往返测试。前后端metadata闭环需如实验证。

4. P2 删除资产后无法清复核：pendingVideoReferenceChanges 检查参考资产缺失时用 review.missing，但 reviewShotReferenceChanges 见图片节点还在只写srcHashes，确认后仍pending。统一缺失类型/键，确认可清，之后资产恢复再有变化可重新提示。新增资产删掉但图片节点还在的回归。

已知上一轮最终自修：旧图provenance被删、异常时重复history.pop，因此不用重复报这两项，保持回归。
完成后更新 IMPLEMENTATION.md 写修正说明，运行npm test、npm run build、npm run test:server。不要删除测试、不要把合理失败断言改成源码字符串匹配，保留旧功能。UI验收由Codex做。
