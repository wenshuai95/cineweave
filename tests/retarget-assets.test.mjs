import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'public/assets/manifest.json'), 'utf8'));

function glbAnimations(path) {
  const buffer = readFileSync(path);
  const jsonLength = buffer.readUInt32LE(12);
  const doc = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  return (doc.animations || []).map(a => a.name);
}

test('内置的扩展动作角色已登记，且带满 109 段动作', () => {
  for (const id of ['adult-female-casual-actions', 'adult-male-casual-hoodie-actions']) {
    const asset = manifest.assets.find(a => a.id === id);
    assert.ok(asset, `${id} 未登记到 manifest`);
    assert.equal(asset.license, 'CC0-1.0');
    assert.ok(existsSync(join(root, 'public/assets', asset.licenseFile)), `${id} 缺少许可文件`);
    assert.ok(existsSync(join(root, 'public/assets', asset.file)), `${id} 缺少模型文件`);
    assert.equal(asset.animations.length, 109, `${id} 的动作数量不对`);
    const names = glbAnimations(join(root, 'public/assets', asset.file));
    assert.equal(names.length, 109);
    assert.equal(names.filter(n => n.startsWith('RT_')).length, 85, `${id} 的 RT_ 片段数量不对`);
    assert.ok(names.includes(asset.defaultClip), `${id} 的默认动作不在模型里`);
    assert.ok(asset.bytes > 6_000_000, `${id} 的 bytes 未更新`);
  }
});

test('扩展动作角色的许可说明覆盖 CC0 来源', () => {
  const text = readFileSync(join(root, 'public/assets/licenses/quaternius-retarget-derivative.txt'), 'utf8');
  assert.match(text, /CC0-1\.0/);
  assert.match(text, /Universal Animation Library 2/);
  assert.match(text, /RT_/);
});
