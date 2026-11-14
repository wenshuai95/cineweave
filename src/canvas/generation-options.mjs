// 模型菜单描述：只产出 label / patch / key，实际 setGeneration 由 main 注入。
export const IMAGE_PRESETS = {
  '场景俯视图': '俯视全景视角，清晰展示空间布局与人物站位，电影感布光',
  '连续分镜图': '同一角色连续动作分镜，保持人物与场景一致，电影分镜风格',
  '多机位九宫格': '九宫格多机位构图，同一场景九个不同机位，统一光线与色调',
  '人物三视图': '角色三视图：正面、侧面、背面，统一服装与比例，干净背景',
  '面部三视图': '角色面部三视图：正面、四分之三侧、侧面，细节一致',
  '产品三视图': '产品三视图：正面、侧面、背面，棚拍布光，干净背景',
};

const COMFY_IMAGE = [
  { label: 'Qwen 2.1 · 文生图（1MP/2K）', key: 'image:comfyui:qwen21-t2i', patch: { imageWorkflow: 'qwen21-t2i', resolution: '1024 高清' } },
  { label: 'Qwen 2.1 · 图片编辑', key: 'image:comfyui:qwen21-edit', patch: { imageWorkflow: 'qwen21-edit', resolution: '1024 高清' } },
  { label: 'Qwen 2.1 · 去背景', key: 'image:comfyui:qwen21-rmbg', patch: { imageWorkflow: 'qwen21-rmbg', resolution: '1024 高清' } },
  { label: 'Qwen 2.1 · 姿态', key: 'image:comfyui:qwen21-pose', patch: { imageWorkflow: 'qwen21-pose', resolution: '1024 高清' } },
  { label: 'Qwen 2.1 · 深度', key: 'image:comfyui:qwen21-depth', patch: { imageWorkflow: 'qwen21-depth', resolution: '1024 高清' } },
  { label: 'Qwen 2.1 · 线稿', key: 'image:comfyui:qwen21-edges', patch: { imageWorkflow: 'qwen21-edges', resolution: '1024 高清' } },
  { label: 'Z-Image Turbo（快，1024²）', key: 'image:comfyui:zimage-turbo', patch: { imageWorkflow: 'zimage-turbo' } },
  { label: 'Flux', key: 'image:comfyui:flux-t2i', patch: { imageWorkflow: 'flux-t2i' } },
  { label: 'Juggernaut（写实）', key: 'image:comfyui:photoreal-juggernaut', patch: { imageWorkflow: 'photoreal-juggernaut' } },
  { label: 'RealVis（写实）', key: 'image:comfyui:photoreal-realvis', patch: { imageWorkflow: 'photoreal-realvis' } },
];

const COMFY_VIDEO = [
  { label: 'H3（快，640×352）', key: 'video:comfyui:h3', patch: { model: 'h3', durationSeconds: 5, h3Size: '360P' } },
  { label: 'Wan 2.2（质量，832×480）', key: 'video:comfyui:wan22', patch: { model: 'wan22', durationSeconds: 5, resolution: '480P' } },
  { label: 'LTX-2.3（快，640×384）', key: 'video:comfyui:ltx23', patch: { model: 'ltx23', durationSeconds: 2.7, resolution: '384P' } },
  { label: 'FramePack（长镜头，需首帧）', key: 'video:comfyui:framepack', patch: { model: 'framepack', durationSeconds: 3, resolution: '640P' } },
  { label: 'H3 多模态参考（Ref2VA）', key: 'video:comfyui:h3-ref2v', patch: { model: 'h3-ref2v', durationSeconds: 5, resolution: '352P' } },
  { label: 'H3 Ultimate（首尾帧/续写）', key: 'video:comfyui:h3-ultimate', patch: { model: 'h3-ultimate', durationSeconds: 5, resolution: '352P', megapixels: 0.22 } },
];

const DREAMINA_IMAGE_FALLBACK = [
  { label: 'Seedream 5.0 Flash', key: 'image:dreamina:high_aes_general_v50_flash', patch: { model: 'high_aes_general_v50_flash' } },
  { label: 'Seedream 4.1', key: 'image:dreamina:seedream_4.1', patch: { model: 'seedream_4.1' } },
  { label: '即梦 ImageMax 1.0', key: 'image:dreamina:jimeng_smart_image_v1', patch: { model: 'jimeng_smart_image_v1' } },
];

const DREAMINA_VIDEO_FALLBACK = [
  { label: 'Seedance 2.5', key: 'video:dreamina:seedance_2.5_draft', patch: { model: 'seedance_2.5_draft' } },
  { label: 'Seedance 2.5 Flash', key: 'video:dreamina:seedance_2.5_flash', patch: { model: 'seedance_2.5_flash' } },
  { label: 'Seedance 2.5 VIP', key: 'video:dreamina:seedance_2.5', patch: { model: 'seedance_2.5' } },
];

export function buildModelOptions({ type = 'image', provider = 'comfyui', dreaminaCatalog = {} } = {}) {
  if (type === 'image') {
    if (provider !== 'dreamina') return COMFY_IMAGE;
    const specs = dreaminaCatalog.image || [];
    return specs.length ? specs.map((spec) => ({ label: spec.displayName || spec.model, key: `image:dreamina:${spec.model}`, patch: { model: spec.model } })) : DREAMINA_IMAGE_FALLBACK;
  }
  if (provider !== 'dreamina') return COMFY_VIDEO;
  const specs = dreaminaCatalog.video || [];
  return specs.length ? specs.map((spec) => ({ label: spec.displayName || spec.model, key: `video:dreamina:${spec.model}`, patch: { model: spec.model } })) : DREAMINA_VIDEO_FALLBACK;
}
