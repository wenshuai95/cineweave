镜场离线模型资产包
核实与整理日期：2026-10-10

目录
  manifest.json：模型中文名、分类、GLB路径、作者、来源、许可、动画、建议尺寸和SHA256。
  models/：模型GLB文件（均可直接离线读取，无外部贴图依赖）。
  licenses/：CC0许可全文，以及Kenney每个原始下载包的原版许可说明。

来源和许可
  Kenney Mini Characters — https://kenney.nl/assets/mini-characters
  Kenney Car Kit — https://kenney.nl/assets/car-kit
  Kenney City Kit Suburban — https://kenney.nl/assets/city-kit-suburban
  Quaternius Horse / Shiba Inu / Husky / Cow — 作者发布于 Poly Pizza；逐个来源见 manifest.json。
  Quaternius 官网：https://quaternius.com/packs/ultimateanimatedanimals.html

全部所选资源逐项核实为 CC0 1.0。允许复制、修改、再分发及商业用途，无署名义务。
保留作者与来源便于追溯；此处来源说明不替代随附的完整 CC0 文本。
动物来自作者在 Poly Pizza 的公开发布，已核实每个模型页面的作者与CC0许可，未混入其他作者或CC-BY模型。

整理方式
  Kenney GLB原文件引用每个包各自的 Textures/colormap.png。
  为保证模型真正离线且单文件可移植，整理时将对应PNG嵌入GLB。
  顶点、骨架和动画保留；不附远端脚本，不含执行程序。
  各GLB经结构检查和Three.js GLTFLoader解析校验；无必需的外部资源或远程解码器。

使用与限制
  模型为轻量卡通低多边形预演资产，适合场景布局和运镜，不是写实成片素材。
  defaultHeight为建议米制高度；modelSize为对应包围盒最长边，用于程序等比归一化。
  原GLB坐标单位未修改，请加载后等比缩放并把包围盒最低点放到地面。
  人物/动物内置动作见manifest；不同骨架之间不能直接互换动画，需另行重定向。
  动画名称和是否有动画以GLB实际内容为准；部分动物片段有重复或骨架名称前缀。
  模型加载不需要网络；创建新AI资产仍需另接API，不属于本包能力。

2026-10-10 成人比例骨骼白模补充
  adult-male-rigged.glb — 成人比例男演员，65骨骼，1套skin，14318三角面。
  adult-female-rigged.glb — 成人比例女演员，65骨骼，1套skin，15060三角面。
  两个模型均为 Quaternius Universal Base Characters [Standard] 的Superhero基础人体。
  人体是成人比例、肌肉略理想化，不是大头Q版，也不代表照片级写实人物。
  两个源文件原本无内置动画；当前已补充6种本地制作动作。保留65关节、原蒙皮权重和手指骨骼。
  预演整理只把原贴图材质替换为哑光材质，封装成不含外部依赖的GLB；
  原网格、骨架、蒙皮权重、参考姿态保留。全包当前共有22个模型。
  官方许可来源：https://quaternius.com/packs/universalbasecharacters.html
  官方下载：https://quaternius.itch.io/universal-base-characters
  实际文件来源：GitHub镜像，固定commit 5821923af517ac5fdc82505faa92a0d575fc1b1a
  镜像路径、原始文件名、许可原文、变更说明见manifest.json和licenses/source-evidence.json。
  官方itch站点连接不可用，所以使用镜像数据，并对照官网和原包License_Standard核实CC0。
  当前可直接播放下列6种匹配本骨架的动作；其他骨架动作仍需重定向，不能仅改文件名套用。

2026-10-10 成人骨骼模型动作补充
  男女各嵌入6种本地制作的程序化基础预演动作，非动捕、无第三方动作数据：
  idle — 站立呼吸，3秒；walk — 原地走路，1.2秒；run — 原地跑步，0.72秒；
  wave — 挥手，2.4秒；sit — 坐姿，3秒；cheer — 双手举起，2.4秒。
  每种动作包含19条骨骼旋转/骨盆位移轨道；约30Hz采样，循环首尾完全匹配。
  走/跑没有向前位移，需要配合导演台的位置关键帧或路径；坐姿不含椅子。
  模型原始顶点/骨架/蒙皮数据逐字节保留，新增动作与原骨架直接匹配。
  已检查实际AnimationMixer取样、真实蒙皮顶点变形、骨轴、膝盖方向、
  原地走跑足部弧线、挥手/举手手部高度、坐姿骨盆高度和循环接缝。
  详细证据：licenses/adult-motion-verification.json。
