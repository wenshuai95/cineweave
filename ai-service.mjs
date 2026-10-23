import {createOiioiiVideoService} from './oiioii-video-service.mjs';
import {FFPROBE} from './workstation-server.mjs';
import {generateWriting} from './text-writing.mjs';
import {createLocalModelStore} from './model3d-service.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,stat,rm,rename,chmod} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {join,resolve,sep} from 'node:path';
import {homedir} from 'node:os';
import {validatePlan} from './src/ai-plans.mjs';
const exec=promisify(execFile),token=randomUUID(),quotes=new Map(),jobs=new Map();
const folder=process.env.JINGCHANG_DATA_DIR?pathToFileURL(resolve(process.env.JINGCHANG_DATA_DIR)+sep):new URL('./.local/',import.meta.url),cli=process.env.OIIOII_CLI||(process.platform==='win32'?join(homedir(),'.local','bin','oiioii.exe'):join(homedir(),'.local/bin/oiioii')),cliIsScript=/\.(cjs|mjs|js)$/i.test(cli);
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
async function run(args,timeout=90000){try{const {stdout}=await exec(...(cliIsScript?[process.execPath,[cli,...args]]:[cli,args]),{env:{...process.env,OIIOII_LOG_DISABLED:'1',OIIOII_TELEMETRY_DISABLED:'1'},timeout,maxBuffer:12*1024*1024,shell:false,windowsHide:true});const data=JSON.parse(stdout);if(!data.ok)throw Error(data.error?.message||'oiioii 请求失败');return data.data;}catch(e){if(e.code==='ENOENT')throw Error('未找到 oiioii CLI，请安装官方 CLI 或设置 OIIOII_CLI');let message;try{message=JSON.parse(e.stdout).error?.message}catch{}throw Error(message||'oiioii 请求失败，请检查本机 CLI 授权或网络');}}
async function body(req,limit=15*1024*1024){const chunks=[];let bytes=0;for await(const part of req){const chunk=Buffer.isBuffer(part)?part:Buffer.from(part);bytes+=chunk.length;if(bytes>limit)throw Error('请求过大');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
const videoService=createOiioiiVideoService({folder:fileURLToPath(new URL('video/',folder)),run,probe:async file=>{const {stdout}=await exec(FFPROBE,['-v','error','-protocol_whitelist','file,pipe','-show_entries','format=duration','-of','json',file],{timeout:15000,maxBuffer:65536,shell:false});return Number(JSON.parse(stdout).format.duration);}});
let config={key:process.env.DEEPSEEK_API_KEY||'',base:process.env.DEEPSEEK_BASE_URL||'https://api.deepseek.com',model:(process.env.DEEPSEEK_MODEL||'deepseek-flash')};
const model3d=createLocalModelStore({folder:fileURLToPath(new URL('model3d/',folder))});
let remembered=false,configRevision=0,connection={state:'untested'};
const publicConfig=()=>({configured:!!config.key,base:config.base,model:config.model,remembered,connection});
const configFile=new URL('text-model.json',folder);
const configReady=(async()=>{try{const saved=JSON.parse(await readFile(configFile,'utf8'));const u=new URL(saved.base);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&typeof saved.key==='string'&&saved.key.length<=4096&&typeof saved.model==='string'){config={base:saved.base,model:saved.model,key:saved.key};remembered=true;}}catch{}})();
let configSaving=Promise.resolve();
async function storeConfig(next,remember){const job=async()=>{if(!remember){await rm(configFile,{force:true});return;}await mkdir(folder,{recursive:true,mode:0o700});const temp=new URL('text-model.'+randomUUID()+'.tmp',folder);await writeFile(temp,JSON.stringify(next),{mode:0o600});await chmod(temp,0o600);await rename(temp,configFile);};configSaving=configSaving.catch(()=>{}).then(job);await configSaving;}
let restoreJobsPromise=null,jobsSaving=Promise.resolve();
async function restore(){if(!restoreJobsPromise)restoreJobsPromise=(async()=>{try{const list=JSON.parse(await readFile(new URL('jobs.json',folder),'utf8'));for(const job of list)jobs.set(job.id,job)}catch{}})();await restoreJobsPromise;}
async function saveJobs(){const data=JSON.stringify([...jobs.values()]);jobsSaving=jobsSaving.catch(()=>{}).then(async()=>{await mkdir(folder,{recursive:true,mode:0o700});const temp=new URL('jobs.'+randomUUID()+'.tmp',folder);await writeFile(temp,data,{mode:0o600});await rename(temp,new URL('jobs.json',folder));});await jobsSaving;}
const cleanJob=j=>({id:j.id,status:j.status,message:j.message,imageUrl:j.imagePath?'/api/oiioii/image/'+j.id:undefined});
export async function handleAI(req,res,url){
 if(!url.pathname.startsWith('/api/ai/')&&!url.pathname.startsWith('/api/oiioii/')&&!url.pathname.startsWith('/api/model3d/'))return false;
 try{
  await configReady;await restore();const expected='http://'+req.headers.host;
  if(req.headers.origin&&req.headers.origin!==expected){json(res,{error:'仅允许本机软件同源访问'},403);return true;}
  if(req.method==='POST'&&(req.headers['x-jingchang-token']!==token||!String(req.headers['content-type']).startsWith('application/json'))){json(res,{error:'请求验证失败，请刷新软件'},403);return true;}
  if(req.method==='GET'&&url.pathname==='/api/ai/text/status'){json(res,{token,config:publicConfig()});return true;}
  if(req.method==='POST'&&url.pathname==='/api/ai/text/generate'){
   const b=await body(req),controller=new AbortController();const cancel=()=>{if(!res.writableEnded)controller.abort();};res.on?.('close',cancel);
   const revision=configRevision;try{const result=await generateWriting({...config},b,{signal:controller.signal});if(!controller.signal.aborted){if(revision===configRevision)connection={state:'connected',checkedAt:Date.now()};json(res,result);}}catch(e){if(revision===configRevision&&!controller.signal.aborted&&(b.kind==='test'||/^(HTTP|模型服务|请先)/.test(e.message)))connection={state:'error',message:e.message,checkedAt:Date.now()};throw e;}finally{res.off?.('close',cancel);}return true;
  }
  if(req.method==='GET'&&url.pathname==='/api/ai/storage'){json(res,{dataDirectory:fileURLToPath(folder),imagesDirectory:fileURLToPath(new URL('generated/',folder)),modelsDirectory:fileURLToPath(new URL('model3d/',folder)),assetsDirectory:fileURLToPath(new URL('./dist/assets/',import.meta.url)),directorySource:process.env.JINGCHANG_DATA_DIR?'environment':'default',canChangeDirectory:false});return true;}
  if(req.method==='GET'&&url.pathname==='/api/ai/status'){let auth=false;try{auth=!!(await run(['auth','status','--json'])).authenticated}catch{}json(res,{token,oiioii:auth,deepseek:!!config.key,config:publicConfig()});return true;}
  if(req.method==='GET'&&url.pathname.startsWith('/api/model3d/model/')){const data=await model3d.model(url.pathname.split('/').at(-1));res.writeHead(200,{'Content-Type':'model/gltf-binary','Cache-Control':'no-store'});res.end(data);return true;}
  if(url.pathname.startsWith('/api/model3d/')){json(res,{error:'云端 3D 建模接口已移除，请导入本地 GLB 模型'},410);return true;}
  if(req.method==='POST'&&['/api/ai/config','/api/ai/text/config'].includes(url.pathname)){
   const b=await body(req);let base;try{base=new URL(b.base)}catch{throw Error('请输入有效的 API 基础地址')}
   if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error('API 基础地址须为 HTTPS，且不含账号、参数或片段');
   if(typeof b.model!=='string'||!b.model.trim()||b.model.length>120||/[\r\n]/.test(b.model))throw Error('请输入有效模型 ID');
   if(b.key!==undefined&&(typeof b.key!=='string'||b.key.length>4096||/[\r\n]/.test(b.key)))throw Error('API Key 格式无效');
   if(base.origin!==new URL(config.base).origin&&!b.key?.trim()&&!b.clear)throw Error('更换服务商域名时请重新输入对应 API Key');
   const next={base:base.href.replace(/\/$/,'').replace(/\/chat\/completions$/,''),model:b.model.trim(),key:b.clear?'':b.key?.trim()||config.key};
   const keep=(b.remember===undefined?remembered:b.remember===true)&&!b.clear;
   await storeConfig(next,keep);remembered=keep;
   config=next;configRevision++;connection={state:'untested'};
   json(res,{config:publicConfig()});return true;
  }
  if(req.method==='GET'&&url.pathname==='/api/oiioii/video/models'){json(res,{models:await videoService.models()});return true;}
  if(req.method==='POST'&&url.pathname==='/api/oiioii/video/quote'){json(res,await videoService.quote(await body(req,120*1024*1024)));return true;}
  if(req.method==='POST'&&url.pathname==='/api/oiioii/video/generate'){json(res,await videoService.generate(await body(req)));return true;}
  if(req.method==='GET'&&url.pathname==='/api/oiioii/video/tasks'){json(res,{jobs:await videoService.list(url.searchParams.get('projectId'))});return true;}
  if(req.method==='GET'&&url.pathname.startsWith('/api/oiioii/video/task/')){json(res,await videoService.poll(url.pathname.split('/').at(-1)));return true;}
  if(req.method==='GET'&&url.pathname.startsWith('/api/oiioii/video/file/')){const data=await videoService.file(url.pathname.split('/').at(-1));res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':data.length,'Cache-Control':'no-store'});res.end(data);return true;}
  if(req.method==='GET'&&url.pathname==='/api/oiioii/models'){const d=await run(['inspect','models','--domain','image','--json']);json(res,{models:d.models.map(m=>({id:String(m.id),name:m.name,sizes:m.sizes||[],aspects:m.aspect_ratios||[]}))});return true;}
  if(req.method==='POST'&&url.pathname==='/api/oiioii/quote'){
   const b=await body(req);if(!/^[\w.-]{1,100}$/.test(b.modelId)||!/^([\w:x.-]{1,40})?$/.test(b.resolution||'')||!(/^(\d+(\.\d+)?:\d+(\.\d+)?|Auto)$/i.test(b.aspect||'')))throw Error('请选择有效模型、尺寸和画幅');
   const args=['points','quote','--model-id',b.modelId];if(b.resolution)args.push('--resolution',b.resolution);args.push('--json');const d=await run(args),id=randomUUID();quotes.set(id,{...b,expires:Date.now()+600000});json(res,{quoteId:id,points:d.estimated_points,sufficient:d.sufficient,caveat:d.caveat||'预估积分，实际以平台结算为准'});return true;
  }
  if(req.method==='POST'&&url.pathname==='/api/oiioii/generate'){
   const b=await body(req),q=quotes.get(b.quoteId);if(!q||q.expires<Date.now())throw Error('报价已过期，请重新获取');if(typeof b.prompt!=='string'||!b.prompt.trim()||b.prompt.length>6000)throw Error('描述需为 1–6000 字符');
   const existing=[...jobs.values()].find(j=>j.quoteId===b.quoteId);if(existing){json(res,cleanJob(existing));return true;}
   const job={id:randomUUID(),quoteId:b.quoteId,status:'submitting'};jobs.set(job.id,job);await saveJobs();
   try{const workspace=await run(['workspace','current','--json']);if(!workspace.workspace_id)throw Error('请先设置 oiioii 工作空间');const args=['image','text','--prompt',b.prompt,'--model-id',q.modelId,'--aspect-ratio',q.aspect,'--workspace',String(workspace.workspace_id)];if(q.resolution)args.push('--resolution',q.resolution);args.push('--json');const d=await run(args);job.cliId=d.local_task_id||d.task_id;if(!job.cliId)throw Error('平台未返回任务 ID');job.status='pending';}
   catch{job.status='unknown';job.message='提交结果不确定。请在 oiioii 核对任务记录，勿重复提交以免重复扣积分。';}await saveJobs();json(res,cleanJob(job));return true;
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/oiioii/task/')){
   const job=jobs.get(url.pathname.split('/').at(-1));if(!job)throw Error('任务不存在');if(job.status==='pending'){
    const d=await run(['task','status',job.cliId,'--json']),t=d.task;if(t?.status==='succeeded'){
     const uri=t.resourceUris?.find(u=>typeof u==='string'&&u.startsWith('hogi://image/'));if(!uri)throw Error('任务完成但未返回图片资源');
     await mkdir(new URL('generated/',folder),{recursive:true,mode:0o700});const output=resolve(fileURLToPath(new URL('generated/',folder)),job.id+'.png');const r=await run(['record','open',uri,'--output',output,'--no-open','--json']);const path=resolve(r.path||output);if(path!==output)throw Error('生成文件路径不匹配');const info=await stat(path);if(info.size>25*1024*1024)throw Error('图片超过 25 MB，请从 oiioii 下载');job.imagePath=path;job.status='succeeded';
    }else if(['failed','cancelled'].includes(t?.status)){job.status=t.status;job.message='平台生成失败或已取消，请查看 oiioii 任务记录';}await saveJobs();
   }json(res,cleanJob(job));return true;
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/oiioii/image/')){const j=jobs.get(url.pathname.split('/').at(-1));if(!j?.imagePath)throw Error('图片尚未就绪');const data=await readFile(j.imagePath);const mime=data[0]===137&&data[1]===80?'image/png':data[0]===255&&data[1]===216?'image/jpeg':data.toString('ascii',8,12)==='WEBP'?'image/webp':null;if(!mime)throw Error('图片格式不支持');res.writeHead(200,{'Content-Type':mime});res.end(data);return true;}
  if(req.method==='POST'&&url.pathname==='/api/ai/plan'){
   if(!config.key)throw Error('请先点击顶部 API 设置，填写服务地址、模型 ID 和 API Key');
   const b=await body(req);if(!['motion','scene'].includes(b.kind)||typeof b.prompt!=='string'||b.prompt.length>6000||!Number.isFinite(b.duration)||b.duration<1||b.duration>120)throw Error('方案输入无效');
   const assets=JSON.parse(await readFile(new URL('./public/assets/manifest.json',import.meta.url),'utf8')).assets;
   const schema=b.kind==='motion'?'输出 {clips:[{pose:"stand|walk|run|sit|point|wave|cheer",start:秒,end:秒,speed:0.1到4}],waypoints:[{t:秒,position:[x,y,z],rotation:度}]}。仅用已有动作。片段不重叠，时间在工程内，坐标米，前方-Z。':'输出 {objects:[{type:"actor|box|wall|table|pillar|model",assetId:"模型资产ID，model必需",name:"中文名称",position:[x,y,z],rotation:度,scale:0.1到20}]}。最多50对象，米制，地面Y=0。生成布局而非网格。';
   const content=[{type:'text',text:b.prompt+'\n工程时长:'+b.duration+'秒；当前角色位置:'+JSON.stringify(b.position||[0,0,0])+'；开始:'+Number(b.start||0)+'秒'}];
   for(const image of (b.images||[]).slice(0,2)){if(typeof image!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(image))throw Error('参考图格式不支持');content.push({type:'image_url',image_url:{url:image}});}
   const base=config.base;if(!base.startsWith('https://'))throw Error('DeepSeek 服务地址必须使用 HTTPS');
   const response=await fetch(base.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,messages:[{role:'system',content:'你是预演场景规划器，只输出 JSON，不输出代码。'+schema+'可用资产:'+JSON.stringify(assets.map(a=>({id:a.id,name:a.name,category:a.category})))},{role:'user',content}],response_format:{type:'json_object'},max_tokens:4000}),signal:AbortSignal.timeout(90000)});
   if(!response.ok)throw Error('DeepSeek 返回 '+response.status+'，请核对 API 配额、模型和服务地址');const result=await response.json(),plan=validatePlan(JSON.parse(result.choices[0].message.content),b.kind,b.duration,assets);json(res,{plan});return true;
  }
  json(res,{error:'接口不存在'},404);return true;
 }catch(e){json(res,{error:e.message},400);return true;}
}
