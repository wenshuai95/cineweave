import {bibleStyleSuffix} from './bible.mjs';
// 流水线 · 逐镜视频生成客户端：模型 → 报价 → 提交 → 轮询 → 取视频。
// 与资产图同一套：先报价、确认后提交，避免静默扣积分。

async function token(fetchImpl) {
  const response = await fetchImpl('/api/ai/text/status', {signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw Error('本机服务未就绪');
  return (await response.json()).token;
}

const headers = tok => ({'Content-Type': 'application/json', 'X-Jingchang-Token': tok});

export async function videoModels({fetchImpl = fetch} = {}) {
  const response = await fetchImpl('/api/oiioii/video/models');
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '无法读取视频模型');
  return Array.isArray(data.models) ? data.models : [];
}

/** 选一个允许纯文本生成的模型，并给出与镜头时长最接近的合法时长。 */
export function pickVideoModel(models, shotDuration) {
  const candidates = (models || []).filter(model => model.promptOnly);
  const model = candidates[0] || null;
  if (!model) return null;
  const allowed = [];
  for (const range of model.durations || []) {
    const parts = String(range).split('-').map(Number);
    if (parts.length === 2) for (let value = Math.ceil(parts[0]); value <= Math.min(parts[1], 180); value++) allowed.push(value);
    else if (Number.isFinite(parts[0])) allowed.push(parts[0]);
  }
  const duration = allowed.length
    ? allowed.reduce((best, value) => Math.abs(value - shotDuration) < Math.abs(best - shotDuration) ? value : best, allowed[0])
    : Math.max(1, Math.round(shotDuration));
  return {
    model,
    duration,
    aspect: (model.aspects || []).includes('16:9') ? '16:9' : (model.aspects || [])[0] || '16:9',
    resolution: (model.sizes || [])[0] || '',
  };
}

export async function quoteVideo({projectId, sourceId, prompt, modelId, duration, resolution = '', aspect = '16:9', references = [], fetchImpl = fetch}) {
  const tok = await token(fetchImpl);
  const response = await fetchImpl('/api/oiioii/video/quote', {
    method: 'POST', headers: headers(tok),
    body: JSON.stringify({projectId, sourceId, prompt, modelId, duration, resolution, aspect, references}),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '视频报价失败');
  return data;
}

export async function generateVideo({quoteId, fetchImpl = fetch}) {
  const tok = await token(fetchImpl);
  const response = await fetchImpl('/api/oiioii/video/generate', {
    method: 'POST', headers: headers(tok),
    body: JSON.stringify({quoteId}),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '提交视频生成失败');
  return data;
}

export async function pollVideo(jobId, {fetchImpl = fetch} = {}) {
  const response = await fetchImpl('/api/oiioii/video/task/' + encodeURIComponent(jobId));
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '查询视频任务失败');
  return data;
}

export async function waitForVideo(jobId, {fetchImpl = fetch, interval = 4000, timeout = 900000, onProgress} = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const job = await pollVideo(jobId, {fetchImpl});
    onProgress?.(job);
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed' || job.status === 'unknown') throw Error(job.message || '视频生成失败');
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw Error('视频生成超时，请到旧界面的任务中心核对');
}

export async function fetchVideoBlob(jobId, {fetchImpl = fetch} = {}) {
  const response = await fetchImpl('/api/oiioii/video/file/' + encodeURIComponent(jobId));
  if (!response.ok) throw Error('视频下载失败');
  return response.blob();
}

/** 视频提示词：镜头描述 + 引用资产提示词。 */
export function shotVideoPrompt(project, shot, assets = []) {
  const rows = [...(project.shots || [])].sort((a, b) => a.start - b.start);
  const index = rows.findIndex(item => item.id === shot.id);
  const nodes = (project.nodes || []).filter(node => node.type === 'text' && node.storyRef?.kind === 'shot' && node.storyRef.id === shot.id);
  const description = nodes[0]?.text || '';
  const assetText = assets.filter(asset => (asset.shotIds || []).includes(shot.id) || !asset.shotIds?.length)
    .slice(0, 4).map(asset => asset.prompt).filter(Boolean).join('；');
  const style = bibleStyleSuffix(project?.workstation?.bible);
  return [`镜 ${index + 1}，时长 ${(shot.end - shot.start).toFixed(1)} 秒`, description, assetText, style].filter(Boolean).join('\n').slice(0, 6000);
}
