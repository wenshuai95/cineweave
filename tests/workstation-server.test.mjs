import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync,execFile} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseExportPlan,FFMPEG,FFPROBE} from '../workstation-server.mjs';
const options={skip:process.env.JINGCHANG_TEST_SERVER!=='1'};
const base=process.env.JINGCHANG_TEST_BASE||'http://127.0.0.1:4173';
const origin={Origin:base};

const hasTool=bin=>{try{return spawnSync(bin,['-version'],{timeout:8000}).status===0;}catch{return false;}};
const ffmpegOk=options.skip?false:hasTool(FFMPEG);
const ffprobeOk=options.skip?false:hasTool(FFPROBE);
const exportOptions={skip:options.skip||!ffmpegOk||!ffprobeOk};

const probeJson=async file=>{
 const {stdout}=await new Promise((resolve,reject)=>{
  execFile(FFPROBE,['-v','error','-print_format','json','-show_format','-show_streams',file],(e,stdout,stderr)=>e?reject(e):resolve({stdout,stderr}));
 });
 return JSON.parse(stdout);
};

test('workstation health reports tool availability and limits',options,async()=>{
 const r=await fetch(base+'/api/workstation/health');
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.app,'ai-video-workstation');
 assert.equal(data.version,'1.21.0');
 assert.deepEqual(data.limits.fps,[24,25,30]);
 assert.deepEqual(data.limits.heights,[720,1080]);
});

test('workstation API rejects foreign origins and unauthenticated state changes',options,async()=>{
 // 外域 GET 拒绝
 assert.equal((await fetch(base+'/api/workstation/health',{headers:{Origin:'https://example.com'}})).status,403);
 // POST 必须携带与本机一致的 Origin
 const noOrigin=await fetch(base+'/api/workstation/media?name=x&kind=video&mime=video/mp4&size=10',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:'x'});
 assert.equal(noOrigin.status,403);
 const foreign=await fetch(base+'/api/workstation/media?name=x&kind=video&mime=video/mp4&size=10',{method:'POST',headers:{'Content-Type':'application/octet-stream',Origin:'https://example.com'},body:'x'});
 assert.equal(foreign.status,403);
 // 同源但内容类型不对
 const wrongType=await fetch(base+'/api/workstation/media?name=x&kind=video&mime=video/mp4&size=10',{method:'POST',headers:{'Content-Type':'application/json',...origin},body:'{}'});
 assert.equal(wrongType.status,400);
 // 声明的轨道类型与 MIME 不符
 const mismatch=await fetch(base+'/api/workstation/media?name=x&kind=audio&mime=video/mp4&size=10',{method:'POST',headers:{'Content-Type':'application/octet-stream',...origin},body:'x'});
 assert.equal(mismatch.status,400);
 // 不存在的导出任务
 assert.equal((await fetch(base+'/api/workstation/export/none',{headers:origin})).status,404);
});

test('upload rejects bodies larger than the declared size',options,async()=>{
 const declared=10,body=Buffer.alloc(64,7);
 const r=await fetch(base+`/api/workstation/media?name=big&kind=video&mime=video/mp4&size=${declared}`,{method:'POST',headers:{'Content-Type':'application/octet-stream',...origin},body});
 assert.equal(r.status,400);
 const data=await r.json();
 assert.match(data.error,/上传/);
});

test('export plan validation enforces fps, height, frames and audio totals',()=>{
 const seg=(over={})=>({type:'silence',frames:24,...over});
 assert.throws(()=>parseExportPlan({fps:23,height:720,video:[seg()]}),/帧率/);
 assert.throws(()=>parseExportPlan({fps:24,height:480,video:[seg()]}),/分辨率/);
 assert.throws(()=>parseExportPlan({fps:24,height:720,video:[]}),/视频轨/);
 assert.throws(()=>parseExportPlan({fps:24,height:720,video:[{type:'media',mediaId:'nope',in:0,frames:24}]}),/媒体不存在/);
 assert.throws(()=>parseExportPlan({fps:24,height:720,video:[seg({frames:0})]}),/帧数/);
 assert.throws(()=>parseExportPlan({fps:24,height:720,video:[seg({frames:30*3600+1})]}),/1 小时/);
 assert.throws(()=>parseExportPlan({fps:24,height:720,video:[seg()],audio:[seg({frames:48})]}),/音轨总帧数/);
 assert.throws(()=>parseExportPlan({fps:24,height:720,video:[seg({frames:24*3600*2})]}),/成片超过/);
});

test('real ffmpeg export: cut + concat + A1 mix with a black gap',exportOptions,async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ws-export-test-'));
 try{
  const make=(args,out)=>new Promise((resolve,reject)=>{
   execFile(FFMPEG,['-hide_banner','-loglevel','error','-y',...args,'-t','3',out],(e,_o,stderr)=>e?reject(Error(stderr||e.message)):resolve(out));
  });
  // 素材 A：3 秒带音频视频（testsrc2 + 440Hz 正弦）；素材 B：2 秒纯音频（880Hz）
  await make(['-f','lavfi','-i','testsrc2=size=320x180:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest'],join(dir,'a.mp4'));
  await make(['-f','lavfi','-i','sine=frequency=880:sample_rate=48000','-c:a','aac'],join(dir,'b.m4a'));

  const upload=async(file,name,kind,mime)=>{
   const bytes=await readFile(file);
   const r=await fetch(base+`/api/workstation/media?name=${encodeURIComponent(name)}&kind=${kind}&mime=${encodeURIComponent(mime)}&size=${bytes.length}`,{method:'POST',headers:{'Content-Type':'application/octet-stream',...origin},body:bytes});
   assert.equal(r.status,200,await r.clone().text());
   return (await r.json()).id;
  };
  const videoId=await upload(join(dir,'a.mp4'),'A.mp4','video','video/mp4');
  const audioId=await upload(join(dir,'b.m4a'),'B.m4a','audio','audio/mp4');

  // 上传后可探测：视频带音轨、时长约 3 秒
  const info=await (await fetch(base+'/api/workstation/media/'+videoId,{headers:origin})).json();
  assert.equal(info.hasVideo,true);assert.equal(info.hasAudio,true);
  assert.ok(Math.abs(info.durationSec-3)<0.3,`duration ${info.durationSec}`);

  // 影片 3 秒 = 素材 A 第 1–3 秒（入 24 帧、48 帧）+ 1 秒黑场；A1 = 素材 B 2 秒 + 1 秒静音
  const plan={fps:24,height:720,
   video:[{type:'media',mediaId:videoId,in:24,frames:48,volume:1},{type:'silence',frames:24}],
   audio:[{type:'media',mediaId:audioId,in:0,frames:48,volume:1},{type:'silence',frames:24}]};
  const created=await fetch(base+'/api/workstation/export',{method:'POST',headers:{'Content-Type':'application/json',...origin},body:JSON.stringify(plan)});
  assert.equal(created.status,200,await created.clone().text());
  const job=await created.json();
  assert.equal(job.frames,72);

  let status=null;
  for(let i=0;i<90;i++){
   const r=await fetch(base+'/api/workstation/export/'+job.id,{headers:origin});
   status=await r.json();
   if(['done','error'].includes(status.status))break;
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert.equal(status.status,'done','导出失败：'+(status.message||JSON.stringify(status)));
  assert.equal(status.progress,1);
  assert.equal(status.frames,72);

  const file=await fetch(base+'/api/workstation/export/'+job.id+'/file',{headers:origin});
  assert.equal(file.status,200);
  assert.match(file.headers.get('content-type'),/video\/mp4/);
  const bytes=Buffer.from(await file.arrayBuffer());
  assert.ok(bytes.length>1024);
  await writeFile(join(dir,'out.mp4'),bytes);
  const meta=await probeJson(join(dir,'out.mp4'));
  const duration=Number(meta.format.duration);
  assert.ok(Math.abs(duration-3)<0.2,`成片时长应 ≈3 秒，实际 ${duration}`);
  const codecs=meta.streams.map(s=>s.codec_name);
  assert.ok(codecs.includes('h264'),'应含 H.264 视频流');
  assert.ok(codecs.includes('aac'),'应含 AAC 音频流');
  const video=meta.streams.find(s=>s.codec_type==='video');
  assert.equal(video.width,1280);assert.equal(video.height,720);
  const nbFrames=Number(meta.streams.find(s=>s.codec_type==='video')?.nb_frames||0);
  if(nbFrames)assert.ok(Math.abs(nbFrames-72)<=2,`帧数应 ≈72，实际 ${nbFrames}`);
 }finally{
  await rm(dir,{recursive:true,force:true}).catch(()=>{});
 }
});
