// Provider 统一契约：所有生图/生视频厂商都实现这组方法与能力声明。
// 上层只依赖 id / capabilities / 方法，不出现厂商分支。
import {normalizeReferenceLimits} from './reference-policy.mjs';

export const PROVIDER_METHODS = Object.freeze([
  'listModels',
  'quote',
  'submit',
  'poll',
  'cancel',
  'download',
  'health',
]);

export const TASK_STATUSES = Object.freeze(['queued', 'running', 'succeeded', 'failed', 'cancelled']);

export class ProviderError extends Error {
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = 'ProviderError';
    this.code = code;
    this.details = details;
  }
}

export function providerError(code, message, details) {
  return new ProviderError(code, message, details);
}

const bool = value => value === true;
const strings = value => (Array.isArray(value) ? value.filter(item => typeof item === 'string') : []);

/** 把厂商声明的能力补全成稳定结构，UI 只读这个结构。 */
export function normalizeCapabilities(raw = {}) {
  const image = raw.image || {};
  const video = raw.video || {};
  return {
    image: {
      textToImage: bool(image.textToImage),
      imageToImage: bool(image.imageToImage),
      reference: bool(image.reference),
      sizes: strings(image.sizes),
      aspects: strings(image.aspects),
    },
    video: {
      textToVideo: bool(video.textToVideo),
      imageToVideo: bool(video.imageToVideo),
      videoReference: bool(video.videoReference),
      firstLastFrame: bool(video.firstLastFrame),
      referenceLimits: normalizeReferenceLimits(video.referenceLimits),
      durations: Array.isArray(video.durations) ? video.durations.filter(value => Number.isFinite(value) && value > 0) : [],
      resolutions: strings(video.resolutions),
    },
  };
}

export function validateProvider(provider) {
  if (!provider || typeof provider !== 'object') throw new TypeError('provider must be an object');
  if (typeof provider.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(provider.id)) {
    throw new TypeError('provider.id must be lowercase letters, numbers or hyphens (max 40)');
  }
  if (typeof provider.label !== 'string' || !provider.label.trim()) throw new TypeError('provider.label is required');
  if (typeof provider.enabled !== 'boolean') throw new TypeError('provider.enabled must be boolean');
  for (const method of PROVIDER_METHODS) {
    if (typeof provider[method] !== 'function') throw new TypeError(`provider.${method} must be a function`);
  }
  return {
    id: provider.id,
    label: provider.label,
    enabled: provider.enabled,
    capabilities: normalizeCapabilities(provider.capabilities),
  };
}

export function describeProvider(provider) {
  return validateProvider(provider);
}
