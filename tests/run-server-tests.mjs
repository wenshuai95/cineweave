// Cross-platform launcher for the service test suite (replaces the POSIX-only
// `JINGCHANG_TEST_SERVER=1 node --test …` form). Starts a throwaway server on a
// private port with a temp data dir, runs server + ai-server tests against it,
// then tears everything down. Port 4191 is outside the app's reserved set
// (41973 desktop / 4173 web / 4189 ai-adapter self-spawn); 4190 is on the
// fetch bad-port list (Sieve) and unusable.
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const dir=await mkdtemp(join(tmpdir(),'jingchang-server-tests-'));
const child=spawn(process.execPath,[join(root,'server.mjs')],{cwd:root,env:{...process.env,PORT:'4191',JINGCHANG_DATA_DIR:join(dir,'data')},stdio:['ignore','pipe','pipe'],windowsHide:true});
let out='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>out+=c);
let code=1;
try{
 await new Promise((res,rej)=>{
  const timer=setTimeout(()=>rej(Error('test server start timeout\n'+out)),10000);
  child.stdout.once('data',()=>{clearTimeout(timer);res();});
  child.once('exit',()=>rej(Error('test server exited during startup (端口 4191 被占用？)\n'+out)));
 });
 const tests=spawn(process.execPath,['--test','tests/server.test.mjs','tests/ai-server.test.mjs','tests/workstation-server.test.mjs'],{cwd:root,env:{...process.env,JINGCHANG_TEST_SERVER:'1',JINGCHANG_TEST_BASE:'http://127.0.0.1:4191'},stdio:'inherit',windowsHide:true});
 code=await new Promise(r=>tests.on('exit',r));
}finally{
 child.kill();
 await new Promise(r=>child.once('close',r));
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
}
process.exit(Number.isInteger(code)?code:1);
