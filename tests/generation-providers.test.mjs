import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createComfyUIProvider, applyInputMapping, collectOutputs } from '../generation/providers/comfyui.mjs';
import { createDreaminaCliProvider, extractJson } from '../generation/providers/dreamina-cli.mjs';

function startComfyMock() {
  const state = { prompts: [], uploads: 0 };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/system_stats') {
      res.end(JSON.stringify({ system: { comfyui_version: '0.39.0-test', os: 'darwin' }, devices: [{ name: 'mps' }] }));
      return;
    }
    if (url.pathname === '/prompt' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      state.prompts.push(JSON.parse(body));
      res.end(JSON.stringify({ prompt_id: 'p1', number: 1, node_errors: {} }));
      return;
    }
    if (url.pathname === '/history/p1') {
      res.end(JSON.stringify({
        p1: {
          status: { completed: true, status_str: 'success' },
          outputs: { 9: { images: [{ filename: 'out.png', subfolder: '', type: 'output' }] } },
        },
      }));
      return;
    }
    if (url.pathname === '/view') {
      res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      return;
    }
    if (url.pathname === '/upload/image' && req.method === 'POST') {
      state.uploads += 1;
      let size = 0;
      const chunks = [];
      for await (const chunk of req) { size += chunk.length; chunks.push(chunk); }
      state.lastUploadSize = size;
      state.lastUploadBody = Buffer.concat(chunks).toString('utf8');
      res.end(JSON.stringify({ name: 'uploaded.png', subfolder: '', type: 'input' }));
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}`, state });
    });
  });
}

test('comfyui provider: testConnection, submit, waitFor, download, upload', async () => {
  const { server, baseUrl, state } = await startComfyMock();
  try {
    const provider = createComfyUIProvider({ baseUrl, timeoutMs: 3000 });
    const connection = await provider.testConnection();
    assert.equal(connection.ok, true);
    assert.equal(connection.version, '0.39.0-test');

    const workflow = { 3: { class_type: 'KSampler', inputs: { seed: 1 } } };
    const submitted = await provider.submit(workflow);
    assert.equal(submitted.promptId, 'p1');
    assert.equal(state.prompts[0].client_id !== undefined, true);

    const finished = await provider.waitFor('p1', { intervalMs: 10, timeoutMs: 1000 });
    assert.equal(finished.outputs.length, 1);
    assert.equal(finished.outputs[0].filename, 'out.png');
    assert.equal(finished.outputs[0].kind, 'images');

    const bytes = await provider.download({ filename: 'out.png' });
    assert.equal(bytes.length, 4);

    const uploaded = await provider.uploadImage(Buffer.from('fake-png'), 'ref.png', { type: 'input', overwrite: true });
    assert.equal(uploaded.name, 'uploaded.png');
    assert.equal(uploaded.subfolder, '');
    assert.equal(state.uploads, 1);
    assert.match(state.lastUploadBody, /name="type"\r?\n\r?\ninput/);
    assert.match(state.lastUploadBody, /name="overwrite"\r?\n\r?\ntrue/);
  } finally {
    server.close();
  }
});

test('comfyui provider rejects failed history and bad base urls', async () => {
  const provider = createComfyUIProvider({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 150 });
  await assert.rejects(() => provider.testConnection(), (error) => String(error.code || '').startsWith('COMFY_'));
  assert.throws(() => createComfyUIProvider({ baseUrl: 'ftp://x' }), /invalid base URL/);
});

test('applyInputMapping fills workflow inputs and reports missing values', () => {
  const workflow = {
    3: { class_type: 'KSampler', inputs: { seed: 0, steps: 20 } },
    6: { class_type: 'CLIPTextEncode', inputs: { text: '' } },
    7: { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512 } },
  };
  const { workflow: filled } = applyInputMapping(workflow, [
    { nodeId: '6', input: 'text', from: 'prompt' },
    { nodeId: '7', input: 'width', from: 'width', type: 'number' },
    { nodeId: '7', input: 'height', from: 'height', type: 'number' },
  ], { prompt: 'a cat', width: 1024, height: 768 });
  assert.equal(filled['6'].inputs.text, 'a cat');
  assert.equal(filled['7'].inputs.width, 1024);
  assert.equal(filled['7'].inputs.height, 768);
  // 原 workflow 不被修改
  assert.equal(workflow['6'].inputs.text, '');
  assert.throws(() => applyInputMapping(workflow, [{ nodeId: '6', input: 'text', from: 'prompt' }], {}), /missing value/);
});

test('collectOutputs normalizes image and video outputs', () => {
  const outputs = collectOutputs({
    outputs: {
      9: { images: [{ filename: 'a.png', subfolder: '', type: 'output' }] },
      10: { gifs: [{ filename: 'b.mp4', subfolder: 'v', type: 'output' }] },
    },
  });
  assert.equal(outputs.length, 2);
  assert.equal(outputs[1].isVideo, true);
  assert.equal(outputs[1].subfolder, 'v');
});

function fakeExec(responses) {
  const calls = [];
  const impl = async (command, args) => {
    calls.push({ command, args });
    const payload = responses.shift();
    if (typeof payload === 'function') return payload({ command, args });
    return { stdout: typeof payload === 'string' ? payload : JSON.stringify(payload) };
  };
  return { impl, calls };
}

test('dreamina cli provider: status, quote, run, show, download', async () => {
  const fake = fakeExec([
    { schemaVersion: 2, ok: true, data: { loggedIn: true, version: '1.3.0' } },
    { schemaVersion: 2, ok: true, data: { items: [{ nodeId: 'n1', maxCredits: 3 }], totalMaxCredits: 3, confirmable: true, confirmationRequired: false } },
    { schemaVersion: 2, ok: true, data: { submission: { submitId: 's1', state: 'succeeded', resources: [{ resourceId: 'r1' }] }, quote: { maxCredits: 3 } } },
    { schemaVersion: 2, ok: true, data: { nodes: [{ node: { nodeId: 'n1', status: 'success' } }] } },
    { schemaVersion: 2, ok: true, data: { resourceId: 'r1', path: '/tmp/r1.png', size: 10 } },
  ]);
  const provider = createDreaminaCliProvider({ execImpl: fake.impl, profile: 'default' });
  assert.equal((await provider.status()).loggedIn, true);
  const quote = await provider.quote({ projectId: 'aee0c28a-7a8d-41aa-9349-441a49a3473b', nodeId: 'n1' });
  assert.equal(quote.maxCredits, 3);
  const run = await provider.runNode({ projectId: 'aee0c28a-7a8d-41aa-9349-441a49a3473b', nodeId: 'n1', submitId: 's1', creditCeiling: 50 });
  assert.equal(run.state, 'succeeded');
  const nodes = await provider.show({ projectId: 'aee0c28a-7a8d-41aa-9349-441a49a3473b', nodeIds: ['n1'] });
  assert.equal(nodes[0].node.status, 'success');
  const dl = await provider.downloadResource({ projectId: 'aee0c28a-7a8d-41aa-9349-441a49a3473b', resourceId: 'r1', output: '/tmp/r1.png' });
  assert.equal(dl.resourceId, 'r1');

  const runCall = fake.calls[2];
  assert.ok(runCall.args.includes('--credit-ceiling'));
  assert.ok(runCall.args.includes('--submit-id'));
  assert.ok(runCall.args.includes('--wait'));
  assert.ok(runCall.args.includes('--yes'));
  assert.equal(runCall.args.at(-2), '--format');
});

test('dreamina cli provider maps error payloads and parses noisy output', async () => {
  const fake = fakeExec([
    'log line before JSON\n{"schemaVersion":2,"ok":false,"error":{"code":123,"message":"credit required"}}',
  ]);
  const provider = createDreaminaCliProvider({ execImpl: fake.impl });
  await assert.rejects(() => provider.status(), (error) => error.code === 'DREAMINA_123' && /credit required/.test(error.message));
  const parsed = extractJson('noise {"a":1} tail');
  assert.deepEqual(parsed, { a: 1 });
  assert.equal(extractJson('not json'), null);
});

test('dreamina cli provider validates project id', async () => {
  const provider = createDreaminaCliProvider({ execImpl: async () => ({ stdout: '{}' }) });
  await assert.rejects(() => provider.quote({ projectId: 'x', nodeId: 'n1' }), /canvas\) id is required/);
});
