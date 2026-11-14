import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
const appVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
import {validateBridgeProject} from '../bridge-server.mjs';

const minimalProject = () => ({
  schema: 'jingchang/1',
  name: 'bridge test',
  duration: 4,
  fps: 24,
  groundColor: '#41494c',
  objects: [],
  nodes: [],
  edges: [],
  shots: [
    {id: 'cut-01', cameraId: 'cam-01', start: 0, end: 2},
    {id: 'cut-02', cameraId: 'cam-01', start: 2, end: 4},
  ],
});

test('bridge request validation rejects malformed projects', () => {
  assert.equal(validateBridgeProject(minimalProject()), null);
  assert.match(validateBridgeProject(null), /缺失/);
  assert.match(validateBridgeProject({...minimalProject(), schema: 'x'}), /版本/);
  assert.match(validateBridgeProject({...minimalProject(), shots: []}), /镜头/);
  assert.match(validateBridgeProject({...minimalProject(), duration: 0}), /时长/);
  assert.match(validateBridgeProject({...minimalProject(), fps: 60}), /fps/);
  assert.match(validateBridgeProject({...minimalProject(), objects: new Array(301).fill({})}), /对象/);
});

test('bridge server queues a job, reports progress, and serves the reel', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jingchang-bridge-'));
  const port = 4193;
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      PORT: String(port),
      JINGCHANG_DATA_DIR: join(dir, 'data'),
      BLENDER_PATH: resolve('tests/fixtures/mock-blender.mjs'),
      BRIDGE_FFMPEG: resolve('tests/fixtures/mock-ffmpeg.mjs'),
    },
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
    const status = await fetch(base + '/api/bridge/status').then(r => r.json());
    assert.equal(status.blender.available, true);
    assert.equal(status.version, appVersion);

    const created = await fetch(base + '/api/bridge/jobs', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({project: minimalProject(), options: {samples: 8}}),
    }).then(r => r.json());
    assert.ok(created.id, JSON.stringify(created));

    let job = created;
    for (let i = 0; i < 100 && !['done', 'error', 'cancelled'].includes(job.status); i++) {
      await new Promise(r => setTimeout(r, 150));
      job = await fetch(`${base}/api/bridge/jobs/${created.id}`).then(r => r.json());
    }
    assert.equal(job.status, 'done', job.message);
    assert.equal(job.doneShots, 2);
    assert.ok(job.reelUrl);

    const reel = await fetch(base + job.reelUrl);
    assert.equal(reel.status, 200);
    assert.equal(reel.headers.get('content-type'), 'video/mp4');
    assert.ok((await reel.arrayBuffer()).byteLength > 0);

    const clip = await fetch(base + job.clips[0].url);
    assert.equal(clip.status, 200);
    assert.equal(clip.headers.get('content-type'), 'video/mp4');

    const missing = await fetch(base + '/api/bridge/jobs/does-not-exist');
    assert.equal(missing.status, 404);

    const bad = await fetch(base + '/api/bridge/jobs', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({project: {...minimalProject(), schema: 'nope'}}),
    });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /版本/);
  } finally {
    child.kill();
    await new Promise(resolvePromise => child.once('close', resolvePromise));
    await rm(dir, {recursive: true, force: true});
  }
});
