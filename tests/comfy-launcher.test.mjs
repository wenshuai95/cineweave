import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolveComfyLaunch} from '../comfy-launcher.mjs';

test('locates the ComfyUI virtualenv and launch arguments without shell interpolation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'comfy-launch-'));
  try {
    await mkdir(join(dir, '.venv', 'bin'), {recursive: true});
    await writeFile(join(dir, '.venv', 'bin', 'python'), '#!/bin/sh\n');
    await chmod(join(dir, '.venv', 'bin', 'python'), 0o755);
    await writeFile(join(dir, 'main.py'), '');
    const launch = await resolveComfyLaunch({comfyDir: dir, platform: 'darwin', port: 8199});
    assert.equal(launch.command, join(dir, '.venv', 'bin', 'python'));
    assert.deepEqual(launch.args, ['main.py', '--listen', '127.0.0.1', '--port', '8199']);
    assert.equal(launch.cwd, dir);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('reports a missing ComfyUI directory', async () => {
  await assert.rejects(() => resolveComfyLaunch({comfyDir: join(tmpdir(), 'missing-comfy-' + Date.now())}), /未找到 ComfyUI/);
});
