// 生成服务配置：本机文件（不写工程、不进 git）。
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = dirname(fileURLToPath(import.meta.url));
// 桌面安装包运行时把数据放在 JINGCHANG_DATA_DIR（userData/generated），不要写进 .app。
const DATA_ROOT = process.env.JINGCHANG_DATA_DIR ? resolve(process.env.JINGCHANG_DATA_DIR) : join(ROOT, '..', '.local');
export const DATA_DIR = DATA_ROOT;
export const ASSETS_DIR = join(DATA_ROOT, 'canvas-assets');
const CONFIG_PATH = join(DATA_ROOT, 'generation-config.json');

function defaultDreaminaCommand() {
  const candidates = [process.env.DREAMINA_CANVAS_CLI, join(homedir(), '.local', 'bin', 'dreamina-canvas'), '/opt/homebrew/bin/dreamina-canvas', '/usr/local/bin/dreamina-canvas'];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return 'dreamina-canvas';
}

export const DEFAULT_CONFIG = {
  comfyui: { baseUrl: process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188', baseUrl045: '', workflow: 'sdxl-t2i', i2iWorkflow: 'sdxl-i2i', videoWorkflow: 'h3-t2v', videoWorkflowI2v: 'h3-i2v', photoWorkflow: 'photoreal-juggernaut', upscaleWorkflow: 'upscale-usdu', detailWorkflow: 'detail-face', controlnetDepthWorkflow: 'controlnet-depth', controlnetCannyWorkflow: 'controlnet-canny', controlnetOpenposeWorkflow: 'controlnet-openpose', ipadapterWorkflow: 'ipadapter-sdxl', inpaintWorkflow: 'inpaint-sdxl', outpaintWorkflow: 'outpaint-sdxl', matteWorkflow: 'matte-birefnet', relightFgWorkflow: 'iclight-relight-fg', relightLightWorkflow: 'iclight-relight', timeoutMs: 30000 },
  dreamina: { command: defaultDreaminaCommand(), profile: '', projectId: '', videoModel: 'seedance_2.5_draft' },
  defaults: { image: 'comfyui', video: 'dreamina', audio: 'dreamina' },
  // 中文提示词自动翻译（可选）：key 也可以放在 ~/.zaomeng/deepseek.key（600 权限）。
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: '' },
};

export async function loadConfig() {
  try {
    const saved = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
    return mergeConfig(DEFAULT_CONFIG, saved);
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export async function saveConfig(patch) {
  const current = await loadConfig();
  const next = mergeConfig(current, patch || {});
  await mkdir(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), { mode: 0o600 });
  await chmod(CONFIG_PATH, 0o600).catch(() => {});
  return next;
}

export function configPath() {
  return CONFIG_PATH;
}

function mergeConfig(base, patch) {
  const next = structuredClone(base);
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      next[key] = { ...(next[key] || {}), ...value };
    } else if (value !== undefined) {
      next[key] = value;
    }
  }
  return next;
}
