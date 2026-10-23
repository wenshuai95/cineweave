import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describeMediaCompatibility,compatibilityEncodeArgs,validateCompatibilitySource} from '../media-compatibility.mjs';

test('compatibility diagnosis uses actual container and codecs, while retaining uncertainty',()=>{
 const good={format:{format_name:'mov,mp4,m4a,3gp,3g2,mj2'},streams:[{codec_type:'video',codec_name:'h264',pix_fmt:'yuv420p'},{codec_type:'audio',codec_name:'aac'}]};
 assert.equal(describeMediaCompatibility(good,'video/mp4').needsCompatibilityCopy,false);
 const wrong=describeMediaCompatibility({format:{format_name:'matroska,webm'},streams:[{codec_type:'video',codec_name:'vp9',pix_fmt:'yuv420p'}]},'video/mp4');
 assert.equal(wrong.detectedMime,'video/webm');assert.deepEqual(wrong.reasons,['container-mismatch']);
 const high=describeMediaCompatibility({...good,streams:[{codec_type:'video',codec_name:'hevc',pix_fmt:'yuv420p10le'}]},'video/mp4');
 assert.ok(high.reasons.includes('video-codec'));
 assert.throws(()=>validateCompatibilitySource({hasVideo:false}),/视频流/);
 assert.throws(()=>validateCompatibilitySource({hasVideo:true,durationSec:3601}),/1 小时/);
 assert.throws(()=>validateCompatibilitySource({hasVideo:true,durationSec:1,width:5000,height:100}),/尺寸/);
 const args=compatibilityEncodeArgs('/tmp/input','/tmp/output');
 assert.ok(args.includes('libx264'));assert.ok(args.includes('aac'));assert.ok(args.includes('+faststart'));assert.ok(args.includes('0:a:0?'));
});

test('real compatibility API handles mislabeled WebM, preserves original and produces H264 MP4',async t=>{
 // Own temporary server/state; never use an installed application's media registry.
 const dir=await mkdtemp(join(tmpdir(),'cineweave-compat-'));
 const oldRoot=process.env.JINGCHANG_DATA_DIR;
 process.env.JINGCHANG_DATA_DIR=dir;
 const {handleWorkstation,FFMPEG,FFPROBE}=await import('../workstation-server.mjs?compatibility-test');
 if(oldRoot==null)delete process.env.JINGCHANG_DATA_DIR;else process.env.JINGCHANG_DATA_DIR=oldRoot;
 if(spawnSync(FFMPEG,['-version']).status!==0||spawnSync(FFPROBE,['-version']).status!==0){await rm(dir,{recursive:true,force:true});t.skip('FFmpeg/ffprobe unavailable');return;}
 const server=createServer((req,res)=>{handleWorkstation(req,res,new URL(req.url,'http://'+req.headers.host)).catch(()=>{res.statusCode=500;res.end();});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const origin={Origin:base};
 try{
  const file=join(dir,'input.webm');
  const made=spawnSync(FFMPEG,['-hide_banner','-loglevel','error','-nostdin','-y','-f','lavfi','-i','testsrc2=size=160x90:rate=24','-t','0.5','-c:v','libvpx-vp9',file],{timeout:15000});
  assert.equal(made.status,0,made.stderr?.toString());
  const bytes=await readFile(file);
  const uploaded=await fetch(base+`/api/workstation/media?name=old.mp4&kind=video&mime=video/mp4&size=${bytes.length}`,{method:'POST',headers:{...origin,'Content-Type':'application/octet-stream'},body:bytes});
  assert.equal(uploaded.status,200);const {id}=await uploaded.json();
  const info=await (await fetch(base+'/api/workstation/media/'+id)).json();
  assert.equal(info.hasVideo,true);assert.equal(info.compatibility.videoCodec,'vp9');assert.ok(info.compatibility.reasons.includes('container-mismatch'));
  assert.equal((await fetch(base+'/api/workstation/media/'+id+'/compatibility',{method:'POST'})).status,403);
  assert.equal((await fetch(base+'/api/workstation/media/missing/compatibility',{method:'POST',headers:origin})).status,400);
  assert.equal((await fetch(base+'/api/workstation/compatibility/missing')).status,404);
  const created=await fetch(base+'/api/workstation/media/'+id+'/compatibility',{method:'POST',headers:origin});
  assert.equal(created.status,200);const job=await created.json();
  let status=job;
  for(let n=0;n<150&&!['done','error'].includes(status.status);n++){
   await new Promise(r=>setTimeout(r,50));status=await (await fetch(base+'/api/workstation/compatibility/'+job.id)).json();
  }
  assert.equal(status.status,'done',status.message);assert.equal(status.sourceId,id);
  assert.equal(JSON.stringify(status).includes(dir),false,'No server paths leak through task status');
  const output=await fetch(base+status.fileUrl);assert.equal(output.headers.get('content-type'),'video/mp4');
  const target=join(dir,'verified.mp4');await writeFile(target,Buffer.from(await output.arrayBuffer()));
  const probed=spawnSync(FFPROBE,['-v','error','-show_streams','-show_format','-of','json',target]);
  const meta=JSON.parse(probed.stdout);assert.equal(meta.streams[0].codec_name,'h264');assert.equal(meta.streams[0].pix_fmt,'yuv420p');assert.ok(Math.abs(Number(meta.format.duration)-0.5)<0.1);
  assert.deepEqual(await readFile(join(dir,'workstation','media',id+'.mp4')),bytes,'Uploaded original must stay unchanged');
  // A broken source fails before creating a task; users can retry with another upload.
  const bad=Buffer.from('not a movie');
  const u=await fetch(base+`/api/workstation/media?kind=video&mime=video/mp4&size=${bad.length}`,{method:'POST',headers:{...origin,'Content-Type':'application/octet-stream'},body:bad});
  const badId=(await u.json()).id;
  assert.equal((await fetch(base+'/api/workstation/media/'+badId+'/compatibility',{method:'POST',headers:origin})).status,400);
 }finally{
  await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});
 }
});
