import test from 'node:test';
import assert from 'node:assert/strict';
import {starterProject,object,sampleObject,validateProject} from '../src/model.mjs';
import {directorContext,directorSignature,prepareDirectorEdit,buildDirectorRequest,validateDirectorReply} from '../src/workstation/director-agent.mjs';
import {generateWriting} from '../text-writing.mjs';
import {normalizeDirectorAssistant} from '../src/workstation/director-state.mjs';
const fixture=()=>{const p=starterProject();p.objects=p.objects.filter(o=>o.type!=='model');const a=object('actor','女修',[0,0,0]),b=object('actor','巨妖',[5,0,0]);p.objects.push(a,b);return {p,a,b,cam:p.objects.find(o=>o.type==='camera')};};
const reply=operations=>({message:'请检查这个修改方案。',operations,warnings:[]});
const apply=(p,ops,extra={})=>prepareDirectorEdit(p,reply(ops),{signature:directorSignature(p),...extra});

test('move, facing and identification colors execute atomically on a separate scene',()=>{
 const {p,a,b}=fixture(),before=structuredClone(p);
 const result=apply(p,[{tool:'move',objectId:a.id,time:0,offset:[1,0,2]},{tool:'face',objectId:a.id,targetId:b.id,time:0},{tool:'color',objectId:a.id,time:0,color:'#f06b5c'}]);
 const x=result.objects.find(o=>o.id===a.id);assert.deepEqual(x.position,[1,0,2]);assert.equal(x.color,'#f06b5c');assert.ok(Math.abs(x.rotation-Math.atan2(4,-2)*180/Math.PI)<1e-8);assert.deepEqual(p,before);
});
test('animated parameter edits preserve unrelated curves and original motion keys',()=>{
 const {p,a}=fixture();a.keys=[0,6].map(t=>({...structuredClone(a),id:undefined,t,position:[t,0,0],ease:'linear'}));
 const result=apply(p,[{tool:'set',objectId:a.id,time:3,values:{positionX:9},ease:'linear'}]);const x=result.objects.find(o=>o.id===a.id);
 assert.equal(sampleObject(x,3).position[0],9);assert.equal(sampleObject(x,0).position[0],0);assert.equal(sampleObject(x,6).position[0],6);assert.deepEqual(x.keys,a.keys);assert.equal(a.channels,undefined);
});
test('stale candidates, locks, unknown tools and a later invalid operation never alter the source',()=>{
 const {p,a}=fixture(),signature=directorSignature(p);a.position[0]=2;
 assert.throws(()=>prepareDirectorEdit(p,reply([]),{signature}),/已变化/);
 a.locked=true;assert.throws(()=>apply(p,[{tool:'move',objectId:a.id,time:0,offset:[1,0,0]}]),/已锁定/);a.locked=false;
 const before=structuredClone(p);assert.throws(()=>apply(p,[{tool:'color',objectId:a.id,time:0,color:'#ff0000'},{tool:'set',objectId:a.id,time:0,values:{positionX:1e9}}]),/无效/);assert.deepEqual(p,before);
 assert.throws(()=>validateDirectorReply(reply([{tool:'shell',command:'anything'}])),/不支持/);
 assert.throws(()=>validateDirectorReply(reply([{tool:'move',objectId:a.id,time:0,offset:[0,0,0],script:'anything'}])),/不支持/);
});
test('model facing requires calibration, and a calibrated model faces the target',()=>{
 const {p,a,b}=fixture();a.type='model';a.modelSrc='/assets/models/adult-male-casual-hoodie.glb';a.modelSize=1.8;
 assert.throws(()=>apply(p,[{tool:'face',objectId:a.id,targetId:b.id,time:0}]),/尚未标定/);
 const r=apply(p,[{tool:'calibrate',objectId:a.id,forwardYaw:90},{tool:'face',objectId:a.id,targetId:b.id,time:0}]);assert.equal(r.objects.find(o=>o.id===a.id).rotation,0);
 validateProject({...p,objects:r.objects});
});
test('hold poses use real loaded clips and reject nonexistent, overlapping or loop-boundary samples',()=>{
 const {p,a}=fixture();a.type='model';a.modelSrc='/assets/models/adult-male-casual-hoodie.glb';a.modelSize=1.8;const clips={[a.id]:[{name:'Walk',duration:2}]};
 const op={tool:'action',objectId:a.id,actionId:'hold-one',start:2,end:6,speed:1,clip:'Walk',mode:'hold',holdTime:1};
 assert.throws(()=>apply(p,[op]),/不存在/);
 const result=apply(p,[op],{clips});assert.equal(sampleObject(result.objects.find(o=>o.id===a.id),4).actionTime,1);
 assert.throws(()=>apply(p,[{...op,holdTime:2}],{clips}),/动作结束前/);
 a.actions=[{id:'old',clip:'Walk',start:0,end:4,speed:1}];assert.throws(()=>apply(p,[op],{clips}),/重叠/);
 assert.doesNotThrow(()=>apply(p,[{...op,actionId:'old'}],{clips}));
});
test('new cameras and cut replacement preserve the time budget and reject overlapping shots',()=>{
 const {p}=fixture(),old=p.shots[0];const op={tool:'createCamera',cameraId:'new-closeup',name:'眼神特写',position:[0,2,1],target:[0,1.7,0],fov:25};
 const r=apply(p,[op,{tool:'shot',shotId:old.id,cameraId:old.cameraId,start:2,end:old.end},{tool:'shot',shotId:'insert-closeup',cameraId:op.cameraId,start:0,end:2}]);
 assert.equal(r.shots.length,p.shots.length+1);assert.equal(r.shots[0].end,2);assert.equal(p.shots[0].start,0);
 assert.throws(()=>apply(p,[op,{tool:'shot',shotId:'insert-closeup',cameraId:op.cameraId,start:0,end:2}]),/镜头/);
 assert.throws(()=>apply(p,[{tool:'camera',objectId:old.cameraId,time:0,position:[0,0,0],target:[0,0,0],fov:40}]),/不能重合/);
});
test('scene context and server prompt exclude source models, project media and arbitrary fields',()=>{
 const p=starterProject();p.workstation.script='PRIVATE_SCRIPT';p.objects[0].modelSrc+='SECRET_SUFFIX';
 const c=directorContext(p);const encoded=JSON.stringify(c);assert.ok(!encoded.includes('modelSrc'));assert.ok(!encoded.includes('PRIVATE_SCRIPT'));assert.ok(!encoded.includes('SECRET_SUFFIX'));
 const request=buildDirectorRequest({prompt:'调整女修',context:{...c,apiKey:'SECRET',objects:c.objects.map(o=>({...o,modelSrc:'SECRET_FILE'}))}});const text=JSON.stringify(request);assert.ok(!text.includes('SECRET'));assert.equal(request.structured,true);
});
test('real text-provider adapter requests structured plans and validates the reply',async()=>{
 const {p,a}=fixture();let body;
 const output=await generateWriting({key:'sk-test-only',base:'https://api.deepseek.com',model:'test'},{kind:'director-plan',prompt:'女修改红色',context:directorContext(p)},{fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(reply([{tool:'color',objectId:a.id,time:0,color:'#ff0000'}]))}}]}),{headers:{'Content-Type':'application/json'}});}});
 assert.equal(body.response_format.type,'json_object');assert.equal(output.operations[0].objectId,a.id);
});
test('director conversation and candidate survive validation without including preview images',()=>{
 const {p}=fixture();p.workstation.directorAssistant={messages:[{role:'system',content:'bad'},{role:'user',content:'背拍'}],candidate:{projectId:p.id,signature:directorSignature(p),plan:reply([]),changes:[]},images:['not-persisted']};
 const restored=validateProject(structuredClone(p));assert.equal(restored.workstation.directorAssistant.messages.length,1);assert.equal(restored.workstation.directorAssistant.candidate.projectId,p.id);assert.equal(restored.workstation.directorAssistant.images,undefined);
 assert.equal(normalizeDirectorAssistant({messages:Array.from({length:40},()=>({role:'user',content:'x'}))}).messages.length,24);
});
