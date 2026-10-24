import {randomUUID} from 'node:crypto';
import {ProviderError} from './contracts.mjs';
import {createTaskStore} from './task-store.mjs';

export const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
export const ARK_PLAN_BASE_URL = 'https://ark.cn-beijing.volces.com/api/plan/v3';
export const SEEDANCE_DEFAULT_MODEL = 'doubao-seedance-1-0-pro-250528';

const VIDEO_MIME = 'video/mp4';

/** Seedance 视频适配器。默认 feature flag 关闭；真实调用会按方舟计费。 */
export function createSeedanceProvider({
  apiKey = '',
  baseUrl = ARK_BASE_URL,
  fetchImpl = fetch,
  enabled = false,
  store = createTaskStore(),
  defaultModel = SEEDANCE_DEFAULT_MODEL,
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
      response = await fetchImpl(base + path, {...options, headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(options.headers || {})}, signal: AbortSignal.timeout(timeout)});
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

  const provider = {
    id: 'seedance',
    label: 'Seedance（即梦视频）',
    enabled,
    capabilities: {
      image: {textToImage: false, imageToImage: false, reference: false, sizes: [], aspects: []},
      video: {textToVideo: true, imageToVideo: true, firstLastFrame: false, durations: [5, 10], resolutions: ['720p', '1080p']},
    },
    async listModels() {
      guard();
      return [
        {id: 'doubao-seedance-1-0-pro-250528', name: 'Seedance 1.0 Pro', kind: 'video', default: defaultModel === 'doubao-seedance-1-0-pro-250528'},
        {id: 'doubao-seedance-1-0-lite-t2v-250428', name: 'Seedance 1.0 Lite', kind: 'video', default: defaultModel === 'doubao-seedance-1-0-lite-t2v-250428'},
      ];
    },
    async health() {
      return {ok: enabled && Boolean(apiKey), providerId: 'seedance', configured: Boolean(apiKey), enabled, featureFlag: enabled};
    },
    async quote(input = {}) {
      guard();
      if (typeof input.prompt !== 'string' || !input.prompt.trim()) throw new ProviderError('INVALID_INPUT', '提示词不能为空');
      if (input.prompt.length > 6000) throw new ProviderError('INVALID_INPUT', '提示词不能超过 6000 字符');
      const modelId = input.modelId || defaultModel;
      const duration = [5, 10].includes(Number(input.duration)) ? Number(input.duration) : 5;
      const resolution = ['720p', '1080p'].includes(input.resolution) ? input.resolution : '720p';
      const image = typeof input.image === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.image) ? input.image : null;
      const quoteId = randomUUID();
      quotes.set(quoteId, {modelId, prompt: input.prompt, duration, resolution, image, projectId: input.projectId || null, expiresAt: now() + 10 * 60 * 1000});
      return {quoteId, providerId: 'seedance', modelId, kind: 'video', cost: null, currency: 'CNY', note: '按方舟实际计费；提交后不可撤销', duration, resolution};
    },
    async submit(input = {}) {
      guard();
      const quote = quotes.get(input.quoteId);
      if (!quote || quote.expiresAt < now()) throw new ProviderError('QUOTE_EXPIRED', '报价已过期，请重新获取');
      const task = store.create({providerId: 'seedance', modelId: quote.modelId, kind: 'video', projectId: input.projectId || quote.projectId, sourceId: input.sourceId, prompt: quote.prompt});
      store.update(task.id, {status: 'running', progress: 0.1, message: '正在提交 Seedance…'});
      try {
        const content = [{type: 'text', text: quote.prompt}];
        if (quote.image) content.push({type: 'image_url', image_url: {url: quote.image}});
        const data = await request('/contents/generations/tasks', {method: 'POST', body: JSON.stringify({model: quote.modelId, content, duration: quote.duration, resolution: quote.resolution})});
        const remoteId = data?.id;
        if (!remoteId) throw new ProviderError('UPSTREAM', 'Seedance 没有返回任务 ID');
        store.update(task.id, {remoteId, remoteKind: quote.image ? 'image2video' : 'text2video', progress: 0.2, message: 'Seedance 正在生成…'});
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
      const data = await request(`/contents/generations/tasks/${encodeURIComponent(task.remoteId)}`, {}, 30000);
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
          try { await request(`/contents/generations/tasks/${encodeURIComponent(task.remoteId)}`, {method: 'DELETE'}, 30000); } catch {}
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
