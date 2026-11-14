import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {validateRetargetRequest, resolveModelSrc} from '../retarget-server.mjs';

test('retarget request only accepts built-in assets or the local asset store', () => {
  const ok = {
    targetSrc: '/assets/models/adult-female-casual.glb',
    sourceSrc: '/assets/models/female-anatomy-mannequin.glb',
  };
  assert.equal(validateRetargetRequest(ok), null);
  assert.match(validateRetargetRequest({...ok, targetSrc: '/etc/passwd'}), /目标模型无效/);
  assert.match(validateRetargetRequest({...ok, targetSrc: '/assets/models/../../secret.glb'}), /目标模型无效/);
  assert.match(validateRetargetRequest({...ok, sourceSrc: '/api/assets/' + 'a'.repeat(63) + '.glb'}), /动作库无效/);
  assert.match(validateRetargetRequest({...ok, targetSrc: ok.sourceSrc}), /不能是同一个/);
  assert.match(validateRetargetRequest({...ok, clips: 'nope'}), /动作片段/);
  assert.match(validateRetargetRequest({...ok, prefix: 'bad prefix!'}), /前缀/);
  assert.equal(resolveModelSrc('/assets/models/adult-male-casual-hoodie.glb')?.endsWith('adult-male-casual-hoodie.glb'), true);
  assert.equal(resolveModelSrc('/assets/models/missing-model.glb'), null);
});

test('retarget job runs through the local queue and serves GLB + report', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jingchang-retarget-'));
  const port = 4202;
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      PORT: String(port),
      JINGCHANG_DATA_DIR: join(dir, 'data'),
      BLENDER_PATH: resolve('tests/fixtures/mock-retarget-blender.mjs'),
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
    const status = await fetch(base + '/api/retarget/status').then(r => r.json());
    assert.equal(status.blender.available, true);
    assert.equal(status.libraries.length, 2);

    const created = await fetch(base + '/api/retarget/jobs', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        targetSrc: '/assets/models/adult-female-casual.glb',
        sourceSrc: '/assets/models/female-anatomy-mannequin.glb',
        clips: ['Spell_Simple_Idle_Loop', 'Punch_Cross'],
        prefix: 'RT_',
      }),
    }).then(r => r.json());
    assert.ok(created.id, JSON.stringify(created));

    let job = created;
    for (let i = 0; i < 100 && !['done', 'error', 'cancelled'].includes(job.status); i++) {
      await new Promise(r => setTimeout(r, 120));
      job = await fetch(`${base}/api/retarget/jobs/${created.id}`).then(r => r.json());
    }
    assert.equal(job.status, 'done', job.message);

    const file = await fetch(base + job.fileUrl);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'model/gltf-binary');
    assert.ok((await file.arrayBuffer()).byteLength > 0);

    const report = await fetch(base + job.reportUrl);
    assert.equal(report.status, 200);
    assert.equal((await report.json()).mappedBones, 61);

    const bad = await fetch(base + '/api/retarget/jobs', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({targetSrc: '/etc/passwd', sourceSrc: '/assets/models/female-anatomy-mannequin.glb'}),
    });
    assert.equal(bad.status, 400);
  } finally {
    child.kill();
    await new Promise(resolvePromise => child.once('close', resolvePromise));
    await rm(dir, {recursive: true, force: true});
  }
});
