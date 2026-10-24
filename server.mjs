import {handleAI} from './ai-service.mjs';
import {handleWorkstation} from './workstation-server.mjs';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const appVersion=process.env.APP_VERSION||'1.22.0';
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.webm':'video/webm','.glb':'model/gltf-binary','.mp4':'video/mp4'};
const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');
 const url=new URL(req.url,'http://127.0.0.1');
 if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||'')){res.writeHead(403);res.end('Local host required');return}
 if(await handleAI(req,res,url))return;
 if(await handleWorkstation(req,res,url))return; // v1.3.0 工作站交付导出（POST 也要先于静态文件闸门）
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return}
 if(url.pathname==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({app:'ai-video-workstation',version:appVersion,displayName:'造梦工坊',instance:process.env.DIRECTOR_CANVAS_INSTANCE||undefined,local:true,ai:{enabled:false,oiioii:'on-demand-cli',deepseekConfigured:!!process.env.DEEPSEEK_API_KEY,taskSchema:'jingchang-ai-task/1'}}));return}
 try{const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root+sep)&&path!==root){res.writeHead(403);res.end();return}const info=await stat(path);if(!info.isFile())throw Error();const body=await readFile(path);res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.writeHead(200);res.end(req.method==='HEAD'?undefined:body)}catch{res.writeHead(404);res.end('Not found')}
});
server.on('error',e=>{if(e.code==='EADDRINUSE')console.error('端口已占用。造梦工坊可能已运行，请打开 http://127.0.0.1:4173');else console.error(e.message);process.exit(1)});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('造梦工坊已启动：http://127.0.0.1:'+(Number(process.env.PORT)||4173)+'\n仅在本机运行。保持此窗口打开。'));
