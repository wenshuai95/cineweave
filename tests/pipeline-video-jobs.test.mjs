import test from 'node:test';
import assert from 'node:assert/strict';
import {videoModels, pickVideoModel, quoteVideo, generateVideo, waitForVideo, fetchVideoBlob, shotVideoPrompt} from '../src/pipeline/video-jobs.mjs';

test('video model picks a text-to-video model and nearest allowed duration', async () => {
  const models = [
    {id: 'i2v', name: '图生视频', promptOnly: false, durations: ['5'], aspects: ['16:9'], sizes: []},
    {id: 't2v', name: '文生视频', promptOnly: true, durations: ['4-6', '8-12'], aspects: ['16:9', '9:16'], sizes: ['720p']},
  ];
  const picked = pickVideoModel(models, 5.2);
  assert.equal(picked.model.id, 't2v');
  assert.equal(picked.duration, 5);
  assert.equal(picked.aspect, '16:9');
  assert.equal(picked.resolution, '720p');
  assert.equal(pickVideoModel([{id: 'i2v', promptOnly: false}], 5), null);
});

test('video job client quotes, submits and polls with progress', async () => {
  let polls = 0;
  const fakeFetch = async (url, options = {}) => {
    if (url === '/api/ai/text/status') return {ok: true, json: async () => ({token: 'tok'})};
    if (url === '/api/oiioii/video/models') return {ok: true, json: async () => ({models: [{id: 't2v', promptOnly: true, durations: ['5'], aspects: ['16:9']}]})};
    if (url === '/api/oiioii/video/quote') {
      assert.equal(options.headers['X-Jingchang-Token'], 'tok');
      const body = JSON.parse(options.body);
      assert.equal(body.projectId, 'p1');
      assert.deepEqual(body.references, []);
      return {ok: true, json: async () => ({quoteId: 'q1', points: 30, sufficient: true})};
    }
    if (url === '/api/oiioii/video/generate') return {ok: true, json: async () => ({id: 'v1', status: 'submitting'})};
    if (url === '/api/oiioii/video/task/v1') {
      polls += 1;
      return {ok: true, json: async () => polls < 2 ? {status: 'pending', phase: 'generating'} : {status: 'succeeded', id: 'v1'}};
    }
    if (url === '/api/oiioii/video/file/v1') return {ok: true, blob: async () => new Blob(['mp4'])};
    throw Error('unexpected ' + url);
  };
  const models = await videoModels({fetchImpl: fakeFetch});
  assert.equal(models[0].id, 't2v');
  const quote = await quoteVideo({projectId: 'p1', prompt: 'x', modelId: 't2v', duration: 5, fetchImpl: fakeFetch});
  assert.equal(quote.points, 30);
  const job = await generateVideo({quoteId: quote.quoteId, fetchImpl: fakeFetch});
  const progress = [];
  const done = await waitForVideo(job.id, {fetchImpl: fakeFetch, interval: 1, onProgress: value => progress.push(value.status)});
  assert.equal(done.status, 'succeeded');
  assert.deepEqual(progress, ['pending', 'succeeded']);
  const blob = await fetchVideoBlob('v1', {fetchImpl: fakeFetch});
  assert.equal(blob.size, 3);
});

test('video client surfaces failure instead of hanging', async () => {
  const fakeFetch = async url => {
    if (url === '/api/ai/text/status') return {ok: true, json: async () => ({token: 't'})};
    if (url.startsWith('/api/oiioii/video/task/')) return {ok: true, json: async () => ({status: 'failed', message: '平台失败'})};
    throw Error('unexpected');
  };
  await assert.rejects(waitForVideo('x', {fetchImpl: fakeFetch, interval: 1}), /平台失败/);
});

test('shot prompt includes description and asset prompts', () => {
  const project = {
    shots: [{id: 's1', cameraId: 'c', start: 0, end: 3}, {id: 's2', cameraId: 'c', start: 3, end: 6}],
    nodes: [{type: 'text', storyRef: {kind: 'shot', id: 's2'}, text: '女修抬头，玉印压下'}],
  };
  const assets = [{prompt: '古装女修，白衣染血', shotIds: ['s2']}];
  const prompt = shotVideoPrompt(project, project.shots[1], assets);
  assert.match(prompt, /镜 2/);
  assert.match(prompt, /玉印压下/);
  assert.match(prompt, /白衣染血/);
});
