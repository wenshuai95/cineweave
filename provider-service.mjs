import {createSeedreamProvider, SEEDREAM_DEFAULT_MODEL, SEEDREAM_PLAN_DEFAULT_MODEL, SEEDREAM_PLAN_BASE_URL} from './providers/seedream.mjs';
import {createTaskStore} from './providers/task-store.mjs';
import {describeProvider} from './providers/contracts.mjs';
import {mkdir, readFile, writeFile, chmod, rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';

/**
 * Provider 服务：负责配置、密钥文件和任务编排。
 * 密钥只存在本机数据目录（0600）或环境变量，不进入工程/日志。
 */
export function createProviderService({folder, env = process.env, fetchImpl = fetch} = {}) {
  const store = createTaskStore();
  const configFile = join(folder, 'providers.json');
  let config = {
    key: env.ARK_PLAN_KEY || env.ARK_API_KEY || '',
    mode: env.ARK_PROVIDER_MODE || (env.ARK_PLAN_KEY ? 'agent-plan' : env.ARK_API_KEY ? 'ark' : 'agent-plan'),
    model: env.ARK_SEEDREAM_MODEL || (env.ARK_PLAN_KEY ? SEEDREAM_PLAN_DEFAULT_MODEL : SEEDREAM_DEFAULT_MODEL),
  };
  let loaded = null;
  let provider = null;

  const makeProvider = () => createSeedreamProvider({
    apiKey: config.key,
    enabled: Boolean(config.key),
    store,
    fetchImpl,
    planMode: config.mode === 'agent-plan',
    defaultModel: config.model,
  });
  provider = makeProvider();

  const publicStatus = () => ({
    seedream: {
      configured: Boolean(config.key),
      mode: config.mode,
      model: config.model,
      baseUrl: config.mode === 'agent-plan' ? SEEDREAM_PLAN_BASE_URL : 'https://ark.cn-beijing.volces.com/api/v3',
      enabled: Boolean(config.key),
    },
  });

  async function load() {
    if (loaded) return loaded;
    loaded = (async () => {
      try {
        const saved = JSON.parse(await readFile(configFile, 'utf8'));
        if (saved?.seedream && typeof saved.seedream.apiKey === 'string') {
          const mode = saved.seedream.mode === 'ark' ? 'ark' : 'agent-plan';
          config = {
            key: saved.seedream.apiKey,
            mode,
            model: typeof saved.seedream.model === 'string' && saved.seedream.model.trim()
              ? saved.seedream.model.trim()
              : mode === 'agent-plan' ? SEEDREAM_PLAN_DEFAULT_MODEL : SEEDREAM_DEFAULT_MODEL,
          };
          provider.setKey(config.key);
          provider = makeProvider();
        }
      } catch {}
      return publicStatus();
    })();
    return loaded;
  }

  async function save() {
    await mkdir(folder, {recursive: true, mode: 0o700});
    const temp = join(folder, `providers.${randomUUID()}.tmp`);
    const payload = JSON.stringify({seedream: {apiKey: config.key, mode: config.mode, model: config.model}});
    await writeFile(temp, payload, {mode: 0o600});
    await chmod(temp, 0o600);
    await rename(temp, configFile);
  }

  return {
    async ready() { await load(); },
    status() { return publicStatus(); },
    descriptor() { return describeProvider(provider); },
    async configure(input = {}) {
      await load();
      if (input.clear) {
        config = {key: '', mode: 'agent-plan', model: SEEDREAM_PLAN_DEFAULT_MODEL};
      } else {
        const key = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
        if (key && (key.length > 4096 || /[\r\n]/.test(key))) throw Object.assign(Error('API Key 格式无效'), {code: 'INVALID_INPUT'});
        const mode = input.mode === 'ark' ? 'ark' : 'agent-plan';
        const fallbackModel = mode === 'agent-plan' ? SEEDREAM_PLAN_DEFAULT_MODEL : SEEDREAM_DEFAULT_MODEL;
        const model = typeof input.model === 'string' && input.model.trim() ? input.model.trim() : fallbackModel;
        if (!/^[\w.-]{1,120}$/.test(model)) throw Object.assign(Error('模型 ID 格式无效'), {code: 'INVALID_INPUT'});
        config = {key: key || config.key, mode, model};
      }
      provider = makeProvider();
      await save();
      return publicStatus();
    },
    async listModels() { await load(); return provider.listModels(); },
    async quote(input) { await load(); return provider.quote(input); },
    async submit(input) { await load(); return provider.submit(input); },
    async poll(taskId) { await load(); return provider.poll(taskId); },
    async cancel(taskId) { await load(); return provider.cancel(taskId); },
    async download(taskId, index) { await load(); return provider.download(taskId, index); },
    tasks(projectId) { return store.list(projectId ? {projectId} : {}); },
    task(taskId) { return store.get(taskId); },
    health() { return provider.health(); },
  };
}
