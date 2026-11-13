// ComfyUI provider：本机或局域网另一台电脑上的 ComfyUI HTTP API。
// 不依赖浏览器，由本地 Node 服务调用，因此没有 CORS 限制；地址可配置。
// 文档：POST /prompt → GET /history/{id} → GET /view；参考图走 POST /upload/image。

const DEFAULT_BASE = 'http://127.0.0.1:8188';

export function createComfyUIProvider(options = {}) {
  const baseUrl = normalizeBase(options.baseUrl || DEFAULT_BASE);
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 30000;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const clientId = options.clientId || `zaomeng-${Math.random().toString(36).slice(2, 10)}`;
  if (typeof fetchImpl !== 'function') throw providerError('COMFY_FETCH_MISSING', 'fetch is not available');

  async function request(path, { method = 'GET', body, signal, expect = 'json' } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        body,
        signal: controller.signal,
        headers: body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
      });
      if (!response.ok) {
        const text = await safeText(response);
        throw providerError('COMFY_HTTP', `${method} ${path} -> ${response.status} ${text}`.trim());
      }
      if (expect === 'buffer') return Buffer.from(await response.arrayBuffer());
      if (expect === 'none') return null;
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw providerError('COMFY_TIMEOUT', `${method} ${path} timed out after ${timeoutMs}ms`);
      if (String(error.code || '').startsWith('COMFY_')) throw error;
      throw providerError('COMFY_NETWORK', `${method} ${path} failed: ${error.message || error}`);
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  async function testConnection() {
    const stats = await request('/system_stats');
    return {
      ok: true,
      baseUrl,
      version: stats?.system?.comfyui_version || stats?.system?.os || 'unknown',
      devices: Array.isArray(stats?.devices) ? stats.devices.length : 0,
    };
  }

  async function uploadImage(buffer, filename = 'reference.png', { subfolder = '', type = 'input', overwrite = false } = {}) {
    if (!buffer || !buffer.length) throw providerError('COMFY_UPLOAD_EMPTY', 'image buffer is empty');
    const form = new FormData();
    form.append('image', new Blob([buffer], { type: guessMime(filename) }), filename);
    if (subfolder) form.append('subfolder', subfolder);
    form.append('type', type);
    if (overwrite) form.append('overwrite', 'true');
    const data = await request('/upload/image', { method: 'POST', body: form });
    return { name: data.name, subfolder: data.subfolder || subfolder, type: data.type || type };
  }

  async function interrupt() {
    return request('/interrupt', { method: 'POST', body: '{}', expect: 'none' }).catch(() => null);
  }

  async function submit(workflow, extra = {}) {
    if (!workflow || typeof workflow !== 'object') throw providerError('COMFY_WORKFLOW', 'workflow object is required');
    const payload = { prompt: workflow, client_id: clientId, ...extra };
    const data = await request('/prompt', { method: 'POST', body: JSON.stringify(payload) });
    if (data?.node_errors && Object.keys(data.node_errors).length) {
      throw providerError('COMFY_NODE_ERRORS', JSON.stringify(data.node_errors).slice(0, 800));
    }
    if (!data?.prompt_id) throw providerError('COMFY_NO_PROMPT_ID', 'ComfyUI did not return prompt_id');
    return { promptId: data.prompt_id, number: data.number ?? null, raw: data };
  }

  async function getHistory(promptId) {
    if (!promptId) throw providerError('COMFY_NO_PROMPT_ID', 'promptId is required');
    const history = await request(`/history/${encodeURIComponent(promptId)}`);
    return history?.[promptId] || null;
  }

  async function waitFor(promptId, { intervalMs = 800, timeoutMs: waitTimeout = 600000, onProgress } = {}) {
    const started = Date.now();
    let last = null;
    for (;;) {
      if (Date.now() - started > waitTimeout) {
        throw providerError('COMFY_WAIT_TIMEOUT', `generation did not finish within ${waitTimeout}ms`);
      }
      last = await getHistory(promptId);
      if (last) {
        const status = last.status || {};
        const failed = String(status.status_str || '').toLowerCase() === 'error';
        if (failed) throw providerError('COMFY_FAILED', summarizeStatus(last));
        if (status.completed) {
          return { history: last, outputs: collectOutputs(last) };
        }
      }
      onProgress?.({ promptId, elapsedMs: Date.now() - started });
      await sleep(intervalMs);
    }
  }

  async function download({ filename, subfolder = '', type = 'output' }) {
    if (!filename) throw providerError('COMFY_DOWNLOAD', 'filename is required');
    const params = new URLSearchParams({ filename, subfolder, type });
    return request(`/view?${params}`, { expect: 'buffer' });
  }

  return { kind: 'comfyui', baseUrl, testConnection, uploadImage, submit, interrupt, getHistory, waitFor, download };
}

// 把生成请求映射进 ComfyUI workflow（API 格式 JSON）。
// mapping: [{ nodeId, input, from, value? }]，from ∈ prompt|width|height|seed|image|video|duration|steps|custom
export function applyInputMapping(workflow, mapping = [], values = {}) {
  const next = structuredClone(workflow);
  const used = new Set();
  for (const item of mapping) {
    if (!item || !item.nodeId || !item.input) throw providerError('COMFY_MAPPING', 'mapping item needs nodeId and input');
    const node = next[item.nodeId];
    if (!node || typeof node !== 'object') throw providerError('COMFY_MAPPING_NODE', `workflow has no node ${item.nodeId}`);
    node.inputs = node.inputs || {};
    let value;
    if (item.from === 'custom' || (item.value !== undefined && !item.from)) value = item.value;
    else value = values[item.from];
    if (value === undefined || value === null) {
      throw providerError('COMFY_MAPPING_VALUE', `missing value for ${item.from}`);
    }
    if (item.type === 'number') value = Number(value);
    if (item.type === 'boolean') value = Boolean(value);
    node.inputs[item.input] = value;
    used.add(item.from);
  }
  return { workflow: next, used: [...used] };
}

export function collectOutputs(historyEntry) {
  const outputs = [];
  for (const [nodeId, value] of Object.entries(historyEntry?.outputs || {})) {
    for (const [key, list] of Object.entries(value || {})) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        if (item.filename || item.subfolder || item.type) {
          outputs.push({
            nodeId,
            kind: key,
            filename: item.filename,
            subfolder: item.subfolder || '',
            type: item.type || 'output',
            format: item.format || '',
            isVideo: /video|gif|webp/i.test(key) || /\.(mp4|webm|gif)$/i.test(item.filename || ''),
          });
        }
      }
    }
  }
  return outputs;
}

function summarizeStatus(historyEntry) {
  const messages = historyEntry?.status?.messages;
  if (Array.isArray(messages)) {
    const error = messages.find((entry) => Array.isArray(entry) && String(entry[0]).includes('error'));
    if (error) return String(error[1]?.exception_message || error[0]).slice(0, 500);
  }
  return 'ComfyUI reported an error';
}

function normalizeBase(value) {
  const text = String(value || DEFAULT_BASE).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(text)) throw providerError('COMFY_BASE_URL', `invalid base URL: ${value}`);
  return text;
}

function guessMime(filename) {
  const lower = String(filename).toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  return 'image/png';
}

async function safeText(response) {
  try { return (await response.text()).slice(0, 500); } catch { return ''; }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function providerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
