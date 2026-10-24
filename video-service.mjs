import {createFakeProvider} from './providers/fake.mjs';
import {createSeedanceProvider, ARK_BASE_URL, ARK_PLAN_BASE_URL} from './providers/seedance.mjs';
import {createKlingProvider, KLING_BASE_URL} from './providers/kling.mjs';
import {createPersistentTaskStore} from './providers/persistent-task-store.mjs';
import {describeProvider, ProviderError} from './providers/contracts.mjs';
import {normalizeReferenceLimits, referenceLimitProblem, sanitizeReferenceList} from './providers/reference-policy.mjs';
import {mkdir, readFile, writeFile, chmod, rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

/**
 * 视频生成统一服务：Fake 默认可用；Seedance 由 feature flag 开启。
 * 真实视频调用会按方舟计费，默认关闭。
 */
export function createVideoService({env = process.env, fetchImpl = fetch, folder = null} = {}) {
  const configFile = folder ? join(folder, 'kling.json') : null;
  const store = createPersistentTaskStore({file: folder ? join(folder, 'video-tasks.json') : null});
  const fake = createFakeProvider({store});
  const seedanceEnabled = env.ARK_SEEDANCE_ENABLED === '1';
  const seedance25Enabled = env.ARK_SEEDANCE_25_ENABLED === '1';
  const seedance25Model = typeof env.ARK_SEEDANCE_25_MODEL === 'string' && env.ARK_SEEDANCE_25_MODEL.trim() ? env.ARK_SEEDANCE_25_MODEL.trim() : undefined;
  const seedance25Endpoint = typeof env.ARK_SEEDANCE_25_ENDPOINT === 'string' && env.ARK_SEEDANCE_25_ENDPOINT.trim() ? env.ARK_SEEDANCE_25_ENDPOINT.trim() : undefined;
  const seedance = createSeedanceProvider({
    apiKey: env.ARK_PLAN_KEY || env.ARK_API_KEY || '',
    baseUrl: env.ARK_SEEDANCE_BASE_URL || (env.ARK_PLAN_KEY ? ARK_PLAN_BASE_URL : ARK_BASE_URL),
    enabled: seedanceEnabled,
    store,
    fetchImpl,
    seedance25Enabled,
    ...(seedance25Model ? {seedance25Model} : {}),
    ...(seedance25Endpoint ? {seedance25Endpoint} : {}),
  });
  const kling = createKlingProvider({
    accessKey: env.KLING_ACCESS_KEY || '',
    secretKey: env.KLING_SECRET_KEY || '',
    baseUrl: env.KLING_BASE_URL || KLING_BASE_URL,
    enabled: env.KLING_ENABLED === '1',
    store,
    fetchImpl,
  });
  const providers = new Map([['fake', fake], ['seedance', seedance], ['kling', kling]]);
  const quotes = new Map();
  let klingState = {
    accessKey: env.KLING_ACCESS_KEY || '',
    secretKey: env.KLING_SECRET_KEY || '',
    enabled: env.KLING_ENABLED === '1' || Boolean((env.KLING_ACCESS_KEY || '') && (env.KLING_SECRET_KEY || '') && env.KLING_ENABLED !== '0'),
  };
  let readyPromise = null;
  const makeKling = () => createKlingProvider({accessKey: klingState.accessKey, secretKey: klingState.secretKey, baseUrl: env.KLING_BASE_URL || KLING_BASE_URL, enabled: klingState.enabled, store, fetchImpl});
  const rebuildKling = () => { providers.set('kling', makeKling()); };
  const klingStatus = () => ({configured: Boolean(klingState.accessKey && klingState.secretKey), enabled: Boolean(klingState.enabled), accessKeyHint: klingState.accessKey ? klingState.accessKey.slice(-4) : '', baseUrl: env.KLING_BASE_URL || KLING_BASE_URL});
  const ready = async () => {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      if (!configFile || (klingState.accessKey && klingState.secretKey)) return klingStatus();
      try {
        const saved = JSON.parse(await readFile(configFile, 'utf8'));
        if (typeof saved.accessKey === 'string' && typeof saved.secretKey === 'string') {
          klingState = {accessKey: saved.accessKey, secretKey: saved.secretKey, enabled: saved.enabled !== false};
          rebuildKling();
        }
      } catch {}
      return klingStatus();
    })();
    return readyPromise;
  };

  const providerOf = id => {
    const provider = providers.get(id);
    if (!provider) throw new ProviderError('PROVIDER_NOT_FOUND', `未知视频服务商：${id}`);
    return provider;
  };

  return {
    ready: async () => { await ready(); await store.ready; return klingStatus(); },
    readyKling: ready,
    klingStatus,
    async configureKling(input = {}) {
      const accessKey = typeof input.accessKey === 'string' && input.accessKey.trim() ? input.accessKey.trim() : klingState.accessKey;
      const secretKey = typeof input.secretKey === 'string' && input.secretKey.trim() ? input.secretKey.trim() : klingState.secretKey;
      if ((accessKey && !secretKey) || (!accessKey && secretKey)) throw new ProviderError('INVALID_INPUT', 'Kling AccessKey 与 SecretKey 必须同时填写');
      if (!accessKey || !secretKey) throw new ProviderError('INVALID_INPUT', '请填写 Kling AccessKey 与 SecretKey');
      klingState = {accessKey, secretKey, enabled: input.enabled !== false};
      rebuildKling();
      if (configFile && input.persist !== false) {
        await mkdir(folder, {recursive: true, mode: 0o700});
        const temp = join(folder, 'kling.' + randomUUID() + '.tmp');
        await writeFile(temp, JSON.stringify({accessKey, secretKey, enabled: klingState.enabled}), {mode: 0o600});
        await chmod(temp, 0o600);
        await rename(temp, configFile);
      }
      return klingStatus();
    },
    descriptors() {
      return [...providers.values()].map(provider => {
        const descriptor = describeProvider(provider);
        if (descriptor.id === 'seedance') {
          descriptor.seedance25 = {enabled: seedance25Enabled, model: seedance25Model || 'doubao-seedance-2-5-260628', endpoint: seedance25Endpoint || '/contents/generations/tasks'};
          if (!descriptor.enabled) descriptor.unavailableReason = 'Seedance 未启用：需配置方舟 API Key 并开启 ARK_SEEDANCE_ENABLED=1；Seedance 2.5 还需 ARK_SEEDANCE_25_ENABLED=1';
        }
        return descriptor;
      });
    },
    async models(providerId) { await ready(); return providerOf(providerId).listModels(); },
    async health(providerId) { await ready(); return providerOf(providerId).health(); },
    async quote(input = {}) {
      await ready();
      const providerId = input.providerId || 'fake';
      const provider = providerOf(providerId);
      if (!provider.enabled) throw new ProviderError('FEATURE_DISABLED', 'Seedance 视频尚未开启（feature flag 关闭）');
      const references = sanitizeReferenceList(input.references);
      const limits = describeProvider(provider).capabilities.video.referenceLimits;
      const problem = referenceLimitProblem(references, limits);
      if (problem) throw new ProviderError('REFERENCE_LIMIT', problem);
      const quote = await provider.quote({...input, kind: 'video', references});
      quotes.set(quote.quoteId, {providerId, providerQuoteId: quote.quoteId, modelId: quote.modelId, prompt: input.prompt, kind: 'video', projectId: input.projectId || null, duration: input.duration, resolution: input.resolution, references, expiresAt: Date.now() + 10 * 60 * 1000});
      return quote;
    },
    async submit(input = {}) {
      await ready();
      const quote = quotes.get(input.quoteId);
      if (!quote || quote.expiresAt < Date.now()) throw new ProviderError('QUOTE_EXPIRED', '报价已过期，请重新获取');
      const provider = providerOf(quote.providerId);
      if (quote.providerId === 'fake') {
        return provider.submit({modelId: quote.modelId, prompt: quote.prompt, kind: 'video', projectId: input.projectId || quote.projectId, sourceId: input.sourceId, references: quote.references});
      }
      return provider.submit({quoteId: quote.providerQuoteId, projectId: input.projectId || quote.projectId, sourceId: input.sourceId, references: quote.references});
    },
    async poll(providerId, taskId) { return providerOf(providerId).poll(taskId); },
    async cancel(providerId, taskId) { return providerOf(providerId).cancel(taskId); },
    async download(providerId, taskId, index) { return providerOf(providerId).download(taskId, index); },
    tasks(projectId) { return store.list(projectId ? {projectId} : {}); },
  };
}
