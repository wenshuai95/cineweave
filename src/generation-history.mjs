// Unified generation history model (DOM-free): merges provider/ComfyUI/video task
// stores into the rows shown in the composer's “最近生成” list.

const ACTIVE = new Set(['queued', 'running']);
const STATUS_LABELS = {queued: '排队中', running: '生成中', succeeded: '已完成', failed: '失败', cancelled: '已取消'};
const PROVIDER_LABELS = {
  comfyui: 'ComfyUI（本地）',
  seedream: 'Seedream（云端）',
  fake: 'Fake（本地测试）',
  seedance: 'Seedance',
  kling: 'Kling',
};
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const stamp = value => Number.isFinite(value) && value >= 0 ? value : 0;
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 200;

export function generationProviderLabel(providerId) {
  return PROVIDER_LABELS[providerId] || String(providerId || '服务商');
}

export function generationStatusLabel(status, progress) {
  if (status === 'running' && Number.isFinite(progress) && progress > 0) return `生成中 ${Math.round(Math.min(1, progress) * 100)}%`;
  return STATUS_LABELS[status] || '状态待确认';
}

export function isActiveGenerationStatus(status) {
  return ACTIVE.has(status);
}

function normalizeRow(task, fallbackProviderId) {
  if (!task || !validId(task.id)) return null;
  const providerId = typeof task.providerId === 'string' && task.providerId ? task.providerId : fallbackProviderId;
  if (!providerId) return null;
  const status = typeof task.status === 'string' && task.status ? task.status : 'unknown';
  const progress = Number.isFinite(task.progress) ? Math.max(0, Math.min(1, task.progress)) : null;
  const errorText = status === 'failed' ? text(task.error?.message || task.message, 240) || '生成失败' : '';
  const prompt = text(task.prompt, 2000);
  return {
    key: providerId + ':' + task.id,
    id: task.id,
    providerId,
    providerLabel: generationProviderLabel(providerId),
    kind: task.kind === 'video' ? 'video' : 'image',
    status,
    active: ACTIVE.has(status),
    statusLabel: generationStatusLabel(status, progress),
    progress,
    prompt,
    promptSummary: prompt.replace(/\s+/g, ' ').trim().slice(0, 60) || '（无描述）',
    errorText,
    createdAt: stamp(task.createdAt),
    updatedAt: stamp(task.updatedAt || task.createdAt),
  };
}

/**
 * Merge image/video task lists into sorted, de-duplicated history rows.
 * Active tasks are listed first so a dismissed background task stays findable.
 */
export function buildGenerationHistory({providerTasks = [], comfyTasks = [], videoTasks = []} = {}, {mode = 'image', limit = 10} = {}) {
  const inputs = [
    ...(Array.isArray(providerTasks) ? providerTasks.map(task => normalizeRow(task, 'seedream')) : []),
    ...(Array.isArray(comfyTasks) ? comfyTasks.map(task => normalizeRow(task, 'comfyui')) : []),
    ...(Array.isArray(videoTasks) ? videoTasks.map(task => normalizeRow(task, 'video')) : []),
  ].filter(Boolean);
  const byKey = new Map();
  for (const row of inputs) {
    if (row.kind !== (mode === 'video' ? 'video' : 'image')) continue;
    const old = byKey.get(row.key);
    if (!old || row.updatedAt >= old.updatedAt) byKey.set(row.key, row);
  }
  const rows = [...byKey.values()].sort((a, b) => (b.active - a.active) || (b.createdAt - a.createdAt) || a.key.localeCompare(b.key));
  return rows.slice(0, Math.max(1, limit));
}

/** Which rows must be polled to advance their status. */
export function generationHistoryPollTargets(rows = []) {
  return (Array.isArray(rows) ? rows : []).filter(row => row?.active && validId(row.id) && validId(row.providerId)).map(row => ({id: row.id, providerId: row.providerId}));
}

/** Action shown on a history row; recovered results stay non-duplicating. */
export function generationHistoryAction(row, {added = false} = {}) {
  if (!row) return {kind: 'none', label: ''};
  if (row.active) return {kind: 'refresh', label: '刷新状态'};
  if (row.status === 'succeeded') return added ? {kind: 'none', label: '已在画布'} : {kind: 'recover', label: '加入画布'};
  return {kind: 'none', label: ''};
}
