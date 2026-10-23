import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

test('storage settings return actual configured paths without credentials or filesystem mutation, rejecting other origins',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'director-settings-')),old=process.env.JINGCHANG_DATA_DIR;process.env.JINGCHANG_DATA_DIR=join(dir,'生成素材');
 try{
  const {handleAI}=await import('../ai-service.mjs?settings-test');
  const call=async(headers={},method='GET')=>{let status,body;const req={method,headers:{host:'127.0.0.1:4173',...headers}},res={writeHead(s){status=s},end(b){body=JSON.parse(b)}};const handled=await handleAI(req,res,new URL('http://127.0.0.1:4173/api/ai/storage'));return {status,body,handled};};
  const result=await call({origin:'http://127.0.0.1:4173'});assert.equal(result.handled,true);assert.equal(result.status,200);assert.equal(resolve(result.body.dataDirectory),join(dir,'生成素材'));assert.equal(resolve(result.body.modelsDirectory),join(dir,'生成素材','model3d'));assert.equal(result.body.canChangeDirectory,false);
  assert.deepEqual(Object.keys(result.body).sort(),['dataDirectory','imagesDirectory','modelsDirectory','assetsDirectory','directorySource','canChangeDirectory'].sort());
  assert.equal((await call({origin:'https://unrelated.example'})).status,403);assert.equal((await call({},'POST')).status,403);assert.deepEqual(await readdir(dir),[]);
 }finally{if(old===undefined)delete process.env.JINGCHANG_DATA_DIR;else process.env.JINGCHANG_DATA_DIR=old;await rm(dir,{recursive:true,force:true})}
});
