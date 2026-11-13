// 画布生成请求：任务提交、报价、上传。只负责 HTTP，不碰 DOM。

async function readJson(response) {
  try { return await response.json(); } catch { return {}; }
}

export async function submitJob(body, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl('/api/generation/jobs', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.error || '提交失败');
  return data;
}

export async function requestQuote(body, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl('/api/generation/quote', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.error || '报价失败');
  return data;
}

export async function uploadDataUrl(dataUrl, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl('/api/generation/upload', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataUrl }),
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.error || '上传失败');
  return data;
}
