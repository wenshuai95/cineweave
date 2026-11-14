import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'public/assets/manifest.json'), 'utf8'));
const assetsDir = join(root, 'public/assets/models');

test('every bundled 3D asset declares a redistributable license with a license file', () => {
  assert.ok(Array.isArray(manifest.assets) && manifest.assets.length > 0);
  const allowed = new Set(['CC0-1.0']);
  for (const asset of manifest.assets) {
    assert.ok(allowed.has(asset.license), `${asset.id} 的许可 ${asset.license} 不在允许清单内`);
    assert.ok(asset.source, `${asset.id} 缺少来源`);
    assert.ok(asset.licenseFile, `${asset.id} 缺少许可文件路径`);
    assert.ok(existsSync(join(root, 'public/assets', asset.licenseFile)), `${asset.id} 的许可文件不存在`);
    assert.ok(existsSync(join(root, 'public/assets', asset.file)), `${asset.id} 的模型文件不存在`);
  }
});

test('no unmanifested GLB ships in the model directory', () => {
  const listed = new Set(manifest.assets.map(a => a.file.replace(/^models\//, '')));
  const shipped = readdirSync(assetsDir).filter(f => f.endsWith('.glb'));
  const extra = shipped.filter(f => !listed.has(f));
  assert.deepEqual(extra, [], '存在未登记许可的 GLB：' + extra.join(', '));
});

test('legacy assets without provenance stay out of the shipped folder', () => {
  for (const name of ['adult-female-rigged.glb', 'adult-male-rigged.glb', 'geometry-floor-square.glb']) {
    assert.ok(existsSync(join(root, 'legacy-assets', name)), `${name} 应保留在 legacy-assets/`);
    assert.ok(!existsSync(join(assetsDir, name)), `${name} 不应出现在发行目录`);
  }
});

test('license notes cover third-party code shipped with the app', () => {
  const notes = readFileSync(join(root, 'docs/ASSET-LICENSE.md'), 'utf8');
  assert.match(notes, /CC0-1\.0/);
  assert.match(notes, /three\.js/);
  assert.match(notes, /legacy-assets/);
});
