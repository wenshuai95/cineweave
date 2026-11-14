// 造梦工坊 · 本机 Blender 渲染桥接（v1.22.0）
// 把工程交给本机 Blender 后台渲染，产出逐镜 mp4 与全片，再回填画布。
// 安全边界：仅 localhost 同源；不接受客户端任意路径；spawn 一律数组参数、shell:false；
// 工程体积、时长、分辨率、采样数全部显式上限；渲染队列串行，避免本机 GPU 过载。
import {spawn, spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {accessSync} from 'node:fs';
import {readFile, writeFile, mkdir, rm, stat, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';
import {FFMPEG} from './workstation-server.mjs';
import {MODEL_ASSET_DIR} from './asset-store.mjs';

const VERSION = '1.46.0';
const TOOLS = fileURLToPath(new URL('./tools/bridge/', import.meta.url));
const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const root = process.env.JINGCHANG_DATA_DIR
  ? resolve(process.env.JINGCHANG_DATA_DIR, 'bridge')
  : fileURLToPath(new URL('./.local/bridge/', import.meta.url));

const PROJECT_MAX_BYTES = 150 * 1024 * 1024;
const OBJECTS_MAX = 300;
const SHOTS_MAX = 300;
const JOB_MAX = 6;
const DURATION_MAX = 3600;
const FPS_ALLOWED = new Set([24, 25, 30]);
const SAMPLES_MIN = 8, SAMPLES_MAX = 64;
const SCALE_MIN = 0.25, SCALE_MAX = 1;

const resolveTool = (env, candidates) => {
  const custom = (env || '').trim();
  if (custom) return custom;
  for (const c of candidates) {
    try { accessSync(c); return c; } catch {}
  }
  return candidates.at(-1);
};

export const BLENDER = resolveTool(process.env.BLENDER_PATH, [
  '/Applications/Blender.app/Contents/MacOS/Blender',
  '/usr/local/bin/blender',
  '/opt/homebrew/bin/blender',
  'blender',
]);
const PYTHON = (process.env.BRIDGE_PYTHON || 'python3').trim();
export const BRIDGE_FFMPEG = (process.env.BRIDGE_FFMPEG || FFMPEG || 'ffmpeg').trim();

const jobs = new Map();
const queue = [];
let running = null;
let blenderCheck = null;

const json = (res, data, status = 200) => {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(data));
};
const idOk = v => typeof v === 'string' && /^[\w-]{1,100}$/.test(v);

function blenderInfo() {
  if (blenderCheck) return blenderCheck;
  blenderCheck = (() => {
    try {
      const r = spawnSync(BLENDER, ['--version'], {timeout: 15000, shell: false, windowsHide: true, encoding: 'utf8'});
      const line = String(r.stdout || '').split('\n')[0].trim();
      return {available: r.status === 0, version: line || null, path: BLENDER};
    } catch {
      return {available: false, version: null, path: BLENDER};
    }
  })();
  return blenderCheck;
}

export function validateBridgeProject(project) {
  if (!project || typeof project !== 'object') return '工程数据缺失';
  if (project.schema !== 'jingchang/1') return '不支持的工程版本';
  if (!Array.isArray(project.objects) || project.objects.length > OBJECTS_MAX) return '场景对象数量超出上限';
  if (!Array.isArray(project.shots) || !project.shots.length) return '工程没有镜头安排（先在镜头编排里添加镜头）';
  if (project.shots.length > SHOTS_MAX) return '镜头数量超出上限';
  if (!Number.isFinite(project.duration) || project.duration < 1 || project.duration > DURATION_MAX) return '时长必须在 1–3600 秒';
  if (!FPS_ALLOWED.has(project.fps)) return '仅支持 24 / 25 / 30 fps';
  return null;
}

function readBody(req, limit) {
  return new Promise((resolvePromise, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(Error('工程体积超出上限'), {status: 413}));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolvePromise(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const jobDir = id => join(root, id);
const publicJob = job => ({
  id: job.id,
  status: job.status,
  phase: job.phase,
  message: job.message,
  progress: job.progress,
  shots: job.shots,
  totalShots: job.totalShots,
  doneShots: job.doneShots,
  reelUrl: job.status === 'done' ? `/api/bridge/jobs/${job.id}/reel` : null,
  clips: job.status === 'done'
    ? job.shots.map(s => ({id: s.id, url: `/api/bridge/jobs/${job.id}/clip/${s.id}`}))
    : [],
  version: VERSION,
});

function finish(job, status, message) {
  job.status = status;
  job.message = message;
  job.finishedAt = Date.now();
  running = null;
  pump();
}

function runCommand(job, command, args, {onLine} = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    job.child = child;
    let buffer = '';
    let stderr = '';
    const handle = data => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) onLine?.(line.trim(), child);
    };
    child.stdout.on('data', handle);
    child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-1500); handle(data); });
    child.once('error', reject);
    child.once('close', code => {
      job.child = null;
      if (job.status === 'cancelled') return reject(Object.assign(Error('cancelled'), {cancelled: true}));
      if (code !== 0) return reject(Error(`${command.split('/').pop()} 退出码 ${code}：${stderr.trim().slice(0, 400) || '无输出'}`));
      resolvePromise();
    });
  });
}

async function pipeline(job, project, options) {
  const dir = job.dir;
  const sceneJson = join(dir, 'scene.json');
  const blend = join(dir, 'scene.blend');
  const frames = join(dir, 'frames');
  const clips = join(dir, 'clips');
  const reel = join(dir, 'reel.mp4');
  const projectFile = join(dir, 'project.json');
  await mkdir(dir, {recursive: true});
  await writeFile(projectFile, JSON.stringify({schema: 'jingchang/1', app: 'ai-video-workstation', version: VERSION, project, media: []}));

  job.phase = 'export';
  job.message = '正在导出场景与资产…';
  await runCommand(job, PYTHON, [
    join(TOOLS, 'export_workstation.py'), projectFile, dir, '--asset-root', PUBLIC, '--flat',
    '--asset-store', MODEL_ASSET_DIR,
  ]);

  job.phase = 'build';
  job.message = '正在搭建 Blender 场景…';
  await runCommand(job, BLENDER, [
    '-b', '--factory-startup', '--python', join(TOOLS, 'bw_build.py'),
    '--', sceneJson, '--out', blend,
  ]);

  job.phase = 'render';
  job.message = '正在渲染…';
  const renderArgs = [
    '-b', blend, '--python', join(TOOLS, 'bw_render.py'),
    '--', sceneJson, '--out', frames,
    '--samples', String(options.samples), '--scale', String(options.scale),
  ];
  if (options.shots?.length) renderArgs.push('--shots', options.shots.join(','));
  await runCommand(job, BLENDER, renderArgs, {
    onLine: (line, child) => {
      job.log = (job.log || []).concat(line).slice(-200);
      const m = /^RENDERED\s+(\S+)\s+frames=(\d+)/.exec(line);
      if (!m) return;
      const shot = job.shots.find(s => s.id === m[1]);
      if (shot) {
        shot.done = true;
        shot.frames = Number(m[2]);
        job.doneShots = job.shots.filter(s => s.done).length;
        job.progress = job.doneShots / job.totalShots;
        job.message = `正在渲染 ${job.doneShots}/${job.totalShots} 镜…`;
      }
    },
  });

  job.phase = 'package';
  job.message = '正在编码 mp4…';
  await runCommand(job, PYTHON, [
    join(TOOLS, 'bw_package.py'), sceneJson,
    '--frames', frames, '--clips', clips, '--ffmpeg', BRIDGE_FFMPEG, '--reel', reel,
  ]);

  const info = await stat(reel).catch(() => null);
  if (!info?.isFile()) throw Error('渲染完成但未生成成片，请检查 Blender 日志');
  job.reelPath = reel;
  job.reelBytes = info.size;
  job.progress = 1;
  finish(job, 'done', `完成：${job.totalShots} 镜，${(info.size / 1e6).toFixed(1)} MB`);
}

async function pump() {
  if (running || !queue.length) return;
  const job = queue.shift();
  if (job.status === 'cancelled') return pump();
  running = job;
  job.status = 'running';
  try {
    await pipeline(job, job.project, job.options);
  } catch (error) {
    if (job.status === 'cancelled' || error.cancelled) {
      finish(job, 'cancelled', '已取消渲染');
    } else {
      finish(job, 'error', `渲染失败：${error.message}`);
    }
  } finally {
    delete job.project;
  }
}

export function startBridgeJob(project, options = {}) {
  const samples = Math.min(SAMPLES_MAX, Math.max(SAMPLES_MIN, Number(options.samples) || 32));
  const scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Number(options.scale) || 1));
  const shots = Array.isArray(options.shots) ? options.shots.filter(idOk).slice(0, SHOTS_MAX) : undefined;
  // 只保留即将渲染的镜头，Blender 侧据此逐镜渲染
  const scenes = shots?.length ? {...project, shots: project.shots.filter(s => shots.includes(s.id))} : project;
  if (!scenes.shots.length) return {error: '所选镜头不在工程里'};
  const id = randomUUID();
  const totalShots = scenes.shots.length;
  const job = {
    id,
    dir: jobDir(id),
    status: 'queued',
    phase: 'queued',
    message: '排队中…',
    progress: 0,
    totalShots,
    doneShots: 0,
    shots: scenes.shots.map(s => ({id: s.id, done: false, frames: 0})),
    createdAt: Date.now(),
    project: scenes,
    options: {samples, scale, shots},
  };
  jobs.set(id, job);
  if (jobs.size > JOB_MAX) {
    const finished = [...jobs.values()].filter(j => ['done', 'error', 'cancelled'].includes(j.status))
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const old of finished.slice(0, jobs.size - JOB_MAX)) {
      jobs.delete(old.id);
      rm(jobDir(old.id), {recursive: true, force: true}).catch(() => {});
    }
  }
  queue.push(job);
  pump();
  return {job: publicJob(job)};
}

export function getBridgeJob(id) {
  return jobs.get(id) || null;
}

export function cancelBridgeJob(id) {
  const job = jobs.get(id);
  if (!job) return null;
  if (['queued', 'running'].includes(job.status)) {
    job.status = 'cancelled';
    if (job.child) {
      try { job.child.kill('SIGTERM'); } catch {}
      setTimeout(() => { try { job.child?.kill('SIGKILL'); } catch {} }, 3000);
    }
    if (job === running && !job.child) finish(job, 'cancelled', '已取消渲染');
  }
  return publicJob(job);
}

function streamFile(res, path, type) {
  return stat(path).then(info => {
    if (!info.isFile()) throw Error('not file');
    res.writeHead(200, {'Content-Type': type, 'Content-Length': info.size, 'Cache-Control': 'no-store'});
    createReadStream(path).pipe(res);
    return true;
  }).catch(() => {
    json(res, {error: '文件不存在或已清理'}, 404);
    return true;
  });
}

export async function handleBridge(req, res, url) {
  if (!url.pathname.startsWith('/api/bridge/')) return false;
  try {
    const expected = 'http://' + req.headers.host;
    const sameOrigin = !req.headers.origin || req.headers.origin === expected;
    if (!sameOrigin) { json(res, {error: '仅允许本机软件同源访问'}, 403); return true; }
    const parts = url.pathname.split('/').filter(Boolean); // api bridge ...
    const tail = parts.slice(2);

    if (req.method === 'GET' && tail[0] === 'status') {
      const info = blenderInfo();
      json(res, {
        version: VERSION,
        blender: info,
        python: PYTHON,
        ffmpeg: BRIDGE_FFMPEG,
        limits: {objectsMax: OBJECTS_MAX, shotsMax: SHOTS_MAX, projectMaxBytes: PROJECT_MAX_BYTES,
          samples: [SAMPLES_MIN, SAMPLES_MAX], scale: [SCALE_MIN, SCALE_MAX], jobMax: JOB_MAX},
      });
      return true;
    }

    if (req.method === 'POST' && tail[0] === 'jobs' && tail.length === 1) {
      if (req.headers.origin && req.headers.origin !== expected) { json(res, {error: '仅允许本机软件同源访问'}, 403); return true; }
      const info = blenderInfo();
      if (!info.available) { json(res, {error: '本机未检测到 Blender，请安装 Blender 4.x/5.x 或设置 BLENDER_PATH'}, 503); return true; }
      let body;
      try {
        const raw = await readBody(req, PROJECT_MAX_BYTES);
        body = JSON.parse(raw.toString('utf8'));
      } catch (error) {
        json(res, {error: error.status === 413 ? '工程体积超出上限' : '请求内容不是有效 JSON'}, error.status || 400);
        return true;
      }
      const invalid = validateBridgeProject(body.project);
      if (invalid) { json(res, {error: invalid}, 400); return true; }
      const result = startBridgeJob(body.project, body.options || {});
      if (result.error) { json(res, {error: result.error}, 400); return true; }
      json(res, result.job, 202);
      return true;
    }

    if (req.method === 'GET' && tail[0] === 'jobs' && tail.length === 2 && idOk(tail[1])) {
      const job = getBridgeJob(tail[1]);
      if (!job) { json(res, {error: '任务不存在'}, 404); return true; }
      json(res, publicJob(job));
      return true;
    }

    if (req.method === 'POST' && tail[0] === 'jobs' && tail.length === 3 && tail[2] === 'cancel' && idOk(tail[1])) {
      if (req.headers.origin && req.headers.origin !== expected) { json(res, {error: '仅允许本机软件同源访问'}, 403); return true; }
      const job = cancelBridgeJob(tail[1]);
      if (!job) { json(res, {error: '任务不存在'}, 404); return true; }
      json(res, job);
      return true;
    }

    if (req.method === 'GET' && tail[0] === 'jobs' && tail.length === 3 && tail[2] === 'reel' && idOk(tail[1])) {
      const job = getBridgeJob(tail[1]);
      if (!job?.reelPath) { json(res, {error: '成片尚未生成'}, 404); return true; }
      return streamFile(res, job.reelPath, 'video/mp4');
    }

    if (req.method === 'GET' && tail[0] === 'jobs' && tail.length === 4 && tail[2] === 'clip' && idOk(tail[1]) && idOk(tail[3])) {
      const job = getBridgeJob(tail[1]);
      if (!job) { json(res, {error: '任务不存在'}, 404); return true; }
      return streamFile(res, join(job.dir, 'clips', tail[3] + '.mp4'), 'video/mp4');
    }

    json(res, {error: '未知的桥接接口'}, 404);
    return true;
  } catch (error) {
    json(res, {error: error.message || '桥接服务异常'}, 500);
    return true;
  }
}

// 供测试与运维使用
export const bridgeInternals = {jobs, queue, root, TOOLS};
