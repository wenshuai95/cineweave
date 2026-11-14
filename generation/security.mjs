// 生成服务安全策略：CORS 来源、参考素材 URL 白名单、大小限制。
const PRIVATE_RANGES = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

export function isPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return false;
  if (host === 'localhost' || host === '::1') return true;
  return PRIVATE_RANGES.some((pattern) => pattern.test(host));
}

export function allowedCorsOrigin(origin, extraOrigins = '') {
  if (!origin) return '';
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (isPrivateHost(url.hostname)) return origin;
    const allowed = String(extraOrigins || '').split(',').map((item) => item.trim()).filter(Boolean);
    return allowed.includes(origin) ? origin : '';
  } catch {
    return '';
  }
}

export function assertAllowedAssetUrl(rawUrl, { comfyBaseUrl = '', extraHosts = '' } = {}) {
  const raw = String(rawUrl || '').trim();
  if (!raw) throw new Error('参考素材 URL 为空');
  if (raw.startsWith('/')) return raw;
  let url;
  try { url = new URL(raw); } catch { throw new Error('参考素材 URL 无效'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('参考素材只允许 http/https');
  if (isPrivateHost(url.hostname)) return url.toString();
  try {
    if (comfyBaseUrl && url.hostname === new URL(comfyBaseUrl).hostname) return url.toString();
  } catch { /* ignore */ }
  const hosts = String(extraHosts || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (hosts.includes(url.hostname)) return url.toString();
  throw new Error(`参考素材域名不被允许：${url.hostname}`);
}

export function assertUploadSize(bytes, maxBytes = 100 * 1024 * 1024) {
  const length = Number(bytes?.length) || 0;
  if (!length) throw new Error('上传内容为空');
  if (length > maxBytes) throw new Error(`上传内容过大（${Math.round(length / 1024 / 1024)}MB）`);
  return length;
}
