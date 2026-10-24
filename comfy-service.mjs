import {createComfyProvider, COMFYUI_BASE_URL} from './providers/comfyui.mjs';
import {createPersistentTaskStore} from './providers/persistent-task-store.mjs';
import {describeProvider} from './providers/contracts.mjs';
import {resolveComfyLaunch, spawnComfy} from './comfy-launcher.mjs';
import {join} from 'node:path';
import {probeComfyH3} from './providers/comfy-h3.mjs';

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
export function createComfyService({baseUrl = process.env.COMFYUI_URL || COMFYUI_BASE_URL, fetchImpl = fetch, folder = null} = {}) {
  const store = createPersistentTaskStore({file: join(folder || '.', 'comfy-tasks.json')});
  let current = normalizeComfyUrl(baseUrl);
  let provider = createComfyProvider({baseUrl: current, store, fetchImpl});
  const rebuild = () => { provider = createComfyProvider({baseUrl: current, store, fetchImpl}); };
  let starting = null;
  return {
    ready: () => store.ready,
    status() { return {baseUrl: current, providerId: 'comfyui', configured: true}; },
    descriptor() { return describeProvider(provider); },
    async health() { return {...(await provider.health()), baseUrl: current}; },
    async h3Status() { return probeComfyH3({baseUrl: current, fetchImpl}); },
    async start() {
      if (starting) return starting;
      starting = (async () => {
        const before = await provider.health();
        if (before.ok) return {...before, alreadyRunning: true, baseUrl: current};
        let url;
        try { url = new URL(current); } catch { throw Object.assign(Error('ComfyUI 地址无效'), {code: 'INVALID_INPUT'}); }
        if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw Object.assign(Error('只能自动启动本机 ComfyUI'), {code: 'INVALID_INPUT'});
        const launch = await resolveComfyLaunch({comfyDir: process.env.COMFYUI_DIR, port: Number(url.port) || 8188});
        const child = await spawnComfy(launch, {logFile: folder ? join(folder, 'comfyui.log') : null});
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        for (let i = 0; i < 50; i++) {
          await sleep(1000);
          const health = await provider.health();
          if (health.ok) return {...health, started: true, pid: child.pid, baseUrl: current};
          if (child.exitCode !== null) throw Object.assign(Error('ComfyUI 启动后立即退出，请查看日志'), {code: 'COMFY_START_FAILED'});
        }
        throw Object.assign(Error('ComfyUI 启动超时（50 秒），请确认 ~/ComfyUI 的 Python 环境'), {code: 'COMFY_START_TIMEOUT'});
      })().finally(() => { starting = null; });
      return starting;
    },
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
