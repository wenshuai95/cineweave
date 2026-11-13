// 生成服务：本地 HTTP API，供画布（浏览器）调用。生产环境会挂到 server.mjs，
// 开发时用 `node generation/server.mjs` 单独跑，Vite 通过代理访问。
import http from 'node:http';
import { readFile, writeFile, mkdir, access, readdir, rm } from 'node:fs/promises';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createComfyUIProvider, applyInputMapping } from './providers/comfyui.mjs';
import { createDreaminaCliProvider } from './providers/dreamina-cli.mjs';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadConfig, saveConfig, DATA_DIR, ASSETS_DIR as CONFIG_ASSETS_DIR } from './config.mjs';
import { createJobStore } from './jobs.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO = join(ROOT, '..');
const WORKFLOW_DIR = join(ROOT, 'workflows');
const ASSETS_DIR = CONFIG_ASSETS_DIR;
const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const jobs = createJobStore();
let activeJobId = null;
const pendingQuotes = new Map();
let voiceCache = null;
let dreaminaModelCache = null;
let dreaminaModelCacheAt = 0;
let voiceCacheAt = 0;

const RELIGHT_FG_MAPPING = [
  { nodeId: '1', input: 'image', from: 'image' },
  { nodeId: '9', input: 'text', from: 'prompt' },
  { nodeId: '10', input: 'text', from: 'negativePrompt' },
  { nodeId: '12', input: 'seed', from: 'seed', type: 'number' },
];

const RELIGHT_LIGHT_MAPPING = [
  { nodeId: '1', input: 'image', from: 'image' },
  { nodeId: '6', input: 'text', from: 'prompt' },
  { nodeId: '7', input: 'text', from: 'negativePrompt' },
  { nodeId: '9', input: 'seed', from: 'seed', type: 'number' },
];

const MATTE_MAPPING = [
  { nodeId: '1', input: 'image', from: 'image' },
];

const INPAINT_MAPPING = [
  { nodeId: '2', input: 'image', from: 'image' },
  { nodeId: '3', input: 'image', from: 'mask' },
  { nodeId: '7', input: 'text', from: 'prompt' },
  { nodeId: '8', input: 'text', from: 'negativePrompt' },
  { nodeId: '9', input: 'seed', from: 'seed', type: 'number' },
];

const OUTPAINT_MAPPING = [
  { nodeId: '2', input: 'image', from: 'image' },
  { nodeId: '5', input: 'text', from: 'prompt' },
  { nodeId: '6', input: 'text', from: 'negativePrompt' },
  { nodeId: '7', input: 'seed', from: 'seed', type: 'number' },
  { nodeId: '3', input: 'left', from: 'left', type: 'number' },
  { nodeId: '3', input: 'top', from: 'top', type: 'number' },
  { nodeId: '3', input: 'right', from: 'right', type: 'number' },
  { nodeId: '3', input: 'bottom', from: 'bottom', type: 'number' },
];

const CONTROLNET_MAPPING = [
  { nodeId: '2', input: 'image', from: 'image' },
  { nodeId: '3', input: 'text', from: 'prompt' },
  { nodeId: '4', input: 'text', from: 'negativePrompt' },
  { nodeId: '8', input: 'seed', from: 'seed', type: 'number' },
  { nodeId: '9', input: 'width', from: 'width', type: 'number' },
  { nodeId: '9', input: 'height', from: 'height', type: 'number' },
  { nodeId: '7', input: 'strength', from: 'strength', type: 'number' },
];

const IPADAPTER_MAPPING = [
  { nodeId: '2', input: 'image', from: 'image' },
  { nodeId: '4', input: 'text', from: 'prompt' },
  { nodeId: '5', input: 'text', from: 'negativePrompt' },
  { nodeId: '8', input: 'seed', from: 'seed', type: 'number' },
  { nodeId: '7', input: 'width', from: 'width', type: 'number' },
  { nodeId: '7', input: 'height', from: 'height', type: 'number' },
  { nodeId: '6', input: 'weight', from: 'weight', type: 'number' },
];

const USDU_MAPPING = [
  { nodeId: '2', input: 'image', from: 'image' },
  { nodeId: '6', input: 'upscale_by', from: 'upscaleBy', type: 'number' },
  { nodeId: '6', input: 'seed', from: 'seed', type: 'number' },
  { nodeId: '3', input: 'text', from: 'prompt' },
];

const FACE_DETAIL_MAPPING = [
  { nodeId: '2', input: 'image', from: 'image' },
  { nodeId: '6', input: 'seed', from: 'seed', type: 'number' },
  { nodeId: '6', input: 'denoise', from: 'denoise', type: 'number' },
  { nodeId: '3', input: 'text', from: 'prompt' },
];

const FLUX_T2I_MAPPING = [
  { nodeId: '4', input: 'text', from: 'prompt' },
  { nodeId: '5', input: 'width', from: 'width', type: 'number' },
  { nodeId: '5', input: 'height', from: 'height', type: 'number' },
  { nodeId: '7', input: 'seed', from: 'seed', type: 'number' },
];

const ZIMAGE_T2I_MAPPING = [
  { nodeId: '4', input: 'text', from: 'prompt' },
  { nodeId: '5', input: 'text', from: 'negativePrompt' },
  { nodeId: '6', input: 'width', from: 'width', type: 'number' },
  { nodeId: '6', input: 'height', from: 'height', type: 'number' },
  { nodeId: '8', input: 'seed', from: 'seed', type: 'number' },
];

const SDXL_I2I_MAPPING = [
  { nodeId: '4', input: 'text', from: 'prompt' },
  { nodeId: '5', input: 'text', from: 'negativePrompt' },
  { nodeId: '6', input: 'seed', from: 'seed', type: 'number' },
  { nodeId: '6', input: 'denoise', from: 'denoise', type: 'number' },
  { nodeId: '2', input: 'image', from: 'image' },
];

const SDXL_T2I_MAPPING = [
  { nodeId: '6', input: 'text', from: 'prompt' },
  { nodeId: '7', input: 'text', from: 'negativePrompt' },
  { nodeId: '5', input: 'width', from: 'width', type: 'number' },
  { nodeId: '5', input: 'height', from: 'height', type: 'number' },
  { nodeId: '3', input: 'seed', from: 'seed', type: 'number' },
];

export function createGenerationServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    if (!url.pathname.startsWith('/api/generation/')) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    await handleGeneration(req, res, url).catch((error) => {
      sendJson(res, 500, { error: error.message || String(error), code: error.code || 'GENERATION_ERROR' });
    });
  });
}

export async function handleGeneration(req, res, url) {
  if (!url.pathname.startsWith('/api/generation/')) return false;
  try {
    await handle(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: error.message || String(error), code: error.code || 'GENERATION_ERROR' });
  }
  return true;
}

async function getDreaminaModelCatalog(provider) {
  if (dreaminaModelCache && Date.now() - dreaminaModelCacheAt < 5 * 60 * 1000) return dreaminaModelCache;
  const [image, video, audio] = await Promise.all([
    provider.listModels('image'),
    provider.listModels('video'),
    provider.listModels('audio'),
  ]);
  dreaminaModelCache = {
    image: Array.isArray(image) ? image : [],
    video: Array.isArray(video) ? video : [],
    audio: Array.isArray(audio) ? audio : [],
    fetchedAt: Date.now(),
  };
  dreaminaModelCacheAt = Date.now();
  return dreaminaModelCache;
}

function cliFlag(mode, name) {
  return (mode?.flags || []).find((flag) => flag.flag === name) || null;
}

function cliModeRefs(mode) {
  return mode?.references || { min: 0, max: 0, types: [] };
}

function pickCliMode(spec, names, refCount = 0) {
  const modes = Array.isArray(spec?.modes) ? spec.modes : [];
  const candidates = modes.filter((mode) => names.includes(mode.name));
  const fits = candidates.filter((mode) => {
    const refs = cliModeRefs(mode);
    return refCount >= (Number(refs.min) || 0) && refCount <= (Number(refs.max) || 0);
  });
  return fits[0] || (refCount === 0 ? candidates.find((mode) => (Number(cliModeRefs(mode).min) || 0) === 0) : null) || null;
}

function cliAllowedValues(mode, flagName) {
  const flag = cliFlag(mode, flagName);
  return Array.isArray(flag?.values) ? flag.values : [];
}

function cliNumberRange(mode, flagName, fallbackMin, fallbackMax) {
  const flag = cliFlag(mode, flagName);
  return {
    min: Number.isFinite(Number(flag?.min)) ? Number(flag.min) : fallbackMin,
    max: Number.isFinite(Number(flag?.max)) ? Number(flag.max) : fallbackMax,
  };
}

function fallbackCliSpec(type, model) {
  if (type === 'image') return { model, displayName: model, modes: [{ name: 't2i', flags: [{ flag: '--resolution', values: ['1.5K', '2K'] }, { flag: '--count', min: 1, max: 4 }], references: { min: 0, max: 0 } }] };
  if (type === 'video') return { model, displayName: model, modes: [
    { name: 't2v', flags: [{ flag: '--resolution', values: ['480p', '720p', '1080p'] }, { flag: '--duration', min: 4, max: 15 }], references: { min: 0, max: 0 } },
    { name: 'first_last_frame', flags: [{ flag: '--resolution', values: ['480p', '720p', '1080p'] }, { flag: '--duration', min: 4, max: 15 }], references: { min: 1, max: 2 } },
  ] };
  return { model, displayName: model, modes: [{ name: 'tts', flags: [], references: { min: 0, max: 0 } }] };
}

function pickCliModel(catalog, type, requested, fallback) {
  const list = catalog?.[type] || [];
  return list.find((item) => item.model === requested) || list.find((item) => item.model === fallback) || list[0] || fallbackCliSpec(type, requested || fallback || 'seedance_2.5_draft');
}

async function handle(req, res, url) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && url.pathname === '/api/generation/health') {
    const config = await loadConfig();
    sendJson(res, 200, {
      ok: true,
      providers: {
        comfyui: { baseUrl: config.comfyui.baseUrl },
        dreamina: { command: config.dreamina.command },
      },
      busy: Boolean(activeJobId),
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/generation/config') {
    const config = await loadConfig();
    const safe = structuredClone(config);
    if (safe.deepseek) {
      const settings = await getDeepSeekSettings(config);
      safe.deepseek.hasKey = Boolean(settings.key);
      safe.deepseek.apiKey = '';
      safe.deepseek.source = settings.key && !config.deepseek?.apiKey ? 'text-model' : safe.deepseek.hasKey ? 'config' : '';
    }
    sendJson(res, 200, safe);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generation/config') {
    const patch = await readJson(req);
    // 空 key 表示“保持不变”，避免设置页保存其他项时把已配置的 key 清掉。
    if (patch.deepseek && 'apiKey' in patch.deepseek && !patch.deepseek.apiKey) delete patch.deepseek.apiKey;
    const saved = await saveConfig(patch);
    const safe = structuredClone(saved);
    if (safe.deepseek) { safe.deepseek.hasKey = Boolean(safe.deepseek.apiKey); safe.deepseek.apiKey = ''; }
    sendJson(res, 200, safe);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/generation/providers') {
    const config = await loadConfig();
    const comfyui = { baseUrl: config.comfyui.baseUrl, ok: false };
    try {
      const provider = createComfyUIProvider({ baseUrl: config.comfyui.baseUrl, timeoutMs: 3000 });
      const info = await provider.testConnection();
      Object.assign(comfyui, { ok: true, version: info.version, devices: info.devices });
    } catch (error) {
      comfyui.error = error.message;
    }
    sendJson(res, 200, { comfyui, dreamina: { command: config.dreamina.command } });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/generation/models') {
    const config = await loadConfig();
    const provider = createDreaminaCliProvider({ command: config.dreamina.command, profile: config.dreamina.profile || undefined });
    try {
      const catalog = await getDreaminaModelCatalog(provider);
      sendJson(res, 200, catalog);
    } catch (error) {
      sendJson(res, 200, { image: [], video: [], audio: [], error: error.message || String(error) });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/generation/workflows') {
    const config = await loadConfig();
    let files = [];
    try { files = await readdir(WORKFLOW_DIR); } catch { files = []; }
    const workflows = files
      .filter((file) => file.endsWith('.json') && !file.endsWith('.mapping.json'))
      .map((file) => {
        const name = file.slice(0, -5);
        const hasMapping = files.includes(`${name}.mapping.json`);
        return { name, hasMapping, hasWorkflow: true };
      });
    sendJson(res, 200, {
      workflowDir: WORKFLOW_DIR,
      imageWorkflow: config.comfyui.workflow || '',
      videoWorkflow: config.comfyui.videoWorkflow || '',
      workflows,
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/generation/voices') {
    if (voiceCache && Date.now() - voiceCacheAt < 10 * 60 * 1000) {
      sendJson(res, 200, { voices: voiceCache });
      return;
    }
    const config = await loadConfig();
    const provider = createDreaminaCliProvider({ command: config.dreamina.command, profile: config.dreamina.profile || undefined });
    const data = await provider.listVoices();
    const voices = flattenVoices(data);
    if (voices.length) { voiceCache = voices; voiceCacheAt = Date.now(); }
    sendJson(res, 200, { voices });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generation/quote') {
    const body = await readJson(req);
    const kind = body.kind || 'dreamina-video';
    if (!['dreamina-video', 'dreamina-audio', 'dreamina-image'].includes(kind)) { sendJson(res, 400, { error: `unsupported quote kind: ${kind}` }); return; }
    const prompt = String(body.prompt || '').trim();
    if (!prompt) { sendJson(res, 400, { error: '提示词不能为空' }); return; }
    const config = await loadConfig();
    const provider = createDreaminaCliProvider({ command: config.dreamina.command, profile: config.dreamina.profile || undefined });
    const projectId = await ensureDreaminaProject(config, provider);
    pruneQuotes();
    const quoteId = `quote_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    let created;
    let pending;
    if (kind === 'dreamina-image') {
      const catalog = await getDreaminaModelCatalog(provider).catch(() => null);
      const spec = pickCliModel(catalog, 'image', body.model || config.dreamina.imageModel, 'high_aes_general_v50_flash');
      const mode = pickCliMode(spec, ['t2i']) || spec?.modes?.[0] || null;
      const model = spec?.model || body.model || config.dreamina.imageModel || 'high_aes_general_v50_flash';
      const allowedRes = cliAllowedValues(mode, '--resolution');
      const resolution = allowedRes.includes(body.resolution) ? body.resolution : (allowedRes[0] || body.resolution || '2K');
      const ratio = body.ratio || '16:9';
      const countRange = cliNumberRange(mode, '--count', 1, 4);
      const count = clampInt(body.count, countRange.min, countRange.max, 1);
      created = await provider.createImageNode({ projectId, prompt, model, ratio, resolution, count });
      pending = { kind, projectId, nodeId: created.nodeId, model, resolution, ratio, count, prompt };
    } else if (kind === 'dreamina-video') {
      const catalog = await getDreaminaModelCatalog(provider).catch(() => null);
      const frameRefs = [];
      for (const [key, label] of [['firstFrameUrl', '首帧'], ['lastFrameUrl', '尾帧']]) {
        const assetName = basename(String(body[key] || '').split('?')[0]);
        if (!assetName) continue;
        const uploaded = await provider.uploadResource({ projectId, file: join(ASSETS_DIR, assetName), name: `${label}-${assetName}` });
        frameRefs.push(`res:${uploaded.resourceId}`);
      }
      const spec = pickCliModel(catalog, 'video', body.model || config.dreamina.videoModel, 'seedance_2.5_draft');
      const mode = frameRefs.length >= 2
        ? pickCliMode(spec, ['first_last_frame'], 2)
        : frameRefs.length === 1
          ? pickCliMode(spec, ['first_last_frame'], 1)
          : pickCliMode(spec, ['t2v'], 0);
      if (!mode) throw jobError(`模型 ${spec?.displayName || body.model || ''} 不支持当前参考数量（${frameRefs.length} 张）`);
      const model = spec?.model || body.model || config.dreamina.videoModel || 'seedance_2.5_draft';
      const allowedRes = cliAllowedValues(mode, '--resolution');
      const resolution = allowedRes.includes(String(body.resolution || '').toLowerCase()) ? String(body.resolution).toLowerCase() : (allowedRes.includes(body.resolution) ? body.resolution : (allowedRes[0] || body.resolution || '480p'));
      const ratio = body.ratio || '16:9';
      const durationRange = cliNumberRange(mode, '--duration', 4, 15);
      const duration = clampInt(body.duration, durationRange.min, durationRange.max, Math.min(5, durationRange.max));
      created = await provider.createVideoNode({
        projectId, prompt, ratio, resolution, duration, model,
        mode: mode.name, refs: frameRefs,
      });
      pending = { kind, projectId, nodeId: created.nodeId, model, resolution, duration, ratio, prompt, frameRefs, mode: mode.name };
    } else {
      const catalog = await getDreaminaModelCatalog(provider).catch(() => null);
      const requestedAudio = body.model || 'legacy_tts';
      const spec = pickCliModel(catalog, 'audio', requestedAudio, 'legacy_tts');
      const audioModel = spec?.model || requestedAudio;
      const scenario = audioModel === 'seed_audio_v1' ? 'text-reading' : undefined;
      const voice = await provider.pickVoice(audioModel).catch(() => null);
      const voiceName = body.voiceName || voice?.voiceName;
      created = await provider.createAudioNode({ projectId, prompt, model: audioModel, voiceName, scenario });
      pending = { kind, projectId, nodeId: created.nodeId, model: audioModel, prompt, voiceName, scenario };
    }
    const quote = await provider.quote({ projectId, nodeId: created.nodeId });
    pending.credits = quote.maxCredits;
    pending.createdAt = Date.now();
    pendingQuotes.set(quoteId, pending);
    sendJson(res, 200, {
      quoteId, kind, credits: quote.maxCredits, model: pending.model, voiceName: pending.voiceName || null,
      resolution: pending.resolution, duration: pending.duration, ratio: pending.ratio,
      confirmationRequired: quote.confirmationRequired, projectId, mode: pending.mode || null,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generation/jobs') {
    const body = await readJson(req);
    const kind = body.kind || 'comfyui-image';
    if (!['comfyui-image', 'comfyui-video', 'comfyui-upscale', 'comfyui-detail', 'comfyui-inpaint', 'comfyui-outpaint', 'comfyui-matte', 'comfyui-relight', 'dreamina-video', 'dreamina-audio', 'dreamina-image'].includes(kind)) {
      sendJson(res, 400, { error: `unsupported job kind: ${kind}` });
      return;
    }
    if (activeJobId) {
      const running = jobs.get(activeJobId);
      if (running && !['success', 'failed', 'canceled'].includes(running.status)) {
        sendJson(res, 429, { error: '当前已有生成任务在跑，请稍后再试', jobId: activeJobId });
        return;
      }
      activeJobId = null;
    }
    let pending = null;
    if (kind === 'dreamina-video' || kind === 'dreamina-audio' || kind === 'dreamina-image') {
      pruneQuotes();
      pending = pendingQuotes.get(body.quoteId);
      if (!pending) { sendJson(res, 409, { error: '报价已过期，请重新生成报价' }); return; }
      pendingQuotes.delete(body.quoteId);
    }
    const job = jobs.create(kind, { prompt: body.prompt || pending?.prompt || '' });
    activeJobId = job.id;
    const run = kind === 'comfyui-image'
      ? runComfyImageJob(job.id, body)
      : kind === 'comfyui-video'
        ? runComfyVideoJob(job.id, body)
        : kind === 'comfyui-upscale'
          ? runComfyPostJob(job.id, body, 'upscale')
          : kind === 'comfyui-detail'
            ? runComfyPostJob(job.id, body, 'detail')
            : kind === 'comfyui-inpaint'
              ? runComfyEditJob(job.id, body, 'inpaint')
              : kind === 'comfyui-outpaint'
                ? runComfyEditJob(job.id, body, 'outpaint')
                : kind === 'comfyui-matte'
                  ? runComfyMatteJob(job.id, body)
                  : kind === 'comfyui-relight'
                    ? runComfyRelightJob(job.id, body)
      : kind === 'dreamina-audio'
        ? runDreaminaAudioJob(job.id, pending, body.creditCeiling)
        : kind === 'dreamina-image'
          ? runDreaminaImageJob(job.id, pending, body.creditCeiling)
          : runDreaminaVideoJob(job.id, pending, body.creditCeiling);
    run.catch((error) => {
      jobs.update(job.id, { status: 'failed', message: error.message || String(error), error: { code: error.code || 'JOB_FAILED', message: error.message } });
    }).finally(() => { if (activeJobId === job.id) activeJobId = null; });
    sendJson(res, 202, { id: job.id, status: job.status });
    return;
  }

  const jobMatch = url.pathname.match(/^\/api\/generation\/jobs\/([A-Za-z0-9_-]+)$/);
  if (req.method === 'GET' && jobMatch) {
    const job = jobs.get(jobMatch[1]);
    if (!job) { sendJson(res, 404, { error: 'job not found' }); return; }
    sendJson(res, 200, job);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generation/prompt/optimize') {
    const body = await readJson(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) { sendJson(res, 400, { error: '提示词不能为空' }); return; }
    const mode = ['image', 'video', 'audio'].includes(body.mode) ? body.mode : 'image';
    const config = await loadConfig();
    const system = `You are a senior prompt engineer for AI ${mode} generation. Rewrite the user's prompt into a more specific, vivid and model-friendly prompt. Keep every intent, subject, count and constraint from the user. Add only details that are strongly implied (lighting, lens, material, composition, atmosphere) and keep it concise. Return strict JSON only: {"zh":"optimized Chinese prompt","en":"optimized English prompt"}. Both fields must be complete, self-contained prompts. No markdown, no explanations.`;
    try {
      const raw = await callDeepSeek([
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ], config, { maxTokens: 1200, temperature: 0.5 });
      let zh = raw;
      let en = '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed.zh) zh = String(parsed.zh).trim();
          if (parsed.en) en = String(parsed.en).trim();
        } catch { /* fall through */ }
      }
      if (!en) {
        try {
          en = await translateTextToEnglish(zh, config);
        } catch { en = ''; }
      }
      sendJson(res, 200, { optimized: zh, optimizedEn: en, model: (await getDeepSeekSettings(config)).model });
    } catch (error) {
      sendJson(res, 502, { error: `提示词优化失败：${error.message}` });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generation/assistant') {
    const body = await readJson(req);
    const messages = Array.isArray(body.messages) ? body.messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim()).slice(-20) : [];
    if (!messages.length) { sendJson(res, 400, { error: '消息不能为空' }); return; }
    const config = await loadConfig();
    const context = body.context && typeof body.context === 'object' ? JSON.stringify(body.context).slice(0, 2500) : '';
    const system = `你是造梦工坊画布里的 AI 助手，面向中文影视创作者。你擅长剧本、分镜、镜头语言、即梦/ComfyUI 提示词、画面修改建议。回答简洁、可执行，优先给具体提示词或镜头描述；不要长篇理论。${context ? `\n当前画布上下文（供参考，不要复述）：${context}` : ''}`;
    try {
      const reply = await callDeepSeek([{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))], config, { maxTokens: 1200, temperature: 0.7 });
      sendJson(res, 200, { reply, model: (await getDeepSeekSettings(config)).model });
    } catch (error) {
      sendJson(res, 502, { error: `AI 助手失败：${error.message}` });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generation/prompt/translate') {
    const body = await readJson(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) { sendJson(res, 400, { error: '提示词不能为空' }); return; }
    const config = await loadConfig();
    try {
      const translated = await translateTextToEnglish(prompt, config);
      sendJson(res, 200, { translated, model: (await getDeepSeekSettings(config)).model });
    } catch (error) {
      sendJson(res, 502, { error: `翻译失败：${error.message}` });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generation/upload') {
    const body = await readJson(req);
    const dataUrl = String(body.dataUrl || '');
    const match = dataUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) { sendJson(res, 400, { error: '只支持 PNG/JPEG dataURL' }); return; }
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > 25 * 1024 * 1024) { sendJson(res, 400, { error: '图片过大' }); return; }
    await mkdir(ASSETS_DIR, { recursive: true, mode: 0o700 });
    const filename = `mask_${randomUUID().slice(0, 8)}.${match[1] === 'jpeg' ? 'jpg' : 'png'}`;
    await writeFile(join(ASSETS_DIR, filename), bytes);
    sendJson(res, 200, { url: `/api/generation/assets/${filename}`, filename });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generation/timeline/export') {
    const body = await readJson(req);
    const items = Array.isArray(body.items) ? body.items.filter((item) => item && item.videoUrl).slice(0, 30) : [];
    if (!items.length) { sendJson(res, 400, { error: '时间线没有可导出的视频片段' }); return; }
    const work = join(ASSETS_DIR, `.timeline-${randomUUID().slice(0, 8)}`);
    await mkdir(work, { recursive: true, mode: 0o700 });
    try {
      const segments = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const assetName = basename(String(item.videoUrl).split('?')[0]);
        const input = join(ASSETS_DIR, assetName);
        const output = join(work, `seg_${String(index).padStart(3, '0')}.mp4`);
        const start = Math.max(0, Number(item.sourceStart ?? item.start) || 0);
        const duration = Math.max(0.2, Number(item.duration) || 1);
        await execFileAsync(FFMPEG, ['-y', '-ss', String(start), '-t', String(duration), '-i', input,
          '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-ar', '48000', '-ac', '2', output], { timeout: 120000 });
        segments.push(output);
      }
      const list = join(work, 'list.txt');
      await writeFile(list, segments.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n'));
      const filename = `timeline_${randomUUID().slice(0, 8)}.mp4`;
      await execFileAsync(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', join(ASSETS_DIR, filename)], { timeout: 120000 });
      sendJson(res, 200, { url: `/api/generation/assets/${filename}`, filename, type: 'video', segments: segments.length });
    } catch (error) {
      sendJson(res, 500, { error: `时间线导出失败：${error.message}` });
    } finally {
      await rm(work, { recursive: true, force: true }).catch(() => {});
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generation/video/trim') {
    const body = await readJson(req);
    const assetName = basename(String(body.videoUrl || '').split('?')[0]);
    if (!assetName) { sendJson(res, 400, { error: '缺少视频' }); return; }
    const input = join(ASSETS_DIR, assetName);
    const start = Math.max(0, Number(body.start) || 0);
    const end = Math.max(start + 0.3, Number(body.end) || start + 1);
    const filename = `vtrim_${randomUUID().slice(0, 8)}.mp4`;
    try {
      await execFileAsync(FFMPEG, ['-y', '-ss', String(start), '-t', String(end - start), '-i', input, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', join(ASSETS_DIR, filename)], { timeout: 120000 });
      sendJson(res, 200, { url: `/api/generation/assets/${filename}`, filename, type: 'video', start, end });
    } catch (error) {
      sendJson(res, 500, { error: `视频修剪失败：${error.message}` });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generation/audio/trim') {
    const body = await readJson(req);
    const assetName = basename(String(body.audioUrl || '').split('?')[0]);
    if (!assetName) { sendJson(res, 400, { error: '缺少音频' }); return; }
    const input = join(ASSETS_DIR, assetName);
    const start = Math.max(0, Number(body.start) || 0);
    const end = Math.max(start + 0.2, Number(body.end) || start + 1);
    const filename = `trim_${randomUUID().slice(0, 8)}.m4a`;
    try {
      await execFileAsync(FFMPEG, ['-y', '-ss', String(start), '-t', String(end - start), '-i', input, '-vn', '-c:a', 'aac', '-b:a', '192k', join(ASSETS_DIR, filename)], { timeout: 60000 });
      sendJson(res, 200, { url: `/api/generation/assets/${filename}`, filename, type: 'audio', start, end });
    } catch (error) {
      sendJson(res, 500, { error: `裁剪音频失败：${error.message}` });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generation/video/frame') {
    const body = await readJson(req);
    const assetName = basename(String(body.videoUrl || '').split('?')[0]);
    if (!assetName) { sendJson(res, 400, { error: '缺少视频' }); return; }
    const input = join(ASSETS_DIR, assetName);
    const time = Math.max(0, Math.min(3600, Number(body.time) || 1));
    const filename = `frame_${randomUUID().slice(0, 8)}.png`;
    try {
      await execFileAsync(FFMPEG, ['-y', '-ss', String(time), '-i', input, '-frames:v', '1', join(ASSETS_DIR, filename)], { timeout: 60000 });
      sendJson(res, 200, { url: `/api/generation/assets/${filename}`, filename, type: 'image', time });
    } catch (error) {
      sendJson(res, 500, { error: `截取帧失败：${error.message}` });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generation/video/audio') {
    const body = await readJson(req);
    const assetName = basename(String(body.videoUrl || '').split('?')[0]);
    if (!assetName) { sendJson(res, 400, { error: '缺少视频' }); return; }
    const input = join(ASSETS_DIR, assetName);
    const filename = `audio_${randomUUID().slice(0, 8)}.m4a`;
    try {
      await execFileAsync(FFMPEG, ['-y', '-i', input, '-vn', '-c:a', 'aac', '-b:a', '192k', join(ASSETS_DIR, filename)], { timeout: 60000 });
      sendJson(res, 200, { url: `/api/generation/assets/${filename}`, filename, type: 'audio' });
    } catch (error) {
      sendJson(res, 500, { error: `分离音频失败：${error.message}` });
    }
    return;
  }

  const assetMatch = url.pathname.match(/^\/api\/generation\/assets\/([A-Za-z0-9_.-]+)$/);
  if (req.method === 'GET' && assetMatch) {
    const name = basename(assetMatch[1]);
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) { sendJson(res, 400, { error: 'bad asset name' }); return; }
    const file = join(ASSETS_DIR, name);
    try {
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': mimeOf(name), 'Cache-Control': 'no-store' });
      res.end(bytes);
    } catch {
      sendJson(res, 404, { error: 'asset not found' });
    }
    return;
  }

  sendJson(res, 404, { error: 'not found' });
}

async function runDreaminaAudioJob(jobId, pending, creditCeiling) {
  const config = await loadConfig();
  const provider = createDreaminaCliProvider({ command: config.dreamina.command, profile: config.dreamina.profile || undefined });
  const ceiling = Math.max(Number(creditCeiling) || 0, pending.credits);
  jobs.update(jobId, { status: 'running', progress: 15, message: '积分确认…' });
  const confirmation = await provider.confirmNode({ projectId: pending.projectId, nodeId: pending.nodeId, creditCeiling: ceiling });
  jobs.update(jobId, { progress: 30, message: '提交即梦音频…' });
  const submitId = randomUUID();
  await provider.runNodeWithToken({ projectId: pending.projectId, nodeId: pending.nodeId, submitId, creditToken: confirmation.token });
  jobs.update(jobId, { progress: 45, message: '生成中…', meta: { submitId } });
  await provider.waitOperation({ submitId, projectId: pending.projectId, timeoutMs: 5 * 60 * 1000, intervalMs: 4000 });
  jobs.update(jobId, { progress: 85, message: '下载结果…' });
  const nodes = await provider.show({ projectId: pending.projectId, nodeIds: [pending.nodeId] });
  const node = nodes[0]?.node;
  const resource = (node?.resources || []).find((item) => item.type === 'audio' && item.status === 'success') || (node?.resources || [])[0];
  if (!resource?.resourceId) throw jobError('即梦没有返回音频资源');
  await mkdir(ASSETS_DIR, { recursive: true, mode: 0o700 });
  const filename = `${jobId}.mp3`;
  await provider.downloadResource({ projectId: pending.projectId, resourceId: resource.resourceId, output: join(ASSETS_DIR, filename) });
  jobs.update(jobId, {
    status: 'success', progress: 100, message: '完成',
    result: {
      url: `/api/generation/assets/${filename}`, filename, type: 'audio',
      provider: 'dreamina-cli', resourceId: resource.resourceId,
      credits: resource.creditsAmount ?? pending.credits, model: pending.model,
    },
  });
}

function flattenVoices(data) {
  const models = data?.models || data || {};
  const out = [];
  for (const [model, group] of Object.entries(models)) {
    const items = Array.isArray(group?.items) ? group.items : [];
    for (const item of items) {
      if (!item?.voiceName && !item?.voiceId) continue;
      out.push({ model, voiceName: item.voiceName || '', voiceId: item.voiceId || '', tags: item.tags || {} });
    }
  }
  return out;
}

async function runComfyPostJob(jobId, input, mode) {
  const config = await loadConfig();
  const isUpscale = mode === 'upscale';
  const workflowName = isUpscale
    ? (config.comfyui.upscaleWorkflow || 'upscale-usdu')
    : (config.comfyui.detailWorkflow || 'detail-face');
  const template = JSON.parse(await readFile(join(WORKFLOW_DIR, `${workflowName}.json`), 'utf8'));
  const assetName = basename(String(input.imageUrl || '').split('?')[0]);
  if (!assetName) throw jobError('缺少参考图');
  let bytes;
  try { bytes = await readFile(join(ASSETS_DIR, assetName)); } catch { throw jobError(`参考图资产不存在：${assetName}`); }
  const provider = createComfyUIProvider({ baseUrl: config.comfyui.baseUrl, timeoutMs: config.comfyui.timeoutMs || 30000 });
  jobs.update(jobId, { status: 'running', progress: 3, message: '上传图片…' });
  const uploaded = await provider.uploadImage(bytes, assetName, { type: 'input', overwrite: true });
  const image = uploaded.subfolder ? `${uploaded.subfolder}/${uploaded.name}` : uploaded.name;
  const prompt = String(input.prompt || '').trim();
  const seed = Number.isFinite(Number(input.seed)) ? Number(input.seed) : Math.floor(Math.random() * 1e9);
  const values = isUpscale
    ? { image, prompt, seed, upscaleBy: Number(input.upscaleBy) || 1.5 }
    : { image, prompt, seed, denoise: Number(input.denoise) || 0.4 };
  const { workflow } = applyInputMapping(template, isUpscale ? USDU_MAPPING : FACE_DETAIL_MAPPING, values);
  jobs.update(jobId, { status: 'running', progress: 8, message: isUpscale ? '放大中…' : '修脸中…' });
  const submitted = await provider.submit(workflow);
  const { outputs } = await provider.waitFor(submitted.promptId, {
    intervalMs: 2000,
    timeoutMs: 10 * 60 * 1000,
    onProgress: ({ elapsedMs }) => jobs.update(jobId, { progress: Math.min(92, 8 + Math.round(elapsedMs / 1500)), message: isUpscale ? '放大中…' : '修脸中…' }),
  });
  const out = outputs.find((item) => item.filename && !item.isVideo) || outputs[0];
  if (!out?.filename) throw jobError('ComfyUI 没有返回图片');
  const resultBytes = await provider.download(out);
  await mkdir(ASSETS_DIR, { recursive: true, mode: 0o700 });
  const filename = `${jobId}.png`;
  await writeFile(join(ASSETS_DIR, filename), resultBytes);
  jobs.update(jobId, {
    status: 'success', progress: 100, message: '完成',
    result: {
      url: `/api/generation/assets/${filename}`, filename, bytes: resultBytes.length,
      type: 'image', provider: 'comfyui', promptId: submitted.promptId, sourceName: out.filename,
      postProcess: mode,
    },
  });
}

async function runComfyRelightJob(jobId, input) {
  const config = await loadConfig();
  const variant = input.variant === 'light' ? 'light' : 'fg';
  const workflowName = variant === 'light'
    ? (config.comfyui.relightLightWorkflow || 'iclight-relight')
    : (config.comfyui.relightFgWorkflow || 'iclight-relight-fg');
  const template = JSON.parse(await readFile(join(WORKFLOW_DIR, `${workflowName}.json`), 'utf8'));
  const sourceName = basename(String(input.imageUrl || '').split('?')[0]);
  if (!sourceName) throw jobError('缺少源图');
  let bytes;
  try { bytes = await readFile(join(ASSETS_DIR, sourceName)); } catch { throw jobError(`源图资产不存在：${sourceName}`); }
  const provider = createComfyUIProvider({ baseUrl: config.comfyui.baseUrl, timeoutMs: config.comfyui.timeoutMs || 30000 });
  jobs.update(jobId, { status: 'running', progress: 5, message: '上传图片…' });
  const uploaded = await provider.uploadImage(bytes, sourceName, { type: 'input', overwrite: true });
  const image = uploaded.subfolder ? `${uploaded.subfolder}/${uploaded.name}` : uploaded.name;
  const seed = Number.isFinite(Number(input.seed)) ? Number(input.seed) : Math.floor(Math.random() * 1e9);
  const prompt = String(input.prompt || '').trim() || (variant === 'light'
    ? 'a portrait, detailed face, warm orange light from the left side, cinematic rim light, dark background'
    : 'photo of a person, strong warm sunlight from the left side, dark shadow on the right side of the face');
  const { workflow } = applyInputMapping(template, variant === 'light' ? RELIGHT_LIGHT_MAPPING : RELIGHT_FG_MAPPING, {
    image, prompt, negativePrompt: 'bad quality, blurry, deformed', seed,
  });
  jobs.update(jobId, { status: 'running', progress: 12, message: variant === 'light' ? '轻补光中…' : '重打光中…' });
  const submitted = await provider.submit(workflow);
  const { outputs } = await provider.waitFor(submitted.promptId, {
    intervalMs: 1500,
    timeoutMs: 5 * 60 * 1000,
    onProgress: ({ elapsedMs }) => jobs.update(jobId, { progress: Math.min(92, 12 + Math.round(elapsedMs / 600)), message: variant === 'light' ? '轻补光中…' : '重打光中…' }),
  });
  const out = outputs.find((item) => item.filename && !item.isVideo) || outputs[0];
  if (!out?.filename) throw jobError('ComfyUI 没有返回图片');
  const resultBytes = await provider.download(out);
  await mkdir(ASSETS_DIR, { recursive: true, mode: 0o700 });
  const filename = `${jobId}.png`;
  await writeFile(join(ASSETS_DIR, filename), resultBytes);
  jobs.update(jobId, {
    status: 'success', progress: 100, message: '完成',
    result: { url: `/api/generation/assets/${filename}`, filename, bytes: resultBytes.length, type: 'image', provider: 'comfyui', promptId: submitted.promptId, sourceName: out.filename, postProcess: 'relight' },
  });
}

async function runComfyMatteJob(jobId, input) {
  const config = await loadConfig();
  const workflowName = config.comfyui.matteWorkflow || 'matte-birefnet';
  const template = JSON.parse(await readFile(join(WORKFLOW_DIR, `${workflowName}.json`), 'utf8'));
  const sourceName = basename(String(input.imageUrl || '').split('?')[0]);
  if (!sourceName) throw jobError('缺少源图');
  let bytes;
  try { bytes = await readFile(join(ASSETS_DIR, sourceName)); } catch { throw jobError(`源图资产不存在：${sourceName}`); }
  const provider = createComfyUIProvider({ baseUrl: config.comfyui.baseUrl, timeoutMs: config.comfyui.timeoutMs || 30000 });
  jobs.update(jobId, { status: 'running', progress: 5, message: '上传图片…' });
  const uploaded = await provider.uploadImage(bytes, sourceName, { type: 'input', overwrite: true });
  const image = uploaded.subfolder ? `${uploaded.subfolder}/${uploaded.name}` : uploaded.name;
  const { workflow } = applyInputMapping(template, MATTE_MAPPING, { image });
  jobs.update(jobId, { status: 'running', progress: 15, message: '抠图中…' });
  const submitted = await provider.submit(workflow);
  const { outputs } = await provider.waitFor(submitted.promptId, {
    intervalMs: 1500,
    timeoutMs: 5 * 60 * 1000,
    onProgress: ({ elapsedMs }) => jobs.update(jobId, { progress: Math.min(92, 15 + Math.round(elapsedMs / 800)), message: '抠图中…' }),
  });
  const out = outputs.find((item) => item.filename && !item.isVideo) || outputs[0];
  if (!out?.filename) throw jobError('ComfyUI 没有返回图片');
  const resultBytes = await provider.download(out);
  await mkdir(ASSETS_DIR, { recursive: true, mode: 0o700 });
  const filename = `${jobId}.png`;
  await writeFile(join(ASSETS_DIR, filename), resultBytes);
  jobs.update(jobId, {
    status: 'success', progress: 100, message: '完成',
    result: { url: `/api/generation/assets/${filename}`, filename, bytes: resultBytes.length, type: 'image', provider: 'comfyui', promptId: submitted.promptId, sourceName: out.filename, postProcess: 'matte' },
  });
}

async function runComfyEditJob(jobId, input, mode) {
  const config = await loadConfig();
  const isInpaint = mode === 'inpaint';
  const workflowName = isInpaint
    ? (config.comfyui.inpaintWorkflow || 'inpaint-sdxl')
    : (config.comfyui.outpaintWorkflow || 'outpaint-sdxl');
  const template = JSON.parse(await readFile(join(WORKFLOW_DIR, `${workflowName}.json`), 'utf8'));
  const sourceName = basename(String(input.imageUrl || '').split('?')[0]);
  if (!sourceName) throw jobError('缺少源图');
  const provider = createComfyUIProvider({ baseUrl: config.comfyui.baseUrl, timeoutMs: config.comfyui.timeoutMs || 30000 });
  const prompt = String(input.prompt || '').trim();
  let sourceBytes;
  try { sourceBytes = await readFile(join(ASSETS_DIR, sourceName)); } catch { throw jobError(`源图资产不存在：${sourceName}`); }
  jobs.update(jobId, { status: 'running', progress: 4, message: '上传图片…' });
  const uploadedSource = await provider.uploadImage(sourceBytes, sourceName, { type: 'input', overwrite: true });
  const image = uploadedSource.subfolder ? `${uploadedSource.subfolder}/${uploadedSource.name}` : uploadedSource.name;
  const seed = Number.isFinite(Number(input.seed)) ? Number(input.seed) : Math.floor(Math.random() * 1e9);
  const values = { image, prompt, negativePrompt: 'blurry, low quality, deformed', seed };
  if (isInpaint) {
    const maskName = basename(String(input.maskUrl || '').split('?')[0]);
    if (!maskName) throw jobError('缺少蒙版');
    let maskBytes;
    try { maskBytes = await readFile(join(ASSETS_DIR, maskName)); } catch { throw jobError(`蒙版资产不存在：${maskName}`); }
    const uploadedMask = await provider.uploadImage(maskBytes, maskName, { type: 'input', overwrite: true });
    values.mask = uploadedMask.subfolder ? `${uploadedMask.subfolder}/${uploadedMask.name}` : uploadedMask.name;
  } else {
    const pixels = Math.max(64, Math.min(1536, Number(input.pixels) || 256));
    const direction = String(input.direction || 'right');
    values.left = direction === 'left' ? pixels : 0;
    values.top = direction === 'top' ? pixels : 0;
    values.right = direction === 'right' ? pixels : 0;
    values.bottom = direction === 'bottom' ? pixels : 0;
  }
  const { workflow } = applyInputMapping(template, isInpaint ? INPAINT_MAPPING : OUTPAINT_MAPPING, values);
  jobs.update(jobId, { status: 'running', progress: 10, message: isInpaint ? '局部重绘中…' : '扩图中…' });
  const submitted = await provider.submit(workflow);
  const { outputs } = await provider.waitFor(submitted.promptId, {
    intervalMs: 2000,
    timeoutMs: 10 * 60 * 1000,
    onProgress: ({ elapsedMs }) => jobs.update(jobId, { progress: Math.min(92, 10 + Math.round(elapsedMs / 1500)), message: isInpaint ? '局部重绘中…' : '扩图中…' }),
  });
  const out = outputs.find((item) => item.filename && !item.isVideo) || outputs[0];
  if (!out?.filename) throw jobError('ComfyUI 没有返回图片');
  const resultBytes = await provider.download(out);
  await mkdir(ASSETS_DIR, { recursive: true, mode: 0o700 });
  const filename = `${jobId}.png`;
  await writeFile(join(ASSETS_DIR, filename), resultBytes);
  jobs.update(jobId, {
    status: 'success', progress: 100, message: '完成',
    result: {
      url: `/api/generation/assets/${filename}`, filename, bytes: resultBytes.length,
      type: 'image', provider: 'comfyui', promptId: submitted.promptId, sourceName: out.filename,
      postProcess: mode,
    },
  });
}

const VIDEO_WORKFLOWS = {
  h3: { t2v: 'h3-t2v', i2v: 'h3-i2v', label: 'H3' },
  wan22: { t2v: 'wan22-t2v', i2v: 'wan22-t2v', label: 'Wan 2.2' },
  ltx23: { t2v: 'ltx23-t2v', i2v: 'ltx23-t2v', label: 'LTX-2.3' },
  framepack: { t2v: 'framepack-i2v', i2v: 'framepack-i2v', label: 'FramePack' },
  'h3-ref2v': { t2v: 'h3-ref2v', i2v: 'h3-ref2v', label: 'H3 Ref2VA' },
};

async function readReferenceBytes(url, type = 'image') {
  const raw = String(url || '').trim();
  if (!raw) throw jobError('参考素材 URL 为空');
  let pathname = '';
  try { pathname = decodeURIComponent(new URL(raw, 'http://127.0.0.1').pathname); } catch { pathname = raw; }
  const name = basename(pathname);
  if (name && pathname.includes('/api/generation/assets/')) {
    try { return await readFile(join(ASSETS_DIR, name)); } catch { /* 继续尝试 HTTP */ }
  }
  if (/^https?:/i.test(raw)) {
    const response = await fetch(raw);
    if (!response.ok) throw jobError(`下载参考素材失败：HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  // 画布相对地址：交给本地主服务读取（生成服务与主服务同机）。
  const base = process.env.DIRECTOR_CANVAS_BASE || `http://127.0.0.1:${process.env.PORT || 41974}`;
  const response = await fetch(new URL(raw, base));
  if (!response.ok) throw jobError(`读取参考素材失败：HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function referenceFilename(item, index, type) {
  const raw = String(item?.url || item?.filename || '');
  let name = '';
  try { name = basename(decodeURIComponent(new URL(raw, 'http://127.0.0.1').pathname)); } catch { name = basename(raw); }
  if (!name || !extname(name)) {
    const ext = type === 'video' ? '.mp4' : type === 'audio' ? '.wav' : '.png';
    name = `ref_${type}_${index + 1}${ext}`;
  }
  return name;
}

function derive045Base(config) {
  if (config.comfyui.baseUrl045) return config.comfyui.baseUrl045;
  try {
    const url = new URL(config.comfyui.baseUrl);
    url.port = '8190';
    return url.toString().replace(/\/$/, '');
  } catch {
    return config.comfyui.baseUrl;
  }
}

async function uploadComfyInput(provider, url, fallbackName, jobId, label) {
  const bytes = await readReferenceBytes(url, 'image');
  const name = basename(decodeURIComponent(new URL(String(url), 'http://127.0.0.1').pathname)) || fallbackName;
  const uploaded = await provider.uploadImage(bytes, name, { type: 'input', overwrite: true });
  return uploaded.subfolder ? `${uploaded.subfolder}/${uploaded.name}` : uploaded.name;
}

async function runH3UltimateJob(jobId, input, config) {
  const hasFirst = Boolean(input.firstFrameUrl || input.imageUrl);
  const hasLast = Boolean(input.lastFrameUrl);
  const refs = Array.isArray(input.refImages) ? input.refImages.filter(Boolean) : [];
  const sourceVideo = input.sourceVideoUrl || '';
  const mode = sourceVideo ? 'extend' : (hasFirst && hasLast ? 'flf' : refs.length >= 2 ? 'r2v' : hasFirst ? 'i2v' : 't2v');
  if (mode === 'extend' && !sourceVideo) throw jobError('H3 Ultimate 续写需要源视频');
  if (mode === 'flf' && (!hasFirst || !hasLast)) throw jobError('H3 Ultimate 首尾帧需要同时提供首帧和尾帧');
  if (mode === 'r2v' && refs.length < 2) throw jobError('H3 Ultimate R2V 至少需要两张参考图');
  const mappingFile = JSON.parse(await readFile(join(WORKFLOW_DIR, 'h3-ultimate.mapping.json'), 'utf8'));
  const spec = mappingFile.mapping?.[mode];
  if (!spec?.file) throw jobError(`H3 Ultimate 缺少 ${mode} 映射`);
  const template = JSON.parse(await readFile(join(WORKFLOW_DIR, spec.file), 'utf8'));
  const provider = createComfyUIProvider({ baseUrl: derive045Base(config), timeoutMs: config.comfyui.timeoutMs || 30000 });
  const values = {
    prompt: String(input.prompt || '').trim(),
    seed: Number.isFinite(Number(input.seed)) ? Number(input.seed) : Math.floor(Math.random() * 1e9),
    outputPrefix: 'video/h3_ultimate',
    megapixels: Number(input.megapixels) > 0 ? Number(input.megapixels) : 0.22,
  };
  if (!values.prompt) throw jobError('生成提示词不能为空');
  const uploaded = [];
  const uploadSpecs = spec.uploads || [];
  for (let i = 0; i < uploadSpecs.length; i += 1) {
    const item = uploadSpecs[i];
    const from = item.from;
    if (!from) continue;
    const url = from === 'firstFrame' ? (input.firstFrameUrl || input.imageUrl)
      : from === 'lastFrame' ? input.lastFrameUrl
      : from === 'sourceVideo' ? sourceVideo
      : from === 'refImage1' ? refs[0]
      : from === 'refImage2' ? refs[1]
      : null;
    if (!url) throw jobError(`H3 Ultimate ${mode} 缺少 ${from}`);
    jobs.update(jobId, { status: 'running', progress: Math.min(10, 3 + i), message: `上传 ${from}…` });
    const name = await uploadComfyInput(provider, url, `${from}.png`, jobId, from);
    uploaded.push({ nodeId: item.nodeId, input: item.input, value: name });
  }
  const resolutionNode = { t2v: '39', i2v: '40', flf: '41', r2v: '41', extend: '39' }[mode];
  const mapping = [...(spec.params || []), ...uploaded];
  if (resolutionNode) mapping.push({ nodeId: resolutionNode, input: 'megapixels', from: 'megapixels', type: 'number' });
  const { workflow } = applyInputMapping(template, mapping, values);
  jobs.update(jobId, { status: 'running', progress: 12, message: '提交到 ComfyUI 0.45（H3 Ultimate）…' });
  const submitted = await provider.submit(workflow);
  jobs.update(jobId, { progress: 20, message: '已排队，H3 Ultimate 生成中…', meta: { promptId: submitted.promptId, model: 'h3-ultimate', mode } });
  const { outputs } = await provider.waitFor(submitted.promptId, {
    intervalMs: 3000,
    timeoutMs: 35 * 60 * 1000,
    onProgress: ({ elapsedMs }) => jobs.update(jobId, { progress: Math.min(90, 20 + Math.round(elapsedMs / 3000)), message: `H3 Ultimate ${mode} 生成中…` }),
  });
  const video = outputs.find((item) => item.isVideo) || outputs.find((item) => /\.(mp4|webm|gif)$/i.test(item.filename || '')) || outputs[0];
  if (!video?.filename) throw jobError('ComfyUI 没有返回视频');
  const bytes = await provider.download(video);
  await mkdir(ASSETS_DIR, { recursive: true, mode: 0o700 });
  const filename = `${jobId}.mp4`;
  await writeFile(join(ASSETS_DIR, filename), bytes);
  jobs.update(jobId, {
    status: 'success', progress: 100, message: '完成',
    result: { url: `/api/generation/assets/${filename}`, filename, type: 'video', provider: 'comfyui', promptId: submitted.promptId, sourceName: video.filename, model: 'h3-ultimate', mode },
  });
}

async function runComfyVideoJob(jobId, input) {
  const config = await loadConfig();
  const hasImage = Boolean(input.imageUrl);
  const requestedModel = String(input.model || input.workflow || '').trim();
  if (requestedModel === 'h3-ultimate') return runH3UltimateJob(jobId, input, config);
  const spec = VIDEO_WORKFLOWS[requestedModel] || null;
  if (requestedModel === 'framepack' && !hasImage) throw jobError('FramePack 需要首帧参考图，请先连接一张图片');
  const name = spec
    ? (hasImage ? spec.i2v : spec.t2v)
    : hasImage
      ? (config.comfyui.videoWorkflowI2v || 'h3-i2v')
      : (config.comfyui.videoWorkflow || 'h3-t2v');
  const workflowPath = join(WORKFLOW_DIR, `${name}.json`);
  const mappingPath = join(WORKFLOW_DIR, `${name}.mapping.json`);
  try {
    await access(workflowPath);
    await access(mappingPath);
  } catch {
    throw jobError(`未配置 ComfyUI 视频 workflow：generation/workflows/${name}.json 与 ${name}.mapping.json（等待 Windows 侧 H3 API 导出）`);
  }
  const template = JSON.parse(await readFile(workflowPath, 'utf8'));
  const mappingSpec = JSON.parse(await readFile(mappingPath, 'utf8'));
  const prompt = String(input.prompt || '').trim();
  if (!prompt) throw jobError('生成提示词不能为空');
  const defaults = mappingSpec.defaults || {};
  const width = clampInt(input.width, 256, 1536, defaults.width || 832);
  const height = clampInt(input.height, 256, 1536, defaults.height || 480);
  const duration = Number(input.duration) > 0 ? Number(input.duration) : (defaults.duration || 5);
  const fps = Number(input.fps) > 0 ? Number(input.fps) : (Number(defaults.fps) > 0 ? Number(defaults.fps) : 16);
  let frames = Number(input.frames) > 0 ? Math.round(Number(input.frames)) : Math.round(duration * fps);
  // Wan 2.2 要求 4n+1 帧；LTX 要求 8n+1 帧。就近取整，避免出畸形画面。
  if (name.startsWith('wan22')) frames = Math.max(9, Math.round((frames - 1) / 4) * 4 + 1);
  else if (name.startsWith('ltx23')) frames = Math.max(9, Math.round((frames - 1) / 8) * 8 + 1);
  const values = {
    prompt,
    negativePrompt: input.negativePrompt || defaults.negativePrompt || '',
    width, height, duration, frames, fps,
    steps: Number(input.steps) > 0 ? Math.round(Number(input.steps)) : (Number(defaults.steps) > 0 ? Math.round(Number(defaults.steps)) : 30),
    seed: Number.isFinite(Number(input.seed)) ? Number(input.seed) : Math.floor(Math.random() * 1e9),
  };
  const isRef2v = requestedModel === 'h3-ref2v';
  const refImages = isRef2v ? (Array.isArray(input.refImages) ? input.refImages.filter(Boolean).slice(0, 9) : []) : [];
  const refVideos = isRef2v ? (Array.isArray(input.refVideos) ? input.refVideos.filter(Boolean).slice(0, 3) : []) : [];
  const refAudios = isRef2v ? (Array.isArray(input.refAudios) ? input.refAudios.filter(Boolean).slice(0, 3) : []) : [];
  if (isRef2v && !refImages.length && !refVideos.length && !refAudios.length) throw jobError('H3 多模态参考至少需要一张参考图、一段参考视频或一段参考音频');
  const provider = createComfyUIProvider({ baseUrl: config.comfyui.baseUrl, timeoutMs: config.comfyui.timeoutMs || 30000 });
  if (isRef2v) {
    const uploads = [
      ...refImages.map((item, index) => ({ item, type: 'image', target: `refImage${index + 1}` })),
      ...refVideos.map((item, index) => ({ item, type: 'video', target: `refVideo${index + 1}` })),
      ...refAudios.map((item, index) => ({ item, type: 'audio', target: `refAudio${index + 1}` })),
    ];
    for (let i = 0; i < uploads.length; i += 1) {
      const { item, type, target } = uploads[i];
      const url = typeof item === 'string' ? item : item.url;
      jobs.update(jobId, { status: 'running', progress: Math.min(12, 3 + i), message: `上传参考素材 ${i + 1}/${uploads.length}…` });
      const bytes = await readReferenceBytes(url, type);
      const uploaded = await provider.uploadImage(bytes, referenceFilename(item, i, type), { type: 'input', overwrite: true });
      values[target] = uploaded.subfolder ? `${uploaded.subfolder}/${uploaded.name}` : uploaded.name;
    }
    values.refImageCount = refImages.length;
    values.refVideoCount = refVideos.length;
    values.refAudioCount = refAudios.length;
    values.outputPrefix = defaults.outputPrefix || 'video/h3_ref2v';
  }
  if (hasImage) {
    // 画布参考图：/api/generation/assets/<file> → 读本地资产 → 上传到 ComfyUI → 注入 LoadImage.image
    const assetName = basename(String(input.imageUrl).split('?')[0]);
    let bytes;
    try {
      bytes = await readFile(join(ASSETS_DIR, assetName));
    } catch {
      throw jobError(`参考图资产不存在：${assetName}`);
    }
    jobs.update(jobId, { status: 'running', progress: 5, message: '上传参考图…' });
    const uploaded = await provider.uploadImage(bytes, assetName, { type: 'input', overwrite: true });
    // 若 ComfyUI 返回了 subfolder，LoadImage 要填 subfolder/name（Windows 侧 11:52 实测口径）。
    values.image = uploaded.subfolder ? `${uploaded.subfolder}/${uploaded.name}` : uploaded.name;
    jobs.update(jobId, { progress: 8, message: '参考图已上传', meta: { image: uploaded.name } });
  }
  let mapping = mappingSpec.mapping || [];
  if (isRef2v) {
    mapping = mapping.filter((item) => {
      if (!item.from) return true;
      if (/^refImage\d+$/.test(item.from)) return Number(item.from.slice(8)) <= refImages.length;
      if (/^refVideo\d+$/.test(item.from)) return Number(item.from.slice(8)) <= refVideos.length;
      if (/^refAudio\d+$/.test(item.from)) return Number(item.from.slice(8)) <= refAudios.length;
      return true;
    });
  }
  const { workflow } = applyInputMapping(template, mapping, values);
  const label = spec?.label || (hasImage ? 'H3 图生视频' : 'H3');
  jobs.update(jobId, { status: 'running', progress: 10, message: `提交到 ComfyUI（${label}）…` });
  const submitted = await provider.submit(workflow);
  jobs.update(jobId, { progress: 20, message: `已排队，${label} 生成中…`, meta: { promptId: submitted.promptId, model: requestedModel || 'h3' } });
  const timeoutMs = requestedModel === 'framepack' ? 60 * 60 * 1000 : 30 * 60 * 1000;
  const { outputs } = await provider.waitFor(submitted.promptId, {
    intervalMs: 3000,
    timeoutMs,
    onProgress: ({ elapsedMs }) => jobs.update(jobId, { progress: Math.min(90, 20 + Math.round(elapsedMs / 3000)), message: `${label} 生成中…` }),
  });
  const video = outputs.find((item) => item.isVideo) || outputs.find((item) => /\.(mp4|webm|gif)$/i.test(item.filename || '')) || outputs[0];
  if (!video?.filename) throw jobError('ComfyUI 没有返回视频');
  const bytes = await provider.download(video);
  await mkdir(ASSETS_DIR, { recursive: true, mode: 0o700 });
  const ext = (video.filename.match(/\.[A-Za-z0-9]+$/)?.[0] || '.mp4').toLowerCase();
  const filename = `${jobId}${ext}`;
  await writeFile(join(ASSETS_DIR, filename), bytes);
  jobs.update(jobId, {
    status: 'success', progress: 100, message: '完成',
    result: {
      url: `/api/generation/assets/${filename}`, filename, type: 'video',
      provider: 'comfyui', promptId: submitted.promptId, sourceName: video.filename,
    },
  });
}

async function ensureDreaminaProject(config, provider) {
  if (config.dreamina.projectId) return config.dreamina.projectId;
  const name = '造梦工坊 · 画布生成';
  let existing = null;
  try {
    const canvases = await provider.listCanvases();
    existing = canvases.find((item) => item.name === name) || null;
  } catch { /* 列表失败时继续尝试创建 */ }
  const projectId = existing?.projectId || (await provider.createCanvas(name)).projectId;
  await saveConfig({ dreamina: { projectId } });
  return projectId;
}

function pruneQuotes(maxAgeMs = 9 * 60 * 1000) {
  const now = Date.now();
  for (const [id, quote] of pendingQuotes) {
    if (now - quote.createdAt > maxAgeMs) pendingQuotes.delete(id);
  }
}

async function runDreaminaImageJob(jobId, pending, creditCeiling) {
  const config = await loadConfig();
  const provider = createDreaminaCliProvider({ command: config.dreamina.command, profile: config.dreamina.profile || undefined });
  const ceiling = Math.max(Number(creditCeiling) || 0, pending.credits);
  jobs.update(jobId, { status: 'running', progress: 15, message: '积分确认…' });
  const confirmation = await provider.confirmNode({ projectId: pending.projectId, nodeId: pending.nodeId, creditCeiling: ceiling });
  jobs.update(jobId, { progress: 30, message: '提交即梦生成…', meta: { projectId: pending.projectId, nodeId: pending.nodeId } });
  const submitId = randomUUID();
  await provider.runNodeWithToken({ projectId: pending.projectId, nodeId: pending.nodeId, submitId, creditToken: confirmation.token });
  jobs.update(jobId, { progress: 45, message: '生成中…', meta: { submitId } });
  await provider.waitOperation({ submitId, projectId: pending.projectId, timeoutMs: 10 * 60 * 1000, intervalMs: 5000 });
  jobs.update(jobId, { progress: 85, message: '下载结果…' });
  const nodes = await provider.show({ projectId: pending.projectId, nodeIds: [pending.nodeId] });
  const node = nodes[0]?.node;
  const resource = (node?.resources || []).find((item) => item.type === 'image' && item.status === 'success') || (node?.resources || [])[0];
  if (!resource?.resourceId) throw jobError('即梦没有返回图片资源');
  await mkdir(ASSETS_DIR, { recursive: true, mode: 0o700 });
  const filename = `${jobId}.png`;
  await provider.downloadResource({ projectId: pending.projectId, resourceId: resource.resourceId, output: join(ASSETS_DIR, filename) });
  jobs.update(jobId, {
    status: 'success', progress: 100, message: '完成',
    result: {
      url: `/api/generation/assets/${filename}`,
      filename, type: 'image', provider: 'dreamina-cli',
      resourceId: resource.resourceId,
      credits: resource.creditsAmount ?? pending.credits,
      model: pending.model,
    },
  });
}

async function runDreaminaVideoJob(jobId, pending, creditCeiling) {
  const config = await loadConfig();
  const provider = createDreaminaCliProvider({ command: config.dreamina.command, profile: config.dreamina.profile || undefined });
  const ceiling = Math.max(Number(creditCeiling) || 0, pending.credits);
  jobs.update(jobId, { status: 'running', progress: 15, message: '积分确认…' });
  const confirmation = await provider.confirmNode({ projectId: pending.projectId, nodeId: pending.nodeId, creditCeiling: ceiling });
  jobs.update(jobId, { progress: 30, message: '提交即梦生成…', meta: { projectId: pending.projectId, nodeId: pending.nodeId } });
  const submitId = randomUUID();
  await provider.runNodeWithToken({ projectId: pending.projectId, nodeId: pending.nodeId, submitId, creditToken: confirmation.token });
  jobs.update(jobId, { progress: 45, message: '生成中…', meta: { submitId } });
  await provider.waitOperation({ submitId, projectId: pending.projectId, timeoutMs: 10 * 60 * 1000, intervalMs: 5000 });
  jobs.update(jobId, { progress: 85, message: '下载结果…' });
  const nodes = await provider.show({ projectId: pending.projectId, nodeIds: [pending.nodeId] });
  const node = nodes[0]?.node;
  const resource = (node?.resources || []).find((item) => item.type === 'video' && item.status === 'success') || (node?.resources || [])[0];
  if (!resource?.resourceId) throw jobError('即梦没有返回视频资源');
  await mkdir(ASSETS_DIR, { recursive: true, mode: 0o700 });
  const filename = `${jobId}.mp4`;
  await provider.downloadResource({ projectId: pending.projectId, resourceId: resource.resourceId, output: join(ASSETS_DIR, filename) });
  jobs.update(jobId, {
    status: 'success', progress: 100, message: '完成',
    result: {
      url: `/api/generation/assets/${filename}`,
      filename, type: 'video', provider: 'dreamina-cli',
      resourceId: resource.resourceId,
      credits: resource.creditsAmount ?? pending.credits,
      durationSeconds: pending.duration,
      model: pending.model,
    },
  });
}

const translationCache = new Map();

function hasCJK(text) {
  return /[\u3400-\u9fff]/.test(String(text || ''));
}

async function getDeepSeekSettings(config) {
  const baseUrl = String(config.deepseek?.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
  const model = config.deepseek?.model || 'deepseek-chat';
  const configured = String(config.deepseek?.apiKey || '').trim();
  if (configured) return { key: configured, baseUrl, model };
  try {
    const fileKey = (await readFile(join(homedir(), '.zaomeng', 'deepseek.key'), 'utf8')).trim();
    if (fileKey) return { key: fileKey, baseUrl, model };
  } catch { /* ignore */ }
  // 复用应用「设置 → 文字模型」里已配置的 DeepSeek Key（同一 data 目录）。
  try {
    const textModel = JSON.parse(await readFile(join(DATA_DIR, 'text-model.json'), 'utf8'));
    if (textModel?.key) {
      return {
        key: String(textModel.key).trim(),
        baseUrl: String(textModel.base || baseUrl).replace(/\/$/, ''),
        model: String(textModel.model || model),
      };
    }
  } catch { /* ignore */ }
  return { key: '', baseUrl, model };
}

async function translateTextToEnglish(text, config) {
  return callDeepSeek([
    { role: 'system', content: 'Translate the user text into concise, natural English for an AI image/video model. Preserve all subjects, counts, colors, materials, lighting, camera and style details. Output only the English prompt, no quotes, no explanations.' },
    { role: 'user', content: text },
  ], config, { maxTokens: 900, temperature: 0.2 });
}

async function callDeepSeek(messages, config, { maxTokens = 800, temperature = 0.4 } = {}) {
  const { key, baseUrl, model } = await getDeepSeekSettings(config);
  if (!key) throw new Error('未配置 DeepSeek API Key（可在应用文字模型或画布设置里配置）');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`DeepSeek ${response.status}: ${detail.slice(0, 160)}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('DeepSeek 没有返回内容');
  return text;
}

async function translatePromptToEnglish(prompt, config) {
  if (!hasCJK(prompt)) return null;
  if (translationCache.has(prompt)) return translationCache.get(prompt);
  const { key, baseUrl, model } = await getDeepSeekSettings(config);
  if (!key) return null;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: 'system', content: 'You translate Chinese image/video prompts into concise, vivid English for a text-to-image model. Preserve every subject, count, color, material, lighting, camera and style detail. Output only the English prompt, no quotes, no explanations.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`DeepSeek ${response.status}: ${detail.slice(0, 160)}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('DeepSeek 没有返回翻译');
  if (translationCache.size > 200) translationCache.clear();
  translationCache.set(prompt, text);
  return text;
}

async function runQwen21Job(jobId, input, config) {
  const workflowName = String(input.workflow || 'qwen21-t2i').trim();
  const mode = workflowName.replace(/^qwen21-/, '');
  const mappingFile = JSON.parse(await readFile(join(WORKFLOW_DIR, 'qwen21.mapping.json'), 'utf8'));
  const spec = mappingFile.mapping?.[mode];
  if (!spec?.file) throw jobError(`Qwen Image 2.1 缺少 ${mode} 映射`);
  const template = JSON.parse(await readFile(join(WORKFLOW_DIR, spec.file), 'utf8'));
  const provider = createComfyUIProvider({ baseUrl: derive045Base(config), timeoutMs: config.comfyui.timeoutMs || 30000 });
  const values = {
    prompt: String(input.prompt || '').trim(),
    seed: Number.isFinite(Number(input.seed)) ? Number(input.seed) : Math.floor(Math.random() * 1e9),
    megapixels: Number(input.megapixels) > 0 ? Number(input.megapixels) : 1,
    aspect: mode === 't2i' ? '1:1 (Square)' : '1:1 (Square)',
    outputPrefix: 'qwen21/Qwen21_ultimate',
  };
  if (mode !== 'rmbg' && !values.prompt) throw jobError('生成提示词不能为空');
  const uploaded = [];
  const uploadSpecs = spec.uploads || [];
  for (let i = 0; i < uploadSpecs.length; i += 1) {
    const item = uploadSpecs[i];
    if (!item.from) continue;
    if (!input.imageUrl) throw jobError('Qwen 图片编辑需要一张参考图');
    jobs.update(jobId, { status: 'running', progress: Math.min(10, 3 + i), message: '上传参考图…' });
    const name = await uploadComfyInput(provider, input.imageUrl, `${item.from}.png`, jobId, item.from);
    uploaded.push({ nodeId: item.nodeId, input: item.input, value: name });
  }
  const { workflow } = applyInputMapping(template, [...(spec.params || []), ...uploaded], values);
  jobs.update(jobId, { status: 'running', progress: 12, message: '提交到 ComfyUI 0.45（Qwen 2.1）…' });
  const submitted = await provider.submit(workflow);
  jobs.update(jobId, { progress: 20, message: `Qwen 2.1 ${mode} 生成中…`, meta: { promptId: submitted.promptId } });
  const { outputs } = await provider.waitFor(submitted.promptId, {
    intervalMs: 1500,
    timeoutMs: 15 * 60 * 1000,
    onProgress: ({ elapsedMs }) => jobs.update(jobId, { progress: Math.min(90, 20 + Math.round(elapsedMs / 1000)), message: `Qwen 2.1 ${mode} 生成中…` }),
  });
  const image = outputs.find((item) => !item.isVideo) || outputs[0];
  if (!image?.filename) throw jobError('ComfyUI 没有返回图片');
  const bytes = await provider.download(image);
  await mkdir(ASSETS_DIR, { recursive: true, mode: 0o700 });
  const filename = `${jobId}.png`;
  await writeFile(join(ASSETS_DIR, filename), bytes);
  jobs.update(jobId, {
    status: 'success', progress: 100, message: '完成',
    result: { url: `/api/generation/assets/${filename}`, filename, type: 'image', provider: 'comfyui', promptId: submitted.promptId, sourceName: image.filename, model: `qwen21-${mode}`, alpha: true },
  });
}

async function runComfyImageJob(jobId, input) {
  const config = await loadConfig();
  if (String(input.workflow || '').startsWith('qwen21-')) return runQwen21Job(jobId, input, config);
  const provider = createComfyUIProvider({
    baseUrl: config.comfyui.baseUrl,
    timeoutMs: config.comfyui.timeoutMs || 30000,
  });
  const hasImage = Boolean(input.imageUrl);
  const refMode = String(input.refMode || '').trim();
  const useControlNet = hasImage && ['depth', 'canny', 'openpose'].includes(refMode);
  const useIPAdapter = hasImage && refMode === 'ipadapter';
  const requested = String(input.workflow || '').trim();
  const workflowName = useControlNet
    ? (refMode === 'canny' ? (config.comfyui.controlnetCannyWorkflow || 'controlnet-canny')
      : refMode === 'openpose' ? (config.comfyui.controlnetOpenposeWorkflow || 'controlnet-openpose')
      : (config.comfyui.controlnetDepthWorkflow || 'controlnet-depth'))
    : useIPAdapter
      ? (config.comfyui.ipadapterWorkflow || 'ipadapter-sdxl')
      : hasImage ? (config.comfyui.i2iWorkflow || 'sdxl-i2i') : (requested || config.comfyui.workflow || 'sdxl-t2i');
  const template = JSON.parse(await readFile(join(WORKFLOW_DIR, `${workflowName}.json`), 'utf8'));
  let prompt = String(input.prompt || '').trim();
  if (!prompt) throw jobError('生成提示词不能为空');
  let translation = null;
  try {
    const translated = await translatePromptToEnglish(prompt, config);
    if (translated) {
      translation = { original: prompt, translated };
      prompt = translated;
      jobs.update(jobId, { status: 'running', progress: 3, message: '已自动翻译为英文…', meta: { translation } });
    }
  } catch (error) {
    jobs.update(jobId, { message: `中文翻译失败，使用原文：${error.message}`, meta: { translationError: error.message } });
  }
  const values = {
    prompt,
    negativePrompt: input.negativePrompt || 'blurry, low quality, text, watermark',
    width: clampInt(input.width, 256, 1536, 768),
    height: clampInt(input.height, 256, 1536, 512),
    seed: Number.isFinite(Number(input.seed)) ? Number(input.seed) : Math.floor(Math.random() * 1e9),
    denoise: Number.isFinite(Number(input.denoise)) ? Number(input.denoise) : 0.65,
    strength: Number.isFinite(Number(input.strength)) ? Number(input.strength) : (refMode === 'openpose' ? 0.8 : 0.75),
    weight: Number.isFinite(Number(input.weight)) ? Number(input.weight) : 0.85,
  };
  const mapping = useControlNet ? CONTROLNET_MAPPING
    : useIPAdapter ? IPADAPTER_MAPPING
    : hasImage ? SDXL_I2I_MAPPING
    : workflowName.includes('flux') ? FLUX_T2I_MAPPING : workflowName.includes('zimage') ? ZIMAGE_T2I_MAPPING : SDXL_T2I_MAPPING;
  let workflow;
  if (hasImage) {
    const assetName = basename(String(input.imageUrl).split('?')[0]);
    let bytes;
    try { bytes = await readFile(join(ASSETS_DIR, assetName)); } catch { throw jobError(`参考图资产不存在：${assetName}`); }
    jobs.update(jobId, { status: 'running', progress: 3, message: '上传参考图…' });
    const uploaded = await provider.uploadImage(bytes, assetName, { type: 'input', overwrite: true });
    values.image = uploaded.subfolder ? `${uploaded.subfolder}/${uploaded.name}` : uploaded.name;
    ({ workflow } = applyInputMapping(template, mapping, values));
  } else {
    ({ workflow } = applyInputMapping(template, mapping, values));
  }

  jobs.update(jobId, { status: 'running', progress: 5, message: '提交到 ComfyUI…' });
  const submitted = await provider.submit(workflow);
  jobs.update(jobId, { progress: 10, message: '已排队', meta: { promptId: submitted.promptId } });

  const { outputs } = await provider.waitFor(submitted.promptId, {
    intervalMs: 1200,
    timeoutMs: 10 * 60 * 1000,
    onProgress: ({ elapsedMs }) => {
      jobs.update(jobId, { progress: Math.min(90, 10 + Math.round(elapsedMs / 1000)), message: '生成中…' });
    },
  });
  const image = outputs.find((item) => item.filename && !item.isVideo) || outputs[0];
  if (!image?.filename) throw jobError('ComfyUI 没有返回图片');
  const bytes = await provider.download(image);
  await mkdir(ASSETS_DIR, { recursive: true, mode: 0o700 });
  const filename = `${jobId}.png`;
  await writeFile(join(ASSETS_DIR, filename), bytes);
  jobs.update(jobId, {
    status: 'success', progress: 100, message: '完成',
    result: {
      url: `/api/generation/assets/${filename}`,
      filename,
      bytes: bytes.length,
      type: 'image',
      provider: 'comfyui',
      promptId: submitted.promptId,
      sourceName: image.filename,
      translation,
    },
  });
}

function jobError(message) {
  const error = new Error(message);
  error.code = 'JOB_FAILED';
  return error;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function mimeOf(name) {
  const ext = extname(name).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.wav') return 'audio/wav';
  return 'image/png';
}

function sendJson(res, status, data) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readJson(req, limit = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw jobError('请求体过大');
    chunks.push(chunk);
  }
  if (!size) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.GENERATION_PORT || 5198);
  createGenerationServer().listen(port, '127.0.0.1', () => {
    console.log(`generation server: http://127.0.0.1:${port}`);
  });
}
