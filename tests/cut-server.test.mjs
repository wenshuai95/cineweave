import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

test('cut request validation rejects empty, oversized and invalid segments', async () => {
  const {validateCutRequest} = await import('../cut-server.mjs');
  assert.equal(validateCutRequest({segments: [{data: 'data:video/mp4;base64,' + 'A'.repeat(200)}]}), null);
  assert.match(validateCutRequest({segments: []}), /至少/);
  assert.match(validateCutRequest({segments: [{data: 'nope'}]}), /无效/);
  assert.match(validateCutRequest({segments: [{data: 'A'.repeat(200)}], width: 10}), /宽度/);
  assert.match(validateCutRequest({segments: [{data: 'A'.repeat(200)}], fps: 60}), /帧率/);
});

test('cut job concatenates segments through ffmpeg and serves a file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jingchang-cut-'));
  process.env.JINGCHANG_DATA_DIR = dir;
  process.env.CUT_FFMPEG = resolve('tests/fixtures/mock-ffmpeg.mjs');
  const module = await import('../cut-server.mjs?test=1');
  const segment = 'data:video/mp4;base64,' + Buffer.from('x'.repeat(2048)).toString('base64');
  const {job: created} = module.startCutJob({segments: [{data: segment}, {data: segment}], width: 640, height: 360});
  assert.ok(created.id);
  let job = created;
  for (let i = 0; i < 100 && !['done', 'error'].includes(job.status); i++) {
    await new Promise(r => setTimeout(r, 60));
    job = module.publicCutJob(module.getCutJob(created.id));
  }
  assert.equal(job.status, 'done', job.message);
  const info = await stat(join(dir, 'cut', created.id, 'final.mp4'));
  assert.ok(info.size > 0);
  await rm(dir, {recursive: true, force: true});
});
