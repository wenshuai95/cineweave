import test from 'node:test';
import assert from 'node:assert/strict';
import {writingRequest,generateWriting} from '../text-writing.mjs';
import {normalizeWriting} from '../src/workstation/writing-agent.mjs';
import {createCreativeTask,runCreativeTask} from '../src/workstation/creative-agent.mjs';

test('director guidance survives project normalization and both production steps without changing structured output contracts',async()=>{
 for(const skill of ['directing','continuity','video-prompt']){
  const project={id:'qa-director',workstation:{script:'雨夜，阿灯把旧信收进包里。',writing:normalizeWriting({skill}),story:{shots:[],assets:[]}}};
  const task=createCreativeTask(project,{flow:'story-package',prompt:'设计一个镜头，并整理资产。'});
  const bodies=[];
  await runCreativeTask(task,async body=>{
   bodies.push(body);
   assert.equal(body.skill,skill);
   const request=writingRequest(body);
   assert.equal(request.structured,true);
   assert.match(request.messages[0].content,/不执行任何工具/);
   assert.match(request.messages[0].content,/仅输出 JSON/);
   return body.kind==='storyboard'?{shots:[{scene:'巷口',characters:['阿灯'],description:'阿灯把旧信收进包里。',dialogue:'',duration:4,shotSize:'中景',cameraMovement:'固定'}]}:{assets:[{kind:'character',name:'阿灯',description:'送信机器人',prompt:'送信机器人，全身设定图。',shotIds:[body.shots[0].id]}]};
  });
  assert.deepEqual(bodies.map(b=>b.kind),['storyboard','assets']);
  assert.equal(task.status,'ready');
  assert.equal(project.workstation.story.shots.length,0,'candidate is not adopted automatically');
 }
});

test('selected guidance reaches a model request while returned prose is still treated as a candidate',async()=>{
 let sent;
 const result=await generateWriting({key:'TEST_ONLY',base:'https://example.com/v1',model:'test'},
  {kind:'chat',prompt:'怎样设计人物走位？',script:'阿灯在门口停下。',skill:'directing'},
  {fetchImpl:async(_url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:'先明确视线与结束姿态，再设置机位。'}}]})};}});
 assert.match(sent.messages[0].content,/先写主体起点、走位/);
 assert.match(result.text,/结束姿态/);
 assert.equal(normalizeWriting({skill:'downloaded-arbitrary-file'}).skill,'general');
});
