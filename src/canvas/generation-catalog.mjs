// 画布生成器的纯数据/纯函数：模型估算、提示词模板、参数记忆 key。
// 不依赖 DOM；main.mjs 负责 localStorage 和 UI。

export const H3_SECTIONS = [
  'subject_definitions',
  'summary',
  'retention_analysis',
  'detailed_description',
  'overall_soundscape',
  'non_diegetic_music',
];

export const H3_PROMPT_TEMPLATE = `subject_definitions: <Subject 1> 是 <Picture 1> 中的……（人物/服装/场景）；<Subject 2> 是 <Picture 2> 中的……。
summary: 一句话说明本镜头要发生什么。
retention_analysis: <Subject 1> 的面部、发型、服装与 <Picture 1> 保持一致；<Subject 2> 与 <Picture 2> 保持一致，不得互换或融合。
detailed_description: [Shot 1] 景别、机位、主体动作、环境与光线；[Shot 2] 如有分镜继续写。
overall_soundscape: 环境声、动作声、对白有无。
non_diegetic_music: 配乐或无配乐。`;

export const QWEN_EDIT_TEMPLATE = '把画面中的……改成……；保留人物身份、发型、服装、构图和光线；不要改变没有提到的部分。';
export const IMAGE_TEMPLATE = '电影感画面：主体……；动作/状态……；环境……；镜头……；光线……；材质与色调……；不要文字、水印、畸形。';
export const VIDEO_TEMPLATE = '主体：……；动作：……；镜头：……；环境：……；光线：……；风格：……；声音：……。';
export const AUDIO_TEMPLATE = '旁白/对白：……；语气：……；环境声：……；不要背景音乐。';

export const MODEL_ESTIMATES = {
  'video:comfyui:h3': '约 2–3 分钟 · 显存 ~6G',
  'video:comfyui:h3-ref2v': '约 2–4 分钟 · 显存 ~6G',
  'video:comfyui:h3-ultimate': '约 2–3 分钟 · 显存 4.5G / 内存 28G',
  'video:comfyui:wan22': '约 3–6 分钟 · 显存 ~9G',
  'video:comfyui:ltx23': '约 2 分钟 · 显存 ~10G',
  'video:comfyui:framepack': '约 16–26 分钟 · 显存 ~6G',
  'video:comfyui:relayvsr-x2': '约 30 秒/5 秒片段 · 显存 7G / 内存 18G',
  'image:comfyui:qwen21-t2i': '约 30–60 秒 · 显存 ~4.5G / 内存 26G',
  'image:comfyui:qwen21-edit': '约 45 秒 · 显存 ~6G / 内存 27G',
  'image:comfyui:qwen21-rmbg': '约 45 秒 · 显存 ~6G',
  'image:comfyui:qwen21-pose': '约 45 秒 · 显存 ~7G',
  'image:comfyui:qwen21-depth': '约 50 秒 · 显存 ~11G（勿并行）',
  'image:comfyui:qwen21-edges': '约 45 秒 · 显存 ~8G',
};

export const QWEN_EDIT_WORKFLOWS = ['qwen21-edit', 'qwen21-rmbg', 'qwen21-pose', 'qwen21-depth', 'qwen21-edges'];
export const H3_SIX_SECTION_MODELS = ['h3-ref2v', 'h3-ultimate'];

export function modelDefaultsKey({ type = 'video', provider = 'comfyui', model = '', workflow = '' } = {}) {
  const selector = type === 'image' ? (workflow || model) : (model || 'default');
  return `${type}:${provider}:${selector || 'default'}`;
}

export function pickSavedParams(saved) {
  if (!saved || typeof saved !== 'object') return {};
  const allowed = ['ratio', 'resolution', 'durationSeconds', 'outputCount', 'megapixels'];
  return Object.fromEntries(Object.entries(saved).filter(([name]) => allowed.includes(name)));
}

export function estimateForModel(key) {
  return MODEL_ESTIMATES[key] || '';
}

export function missingH3Sections(prompt) {
  const text = String(prompt || '');
  return H3_SECTIONS.filter((key) => !new RegExp(`(^|\\n)\\s*${key}\\s*:`, 'i').test(text));
}

export function promptTemplateFor({ type = 'video', model = '', workflow = '' } = {}) {
  if (['h3', 'h3-ref2v', 'h3-ultimate'].includes(model)) return { label: 'H3 六段结构模板（替换当前提示词）', text: H3_PROMPT_TEMPLATE };
  if (QWEN_EDIT_WORKFLOWS.includes(workflow)) return { label: 'Qwen 编辑指令模板', text: QWEN_EDIT_TEMPLATE };
  if (type === 'image') return { label: '电影感画面模板', text: IMAGE_TEMPLATE };
  if (type === 'video') return { label: '视频运动描述模板', text: VIDEO_TEMPLATE };
  return { label: '音频描述模板', text: AUDIO_TEMPLATE };
}

export function requiresH3Sections(model) {
  return H3_SIX_SECTION_MODELS.includes(model);
}

export function qwenModeNeedsImage(workflow) {
  return QWEN_EDIT_WORKFLOWS.includes(workflow);
}
