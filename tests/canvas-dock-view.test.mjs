import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDockViewModel } from '../src/canvas/dock-view.mjs';

test('comfy video h3 ultimate shows resolution and estimate', () => {
  const view = buildDockViewModel({
    node: { type: 'video', title: '镜头', status: 'success', generation: { mode: 't2v', model: 'h3-ultimate', backend: { provider: 'comfyui' }, durationSeconds: 5, outputCount: 1 } },
    modelLabel: 'H3 Ultimate',
    estimate: '约 2–3 分钟',
  });
  assert.equal(view.open, true);
  assert.match(view.resText, /640×352/);
  assert.match(view.costText, /H3 Ultimate/);
  assert.match(view.costText, /约 2–3 分钟/);
  assert.equal(view.showDuration, true);
});

test('dreamina image uses quote cost and hides ref mode', () => {
  const view = buildDockViewModel({
    node: { type: 'image', status: 'empty', generation: { mode: 't2i', backend: { provider: 'dreamina' }, resolution: '2K', outputCount: 1 } },
    modelLabel: 'Seedream 5.0 Flash',
  });
  assert.match(view.costText, /报价后确认扣积分/);
  assert.equal(view.showRef, false);
  assert.equal(view.showDuration, false);
});

test('comfy image with refs shows ControlNet label and CJK warning', () => {
  const view = buildDockViewModel({
    node: { type: 'image', status: 'empty', generation: { mode: 'i2i', backend: { provider: 'comfyui' }, refMode: 'depth', resolution: '1024 高清', outputCount: 1 } },
    modelLabel: 'Flux',
    hasImageRefs: true,
    promptHasCJK: true,
  });
  assert.equal(view.showRef, true);
  assert.match(view.refText, /ControlNet 深度/);
  assert.equal(view.costWarn, true);
});

test('node without generation hides generation pills', () => {
  const view = buildDockViewModel({ node: { type: 'text', title: '文本', status: 'empty' } });
  assert.equal(view.showModel, false);
  assert.match(view.costText, /文本节点/);
  assert.equal(view.sendDisabled, true);
});
