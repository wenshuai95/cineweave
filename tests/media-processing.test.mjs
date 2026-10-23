import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {processingOptions,processingEncodeArgs} from '../media-processing.mjs';
import {reviewStoryPackage} from '../src/workstation/creative-review.mjs';

test('reject unsafe operations and invalid time ranges before creating work',()=>{
 const info={hasVideo:true,hasAudio:true,durationSec:30,width:1920,height:1080};
 for(const raw of [{operation:'shell'},{operation:'trim',start:'0',end:1},{operation:'trim',start:-1,end:1},{operation:'trim',start:0,end:Infinity},{operation:'trim',start:9,end:8},{operation:'depth',start:0,end:16}])assert.throws(()=>processingOptions(raw,info));
 assert.throws(()=>processingOptions({operation:'audio'},{...info,hasAudio:false}),/没有音轨/);
 assert.equal(processingOptions({operation:'depth',start:0,end:3},info).durationSec,3);
 const args=processingEncodeArgs('/source','/output',{operation:'mute',start:0,durationSec:1});assert.ok(args.includes('-an'));assert.ok(!args.some(v=>v.includes('shell')));
});

test('local creative review reports missing assets without changing candidates or making model calls',()=>{
 const c={shots:[{id:'s1',scene:'巷口',characters:['小明'],duration:3},{id:'s2',scene:'室内',characters:['小明'],duration:2}],assets:[{kind:'character',name:'阿明',shotIds:[]},{kind:'scene',name:'巷口',shotIds:['s1']}]},before=structuredClone(c);
 const r=reviewStoryPackage(c);assert.equal(r.durationSec,5);assert.equal(r.issueCount,3);assert.ok(r.issues.some(i=>i.kind==='missing-character'));assert.ok(r.issues.some(i=>i.kind==='missing-scene'));assert.deepEqual(c,before);
 assert.equal(reviewStoryPackage({shots:[{id:'s1',scene:'巷口',characters:['小明'],duration:3}],assets:[{kind:'character',name:'小明',shotIds:['s1']},{kind:'scene',name:'巷口',shotIds:['s1']}]}).issueCount,0);
});

test('real local jobs trim, extract audio, mute, cancel and preserve source bytes',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'cineweave-processing-')),old=process.env.JINGCHANG_DATA_DIR;
 process.env.JINGCHANG_DATA_DIR=dir;
 const {handleWorkstation,FFMPEG,FFPROBE}=await import('../workstation-server.mjs?processing-test');
 if(old==null)delete process.env.JINGCHANG_DATA_DIR;else process.env.JINGCHANG_DATA_DIR=old;
 if(spawnSync(FFMPEG,['-version']).status!==0){await rm(dir,{recursive:true,force:true});t.skip('FFmpeg unavailable');return;}
 const server=createServer((req,res)=>handleWorkstation(req,res,new URL(req.url,'http://'+req.headers.host)).catch(()=>{res.statusCode=500;res.end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,headers={Origin:base,'Content-Type':'application/json'};
 const post=(path,body)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(body)});
 async function done(id){for(let n=0;n<200;n++){const j=await(await fetch(base+'/api/workstation/processing/'+id)).json();if(['done','error','canceled'].includes(j.status))return j;await new Promise(r=>setTimeout(r,30));}throw Error('Job timeout');}
 try{
  const file=join(dir,'original.mp4');assert.equal(spawnSync(FFMPEG,['-v','error','-nostdin','-y','-f','lavfi','-i','testsrc2=size=160x90:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-c:a','aac',file]).status,0);
  const bytes=await readFile(file),upload=await fetch(base+`/api/workstation/media?kind=video&name=source.mp4&mime=video/mp4&size=${bytes.length}`,{method:'POST',headers:{Origin:base,'Content-Type':'application/octet-stream'},body:bytes}),source=(await upload.json()).id;
  assert.equal((await fetch(base+'/api/workstation/media/'+source+'/processing',{method:'POST',body:'{}'})).status,403);
  assert.equal((await post('/api/workstation/media/'+source+'/processing',{operation:'trim',start:1,end:.5})).status,400);
  assert.equal((await post('/api/workstation/media/'+source+'/processing',{operation:'depth',start:0,end:1})).status,400);
  for(const operation of ['trim','audio','mute']){
   const created=await post('/api/workstation/media/'+source+'/processing',{operation,start:.5,end:1.5});assert.equal(created.status,200);const job=await done((await created.json()).id);assert.equal(job.status,'done',job.message);assert.ok(!JSON.stringify(job).includes(dir));
   const response=await fetch(base+job.fileUrl),target=join(dir,operation+(operation==='audio'?'.wav':'.mp4'));await writeFile(target,Buffer.from(await response.arrayBuffer()));
   const info=JSON.parse(spawnSync(FFPROBE,['-v','error','-show_streams','-show_format','-of','json',target]).stdout);
   assert.ok(Math.abs(Number(info.format.duration)-1)<.12);
   if(operation==='audio')assert.ok(!info.streams.some(s=>s.codec_type==='video'));
   if(operation==='mute')assert.ok(!info.streams.some(s=>s.codec_type==='audio'));
   if(operation==='trim')assert.ok(info.streams.some(s=>s.codec_type==='audio'));
  }
  const c=await post('/api/workstation/media/'+source+'/processing',{operation:'trim',start:0,end:2}),id=(await c.json()).id;
  assert.equal((await post('/api/workstation/processing/'+id+'/cancel',{})).status,200);const canceled=await done(id);assert.equal(canceled.status,'canceled');
  assert.deepEqual(await readFile(file),bytes);assert.deepEqual(await readFile(join(dir,'workstation/media',source+'.mp4')),bytes);
  // Canceled jobs cannot expose partial output, even if FFmpeg briefly created a file.
  assert.equal((await fetch(base+'/api/workstation/processing/'+id+'/file')).status,409);
  await new Promise(r=>setTimeout(r,200));
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
