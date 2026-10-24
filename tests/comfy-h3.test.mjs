import test from 'node:test';
import assert from 'node:assert/strict';
import {probeComfyH3, H3_MODELS} from '../providers/comfy-h3.mjs';

const response = value => new Response(JSON.stringify(value), {status: 200});

test('H3 probe reports missing models without downloading anything', async () => {
  const fetchImpl = async url => {
    if (String(url).endsWith('/system_stats')) return response({system: {comfyui_version: '0.39.0'}});
    if (String(url).endsWith('/object_info/MiniMaxH3ReferenceToVideo')) return response({MiniMaxH3ReferenceToVideo: {}});
    if (String(url).endsWith('/object_info/UNETLoader')) return response({UNETLoader: {input: {required: {unet_name: [[]]}}}});
    if (String(url).endsWith('/object_info/CLIPLoader')) return response({CLIPLoader: {input: {required: {clip_name: [[]]}}}});
    if (String(url).endsWith('/object_info/VAELoader')) return response({VAELoader: {input: {required: {vae_name: [['pixel_space']]}}}});
    throw new Error('unexpected');
  };
  const status = await probeComfyH3({baseUrl: 'http://127.0.0.1:8188', fetchImpl});
  assert.equal(status.installed, false);
  assert.equal(status.nodeAvailable, true);
  assert.equal(status.missing.length, 4);
  assert.match(status.note, /不会自动下载/);
});

test('H3 probe becomes available when node and models exist', async () => {
  const fetchImpl = async url => {
    if (String(url).endsWith('/system_stats')) return response({system: {comfyui_version: '0.39.0'}});
    if (String(url).endsWith('/object_info/MiniMaxH3ReferenceToVideo')) return response({MiniMaxH3ReferenceToVideo: {}});
    if (String(url).endsWith('/object_info/UNETLoader')) return response({UNETLoader: {input: {required: {unet_name: [[H3_MODELS.unet]]}}}});
    if (String(url).endsWith('/object_info/CLIPLoader')) return response({CLIPLoader: {input: {required: {clip_name: [[H3_MODELS.clip]]}}}});
    if (String(url).endsWith('/object_info/VAELoader')) return response({VAELoader: {input: {required: {vae_name: [[H3_MODELS.videoVae, H3_MODELS.audioVae]]}}}});
    throw new Error('unexpected');
  };
  const status = await probeComfyH3({baseUrl: 'http://127.0.0.1:8188', fetchImpl});
  assert.equal(status.installed, true);
  assert.equal(status.missing.length, 0);
});
