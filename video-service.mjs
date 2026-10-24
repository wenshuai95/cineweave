import {createFakeProvider} from './providers/fake.mjs';
import {createSeedanceProvider, ARK_BASE_URL, ARK_PLAN_BASE_URL} from './providers/seedance.mjs';
import {createTaskStore} from './providers/task-store.mjs';
import {describeProvider, ProviderError} from './providers/contracts.mjs';

/**
 * 视频生成统一服务：Fake 默认可用；Seedance 由 feature flag 开启。
 * 真实视频调用会按方舟计费，默认关闭。
 */
export function createVideoService({env = process.env, fetchImpl = fetch} = {}) {
  const store = createTaskStore();
  const fake = createFakeProvider({store});
  const seedanceEnabled = env.ARK_SEEDANCE_ENABLED === '1';
  const seedance = createSeedanceProvider({
    apiKey: env.ARK_PLAN_KEY || env.ARK_API_KEY || '',
    baseUrl: env.ARK_SEEDANCE_BASE_URL || (env.ARK_PLAN_KEY ? ARK_PLAN_BASE_URL : ARK_BASE_URL),
    enabled: seedanceEnabled,
    store,
    fetchImpl,
  });
  const providers = new Map([['fake', fake], ['seedance', seedance]]);
  const quotes = new Map();

  const providerOf = id => {
    const provider = providers.get(id);
    if (!provider) throw new ProviderError('PROVIDER_NOT_FOUND', `未知视频服务商：${id}`);
    return provider;
  };

  return {
    descriptors() { return [...providers.values()].map(describeProvider); },
    async models(providerId) { return providerOf(providerId).listModels(); },
    async health(providerId) { return providerOf(providerId).health(); },
    async quote(input = {}) {
      const providerId = input.providerId || 'fake';
      const provider = providerOf(providerId);
      if (!provider.enabled) throw new ProviderError('FEATURE_DISABLED', 'Seedance 视频尚未开启（feature flag 关闭）');
      const quote = await provider.quote({...input, kind: 'video'});
      quotes.set(quote.quoteId, {providerId, providerQuoteId: quote.quoteId, modelId: quote.modelId, prompt: input.prompt, kind: 'video', projectId: input.projectId || null, duration: input.duration, resolution: input.resolution, expiresAt: Date.now() + 10 * 60 * 1000});
      return quote;
    },
    async submit(input = {}) {
      const quote = quotes.get(input.quoteId);
      if (!quote || quote.expiresAt < Date.now()) throw new ProviderError('QUOTE_EXPIRED', '报价已过期，请重新获取');
      const provider = providerOf(quote.providerId);
      if (quote.providerId === 'fake') {
        return provider.submit({modelId: quote.modelId, prompt: quote.prompt, kind: 'video', projectId: input.projectId || quote.projectId, sourceId: input.sourceId});
      }
      return provider.submit({quoteId: quote.providerQuoteId, projectId: input.projectId || quote.projectId, sourceId: input.sourceId});
    },
    async poll(providerId, taskId) { return providerOf(providerId).poll(taskId); },
    async cancel(providerId, taskId) { return providerOf(providerId).cancel(taskId); },
    async download(providerId, taskId, index) { return providerOf(providerId).download(taskId, index); },
    tasks(projectId) { return store.list(projectId ? {projectId} : {}); },
  };
}
