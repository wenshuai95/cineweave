import {randomUUID} from 'node:crypto';
import {ProviderError} from './contracts.mjs';
import {createTaskStore} from './task-store.mjs';

const IMAGE_BYTES = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#1f2933"/><circle cx="256" cy="256" r="120" fill="#e4b575"/></svg>',
  'utf8',
);
const VIDEO_BYTES = Buffer.from('fake-video-placeholder', 'utf8');

const MODELS = Object.freeze([
  {id: 'fake-image', name: 'Fake Image', kind: 'image'},
  {id: 'fake-video', name: 'Fake Video', kind: 'video'},
]);

/**
 * 本地假提供商：不联网、不花钱，用于 UI 全链路和契约测试。
 * 输出是占位的 SVG/MP4 字节，正式功能由真实 Provider 提供。
 */
export function createFakeProvider({now = Date.now, stepMs = 40, store = createTaskStore({now}), idFactory = randomUUID} = {}) {
  const quotes = new Map();
  const models = MODELS;

  const findModel = id => models.find(model => model.id === id);
  const requirePrompt = prompt => {
    if (typeof prompt !== 'string' || !prompt.trim()) throw new ProviderError('INVALID_INPUT', '提示词不能为空');
    if (prompt.length > 6000) throw new ProviderError('INVALID_INPUT', '提示词不能超过 6000 字符');
  };
  const taskOrThrow = id => {
    const task = store.get(id);
    if (!task) throw new ProviderError('TASK_NOT_FOUND', `任务不存在：${id}`);
    return task;
  };
  const outputFor = task => task.kind === 'video'
    ? {index: 0, kind: 'video', mime: 'video/mp4', filename: `fake-${task.id}.mp4`, duration: 2}
    : {index: 0, kind: 'image', mime: 'image/svg+xml', filename: `fake-${task.id}.svg`, width: 512, height: 512};

  return {
    id: 'fake',
    label: 'Fake（本地测试）',
    enabled: true,
    capabilities: {
      image: {textToImage: true, imageToImage: true, reference: true, sizes: ['512x512', '1024x1024'], aspects: ['1:1', '16:9']},
      video: {textToVideo: true, imageToVideo: true, videoReference: true, firstLastFrame: false, durations: [2, 4], resolutions: ['512x512'], referenceLimits: {images: 2, videos: 1, audios: 1, total: 4}},
    },
    async listModels() {
      return models.map(model => ({...model}));
    },
    async quote(input = {}) {
      const model = findModel(input.modelId);
      if (!model) throw new ProviderError('MODEL_NOT_FOUND', `未知模型：${input.modelId}`);
      if (model.kind !== (input.kind === 'video' ? 'video' : 'image')) throw new ProviderError('MODEL_KIND_MISMATCH', '模型类型与任务类型不一致');
      requirePrompt(input.prompt);
      const quoteId = idFactory();
      quotes.set(quoteId, {modelId: model.id, kind: model.kind, expiresAt: now() + 10 * 60 * 1000});
      return {quoteId, providerId: 'fake', modelId: model.id, kind: model.kind, cost: 0, currency: 'credits', estimatedMs: stepMs};
    },
    async submit(input = {}) {
      const model = findModel(input.modelId);
      if (!model) throw new ProviderError('MODEL_NOT_FOUND', `未知模型：${input.modelId}`);
      if (model.kind !== (input.kind === 'video' ? 'video' : 'image')) throw new ProviderError('MODEL_KIND_MISMATCH', '模型类型与任务类型不一致');
      requirePrompt(input.prompt);
      const task = store.create({
        providerId: 'fake',
        modelId: model.id,
        kind: model.kind,
        projectId: input.projectId,
        sourceId: input.sourceId,
        prompt: input.prompt,
        references: Array.isArray(input.references) ? input.references : [],
      });
      store.update(task.id, {status: 'running', progress: 0.1});
      return {taskId: task.id};
    },
    async poll(taskId) {
      let task = taskOrThrow(taskId);
      if (task.status === 'running' && now() - (task.startedAt || task.createdAt) >= stepMs) {
        task = store.update(taskId, {status: 'succeeded', progress: 1, outputs: [outputFor(task)]});
      }
      return task;
    },
    async cancel(taskId) {
      const task = taskOrThrow(taskId);
      if (['queued', 'running'].includes(task.status)) return store.update(taskId, {status: 'cancelled', progress: 0});
      return task;
    },
    async download(taskId, index = 0) {
      const task = taskOrThrow(taskId);
      if (task.status !== 'succeeded') throw new ProviderError('TASK_NOT_READY', '任务尚未完成');
      const output = task.outputs[index];
      if (!output) throw new ProviderError('OUTPUT_NOT_FOUND', `没有第 ${index} 个输出`);
      return {
        mime: output.mime,
        filename: output.filename,
        data: task.kind === 'video' ? Buffer.from(VIDEO_BYTES) : Buffer.from(IMAGE_BYTES),
      };
    },
    async health() {
      return {ok: true, providerId: 'fake', configured: true};
    },
  };
}
