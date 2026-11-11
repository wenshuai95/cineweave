import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCutSegments, toBase64, startCut, waitForCut, fetchCutBlob} from '../src/pipeline/cut-jobs.mjs';

test('segments are collected in shot order and encoded as base64', async () => {
  const project = {
    shots: [
      {id: 's2', start: 3, end: 6, render: {videoMediaId: 'm2'}},
      {id: 's1', start: 0, end: 3, render: {videoMediaId: 'm1'}},
      {id: 's3', start: 6, end: 9},
    ],
  };
  const blobs = {m1: new Blob(['aaa']), m2: new Blob(['bbb'])};
  const segments = await collectCutSegments(project, async id => blobs[id]);
  assert.equal(segments.length, 2);
  assert.match(segments[0].data, /^data:video\/mp4;base64,/);
  assert.equal(toBase64(new TextEncoder().encode('aa').buffer), 'YWE=');
  await assert.rejects(collectCutSegments({shots: [{id: 'x', start: 0, end: 1, render: {videoMediaId: 'gone'}}]}, async () => null), /缺失/);
});

test('cut client submits, polls and downloads the final video', async () => {
  let polls = 0;
  const fakeFetch = async (url, options = {}) => {
    if (url === '/api/cut/jobs') {
      const body = JSON.parse(options.body);
      assert.equal(body.segments.length, 2);
      assert.equal(body.width, 1280);
      return {ok: true, json: async () => ({id: 'c1', status: 'queued'})};
    }
    if (url === '/api/cut/jobs/c1') {
      polls += 1;
      return {ok: true, json: async () => polls < 2 ? {status: 'running', message: '合成中'} : {status: 'done', message: '完成'}};
    }
    if (url === '/api/cut/jobs/c1/file') return {ok: true, blob: async () => new Blob(['mp4'])};
    throw Error('unexpected ' + url);
  };
  const job = await startCut({segments: [{data: 'x'}, {data: 'y'}], fetchImpl: fakeFetch});
  const done = await waitForCut(job.id, {fetchImpl: fakeFetch, interval: 1});
  assert.equal(done.status, 'done');
  const blob = await fetchCutBlob(done.id, {fetchImpl: fakeFetch});
  assert.equal(blob.size, 3);
});
