import {createComfyProvider, COMFYUI_BASE_URL} from './providers/comfyui.mjs';
import {createTaskStore} from './providers/task-store.mjs';
import {describeProvider} from './providers/contracts.mjs';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const isPrivate = host => LOOPBACK.has(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);

export function normalizeComfyUrl(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { throw Object.assign(Error('ComfyUI 地址无效'), {code: 'INVALID_INPUT'}); }
  if (!['http:', 'https:'].includes(url.protocol)) throw Object.assign(Error('ComfyUI 地址必须使用 http/https'), {code: 'INVALID_INPUT'});
  if (!isPrivate(url.hostname)) throw Object.assign(Error('ComfyUI 仅允许本机或局域网地址'), {code: 'INVALID_INPUT'});
  return url.origin;
}

/** 本地 ComfyUI 服务：单用户、无云端计费。 */
export function createComfyService({baseUrl = process.env.COMFYUI_URL || COMFYUI_BASE_URL, fetchImpl = fetch} = {}) {
  const store = createTaskStore();
  let current = normalizeComfyUrl(baseUrl);
  let provider = createComfyProvider({baseUrl: current, store, fetchImpl});
  const rebuild = () => { provider = createComfyProvider({baseUrl: current, store, fetchImpl}); };
  return {
    status() { return {baseUrl: current, providerId: 'comfyui', configured: true}; },
    descriptor() { return describeProvider(provider); },
    async health() { return {...(await provider.health()), baseUrl: current}; },
    async models() { return provider.listModels(); },
    async quote(input) { return provider.quote(input); },
    async submit(input) { return provider.submit(input); },
    async poll(id) { return provider.poll(id); },
    async cancel(id) { return provider.cancel(id); },
    async download(id, index) { return provider.download(id, index); },
    tasks(projectId) { return store.list(projectId ? {projectId} : {}); },
    configure(value) { current = normalizeComfyUrl(value); rebuild(); return this.status(); },
  };
}
