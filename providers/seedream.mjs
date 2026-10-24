import {randomUUID} from 'node:crypto';
import {ProviderError} from './contracts.mjs';
import {createTaskStore} from './task-store.mjs';

export const SEEDREAM_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
export const SEEDREAM_PLAN_BASE_URL = 'https://ark.cn-beijing.volces.com/api/plan/v3';
export const SEEDREAM_DEFAULT_MODEL = 'doubao-seedream-5-0-flash-260915';
export const SEEDREAM_PLAN_DEFAULT_MODEL = 'doubao-seedream-5.0-flash';
export const SEEDREAM_PLAN_MODELS = Object.freeze([
  {id: 'doubao-seedream-5.0-flash', name: 'Seedream 5.0 Flash（Agent Plan）', kind: 'image', default: true},
  {id: 'doubao-seedream-5.0-pro', name: 'Seedream 5.0 Pro（Agent Plan）', kind: 'image', default: false},
]);
export const SEEDREAM_SIZES = ['1024x1024', '1536x1024', '1024x1536'];
export const SEEDREAM_ASPECTS = ['1:1', '4:3', '3:4', '16:9', '9:16'];

const MIME_BY_EXT = {jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp'};
const mimeFromUrl = url => {
  try {
    const ext = new URL(url).pathname.split('.').pop()?.toLowerCase();
    return MIME_BY_EXT[ext] || 'image/jpeg';
  } catch {
    return 'image/jpeg';
  }
};

/** Seedream（即梦 / 火山方舟）图片适配器。 */
export function createSeedreamProvider({
  apiKey = '',
  baseUrl = '',
  fetchImpl = fetch,
  enabled = Boolean(apiKey),
  store = createTaskStore(),
  defaultModel,
  planMode = false,
  planModels = SEEDREAM_PLAN_MODELS,
  now = Date.now,
} = {}) {
  const base = String(baseUrl || (planMode ? SEEDREAM_PLAN_BASE_URL : SEEDREAM_BASE_URL)).replace(/\/+$/, '');
  const defaultModelId = defaultModel || (planMode ? SEEDREAM_PLAN_DEFAULT_MODEL : SEEDREAM_DEFAULT_MODEL);
  let key = String(apiKey || '');
  const quotes = new Map();

  const setKey = next => {
    key = String(next || '');
  };
  const requireKey = () => {
    if (!key) throw new ProviderError('UNAUTHORIZED', '请先在设置中填写 Seedream API Key');
  };
  const request = async (path, options = {}) => {
    let response;
    try {
      response = await fetchImpl(base + path, {
        ...options,
        headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {})},
        signal: AbortSignal.timeout(180000),
      });
    } catch (error) {
      throw new ProviderError('NETWORK', `Seedream 连接失败：${error.message}`);
    }
    let data = {};
    try { data = await response.json(); } catch {}
    if (response.ok) return data;
    const code = data?.error?.code || '';
    const message = data?.error?.message || `Seedream 请求失败（HTTP ${response.status}）`;
    if (/AccountOverdue|InsufficientBalance|Arrears/i.test(code)) throw new ProviderError('PAYMENT_REQUIRED', '火山方舟账户余额不足或已欠费，请先充值后再生成');
    if (response.status === 401 || response.status === 403) throw new ProviderError('UNAUTHORIZED', 'Seedream API Key 无效或无权限');
    if (/ModelNotOpen/i.test(code)) throw new ProviderError('MODEL_NOT_OPEN', '当前账号未开通该 Seedream 模型，请到火山方舟控制台开通');
    if (/SetLimitExceeded|RateLimit/i.test(code) || response.status === 429) throw new ProviderError('RATE_LIMITED', 'Seedream 额度已用完或触发限流，请调整安心体验模式或稍后重试');
    if (response.status === 400) throw new ProviderError('INVALID_INPUT', message);
    throw new ProviderError('UPSTREAM', message);
  };

  const findModel = async modelId => {
    const models = await provider.listModels();
    const model = models.find(item => item.id === modelId);
    if (!model) throw new ProviderError('MODEL_NOT_FOUND', `未知或未开通的 Seedream 模型：${modelId}`);
    return model;
  };

  const provider = {
    id: 'seedream',
    label: 'Seedream（即梦）',
    enabled,
    capabilities: {
      image: {textToImage: true, imageToImage: false, reference: false, sizes: SEEDREAM_SIZES, aspects: SEEDREAM_ASPECTS},
      video: {textToVideo: false, imageToVideo: false, firstLastFrame: false, durations: [], resolutions: []},
    },
    async listModels() {
      requireKey();
      if (planMode) return planModels.map(model => ({...model, default: model.id === defaultModelId}));
      const data = await request('/models', {method: 'GET'});
      return (Array.isArray(data.data) ? data.data : [])
        .filter(model => /seedream/i.test(String(model.id || '')))
        .map(model => ({
          id: String(model.id),
          name: String(model.name || model.id),
          kind: 'image',
          status: model.status || null,
          default: String(model.id) === defaultModelId,
        }));
    },
    async quote(input = {}) {
      requireKey();
      if (typeof input.modelId !== 'string' || !input.modelId) throw new ProviderError('INVALID_INPUT', '请选择 Seedream 模型');
      if (typeof input.prompt !== 'string' || !input.prompt.trim()) throw new ProviderError('INVALID_INPUT', '提示词不能为空');
      if (input.prompt.length > 6000) throw new ProviderError('INVALID_INPUT', '提示词不能超过 6000 字符');
      const size = input.size ? String(input.size) : '1024x1024';
      if (!SEEDREAM_SIZES.includes(size)) throw new ProviderError('INVALID_INPUT', `不支持的尺寸：${size}`);
      await findModel(input.modelId);
      const quoteId = randomUUID();
      quotes.set(quoteId, {modelId: input.modelId, prompt: input.prompt, size, expiresAt: now() + 10 * 60 * 1000, projectId: input.projectId || null});
      return {
        quoteId,
        providerId: 'seedream',
        modelId: input.modelId,
        kind: 'image',
        cost: null,
        currency: 'CNY',
        note: '按火山方舟实际计费；提交后不可撤销',
        size,
      };
    },
    async submit(input = {}) {
      requireKey();
      const quote = quotes.get(input.quoteId);
      if (!quote || quote.expiresAt < now()) throw new ProviderError('QUOTE_EXPIRED', '报价已过期，请重新获取');
      const task = store.create({
        providerId: 'seedream',
        modelId: quote.modelId,
        kind: 'image',
        projectId: input.projectId || quote.projectId,
        sourceId: input.sourceId,
        prompt: quote.prompt,
      });
      store.update(task.id, {status: 'running', progress: 0.15, message: '正在请求 Seedream…'});
      try {
        const data = await request('/images/generations', {
          method: 'POST',
          body: JSON.stringify({
            model: quote.modelId,
            prompt: quote.prompt,
            size: quote.size,
            response_format: 'url',
            watermark: false,
          }),
        });
        const image = Array.isArray(data.data) ? data.data[0] : null;
        if (!image?.url) throw new ProviderError('UPSTREAM', 'Seedream 没有返回图片地址');
        const [width, height] = String(image.size || quote.size).split('x').map(Number);
        store.update(task.id, {
          status: 'succeeded',
          progress: 1,
          message: '已生成',
          cost: data.usage || null,
          outputs: [{index: 0, kind: 'image', mime: mimeFromUrl(image.url), url: image.url, width: width || null, height: height || null}],
        });
        return {taskId: task.id, task: store.get(task.id)};
      } catch (error) {
        store.update(task.id, {status: 'failed', error: {code: error.code || 'UPSTREAM', message: error.message}, message: error.message});
        throw error;
      }
    },
    async poll(taskId) {
      const task = store.get(taskId);
      if (!task) throw new ProviderError('TASK_NOT_FOUND', `任务不存在：${taskId}`);
      return task;
    },
    async cancel(taskId) {
      const task = store.get(taskId);
      if (!task) throw new ProviderError('TASK_NOT_FOUND', `任务不存在：${taskId}`);
      if (['queued', 'running'].includes(task.status)) return store.update(taskId, {status: 'cancelled', message: '已取消（云端请求可能仍会计费）'});
      return task;
    },
    async download(taskId, index = 0) {
      const task = store.get(taskId);
      if (!task) throw new ProviderError('TASK_NOT_FOUND', `任务不存在：${taskId}`);
      if (task.status !== 'succeeded') throw new ProviderError('TASK_NOT_READY', '任务尚未完成');
      const output = task.outputs[index];
      if (!output?.url) throw new ProviderError('OUTPUT_NOT_FOUND', '没有可下载的图片');
      let response;
      try {
        response = await fetchImpl(output.url, {signal: AbortSignal.timeout(120000)});
      } catch (error) {
        throw new ProviderError('NETWORK', `下载图片失败：${error.message}`);
      }
      if (!response.ok) throw new ProviderError('UPSTREAM', `下载图片失败（HTTP ${response.status}）`);
      return {mime: response.headers.get('content-type') || output.mime || 'image/jpeg', data: Buffer.from(await response.arrayBuffer()), filename: `seedream-${taskId}.jpg`};
    },
    async health() {
      return {ok: Boolean(key), providerId: 'seedream', configured: Boolean(key), enabled};
    },
    setKey,
  };

  return provider;
}
