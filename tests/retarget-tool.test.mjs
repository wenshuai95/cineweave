import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';

const root = process.cwd();

function coverage(target, source, rig = 'ual2') {
  let stdout;
  try {
    stdout = execFileSync('python3', ['tools/retarget/check_coverage.py',
      join('public/assets/models', target), join('public/assets/models', source),
      '--source-rig', rig], {cwd: root, encoding: 'utf8'});
  } catch (error) {
    if (error.code === 'ENOENT') return null; // 没装 python3 时跳过
    throw error;
  }
  return JSON.parse(stdout);
}

test('UAL2 动作库能覆盖成年角色骨架的绝大部分骨骼', () => {
  const result = coverage('adult-female-casual.glb', 'female-anatomy-mannequin.glb');
  if (!result) return;
  assert.ok(result.mapped >= 55, `映射骨骼过少：${result.mapped}`);
  assert.ok(result.mapped / result.targetBones > 0.85, '覆盖率不足 85%');
  assert.deepEqual(result.unmatchedTarget, ['Body'], '只有 Body 这类辅助骨允许未映射');
});

test('performer 动作库的映射表结构完整（不要求实测覆盖）', () => {
  execFileSync('python3', ['-c',
    'import sys; sys.path.insert(0,"tools/retarget"); import bone_map, json; ' +
    'm=bone_map.mapping("performer"); assert len(m)>=30; print(json.dumps(m))'], {cwd: root});
});
