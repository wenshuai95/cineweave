import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,stat,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {Readable} from 'node:stream';
test('text config is opt-in local persistence, masked on status and cleared, with restart restore',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'workstation-text-config-')),old=process.env.JINGCHANG_DATA_DIR;process.env.JINGCHANG_DATA_DIR=dir;
 try{
 const {handleAI}=await import('../ai-service.mjs?text-config-test');
 const call=async(path,method='GET',data={},headers={})=>{let status,body;const req=Readable.from(method==='POST'?[JSON.stringify(data)]:[]);req.method=method;req.headers={host:'127.0.0.1:4188',origin:'http://127.0.0.1:4188','content-type':'application/json',...headers};const res={writeHead(s){status=s},end(raw){body=JSON.parse(raw)}};await handleAI(req,res,new URL('http://127.0.0.1:4188'+path));return {status,body};};
 const status=await call('/api/ai/text/status');const token=status.body.token;assert.equal(status.body.config.model,'deepseek-flash');
 const config={base:'https://api.deepseek.com',model:'deepseek-flash',key:'FAKE_TEST_ONLY',remember:true};
 assert.equal((await call('/api/ai/text/config','POST',config)).status,403);
 const saved=await call('/api/ai/text/config','POST',config,{'x-jingchang-token':token});assert.equal(saved.status,200);assert.equal(saved.body.config.remembered,true);assert.ok(!JSON.stringify(saved).includes(config.key));assert.equal((await stat(join(dir,'text-model.json'))).mode&0o777,0o600);
 const fresh=await import('../ai-service.mjs?text-config-restart');let restored;await fresh.handleAI({method:'GET',headers:{host:'127.0.0.1:4188',origin:'http://127.0.0.1:4188'}},{writeHead(){},end(r){restored=JSON.parse(r)}},new URL('http://127.0.0.1:4188/api/ai/text/status'));assert.equal(restored.config.configured,true);assert.equal(restored.config.remembered,true);assert.ok(!JSON.stringify(restored).includes(config.key));
 const cleared=await call('/api/ai/text/config','POST',{...config,clear:true,remember:false},{'x-jingchang-token':token});assert.equal(cleared.body.config.configured,false);await assert.rejects(readFile(join(dir,'text-model.json')));
 const empty=await call('/api/ai/text/generate','POST',{kind:'generate',prompt:'测试',script:''},{'x-jingchang-token':token});assert.equal(empty.status,400);assert.match(empty.body.error,/API Key/);
 }finally{if(old===undefined)delete process.env.JINGCHANG_DATA_DIR;else process.env.JINGCHANG_DATA_DIR=old;await rm(dir,{recursive:true,force:true});}
});
