// 任务表：内存 + 原子 JSON 持久化。进程重启后只保留终态任务，运行中的任务标记为中断。
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const TERMINAL = new Set(['success', 'failed', 'canceled']);
const MAX_JOBS = 200;

function deriveStage(message, progress) {
  const text = String(message || '');
  if (/上传|报价|积分|提交|排队/.test(text)) return 'prepare';
  if (/生成中|采样|推理/.test(text)) return 'sampling';
  if (/下载|解码|完成/.test(text)) return 'finalize';
  return Number(progress) >= 90 ? 'finalize' : Number(progress) > 0 ? 'sampling' : 'prepare';
}

function deriveEta(job, progress) {
  if (!job.startedAt || job.status !== 'running' || !progress) return null;
  const elapsed = (Date.now() - job.startedAt) / 1000;
  const remaining = elapsed * (100 - progress) / Math.max(1, progress);
  return Number.isFinite(remaining) ? Math.max(0, Math.round(remaining)) : null;
}

export function createJobStore({ path = '' } = {}) {
  const jobs = new Map();
  let seq = 0;

  function persist() {
    if (!path) return;
    try {
      mkdirSync(dirname(path), { recursive: true });
      const list = [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt || String(b.id).localeCompare(String(a.id))).slice(0, MAX_JOBS);
      const temp = `${path}.tmp`;
      writeFileSync(temp, JSON.stringify({ version: 1, jobs: list }, null, 2));
      renameSync(temp, path);
    } catch { /* 持久化失败不应影响生成 */ }
  }

  function load() {
    if (!path || !existsSync(path)) return;
    try {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      for (const job of data.jobs || []) {
        if (!job?.id) continue;
        if (!TERMINAL.has(job.status)) {
          job.status = 'failed';
          job.error = { code: 'JOB_INTERRUPTED', message: '服务重启，任务已中断' };
          job.message = '服务重启，任务已中断';
          job.doneAt = job.doneAt || Date.now();
        }
        jobs.set(job.id, job);
      }
      seq = jobs.size;
    } catch { /* 损坏的任务文件直接忽略 */ }
  }

  load();

  function create(type, meta = {}) {
    const id = `job_${Date.now().toString(36)}_${(seq += 1).toString(36)}`;
    const job = {
      id,
      type,
      status: 'queued',
      stage: 'prepare',
      progress: 0,
      etaSeconds: null,
      message: '',
      createdAt: Date.now(),
      startedAt: null,
      doneAt: null,
      result: null,
      error: null,
      meta,
    };
    jobs.set(id, job);
    persist();
    return job;
  }

  function update(id, patch = {}) {
    const job = jobs.get(id);
    if (!job) return null;
    if (job.status === 'canceled' && patch.status && patch.status !== 'canceled') return job;
    if (job.status === 'success' && patch.status === 'failed') return job;
    const { meta: metaPatch, ...rest } = patch;
    Object.assign(job, rest);
    if (metaPatch && typeof metaPatch === 'object') job.meta = { ...(job.meta || {}), ...metaPatch };
    if (patch.status === 'running' && !job.startedAt) job.startedAt = Date.now();
    if (patch.status && TERMINAL.has(patch.status)) job.doneAt = Date.now();
    if (job.status === 'running') {
      job.stage = patch.stage || deriveStage(job.message, job.progress);
      job.etaSeconds = Number.isFinite(Number(patch.etaSeconds)) ? Number(patch.etaSeconds) : deriveEta(job, job.progress);
    }
    if (TERMINAL.has(job.status)) { job.etaSeconds = 0; job.stage = 'done'; }
    persist();
    return job;
  }

  function get(id) { return jobs.get(id) || null; }

  function list({ limit = 50 } = {}) {
    prune();
    return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt || String(b.id).localeCompare(String(a.id))).slice(0, Math.max(1, Math.min(200, Number(limit) || 50)));
  }

  function prune(maxAgeMs = 60 * 60 * 1000) {
    const now = Date.now();
    let changed = false;
    for (const [id, job] of jobs) {
      if (job.doneAt && now - job.doneAt > maxAgeMs) { jobs.delete(id); changed = true; }
    }
    const sorted = [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt || String(b.id).localeCompare(String(a.id)));
    for (const job of sorted.slice(MAX_JOBS)) { jobs.delete(job.id); changed = true; }
    if (changed) persist();
  }

  return { create, update, get, list, prune, persist };
}
