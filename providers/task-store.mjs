import {randomUUID} from 'node:crypto';
import {ProviderError, TASK_STATUSES} from './contracts.mjs';

const ALLOWED = Object.freeze({
  queued: new Set(['running', 'failed', 'cancelled']),
  running: new Set(['succeeded', 'failed', 'cancelled']),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set(),
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * 统一任务存储（Sprint 1 先内存实现，后续再接 jobs 持久化）。
 * 任务字段保持厂商无关，UI/任务中心只读这些字段。
 */
export function createTaskStore({idFactory = randomUUID, now = Date.now, onChange = null} = {}) {
  const notify = () => { try { onChange?.(); } catch {} };
  const tasks = new Map();

  const touch = (task, patch = {}) => {
    Object.assign(task, patch, {updatedAt: now()});
    return task;
  };

  const publicTask = task => ({
    ...task,
    outputs: task.outputs.map(output => ({...output})),
  });

  const store = {
    create(input = {}) {
      const id = idFactory();
      const task = {
        id,
        providerId: String(input.providerId || ''),
        modelId: String(input.modelId || ''),
        kind: input.kind === 'video' ? 'video' : 'image',
        projectId: input.projectId == null ? null : String(input.projectId),
        sourceId: input.sourceId == null ? null : String(input.sourceId),
        prompt: typeof input.prompt === 'string' ? input.prompt : '',
        remoteId: input.remoteId == null ? null : String(input.remoteId),
        remoteKind: input.remoteKind == null ? null : String(input.remoteKind),
        status: 'queued',
        progress: 0,
        outputs: [],
        error: null,
        message: '',
        cost: null,
        createdAt: now(),
        updatedAt: now(),
        startedAt: null,
        finishedAt: null,
      };
      tasks.set(id, task);
      notify();
      return publicTask(task);
    },
    get(id) {
      const task = tasks.get(id);
      return task ? publicTask(task) : null;
    },
    update(id, patch = {}) {
      const task = tasks.get(id);
      if (!task) throw new ProviderError('TASK_NOT_FOUND', `任务不存在：${id}`);
      if (patch.status && patch.status !== task.status) {
        if (!TASK_STATUSES.includes(patch.status)) throw new ProviderError('INVALID_STATUS', `未知任务状态：${patch.status}`);
        if (!ALLOWED[task.status].has(patch.status)) {
          throw new ProviderError('INVALID_TRANSITION', `任务不能从 ${task.status} 变为 ${patch.status}`);
        }
        task.status = patch.status;
        if (patch.status === 'running' && !task.startedAt) task.startedAt = now();
        if (['succeeded', 'failed', 'cancelled'].includes(patch.status)) task.finishedAt = now();
      }
      if (Number.isFinite(patch.progress)) task.progress = clamp(patch.progress, 0, 1);
      if (Array.isArray(patch.outputs)) task.outputs = patch.outputs.map(output => ({...output}));
      if (patch.error !== undefined) task.error = patch.error;
      if (patch.message !== undefined) task.message = String(patch.message);
      if (patch.cost !== undefined) task.cost = patch.cost;
      if (patch.remoteId !== undefined) task.remoteId = patch.remoteId == null ? null : String(patch.remoteId);
      if (patch.remoteKind !== undefined) task.remoteKind = patch.remoteKind == null ? null : String(patch.remoteKind);
      task.updatedAt = now();
      notify();
      return publicTask(task);
    },
    list(filter = {}) {
      return [...tasks.values()]
        .filter(task => !filter.providerId || task.providerId === filter.providerId)
        .filter(task => !filter.projectId || task.projectId === filter.projectId)
        .filter(task => !filter.status || task.status === filter.status)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(publicTask);
    },
    size() {
      return tasks.size;
    },
    /** 为后续持久化预留：导出/恢复纯 JSON。 */
    snapshot() {
      return [...tasks.values()].map(publicTask);
    },
    hydrate(rows = []) {
      tasks.clear();
      for (const row of rows) {
        if (!row || typeof row.id !== 'string' || !TASK_STATUSES.includes(row.status)) continue;
        tasks.set(row.id, {...row, outputs: Array.isArray(row.outputs) ? row.outputs.map(output => ({...output})) : []});
      }
      notify();
    },
  };

  return store;
}
