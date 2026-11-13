import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, buildImageBody, buildVideoBody, main } from '../cli/zaomeng-cli.mjs';

test('parses flags, inline values and positionals', () => {
  const { positional, flags } = parseArgs(['job', 'abc', '--wait', '--limit=5', '--url', 'http://x']);
  assert.deepEqual(positional, ['job', 'abc']);
  assert.equal(flags.wait, true);
  assert.equal(flags.limit, '5');
  assert.equal(flags.url, 'http://x');
});

test('builds image/video request bodies', () => {
  const image = buildImageBody({ prompt: '猫', workflow: 'qwen21-t2i', width: '768', image: '/in.png' });
  assert.equal(image.kind, 'comfyui-image');
  assert.equal(image.width, 768);
  assert.equal(image.imageUrl, '/in.png');
  const video = buildVideoBody({ prompt: '雨夜', model: 'h3-ultimate', 'first-frame': '/f.png', 'ref-image': '/a.png,/b.png', duration: '6' });
  assert.equal(video.kind, 'comfyui-video');
  assert.equal(video.firstFrameUrl, '/f.png');
  assert.equal(video.refImages.length, 2);
  assert.equal(video.duration, 6);
});

test('health command prints JSON and uses --url', async () => {
  let url = '';
  const output = [];
  await main(['health', '--url', 'http://example.test'], {
    fetchImpl: async (next) => { url = next; return { ok: true, json: async () => ({ ok: true }) }; },
    stdout: (text) => output.push(text),
    stderr: () => {},
  });
  assert.equal(url, 'http://example.test/api/health');
  assert.match(output.join('\n'), /"ok":true/);
});
