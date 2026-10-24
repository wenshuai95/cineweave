// 超级无敌 AI 视频工作台 v1.3.0 · 本地交付导出服务。
// 只做一件事：接收本次上传到服务专属目录的媒体，按整数帧剪辑计划用本机
// ffmpeg 裁切拼接 + 混合 A1 音轨，输出 H.264 / AAC 的 MP4。
// 安全边界：仅 localhost 同源；不接受任意本地路径 / 任意命令；spawn 一律
// 数组参数且 shell:false；不拼接未经验证的滤镜字符串；体积 / 数量 / 帧率 /
// 分辨率 / 总帧数全部显式上限。
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,rm,rename,stat} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {accessSync} from 'node:fs';
import {describeMediaCompatibility,compatibilityEncodeArgs,validateCompatibilitySource} from './media-compatibility.mjs';
import {MEDIA_OPERATIONS,processingOptions,processingEncodeArgs} from './media-processing.mjs';

const VERSION='1.21.0';
const MEDIA_MAX_BYTES=Number(process.env.WORKSTATION_MEDIA_MAX_BYTES)||300*1024*1024; // 单个上传媒体 ≤300MB
const MEDIA_MAX_COUNT=500;          // 服务端登记的媒体上限（与工程资产上限一致）
const MEDIA_TTL_MS=48*60*60*1000;   // 上传媒体保留 48 小时，超时清理
const SEGMENTS_MAX=200;             // 每轨片段上限（与 sequence.mjs 一致）
const TOTAL_FRAMES_MAX=30*3600;     // 成片 ≤1 小时（按 30fps 帧数上限）
const VOLUME_MIN=0,VOLUME_MAX=4;
const FPS_ALLOWED=new Set([24,25,30]);
const HEIGHT_ALLOWED=new Set([720,1080]);
const JOBS_MAX=20;                  // 保留最近 20 条导出记录
const JSON_BODY_MAX=2*1024*1024;
const MEDIA_EXTS={'video/mp4':'mp4','video/webm':'webm','audio/mpeg':'mp3','audio/mp3':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/mp4':'m4a','audio/webm':'webm'};
const AUDIO_MIMES=new Set(['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/webm']);

const root=process.env.JINGCHANG_DATA_DIR?resolve(process.env.JINGCHANG_DATA_DIR):fileURLToPath(new URL('./.local/',import.meta.url));
const dirs={media:join(root,'workstation','media'),exports:join(root,'workstation','exports'),tmp:join(root,'workstation','tmp')};

const resolveTool=(env,candidates)=>{
 const custom=(env||'').trim();
 if(custom)return custom;
 for(const c of candidates){try{accessSync(c);return c;}catch{}}
 return candidates.at(-1);
};
// 本机既有二进制：ffmpeg 在 /usr/local/bin，ffprobe 在 /opt/homebrew/bin（按开发要求）。
export const FFMPEG=resolveTool(process.env.FFMPEG_PATH,['/opt/homebrew/bin/ffmpeg','/usr/local/bin/ffmpeg','ffmpeg']);
export const FFPROBE=resolveTool(process.env.FFPROBE_PATH,['/opt/homebrew/bin/ffprobe','/usr/local/bin/ffprobe','ffprobe']);
let toolsChecked=null;
function toolsAvailable(){
 if(toolsChecked)return toolsChecked;
 toolsChecked={};
 for(const [name,bin] of [['ffmpeg',FFMPEG],['ffprobe',FFPROBE]]){
  try{toolsChecked[name]=spawnSync(bin,['-version'],{timeout:8000,shell:false,windowsHide:true}).status===0;}
  catch{toolsChecked[name]=false;}
 }
 return toolsChecked;
}

const media=new Map();   // id → {id,kind,name,mime,size,file,createdAt}
const jobs=new Map();    // id → 任务记录
let restored=false,restorePromise=null,queue=Promise.resolve(),persistQueue=Promise.resolve();

const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function ensureDirs(){await Promise.all(Object.values(dirs).map(d=>mkdir(d,{recursive:true,mode:0o700})));}
async function persistState(){
 const metadata=JSON.stringify([...media.values()].map(({file,...meta})=>meta));
 const records=JSON.stringify([...jobs.values()].map(({outputPath,...j})=>j));
 const write=async()=>{await ensureDirs();for(const [file,text] of [[join(dirs.media,'registry.json'),metadata],[join(dirs.exports,'jobs.json'),records]]){await writeFile(file+'.tmp',text,{mode:0o600});await rename(file+'.tmp',file);}};
 persistQueue=persistQueue.catch(()=>{}).then(write);return persistQueue;
}
async function restore(){
 if(restored)return;if(restorePromise)return restorePromise;
 restorePromise=(async()=>{
  await ensureDirs();
  try{for(const m of JSON.parse(await readFile(join(dirs.media,'registry.json'),'utf8')))if(m&&idOk(m.id)&&MEDIA_EXTS[m.mime]&&['video','audio'].includes(m.kind)){const file=join(dirs.media,m.id+'.'+MEDIA_EXTS[m.mime]);if(Date.now()-m.createdAt>MEDIA_TTL_MS){await rm(file,{force:true});continue;}if(await stat(file).then(v=>v.isFile()).catch(()=>false))media.set(m.id,{...m,file});}}catch{}
  try{for(const j of JSON.parse(await readFile(join(dirs.exports,'jobs.json'),'utf8')))if(j&&idOk(j.id)){const interrupted=['running','queued'].includes(j.status);jobs.set(j.id,{...j,outputPath:join(dirs.exports,j.id+(j.type==='processing'&&j.operation==='audio'?'.wav':'.mp4')),status:interrupted?'error':j.status,message:interrupted?(j.type==='compatibility'?'服务重启，兼容副本任务已中断，请重新生成':'服务重启，任务已中断，请重新导出'):j.message});}}catch{}
  await persistState();restored=true;
 })();return restorePromise;
}

const idOk=v=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v);
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max?v:null;
const num=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max?v:null;

async function readJsonBody(req){
 let text='',bytes=0;
 for await(const chunk of req){bytes+=chunk.length;text+=chunk;if(bytes>JSON_BODY_MAX)throw Error('请求过大');}
 if(!text)throw Error('请求体为空');
 const data=JSON.parse(text);
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('请求体格式错误');
 return data;
}

// ---- ffmpeg 执行 ----
function runTool(bin,args,{onProgress,signal}={}){
 return new Promise((resolveRun,rejectRun)=>{
  args=args.flatMap(a=>a==='-i'?['-protocol_whitelist','file,pipe','-i']:[a]);
  const child=spawn(bin,args,{shell:false,signal,windowsHide:true,stdio:['ignore',onProgress?'pipe':'ignore','pipe']});
  const timer=setTimeout(()=>child.kill('SIGKILL'),20*60*1000);timer.unref();
  let stderr='',out='';
  if(onProgress)child.stdout.on('data',chunk=>{
   out+=chunk.toString();if(out.length>65536)out=out.slice(-32768);
   for(const line of out.split('\n')){
    const hit=line.match(/^frame=(\d+)/);
    if(hit)onProgress(Number(hit[1]));
   }
   out=out.includes('\n')?out.slice(out.lastIndexOf('\n')+1):out;
  });
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-4000);});
  child.on('error',e=>{clearTimeout(timer);rejectRun(Error(e.code==='ENOENT'?'未找到 '+bin+'，无法进行本地导出':bin+' 启动失败'));});
  child.on('close',code=>{clearTimeout(timer);code===0?resolveRun():rejectRun(Error(bin+' 退出码 '+code+'：'+stderr.trim().slice(-1200)));});
 });
}
const secs=(frames,fps)=>(frames/fps).toFixed(6);
function videoFilter(width,height,fps){
 return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,fps=${fps},format=yuv420p,setsar=1`;
}
const AUDIO_ARGS=['-ar','48000','-ac','2','-c:a','aac','-b:a','192k'];
const PCM_ARGS=['-ar','48000','-ac','2','-c:a','pcm_s16le'];

async function probeMedia(id,entry=media.get(id)){
 if(!entry)throw Error('媒体不存在或已过期');
 const done=new Promise((resolveP,rejectP)=>{
  const child=spawn(FFPROBE,['-v','error','-protocol_whitelist','file,pipe','-print_format','json','-show_format','-show_streams',entry.file],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const timer=setTimeout(()=>child.kill('SIGKILL'),15000);timer.unref();
  let out='',err='';
  child.stdout.on('data',c=>{out+=c;if(out.length>1024*1024)child.kill('SIGKILL');});child.stderr.on('data',c=>err=(err+c).slice(-2000));
  child.on('error',()=>{clearTimeout(timer);rejectP(Error('ffprobe 不可用，无法读取媒体信息'));});
  child.on('close',async code=>{clearTimeout(timer);
   if(code!==0)return rejectP(Error('无法解析媒体：'+(err.trim().slice(-200)||'未知错误')));
   try{
    const data=JSON.parse(out),streams=data.streams||[];
    resolveP({id,kind:entry.kind,name:entry.name,mime:entry.mime,size:entry.size,
     durationSec:num(Number(data.format?.duration),0,24*3600)||null,
     width:int(streams.find(s=>s.codec_type==='video')?.width,1,16384)||null,
     height:int(streams.find(s=>s.codec_type==='video')?.height,1,16384)||null,
     hasVideo:streams.some(s=>s.codec_type==='video'),hasAudio:streams.some(s=>s.codec_type==='audio'),
     compatibility:describeMediaCompatibility(data,entry.mime)});
   }catch{rejectP(Error('媒体信息解析失败'));}
  });
 });
 return done;
}

// 视频片段 → 统一参数的 mpegts 段（无声素材补 anullsrc，保证每段都有音轨便于拼接）。
function transcodeVideoSegment({source,hasAudio,inFrame,frames,fps,width,height,volume,out,onFrame}){
 const args=['-hide_banner','-loglevel','error','-nostdin','-progress','pipe:1','-nostats','-y',
  '-ss',secs(inFrame,fps),'-i',source];
 if(!hasAudio)args.push('-f','lavfi','-t',secs(frames,fps),'-i','anullsrc=r=48000:cl=stereo');
 args.push('-t',secs(frames,fps),'-frames:v',String(frames),
  '-map','0:v:0','-map',hasAudio?'0:a:0':'1:a:0',
  '-vf',videoFilter(width,height,fps),
  '-c:v','libx264','-preset','veryfast','-crf','20','-bf','0',
  ...PCM_ARGS,'-af',`volume=${volume},apad,atrim=duration=${secs(frames,fps)},asetpts=PTS-STARTPTS`,
  '-f','matroska',out);
 return runTool(FFMPEG,args,{onProgress:onFrame});
}
function transcodeSilenceVideoSegment({frames,fps,width,height,out,onFrame}){
 const args=['-hide_banner','-loglevel','error','-nostdin','-progress','pipe:1','-nostats','-y',
  '-f','lavfi','-i',`color=c=black:s=${width}x${height}:r=${fps}`,'-f','lavfi','-i','anullsrc=r=48000:cl=stereo',
  '-t',secs(frames,fps),'-frames:v',String(frames),
  '-map','0:v:0','-map','1:a:0',
  '-c:v','libx264','-preset','veryfast','-crf','20','-bf','0',...PCM_ARGS,
  '-f','matroska',out];
 return runTool(FFMPEG,args,{onProgress:onFrame});
}
function transcodeAudioSegment({source,inFrame,frames,fps,volume,out}){
 const args=['-hide_banner','-loglevel','error','-nostdin','-y',
  '-ss',secs(inFrame,fps),'-i',source,'-t',secs(frames,fps),
  '-map','0:a:0','-af',`volume=${volume},apad,atrim=duration=${secs(frames,fps)},asetpts=PTS-STARTPTS`,
  ...PCM_ARGS,'-f','wav',out];
 return runTool(FFMPEG,args);
}
function transcodeSilenceAudioSegment({frames,fps,out}){
 const args=['-hide_banner','-loglevel','error','-nostdin','-y',
  '-f','lavfi','-t',secs(frames,fps),'-i','anullsrc=r=48000:cl=stereo',
  ...PCM_ARGS,'-f','wav',out];
 return runTool(FFMPEG,args);
}
async function writeConcatList(file,entries){
 await writeFile(file,entries.map(f=>`file '${f.replaceAll("'","'\\''")}'`).join('\n'),'utf8');
}
async function concatSegments(listPath,out,extra=[]){
 return runTool(FFMPEG,['-hide_banner','-loglevel','error','-nostdin','-y','-f','concat','-safe','0','-i',listPath,...extra,'-c','copy','-f','matroska',out]);
}

// ---- 导出计划校验 ----
export function parseExportPlan(body){
 const fps=FPS_ALLOWED.has(body?.fps)?body.fps:null;
 const height=HEIGHT_ALLOWED.has(body?.height)?body.height:null;
 if(!fps)throw Error('帧率仅支持 24 / 25 / 30');
 if(!height)throw Error('分辨率仅支持 720p / 1080p');
 const width=height===1080?1920:1280;
 const readTrack=(list,kind)=>{
  if(!Array.isArray(list)||(kind==='video'&&list.length<1)||list.length>SEGMENTS_MAX)throw Error(kind==='video'?'视频轨为空或超过 200 段':'音轨超过 200 段');
  let total=0;
  const segments=list.map(seg=>{
   if(!seg||typeof seg!=='object')throw Error('片段格式错误');
   const frames=int(seg.frames,1,SEGMENTS_MAX*24*3600);
   if(frames==null)throw Error('片段帧数无效');
   total+=frames;
   if(total>fps*3600)throw Error('成片超过 1 小时上限');
   if(seg.type==='silence')return {type:'silence',frames};
   const inFrame=int(seg.in,0,24*3600*fps);
   if(inFrame==null||!idOk(seg.mediaId))throw Error('片段入点或媒体引用无效');
   const entry=media.get(seg.mediaId);
   if(!entry)throw Error('媒体不存在或已过期，请重新上传');
   if(entry.kind!==kind)throw Error(kind==='video'?'视频轨只能使用视频素材':'音轨只能使用音频素材');
   const volume=seg.volume==null?1:num(Number(seg.volume),VOLUME_MIN,VOLUME_MAX);
   if(volume==null)throw Error('音量须在 0–4 之间');
   return {type:'media',mediaId:seg.mediaId,in:inFrame,frames,volume:seg.muted===true?0:volume};
  });
  return {segments,total};
 };
 const video=readTrack(body.video,'video');
 const audio=body.audio!=null?readTrack(body.audio,'audio'):{segments:[],total:0};
 if(audio.total>0&&audio.total!==video.total)throw Error('音轨总帧数必须与影片一致（请在客户端补齐静音）');
 return {fps,height,width,video:video.segments,audio:audio.segments,totalFrames:video.total};
}

// ---- 任务执行 ----
async function runExportJob(job,plan){
 const work=join(dirs.tmp,job.id);
 await rm(work,{recursive:true,force:true}).catch(()=>{});
 await mkdir(work,{recursive:true,mode:0o700});
 const set=(progress,message)=>{job.progress=Math.max(job.progress||0,Math.min(0.999,progress));job.message=message;};
 try{
  if(!toolsAvailable().ffmpeg||!toolsAvailable().ffprobe)throw Error('缺少本地输出工具（未找到 ffmpeg / ffprobe），无法导出');
  const total=plan.totalFrames;
  const sourceInfo=new Map();
  for(const seg of [...plan.video,...plan.audio])if(seg.type==='media'){
   if(!sourceInfo.has(seg.mediaId))sourceInfo.set(seg.mediaId,await probeMedia(seg.mediaId));
   const info=sourceInfo.get(seg.mediaId);
   if(!info.durationSec||seg.in+seg.frames>Math.floor(info.durationSec*plan.fps+0.01))throw Error('片段入出点超过源媒体时长：'+info.name);
   if(media.get(seg.mediaId).kind==='audio'&&!info.hasAudio)throw Error('媒体不含音频流：'+info.name);
  }
  const advance=doneFrames=>set(doneFrames/total*0.9,'正在转码片段…');
  let doneFrames=0;
  const videoTs=[];
  // 探测一次每个素材是否带音轨，避免逐段重复 ffprobe。
  const audioFlags=new Map();
  for(const seg of plan.video)if(seg.type==='media'&&!audioFlags.has(seg.mediaId)){const info=await probeMedia(seg.mediaId);if(!info.hasVideo)throw Error('媒体不含视频流：'+info.name);audioFlags.set(seg.mediaId,info.hasAudio);}
  let index=0;
  for(const seg of plan.video){
   const out=join(work,`v${index++}.mkv`);videoTs.push(out);
   const segStart=doneFrames;
   if(seg.type==='silence')await transcodeSilenceVideoSegment({frames:seg.frames,fps:plan.fps,width:plan.width,height:plan.height,out,onFrame:f=>advance(segStart+Math.min(seg.frames,f))});
   else await transcodeVideoSegment({source:media.get(seg.mediaId).file,hasAudio:audioFlags.get(seg.mediaId),inFrame:seg.in,frames:seg.frames,fps:plan.fps,width:plan.width,height:plan.height,volume:seg.volume,out,onFrame:f=>advance(segStart+Math.min(seg.frames,f))});
   doneFrames+=seg.frames;advance(doneFrames);
  }
  set(0.9,'正在拼接视频轨…');
  const videoConcat=join(work,'video.mkv');
  const videoList=join(work,'video-list.txt');
  await writeConcatList(videoList,videoTs);
  await concatSegments(videoList,videoConcat);
  let finalInput=videoConcat;
  if(plan.audio.length){
   set(0.93,'正在准备音轨…');
   const audioAac=[];let ai=0;
   for(const seg of plan.audio){
    const out=join(work,`a${ai++}.wav`);audioAac.push(out);
    if(seg.type==='silence')await transcodeSilenceAudioSegment({frames:seg.frames,fps:plan.fps,out});
    else await transcodeAudioSegment({source:media.get(seg.mediaId).file,inFrame:seg.in,frames:seg.frames,fps:plan.fps,volume:seg.volume,out});
   }
   const a1=join(work,'a1.wav'),aList=join(work,'audio-list.txt');
   await writeConcatList(aList,audioAac);
   await runTool(FFMPEG,['-hide_banner','-loglevel','error','-nostdin','-y','-f','concat','-safe','0','-i',aList,'-c','copy','-f','wav',a1]);
   set(0.96,'正在混合音轨…');
   finalInput=a1;
  }
  set(0.98,'正在封装 MP4…');
  const outPath=join(dirs.exports,job.id+'.mp4');
  const staged=join(work,'out.mp4');
  const inputs=['-i',videoConcat];
  let filter='[0:a]apad,atrim=duration='+secs(total,plan.fps)+',asetpts=PTS-STARTPTS[aout]';
  if(plan.audio.length){inputs.push('-i',finalInput);filter='[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=0,volume=2,apad,atrim=duration='+secs(total,plan.fps)+',asetpts=PTS-STARTPTS[aout]';}
  await runTool(FFMPEG,['-hide_banner','-loglevel','error','-nostdin','-y',...inputs,
   '-filter_complex',filter,'-map','0:v:0','-map','[aout]',
   '-vf',`fps=${plan.fps},setpts=PTS-STARTPTS`,'-frames:v',String(total),'-t',secs(total,plan.fps),
   '-c:v','libx264','-preset','veryfast','-crf','20','-bf','0',...AUDIO_ARGS,'-movflags','+faststart','-f','mp4',staged]);
  const info=await stat(staged);
  if(info.size<1024)throw Error('导出产物异常（过小），已中止');
  await rename(staged,outPath);
  job.status='done';job.progress=1;job.message='导出完成';job.outputPath=outPath;job.doneAt=Date.now();
 }catch(e){
  job.status='error';job.message=String(e.message||e).slice(0,300);
 }finally{
  await rm(work,{recursive:true,force:true}).catch(()=>{});
  await trimOldJobs().catch(()=>{});
  await persistState();
 }
}
function trimOldJobs(){
 const ordered=[...jobs.values()].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 // Never evict queued/running work while another export completes.
 const stale=ordered.filter(j=>!['running','queued'].includes(j.status)).slice(JOBS_MAX);
 return Promise.all(stale.map(j=>{jobs.delete(j.id);return j.outputPath?rm(j.outputPath,{force:true}):Promise.resolve();}));
}
function enqueueExport(plan){
 if([...jobs.values()].filter(j=>j.status==='running'||j.status==='queued').length>=3)throw Error('正在进行的导出任务过多，请稍后再试');
 const job={id:randomUUID(),status:'queued',progress:0,message:'排队中…',createdAt:Date.now(),frames:plan.totalFrames,fps:plan.fps,height:plan.height};
 jobs.set(job.id,job);
 queue=queue.catch(()=>{}).then(async()=>{
  if(jobs.get(job.id)?.status!=='queued')return;
  job.status='running';await runExportJob(job,plan);
 });
 return job;
}

async function enqueueCompatibility(sourceId){
 const source=media.get(sourceId);
 if(!source||source.kind!=='video')throw Error('请先上传需要修复的视频');
 const active=[...jobs.values()].filter(j=>['queued','running'].includes(j.status));
 const existing=active.find(j=>j.type==='compatibility'&&j.sourceId===sourceId);
 if(existing)return existing;
 if(active.length>=3)throw Error('正在进行的本地任务过多，请稍后再试');
 if(!toolsAvailable().ffmpeg||!toolsAvailable().ffprobe)throw Error('缺少本地视频工具，无法生成兼容副本');
 const info=await probeMedia(sourceId);validateCompatibilitySource(info);
 // Probe awaits a subprocess; recheck the limit before reserving a slot.
 if([...jobs.values()].filter(j=>['queued','running'].includes(j.status)).length>=3)throw Error('正在进行的本地任务过多，请稍后再试');
 const duplicate=[...jobs.values()].find(j=>j.type==='compatibility'&&j.sourceId===sourceId&&['queued','running'].includes(j.status));
 if(duplicate)return duplicate;
 const job={id:randomUUID(),type:'compatibility',sourceId,status:'queued',progress:0,message:'兼容副本排队中…',createdAt:Date.now(),name:source.name.replace(/\.[^.]+$/,'')+'-兼容副本.mp4',durationSec:info.durationSec,width:info.width,height:info.height,mime:'video/mp4'};
 jobs.set(job.id,job);
 queue=queue.catch(()=>{}).then(async()=>{
  if(job.status!=='queued')return;
  const outputPath=join(dirs.exports,job.id+'.mp4');
  try{
   job.status='running';job.message='正在生成兼容副本…';await persistState();
   await runTool(FFMPEG,compatibilityEncodeArgs(source.file,outputPath,MEDIA_MAX_BYTES),{onProgress:()=>{job.progress=0.5;}});
   const size=(await stat(outputPath)).size;
   if(!size||size>MEDIA_MAX_BYTES)throw Error('兼容副本大小超出上限');
   const result=await probeMedia(job.id,{...source,file:outputPath,mime:'video/mp4',size});
   if(!result.hasVideo||result.compatibility.videoCodec!=='h264'||!result.durationSec||Math.abs(result.durationSec-info.durationSec)>0.25)throw Error('兼容副本不完整');
   job.durationSec=result.durationSec;job.width=result.width;job.height=result.height;
   job.status='done';job.progress=1;job.size=size;job.message='兼容副本已生成，原视频保持不变';job.outputPath=outputPath;job.doneAt=Date.now();
  }catch{
   job.status='error';job.message='无法生成兼容副本，原视频保持不变。请检查素材是否完整、本地磁盘空间是否足够后重试。';
   await rm(outputPath,{force:true}).catch(()=>{});
  }finally{await trimOldJobs().catch(()=>{});await persistState();}
 });
 return job;
}
function compatibilityRecord(job){
 return {id:job.id,sourceId:job.sourceId,status:job.status,progress:job.progress||0,message:job.message,name:job.name,mime:job.mime,size:job.size||null,durationSec:job.durationSec,width:job.width,height:job.height,createdAt:job.createdAt,doneAt:job.doneAt||null,fileUrl:job.status==='done'?'/api/workstation/compatibility/'+job.id+'/file':null};
}


const processingControllers=new Map();
async function depthEngine(){
 try{
  const c=JSON.parse(await readFile(join(root,'depth-engine.json'),'utf8'));
  if(!['python','script','repo','checkpoint'].every(k=>typeof c[k]==='string'&&c[k].startsWith('/')))return null;
  for(const k of ['python','script','checkpoint'])await stat(c[k]);
  return c;
 }catch{return null;}
}
function processingRecord(job){
 return {id:job.id,sourceId:job.sourceId,operation:job.operation,status:job.status,progress:job.progress||0,message:job.message,name:job.name,mime:job.mime,size:job.size||null,durationSec:job.durationSec,width:job.width,height:job.height,createdAt:job.createdAt,fileUrl:job.status==='done'?'/api/workstation/processing/'+job.id+'/file':null};
}
async function enqueueProcessing(sourceId,raw){
 const source=media.get(sourceId);if(!source||source.kind!=='video')throw Error('请先导入视频');
 const info=await probeMedia(sourceId),opts=processingOptions(raw,info);
 if(!toolsAvailable().ffmpeg||!toolsAvailable().ffprobe)throw Error('本地素材处理工具不可用');
 const engine=opts.operation==='depth'?await depthEngine():null;
 if(opts.operation==='depth'&&!engine)throw Error('本机深度引擎尚未安装，请先使用其他素材工具');
 if([...jobs.values()].filter(j=>['queued','running'].includes(j.status)).length>=3)throw Error('正在进行的本地任务过多，请稍后再试');
 const job={id:randomUUID(),type:'processing',sourceId,...opts,status:'queued',progress:0,createdAt:Date.now(),message:'本机处理排队中…',name:source.name.replace(/\.[^.]+$/,'')+' · '+MEDIA_OPERATIONS[opts.operation]+(opts.operation==='audio'?'.wav':'.mp4'),mime:opts.operation==='audio'?'audio/wav':'video/mp4'};
 jobs.set(job.id,job);const controller=new AbortController();processingControllers.set(job.id,controller);
 queue=queue.catch(()=>{}).then(async()=>{
  if(job.status!=='queued'){processingControllers.delete(job.id);return;}
  const out=join(dirs.exports,job.id+(opts.operation==='audio'?'.wav':'.mp4')),work=join(dirs.tmp,job.id);
  try{
   job.status='running';job.message='正在'+MEDIA_OPERATIONS[opts.operation]+'…';await persistState();
   if(opts.operation==='depth'){
    await mkdir(work,{recursive:true});const clip=join(work,'clip.mp4');
    job.message='正在准备深度参考片段…';
    await runTool(FFMPEG,processingEncodeArgs(source.file,clip,{...opts,operation:'mute'}),{signal:controller.signal});
    job.message='正在估计深度，首版使用本机低分辨率模式…';job.progress=0.12;
    await runTool(engine.python,[engine.script,'--repo',engine.repo,'--checkpoint',engine.checkpoint,'--input',clip,'--output',out,'--ffmpeg',FFMPEG],{signal:controller.signal,onProgress:frame=>{job.progress=Math.min(.92,.15+frame/Math.max(1,Math.ceil(opts.durationSec*12))*.75);}});
   }else{
    await runTool(FFMPEG,processingEncodeArgs(source.file,out,opts),{signal:controller.signal,onProgress:frame=>{job.progress=Math.min(.92,frame/Math.max(1,opts.durationSec*30));}});
   }
   if(controller.signal.aborted)throw Error('canceled');
   const size=(await stat(out)).size;if(!size||size>MEDIA_MAX_BYTES)throw Error('result size');
   const verified=await probeMedia(job.id,{...source,file:out,mime:job.mime,size});
   if(opts.operation==='audio'?!verified.hasAudio:!verified.hasVideo)throw Error('stream missing');
   if(!verified.durationSec||Math.abs(verified.durationSec-opts.durationSec)>(opts.operation==='depth'?.18:.15))throw Error('incomplete result');
   if(controller.signal.aborted)throw Error('canceled');
   Object.assign(job,{status:'done',progress:1,message:MEDIA_OPERATIONS[opts.operation]+'已完成，原素材已保留',size,outputPath:out,durationSec:verified.durationSec,width:verified.width,height:verified.height,doneAt:Date.now()});
  }catch{
   job.status=controller.signal.aborted?'canceled':'error';job.message=controller.signal.aborted?'已取消，原素材保持不变':'处理失败，原素材保持不变。请检查视频完整性、可用内存和磁盘空间后重试。';
   await rm(out,{force:true}).catch(()=>{});
  }finally{processingControllers.delete(job.id);await rm(work,{recursive:true,force:true}).catch(()=>{});await trimOldJobs().catch(()=>{});await persistState();}
 });
 return job;
}

// ---- 上传 ----
async function acceptUpload(req,res,url){
 const params=url.searchParams;
 const name=String(params.get('name')||'媒体').replace(/[\u0000-\u001f\\/:"*?<>|]/g,'').slice(0,200)||'媒体';
 const kind=params.get('kind');
 const mime=String(params.get('mime')||'');
 const size=int(Number(params.get('size')),1,MEDIA_MAX_BYTES);
 if(kind!=='video'&&kind!=='audio')throw Error('仅支持上传视频或音频');
 if(AUDIO_MIMES.has(mime)?kind!=='audio':!MEDIA_EXTS[mime]||kind!=='video')throw Error('媒体类型与声明的轨道不符');
 if(size==null)throw Error(`单个媒体不能超过 ${Math.round(MEDIA_MAX_BYTES/1024/1024)} MB`);
 if(media.size>=MEDIA_MAX_COUNT)throw Error('服务端媒体数量已达上限，请稍后清理');
 await ensureDirs();
 const id=randomUUID();
 const file=join(dirs.media,id+'.'+(MEDIA_EXTS[mime]||'bin'));
 let received=0;
 const counter=new (await import('node:stream')).Transform({transform(chunk,_enc,cb){received+=chunk.length;if(received>size){cb(Error('上传数据超过声明大小'));return;}cb(null,chunk);}});
 try{
  await pipeline(req,counter,createWriteStream(file,{mode:0o600}));
 }catch(e){
  await rm(file,{force:true}).catch(()=>{});
  throw Error('上传失败：'+(e.message||'数据中断'));
 }
 if(received!==size){await rm(file,{force:true}).catch(()=>{});throw Error('上传数据与声明大小不符');}
 media.set(id,{id,kind,name,mime,size:received,file,createdAt:Date.now()});
 await persistState();
 json(res,{id,size:received});
}

// ---- 路由入口（挂接在 server.mjs，先于静态文件与 405 闸门） ----
export async function handleWorkstation(req,res,url){
 if(!url.pathname.startsWith('/api/workstation/'))return false;
 try{
  await restore();
  const expected='http://'+req.headers.host;
  if(req.headers.origin&&req.headers.origin!==expected){json(res,{error:'仅允许本机软件同源访问'},403);return true;}
  const parts=url.pathname.split('/').filter(Boolean); // ['api','workstation',...]
  const tail=parts.slice(2);
 
 if(req.method==='POST'&&url.pathname==='/api/workstation/normalize'){
  if(req.headers.origin!==expected){json(res,{error:'仅允许本机软件同源访问'},403);return true;}
  if(!String(req.headers['content-type']||'').startsWith('application/octet-stream')){json(res,{error:'上传内容类型无效'},400);return true;}
  const tools=toolsAvailable();
  if(!tools.ffmpeg){json(res,{error:'本机未找到 ffmpeg，无法规范化为 24fps'},503);return true;}
  const fps=int(Number(url.searchParams.get('fps')||24),1,60)||24;
  await ensureDirs();
  const id=randomUUID(),input=join(dirs.tmp,id+'-input.mp4'),output=join(dirs.tmp,id+'-output.mp4');
  try{
   let received=0;
   const limiter=new (await import('node:stream')).Transform({transform(chunk,_enc,cb){received+=chunk.length;if(received>MEDIA_MAX_BYTES){cb(Error('视频超过大小上限'));return;}cb(null,chunk);}});
   await pipeline(req,limiter,createWriteStream(input,{mode:0o600}));
   await runTool(FFMPEG,['-y','-i',input,'-an','-vf',`fps=${fps}`,'-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output]);
   const data=await readFile(output);
   res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':data.length,'Cache-Control':'no-store'});res.end(data);return true;
  }finally{await rm(input,{force:true}).catch(()=>{});await rm(output,{force:true}).catch(()=>{});}
 }

 if(req.method==='GET'&&url.pathname==='/api/workstation/health'){
   const tools=toolsAvailable();
   json(res,{app:'ai-video-workstation',version:VERSION,local:true,ffmpeg:tools.ffmpeg,ffprobe:tools.ffprobe,ffmpegPath:tools.ffmpeg?FFMPEG:null,
    limits:{mediaMaxBytes:MEDIA_MAX_BYTES,mediaMaxCount:MEDIA_MAX_COUNT,segmentsMax:SEGMENTS_MAX,totalFramesMax:TOTAL_FRAMES_MAX,fps:[...FPS_ALLOWED],heights:[...HEIGHT_ALLOWED]}});
   return true;
  }
  if(req.method==='POST'&&url.pathname==='/api/workstation/media'){
   if(req.headers.origin!==expected){json(res,{error:'仅允许本机软件同源访问'},403);return true;}
   if(!String(req.headers['content-type']||'').startsWith('application/octet-stream')){json(res,{error:'上传内容类型无效'},400);return true;}
   await acceptUpload(req,res,url);
   return true;
  }
  if(req.method==='GET'&&tail[0]==='media'&&tail.length===2){
   const info=await probeMedia(tail[1]);
   json(res,info);
   return true;
  }

  if(req.method==='GET'&&tail[0]==='processing-capabilities'){
   json(res,{operations:['trim','audio','mute'],depth:!!await depthEngine(),depthMaxSeconds:15,depthNote:'本机实验模式，最长15秒，12fps，输出长边不超过640像素；不是三维白模重建。'});return true;
  }
  if(req.method==='POST'&&tail[0]==='media'&&tail.length===3&&tail[2]==='processing'){
   if(req.headers.origin!==expected){json(res,{error:'仅允许本机软件同源访问'},403);return true;}
   const job=await enqueueProcessing(tail[1],await readJsonBody(req));await persistState();json(res,processingRecord(job));return true;
  }
  if(tail[0]==='processing'&&tail.length>=2){
   const job=jobs.get(tail[1]);if(!job||job.type!=='processing'){json(res,{error:'素材处理任务不存在'},404);return true;}
   if(req.method==='POST'&&tail.length===3&&tail[2]==='cancel'){
    if(req.headers.origin!==expected){json(res,{error:'仅允许本机软件同源访问'},403);return true;}
    if(['running','queued'].includes(job.status)){job.status='canceled';job.message='已取消，原素材保持不变';processingControllers.get(job.id)?.abort();await persistState();}
    json(res,processingRecord(job));return true;
   }
   if(req.method==='GET'&&tail.length===2){json(res,processingRecord(job));return true;}
   if(req.method==='GET'&&tail.length===3&&tail[2]==='file'){
    if(job.status!=='done'||!job.outputPath){json(res,{error:'素材处理尚未完成'},409);return true;}
    const info=await stat(job.outputPath).catch(()=>null);if(!info){json(res,{error:'处理结果已过期'},410);return true;}
    res.writeHead(200,{'Content-Type':job.mime,'Content-Length':info.size,'Cache-Control':'no-store'});await pipeline(createReadStream(job.outputPath),res);return true;
   }
  }

  if(req.method==='POST'&&tail[0]==='media'&&tail.length===3&&tail[2]==='compatibility'){
   if(req.headers.origin!==expected){json(res,{error:'仅允许本机软件同源访问'},403);return true;}
   const job=await enqueueCompatibility(tail[1]);await persistState();json(res,compatibilityRecord(job));return true;
  }
  if(req.method==='GET'&&tail[0]==='compatibility'&&(tail.length===2||tail.length===3&&tail[2]==='file')){
   const job=jobs.get(tail[1]);
   if(!job||job.type!=='compatibility'){json(res,{error:'兼容副本任务不存在'},404);return true;}
   if(tail[2]==='file'){
    if(job.status!=='done'||!job.outputPath){json(res,{error:'兼容副本尚未完成'},409);return true;}
    let info;try{info=await stat(job.outputPath);}catch{json(res,{error:'兼容副本已清理，请重新生成'},410);return true;}
    res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':info.size,'Content-Disposition':`attachment; filename="compatible-${job.id.slice(0,8)}.mp4"`,'Cache-Control':'no-store'});
    await pipeline(createReadStream(job.outputPath),res);return true;
   }
   json(res,compatibilityRecord(job));return true;
  }
  if(req.method==='POST'&&url.pathname==='/api/workstation/export'){
   if(req.headers.origin!==expected){json(res,{error:'仅允许本机软件同源访问'},403);return true;}
   if(!String(req.headers['content-type']||'').startsWith('application/json')){json(res,{error:'请求类型无效'},400);return true;}
   const plan=parseExportPlan(await readJsonBody(req));
   const job=enqueueExport(plan);await persistState();
   json(res,{id:job.id,status:job.status,frames:job.frames,fps:job.fps,height:job.height});
   return true;
  }
  if(req.method==='GET'&&tail[0]==='export'&&tail.length>=2){
   const job=jobs.get(tail[1]);
   if(!job){json(res,{error:'导出任务不存在'},404);return true;}
   if(tail[2]==='file'){
    if(job.status!=='done'||!job.outputPath){json(res,{error:'导出尚未完成'},409);return true;}
    const info=await stat(job.outputPath);
    res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':info.size,'Content-Disposition':`attachment; filename="workstation-${job.id.slice(0,8)}.mp4"`,'Cache-Control':'no-store'});
    await pipeline(createReadStream(job.outputPath),res);
    return true;
   }
   json(res,{id:job.id,status:job.status,progress:Math.round((job.progress||0)*1000)/1000,message:job.message,frames:job.frames,fps:job.fps,height:job.height,createdAt:job.createdAt,doneAt:job.doneAt||null});
   return true;
  }
  json(res,{error:'接口不存在'},404);return true;
 }catch(e){json(res,{error:String(e.message||e).slice(0,300)},400);return true;}
}
