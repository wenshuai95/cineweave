import test from 'node:test';import assert from 'node:assert/strict';
import {writingRequest,generateWriting} from '../text-writing.mjs';
import {normalizeStory} from '../src/workstation/story.mjs';
import {applyAssetDesigns} from '../src/workstation/asset-agent.mjs';
import {sendStoryToCanvas} from '../src/workstation/story-canvas.mjs';
const cfg={base:'https://api.deepseek.com',model:'deepseek-flash',key:'FAKE_TEST_ONLY'};
const model=raw=>async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(raw)},finish_reason:'stop'}]}));
const design={kind:'character',name:'阿青',description:'青年',prompt:'青年全身设定图，朴素外套，写实质感，灰色背景',negativePrompt:'文字、水印',shotIds:['shot1']};
test('DeepSeek connection test validates the model without generating tokens',async()=>{
 const result=await generateWriting(cfg,{kind:'test',prompt:'',script:''},{fetchImpl:async(url,o)=>{assert.equal(url,'https://api.deepseek.com/models');assert.equal(o.method,'GET');assert.equal(o.body,undefined);return new Response(JSON.stringify({data:[{id:'deepseek-flash'}]}));}});assert.equal(result.verification,'models');
 let compatible;await generateWriting({...cfg,base:'https://example.com/v1'},{kind:'chat',prompt:'你好',script:''},{fetchImpl:async(u,o)=>{compatible=JSON.parse(o.body);return new Response(JSON.stringify({choices:[{message:{content:'你好'}}]}));}});assert.equal(compatible.thinking,undefined);
 let official;await generateWriting(cfg,{kind:'chat',prompt:'你好',script:''},{fetchImpl:async(u,o)=>{official=JSON.parse(o.body);return new Response(JSON.stringify({choices:[{message:{content:'你好'}}]}));}});assert.equal(official.thinking.type,'disabled');
});
test('model verification rejects wrong IDs and invalid JSON without exposing response contents',async()=>{
 await assert.rejects(generateWriting(cfg,{kind:'test',prompt:'',script:''},{fetchImpl:async()=>new Response(JSON.stringify({data:[{id:'other'}]}))}),/模型名称不在/);
 await assert.rejects(generateWriting(cfg,{kind:'test',prompt:'',script:''},{fetchImpl:async()=>new Response('<html>SECRET_GATEWAY_BODY</html>')}),e=>e.message.includes('不是有效 JSON')&&!e.message.includes('SECRET'));
 await assert.rejects(generateWriting(cfg,{kind:'test',prompt:'',script:''},{fetchImpl:async()=>new Response('{}')}),/模型列表格式异常/);
});
test('body-read timeout is reported as timeout rather than invalid JSON',async()=>{
 const original=AbortSignal.timeout;AbortSignal.timeout=()=>original(15);const keep=setTimeout(()=>{},1000);
 try{await assert.rejects(generateWriting(cfg,{kind:'test',prompt:'',script:''},{fetchImpl:async(u,o)=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('\n'));o.signal.addEventListener('abort',()=>c.error(o.signal.reason),{once:true});}}))}),e=>e.message.includes('响应超时')&&!e.message.includes('JSON'));}finally{AbortSignal.timeout=original;clearTimeout(keep);}
});
test('keep-alive whitespace does not invalidate a complete JSON response',async()=>{
 const result=await generateWriting(cfg,{kind:'test',prompt:'',script:''},{fetchImpl:async()=>new Response('\n\n  '+JSON.stringify({data:[{id:'deepseek-flash'}]}))});assert.equal(result.verification,'models');
});
test('provider errors are actionable without echoing provider messages or keys',async()=>{
 for(const [status,reason] of [[401,'密钥无效'],[402,'余额不足'],[404,'接口或模型不存在'],[429,'过于频繁']])await assert.rejects(generateWriting(cfg,{kind:'test',prompt:'',script:''},{fetchImpl:async()=>new Response('SECRET_PROVIDER_ERROR',{status})}),e=>e.message.includes(reason)&&!e.message.includes('SECRET'));
});
test('asset agent requires usable image prompts and retains only valid shot references',async()=>{
 const body={kind:'assets',script:'阿青在小院读信',prompt:'',shots:[{id:'shot1',scene:'小院',description:'读信',duration:5,characters:['阿青']}]};
 assert.match(writingRequest(body).messages[0].content,/negativePrompt/);
 await assert.rejects(generateWriting(cfg,body,{fetchImpl:model({assets:[{...design,prompt:undefined}]})}),/完整图片提示词/);
 const result=await generateWriting(cfg,body,{fetchImpl:model({assets:[{...design,shotIds:['shot1','invented']} ]})});assert.deepEqual(result.assets[0].shotIds,['shot1']);assert.equal(result.assets[0].prompt,design.prompt);
});
test('asset design merge preserves manual assets, links and original version, updating matched ids',()=>{
 const ws={script:'剧本',story:normalizeStory({assets:[{...design,id:'asset1',canvasNodeId:'node1',prompt:'旧提示词'},{id:'manual',kind:'prop',name:'手动道具',description:'保留'}],shots:[{id:'shot1',scene:'小院',description:'读信',characters:[],duration:5,assetIds:['manual']} ]})};
 applyAssetDesigns(ws,[{...design,id:'new-generated-id'}]);assert.equal(ws.story.assets.length,2);assert.equal(ws.story.assets[0].id,'asset1');assert.equal(ws.story.assets[0].canvasNodeId,'node1');assert.equal(ws.story.assets[0].prompt,design.prompt);assert.deepEqual(ws.story.shots[0].assetIds,['manual','asset1']);assert.equal(ws.story.versions.at(-1).assets[0].prompt,'旧提示词');
 const before=JSON.stringify(ws);assert.throws(()=>applyAssetDesigns(ws,[design,design]),/重复/);assert.equal(JSON.stringify(ws),before);
});
test('image prompt survives backup, history normalization and canvas handoff',async()=>{
 const {demoProject}=await import('../src/model.mjs');const {buildWorkstationBackup,restoreWorkstationBackup}=await import('../src/workstation/backup.mjs');const p=demoProject();p.workstation.story=normalizeStory({assets:[{...design,id:'asset1'}]});sendStoryToCanvas(p,'assets',['asset1']);assert.equal(p.nodes.find(n=>n.storyRef?.id==='asset1').text,design.prompt);
 const {backup}=await buildWorkstationBackup(p,{get:async()=>null});const {project}=await restoreWorkstationBackup(backup,{put:async()=>{}});assert.equal(project.workstation.story.assets[0].negativePrompt,'文字、水印');assert.equal(project.workstation.story.assets[0].prompt,design.prompt);
});

test('a hung provider is bounded and never retried automatically',async()=>{
 const original=AbortSignal.timeout,deadlines=[];AbortSignal.timeout=ms=>{deadlines.push(ms);return original(15);};let calls=0;
 // Keep event loop alive: AbortSignal.timeout internally uses an unref timer.
 const keep=setTimeout(()=>{},1000);
 try{await assert.rejects(generateWriting(cfg,{kind:'test',prompt:'',script:''},{fetchImpl:async(u,o)=>{calls++;return new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(o.signal.reason),{once:true}));}}),/超时/);assert.deepEqual(deadlines,[30000]);assert.equal(calls,1);}finally{clearTimeout(keep);AbortSignal.timeout=original;}
});
test('art direction is bounded, project-scoped and survives validation',async()=>{
 const {defaultWorkstation,validateWorkstation}=await import('../src/workstation/sequence.mjs');const ws=defaultWorkstation();ws.writing.artDirection='暖光'.repeat(4000);assert.equal(validateWorkstation(ws).writing.artDirection.length,6000);
});

test('invisible pasted characters are removed without logging the key; other invalid characters fail before transport',async()=>{
 let calls=0;const result=await generateWriting({...cfg,key:'FAKE_\u200bTEST_ONLY'},{kind:'test',prompt:'',script:''},{fetchImpl:async(u,o)=>{calls++;assert.equal(o.headers.Authorization,'Bearer FAKE_TEST_ONLY');return new Response(JSON.stringify({data:[{id:'deepseek-flash'}]}));}});assert.equal(result.verification,'models');
 await assert.rejects(generateWriting({...cfg,key:'密钥说明 FAKE'},{kind:'test',prompt:'',script:''},{fetchImpl:async()=>calls++}),/无效字符/);assert.equal(calls,1);
});
test('metadata redirects keep credentials only on the same HTTPS origin',async()=>{
 let calls=0;const result=await generateWriting(cfg,{kind:'test',prompt:'',script:''},{fetchImpl:async(u,o)=>{calls++;if(calls===1)return new Response(null,{status:307,headers:{location:'/v1/models'}});assert.equal(u,'https://api.deepseek.com/v1/models');return new Response(JSON.stringify({data:[{id:'deepseek-flash'}]}));}});assert.equal(result.verification,'models');assert.equal(calls,2);
 calls=0;await assert.rejects(generateWriting(cfg,{kind:'test',prompt:'',script:''},{fetchImpl:async()=>{calls++;return new Response(null,{status:307,headers:{location:'https://other.example/models'}});}}),/不受支持的重定向/);assert.equal(calls,1);
});
test('network diagnostic reports a known code without exposing private transport messages',async()=>{
 await assert.rejects(generateWriting(cfg,{kind:'test',prompt:'',script:''},{fetchImpl:async()=>{throw new TypeError('PRIVATE_KEY_NOT_TO_ECHO',{cause:{code:'ECONNRESET'}});}}),e=>e.message.includes('ECONNRESET')&&!e.message.includes('PRIVATE'));
});
