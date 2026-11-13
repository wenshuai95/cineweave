// 画布任务中心客户端：只负责 HTTP 和轮询，不碰 DOM。
// 所有函数都接受 fetchImpl，方便单测。

const DEFAULT_INTERVAL = 1200;

function json(response) {
  if (!response?.ok) throw new Error(`job request failed: HTTP ${response?.status || '?'}`);
  return response.json();
}

export async function getJob(id, { fetchImpl = fetch } = {}) {
  return json(await fetchImpl(`/api/generation/jobs/${encodeURIComponent(id)}`));
}

export async function listJobs({ limit = 30, fetchImpl = fetch } = {}) {
  const data = await json(await fetchImpl(`/api/generation/jobs?limit=${Math.max(1, Math.min(200, Number(limit) || 30))}`));
  return Array.isArray(data.jobs) ? data.jobs : [];
}

export async function cancelJob(id, { fetchImpl = fetch } = {}) {
  return json(await fetchImpl(`/api/generation/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }));
}

export async function retryJob(id, { fetchImpl = fetch } = {}) {
  return json(await fetchImpl(`/api/generation/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST' }));
}

export async function waitForJob(id, { fetchImpl = fetch, intervalMs = DEFAULT_INTERVAL, onUpdate, signal } = {}) {
  for (;;) {
    if (signal?.aborted) throw new Error('aborted');
    const job = await getJob(id, { fetchImpl });
    if (onUpdate) onUpdate(job);
    if (['success', 'failed', 'canceled'].includes(job.status)) return job;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, intervalMs);
      if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
    });
  }
}
