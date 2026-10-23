import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawn} from 'node:child_process';
test('oiioii adapter quotes, deduplicates submissions, polls and returns an image without exposing CLI metadata',{skip:process.env.JINGCHANG_TEST_SERVER!=='1'},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'jingchang-ai-test-')),count=join(dir,'count');
 const cliBody=`const fs=require('node:fs');const a=process.argv.slice(2);let data={};if(a[0]==='auth')data={authenticated:true};if(a[0]==='points')data={estimated_points:7,sufficient:true};if(a[0]==='workspace')data={workspace_id:'test-workspace'};if(a[0]==='image'){fs.appendFileSync(${JSON.stringify(count)},'1');data={local_task_id:'local-task'}}if(a[0]==='task')data={task:{status:'succeeded',resourceUris:['hogi://image/mock'],credentialFingerprint:'DO_NOT_EXPOSE'}};if(a[0]==='record'){const output=a[a.indexOf('--output')+1];fs.writeFileSync(output,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64'));data={path:output}}process.stdout.write(JSON.stringify({ok:true,data}));`;
 // POSIX exercises a directly executable CLI (shebang + exec bit); Windows and JS-CLI
 // distributions take the node-spawn branch in ai-service run().
 const cli=process.platform==='win32'?join(dir,'mock-cli.cjs'):join(dir,'mock-cli');
 await writeFile(cli,(process.platform==='win32'?'':'#!/usr/bin/env node\n')+cliBody,process.platform==='win32'?{}:{mode:0o700});
 const child=spawn(process.execPath,['server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'4189',OIIOII_CLI:cli,JINGCHANG_DATA_DIR:join(dir,'data')},stdio:['ignore','pipe','pipe'],windowsHide:true});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server start timeout')),8000);child.stdout.once('data',()=>{clearTimeout(timer);resolve()});child.once('error',reject)});const base='http://127.0.0.1:4189';const status=await fetch(base+'/api/ai/status').then(r=>r.json());assert.equal(status.oiioii,true);const post=async(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Jingchang-Token':status.token},body:JSON.stringify(body)}).then(r=>r.json());
 assert.ok(!('model3d' in status));
 for(const path of ['/api/model3d/config','/api/model3d/generate']){
  const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Jingchang-Token':status.token},body:JSON.stringify({apiKey:'FAKE_REMOVED_KEY'})});assert.equal(r.status,410);assert.match((await r.json()).error,/已移除/);
 }
 for(const path of ['/api/model3d/tasks','/api/model3d/task/old'])assert.equal((await fetch(base+path)).status,410);
 const config=await post('/api/ai/config',{base:'https://api.deepseek.com',model:'test-model',key:'FAKE_TEST_KEY_ONLY'});assert.equal(config.config.configured,true);assert.ok(!JSON.stringify(config).includes('FAKE_TEST_KEY_ONLY'));
 const readback=await fetch(base+'/api/ai/status').then(r=>r.json());assert.equal(readback.config.model,'test-model');assert.ok(!JSON.stringify(readback).includes('FAKE_TEST_KEY_ONLY'));
 const invalid=await post('/api/ai/config',{base:'http://insecure.invalid',model:'m',key:'test'});assert.match(invalid.error,/HTTPS/);
 const changed=await post('/api/ai/config',{base:'https://another.invalid',model:'m'});assert.match(changed.error,/重新输入/);
 const forbidden=await fetch(base+'/api/ai/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base:'https://api.deepseek.com',model:'m',key:'x'})});assert.equal(forbidden.status,403);
 const cleared=await post('/api/ai/config',{base:'https://api.deepseek.com',model:'test-model',clear:true});assert.equal(cleared.config.configured,false);
 const quote=await post('/api/oiioii/quote',{modelId:'50',resolution:'2560x1440',aspect:'16:9'});assert.equal(quote.points,7);
 const [one,two]=await Promise.all([post('/api/oiioii/generate',{quoteId:quote.quoteId,prompt:'测试图'}),post('/api/oiioii/generate',{quoteId:quote.quoteId,prompt:'测试图'})]);assert.equal(one.id,two.id);assert.equal(await readFile(count,'utf8'),'1');
 const job=await fetch(base+'/api/oiioii/task/'+one.id).then(r=>r.json());assert.equal(job.status,'succeeded');assert.ok(!JSON.stringify(job).includes('DO_NOT_EXPOSE'));const image=await fetch(base+job.imageUrl);assert.equal(image.headers.get('content-type'),'image/png');assert.ok((await image.arrayBuffer()).byteLength>20);
 }finally{child.kill();await new Promise(resolve=>child.once('close',resolve));await rm(dir,{recursive:true,force:true});}
});
