// dreamina-canvas CLI provider：即梦官方 CLI（本地已登录）。
// 本地 Node 服务以子进程方式调用，认证/积分/登录态都由 CLI 自己管理，我们不碰账号密码。
// 关键流程：quote（报价）→ run（提交，带 submitId 幂等）→ show（终态）→ resource download（落本地）。

import { execFile as nodeExecFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(nodeExecFile);
const DEFAULT_COMMAND = 'dreamina-canvas';
const MAX_BUFFER = 8 * 1024 * 1024;

export function createDreaminaCliProvider(options = {}) {
  const command = options.command || DEFAULT_COMMAND;
  const baseArgs = Array.isArray(options.baseArgs) ? [...options.baseArgs] : [];
  const env = options.env ? { ...process.env, ...options.env } : process.env;
  const execImpl = options.execImpl || execFileAsync;
  const profile = options.profile;

  async function runCli(args, { timeoutMs = 120000 } = {}) {
    const fullArgs = [...baseArgs, ...args];
    if (profile) fullArgs.push('--profile', profile);
    fullArgs.push('--format', 'json');
    let stdout;
    try {
      const result = await execImpl(command, fullArgs, {
        timeout: timeoutMs, maxBuffer: MAX_BUFFER, env, windowsHide: true,
      });
      stdout = result?.stdout ?? '';
    } catch (error) {
      const text = String(error?.stdout || error?.message || '');
      const parsed = extractJson(text);
      if (parsed) throw cliError(parsed);
      throw providerError('DREAMINA_EXEC', text.slice(0, 600) || 'dreamina-canvas failed to start');
    }
    const parsed = extractJson(stdout);
    if (!parsed) throw providerError('DREAMINA_BAD_JSON', stdout.slice(0, 600) || 'empty CLI output');
    if (!parsed.ok) throw cliError(parsed);
    return parsed.data;
  }

  async function status() {
    return runCli(['auth', 'status']);
  }

  async function account() {
    return runCli(['auth', 'account']);
  }

  async function listModels(type) {
    const data = await runCli(['model', 'list', '--type', type]);
    return Array.isArray(data?.items) ? data.items : [];
  }

  async function listVoices() {
    const data = await runCli(['voice', 'list']);
    return data?.models || data || {};
  }

  async function quote({ projectId, nodeId }) {
    assertProject(projectId);
    const data = await runCli(['node', 'quote', '--project-id', projectId, '--node-id', nodeId]);
    const item = Array.isArray(data?.items) ? data.items[0] : null;
    return {
      maxCredits: Number(data?.totalMaxCredits ?? item?.maxCredits ?? 0),
      confirmable: Boolean(data?.confirmable),
      confirmationRequired: Boolean(data?.confirmationRequired),
      draftVersion: data?.draftVersion ?? null,
      raw: data,
    };
  }

  async function runNode({ projectId, nodeId, submitId, creditCeiling, wait = true, timeoutMs = 10 * 60 * 1000 }) {
    assertProject(projectId);
    if (!nodeId) throw providerError('DREAMINA_NODE_ID', 'nodeId is required');
    const args = ['node', 'run', '--project-id', projectId, '--node-id', nodeId];
    if (submitId) args.push('--submit-id', submitId);
    if (creditCeiling != null) args.push('--credit-ceiling', String(Math.round(Number(creditCeiling))));
    if (wait) args.push('--wait', '--timeout', `${Math.round(timeoutMs / 1000)}s`);
    args.push('--non-interactive', '--yes');
    const data = await runCli(args, { timeoutMs: timeoutMs + 30000 });
    return {
      submitId: data?.submission?.submitId || submitId || null,
      state: data?.submission?.state || null,
      resources: Array.isArray(data?.submission?.resources) ? data.submission.resources : [],
      quote: data?.quote || null,
      raw: data,
    };
  }

  async function uploadResource({ projectId, file, name }) {
    assertProject(projectId);
    const args = ['resource', 'upload', '--project-id', projectId, '--file', file, '--import-kind', 'local_upload'];
    if (name) args.push('--name', name);
    const data = await runCli(args, { timeoutMs: 120000 });
    const resourceId = data?.resourceId || data?.resource?.resourceId;
    if (!resourceId) throw providerError('DREAMINA_RESOURCE_ID', 'resource upload returned no resourceId');
    return { resourceId, raw: data };
  }

  async function createCanvas(name) {
    const data = await runCli(['canvas', 'create', name]);
    const projectId = data?.project?.projectId;
    if (!projectId) throw providerError('DREAMINA_CANVAS', 'canvas create returned no projectId');
    return { projectId, name: data.project.name, webUrl: data.project.webUrl };
  }

  async function createVideoNode({ projectId, prompt, ratio = '16:9', resolution = '480p', duration = 4, model = 'seedance_2.5_draft', title = '画布视频生成', mode = 't2v', refs = [] }) {
    assertProject(projectId);
    if (!String(prompt || '').trim()) throw providerError('DREAMINA_PROMPT', 'prompt is required');
    const args = [
      'node', 'create', 'video', '--project-id', projectId,
      '--mode', mode, '--model', model, '--prompt', prompt,
      '--ratio', ratio, '--resolution', resolution, '--duration', String(duration),
      '--title', title,
    ];
    for (const ref of refs) args.push('--ref', ref);
    const data = await runCli(args, { timeoutMs: 120000 });
    const node = data?.node || data;
    if (!node?.nodeId) throw providerError('DREAMINA_NODE_ID', 'video node creation returned no nodeId');
    return { nodeId: node.nodeId, generation: node.generation || null, raw: data };
  }

  async function createImageNode({ projectId, prompt, mode = 't2i', model = 'high_aes_general_v50_flash', ratio = '16:9', resolution = '2K', count = 1, title = '画布图片生成' }) {
    assertProject(projectId);
    if (!String(prompt || '').trim()) throw providerError('DREAMINA_PROMPT', 'prompt is required');
    const args = [
      'node', 'create', 'image', '--project-id', projectId,
      '--mode', mode, '--model', model, '--prompt', prompt,
      '--ratio', ratio, '--resolution', resolution, '--count', String(count),
      '--title', title,
    ];
    const data = await runCli(args, { timeoutMs: 120000 });
    const node = data?.node || data;
    if (!node?.nodeId) throw providerError('DREAMINA_NODE_ID', 'image node creation returned no nodeId');
    return { nodeId: node.nodeId, generation: node.generation || null, raw: data };
  }

  async function createAudioNode({ projectId, prompt, mode = 'tts', model = 'legacy_tts', voiceName, voiceId, scenario = 'text-reading' }) {
    assertProject(projectId);
    if (!String(prompt || '').trim()) throw providerError('DREAMINA_PROMPT', 'prompt is required');
    const args = ['node', 'create', 'audio', '--project-id', projectId, '--mode', mode, '--model', model, '--prompt', prompt, '--title', '画布音频生成'];
    if (scenario && model !== 'legacy_tts') args.push('--scenario', scenario);
    if (voiceId) args.push('--voice-id', voiceId);
    else if (voiceName) args.push('--voice-name', voiceName);
    const data = await runCli(args, { timeoutMs: 120000 });
    const node = data?.node || data;
    if (!node?.nodeId) throw providerError('DREAMINA_NODE_ID', 'audio node creation returned no nodeId');
    return { nodeId: node.nodeId, generation: node.generation || null, raw: data };
  }

  async function pickVoice(preferredModel = 'legacy_tts') {
    const data = await runCli(['voice', 'list']);
    const models = data?.models || data || {};
    const groups = Object.entries(models);
    const group = groups.find(([key]) => key === preferredModel) || groups[0];
    const items = Array.isArray(group?.[1]?.items) ? group[1].items : [];
    const first = items.find((item) => item?.voiceName || item?.voiceId);
    if (!first) return null;
    return { voiceName: first.voiceName, voiceId: first.voiceId, model: group?.[0] || preferredModel };
  }

  async function confirmNode({ projectId, nodeId, creditCeiling }) {
    assertProject(projectId);
    if (!Number.isFinite(Number(creditCeiling))) throw providerError('DREAMINA_CEILING', 'creditCeiling must be a number');
    const data = await runCli(['node', 'confirm', '--project-id', projectId, '--node-id', nodeId, '--credit-ceiling', String(Math.round(Number(creditCeiling)))]);
    if (!data?.creditConfirmationToken) throw providerError('DREAMINA_NO_TOKEN', 'credit confirmation returned no token');
    return { token: data.creditConfirmationToken, creditCeiling: data.creditCeiling, expiresAt: data.expiresAt };
  }

  async function runNodeWithToken({ projectId, nodeId, submitId, creditToken }) {
    assertProject(projectId);
    const args = ['node', 'run', '--project-id', projectId, '--node-id', nodeId, '--submit-id', submitId];
    if (creditToken) args.push('--credit-token', creditToken);
    const data = await runCli(args, { timeoutMs: 120000 });
    return data?.submission || data;
  }

  async function waitOperation({ submitId, projectId, timeoutMs = 10 * 60 * 1000, intervalMs = 5000 }) {
    const args = ['operation', 'wait', submitId, '--timeout', `${Math.round(timeoutMs / 1000)}s`, '--interval', `${Math.max(1, Math.round(intervalMs / 1000))}s`];
    if (projectId) args.push('--project-id', projectId);
    return runCli(args, { timeoutMs: timeoutMs + 30000 });
  }

  async function show({ projectId, nodeIds }) {
    assertProject(projectId);
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    const args = ['node', 'show', '--project-id', projectId];
    for (const id of ids) args.push('--node-id', id);
    const data = await runCli(args);
    return Array.isArray(data?.nodes) ? data.nodes : [];
  }

  async function downloadResource({ projectId, resourceId, output }) {
    if (!resourceId) throw providerError('DREAMINA_RESOURCE_ID', 'resourceId is required');
    const args = ['resource', 'download', resourceId, '-o', output];
    if (projectId) args.push('--project-id', projectId);
    return runCli(args, { timeoutMs: 5 * 60 * 1000 });
  }

  async function listCanvases() {
    const data = await runCli(['canvas', 'ls']);
    return Array.isArray(data?.items) ? data.items : [];
  }

  return {
    kind: 'dreamina-cli', command, status, account, listModels, listVoices,
    quote, runNode, show, downloadResource, listCanvases,
    createCanvas, createVideoNode, createAudioNode, createImageNode, uploadResource, pickVoice,
    confirmNode, runNodeWithToken, waitOperation,
  };
}

export function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* 继续找内嵌 JSON */ }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
  }
  return null;
}

function cliError(parsed) {
  const error = parsed?.error || {};
  const code = error.code != null ? `DREAMINA_${error.code}` : 'DREAMINA_ERROR';
  const parts = [error.message || 'dreamina-canvas error'];
  if (Array.isArray(error.diagnostics)) {
    for (const item of error.diagnostics.slice(0, 3)) {
      if (item?.detail) parts.push(String(item.detail));
    }
  }
  const wrapped = providerError(code, parts.join(' · ').slice(0, 800));
  wrapped.raw = parsed;
  return wrapped;
}

function assertProject(projectId) {
  if (!projectId || !/^[0-9a-f-]{8,}$/i.test(String(projectId))) {
    throw providerError('DREAMINA_PROJECT_ID', 'a project (canvas) id is required');
  }
}

function providerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
