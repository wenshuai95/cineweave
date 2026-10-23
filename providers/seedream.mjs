import {ProviderError} from './contracts.mjs';

export const SEEDREAM_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
export const SEEDREAM_DEFAULT_MODEL = 'doubao-seedream-5-0-flash-260915';

/**
 * Seedream（即梦 / 火山方舟）适配器。
 * Sprint 1 只实现模型列表与能力声明；生成链路在 Sprint 2 完成。
 */
export function createSeedreamProvider({
  apiKey = '',
  baseUrl = SEEDREAM_BASE_URL,
  fetchImpl = fetch,
  enabled = Boolean(apiKey),
} = {}) {
  const base = String(baseUrl || SEEDREAM_BASE_URL).replace(/\/+$/, '');
  const key = String(apiKey || '');
  const headers = () => ({Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'});
  const notImplemented = method => {
    throw new ProviderError('NOT_IMPLEMENTED', `Seedream ${method} 将在 Sprint 2 实现`, {providerId: 'seedream'});
  };

  const provider = {
    id: 'seedream',
    label: 'Seedream（即梦）',
    enabled,
    capabilities: {
      image: {
        textToImage: true,
        imageToImage: false,
        reference: true,
        sizes: ['1024x1024', '1536x1024', '1024x1536'],
        aspects: ['1:1', '4:3', '3:4', '16:9', '9:16'],
      },
      video: {textToVideo: false, imageToVideo: false, firstLastFrame: false, durations: [], resolutions: []},
    },
    async listModels() {
      if (!key) throw new ProviderError('UNAUTHORIZED', 'Seedream API Key 未配置');
      let response;
      try {
        response = await fetchImpl(`${base}/models`, {headers: headers(), signal: AbortSignal.timeout(15000)});
      } catch (error) {
        throw new ProviderError('NETWORK', `Seedream 连接失败：${error.message}`);
      }
      if (response.status === 401 || response.status === 403) throw new ProviderError('UNAUTHORIZED', 'Seedream API Key 无效或无权限');
      if (!response.ok) throw new ProviderError('UPSTREAM', `Seedream 模型列表失败（HTTP ${response.status}）`);
      const data = await response.json();
      return (Array.isArray(data.data) ? data.data : [])
        .filter(model => /seedream/i.test(String(model.id || '')))
        .map(model => ({id: String(model.id), name: String(model.name || model.id), kind: 'image', status: model.status || null}));
    },
    async quote() {
      return notImplemented('quote');
    },
    async submit() {
      return notImplemented('submit');
    },
    async poll() {
      return notImplemented('poll');
    },
    async cancel() {
      return notImplemented('cancel');
    },
    async download() {
      return notImplemented('download');
    },
    async health() {
      return {ok: Boolean(key), providerId: 'seedream', configured: Boolean(key)};
    },
  };

  return provider;
}
