import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeStory,snapshotStory,validateStoryOutput} from '../src/workstation/story.mjs';
import {defaultWorkstation,validateWorkstation} from '../src/workstation/sequence.mjs';
import {sendStoryToCanvas} from '../src/workstation/story-canvas.mjs';
import {generateWriting} from '../text-writing.mjs';
test('legacy project upgrades and story versions survive validation without credentials',()=>{
 const ws=defaultWorkstation();ws.script='剧本';ws.story.shots=[{id:'shot1',scene:'院子',description:'进门',duration:3,characters:['甲'],assetIds:[]}];ws.story.assets=[{id:'asset1',kind:'character',name:'甲',description:'来客',shotIds:['shot1']}];
 for(let i=0;i<22;i++)snapshotStory(ws,'第'+i+'版');
 const out=validateWorkstation({...ws,key:'SECRET'});assert.equal(out.story.versions.length,20);assert.equal(out.story.versions[0].script,'剧本');assert.equal(out.story.shots[0].id,'shot1');assert.ok(!JSON.stringify(out).includes('SECRET'));assert.deepEqual(validateWorkstation({}).story,{shots:[],assets:[],versions:[]});
});
test('AI data rejects malformed output and removes invented associations',()=>{
 assert.throws(()=>validateStoryOutput({shots:[{description:'x',duration:0}]},'storyboard'));
 const out=validateStoryOutput({assets:[{kind:'prop',name:'杯子',description:'白色',shotIds:['shot1','invented'],canvasNodeId:'invented'}]},'assets',[{id:'shot1'}]);
 assert.deepEqual(out.assets[0].shotIds,['shot1']);assert.equal(out.assets[0].canvasNodeId,undefined);
});
test('send planning assets and shots creates linked nodes and updates idempotently',()=>{
 const ws=defaultWorkstation();ws.story=normalizeStory({shots:[{id:'shot1',scene:'院子',description:'甲进门',characters:['甲'],assetIds:['asset1'],duration:3}],assets:[{id:'asset1',kind:'character',name:'甲',description:'来客',shotIds:['shot1']}]});const p={workstation:ws,nodes:[],edges:[]};
 sendStoryToCanvas(p,'assets',['asset1']);sendStoryToCanvas(p,'shots',['shot1']);assert.equal(p.nodes.length,2);assert.equal(p.edges.length,1);
 ws.story.shots[0].description='甲离开';sendStoryToCanvas(p,'shots',['shot1']);assert.equal(p.nodes.length,2);assert.equal(p.edges.length,1);assert.match(p.nodes[1].text,/甲离开/);
});
test('writing API preview returns content but rejects truncated and invalid structured results without echoing keys',async()=>{
 const config={base:'https://api.deepseek.com',model:'deepseek-flash',key:'FAKE_TEST_KEY'};let called;
 const fetchImpl=async(url,opt)=>{called={url,opt};return {ok:true,json:async()=>({choices:[{message:{content:'EXT. 院子'}}],usage:{total_tokens:10}})}};
 const r=await generateWriting(config,{kind:'generate',prompt:'院子里的故事',script:''},{fetchImpl});assert.equal(r.text,'EXT. 院子');assert.equal(called.opt.redirect,'error');assert.equal(JSON.parse(called.opt.body).model,'deepseek-flash');assert.ok(!JSON.stringify(r).includes(config.key));
 await assert.rejects(generateWriting(config,{kind:'rewrite',prompt:'',script:'原稿'},{fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'截断'}}]})})}),/长度上限/);
 await assert.rejects(generateWriting(config,{kind:'assets',prompt:'',script:'原稿'},{fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'不是JSON'}}]})})}),/JSON/);
});

test('project backup restore keeps story history and canvas references',async()=>{
 const {demoProject}=await import('../src/model.mjs');const {buildWorkstationBackup,restoreWorkstationBackup}=await import('../src/workstation/backup.mjs');
 const p=demoProject();p.workstation.story=normalizeStory({shots:[{id:'shot1',scene:'院子',characters:['甲'],description:'来访',duration:4,assetIds:[]}],assets:[]});sendStoryToCanvas(p,'shots',['shot1']);snapshotStory(p.workstation,'已送入画布');
 const {backup}=await buildWorkstationBackup(p,{get:async()=>null});const {project}=await restoreWorkstationBackup(JSON.parse(JSON.stringify(backup)),{put:async()=>{}});
 assert.equal(project.workstation.story.shots[0].canvasNodeId,p.workstation.story.shots[0].canvasNodeId);assert.equal(project.workstation.story.versions.length,1);assert.ok(project.nodes.some(n=>n.id===project.workstation.story.shots[0].canvasNodeId));
});
