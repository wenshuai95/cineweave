import {randomUUID} from 'node:crypto';
import {ProviderError} from './contracts.mjs';
import {createTaskStore} from './task-store.mjs';
import {normalizeReferenceLimits,referenceCounts,referenceLimitProblem,sanitizeReferenceList} from './reference-policy.mjs';

export const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
export const ARK_PLAN_BASE_URL = 'https://ark.cn-beijing.volces.com/api/plan/v3';
export const SEEDANCE_DEFAULT_MODEL = 'doubao-seedance-1-0-pro-250528';
export const SEEDANCE25_DEFAULT_MODEL = 'doubao-seedance-2-5-260628';
export const SEEDANCE25_DEFAULT_ENDPOINT = '/contents/generations/tasks';
export const SEEDANCE25_REFERENCE_LIMITS = Object.freeze({images: 30, videos: 10, audios: 10, total: 50});
export const SEEDANCE25_DURATIONS = Object.freeze([4,5,6,8,10,12,15,20,25,30]);
export const SEEDANCE25_RESOLUTIONS = Object.freeze(['480p','720p','1080p']);
const SEEDANCE1_LIMITS = Object.freeze({images: 1, videos: 0, audios: 0, total: 1});

const VIDEO_MIME = 'video/mp4';

/** Seedance 视频适配器。默认 feature flag 关闭；真实调用会按方舟计费。 */
export function createSeedanceProvider({
  apiKey = '',
  baseUrl = ARK_BASE_URL,
  fetchImpl = fetch,
  enabled = false,
  store = createTaskStore(),
  defaultModel = SEEDANCE_DEFAULT_MODEL,
  seedance25Enabled = false,
  seedance25Model = SEEDANCE25_DEFAULT_MODEL,
  seedance25Endpoint = SEEDANCE25_DEFAULT_ENDPOINT,
  now = Date.now,
} = {}) {
  const base = String(baseUrl || ARK_BASE_URL).replace(/\/+$/, '');
  const quotes = new Map();

  const guard = () => {
    if (!enabled) throw new ProviderError('FEATURE_DISABLED', 'Seedance 视频尚未开启（feature flag 关闭）');
    if (!apiKey) throw new ProviderError('UNAUTHORIZED', '请先在设置中填写 Seedance API Key');
  };
  const request = async (path, options = {}, timeout = 120000) => {
    let response;
    try {
      response = await fetchImpl(/^https?:\/\//.test(path) ? path : base + path, {...options, headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(options.headers || {})}, signal: AbortSignal.timeout(timeout)});
    } catch (error) {
      throw new ProviderError('NETWORK', `Seedance 连接失败：${error.message}`);
    }
    let data = {};
    try { data = await response.json(); } catch {}
    if (response.ok) return data;
    const code = data?.error?.code || '';
    const message = data?.error?.message || `Seedance 请求失败（HTTP ${response.status}）`;
    if (/AccountOverdue|InsufficientBalance/i.test(code)) throw new ProviderError('PAYMENT_REQUIRED', '火山方舟账户余额不足或已欠费');
    if (/ModelNotOpen/i.test(code)) throw new ProviderError('MODEL_NOT_OPEN', '当前账号未开通该 Seedance 模型');
    if (/SetLimitExceeded|RateLimit/i.test(code) || response.status === 429) throw new ProviderError('RATE_LIMITED', 'Seedance 额度已用完或触发限流');
    if (response.status === 401 || response.status === 403) throw new ProviderError('UNAUTHORIZED', 'Seedance API Key 无效或无权限');
    if (response.status === 400) throw new ProviderError('INVALID_INPUT', message);
    throw new ProviderError('UPSTREAM', message);
  };

  const isSeedance25 = modelId => modelId === seedance25Model || /^doubao-seedance-2-5/.test(String(modelId || ''));
  const endpointPath = () => {
    const raw = String(seedance25Endpoint || SEEDANCE25_DEFAULT_ENDPOINT).replace(/\/+$/, '');
    return /^https?:\/\//.test(raw) ? raw : raw.startsWith('/') ? raw : '/' + raw;
  };
  const mediaUrl = reference => {
    if (typeof reference?.url === 'string' && /^https?:\/\//.test(reference.url)) return reference.url;
    if (reference?.kind === 'image' && typeof reference.data === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(reference.data)) return reference.data;
    return '';
  };

  const provider = {
    id: 'seedance',
    label: 'Seedance（即梦视频）',
    enabled,
    capabilities: {
      image: {textToImage: false, imageToImage: false, reference: false, sizes: [], aspects: []},
      video: {textToVideo: true, imageToVideo: true, videoReference: true, firstLastFrame: false, durations: [...SEEDANCE25_DURATIONS], resolutions: [...SEEDANCE25_RESOLUTIONS], referenceLimits: {...SEEDANCE25_REFERENCE_LIMITS}},
    },
    async listModels() {
      guard();
      const models = [
        {id: 'doubao-seedance-1-0-pro-250528', name: 'Seedance 1.0 Pro', kind: 'video', modelFamily: 'seedance1', durations: [5, 10], resolutions: ['720p', '1080p'], referenceLimits: {...SEEDANCE1_LIMITS}},
        {id: 'doubao-seedance-1-0-lite-t2v-250428', name: 'Seedance 1.0 Lite', kind: 'video', modelFamily: 'seedance1', durations: [5, 10], resolutions: ['720p', '1080p'], referenceLimits: {...SEEDANCE1_LIMITS}},
        {id: seedance25Model, name: 'Seedance 2.5（多素材参考）', kind: 'video', modelFamily: 'seedance25', durations: [...SEEDANCE25_DURATIONS], resolutions: [...SEEDANCE25_RESOLUTIONS], referenceLimits: {...SEEDANCE25_REFERENCE_LIMITS}, supportsReferences: true, available: seedance25Enabled, ...(seedance25Enabled ? {} : {unavailableReason: 'Seedance 2.5 未启用：设置 ARK_SEEDANCE_25_ENABLED=1 后重新打开应用'})},
      ];
      const preferred = seedance25Enabled && defaultModel === 'seedance25' ? seedance25Model : defaultModel;
      return models.map(model => ({...model, default: model.id === preferred || (preferred === defaultModel && model.id === defaultModel)}));
    },
    async health() {
      return {ok: enabled && Boolean(apiKey), providerId: 'seedance', configured: Boolean(apiKey), enabled, featureFlag: enabled, seedance25: {enabled: seedance25Enabled, model: seedance25Model, endpoint: seedance25Endpoint}};
    },
    async quote(input = {}) {
      guard();
      if (typeof input.prompt !== 'string' || !input.prompt.trim()) throw new ProviderError('INVALID_INPUT', '提示词不能为空');
      if (input.prompt.length > 6000) throw new ProviderError('INVALID_INPUT', '提示词不能超过 6000 字符');
      const modelId = input.modelId || defaultModel;
      const references = sanitizeReferenceList(input.references);
      const quoteId = randomUUID();
      if (isSeedance25(modelId)) {
        if (!seedance25Enabled) throw new ProviderError('FEATURE_DISABLED', 'Seedance 2.5 未启用：设置 ARK_SEEDANCE_25_ENABLED=1 并重新打开应用');
        const duration = Number.isInteger(Number(input.duration)) && Number(input.duration) >= 4 && Number(input.duration) <= 30 ? Number(input.duration) : 5;
        const resolution = SEEDANCE25_RESOLUTIONS.includes(input.resolution) ? input.resolution : '720p';
        const aspect = typeof input.aspect === 'string' && /^(16:9|9:16|1:1|4:3|3:4|21:9|adaptive)$/.test(input.aspect) ? input.aspect : null;
        const limits = normalizeReferenceLimits(SEEDANCE25_REFERENCE_LIMITS);
        const problem = referenceLimitProblem(references, limits);
        if (problem) throw new ProviderError('REFERENCE_LIMIT', problem);
        for (const reference of references) {
          if (!mediaUrl(reference)) throw new ProviderError('INVALID_INPUT', `${reference.kind === 'video' ? '视频' : '音频'}参考需要可访问的 http(s) URL；本地内嵌${reference.kind === 'video' ? '视频' : '音频'}暂不能直传`);
        }
        quotes.set(quoteId, {modelId, prompt: input.prompt, duration, resolution, aspect, references, family: 'seedance25', endpoint: endpointPath(), projectId: input.projectId || null, expiresAt: now() + 10 * 60 * 1000});
        return {quoteId, providerId: 'seedance', modelId, kind: 'video', cost: null, currency: 'CNY', note: 'Seedance 2.5 按方舟实际计费；提交后不可撤销', duration, resolution, referenceCount: references.length};
      }
      if (references.length > 1 || references.some(reference => reference.kind !== 'image')) throw new ProviderError('INVALID_INPUT', 'Seedance 1.0 只支持 1 张图片参考；多素材请选择 Seedance 2.5');
      const imageFromReference = references.length ? mediaUrl(references[0]) : '';
      const image = typeof input.image === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.image) ? input.image : (imageFromReference || null);
      const duration = [5, 10].includes(Number(input.duration)) ? Number(input.duration) : 5;
      const resolution = ['720p', '1080p'].includes(input.resolution) ? input.resolution : '720p';
      quotes.set(quoteId, {modelId, prompt: input.prompt, duration, resolution, image, references: [], family: 'seedance1', projectId: input.projectId || null, expiresAt: now() + 10 * 60 * 1000});
      return {quoteId, providerId: 'seedance', modelId, kind: 'video', cost: null, currency: 'CNY', note: '按方舟实际计费；提交后不可撤销', duration, resolution};
    },
    async submit(input = {}) {
      guard();
      const quote = quotes.get(input.quoteId);
      if (!quote || quote.expiresAt < now()) throw new ProviderError('QUOTE_EXPIRED', '报价已过期，请重新获取');
      const family = quote.family || 'seedance1';
      const task = store.create({providerId: 'seedance', modelId: quote.modelId, kind: 'video', projectId: input.projectId || quote.projectId, sourceId: input.sourceId, prompt: quote.prompt, references: quote.references || []});
      store.update(task.id, {status: 'running', progress: 0.1, message: '正在提交 Seedance…'});
      try {
        let content, endpoint, remoteKind;
        if (family === 'seedance25') {
          content = [{type: 'text', text: quote.prompt}];
          for (const reference of quote.references) {
            const url = mediaUrl(reference);
            if (!url) throw new ProviderError('INVALID_INPUT', `${reference.kind === 'video' ? '视频' : '音频'}参考缺少可访问 URL`);
            if (reference.kind === 'image') content.push({type: 'image_url', image_url: {url}, role: 'reference_image'});
            else if (reference.kind === 'video') content.push({type: 'video_url', video_url: {url}, role: 'reference_video'});
            else content.push({type: 'audio_url', audio_url: {url}, role: 'reference_audio'});
          }
          endpoint = quote.endpoint || endpointPath();remoteKind = 'seedance25';
        } else {
          content = [{type: 'text', text: quote.prompt}];
          if (quote.image) content.push({type: 'image_url', image_url: {url: quote.image}});
          endpoint = '/contents/generations/tasks';remoteKind = quote.image ? 'image2video' : 'text2video';
        }
        const payload = {model: quote.modelId, content, duration: quote.duration, resolution: quote.resolution};
        if (quote.aspect) payload.ratio = quote.aspect;
        const data = await request(endpoint, {method: 'POST', body: JSON.stringify(payload)});
        const remoteId = data?.id;
        if (!remoteId) throw new ProviderError('UPSTREAM', 'Seedance 没有返回任务 ID');
        store.update(task.id, {remoteId, remoteKind, progress: 0.2, message: 'Seedance 正在生成…'});
        return {taskId: task.id, task: store.get(task.id)};
      } catch (error) {
        store.update(task.id, {status: 'failed', error: {code: error.code || 'UPSTREAM', message: error.message}, message: error.message});
        throw error;
      }
    },
    async poll(taskId) {
      const task = store.get(taskId);
      if (!task) throw new ProviderError('TASK_NOT_FOUND', `任务不存在：${taskId}`);
      if (!['queued', 'running'].includes(task.status) || !task.remoteId) return task;
      const path = task.remoteKind === 'seedance25' ? `${endpointPath()}/${encodeURIComponent(task.remoteId)}` : `/contents/generations/tasks/${encodeURIComponent(task.remoteId)}`;
      const data = await request(path, {}, 30000);
      const status = data?.status;
      if (status === 'succeeded') {
        const url = data?.content?.video_url;
        if (!url) return store.update(taskId, {status: 'failed', error: {code: 'OUTPUT_NOT_FOUND', message: '任务完成但没有视频地址'}, message: '任务完成但没有视频地址'});
        return store.update(taskId, {status: 'succeeded', progress: 1, message: '已生成', outputs: [{index: 0, kind: 'video', mime: VIDEO_MIME, url, duration: data.duration || 5}]});
      }
      if (['failed', 'cancelled'].includes(status)) {
        return store.update(taskId, {status: status === 'cancelled' ? 'cancelled' : 'failed', error: {code: 'UPSTREAM', message: data?.error?.message || 'Seedance 任务失败'}, message: data?.error?.message || 'Seedance 任务失败'});
      }
      return store.update(taskId, {progress: 0.5, message: 'Seedance 正在生成…'});
    },
    async cancel(taskId) {
      const task = store.get(taskId);
      if (!task) throw new ProviderError('TASK_NOT_FOUND', `任务不存在：${taskId}`);
      if (['queued', 'running'].includes(task.status)) {
        if (task.remoteId) {
          try { const path = task.remoteKind === 'seedance25' ? `${endpointPath()}/${encodeURIComponent(task.remoteId)}` : `/contents/generations/tasks/${encodeURIComponent(task.remoteId)}`; await request(path, {method: 'DELETE'}, 30000); } catch {}
        }
        return store.update(taskId, {status: 'cancelled', message: '已取消'});
      }
      return task;
    },
    async download(taskId, index = 0) {
      const task = store.get(taskId);
      if (!task) throw new ProviderError('TASK_NOT_FOUND', `任务不存在：${taskId}`);
      if (task.status !== 'succeeded') throw new ProviderError('TASK_NOT_READY', '任务尚未完成');
      const output = task.outputs[index];
      if (!output?.url) throw new ProviderError('OUTPUT_NOT_FOUND', '没有可下载的视频');
      const response = await fetchImpl(output.url, {signal: AbortSignal.timeout(120000)});
      if (!response.ok) throw new ProviderError('UPSTREAM', `下载视频失败（HTTP ${response.status}）`);
      return {mime: response.headers.get('content-type') || VIDEO_MIME, data: Buffer.from(await response.arrayBuffer()), filename: `seedance-${taskId}.mp4`};
    },
  };
  return provider;
}
