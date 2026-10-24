import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGenerationHistory,generationHistoryAction,generationHistoryPollTargets,generationStatusLabel,generationProviderLabel} from '../src/generation-history.mjs';

const imageTask = (id, status, extra = {}) => ({id, kind: 'image', status, prompt: 'prompt ' + id, createdAt: 10, ...extra});

test('history merges provider, ComfyUI and video tasks with provider/status labels', () => {
  const rows = buildGenerationHistory({
    providerTasks: [imageTask('p1', 'succeeded', {providerId: 'seedream'})],
    comfyTasks: [imageTask('c1', 'running', {progress: .4})],
    videoTasks: [{id: 'v1', kind: 'video', status: 'queued', providerId: 'fake', prompt: 'video', createdAt: 3}],
  }, {mode: 'image'});
  assert.deepEqual(rows.map(row => row.id), ['c1', 'p1']);
  assert.equal(rows[0].providerLabel, 'ComfyUI（本地）');
  assert.equal(rows[0].statusLabel, '生成中 40%');
  assert.equal(rows[1].providerLabel, 'Seedream（云端）');
  assert.equal(rows[1].statusLabel, '已完成');
  const video = buildGenerationHistory({videoTasks: [{id: 'v1', kind: 'video', status: 'queued', providerId: 'fake', prompt: 'video', createdAt: 3}]}, {mode: 'video'});
  assert.equal(video.length, 1);
  assert.equal(video[0].providerLabel, 'Fake（本地测试）');
  assert.equal(video[0].statusLabel, '排队中');
  assert.equal(video[0].promptSummary, 'video');
});

test('history keeps the latest copy of a task and lists active work before finished work', () => {
  const rows = buildGenerationHistory({
    comfyTasks: [
      imageTask('same', 'running', {progress: .2, updatedAt: 5}),
      imageTask('same', 'succeeded', {updatedAt: 9}),
      imageTask('old-done', 'succeeded', {createdAt: 100}),
      imageTask('old-running', 'running', {createdAt: 1}),
    ],
  }, {mode: 'image'});
  assert.deepEqual(rows.map(row => row.id), ['old-running', 'old-done', 'same']);
  const done = rows.find(row => row.id === 'old-done');
  assert.equal(done.status, 'succeeded');
  assert.equal(done.active, false);
  assert.equal(buildGenerationHistory({comfyTasks: [imageTask('same', 'running', {updatedAt: 5}), imageTask('same', 'succeeded', {updatedAt: 9})]}, {mode: 'image'})[0].status, 'succeeded');
});

test('failed history rows expose the provider reason and only finished successes offer recovery', () => {
  const rows = buildGenerationHistory({
    comfyTasks: [
      imageTask('failed', 'failed', {error: {message: '显存不足，请降低分辨率'}}),
      imageTask('done', 'succeeded'),
      imageTask('running', 'running', {progress: .1}),
    ],
  }, {mode: 'image'});
  assert.equal(rows.find(row => row.id === 'failed').errorText, '显存不足，请降低分辨率');
  assert.deepEqual(generationHistoryAction(rows.find(row => row.id === 'failed')), {kind: 'none', label: ''});
  assert.deepEqual(generationHistoryAction(rows.find(row => row.id === 'running')), {kind: 'refresh', label: '刷新状态'});
  assert.deepEqual(generationHistoryAction(rows.find(row => row.id === 'done')), {kind: 'recover', label: '加入画布'});
  assert.deepEqual(generationHistoryAction(rows.find(row => row.id === 'done'), {added: true}), {kind: 'none', label: '已在画布'});
});

test('history poll targets only include queued/running tasks with usable ids', () => {
  const rows = buildGenerationHistory({
    providerTasks: [imageTask('p-running', 'running', {providerId: 'seedream'})],
    comfyTasks: [imageTask('c-queued', 'queued'), imageTask('c-done', 'succeeded')],
  }, {mode: 'image'});
  assert.deepEqual(generationHistoryPollTargets(rows), [{id: 'c-queued', providerId: 'comfyui'}, {id: 'p-running', providerId: 'seedream'}]);
  assert.deepEqual(generationHistoryPollTargets([{id: '', providerId: 'comfyui', active: true}]), []);
});

test('history limit keeps active tasks ahead of older finished work', () => {
  const comfyTasks = [imageTask('active-old', 'running', {createdAt: 1}), ...Array.from({length: 12}, (_, i) => imageTask('done' + i, 'succeeded', {createdAt: 100 + i}))];
  const rows = buildGenerationHistory({comfyTasks}, {mode: 'image', limit: 10});
  assert.equal(rows.length, 10);
  assert.equal(rows[0].id, 'active-old');
  assert.equal(rows[0].active, true);
});

test('status labels cover queued, cancelled, unknown and running without progress', () => {
  assert.equal(generationStatusLabel('queued'), '排队中');
  assert.equal(generationStatusLabel('running'), '生成中');
  assert.equal(generationStatusLabel('running', .455), '生成中 46%');
  assert.equal(generationStatusLabel('cancelled'), '已取消');
  assert.equal(generationStatusLabel('unknown'), '状态待确认');
  assert.equal(generationProviderLabel('seedance'), 'Seedance');
  assert.equal(generationProviderLabel('other'), 'other');
});
