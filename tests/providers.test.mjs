import test from 'node:test';
import assert from 'node:assert/strict';
import {ProviderError, normalizeCapabilities, validateProvider} from '../providers/contracts.mjs';
import {createProviderRegistry} from '../providers/registry.mjs';
import {createTaskStore} from '../providers/task-store.mjs';
import {createFakeProvider} from '../providers/fake.mjs';
import {createSeedreamProvider} from '../providers/seedream.mjs';
import {createProviderService} from '../provider-service.mjs';
import {createComfyProvider} from '../providers/comfyui.mjs';
import {createSeedanceProvider} from '../providers/seedance.mjs';
import {createVideoService} from '../video-service.mjs';
import {mkdtemp, rm, readFile, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const makeFake = (options = {}) => createFakeProvider({stepMs: 0, ...options});

test('provider contract validates required methods and normalizes capabilities', () => {
  const fake = makeFake();
  assert.doesNotThrow(() => validateProvider(fake));
  const caps = normalizeCapabilities(fake.capabilities);
  assert.equal(caps.image.textToImage, true);
  assert.equal(caps.video.textToVideo, true);
  assert.deepEqual(caps.image.sizes, ['512x512', '1024x1024']);
  assert.throws(() => validateProvider({...fake, id: 'Bad Id'}), /provider\.id/);
  assert.throws(() => validateProvider({...fake, poll: undefined}), /poll/);
});

test('provider registry registers, describes, filters enabled and rejects duplicates', () => {
  const fake = makeFake();
  const disabled = {...fake, id: 'fake-disabled', enabled: false};
  const registry = createProviderRegistry({providers: [fake, disabled]});
  assert.equal(registry.list().length, 2);
  assert.equal(registry.enabled().length, 1);
  assert.equal(registry.get('fake').id, 'fake');
  assert.throws(() => registry.get('missing'), /unknown provider/);
  assert.throws(() => registry.register(fake), /already registered/);
});

test('task store enforces status transitions and supports snapshot/hydrate', () => {
  let clock = 1000;
  const store = createTaskStore({now: () => clock, idFactory: () => 'task-1'});
  const task = store.create({providerId: 'fake', modelId: 'fake-image', kind: 'image'});
  assert.equal(task.status, 'queued');
  assert.equal(task.createdAt, 1000);
  clock += 10;
  store.update(task.id, {status: 'running', progress: 0.4});
  assert.equal(store.get(task.id).status, 'running');
  assert.equal(store.get(task.id).startedAt, 1010);
  assert.throws(() => store.update(task.id, {status: 'queued'}), /不能从/);
  clock += 10;
  store.update(task.id, {status: 'succeeded', progress: 1, outputs: [{kind: 'image', mime: 'image/png'}]});
  assert.equal(store.get(task.id).progress, 1);
  assert.equal(store.get(task.id).finishedAt, 1020);
  assert.throws(() => store.update('missing', {}), /任务不存在/);

  const snapshot = store.snapshot();
  const restored = createTaskStore();
  restored.hydrate(snapshot);
  assert.equal(restored.size(), 1);
  assert.equal(restored.get(task.id).status, 'succeeded');
  assert.equal(restored.list({status: 'succeeded'}).length, 1);
  assert.equal(restored.list({status: 'running'}).length, 0);
});

test('fake provider runs the full image chain without network', async () => {
  const fake = makeFake();
  const models = await fake.listModels();
  assert.deepEqual(models.map(model => model.id), ['fake-image', 'fake-video']);
  const quote = await fake.quote({kind: 'image', modelId: 'fake-image', prompt: 'a cat'});
  assert.equal(quote.cost, 0);
  assert.equal(quote.kind, 'image');
  const {taskId} = await fake.submit({kind: 'image', modelId: 'fake-image', prompt: 'a cat', projectId: 'p1'});
  const done = await fake.poll(taskId);
  assert.equal(done.status, 'succeeded');
  assert.equal(done.outputs[0].kind, 'image');
  const file = await fake.download(taskId);
  assert.equal(file.mime, 'image/svg+xml');
  assert.ok(file.data.length > 0);
  assert.equal((await fake.health()).ok, true);
  await assert.rejects(() => fake.submit({kind: 'image', modelId: 'fake-video', prompt: 'x'}), /模型类型/);
  await assert.rejects(() => fake.submit({kind: 'image', modelId: 'fake-image', prompt: '   '}), /提示词/);
});

test('fake provider supports video chain and cancel', async () => {
  const fake = makeFake({stepMs: 10000});
  const {taskId} = await fake.submit({kind: 'video', modelId: 'fake-video', prompt: 'rain'});
  const running = await fake.poll(taskId);
  assert.equal(running.status, 'running');
  const cancelled = await fake.cancel(taskId);
  assert.equal(cancelled.status, 'cancelled');
  await assert.rejects(() => fake.download(taskId), /尚未完成/);
});

test('fake provider quote rejects unknown model and unsupported kind', async () => {
  const fake = makeFake();
  await assert.rejects(() => fake.quote({kind: 'image', modelId: 'nope', prompt: 'x'}), /未知模型/);
  await assert.rejects(() => fake.quote({kind: 'video', modelId: 'fake-image', prompt: 'x'}), /模型类型/);
});

test('seedream skeleton is disabled without a key and lists models via injected fetch', async () => {
  const disabled = createSeedreamProvider({apiKey: ''});
  assert.equal(disabled.enabled, false);
  assert.equal((await disabled.health()).ok, false);
  await assert.rejects(() => disabled.listModels(), /API Key/);
  await assert.rejects(() => disabled.quote({modelId: 'doubao-seedream-5-0-flash-260915', prompt: 'x', size: '1024x1024'}), error => error instanceof ProviderError && error.code === 'UNAUTHORIZED');

  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    return new Response(JSON.stringify({data: [
      {id: 'doubao-seedream-5-0-flash-260915', name: 'Seedream 5.0 Flash', status: 'None'},
      {id: 'doubao-seed-1-6-250615', name: 'text', status: 'None'},
    ]}), {status: 200, headers: {'Content-Type': 'application/json'}});
  };
  const provider = createSeedreamProvider({apiKey: 'test-key', fetchImpl});
  assert.equal(provider.enabled, true);
  const models = await provider.listModels();
  assert.equal(models.length, 1);
  assert.equal(models[0].id, 'doubao-seedream-5-0-flash-260915');
  assert.ok(calls[0].url.endsWith('/models'));
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key');

  const unauthorized = createSeedreamProvider({apiKey: 'bad', fetchImpl: async () => new Response('{}', {status: 401})});
  await assert.rejects(() => unauthorized.listModels(), /无效或无权限/);
});


test('seedream adapter quotes, generates, polls and downloads with injected fetch', async () => {
  const calls = [];
  const imageBytes = Buffer.from('fake-jpeg-bytes');
  const fetchImpl = async (url, options = {}) => {
    calls.push({url, options});
    if (String(url).endsWith('/models')) {
      return new Response(JSON.stringify({data: [{id: 'doubao-seedream-5-0-flash-260915', name: 'Seedream Flash', status: 'None'}]}), {status: 200});
    }
    if (String(url).endsWith('/images/generations')) {
      return new Response(JSON.stringify({
        model: 'doubao-seedream-5-0-flash-260915',
        data: [{url: 'https://example.com/out.jpg', size: '1024x1024'}],
      }), {status: 200});
    }
    if (String(url).startsWith('https://example.com/out.jpg')) {
      return new Response(imageBytes, {status: 200, headers: {'Content-Type': 'image/jpeg'}});
    }
    throw new Error('unexpected url ' + url);
  };
  const provider = createSeedreamProvider({apiKey: 'test-key', fetchImpl});
  const models = await provider.listModels();
  assert.equal(models[0].default, true);
  const quote = await provider.quote({modelId: 'doubao-seedream-5-0-flash-260915', prompt: 'rainy cat', size: '1024x1024'});
  assert.equal(quote.cost, null);
  assert.equal(quote.size, '1024x1024');
  const submitted = await provider.submit({quoteId: quote.quoteId, projectId: 'p1'});
  assert.ok(submitted.taskId);
  const done = await provider.poll(submitted.taskId);
  assert.equal(done.status, 'succeeded');
  assert.equal(done.outputs[0].url, 'https://example.com/out.jpg');
  const file = await provider.download(submitted.taskId, 0);
  assert.equal(file.mime, 'image/jpeg');
  assert.deepEqual(file.data, imageBytes);
  const generateCall = calls.find(call => String(call.url).endsWith('/images/generations'));
  assert.equal(JSON.parse(generateCall.options.body).model, 'doubao-seedream-5-0-flash-260915');
  assert.equal(JSON.parse(generateCall.options.body).size, '1024x1024');
});

test('seedream adapter maps model-not-open and quota errors', async () => {
  const quoteFetch = async () => new Response(JSON.stringify({data: [{id: 'doubao-seedream-5-0-flash-260915', name: 'x'}]}), {status: 200});
  const provider = createSeedreamProvider({apiKey: 'k', fetchImpl: quoteFetch});
  const quote = await provider.quote({modelId: 'doubao-seedream-5-0-flash-260915', prompt: 'x', size: '1024x1024'});
  const notOpen = createSeedreamProvider({apiKey: 'k', fetchImpl: async url => String(url).endsWith('/images/generations')
    ? new Response(JSON.stringify({error: {code: 'ModelNotOpen', message: 'not activated'}}), {status: 404})
    : new Response(JSON.stringify({data: [{id: 'doubao-seedream-5-0-flash-260915'}]}), {status: 200})});
  const notOpenQuote = await notOpen.quote({modelId: 'doubao-seedream-5-0-flash-260915', prompt: 'x', size: '1024x1024'});
  await assert.rejects(() => notOpen.submit({quoteId: notOpenQuote.quoteId}), error => error.code === 'MODEL_NOT_OPEN');
  const limited = createSeedreamProvider({apiKey: 'k', fetchImpl: async url => String(url).endsWith('/images/generations')
    ? new Response(JSON.stringify({error: {code: 'SetLimitExceeded', message: 'limit'}}), {status: 429})
    : new Response(JSON.stringify({data: [{id: 'doubao-seedream-5-0-flash-260915'}]}), {status: 200})});
  const limitedQuote = await limited.quote({modelId: 'doubao-seedream-5-0-flash-260915', prompt: 'x', size: '1024x1024'});
  await assert.rejects(() => limited.submit({quoteId: limitedQuote.quoteId}), error => error.code === 'RATE_LIMITED');
  assert.ok(quote.quoteId);
});

test('seedream adapter reports account overdue as PAYMENT_REQUIRED', async () => {
  const provider = createSeedreamProvider({apiKey: 'k', fetchImpl: async url => String(url).endsWith('/images/generations')
    ? new Response(JSON.stringify({error: {code: 'AccountOverdueError', message: 'overdue'}}), {status: 403})
    : new Response(JSON.stringify({data: [{id: 'doubao-seedream-5-0-flash-260915'}]}), {status: 200})});
  const quote = await provider.quote({modelId: 'doubao-seedream-5-0-flash-260915', prompt: 'x', size: '1024x1024'});
  await assert.rejects(() => provider.submit({quoteId: quote.quoteId}), error => error.code === 'PAYMENT_REQUIRED');
});

test('provider service persists a masked config and uses it for models', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'cineweave-provider-'));
  try {
    const fetchImpl = async url => new Response(JSON.stringify({data: [{id: 'doubao-seedream-5-0-flash-260915', name: 'Flash'}]}), {status: 200});
    const service = createProviderService({folder, env: {}, fetchImpl});
    await service.ready();
    assert.equal(service.status().seedream.configured, false);
    assert.equal(service.status().seedream.mode, 'agent-plan');
    await service.configure({apiKey: 'secret-key', mode: 'ark', model: 'doubao-seedream-5-0-flash-260915'});
    assert.equal(service.status().seedream.configured, true);
    assert.equal(service.status().seedream.mode, 'ark');
    assert.equal(JSON.stringify(service.status()).includes('secret-key'), false);
    const raw = await readFile(join(folder, 'providers.json'), 'utf8');
    assert.match(raw, /secret-key/);
    const mode = (await stat(join(folder, 'providers.json'))).mode & 0o777;
    assert.equal(mode, 0o600);
    const models = await service.listModels();
    assert.equal(models.length, 1);
    await service.configure({clear: true});
    assert.equal(service.status().seedream.configured, false);
  } finally {
    await rm(folder, {recursive: true, force: true});
  }
});


test('seedream Agent Plan mode uses plan base URL and static model list', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({url, options});
    if (String(url).endsWith('/images/generations')) {
      return new Response(JSON.stringify({data: [{url: 'https://example.com/plan.jpg', size: '1024x1024'}]}), {status: 200});
    }
    if (String(url).startsWith('https://example.com/')) return new Response(Buffer.from('img'), {status: 200, headers: {'Content-Type': 'image/jpeg'}});
    throw new Error('unexpected ' + url);
  };
  const provider = createSeedreamProvider({apiKey: 'plan-key', planMode: true, fetchImpl});
  const models = await provider.listModels();
  assert.deepEqual(models.map(model => model.id), ['doubao-seedream-5.0-flash', 'doubao-seedream-5.0-pro']);
  const quote = await provider.quote({modelId: 'doubao-seedream-5.0-flash', prompt: 'x', size: '1024x1024'});
  const submitted = await provider.submit({quoteId: quote.quoteId});
  assert.equal(submitted.task.status, 'succeeded');
  assert.ok(calls.some(call => call.url === 'https://ark.cn-beijing.volces.com/api/plan/v3/images/generations'));
  const file = await provider.download(submitted.taskId);
  assert.equal(file.mime, 'image/jpeg');
});


test('comfyui adapter lists checkpoints, submits a workflow, polls and downloads', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({url, options});
    if (String(url).endsWith('/object_info/CheckpointLoaderSimple')) {
      return new Response(JSON.stringify({CheckpointLoaderSimple: {input: {required: {ckpt_name: [['sd_xl_base_1.0.safetensors']]}}}}), {status: 200});
    }
    if (String(url).endsWith('/prompt')) {
      return new Response(JSON.stringify({prompt_id: 'p1'}), {status: 200});
    }
    if (String(url).endsWith('/history/p1')) {
      return new Response(JSON.stringify({p1: {status: {completed: true}, outputs: {9: {images: [{filename: 'cineweave_0001.png', subfolder: '', type: 'output'}]}}}}), {status: 200});
    }
    if (String(url).includes('/view?')) return new Response(Buffer.from('png-bytes'), {status: 200, headers: {'Content-Type': 'image/png'}});
    throw new Error('unexpected ' + url);
  };
  const provider = createComfyProvider({fetchImpl});
  const models = await provider.listModels();
  assert.equal(models[0].id, 'sd_xl_base_1.0.safetensors');
  const quote = await provider.quote({modelId: models[0].id, prompt: 'rainy courtyard', size: '1024x1024'});
  assert.equal(quote.cost, 0);
  const submitted = await provider.submit({quoteId: quote.quoteId});
  assert.equal(submitted.task.status, 'running');
  const done = await provider.poll(submitted.taskId);
  assert.equal(done.status, 'succeeded');
  assert.equal(done.outputs[0].filename, 'cineweave_0001.png');
  const promptCall = calls.find(call => String(call.url).endsWith('/prompt'));
  const sent = JSON.parse(promptCall.options.body);
  assert.equal(sent.prompt[4].inputs.ckpt_name, 'sd_xl_base_1.0.safetensors');
  assert.equal(sent.prompt[6].inputs.text, 'rainy courtyard');
  assert.equal(sent.prompt[5].inputs.width, 1024);
  const file = await provider.download(submitted.taskId, 0);
  assert.equal(file.mime, 'image/png');
  assert.equal(file.data.toString(), 'png-bytes');
});

test('comfyui adapter reports unreachable local service', async () => {
  const provider = createComfyProvider({fetchImpl: async () => { throw new Error('ECONNREFUSED'); }});
  const health = await provider.health();
  assert.equal(health.ok, false);
  assert.match(health.error, /ECONNREFUSED|不可访问/);
});


test('seedance video is feature-flagged and can be exercised with a mock API', async () => {
  const disabled = createSeedanceProvider({apiKey: 'k', enabled: false});
  await assert.rejects(() => disabled.quote({prompt: 'x'}), error => error.code === 'FEATURE_DISABLED');

  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({url, options});
    if (String(url).includes('/contents/generations/tasks') && options.method === 'POST') {
      return new Response(JSON.stringify({id: 'task-1'}), {status: 200});
    }
    if (String(url).includes('/contents/generations/tasks/task-1')) {
      return new Response(JSON.stringify({status: 'succeeded', content: {video_url: 'https://example.com/v.mp4'}, duration: 5}), {status: 200});
    }
    if (String(url).startsWith('https://example.com/v.mp4')) {
      return new Response(Buffer.from('video-bytes'), {status: 200, headers: {'Content-Type': 'video/mp4'}});
    }
    throw new Error('unexpected ' + url);
  };
  const provider = createSeedanceProvider({apiKey: 'k', enabled: true, fetchImpl});
  const quote = await provider.quote({prompt: 'rain', duration: 5, resolution: '720p'});
  const submitted = await provider.submit({quoteId: quote.quoteId});
  assert.ok(submitted.taskId);
  const done = await provider.poll(submitted.taskId);
  assert.equal(done.status, 'succeeded');
  assert.equal(done.outputs[0].url, 'https://example.com/v.mp4');
  const file = await provider.download(submitted.taskId);
  assert.equal(file.mime, 'video/mp4');
  assert.equal(file.data.toString(), 'video-bytes');
  const createCall = calls.find(call => call.options.method === 'POST');
  const body = JSON.parse(createCall.options.body);
  assert.equal(body.duration, 5);
  assert.equal(body.content[0].text, 'rain');
});

test('video service quotes and runs fake video without network', async () => {
  const service = createVideoService({env: {}});
  const providers = service.descriptors();
  assert.ok(providers.some(provider => provider.id === 'fake'));
  assert.ok(providers.some(provider => provider.id === 'seedance' && provider.enabled === false));
  const quote = await service.quote({providerId: 'fake', modelId: 'fake-video', prompt: 'video test', duration: 2});
  assert.equal(quote.cost, 0);
  const submitted = await service.submit({quoteId: quote.quoteId});
  await new Promise(resolve => setTimeout(resolve, 60));
  const done = await service.poll('fake', submitted.taskId);
  assert.equal(done.status, 'succeeded');
  assert.equal(done.outputs[0].kind, 'video');
  const file = await service.download('fake', submitted.taskId, 0);
  assert.equal(file.mime, 'video/mp4');
});
