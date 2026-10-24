import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTaskRecords,taskCenterCounts,filterTaskRecords,taskQueryRequest,queryTaskRecord} from '../src/task-center.mjs';
import {creativeSourceSignature} from '../src/workstation/creative-agent.mjs';

function project(){
 const p={id:'p',nodes:[{id:'source',type:'text'}],workstation:{
  creativeTasks:[{id:'c1',projectId:'p',flow:'story-package',status:'ready',createdAt:10,sourceNodeId:'source'}],
  deliver:{tasks:[{id:'e1',status:'running',createdAt:40,progress:.4,sourceNodeIds:['source','gone']}]},
 }};
 p.workstation.creativeTasks[0].sourceSignature=creativeSourceSignature(p);
 return p;
}

test('projects creative and export tasks once without mutating project data',()=>{
 const p=project(),before=structuredClone(p),records=collectTaskRecords({project:p});
 assert.deepEqual(p,before);
 assert.deepEqual(records.map(r=>r.key),['export:e1','creative:c1']);
 assert.deepEqual(records.find(r=>r.kind==='export').sourceNodeIds,['source']);
 assert.equal(records.find(r=>r.kind==='export').progress,.4);
 assert.deepEqual(taskCenterCounts(records),{all:2,active:1,ready:1,attention:0,finished:0});
 assert.equal(filterTaskRecords(records,'ready')[0].kind,'creative');
});

test('creative tasks can be cancelled in details, export tasks cannot',()=>{
 const p=project();p.workstation.creativeTasks[0].status='running';
 const records=collectTaskRecords({project:p});
 assert.equal(records.find(r=>r.kind==='creative').actions.cancelInDetails,true);
 assert.equal(records.find(r=>r.kind==='export').actions.cancelInDetails,false);
 assert.match(records.find(r=>r.kind==='export').cancelNote,/不支持/);
});

test('only the original export GET can be queried; results are validated',async()=>{
 const record=collectTaskRecords({project:project()}).find(r=>r.kind==='export'),calls=[];
 assert.deepEqual(taskQueryRequest(record),{method:'GET',path:'/api/workstation/export/e1'});
 const response=await queryTaskRecord(record,async(...args)=>{calls.push(args);return {id:'e1',status:'completed'};});
 assert.equal(response.status,'completed');
 assert.deepEqual(calls,[['/api/workstation/export/e1']]);
 await assert.rejects(()=>queryTaskRecord(record,async()=>({id:'different'})),/编号/);
 assert.throws(()=>taskQueryRequest({...record,kind:'creative'}),/未知任务类型/);
});

test('changed creative source is stale and cannot look ready',()=>{
 const p=project();p.workstation.script='updated';
 const row=collectTaskRecords({project:p}).find(r=>r.kind==='creative');
 assert.equal(row.label,'来源已变化');assert.equal(row.group,'attention');assert.equal(row.actions.open,true);assert.equal(row.actions.query,false);
});
