import {generateWriting} from './text-writing.mjs';
import {createLocalModelStore} from './model3d-service.mjs';
import {createProviderService} from './provider-service.mjs';
import {createComfyService} from './comfy-service.mjs';
import {createVideoService} from './video-service.mjs';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,stat,rm,rename,chmod} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {validatePlan} from './src/ai-plans.mjs';
const token=randomUUID();
const folder=process.env.JINGCHANG_DATA_DIR?pathToFileURL(resolve(process.env.JINGCHANG_DATA_DIR)+sep):new URL('./.local/',import.meta.url);
const providerService=createProviderService({folder:fileURLToPath(folder)});
const comfyService=createComfyService({folder:fileURLToPath(folder)});
const providerVideoService=createVideoService({folder:fileURLToPath(folder)});
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
async function body(req,limit=15*1024*1024){const chunks=[];let bytes=0;for await(const part of req){const chunk=Buffer.isBuffer(part)?part:Buffer.from(part);bytes+=chunk.length;if(bytes>limit)throw Error('请求过大');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
let config={key:process.env.DEEPSEEK_API_KEY||'',base:process.env.DEEPSEEK_BASE_URL||'https://api.deepseek.com',model:(process.env.DEEPSEEK_MODEL||'deepseek-flash')};
const model3d=createLocalModelStore({folder:fileURLToPath(new URL('model3d/',folder))});
let remembered=false,configRevision=0,connection={state:'untested'};
const publicConfig=()=>({configured:!!config.key,base:config.base,model:config.model,remembered,connection});
const configFile=new URL('text-model.json',folder);
const configReady=(async()=>{try{const saved=JSON.parse(await readFile(configFile,'utf8'));const u=new URL(saved.base);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&typeof saved.key==='string'&&saved.key.length<=4096&&typeof saved.model==='string'){config={base:saved.base,model:saved.model,key:saved.key};remembered=true;}}catch{}})();
let configSaving=Promise.resolve();
async function storeConfig(next,remember){const job=async()=>{if(!remember){await rm(configFile,{force:true});return;}await mkdir(folder,{recursive:true,mode:0o700});const temp=new URL('text-model.'+randomUUID()+'.tmp',folder);await writeFile(temp,JSON.stringify(next),{mode:0o600});await chmod(temp,0o600);await rename(temp,configFile);};configSaving=configSaving.catch(()=>{}).then(job);await configSaving;}
export async function handleAI(req,res,url){
 if(!url.pathname.startsWith('/api/ai/')&&!url.pathname.startsWith('/api/model3d/')&&url.pathname!=='/api/providers'&&!url.pathname.startsWith('/api/providers/')&&!url.pathname.startsWith('/api/comfy/')&&!url.pathname.startsWith('/api/video/'))return false;
 try{
  await configReady;const expected='http://'+req.headers.host;
  if(req.headers.origin&&req.headers.origin!==expected){json(res,{error:'仅允许本机软件同源访问'},403);return true;}
  if(req.method==='POST'&&(req.headers['x-jingchang-token']!==token||!String(req.headers['content-type']).startsWith('application/json'))){json(res,{error:'请求验证失败，请刷新软件'},403);return true;}
  if(req.method==='GET'&&url.pathname==='/api/ai/text/status'){json(res,{token,config:publicConfig()});return true;}
  if(req.method==='POST'&&url.pathname==='/api/ai/text/generate'){
   const b=await body(req),controller=new AbortController();const cancel=()=>{if(!res.writableEnded)controller.abort();};res.on?.('close',cancel);
   const revision=configRevision;try{const result=await generateWriting({...config},b,{signal:controller.signal});if(!controller.signal.aborted){if(revision===configRevision)connection={state:'connected',checkedAt:Date.now()};json(res,result);}}catch(e){if(revision===configRevision&&!controller.signal.aborted&&(b.kind==='test'||/^(HTTP|模型服务|请先)/.test(e.message)))connection={state:'error',message:e.message,checkedAt:Date.now()};throw e;}finally{res.off?.('close',cancel);}return true;
  }
  if(req.method==='GET'&&url.pathname==='/api/ai/storage'){json(res,{dataDirectory:fileURLToPath(folder),imagesDirectory:fileURLToPath(new URL('generated/',folder)),modelsDirectory:fileURLToPath(new URL('model3d/',folder)),assetsDirectory:fileURLToPath(new URL('./dist/assets/',import.meta.url)),directorySource:process.env.JINGCHANG_DATA_DIR?'environment':'default',canChangeDirectory:false});return true;}
  if(req.method==='GET'&&url.pathname==='/api/ai/status'){json(res,{token,deepseek:!!config.key,config:publicConfig()});return true;}
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
  if(req.method==='GET'&&url.pathname==='/api/video/kling/config'){await providerVideoService.ready();json(res,{config:providerVideoService.klingStatus()});return true;}
  if(req.method==='POST'&&url.pathname==='/api/video/kling/config'){json(res,{config:await providerVideoService.configureKling(await body(req))});return true;}
  if(req.method==='GET'&&url.pathname==='/api/video/providers'){json(res,{providers:providerVideoService.descriptors()});return true;}
  if(req.method==='GET'&&url.pathname==='/api/video/models'){json(res,{models:await providerVideoService.models(url.searchParams.get('providerId')||'fake')});return true;}
  if(req.method==='GET'&&url.pathname==='/api/video/health'){json(res,await providerVideoService.health(url.searchParams.get('providerId')||'fake'));return true;}
  if(req.method==='POST'&&url.pathname==='/api/video/quote'){json(res,await providerVideoService.quote(await body(req)));return true;}
  if(req.method==='POST'&&url.pathname==='/api/video/generate'){json(res,await providerVideoService.submit(await body(req)));return true;}
  if(req.method==='GET'&&url.pathname==='/api/video/tasks'){await providerVideoService.ready();json(res,{tasks:providerVideoService.tasks(url.searchParams.get('projectId')||undefined)});return true;}
  if(req.method==='GET'&&url.pathname.startsWith('/api/video/task/')&&!url.pathname.includes('/file/')){
   const parts=url.pathname.split('/'),taskId=parts.at(-1),providerId=parts.at(-2);await providerVideoService.ready();json(res,await providerVideoService.poll(providerId,taskId));return true;
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/video/task/')){
   const parts=url.pathname.split('/'),index=Number(parts.at(-1)),taskId=parts.at(-3),providerId=parts.at(-4);await providerVideoService.ready();const file=await providerVideoService.download(providerId,taskId,index);res.writeHead(200,{'Content-Type':file.mime,'Content-Length':file.data.length,'Cache-Control':'no-store'});res.end(file.data);return true;
  }
  if(req.method==='GET'&&url.pathname==='/api/comfy/status'){json(res,await comfyService.health());return true;}
  if(req.method==='POST'&&url.pathname==='/api/comfy/start'){json(res,await comfyService.start());return true;}
  if(req.method==='GET'&&url.pathname==='/api/comfy/models'){json(res,{models:await comfyService.models()});return true;}
  if(req.method==='POST'&&url.pathname==='/api/comfy/config'){json(res,{status:comfyService.configure((await body(req)).baseUrl)});return true;}
  if(req.method==='GET'&&url.pathname==='/api/comfy/tasks'){await comfyService.ready();json(res,{tasks:comfyService.tasks(url.searchParams.get('projectId')||undefined)});return true;}
  if(req.method==='POST'&&url.pathname==='/api/comfy/quote'){json(res,await comfyService.quote(await body(req)));return true;}
  if(req.method==='POST'&&url.pathname==='/api/comfy/generate'){json(res,await comfyService.submit(await body(req)));return true;}
  if(req.method==='GET'&&url.pathname.startsWith('/api/comfy/task/')&&!url.pathname.includes('/file/')){await comfyService.ready();json(res,await comfyService.poll(url.pathname.split('/').at(-1)));return true;}
  if(req.method==='GET'&&url.pathname.startsWith('/api/comfy/task/')){
   const parts=url.pathname.split('/'),index=Number(parts.at(-1)),id=parts.at(-3);await comfyService.ready();const file=await comfyService.download(id,index);res.writeHead(200,{'Content-Type':file.mime,'Content-Length':file.data.length,'Cache-Control':'no-store'});res.end(file.data);return true;
  }
  if(req.method==='GET'&&url.pathname==='/api/providers'){await providerService.ready();json(res,{providers:[providerService.descriptor()],config:providerService.status(),tasks:providerService.tasks(url.searchParams.get('projectId')||undefined)});return true;}
  if(req.method==='GET'&&url.pathname==='/api/providers/config'){await providerService.ready();json(res,{config:providerService.status()});return true;}
  if(req.method==='POST'&&url.pathname==='/api/providers/config'){const b=await body(req);json(res,{config:await providerService.configure(b)});return true;}
  if(req.method==='GET'&&url.pathname==='/api/providers/seedream/models'){json(res,{models:await providerService.listModels()});return true;}
  if(req.method==='POST'&&url.pathname==='/api/providers/seedream/quote'){json(res,await providerService.quote(await body(req)));return true;}
  if(req.method==='POST'&&url.pathname==='/api/providers/seedream/generate'){const b=await body(req);const result=await providerService.submit(b);json(res,result);return true;}
  if(req.method==='GET'&&url.pathname==='/api/providers/tasks'){await providerService.ready();json(res,{tasks:providerService.tasks(url.searchParams.get('projectId')||undefined)});return true;}
  if(req.method==='GET'&&url.pathname.startsWith('/api/providers/task/')&&!url.pathname.includes('/file/')){
   await providerService.ready();const id=url.pathname.split('/').at(-1);json(res,await providerService.poll(id));return true;
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/providers/task/')){
   const parts=url.pathname.split('/'),index=Number(parts.at(-1)),id=parts.at(-3);const file=await providerService.download(id,index);res.writeHead(200,{'Content-Type':file.mime,'Content-Length':file.data.length,'Cache-Control':'no-store'});res.end(file.data);return true;
  }
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
 }catch(e){json(res,{error:e.message,...(e.code?{code:e.code}:{})},e.code==='UNAUTHORIZED'?401:400);return true;}
}
