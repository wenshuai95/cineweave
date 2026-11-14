import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModelOptions, IMAGE_PRESETS } from '../src/canvas/generation-options.mjs';

test('comfy image options include Qwen modes and image presets', () => {
  const options = buildModelOptions({ type: 'image', provider: 'comfyui' });
  assert.ok(options.some((option) => option.patch.imageWorkflow === 'qwen21-edit'));
  assert.ok(options.some((option) => option.patch.imageWorkflow === 'zimage-turbo'));
  assert.ok(IMAGE_PRESETS['人物三视图']);
  for (const option of options) assert.ok(option.label && option.key);
});

test('comfy video options include H3 Ultimate and Ref2VA', () => {
  const options = buildModelOptions({ type: 'video', provider: 'comfyui' });
  assert.ok(options.some((option) => option.patch.model === 'h3-ultimate'));
  assert.ok(options.some((option) => option.patch.model === 'h3-ref2v'));
  assert.ok(options.some((option) => option.patch.model === 'framepack'));
});

test('dreamina options use the live catalog when present', () => {
  const options = buildModelOptions({
    type: 'video',
    provider: 'dreamina',
    dreaminaCatalog: { video: [{ model: 'seedance_2.5', displayName: 'Seedance 2.5' }] },
  });
  assert.deepEqual(options, [{ label: 'Seedance 2.5', key: 'video:dreamina:seedance_2.5', patch: { model: 'seedance_2.5' } }]);
});

test('dreamina fallback is used when the catalog is empty', () => {
  const options = buildModelOptions({ type: 'image', provider: 'dreamina', dreaminaCatalog: {} });
  assert.equal(options[0].patch.model, 'high_aes_general_v50_flash');
});
