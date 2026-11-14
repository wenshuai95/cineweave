// 流水线 · 成片合成客户端：收集逐镜视频 → 提交本机 ffmpeg → 轮询 → 下载成片。

export function toBase64(buffer) {
  if (typeof Buffer !== 'undefined') return Buffer.from(buffer).toString('base64');
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** 把工程里已生成视频的镜头按时间顺序收集为 base64 分段。 */
export async function collectCutSegments(project, getBlob) {
  const shots = [...(project.shots || [])].sort((a, b) => a.start - b.start);
  const segments = [];
  for (const shot of shots) {
    const mediaId = shot.render?.videoMediaId;
    if (!mediaId) continue;
    const blob = await getBlob(mediaId);
    if (!blob) throw Error('镜头视频文件缺失，请重新生成');
    segments.push({name: 'shot-' + shot.id, data: 'data:video/mp4;base64,' + toBase64(await blob.arrayBuffer())});
  }
  return segments;
}

export async function startCut({segments, width = 1280, height = 720, fps = 24, fetchImpl = fetch} = {}) {
  const response = await fetchImpl('/api/cut/jobs', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({segments, width, height, fps}),
  });
  let data;
  try { data = await response.json(); } catch { throw Error('本机合成服务返回异常'); }
  if (!response.ok) throw Error(data.error || '提交合成失败');
  return data;
}

export async function pollCut(jobId, {fetchImpl = fetch} = {}) {
  const response = await fetchImpl('/api/cut/jobs/' + encodeURIComponent(jobId));
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '查询合成任务失败');
  return data;
}

export async function waitForCut(jobId, {fetchImpl = fetch, interval = 1500, timeout = 900000, onProgress} = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const job = await pollCut(jobId, {fetchImpl});
    onProgress?.(job);
    if (job.status === 'done') return {...job, id: job.id || jobId};
    if (job.status === 'error' || job.status === 'cancelled') throw Error(job.message || '合成失败');
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw Error('合成超时');
}

export async function fetchCutBlob(jobId, {fetchImpl = fetch} = {}) {
  const response = await fetchImpl('/api/cut/jobs/' + encodeURIComponent(jobId) + '/file');
  if (!response.ok) throw Error('成片下载失败');
  return response.blob();
}
