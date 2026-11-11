// 内存任务表：id、状态、进度、结果。进程重启后清空（任务的持久化在 M5 接工程时再做）。
export function createJobStore() {
  const jobs = new Map();
  let seq = 0;

  function create(type, meta = {}) {
    const id = `job_${Date.now().toString(36)}_${(seq += 1).toString(36)}`;
    const job = {
      id,
      type,
      status: 'queued',
      progress: 0,
      message: '',
      createdAt: Date.now(),
      startedAt: null,
      doneAt: null,
      result: null,
      error: null,
      meta,
    };
    jobs.set(id, job);
    return job;
  }

  function update(id, patch = {}) {
    const job = jobs.get(id);
    if (!job) return null;
    Object.assign(job, patch);
    if (patch.status === 'running' && !job.startedAt) job.startedAt = Date.now();
    if (['success', 'failed', 'canceled'].includes(patch.status)) job.doneAt = Date.now();
    return job;
  }

  function get(id) {
    return jobs.get(id) || null;
  }

  function prune(maxAgeMs = 60 * 60 * 1000) {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (job.doneAt && now - job.doneAt > maxAgeMs) jobs.delete(id);
    }
  }

  return { create, update, get, prune };
}
