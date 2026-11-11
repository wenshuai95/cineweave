// 造梦工坊 · 动作库重定向服务（v1.23）
// 把内置动作库（不同骨架）的片段烘焙到当前角色骨架上，产出新的 GLB。
// 安全边界：仅本机同源；目标/来源只允许内置资产路径或本机资产库 URL，不接受任意路径；
// spawn 一律数组参数、shell:false；任务串行，最多保留 6 条。
import {spawn, spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {accessSync} from 'node:fs';
import {mkdir, writeFile, readFile, rm, stat, copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join, resolve, basename} from 'node:path';
import {MODEL_ASSET_DIR} from './asset-store.mjs';

const VERSION = '1.46.0';
const TOOLS = fileURLToPath(new URL('./tools/retarget/', import.meta.url));
const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const root = process.env.JINGCHANG_DATA_DIR
  ? resolve(process.env.JINGCHANG_DATA_DIR, 'retarget')
  : fileURLToPath(new URL('./.local/retarget/', import.meta.url));

const JOB_MAX = 6;
const CLIPS_MAX = 400;
const BUILTIN = /^\/assets\/models\/[a-zA-Z0-9_-]+\.glb$/;
const STORED = /^\/api\/(?:model-)?assets\/([0-9a-f]{64})\.glb$/;
const PREFIX = /^[A-Za-z0-9_-]{0,12}$/;

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
      return {available: r.status === 0, version: String(r.stdout || '').split('\n')[0].trim() || null, path: BLENDER};
    } catch {
      return {available: false, version: null, path: BLENDER};
    }
  })();
  return blenderCheck;
}

/** 只允许内置资产路径或本机资产库 URL。返回服务器上的真实文件路径。 */
export function resolveModelSrc(src) {
  if (typeof src !== 'string') return null;
  if (BUILTIN.test(src)) {
    const path = join(PUBLIC, src.replace(/^\//, ''));
    try { accessSync(path); return path; } catch { return null; }
  }
  const stored = STORED.exec(src);
  if (stored) {
    const path = join(MODEL_ASSET_DIR, stored[1] + '.glb');
    try { accessSync(path); return path; } catch { return null; }
  }
  return null;
}

export function validateRetargetRequest(body) {
  if (!body || typeof body !== 'object') return '请求内容缺失';
  if (!resolveModelSrc(body.targetSrc)) return '目标模型无效（只支持内置资产或本机资产库）';
  if (!resolveModelSrc(body.sourceSrc)) return '动作库无效（只支持内置资产）';
  if (body.targetSrc === body.sourceSrc) return '目标模型和动作库不能是同一个模型';
  if (body.clips !== undefined) {
    if (!Array.isArray(body.clips) || body.clips.length > CLIPS_MAX) return '动作片段列表无效';
    if (body.clips.some(c => typeof c !== 'string' || !c || c.length > 200)) return '动作片段名称无效';
  }
  if (body.prefix !== undefined && (typeof body.prefix !== 'string' || !PREFIX.test(body.prefix))) return '片段前缀无效';
  return null;
}

const publicJob = job => ({
  id: job.id,
  status: job.status,
  message: job.message,
  baked: job.baked,
  targetName: job.targetName,
  sourceName: job.sourceName,
  fileUrl: job.status === 'done' ? `/api/retarget/jobs/${job.id}/file` : null,
  reportUrl: job.status === 'done' ? `/api/retarget/jobs/${job.id}/report` : null,
  version: VERSION,
});

function runBlender(job) {
  const args = [
    '-b', '--factory-startup', '--python', join(TOOLS, 'retarget_clips.py'), '--',
    '--target', job.targetPath,
    '--source', job.sourcePath,
    '--out', job.outputPath,
    '--report', job.reportPath,
    '--prefix', job.prefix,
  ];
  if (job.clips?.length) args.push('--clips', job.clips.join(','));
  return new Promise((resolvePromise, reject) => {
    const child = spawn(BLENDER, args, {shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    job.child = child;
    let stderr = '';
    const onLine = line => {
      const baked = /baked\s+(.+?)\s+->/.exec(line);
      if (baked) {
        job.baked++;
        job.message = `正在烘焙 ${job.baked} 段…`;
      }
    };
    let buffer = '';
    const handle = data => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) onLine(line.trim());
    };
    child.stdout.on('data', handle);
    child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-1200); handle(data); });
    child.once('error', reject);
    child.once('close', code => {
      job.child = null;
      if (job.status === 'cancelled') return reject(Object.assign(Error('cancelled'), {cancelled: true}));
      if (code !== 0) return reject(Error(`Blender 退出码 ${code}：${stderr.trim().slice(0, 300) || '无输出'}`));
      resolvePromise();
    });
  });
}

async function pipeline(job) {
  await mkdir(job.dir, {recursive: true});
  await copyFile(job.targetPath, join(job.dir, 'target.glb'));
  await copyFile(job.sourcePath, join(job.dir, 'source.glb'));
  job.targetPath = join(job.dir, 'target.glb');
  job.sourcePath = join(job.dir, 'source.glb');
  job.status = 'running';
  job.message = '正在重定向…';
  await runBlender(job);
  const info = await stat(job.outputPath).catch(() => null);
  if (!info?.isFile()) throw Error('重定向完成但没有产出 GLB');
  job.bytes = info.size;
  job.baked = job.baked || 0;
  job.status = 'done';
  job.message = `完成：烘焙 ${job.baked} 段动作，输出 ${(info.size / 1e6).toFixed(1)} MB`;
  running = null;
  pump();
}

async function pump() {
  if (running || !queue.length) return;
  const job = queue.shift();
  if (job.status === 'cancelled') return pump();
  running = job;
  try {
    await pipeline(job);
  } catch (error) {
    if (job.status === 'cancelled' || error.cancelled) {
      job.status = 'cancelled';
      job.message = '已取消重定向';
    } else {
      job.status = 'error';
      job.message = `重定向失败：${error.message}`;
    }
    running = null;
    pump();
  }
}

export function startRetargetJob(body) {
  const invalid = validateRetargetRequest(body);
  if (invalid) return {error: invalid};
  const id = randomUUID();
  const job = {
    id,
    dir: join(root, id),
    status: 'queued',
    message: '排队中…',
    baked: 0,
    targetPath: resolveModelSrc(body.targetSrc),
    sourcePath: resolveModelSrc(body.sourceSrc),
    targetName: basename(body.targetSrc),
    sourceName: basename(body.sourceSrc),
    outputPath: join(root, id, 'retargeted.glb'),
    reportPath: join(root, id, 'report.json'),
    clips: body.clips,
    prefix: body.prefix ?? 'RT_',
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  if (jobs.size > JOB_MAX) {
    const finished = [...jobs.values()].filter(j => ['done', 'error', 'cancelled'].includes(j.status))
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const old of finished.slice(0, jobs.size - JOB_MAX)) {
      jobs.delete(old.id);
      rm(old.dir, {recursive: true, force: true}).catch(() => {});
    }
  }
  queue.push(job);
  pump();
  return {job: publicJob(job)};
}

export function getRetargetJob(id) {
  return jobs.get(id) || null;
}

export function cancelRetargetJob(id) {
  const job = jobs.get(id);
  if (!job) return null;
  if (['queued', 'running'].includes(job.status)) {
    job.status = 'cancelled';
    job.message = '已取消重定向';
    if (job.child) {
      try { job.child.kill('SIGTERM'); } catch {}
      setTimeout(() => { try { job.child?.kill('SIGKILL'); } catch {} }, 3000);
    }
    if (job === running && !job.child) { running = null; pump(); }
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

export async function handleRetarget(req, res, url) {
  if (!url.pathname.startsWith('/api/retarget/')) return false;
  try {
    const expected = 'http://' + req.headers.host;
    if (req.headers.origin && req.headers.origin !== expected) {
      json(res, {error: '仅允许本机软件同源访问'}, 403);
      return true;
    }
    const parts = url.pathname.split('/').filter(Boolean);
    const tail = parts.slice(2);

    if (req.method === 'GET' && tail[0] === 'status') {
      json(res, {
        version: VERSION,
        blender: blenderInfo(),
        libraries: [
          {id: 'ual2', name: '通用动作库 · 85 段', src: '/assets/models/female-anatomy-mannequin.glb', clips: 85},
          {id: 'performer', name: '表演动作库 · 46 段', src: '/assets/models/quaternius-performer.glb', clips: 46},
        ],
      });
      return true;
    }

    if (req.method === 'POST' && tail[0] === 'jobs' && tail.length === 1) {
      if (req.headers.origin && req.headers.origin !== expected) {
        json(res, {error: '仅允许本机软件同源访问'}, 403);
        return true;
      }
      const info = blenderInfo();
      if (!info.available) { json(res, {error: '本机未检测到 Blender，请安装 Blender 4.x/5.x 或设置 BLENDER_PATH'}, 503); return true; }
      let body;
      try {
        body = JSON.parse(await readBody(req, 4 * 1024 * 1024).then(b => b.toString('utf8')));
      } catch (error) {
        json(res, {error: error.message === 'too large' ? '请求过大' : '请求内容不是有效 JSON'}, 400);
        return true;
      }
      const result = startRetargetJob(body);
      if (result.error) { json(res, {error: result.error}, 400); return true; }
      json(res, result.job, 202);
      return true;
    }

    if (req.method === 'GET' && tail[0] === 'jobs' && tail.length === 2 && idOk(tail[1])) {
      const job = getRetargetJob(tail[1]);
      if (!job) { json(res, {error: '任务不存在'}, 404); return true; }
      json(res, publicJob(job));
      return true;
    }

    if (req.method === 'POST' && tail[0] === 'jobs' && tail.length === 3 && tail[2] === 'cancel' && idOk(tail[1])) {
      const job = cancelRetargetJob(tail[1]);
      if (!job) { json(res, {error: '任务不存在'}, 404); return true; }
      json(res, job);
      return true;
    }

    if (req.method === 'GET' && tail[0] === 'jobs' && tail.length === 3 && tail[2] === 'file' && idOk(tail[1])) {
      const job = getRetargetJob(tail[1]);
      if (!job?.outputPath || job.status !== 'done') { json(res, {error: '结果尚未生成'}, 404); return true; }
      return streamFile(res, job.outputPath, 'model/gltf-binary');
    }

    if (req.method === 'GET' && tail[0] === 'jobs' && tail.length === 3 && tail[2] === 'report' && idOk(tail[1])) {
      const job = getRetargetJob(tail[1]);
      if (!job?.reportPath || job.status !== 'done') { json(res, {error: '报告尚未生成'}, 404); return true; }
      return streamFile(res, job.reportPath, 'application/json');
    }

    json(res, {error: '未知的重定向接口'}, 404);
    return true;
  } catch (error) {
    json(res, {error: error.message || '重定向服务异常'}, 500);
    return true;
  }
}

function readBody(req, limit) {
  return new Promise((resolvePromise, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { reject(Error('too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolvePromise(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export const retargetInternals = {jobs, queue, root, TOOLS, PUBLIC};
