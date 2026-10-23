import {describeProvider, validateProvider} from './contracts.mjs';

/** Provider 注册表：新增厂商只需要 register 一个实现。 */
export function createProviderRegistry({providers = []} = {}) {
  const map = new Map();

  const registry = {
    register(provider) {
      validateProvider(provider);
      if (map.has(provider.id)) throw new Error(`provider already registered: ${provider.id}`);
      map.set(provider.id, provider);
      return provider;
    },
    unregister(id) {
      return map.delete(id);
    },
    get(id) {
      const provider = map.get(id);
      if (!provider) throw new Error(`unknown provider: ${id}`);
      return provider;
    },
    has(id) {
      return map.has(id);
    },
    list() {
      return [...map.values()].map(describeProvider);
    },
    enabled() {
      return [...map.values()].filter(provider => provider.enabled).map(describeProvider);
    },
    getProvider(id) {
      return registry.get(id);
    },
  };

  for (const provider of providers) registry.register(provider);
  return registry;
}
