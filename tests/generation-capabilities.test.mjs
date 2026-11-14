import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCapabilities, getModel, resolveEndpoint, resolveModelMode, validateModelInputs, describeCapabilities } from '../generation/capabilities.mjs';

const capabilities = await loadCapabilities();

test('capabilities registry exposes the current comfy models', () => {
  for (const id of ['h3-ultimate', 'qwen21', 'h3-ref2v', 'h3', 'wan22', 'ltx23', 'framepack']) {
    assert.ok(getModel(capabilities, id), `missing ${id}`);
  }
});

test('explicit 045 endpoint wins over derived port', () => {
  const endpoint = resolveEndpoint(capabilities, 'parallel045', { comfyui: { baseUrl: 'http://192.168.3.27:8188', baseUrl045: 'http://127.0.0.1:9000' } });
  assert.equal(endpoint.url, 'http://127.0.0.1:9000');
  assert.equal(endpoint.configured, true);
});

test('045 endpoint derives 8190 from the main comfy url', () => {
  const endpoint = resolveEndpoint(capabilities, 'parallel045', { comfyui: { baseUrl: 'http://192.168.3.27:8188' } });
  assert.equal(endpoint.url, 'http://192.168.3.27:8190');
  assert.equal(endpoint.source, 'derived');
});

test('unknown endpoint is rejected', () => {
  assert.throws(() => resolveEndpoint(capabilities, 'missing', {}), /unknown endpoint/);
});

test('h3 ultimate mode is inferred from supplied inputs', () => {
  const h3 = getModel(capabilities, 'h3-ultimate');
  assert.equal(resolveModelMode(h3, {}), 't2v');
  assert.equal(resolveModelMode(h3, { firstFrame: true }), 'i2v');
  assert.equal(resolveModelMode(h3, { firstFrame: true, lastFrame: true }), 'flf');
  assert.equal(resolveModelMode(h3, { refImageCount: 2 }), 'r2v');
  assert.equal(resolveModelMode(h3, { sourceVideo: true }), 'extend');
});

test('required inputs are validated before submit', () => {
  const h3 = getModel(capabilities, 'h3-ultimate');
  assert.equal(validateModelInputs(h3, 'flf', { firstFrame: true }).ok, false);
  assert.deepEqual(validateModelInputs(h3, 'flf', { firstFrame: true }).missing, ['lastFrame']);
  assert.equal(validateModelInputs(h3, 'flf', { firstFrame: true, lastFrame: true }).ok, true);
});

test('qwen image modes require an input image except t2i', () => {
  const qwen = getModel(capabilities, 'qwen21');
  assert.equal(validateModelInputs(qwen, 't2i', {}).ok, true);
  assert.equal(validateModelInputs(qwen, 'edit', {}).ok, false);
  assert.equal(validateModelInputs(qwen, 'pose', { image: '/api/generation/assets/x.png' }).ok, true);
});

test('capabilities can be described for the API and UI', () => {
  const described = describeCapabilities(capabilities);
  const h3 = described.find((model) => model.id === 'h3-ultimate');
  assert.equal(h3.label, 'H3 Ultimate');
  assert.equal(h3.endpoint, 'parallel045');
  assert.ok(h3.modes.some((mode) => mode.mode === 'flf'));
  const qwen = described.find((model) => model.id === 'qwen21');
  assert.ok(qwen.modes.some((mode) => mode.mode === 'rmbg'));
});

test('RelayVSR X2 capability is registered on 0.45 with source video requirement', async () => {
  const capabilities = await loadCapabilities();
  const model = getModel(capabilities, 'relayvsr-x2');
  assert.equal(model.endpoint, 'parallel045');
  assert.equal(model.type, 'video');
  assert.equal(model.modes.upscale.workflow, 'relayvsr-x2-upscale');
  assert.deepEqual(model.modes.upscale.requires, ['sourceVideo']);
  const result = validateModelInputs(model, 'upscale', {});
  assert.equal(result.ok, false);
  assert.equal(validateModelInputs(model, 'upscale', { sourceVideo: '/v.mp4' }).ok, true);
});
