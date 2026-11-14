import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

test('asset store hashes content, deduplicates and rejects traversal', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jingchang-assets-'));
  process.env.JINGCHANG_DATA_DIR = join(dir, 'data');
  const {storeModelBuffer, getModelAsset, assetUrl} = await import('../asset-store.mjs?unit=1');
  const payload = Buffer.from('glTF-mock-model-payload');
  const hash = createHash('sha256').update(payload).digest('hex');

  const first = await storeModelBuffer(payload);
  assert.equal(first.hash, hash);
  assert.equal(first.deduped, false);
  assert.equal(first.url, `/api/assets/${hash}.glb`);
  assert.equal(assetUrl(hash), first.url);

  const second = await storeModelBuffer(payload);
  assert.equal(second.deduped, true);

  const found = await getModelAsset(hash);
  assert.ok(found);
  assert.equal(found.size, payload.length);

  assert.equal(await getModelAsset('../../etc/passwd'), null);
  assert.equal(await getModelAsset('not-a-hash'), null);
  await rm(dir, {recursive: true, force: true});
});

test('asset store HTTP upload, dedupe, download and origin guard', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jingchang-assets-http-'));
  const port = 4197;
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: resolve('.'),
    env: {...process.env, PORT: String(port), JINGCHANG_DATA_DIR: join(dir, 'data')},
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  try {
    await new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(Error('server start timeout')), 8000);
      child.stdout.once('data', () => { clearTimeout(timer); resolvePromise(); });
      child.once('error', reject);
    });
    const base = `http://127.0.0.1:${port}`;
    const payload = Buffer.from('glTF-http-payload');
    const post = async body => fetch(base + '/api/model-assets', {
      method: 'POST',
      headers: {'Content-Type': 'application/octet-stream'},
      body,
    });

    const created = await post(payload);
    assert.equal(created.status, 201);
    const info = await created.json();
    assert.match(info.hash, /^[0-9a-f]{64}$/);
    assert.equal(info.size, payload.length);

    const again = await (await post(payload)).json();
    assert.equal(again.deduped, true);

    const download = await fetch(base + info.url);
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('content-type'), 'model/gltf-binary');
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), payload);

    const missing = await fetch(base + '/api/model-assets/' + 'a'.repeat(64) + '.glb');
    assert.equal(missing.status, 404);

    const wrongType = await fetch(base + '/api/model-assets', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}',
    });
    assert.equal(wrongType.status, 400);

    const crossOrigin = await fetch(base + '/api/model-assets', {
      method: 'POST',
      headers: {'Content-Type': 'application/octet-stream', Origin: 'http://evil.example'},
      body: payload,
    });
    assert.equal(crossOrigin.status, 403);
  } finally {
    child.kill();
    await new Promise(resolvePromise => child.once('close', resolvePromise));
    await rm(dir, {recursive: true, force: true});
  }
});
