import test from 'node:test';import assert from 'node:assert/strict';
import {defaultWorkstation,validateWorkstation} from '../src/workstation/sequence.mjs';
import {workflowState,recordWorkflowStep} from '../src/workstation/workflow.mjs';
function project(){const workstation=defaultWorkstation();workstation.script='院子里，甲进门。';workstation.story.shots=[{id:'s1',scene:'院子',characters:['甲'],description:'甲进门',dialogue:'',duration:3,shotSize:'中景',cameraMovement:'固定',assetIds:[]}];workstation.story.assets=[{id:'a1',kind:'character',name:'甲',prompt:'来访者',shotIds:['s1']}];return {workstation,nodes:[]};}
test('changed upstream warns without changing downstream records; recheck is explicit',()=>{
 const p=project(),ws=p.workstation;recordWorkflowStep(ws,'shots');recordWorkflowStep(ws,'assets');
 assert.equal(workflowState(p).shotsStale,false);const old=structuredClone(ws.story);ws.script+='下雨了。';
 assert.equal(workflowState(p).shotsStale,true);assert.equal(workflowState(p).assetsStale,true);assert.deepEqual(ws.story,old);
 recordWorkflowStep(ws,'shots');assert.equal(workflowState(p).shotsStale,false);assert.equal(workflowState(p).assetsStale,true);
 recordWorkflowStep(ws,'assets');assert.equal(workflowState(p).assetsStale,false);
});
test('asset/canvas links do not create false upstream changes, while shot edits do',()=>{
 const p=project(),ws=p.workstation;recordWorkflowStep(ws,'shots');recordWorkflowStep(ws,'assets');
 ws.story.shots[0].assetIds.push('a1');ws.story.shots[0].canvasNodeId='n1';ws.story.assets[0].canvasNodeId='n2';p.nodes=[{id:'n1'},{id:'n2'}];
 assert.equal(workflowState(p).assetsStale,false);assert.equal(workflowState(p).synced,2);
 ws.story.shots[0].description='甲离开';assert.equal(workflowState(p).assetsStale,true);assert.equal(workflowState(p).shotsStale,false);
});
test('provenance survives validation and undo snapshots without storing source text or unknown fields',()=>{
 const p=project();recordWorkflowStep(p.workstation,'shots');recordWorkflowStep(p.workstation,'assets');
 p.workstation.workflow.apiKey='SECRET';const out=validateWorkstation(p.workstation);
 assert.equal(workflowState({...p,workstation:out}).assetsStale,false);
 assert.ok(!JSON.stringify(out.workflow).includes('SECRET'));assert.ok(!JSON.stringify(out.workflow).includes('院子'));
 const legacy=project();assert.equal(workflowState(legacy).shotsStale,false);
 assert.deepEqual(validateWorkstation({workflow:{scriptForShots:'bad'}}).workflow,{});
});
