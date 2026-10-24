import {randomUUID} from 'node:crypto';
import {ProviderError} from './contracts.mjs';
import {createTaskStore} from './task-store.mjs';

export const COMFYUI_BASE_URL = 'http://127.0.0.1:8188';
export const COMFYUI_DEFAULT_SIZE = '1024x1024';

const SIZES = ['512x512', '768x768', '1024x1024', '1024x768', '768x1024', '1280x720', '720x1280'];
const DEFAULT_NEGATIVE = 'low quality, blurry, watermark, text, logo';

/** ComfyUI 本地文生图适配器（默认 SDXL 基础工作流）。 */
export function createComfyProvider({
  baseUrl = COMFYUI_BASE_URL,
  fetchImpl = fetch,
  store = createTaskStore(),
  clientId = randomUUID(),
  defaultModel,
  now = Date.now,
} = {}) {
  const base = String(baseUrl || COMFYUI_BASE_URL).replace(/\/+$/, '');
  const quotes = new Map();

  const request = async (path, options = {}, timeout = 30000) => {
    let response;
    try {
      const form = options.body instanceof FormData;
      response = await fetchImpl(base + path, {...options, headers: {...(form ? {} : {'Content-Type': 'application/json'}), ...(options.headers || {})}, signal: AbortSignal.timeout(timeout)});
    } catch (error) {
      throw new ProviderError('COMFY_UNREACHABLE', `ComfyUI 未启动或不可访问：${error.message}`);
    }
    if (!response.ok) {
      let message = `ComfyUI 请求失败（HTTP ${response.status}）`;
      try {
        const data = await response.json();
        if (data?.error?.message) message = data.error.message;
        else if (data?.error) message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      } catch {}
      throw new ProviderError(response.status === 404 ? 'COMFY_NOT_FOUND' : 'COMFY_UPSTREAM', message);
    }
    return response;
  };

  const listModels = async () => {
    const response = await request('/object_info/CheckpointLoaderSimple');
    const data = await response.json();
    const raw = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
    const models = Array.isArray(raw) ? raw : [];
    return models.filter(name => typeof name === 'string' && name).map(name => ({
      id: name,
      name,
      kind: 'image',
      default: defaultModel ? name === defaultModel : false,
    }));
  };

  const workflowFor = (quote, uploadedReference = null) => {
    const [width, height] = quote.size.split('x').map(Number);
    if (uploadedReference) return {
      3: {class_type: 'KSampler', inputs: {seed: quote.seed, steps: quote.steps, cfg: quote.cfg, sampler_name: 'euler', scheduler: 'normal', denoise: quote.denoise, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['11', 0]}},
      4: {class_type: 'CheckpointLoaderSimple', inputs: {ckpt_name: quote.modelId}},
      6: {class_type: 'CLIPTextEncode', inputs: {text: quote.prompt, clip: ['4', 1]}},
      7: {class_type: 'CLIPTextEncode', inputs: {text: quote.negative, clip: ['4', 1]}},
      8: {class_type: 'VAEDecode', inputs: {samples: ['3', 0], vae: ['4', 2]}},
      9: {class_type: 'SaveImage', inputs: {filename_prefix: 'cineweave', images: ['8', 0]}},
      10: {class_type: 'LoadImage', inputs: {image: uploadedReference}},
      11: {class_type: 'VAEEncode', inputs: {pixels: ['10', 0], vae: ['4', 2]}},
    };
    return {
      3: {class_type: 'KSampler', inputs: {seed: quote.seed, steps: quote.steps, cfg: quote.cfg, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0]}},
      4: {class_type: 'CheckpointLoaderSimple', inputs: {ckpt_name: quote.modelId}},
      5: {class_type: 'EmptyLatentImage', inputs: {width, height, batch_size: 1}},
      6: {class_type: 'CLIPTextEncode', inputs: {text: quote.prompt, clip: ['4', 1]}},
      7: {class_type: 'CLIPTextEncode', inputs: {text: quote.negative, clip: ['4', 1]}},
      8: {class_type: 'VAEDecode', inputs: {samples: ['3', 0], vae: ['4', 2]}},
      9: {class_type: 'SaveImage', inputs: {filename_prefix: 'cineweave', images: ['8', 0]}},
    };
  };

  const provider = {
    id: 'comfyui',
    label: 'ComfyUI（本地）',
    enabled: true,
    capabilities: {
      image: {textToImage: true, imageToImage: true, reference: true, sizes: SIZES, aspects: ['1:1', '4:3', '3:4', '16:9', '9:16']},
      video: {textToVideo: false, imageToVideo: false, videoReference: false, firstLastFrame: false, durations: [], resolutions: [], referenceLimits: {images: 0, videos: 0, audios: 0, total: 0}},
    },
    async listModels() { return listModels(); },
    async health() {
      try {
        const response = await request('/system_stats', {}, 5000);
        const data = await response.json();
        return {ok: true, providerId: 'comfyui', configured: true, enabled: true, version: data?.system?.comfyui_version || null, baseUrl: base};
      } catch (error) {
        return {ok: false, providerId: 'comfyui', configured: true, enabled: false, baseUrl: base, error: error.message};
      }
    },
    async quote(input = {}) {
      if (typeof input.modelId !== 'string' || !input.modelId) throw new ProviderError('INVALID_INPUT', '请选择 ComfyUI 模型');
      if (typeof input.prompt !== 'string' || !input.prompt.trim()) throw new ProviderError('INVALID_INPUT', '提示词不能为空');
      if (input.prompt.length > 6000) throw new ProviderError('INVALID_INPUT', '提示词不能超过 6000 字符');
      const size = input.size ? String(input.size) : COMFYUI_DEFAULT_SIZE;
      if (!SIZES.includes(size)) throw new ProviderError('INVALID_INPUT', `不支持的尺寸：${size}`);
      const models = await listModels();
      if (!models.some(model => model.id === input.modelId)) throw new ProviderError('MODEL_NOT_FOUND', `模型不存在：${input.modelId}`);
      const reference = typeof input.reference === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.reference) ? input.reference : null;
      const quoteId = randomUUID();
      quotes.set(quoteId, {
        providerId: 'comfyui',
        modelId: input.modelId,
        prompt: input.prompt,
        negative: typeof input.negative === 'string' && input.negative.trim() ? input.negative : DEFAULT_NEGATIVE,
        size,
        steps: Number.isFinite(input.steps) ? Math.min(60, Math.max(1, Math.round(input.steps))) : 20,
        cfg: Number.isFinite(input.cfg) ? Math.min(20, Math.max(1, input.cfg)) : 7,
        seed: Number.isFinite(input.seed) ? Math.abs(Math.round(input.seed)) : Math.floor(Math.random() * 1e9),
        reference,
        denoise: Number.isFinite(input.denoise) ? Math.min(0.95, Math.max(0.05, input.denoise)) : 0.65,
        projectId: input.projectId || null,
        expiresAt: now() + 10 * 60 * 1000,
      });
      return {quoteId, providerId: 'comfyui', modelId: input.modelId, kind: 'image', cost: 0, currency: 'CNY', note: '本地生成，不产生云端费用', size, steps: quotes.get(quoteId).steps};
    },
    async submit(input = {}) {
      const quote = quotes.get(input.quoteId);
      if (!quote || quote.expiresAt < now()) throw new ProviderError('QUOTE_EXPIRED', '报价已过期，请重新获取');
      const task = store.create({providerId: 'comfyui', modelId: quote.modelId, kind: 'image', projectId: input.projectId || quote.projectId, sourceId: input.sourceId, prompt: quote.prompt});
      store.update(task.id, {status: 'running', progress: 0.1, message: '正在提交 ComfyUI…'});
      try {
        let uploadedReference = null;
        if (quote.reference) {
          const match = quote.reference.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
          if (!match) throw new ProviderError('INVALID_INPUT', '参考图格式不支持');
          const form = new FormData();
          form.append('image', new Blob([Buffer.from(match[2], 'base64')], {type: match[1]}), 'cineweave-reference.' + (match[1].includes('png') ? 'png' : match[1].includes('webp') ? 'webp' : 'jpg'));
          const uploaded = await request('/upload/image', {method: 'POST', body: form}, 60000);
          const info = await uploaded.json();
          uploadedReference = info?.name ? (info.subfolder ? info.subfolder + '/' + info.name : info.name) : null;
          if (!uploadedReference) throw new ProviderError('COMFY_UPSTREAM', 'ComfyUI 参考图上传失败');
        }
        const response = await request('/prompt', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: workflowFor(quote, uploadedReference), client_id: clientId})});
        const data = await response.json();
        const promptId = data?.prompt_id;
        if (!promptId) throw new ProviderError('COMFY_UPSTREAM', 'ComfyUI 没有返回任务 ID');
        store.update(task.id, {remoteId: promptId, progress: 0.2, message: 'ComfyUI 正在生成…'});
        return {taskId: task.id, task: store.get(task.id)};
      } catch (error) {
        store.update(task.id, {status: 'failed', error: {code: error.code || 'COMFY_UPSTREAM', message: error.message}, message: error.message});
        throw error;
      }
    },
    async poll(taskId) {
      const task = store.get(taskId);
      if (!task) throw new ProviderError('TASK_NOT_FOUND', `任务不存在：${taskId}`);
      if (!['queued', 'running'].includes(task.status) || !task.remoteId) return task;
      try {
        const response = await request(`/history/${encodeURIComponent(task.remoteId)}`, {}, 10000);
        const data = await response.json();
        const entry = data?.[task.remoteId];
        if (!entry) return store.update(taskId, {progress: 0.45, message: 'ComfyUI 正在生成…'});
        if (entry.status?.status_str === 'error' || entry.status?.completed === false) {
          const message = entry.status?.messages?.find(m => m[0] === 'execution_error')?.[1]?.exception_message || 'ComfyUI 执行失败';
          return store.update(taskId, {status: 'failed', error: {code: 'COMFY_EXECUTION', message}, message});
        }
        const images = [];
        for (const output of Object.values(entry.outputs || {})) {
          for (const image of output?.images || []) {
            if (!image?.filename) continue;
            images.push({
              index: images.length,
              kind: 'image',
              mime: 'image/png',
              url: `/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder || '')}&type=${encodeURIComponent(image.type || 'output')}`,
              filename: image.filename,
              subfolder: image.subfolder || '',
              type: image.type || 'output',
            });
          }
        }
        if (!images.length) return store.update(taskId, {status: 'failed', error: {code: 'OUTPUT_NOT_FOUND', message: 'ComfyUI 完成但没有返回图片'}, message: 'ComfyUI 完成但没有返回图片'});
        return store.update(taskId, {status: 'succeeded', progress: 1, message: '已生成', outputs: images});
      } catch (error) {
        if (error.code === 'COMFY_UNREACHABLE') return store.update(taskId, {progress: 0.3, message: error.message});
        throw error;
      }
    },
    async cancel(taskId) {
      const task = store.get(taskId);
      if (!task) throw new ProviderError('TASK_NOT_FOUND', `任务不存在：${taskId}`);
      if (['queued', 'running'].includes(task.status)) return store.update(taskId, {status: 'cancelled', message: '已在本地取消（ComfyUI 队列可能继续执行）'});
      return task;
    },
    async download(taskId, index = 0) {
      const task = store.get(taskId);
      if (!task) throw new ProviderError('TASK_NOT_FOUND', `任务不存在：${taskId}`);
      if (task.status !== 'succeeded') throw new ProviderError('TASK_NOT_READY', '任务尚未完成');
      const output = task.outputs[index];
      if (!output?.url) throw new ProviderError('OUTPUT_NOT_FOUND', '没有可下载的图片');
      const response = await request(output.url, {}, 120000);
      return {mime: response.headers.get('content-type') || 'image/png', data: Buffer.from(await response.arrayBuffer()), filename: output.filename || `comfyui-${taskId}.png`};
    },
  };
  return provider;
}
