# CineWeave / 造梦工坊

1.15 refinement: floating New / Library / Assistant utilities replace the full-width second toolbar. Layout, templates and map controls live in More. Multi-selection reveals batch controls. Common tools are directly visible by media type, with infrequent maintenance in More. Reference cards contain their own purpose selectors. The prompt scrolls independently of the model/assistant line. Quotation precedes explicit paid confirmation; edits revoke quotes. Media file maintenance is disclosed under More. Director behavior stays unchanged.

Canvas mode: Operate. Pinned references are the user's 小云雀 captures, October 16, 2026.

Near-black dotted canvas, charcoal media surfaces, neutral white text with restrained violet selection. Node title sits above content. An anchored toolbar shows only real actions for the selected type; a lower composer contains reference chips, prompt, compact model parameters, quote and explicit generation confirmation. Input stays readable. Sidebar is opt-in and resizable. Existing director logic, storage identity, local origin and project schema remain stable.

The app does not imitate capabilities it cannot perform: image generation is currently text-to-image; audio AI generation and advanced editing are not advertised. An upload button is a working file chooser. There are no inert paid-generation buttons.

Verification is bounded to one batch at desktop 1440x940 and 1080x720, one fix batch and one final confirmation. Do not repeat polish loops.

1.16.1 media tools: show frame capture, trim, audio separation, depth and send-to-edit directly on the video toolbar. Each opens one purpose-built panel; no nested tools accordion. Depth is explicitly experimental, capped at 15 seconds / 12fps / 640px; it is not 3D reconstruction. Keep range controls and status together, with explicit cancel. Results become separate linked nodes in free positions. Production checks in candidate previews are deterministic local reminders, not claims of AI judgment.


全软件设计原则（用户 2026-10-17 明确要求）
简洁而优雅。参考 Apple Human Interface Guidelines 的内容优先、清楚层级、熟悉且一致的操作；不把它理解为装饰玻璃或单纯减少按钮。
- 高频动作就地可见，按钮名描述用户要做的事，不用笼统的“素材处理”承载所有功能。
- 同一类节点有一致的工具顺序，保留文字标签；窄窗口换行，不截断、不强制只剩两个按钮。
- 一次弹层完成一个明确任务。必要参数默认可见；高级和维护项才进入“更多”。
- 全局对话框统一字体、表单、关闭按钮、主操作位置、间距和焦点样式；费用、失败、取消、原素材保留等决策信息不能隐藏。
- 不照搬没有真实能力的竞品按钮；保持原工程和导演台业务行为。
参考依据：work/旧版媒体 CLI-study-20261016/研究报告.html；work/updream-study-20261016/Updream全流程实测与升级建议.html；https://developer.apple.com/design/human-interface-guidelines/design-principles

1.16.2 创作助手：默认呈现对话，文稿、任务和设定使用清楚可见的并列入口。对话单独滚动，输入框固定在底部；切换入口保留未发送草稿。候选结果集中预览并明确采用，不自动覆盖画布。文稿保留自动保存、版本与选区改写；运行中保留取消。减少完成步骤和状态的重复显示，错误和费用提示仍可见。验收覆盖桌面窗口与收窄侧栏，使用隔离工程，不调用付费模型。

1.17 白模导演：沿用创作助手侧栏，直接可见的「白模导演」入口，导演台工具栏另设「白模助手」。对话、方案清单、前后画面与采用操作在同一处完成。方案先本机预览再采用，一次修改可撤销。明确模型朝向未知及面部/手指能力边界；不显示无法执行的工具。

1.18 白模视觉审片：沿用同一侧栏，输入框上方只保留附带画面开关和当前镜头/全片概览范围。看图审片直接可见；候选方案固定显示预览、AI复查、采用和丢弃。截图只在当前操作保留，不进入工程；费用和发送到模型服务的说明可见。稀疏静帧不等于完整动画验收，每次复查只发起一个模型请求，修正后重新本机预览，不自动采用。

1.19 审查落实：常用操作保持可见，优先保证目标、动作和结果可预测。创作工具与画布共享窗口空间，不覆盖全局动作；窄窗临时收起对象栏但不改保存布局，关闭工具自动恢复。普通发送用于讨论，制作走明确动作；节点入口带入正文与参考范围。候选保持可继续调整，预览和最后采用是不同状态。素材删除提前说明时间线引用影响。剪辑标准按钮键盘操作优先于播放快捷键。节点列表、项目素材和工程命名一致；导出使用紧凑摘要、明确去向。使用报告 work/ui-audit-20261018 的真实截图作为对照，未完成项不宣称已修复。

1.20 审查收尾：任务候选留在同一对话，版本在文稿内展开；所有任务入口读取各引擎的原任务记录，不另存一套状态。恢复只查询已提交任务，无取消接口不提供假取消。选中节点突出直接参考关系，聚焦与返回只变视角；空画布直接写故事或导入。标准弹窗固定标题与尾部动作，仅正文滚动；本机保存、备份恢复优先于技术存储详情。导演台仅提供对象筛选，不改动作、运镜和渲染逻辑。
