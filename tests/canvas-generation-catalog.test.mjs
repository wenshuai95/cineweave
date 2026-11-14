import test from 'node:test';
import assert from 'node:assert/strict';
import {
  modelDefaultsKey, pickSavedParams, estimateForModel, missingH3Sections,
  promptTemplateFor, requiresH3Sections, qwenModeNeedsImage, H3_SECTIONS,
} from '../src/canvas/generation-catalog.mjs';

test('model defaults key separates type, provider and model/workflow', () => {
  assert.equal(modelDefaultsKey({ type: 'video', provider: 'comfyui', model: 'h3-ultimate' }), 'video:comfyui:h3-ultimate');
  assert.equal(modelDefaultsKey({ type: 'image', provider: 'comfyui', workflow: 'qwen21-edit' }), 'image:comfyui:qwen21-edit');
  assert.equal(modelDefaultsKey({ type: 'image', provider: 'dreamina', model: 'seedream_4.1' }), 'image:dreamina:seedream_4.1');
});

test('saved params keep only generation fields', () => {
  assert.deepEqual(pickSavedParams({ resolution: '2K', ratio: '16:9', junk: 1, durationSeconds: 5 }), { resolution: '2K', ratio: '16:9', durationSeconds: 5 });
  assert.deepEqual(pickSavedParams(null), {});
});

test('estimates resolve for known models and are empty for unknown', () => {
  assert.match(estimateForModel('video:comfyui:h3-ultimate'), /28G/);
  assert.match(estimateForModel('image:comfyui:qwen21-depth'), /11G/);
  assert.equal(estimateForModel('video:comfyui:unknown'), '');
});

test('H3 six-section detection reports missing sections', () => {
  const complete = H3_SECTIONS.map((key) => `${key}: x`).join('\n');
  assert.deepEqual(missingH3Sections(complete), []);
  assert.deepEqual(missingH3Sections('summary: x'), H3_SECTIONS.filter((key) => key !== 'summary'));
  assert.equal(requiresH3Sections('h3-ultimate'), true);
  assert.equal(requiresH3Sections('h3'), false);
});

test('prompt templates follow the selected model/mode', () => {
  assert.match(promptTemplateFor({ type: 'video', model: 'h3-ultimate' }).text, /subject_definitions/);
  assert.match(promptTemplateFor({ type: 'image', workflow: 'qwen21-edit' }).text, /保留人物身份/);
  assert.equal(promptTemplateFor({ type: 'audio' }).label, '音频描述模板');
  assert.equal(qwenModeNeedsImage('qwen21-depth'), true);
  assert.equal(qwenModeNeedsImage('qwen21-t2i'), false);
});
