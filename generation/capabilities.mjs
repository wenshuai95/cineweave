// 模型能力注册表：模型/模式/端点/必填输入集中在这里，服务端与 UI 共用。
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
export const CAPABILITIES_PATH = join(ROOT, 'capabilities.json');

export async function loadCapabilities(path = CAPABILITIES_PATH) {
  const data = JSON.parse(await readFile(path, 'utf8'));
  if (!data || typeof data !== 'object' || !data.models) throw new Error('invalid capabilities.json');
  return data;
}

export function getModel(capabilities, model) {
  return capabilities?.models?.[model] || null;
}

export function resolveEndpoint(capabilities, endpointName, config = {}) {
  const endpoint = capabilities?.endpoints?.[endpointName];
  if (!endpoint) throw new Error(`unknown endpoint: ${endpointName}`);
  const configured = String(endpoint.config.split('.').reduce((value, key) => value?.[key], config) || '').trim();
  if (configured) return { name: endpointName, url: configured.replace(/\/$/, ''), configured: true, source: endpoint.config };
  const main = String(config?.comfyui?.baseUrl || '').trim();
  if (main && endpoint.fallbackPort) {
    try {
      const url = new URL(main);
      url.port = String(endpoint.fallbackPort);
      return { name: endpointName, url: url.toString().replace(/\/$/, ''), configured: false, source: 'derived' };
    } catch { /* fall through */ }
  }
  return { name: endpointName, url: main.replace(/\/$/, ''), configured: false, source: 'main' };
}

export function resolveModelMode(capability, inputs = {}) {
  const modes = capability?.modes || {};
  if (capability?.type === 'video') {
    if (inputs.sourceVideo) return 'extend';
    if (inputs.firstFrame && inputs.lastFrame) return 'flf';
    if (Number(inputs.refImageCount) >= 2) return 'r2v';
    if (inputs.firstFrame) return 'i2v';
    return 't2v';
  }
  if (capability?.type === 'image') {
    if (inputs.image && modes.edit) return inputs.mode || 'edit';
    return 't2i';
  }
  return Object.keys(modes)[0] || null;
}

export function validateModelInputs(capability, mode, inputs = {}) {
  const spec = capability?.modes?.[mode];
  if (!spec) return { ok: false, error: `模型 ${capability?.label || ''} 没有模式 ${mode}` };
  const missing = [];
  for (const requirement of spec.requires || []) {
    if (requirement === 'firstFrame' && !inputs.firstFrame) missing.push(requirement);
    if (requirement === 'lastFrame' && !inputs.lastFrame) missing.push(requirement);
    if (requirement === 'sourceVideo' && !inputs.sourceVideo) missing.push(requirement);
    if (requirement === 'image' && !inputs.image) missing.push(requirement);
    if (requirement === 'refImage1' && !(inputs.refImages?.[0])) missing.push(requirement);
    if (requirement === 'refImage2' && !(inputs.refImages?.[1])) missing.push(requirement);
  }
  return missing.length ? { ok: false, error: `缺少输入：${missing.join('、')}`, missing } : { ok: true };
}

export function describeCapabilities(capabilities) {
  return Object.entries(capabilities?.models || {}).map(([id, model]) => ({
    id,
    label: model.label || id,
    provider: model.provider,
    endpoint: model.endpoint,
    type: model.type,
    license: model.license || '',
    modes: Object.entries(model.modes || {}).map(([mode, spec]) => ({ mode, workflow: spec.workflow, mapping: spec.mapping, requires: spec.requires || [] })),
    params: model.params || {},
  }));
}
