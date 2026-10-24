import {createHmac, randomUUID} from 'node:crypto';
import {ProviderError} from './contracts.mjs';
import {createTaskStore} from './task-store.mjs';

export const KLING_BASE_URL = 'https://api-beijing.klingai.com';
export const KLING_DEFAULT_MODEL = 'kling-v1';

const b64url = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const nowSec = () => Math.floor(Date.now() / 1000);
export function createKlingJwt(accessKey, secretKey, {ttl = 1800} = {}) {
  const header = b64url({alg: 'HS256', typ: 'JWT'});
  const issued = nowSec();
  const payload = b64url({iss: accessKey, exp: issued + ttl, nbf: issued - 5});
  const signature = createHmac('sha256', secretKey).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

/** 可灵视频适配器骨架。默认 feature flag 关闭，未开启时不会发出任何请求。 */
export function createKlingProvider({
  accessKey = '',
  secretKey = '',
  baseUrl = KLING_BASE_URL,
  fetchImpl = fetch,
  enabled = false,
  store = createTaskStore(),
  defaultModel = KLING_DEFAULT_MODEL,
  now = Date.now,
} = {}) {
  const base = String(baseUrl || KLING_BASE_URL).replace(/\/+$/, '');
  const quotes = new Map();
  const guard = () => {
    if (!enabled) throw new ProviderError('FEATURE_DISABLED', 'Kling 视频尚未开启（feature flag 关闭）');
    if (!accessKey || !secretKey) throw new ProviderError('UNAUTHORIZED', '请先配置 Kling AccessKey / SecretKey');
  };
  const request = async (path, options = {}, timeout = 120000) => {
    guard();
    let response;
    try {
      response = await fetchImpl(base + path, {...options, headers: {Authorization: `Bearer ${createKlingJwt(accessKey, secretKey)}`, 'Content-Type': 'application/json', ...(options.headers || {})}, signal: AbortSignal.timeout(timeout)});
    } catch (error) {
      throw new ProviderError('NETWORK', `Kling 连接失败：${error.message}`);
    }
    let data = {};
    try { data = await response.json(); } catch {}
    if (response.ok && (data.code === undefined || data.code === 0)) return data;
    const message = data?.message || data?.error?.message || `Kling 请求失败（HTTP ${response.status}）`;
    if (/auth|token|unauthor/i.test(message)) throw new ProviderError('UNAUTHORIZED', 'Kling 鉴权失败，请核对 AccessKey / SecretKey');
    if (/balance|quota|insufficient/i.test(message)) throw new ProviderError('PAYMENT_REQUIRED', 'Kling 额度不足或账户欠费');
    if (response.status === 429) throw new ProviderError('RATE_LIMITED', 'Kling 触发限流，请稍后重试');
    throw new ProviderError('UPSTREAM', message);
  };

  const provider = {
    id: 'kling',
    label: 'Kling（可灵视频）',
    enabled,
    capabilities: {
      image: {textToImage: false, imageToImage: false, reference: false, sizes: [], aspects: []},
      video: {textToVideo: true, imageToVideo: true, firstLastFrame: false, durations: [5, 10], resolutions: ['720p', '1080p']},
    },
    async listModels() {
      guard();
      return [
        {id: 'kling-v1', name: 'Kling v1', kind: 'video', default: defaultModel === 'kling-v1'},
        {id: 'kling-v1-5', name: 'Kling v1.5', kind: 'video', default: defaultModel === 'kling-v1-5'},
      ];
    },
    async health() {
      return {ok: enabled && Boolean(accessKey && secretKey), providerId: 'kling', configured: Boolean(accessKey && secretKey), enabled, featureFlag: enabled};
    },
    async quote(input = {}) {
      guard();
      if (typeof input.prompt !== 'string' || !input.prompt.trim()) throw new ProviderError('INVALID_INPUT', '提示词不能为空');
      if (input.prompt.length > 6000) throw new ProviderError('INVALID_INPUT', '提示词不能超过 6000 字符');
      const modelId = input.modelId || defaultModel;
      const duration = [5, 10].includes(Number(input.duration)) ? Number(input.duration) : 5;
      const aspect = ['16:9', '9:16', '1:1'].includes(input.aspect) ? input.aspect : '16:9';
      const image = typeof input.image === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.image) ? input.image : null;
      const quoteId = randomUUID();
      quotes.set(quoteId, {modelId, prompt: input.prompt, duration, aspect, image, projectId: input.projectId || null, expiresAt: now() + 10 * 60 * 1000});
      return {quoteId, providerId: 'kling', modelId, kind: 'video', cost: null, currency: 'CNY', note: '按 Kling 实际计费；提交后不可撤销', duration, aspect};
    },
    async submit(input = {}) {
      guard();
      const quote = quotes.get(input.quoteId);
      if (!quote || quote.expiresAt < now()) throw new ProviderError('QUOTE_EXPIRED', '报价已过期，请重新获取');
      const task = store.create({providerId: 'kling', modelId: quote.modelId, kind: 'video', projectId: input.projectId || quote.projectId, sourceId: input.sourceId, prompt: quote.prompt});
      store.update(task.id, {status: 'running', progress: 0.1, message: '正在提交 Kling…'});
      try {
        const path = quote.image ? '/v1/videos/image2video' : '/v1/videos/text2video';
        const body = {model_name: quote.modelId, prompt: quote.prompt, duration: String(quote.duration), aspect_ratio: quote.aspect, mode: 'std'};
        if (quote.image) body.image = quote.image.split(',')[1];
        const data = await request(path, {method: 'POST', body: JSON.stringify(body)});
        const remoteId = data?.data?.task_id;
        if (!remoteId) throw new ProviderError('UPSTREAM', 'Kling 没有返回任务 ID');
        store.update(task.id, {remoteId, remoteKind: quote.image ? 'image2video' : 'text2video', progress: 0.2, message: 'Kling 正在生成…'});
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
      const data = await request(`/v1/videos/${task.remoteKind === 'image2video' ? 'image2video' : 'text2video'}/${encodeURIComponent(task.remoteId)}`, {}, 30000);
      const status = data?.data?.task_status;
      if (status === 'succeed') {
        const url = data?.data?.task_result?.videos?.[0]?.url;
        if (!url) return store.update(taskId, {status: 'failed', error: {code: 'OUTPUT_NOT_FOUND', message: 'Kling 完成但没有视频地址'}, message: 'Kling 完成但没有视频地址'});
        return store.update(taskId, {status: 'succeeded', progress: 1, message: '已生成', outputs: [{index: 0, kind: 'video', mime: 'video/mp4', url, duration: Number(data?.data?.task_result?.videos?.[0]?.duration) || 5}]});
      }
      if (status === 'failed') return store.update(taskId, {status: 'failed', error: {code: 'UPSTREAM', message: data?.data?.task_status_msg || 'Kling 任务失败'}, message: data?.data?.task_status_msg || 'Kling 任务失败'});
      return store.update(taskId, {progress: 0.5, message: 'Kling 正在生成…'});
    },
    async cancel(taskId) {
      const task = store.get(taskId);
      if (!task) throw new ProviderError('TASK_NOT_FOUND', `任务不存在：${taskId}`);
      if (['queued', 'running'].includes(task.status)) return store.update(taskId, {status: 'cancelled', message: '已取消（云端任务可能仍会计费）'});
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
      return {mime: response.headers.get('content-type') || 'video/mp4', data: Buffer.from(await response.arrayBuffer()), filename: `kling-${taskId}.mp4`};
    },
  };
  return provider;
}
