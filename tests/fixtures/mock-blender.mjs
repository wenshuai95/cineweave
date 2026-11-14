#!/usr/bin/env node
// 测试用 Blender 替身：只产出桥接服务需要的文件与日志。
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.includes('--version')) {
  console.log('Blender 5.2.0 (mock)');
  process.exit(0);
}
const joined = args.join(' ');
const get = (flag) => args[args.indexOf(flag) + 1];

if (joined.includes('bw_build.py')) {
  fs.writeFileSync(get('--out'), 'mock blend');
  console.log('BUILT 0 models');
  process.exit(0);
}
if (joined.includes('bw_render.py')) {
  const after = args.slice(args.indexOf('--') + 1);
  const sceneJson = after[0];
  const outDir = after[after.indexOf('--out') + 1];
  const cfg = JSON.parse(fs.readFileSync(sceneJson, 'utf8'));
  for (const shot of cfg.shots) {
    const dir = path.join(outDir, shot.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${shot.id}_0000.png`), 'png');
    console.log(`RENDERED ${shot.id} frames=1 time=0.0s per_frame=0.00s`);
  }
  console.log('ALL_DONE frames=' + cfg.shots.length);
  process.exit(0);
}
console.error('mock blender: unsupported args', joined);
process.exit(2);
