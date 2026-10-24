import {ProviderError} from './contracts.mjs';

export const H3_MODELS = Object.freeze({
  unet: 'minimax_h3_ref2va_pruned_int8_convrot.safetensors',
  clip: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',
  videoVae: 'minimax_h3_video_vae_int8_convrot.safetensors',
  audioVae: 'minimax_h3_audio_vae_fp32.safetensors',
  lora: 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors',
});

const timeout = (ms = 5000) => AbortSignal.timeout(ms);

/** Probe a local ComfyUI for the MiniMax H3 reference-to-video interface.
 * This never downloads weights and never submits a generation. */
export async function probeComfyH3({baseUrl, fetchImpl = fetch, signal = timeout()} = {}) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  if (!base) throw ProviderError('INVALID_INPUT', '缺少 ComfyUI 地址');
  const get = async path => {
    const response = await fetchImpl(`${base}${path}`, {signal});
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    return response.json();
  };
  const missing = [];
  let nodeAvailable = false;
  let version = null;
  let modelOptions = {unet: [], clip: [], vae: []};
  try {
    const stats = await get('/system_stats').catch(() => null);
    version = stats?.system?.comfyui_version || null;
  } catch {}
  try {
    const info = await get('/object_info/MiniMaxH3ReferenceToVideo');
    nodeAvailable = Boolean(info?.MiniMaxH3ReferenceToVideo);
  } catch { /* node may be absent on older ComfyUI */ }
  const options = async (path, key) => {
    try {
      const info = await get(path);
      return info?.[key]?.input?.required?.unet_name?.[0]
        || info?.[key]?.input?.required?.ckpt_name?.[0]
        || info?.[key]?.input?.required?.vae_name?.[0]
        || info?.[key]?.input?.required?.clip_name?.[0]
        || [];
    } catch { return []; }
  };
  modelOptions = {
    unet: await options('/object_info/UNETLoader', 'UNETLoader'),
    clip: await options('/object_info/CLIPLoader', 'CLIPLoader'),
    vae: await options('/object_info/VAELoader', 'VAELoader'),
  };
  if (!nodeAvailable) missing.push('node:MiniMaxH3ReferenceToVideo');
  if (!modelOptions.unet.includes(H3_MODELS.unet)) missing.push(`unet:${H3_MODELS.unet}`);
  if (!modelOptions.clip.includes(H3_MODELS.clip)) missing.push(`clip:${H3_MODELS.clip}`);
  if (!modelOptions.vae.includes(H3_MODELS.videoVae)) missing.push(`vae:${H3_MODELS.videoVae}`);
  if (!modelOptions.vae.includes(H3_MODELS.audioVae)) missing.push(`vae:${H3_MODELS.audioVae}`);
  return {
    providerId: 'comfyui-h3',
    baseUrl: base,
    installed: missing.length === 0,
    nodeAvailable,
    comfyVersion: version,
    models: H3_MODELS,
    modelOptions,
    missing,
    note: missing.length ? '只保留接口：需要自行安装 ComfyUI H3 节点和模型，造梦工坊不会自动下载。' : 'H3 接口可用。',
  };
}

export function createComfyH3Provider({baseUrl, fetchImpl = fetch, store = null} = {}) {
  const probe = () => probeComfyH3({baseUrl, fetchImpl});
  return {
    providerId: 'comfyui-h3',
    async status() { return probe(); },
    async listModels() {
      const status = await probe();
      return status.installed ? [{id: 'minimax-h3-r2v', name: 'MiniMax H3 R2V（本地）', kind: 'video', referenceVideo: true}] : [];
    },
    descriptor() {
      return {id: 'comfyui-h3', label: 'ComfyUI MiniMax H3（本地）', capabilities: {video: {textToVideo: true, imageToVideo: true, videoReference: true, firstLastFrame: true, referenceLimits: {images: 30, videos: 10, audios: 10, total: 50}}}};
    },
    async quote() { throw ProviderError('H3_NOT_INSTALLED', '本地 H3 接口尚未安装模型；请先在 ComfyUI 安装 H3 模型，造梦工坊不会自动下载。'); },
    async submit() { throw ProviderError('H3_NOT_INSTALLED', '本地 H3 接口尚未安装模型；当前只保留接口。'); },
    async poll() { throw ProviderError('H3_NOT_INSTALLED', '本地 H3 接口尚未安装模型；当前只保留接口。'); },
  };
}
