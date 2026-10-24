// Shared reference policy: provider limits, counting and user-facing validation.
// Pure data in/out so the same rules run in the local service and the renderer.

export const REFERENCE_KINDS = Object.freeze(['image', 'video', 'audio']);
export const REFERENCE_COUNT_KEYS = Object.freeze({image: 'images', video: 'videos', audio: 'audios'});
const KIND_NAMES = Object.freeze({image: '图片', video: '视频', audio: '音频'});
const KIND_UNITS = Object.freeze({image: '张', video: '段', audio: '段'});

const count = value => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/** Every provider must declare its own limits; undeclared means “not supported”. */
export function normalizeReferenceLimits(raw = {}) {
  const limits = {
    images: count(raw.images),
    videos: count(raw.videos),
    audios: count(raw.audios),
    total: count(raw.total),
  };
  if (!limits.total) limits.total = limits.images + limits.videos + limits.audios;
  return limits;
}

export function referenceCounts(references = []) {
  const counts = {image: 0, video: 0, audio: 0, total: 0};
  for (const reference of Array.isArray(references) ? references : []) {
    if (!REFERENCE_KINDS.includes(reference?.kind)) continue;
    counts[reference.kind]++;
    counts.total++;
  }
  return counts;
}

export function referenceLimitProblem(references = [], limits = {}) {
  const normalized = normalizeReferenceLimits(limits);
  const counts = referenceCounts(references);
  for (const kind of REFERENCE_KINDS) {
    const max = normalized[REFERENCE_COUNT_KEYS[kind]];
    if (counts[kind] > max) {
      if (!max) return `当前服务商不支持${KIND_NAMES[kind]}参考；请移除该参考或更换服务商。`;
      return `当前服务商最多 ${max} ${KIND_UNITS[kind]}${KIND_NAMES[kind]}参考（已连接 ${counts[kind]} ${KIND_UNITS[kind]}）；请移除多余参考或更换服务商。`;
    }
  }
  if (counts.total > normalized.total) return `当前服务商最多 ${normalized.total} 个参考素材（已连接 ${counts.total} 个）；请移除多余参考或更换服务商。`;
  return '';
}

/** Server-side santisation for reference metadata; media bytes stay in the project. */
export function sanitizeReferenceList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list.slice(0, 50)) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.nodeId !== 'string' || !/^[\w.-]{1,100}$/.test(item.nodeId) || seen.has(item.nodeId)) continue;
    const kind = REFERENCE_KINDS.includes(item.kind) ? item.kind : 'image';
    seen.add(item.nodeId);
    const media = typeof item.url === 'string' && /^https?:\/\//.test(item.url)
      ? {url: item.url.slice(0, 4096)}
      : typeof item.data === 'string' && /^data:(image|video|audio)\//.test(item.data)
        ? {data: item.data.slice(0, 32 * 1024 * 1024)}
        : {};
    out.push({
      nodeId: item.nodeId,
      kind,
      alias: typeof item.alias === 'string' ? item.alias.slice(0, 40) : '',
      title: typeof item.title === 'string' ? item.title.slice(0, 200) : '',
      ...media,
    });
  }
  return out;
}
