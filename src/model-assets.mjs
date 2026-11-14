// 资产引用（客户端）：内嵌 base64 ⇄ 本机内容寻址资产库
// 工程里只保存 /api/assets/<sha256>.<ext>；导出备份时再还原成内嵌数据，
// 保证备份仍然是「一个文件拿走就能用」。
const STORE_URL = /^\/api\/(?:assets|model-assets)\/([0-9a-f]{64})\.(\w+)$/;
const DATA_URI = /^data:([\w.+-]+\/[\w.+-]+);base64,/;

const MEDIA_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a',
  'audio/webm': 'webm', 'model/gltf-binary': 'glb',
};
const EXT_MIME = Object.fromEntries(Object.entries(MEDIA_EXT).map(([m, e]) => [e, m]));
EXT_MIME.jpg = 'image/jpeg';

export function isStoredSrc(src) {
  return typeof src === 'string' && STORE_URL.test(src);
}

export function isEmbeddedSrc(src) {
  return typeof src === 'string' && DATA_URI.test(src);
}

export function storeHashOf(src) {
  const m = STORE_URL.exec(typeof src === 'string' ? src : '');
  return m ? m[1] : null;
}

// 兼容旧命名
export const isStoreModelSrc = isStoredSrc;
export const isEmbeddedModelSrc = isEmbeddedSrc;

export function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'));
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function dataUriParts(src) {
  const m = DATA_URI.exec(src);
  if (!m) throw Error('资产数据格式无效');
  return {mime: m[1], base64: src.slice(src.indexOf(',') + 1)};
}

/** 上传一段字节到本机资产库；mime 决定扩展名。 */
export async function uploadAssetBytes(bytes, mime, {fetchImpl = globalThis.fetch} = {}) {
  const response = await fetchImpl('/api/assets', {
    method: 'POST',
    headers: {'Content-Type': mime},
    body: bytes,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || '资产上传失败');
  return data;
}

export async function uploadModelBytes(bytes, options = {}) {
  return uploadAssetBytes(bytes, 'model/gltf-binary', options);
}

/** 内嵌 data URI → 资产库 URL。 */
export async function uploadDataUri(src, options = {}) {
  const {mime, base64} = dataUriParts(src);
  if (!MEDIA_EXT[mime]) throw Error('不支持的资产类型：' + mime);
  return uploadAssetBytes(base64ToBytes(base64), mime, options);
}

export const uploadEmbeddedModel = uploadDataUri;

function assetHosts(project) {
  const hosts = [];
  for (const o of project.objects || []) {
    if (o?.type === 'model' && typeof o.modelSrc === 'string') hosts.push({host: o, field: 'modelSrc'});
  }
  for (const n of project.nodes || []) {
    if (typeof n?.modelSrc === 'string' && n.modelSrc) hosts.push({host: n, field: 'modelSrc'});
    // 只迁移图片节点；视频/音频仍走工作站媒体库，保持剪辑与版本逻辑不变
    if (n?.type === 'image' && typeof n.src === 'string' && n.src) hosts.push({host: n, field: 'src'});
  }
  return hosts;
}

/**
 * 把工程里内嵌的模型/图片/视频/音频迁移到本机资产库，改写为 URL 引用。
 * 上传失败的对象保留内嵌数据（不让工程丢内容），返回失败数量。
 */
export async function migrateProjectAssets(project, {fetchImpl = globalThis.fetch, onFail} = {}) {
  const cache = new Map();
  let migrated = 0, failed = 0, bytesBefore = 0;
  for (const {host, field} of assetHosts(project)) {
    const src = host[field];
    if (!isEmbeddedSrc(src)) continue;
    bytesBefore += src.length;
    try {
      let info = cache.get(src);
      if (!info) {
        info = await uploadDataUri(src, {fetchImpl});
        cache.set(src, info);
      }
      host[field] = info.url;
      if (field === 'modelSrc') host.modelHash = info.hash;
      migrated++;
    } catch (error) {
      failed++;
      onFail?.(error, host);
    }
  }
  return {migrated, failed, bytesBefore};
}

/**
 * 导出备份前把资产库 URL 还原成内嵌 base64，保证备份可迁移。
 * 服务器不可用时保留 URL（导出仍可用，但需要同一台机器上的资产库）。
 */
export async function embedProjectAssets(project, {fetchImpl = globalThis.fetch, base = '', onFail} = {}) {
  const cache = new Map();
  let embedded = 0, failed = 0, bytesAfter = 0;
  for (const {host, field} of assetHosts(project)) {
    const src = host[field];
    if (!isStoredSrc(src)) continue;
    try {
      let dataUri = cache.get(src);
      if (!dataUri) {
        const response = await fetchImpl(base + src);
        if (!response.ok) throw Error('资产读取失败');
        const mime = EXT_MIME[(STORE_URL.exec(src) || [])[2]] || response.headers?.get?.('content-type') || 'application/octet-stream';
        const bytes = new Uint8Array(await response.arrayBuffer());
        dataUri = `data:${mime.split(';')[0]};base64,` + bytesToBase64(bytes);
        cache.set(src, dataUri);
      }
      host[field] = dataUri;
      embedded++;
      bytesAfter += dataUri.length;
    } catch (error) {
      failed++;
      onFail?.(error, host);
    }
  }
  return {embedded, failed, bytesAfter};
}

export const migrateProjectModels = migrateProjectAssets;
export const embedProjectModels = embedProjectAssets;
