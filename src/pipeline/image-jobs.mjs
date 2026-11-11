// 流水线 · 资产图生成客户端：报价 → 提交 → 轮询 → 取图。
// 所有请求带应用令牌；真正的实现由注入的 fetch 完成，便于测试。

async function token(fetchImpl) {
  const response = await fetchImpl('/api/ai/text/status', {signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw Error('本机服务未就绪');
  return (await response.json()).token;
}

function headers(tok) {
  return {'Content-Type': 'application/json', 'X-Jingchang-Token': tok};
}

export async function imageModels({fetchImpl = fetch} = {}) {
  const response = await fetchImpl('/api/oiioii/models');
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '无法读取图片模型');
  return Array.isArray(data.models) ? data.models : [];
}

export async function quoteImage({modelId, resolution = '', aspect = '16:9', fetchImpl = fetch} = {}) {
  const tok = await token(fetchImpl);
  const response = await fetchImpl('/api/oiioii/quote', {
    method: 'POST', headers: headers(tok),
    body: JSON.stringify({modelId, resolution, aspect}),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '报价失败');
  return data;
}

export async function generateImage({quoteId, prompt, fetchImpl = fetch} = {}) {
  const tok = await token(fetchImpl);
  const response = await fetchImpl('/api/oiioii/generate', {
    method: 'POST', headers: headers(tok),
    body: JSON.stringify({quoteId, prompt}),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '提交生成失败');
  return data;
}

export async function pollImage(jobId, {fetchImpl = fetch} = {}) {
  const response = await fetchImpl('/api/oiioii/task/' + encodeURIComponent(jobId));
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '查询生成任务失败');
  return data;
}

/** 轮询到成功或失败；超时抛错。 */
export async function waitForImage(jobId, {fetchImpl = fetch, interval = 3000, timeout = 300000} = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const job = await pollImage(jobId, {fetchImpl});
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed' || job.status === 'unknown') throw Error(job.message || '生成失败');
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw Error('生成超时，请到旧界面的任务中心核对');
}

/** 下载生成结果为 Blob（用于写入本机媒体库）。 */
export async function fetchImageBlob(imageUrl, {fetchImpl = fetch} = {}) {
  const response = await fetchImpl(imageUrl);
  if (!response.ok) throw Error('图片下载失败');
  return response.blob();
}

export function imageSize(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { resolve({width: image.naturalWidth, height: image.naturalHeight}); URL.revokeObjectURL(url); };
    image.onerror = () => { reject(Error('无法读取图片尺寸')); URL.revokeObjectURL(url); };
    image.src = url;
  });
}
