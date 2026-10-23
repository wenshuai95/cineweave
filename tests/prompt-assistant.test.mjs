import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePromptAssistantInput,buildPromptAssistantRequest,validatePromptAssistantResult} from '../prompt-assistant.mjs';
import {generateWriting,writingRequest} from '../text-writing.mjs';
const config={base:'https://example.com/v1',model:'fake-text',key:'FAKE_TEST_KEY'};
const body={kind:'optimize-prompt',goal:'detail',sourcePrompt:'总时长8秒，0–3秒机器人按 @视频1 前行，手持红信封，3–8秒说：“信送到了。” 参考 @图片1 外观，不要雨伞。',duration:8,references:[{nodeId:'robot-1',kind:'image',alias:'图片1',title:'机器人',purpose:'角色外观'},{nodeId:'motion-1',kind:'video',alias:'视频1',title:'白模',purpose:'动作与运镜'}],modelCapabilities:{name:'测试模型',video:true,audio:false}};
const improved=body.sourcePrompt+' 固定景别，中景，暖光从门内照出。';
const success={prompt:improved,changes:['补充景别与光线描述']};
function provider(value,onRequest=()=>{}){return async(url,options)=>{onRequest(url,options);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}],usage:{prompt_tokens:40,completion_tokens:80,total_tokens:120}}));};}
test('input is bounded, non-mutating and does not send the full script or history',()=>{
 const original=structuredClone(body);const request=writingRequest({...body,script:'PRIVATE_FULL_SCRIPT',history:[{role:'user',content:'PRIVATE_HISTORY'}]});
 assert.deepEqual(body,original);assert.equal(request.structured,true);assert.equal(request.max_tokens,10000);assert.equal(request.messages.length,2);
 assert.ok(!JSON.stringify(request.messages).includes('PRIVATE_'));assert.match(request.messages[0].content,/不新增角色、道具/);assert.match(request.messages[1].content,/动作与运镜/);
 for(const goal of ['clarify','detail','adapt'])assert.equal(buildPromptAssistantRequest({...body,goal}).promptAssistant.goal,goal);
 assert.equal(validatePromptAssistantInput({...body,script:''}).sourcePrompt,body.sourcePrompt);
});
test('malformed input fails before the provider is called',async()=>{
 let requests=0;
 const invalid=[{goal:'invent'},{sourcePrompt:''},{sourcePrompt:'x'.repeat(6001)},{duration:-1},{duration:601},{prompt:'x'.repeat(1001)},{modelCapabilities:'x'.repeat(4001)},{references:[...body.references,body.references[0]]},{references:[]},{references:[{...body.references[0],alias:'视频1'}]}];
 for(const patch of invalid)await assert.rejects(generateWriting(config,{...body,...patch},{fetchImpl:provider(success,()=>requests++)}));
 assert.equal(requests,0);
});
test('structured request uses the existing API and returns only validated draft plus review notice',async()=>{
 let submitted;const original=structuredClone(body);
 const result=await generateWriting(config,body,{fetchImpl:provider({...success,unexpected:'never exported'},(url,options)=>{assert.equal(url,'https://example.com/v1/chat/completions');submitted=JSON.parse(options.body);})});
 assert.equal(submitted.response_format.type,'json_object');assert.equal(submitted.model,'fake-text');assert.equal(submitted.stream,false);
 assert.equal(result.prompt,improved);assert.deepEqual(result.changes,success.changes);assert.deepEqual(result.needsReview,['角色、道具和否定约束请人工复核']);assert.equal(result.unexpected,undefined);assert.equal(result.usage.total_tokens,120);
 assert.deepEqual(body,original); // No source adoption happens in this API.
});
test('image and text prompts can optimize without a duration or script',async()=>{
 const simple={kind:'optimize-prompt',sourcePrompt:'机器人手持红信封，不要雨伞。',goal:'clarify'};
 const result=await generateWriting(config,simple,{fetchImpl:provider({prompt:'机器人手持红信封。不要雨伞。',changes:['整理标点']})});
 assert.equal(result.prompt,'机器人手持红信封。不要雨伞。');assert.equal(validatePromptAssistantInput(simple).duration,null);
});
test('references must retain identities and exact occurrence counts, while order may change',()=>{
 for(const prompt of [improved.replace('@图片1','@图片2'),improved.replace('@视频1',''),improved+' @音频1',improved+' @图片1'])assert.throws(()=>validatePromptAssistantResult({prompt,changes:[]},body),/@素材引用/);
 const reordered=improved.replace('@视频1','TEMP').replace('@图片1','@视频1').replace('TEMP','@图片1');
 assert.equal(validatePromptAssistantResult({prompt:reordered,changes:[]},body).prompt,reordered);
});
test('quoted dialogue cannot be rewritten, omitted or added',()=>{
 for(const prompt of [improved.replace('信送到了。','信已经到了。'),improved.replace('“信送到了。”',''),improved+' 旁白：“下雨了。”'])assert.throws(()=>validatePromptAssistantResult({prompt,changes:[]},body),/台词/);
 const alternateQuotes=improved.replace('“信送到了。”','「信送到了。」');assert.equal(validatePromptAssistantResult({prompt:alternateQuotes,changes:[]},body).prompt,alternateQuotes);
});
test('numeric timing and configured total are guarded, added shot detail is permitted',()=>{
 for(const prompt of [improved.replace('总时长8秒','总时长10秒'),improved.replace('0–3秒','0–2秒'),improved.replace('3–8秒','3–7秒')])assert.throws(()=>validatePromptAssistantResult({prompt,changes:[]},body),/数字时长/);
 assert.throws(()=>validatePromptAssistantResult({prompt:improved+' 全片时长：10秒',changes:[]},body),/总时长不一致/);
 assert.throws(()=>validatePromptAssistantResult({prompt:improved+' 8–10秒出现门口。',changes:[]},body),/超出设置时长/);
 const detail=improved+' 前2秒保持中景。';assert.equal(validatePromptAssistantResult({prompt:detail,changes:[]},body).prompt,detail);
});
test('invalid model JSON and oversized or malformed results cannot be adopted',async()=>{
 for(const value of [null,[],{}, {prompt:'',changes:[]},{prompt:'x'.repeat(6001),changes:[]},{prompt:improved,changes:['x'.repeat(301)]},{prompt:improved,changes:Array(9).fill('x')},{prompt:improved,changes:'改好了'}])await assert.rejects(generateWriting(config,body,{fetchImpl:provider(value)}),/格式不完整/);
 await assert.rejects(generateWriting(config,body,{fetchImpl:async()=>new Response(JSON.stringify({choices:[{message:{content:'这不是JSON'}}]}))}),/JSON/);
 await assert.rejects(generateWriting(config,body,{fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:JSON.stringify(success)}}]}))}),/长度上限/);
});
test('cancellation reaches the provider and rejects a late response without returning a draft',async()=>{
 const controller=new AbortController();let providerSignal;
 await assert.rejects(generateWriting(config,body,{signal:controller.signal,fetchImpl:async(url,options)=>{providerSignal=options.signal;controller.abort();return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(success)}}]}));}}),/取消/);
 assert.equal(providerSignal.aborted,true);
});

test('new timecodes must fit the selected duration',()=>{
 const input={goal:'detail',sourcePrompt:'镜头从00:00开始，机器人前进。',duration:8};
 assert.throws(()=>validatePromptAssistantResult({prompt:input.sourcePrompt+'00:20结束。',changes:[]},input),/超出设置时长/);
 assert.equal(validatePromptAssistantResult({prompt:input.sourcePrompt+'00:08结束。',changes:[]},input).prompt,input.sourcePrompt+'00:08结束。');
});
