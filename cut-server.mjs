// 流水线 · 成片合成：把逐镜视频按 EDL 拼成一个 MP4（本机 ffmpeg）。
// 安全边界：仅本机同源；只接受 base64 MP4 分段；串行一次一个任务。
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir, writeFile, stat, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';
import {FFMPEG} from './workstation-server.mjs';

const VERSION = '1.46.0';
const root = process.env.JINGCHANG_DATA_DIR
  ? resolve(process.env.JINGCHANG_DATA_DIR, 'cut')
  : fileURLToPath(new URL('./.local/cut/', import.meta.url));

export const CUT_FFMPEG = (process.env.CUT_FFMPEG || FFMPEG || 'ffmpeg');
const SEGMENTS_MAX = 60;
const SEGMENT_MAX_BYTES = 200 * 1024 * 1024;
const TOTAL_MAX_BYTES = 400 * 1024 * 1024;
const DATA_URI = /^data:video\/mp4;base64,/;

const jobs = new Map();
const queue = [];
let running = null;

const json = (res, data, status = 200) => {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(data));
};
const idOk = value => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);

export function validateCutRequest(body) {
  if (!body || typeof body !== 'object') return '请求内容缺失';
  if (!Array.isArray(body.segments) || !body.segments.length) return '至少需要一个视频片段';
  if (body.segments.length > SEGMENTS_MAX) return `最多 ${SEGMENTS_MAX} 个片段`;
  let total = 0;
  for (const [index, segment] of body.segments.entries()) {
    if (!segment || typeof segment.data !== 'string') return `第 ${index + 1} 段缺少视频数据`;
    const data = segment.data.replace(DATA_URI, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length < 100) return `第 ${index + 1} 段视频数据无效`;
    const bytes = Math.floor(data.length * 3 / 4);
    if (bytes > SEGMENT_MAX_BYTES) return `第 ${index + 1} 段视频过大`;
    total += bytes;
  }
  if (total > TOTAL_MAX_BYTES) return '片段总大小超出上限';
  if (body.width !== undefined && (!Number.isInteger(body.width) || body.width < 64 || body.width > 3840)) return '宽度无效';
  if (body.height !== undefined && (!Number.isInteger(body.height) || body.height < 64 || body.height > 2160)) return '高度无效';
  if (body.fps !== undefined && ![24, 25, 30].includes(body.fps)) return '帧率只支持 24/25/30';
  return null;
}

function runFfmpeg(job) {
  const args = [
    '-y', '-nostdin', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', job.listPath,
    '-vf', `scale=${job.width}:${job.height}:force_original_aspect_ratio=decrease,pad=${job.width}:${job.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    '-r', String(job.fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', job.outputPath,
  ];
  return new Promise((resolvePromise, reject) => {
    const child = spawn(CUT_FFMPEG, args, {shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe']});
    job.child = child;
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-1500); });
    child.once('error', reject);
    child.once('close', code => {
      job.child = null;
      if (job.status === 'cancelled') return reject(Object.assign(Error('cancelled'), {cancelled: true}));
      if (code !== 0) return reject(Error(`ffmpeg 退出码 ${code}：${stderr.trim().slice(0, 300) || '无输出'}`));
      resolvePromise();
    });
  });
}

async function pipeline(job) {
  await mkdir(job.dir, {recursive: true});
  const lines = [];
  for (const [index, segment] of job.segments.entries()) {
    const data = segment.data.replace(DATA_URI, '');
    const file = join(job.dir, `seg-${String(index).padStart(3, '0')}.mp4`);
    await writeFile(file, Buffer.from(data, 'base64'));
    lines.push(`file '${file.replace(/'/g, "'\\''")}'`);
  }
  await writeFile(job.listPath, lines.join('\n') + '\n');
  job.status = 'running';
  job.message = '正在合成…';
  await runFfmpeg(job);
  const info = await stat(job.outputPath).catch(() => null);
  if (!info?.isFile()) throw Error('合成完成但没有产出视频');
  job.bytes = info.size;
  job.status = 'done';
  job.message = `完成：${job.segments.length} 段，${(info.size / 1e6).toFixed(1)} MB`;
  running = null;
  pump();
}

async function pump() {
  if (running || !queue.length) return;
  const job = queue.shift();
  if (job.status === 'cancelled') return pump();
  running = job;
  try { await pipeline(job); }
  catch (error) {
    job.status = job.status === 'cancelled' ? 'cancelled' : 'error';
    job.message = job.status === 'cancelled' ? '已取消合成' : `合成失败：${error.message}`;
    running = null;
    pump();
  }
}

export function startCutJob(body) {
  const invalid = validateCutRequest(body);
  if (invalid) return {error: invalid};
  const id = randomUUID();
  const job = {
    id, dir: join(root, id),
    status: 'queued', message: '排队中…',
    segments: body.segments,
    width: body.width || 1280, height: body.height || 720, fps: body.fps || 24,
    outputPath: join(root, id, 'final.mp4'), listPath: join(root, id, 'list.txt'),
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  queue.push(job);
  pump();
  return {job: publicCutJob(job)};
}

export const publicCutJob = job => ({
  id: job.id,
  status: job.status,
  message: job.message,
  bytes: job.bytes,
  segments: job.segments.length,
  fileUrl: job.status === 'done' ? `/api/cut/jobs/${job.id}/file` : null,
  version: VERSION,
});

export const getCutJob = id => jobs.get(id) || null;

export function cancelCutJob(id) {
  const job = jobs.get(id);
  if (!job) return null;
  if (['queued', 'running'].includes(job.status)) {
    job.status = 'cancelled';
    job.message = '已取消合成';
    if (job.child) {
      try { job.child.kill('SIGTERM'); } catch {}
      setTimeout(() => { try { job.child?.kill('SIGKILL'); } catch {} }, 2000);
    }
    if (job === running && !job.child) { running = null; pump(); }
  }
  return publicCutJob(job);
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

export async function handleCut(req, res, url) {
  if (!url.pathname.startsWith('/api/cut/')) return false;
  try {
    const expected = 'http://' + req.headers.host;
    if (req.headers.origin && req.headers.origin !== expected) {
      json(res, {error: '仅允许本机软件同源访问'}, 403);
      return true;
    }
    const tail = url.pathname.split('/').filter(Boolean).slice(2);
    if (req.method === 'POST' && tail[0] === 'jobs' && tail.length === 1) {
      let body;
      try {
        body = JSON.parse(await readBody(req, TOTAL_MAX_BYTES + 8 * 1024 * 1024).then(raw => raw.toString('utf8')));
      } catch (error) {
        json(res, {error: error.message === 'too large' ? '片段总大小超出上限' : '请求内容不是有效 JSON'}, 400);
        return true;
      }
      const result = startCutJob(body);
      if (result.error) { json(res, {error: result.error}, 400); return true; }
      json(res, result.job, 202);
      return true;
    }
    if (req.method === 'GET' && tail[0] === 'jobs' && tail.length === 2 && idOk(tail[1])) {
      const job = getCutJob(tail[1]);
      if (!job) { json(res, {error: '任务不存在'}, 404); return true; }
      json(res, publicCutJob(job));
      return true;
    }
    if (req.method === 'POST' && tail[0] === 'jobs' && tail.length === 3 && tail[2] === 'cancel' && idOk(tail[1])) {
      const job = cancelCutJob(tail[1]);
      if (!job) { json(res, {error: '任务不存在'}, 404); return true; }
      json(res, job);
      return true;
    }
    if (req.method === 'GET' && tail[0] === 'jobs' && tail.length === 3 && tail[2] === 'file' && idOk(tail[1])) {
      const job = getCutJob(tail[1]);
      if (!job || job.status !== 'done') { json(res, {error: '成片尚未生成'}, 404); return true; }
      const info = await stat(job.outputPath).catch(() => null);
      if (!info?.isFile()) { json(res, {error: '成片文件不存在'}, 404); return true; }
      res.writeHead(200, {'Content-Type': 'video/mp4', 'Content-Length': info.size, 'Cache-Control': 'no-store'});
      createReadStream(job.outputPath).pipe(res);
      return true;
    }
    json(res, {error: '未知的合成接口'}, 404);
    return true;
  } catch (error) {
    json(res, {error: error.message || '合成服务异常'}, 500);
    return true;
  }
}

export const cutInternals = {jobs, queue, root};
