import {spawn} from 'node:child_process';
import {access, open, mkdir} from 'node:fs/promises';
import {constants as fsConstants} from 'node:fs';
import {dirname,join} from 'node:path';
import {homedir} from 'node:os';

const DEFAULT_DIR = () => process.env.COMFYUI_DIR || join(homedir(), 'ComfyUI');
const exists = async path => {
  try { await access(path, fsConstants.X_OK); return true; } catch { return false; }
};

/** Resolve a local ComfyUI launch command without accepting arbitrary user commands. */
export async function resolveComfyLaunch({comfyDir = DEFAULT_DIR(), platform = process.platform, port = Number(process.env.COMFYUI_PORT) || 8188} = {}) {
  const main = join(comfyDir, 'main.py');
  const candidates = platform === 'win32'
    ? [join(comfyDir, '.venv', 'Scripts', 'python.exe'), join(comfyDir, 'venv', 'Scripts', 'python.exe'), 'python']
    : [join(comfyDir, '.venv', 'bin', 'python'), join(comfyDir, 'venv', 'bin', 'python'), 'python3', 'python'];
  let python = null;
  for (const candidate of candidates) {
    if (candidate.includes('/') || candidate.includes('\\')) {
      if (await exists(candidate)) { python = candidate; break; }
    } else {
      python = candidate; break;
    }
  }
  try { await access(main, fsConstants.R_OK); } catch { throw Error(`未找到 ComfyUI：${comfyDir}/main.py`); }
  if (!python) throw Error('未找到 ComfyUI 的 Python 环境（.venv）');
  return {command: python, args: ['main.py', '--listen', '127.0.0.1', '--port', String(port)], cwd: comfyDir, port};
}

/** Start ComfyUI detached and return the child process. */
export async function spawnComfy(launch, {logFile} = {}) {
  const handle = logFile ? await open(logFile, 'a', 0o600) : null;
  if (logFile) await mkdir(dirname(logFile), {recursive: true}).catch(() => {});
  const child = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    detached: true,
    stdio: handle ? ['ignore', handle.fd, handle.fd] : 'ignore',
    env: {...process.env, PYTHONUNBUFFERED: '1'},
  });
  child.unref();
  await handle?.close().catch(() => {});
  return child;
}
