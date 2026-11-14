// 造梦工坊 · 本机模型资产库（内容寻址）
// 工程里不再内嵌 base64 GLB，只保存 /api/model-assets/<sha256>.glb 引用；
// 文件按内容 hash 落盘，天然去重。导出备份时再由前端把这些引用还原成内嵌数据。
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {accessSync} from 'node:fs';
import {mkdir, writeFile, rename, stat, readdir, unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';

export const ASSET_MAX_BYTES = Number(process.env.WORKSTATION_MODEL_MAX_BYTES) || 300 * 1024 * 1024;
const HASH_RE = /^[0-9a-f]{64}$/;
// 媒体与模型共用一个内容寻址库；扩展名只用于服务端 Content-Type 与下载文件名
const EXT_MIME = {
  png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav',
  ogg: 'audio/ogg', m4a: 'audio/mp4', glb: 'model/gltf-binary',
};
const MIME_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a',
  'audio/webm': 'webm', 'model/gltf-binary': 'glb',
};
const root = process.env.JINGCHANG_DATA_DIR
  ? resolve(process.env.JINGCHANG_DATA_DIR, 'model-assets')
  : fileURLToPath(new URL('./.local/model-assets/', import.meta.url));

export const MODEL_ASSET_DIR = root;

const json = (res, data, status = 200) => {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(data));
};

export function assetUrl(hash, ext = 'glb') {
  return mediaAssetUrl(hash, ext);
}

export function modelAssetUrl(hash) {
  return `/api/model-assets/${hash}.glb`;
}

export function mediaAssetUrl(hash, ext) {
  return `/api/assets/${hash}.${ext}`;
}

export function assetPath(hash) {
  return join(root, hash + '.glb');
}

export async function storeModelBuffer(buffer, ext = 'glb') {
  if (!buffer?.length) throw Error('资产内容为空');
  if (!EXT_MIME[ext]) throw Error('不支持的资产类型');
  if (buffer.length > ASSET_MAX_BYTES) throw Error('资产超过本机资产库上限');
  const hash = createHash('sha256').update(buffer).digest('hex');
  const target = join(root, `${hash}.${ext}`);
  await mkdir(root, {recursive: true, mode: 0o700});
  try {
    await accessSync(target, 0);
    return {hash, url: mediaAssetUrl(hash, ext), size: buffer.length, deduped: true};
  } catch {}
  const tmp = target + '.tmp';
  await writeFile(tmp, buffer, {mode: 0o600});
  await rename(tmp, target);
  return {hash, url: mediaAssetUrl(hash, ext), size: buffer.length, deduped: false};
}

export async function storeModelFile(file, ext = 'glb') {
  const buffer = await (await import('node:fs/promises')).readFile(file);
  return storeModelBuffer(buffer, ext);
}

function readBody(req, limit) {
  return new Promise((resolvePromise, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(Error('模型体积超出上限'), {status: 413}));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolvePromise(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function handleModelAssets(req, res, url) {
  const isModelPath = url.pathname === '/api/model-assets' || url.pathname.startsWith('/api/model-assets/');
  const isMediaPath = url.pathname === '/api/assets' || url.pathname.startsWith('/api/assets/');
  if (!isModelPath && !isMediaPath) return false;
  const expected = 'http://' + req.headers.host;
  const sameOrigin = !req.headers.origin || req.headers.origin === expected;
  try {
    if (!sameOrigin) {
      json(res, {error: '仅允许本机软件同源访问'}, 403);
      return true;
    }
    const tail = url.pathname.split('/').filter(Boolean).slice(2); // 去掉 api/<namespace>

    if (req.method === 'POST' && tail.length === 0) {
      if (req.headers.origin && req.headers.origin !== expected) {
        json(res, {error: '仅允许本机软件同源访问'}, 403);
        return true;
      }
      if (!String(req.headers['content-type'] || '').startsWith('application/octet-stream')
        && !MIME_EXT[String(req.headers['content-type'] || '').split(';')[0].trim()]) {
        json(res, {error: '上传内容类型无效'}, 400);
        return true;
      }
      const declared = Number(req.headers['content-length']);
      if (Number.isFinite(declared) && declared > ASSET_MAX_BYTES) {
        json(res, {error: '资产超过本机资产库上限'}, 413);
        return true;
      }
      let buffer;
      try {
        buffer = await readBody(req, ASSET_MAX_BYTES);
      } catch (error) {
        json(res, {error: error.message}, error.status || 400);
        return true;
      }
      // 扩展名：优先看查询参数，其次看 Content-Type；模型端点固定 glb
      const queryType = url.searchParams.get('type');
      const byHeader = MIME_EXT[String(req.headers['content-type'] || '').split(';')[0].trim()];
      let ext = isModelPath ? 'glb' : byHeader || 'bin';
      if (queryType && EXT_MIME[queryType]) ext = queryType;
      if (!EXT_MIME[ext]) {
        json(res, {error: '需要在上传时声明资产类型（image/png、video/mp4 等）'}, 400);
        return true;
      }
      try {
        json(res, await storeModelBuffer(buffer, ext), 201);
      } catch (error) {
        json(res, {error: error.message}, 400);
      }
      return true;
    }

    if (req.method === 'GET' && tail.length === 1) {
      const info = await getModelAsset(tail[0]);
      if (!info) {
        json(res, {error: '资产不存在'}, 404);
        return true;
      }
      res.writeHead(200, {
        'Content-Type': info.mime,
        'Content-Length': info.size,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      createReadStream(info.path).pipe(res);
      return true;
    }

    if (req.method === 'GET' && tail.length === 2 && tail[1] === 'meta') {
      const info = await getModelAsset(tail[0]);
      if (!info) {
        json(res, {error: '资产不存在'}, 404);
        return true;
      }
      json(res, {hash: info.hash, ext: info.ext, size: info.size, mime: info.mime, url: mediaAssetUrl(info.hash, info.ext)});
      return true;
    }

    json(res, {error: '未知的资产库接口'}, 404);
    return true;
  } catch (error) {
    json(res, {error: error.message || '资产库异常'}, 500);
    return true;
  }
}

// 兼容两种文件名：<hash>.<ext> 与裸 hash（历史模型端点：<hash>.glb）
export async function getModelAsset(name) {
  const match = /^([0-9a-f]{64})(?:\.(\w+))?$/.exec(name);
  if (!match) return null;
  const [, hash, explicitExt] = match;
  const ext = explicitExt || 'glb';
  if (!EXT_MIME[ext]) return null;
  const path = join(root, `${hash}.${ext}`);
  try {
    const info = await stat(path);
    if (!info.isFile()) return null;
    return {hash, ext, path, size: info.size, mime: EXT_MIME[ext]};
  } catch {
    return null;
  }
}

export async function modelAssetStats() {
  try {
    const files = (await readdir(root)).filter(f => HASH_RE.test(f.replace(/\.glb$/, '')) && f.endsWith('.glb'));
    let bytes = 0;
    for (const f of files) bytes += (await stat(join(root, f))).size;
    return {count: files.length, bytes, dir: root};
  } catch {
    return {count: 0, bytes: 0, dir: root};
  }
}
