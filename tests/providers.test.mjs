import test from 'node:test';
import assert from 'node:assert/strict';
import {ProviderError, normalizeCapabilities, validateProvider} from '../providers/contracts.mjs';
import {createProviderRegistry} from '../providers/registry.mjs';
import {createTaskStore} from '../providers/task-store.mjs';
import {createFakeProvider} from '../providers/fake.mjs';
import {createSeedreamProvider} from '../providers/seedream.mjs';

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
  await assert.rejects(() => disabled.quote({}), error => error instanceof ProviderError && error.code === 'NOT_IMPLEMENTED');

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
