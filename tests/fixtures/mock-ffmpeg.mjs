#!/usr/bin/env node
// 测试替身：把输出参数指向的文件写成假 MP4。
import fs from 'node:fs';
const args = process.argv.slice(2);
if (args.includes('-version')) { console.log('ffmpeg mock'); process.exit(0); }
const output = args.at(-1);
if (!output) { console.error('mock ffmpeg: missing output'); process.exit(2); }
fs.writeFileSync(output, Buffer.from('mock-mp4-output'));
console.log('mock ffmpeg done');
