import test from 'node:test';
import assert from 'node:assert/strict';
import {starterProject,sampleObject} from '../src/model.mjs';
import {directorFrameSamples,validateDirectorFrames} from '../src/workstation/director-vision.mjs';
import {directorContext,directorSignature,buildDirectorRequest,refineDirectorPlan,prepareDirectorEdit} from '../src/workstation/director-agent.mjs';
import {generateWriting} from '../text-writing.mjs';
import {normalizeDirectorAssistant} from '../src/workstation/director-state.mjs';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jkN0AAAAASUVORK5CYII=';
const frame=(phase='current')=>({image:png,time:0,label:'当前机位',phase});
const plan=operations=>({message:'请检查修改',operations,warnings:[]});

test('current shot samples stay inside its cut and camera override is explicit',()=>{
 const p=starterProject();for(const shot of p.shots){const samples=directorFrameSamples(p,{time:shot.start});assert.ok(samples.every(f=>f.time>=shot.start&&f.time<shot.end&&f.cameraId===shot.cameraId));}
 assert.equal(directorFrameSamples(p,{time:p.duration})[0].cameraId,p.shots.at(-1).cameraId);
 const override=p.objects.filter(o=>o.type==='camera').at(-1).id;assert.ok(directorFrameSamples(p,{time:0,cameraId:override}).every(f=>f.cameraId===override));
 const samples=directorFrameSamples(p,{scope:'overview'});assert.ok(samples.length<=6);assert.equal(new Set(samples.map(f=>f.cameraId+f.time)).size,samples.length);
});
test('many shots are evenly sampled with a strict six-frame limit, and no-camera scenes fail clearly',()=>{
 const p=starterProject(),cam=p.shots[0].cameraId;p.duration=100;p.shots=Array.from({length:100},(_,i)=>({id:'shot'+i,cameraId:cam,start:i,end:i+1}));const frames=directorFrameSamples(p,{scope:'overview'});assert.equal(frames.length,6);assert.ok(frames[0].time<1&&frames.at(-1).time>=99);
 p.objects=[];assert.throws(()=>directorFrameSamples(p),/摄影机/);
});
test('vision validation rejects external URLs, malformed images, excess size/count and bad time',()=>{
 assert.equal(validateDirectorFrames([frame()],12)[0].image,png);
 for(const value of ['https://example.com/image.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,ZmFrZQ==',png+'A'])assert.throws(()=>validateDirectorFrames([{...frame(),image:value}],12),/截图/);
 assert.throws(()=>validateDirectorFrames(Array.from({length:7},()=>frame()),12),/1至6/);
 assert.throws(()=>validateDirectorFrames([{...frame(),time:13}],12),/信息/);
 const bytes=Buffer.from(png.split(',')[1],'base64');bytes.writeUInt32BE(9000,16);assert.throws(()=>validateDirectorFrames([{...frame(),image:'data:image/png;base64,'+bytes.toString('base64')}],12),/尺寸/);
 assert.throws(()=>validateDirectorFrames([{...frame(),image:'data:image/png;base64,'+'A'.repeat(1400004)}],12),/过大/);
});
test('image requests label time and before/after phases; text-only plans never claim visual inspection',()=>{
 const p=starterProject(),context=directorContext(p);const request=buildDirectorRequest({kind:'director-review',prompt:'检查背拍',context,frames:[frame('before'),frame('after')]});
 const user=request.messages.at(-1);assert.equal(user.content.filter(c=>c.type==='image_url').length,2);assert.ok(user.content.some(c=>c.text?.includes('修改前')));assert.ok(user.content.some(c=>c.text?.includes('候选修改后')));assert.match(request.messages[0].content,/稀疏采样/);assert.match(request.messages[0].content,/相对于此候选场景/);
 const plain=buildDirectorRequest({kind:'director-plan',prompt:'调整',context});assert.equal(typeof plain.messages.at(-1).content,'string');assert.match(plain.messages[0].content,/没有附带画面/);
 assert.throws(()=>buildDirectorRequest({kind:'director-review',prompt:'检查',context}),/前后预览/);
});
test('review corrections execute relative to the candidate, preserving atomic undo scope',()=>{
 const p=starterProject(),o=p.objects[0],before=structuredClone(p),initial=plan([{tool:'move',objectId:o.id,time:0,offset:[1,0,0]}]),candidate={signature:directorSignature(p),plan:initial};
 const result=refineDirectorPlan(p,candidate,plan([{tool:'move',objectId:o.id,time:0,offset:[.5,0,0]}]));assert.equal(sampleObject(result.objects[0],0).position[0],sampleObject(o,0).position[0]+1.5);assert.deepEqual(p,before);
 assert.throws(()=>refineDirectorPlan(p,candidate,plan([{tool:'shell'}])),/不支持/);assert.deepEqual(p,before);
 o.position[0]++;assert.throws(()=>refineDirectorPlan(p,candidate,plan([])),/已变化/);
});
test('provider receives real multimodal content and gives actionable visual incompatibility errors',async()=>{
 const p=starterProject(),config={key:'sk-test',base:'https://api.deepseek.com',model:'deepseek-flash'},body={kind:'director-plan',prompt:'看图检查',context:directorContext(p),frames:[frame()]};let sent;
 await generateWriting(config,body,{fetchImpl:async(_url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(plan([]))}}]}));}});
 assert.equal(sent.messages.at(-1).content.at(-1).image_url.url,png);
 await assert.rejects(generateWriting(config,body,{fetchImpl:async()=>new Response('{}',{status:400})}),/支持图片输入/);
 const state=normalizeDirectorAssistant({messages:[],candidate:{projectId:p.id,signature:directorSignature(p),plan:plan([]),changes:[],request:'背拍',frames:[frame()],images:[png]}});assert.equal(state.candidate.images,undefined);assert.equal(state.candidate.frames,undefined);assert.equal(state.candidate.request,'背拍');
});
