import test from 'node:test';
import assert from 'node:assert/strict';
import {demoProject, validateProject} from '../src/model.mjs';
import {projectAssets, applyAssetProposal, extractAssetsPrompt, assetImagePrompt, assetsByKind, assetKindLabel} from '../src/pipeline/assets.mjs';
import {imageModels, quoteImage, generateImage, waitForImage, fetchImageBlob} from '../src/pipeline/image-jobs.mjs';

function project() {
  const p = demoProject();
  p.workstation = p.workstation || {};
  return p;
}

test('asset designs merge into the project and stay valid', () => {
  const p = project();
  assert.equal(projectAssets(p).length, 0);
  const count = applyAssetProposal(p, [
    {kind: 'character', name: '女修', description: '受伤的女修', prompt: '古装女修，白衣染血，低饱和'},
    {kind: 'scene', name: '林间空地', description: '雨后树林', prompt: '深山树林，雨后，薄雾'},
  ]);
  assert.equal(count, 2);
  assert.equal(projectAssets(p).length, 2);
  assert.equal(assetKindLabel('character'), '角色');
  const groups = assetsByKind(projectAssets(p));
  assert.equal(groups.character.length, 1);
  assert.equal(groups.scene.length, 1);
  validateProject(p);
});

test('asset prompts fall back to name and description', () => {
  assert.equal(assetImagePrompt({prompt: '古装女修', name: '女修', description: 'x'}), '古装女修');
  assert.equal(assetImagePrompt({name: '女修', description: '白衣染血'}), '女修，白衣染血');
  assert.equal(assetImagePrompt({}), '');
});

test('extract prompt includes shot descriptions', () => {
  const p = project();
  p.shots = [{id: 's1', cameraId: p.objects.find(o => o.type === 'camera').id, start: 0, end: 3}];
  p.nodes = [{id: 'n1', type: 'text', title: '镜 01', text: '女修坠林', storyRef: {kind: 'shot', id: 's1'}, x: 0, y: 0, w: 200, h: 100}];
  const prompt = extractAssetsPrompt(p);
  assert.match(prompt, /女修坠林/);
  assert.match(prompt, /只输出 JSON/);
});

test('image job client quotes, submits, polls and downloads', async () => {
  const calls = [];
  let polls = 0;
  const fakeFetch = async (url, options = {}) => {
    calls.push([url, options.method || 'GET']);
    if (url === '/api/ai/text/status') return {ok: true, json: async () => ({token: 'tok'})};
    if (url === '/api/oiioii/models') return {ok: true, json: async () => ({models: [{id: 'm1', sizes: ['1024x1024'], aspects: ['16:9']}]})};
    if (url === '/api/oiioii/quote') { assert.equal(options.headers['X-Jingchang-Token'], 'tok'); return {ok: true, json: async () => ({quoteId: 'q1', points: 12, sufficient: true})}; }
    if (url === '/api/oiioii/generate') return {ok: true, json: async () => ({id: 'job1', status: 'pending'})};
    if (url === '/api/oiioii/task/job1') {
      polls += 1;
      return {ok: true, json: async () => polls < 2 ? {status: 'running'} : {status: 'succeeded', imageUrl: '/api/oiioii/image/job1'}};
    }
    if (url === '/api/oiioii/image/job1') return {ok: true, blob: async () => new Blob(['png']), headers: new Headers()};
    throw Error('unexpected ' + url);
  };
  const models = await imageModels({fetchImpl: fakeFetch});
  assert.equal(models[0].id, 'm1');
  const quote = await quoteImage({modelId: 'm1', fetchImpl: fakeFetch});
  assert.equal(quote.points, 12);
  const job = await generateImage({quoteId: quote.quoteId, prompt: '古装女修', fetchImpl: fakeFetch});
  const done = await waitForImage(job.id, {fetchImpl: fakeFetch, interval: 1});
  assert.equal(done.status, 'succeeded');
  const blob = await fetchImageBlob(done.imageUrl, {fetchImpl: fakeFetch});
  assert.equal(blob.size, 3);
  assert.deepEqual(calls.slice(-2), [['/api/oiioii/task/job1', 'GET'], ['/api/oiioii/image/job1', 'GET']]);
});

test('image job client surfaces failures instead of hanging', async () => {
  const fakeFetch = async url => {
    if (url === '/api/ai/text/status') return {ok: true, json: async () => ({token: 't'})};
    if (url.startsWith('/api/oiioii/task/')) return {ok: true, json: async () => ({status: 'failed', message: '平台拒绝'})};
    throw Error('unexpected');
  };
  await assert.rejects(waitForImage('x', {fetchImpl: fakeFetch, interval: 1}), /平台拒绝/);
});
