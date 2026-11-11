#!/usr/bin/env node
// 测试用 Blender 替身：产出重定向所需的 GLB 与报告，并打印烘焙日志。
import fs from 'node:fs';
const args = process.argv.slice(2);
if (args.includes('--version')) { console.log('Blender 5.2.0 (mock)'); process.exit(0); }
const get = flag => args[args.indexOf(flag) + 1];
const out = get('--out');
const report = get('--report');
if (!out) { console.error('mock retarget blender: missing --out'); process.exit(2); }
fs.writeFileSync(out, Buffer.from('glb-mock-retargeted'));
if (report) {
  fs.writeFileSync(report, JSON.stringify({mappedBones: 61, bakedClips: [{name: 'RT_Spell_Simple_Idle_Loop'}], seconds: 0.1}));
}
for (const name of ['Spell_Simple_Idle_Loop', 'Punch_Cross']) console.log(`  baked ${name} -> RT_${name}`);
console.log('RETARGET_DONE {"mappedBones":61}');
console.log('BAKED 2');
