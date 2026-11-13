import test from 'node:test';
import assert from 'node:assert/strict';
import { jobsListHtml, jobStatusLabel } from '../src/canvas/job-view.mjs';

test('job status labels cover all states', () => {
  assert.equal(jobStatusLabel({ status: 'success' }), '完成');
  assert.equal(jobStatusLabel({ status: 'failed' }), '失败');
  assert.equal(jobStatusLabel({ status: 'canceled' }), '已取消');
  assert.equal(jobStatusLabel({ status: 'queued' }), '排队中');
  assert.equal(jobStatusLabel({ status: 'running' }), '运行中');
});

test('running jobs show cancel, failed comfy jobs show retry', () => {
  const running = jobsListHtml([{ id: 'a', status: 'running', progress: 30, stage: 'sampling', meta: { model: 'h3' } }]);
  assert.match(running, /data-job-cancel/);
  assert.match(running, /30%/);
  assert.match(running, /H3|h3/);
  const failed = jobsListHtml([{ id: 'b', status: 'failed', message: 'OOM', meta: { request: { kind: 'x' } } }]);
  assert.match(failed, /data-job-retry/);
  assert.match(failed, /失败/);
});

test('empty and escaping', () => {
  assert.match(jobsListHtml([]), /还没有生成任务/);
  const html = jobsListHtml([{ id: '<x>', status: 'failed', message: '<oom>', meta: {} }]);
  assert.match(html, /&lt;x&gt;/);
  assert.match(html, /&lt;oom&gt;/);
});
