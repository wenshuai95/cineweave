import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTaskRecords,taskCenterCounts,filterTaskRecords,taskQueryRequest,queryTaskRecord} from '../src/task-center.mjs';

function project(){
 return {id:'p',nodes:[{id:'source',type:'text'}],workstation:{
  deliver:{tasks:[{id:'e1',status:'running',createdAt:40,progress:.4,sourceNodeIds:['source','gone']}]},
 }};
}

test('projects export tasks once without mutating project data',()=>{
 const p=project(),before=structuredClone(p),records=collectTaskRecords({project:p});
 assert.deepEqual(p,before);
 assert.deepEqual(records.map(r=>r.key),['export:e1']);
 assert.deepEqual(records[0].sourceNodeIds,['source']);
 assert.equal(records[0].progress,.4);
 assert.deepEqual(taskCenterCounts(records),{all:1,active:1,ready:0,attention:0,finished:0});
 assert.equal(filterTaskRecords(records,'active')[0].kind,'export');
});

test('export tasks cannot be cancelled in the task center',()=>{
 const records=collectTaskRecords({project:project()});
 assert.equal(records[0].actions.cancelInDetails,false);
 assert.match(records[0].cancelNote,/不支持/);
});

test('only the original export GET can be queried; results are validated',async()=>{
 const record=collectTaskRecords({project:project()})[0],calls=[];
 assert.deepEqual(taskQueryRequest(record),{method:'GET',path:'/api/workstation/export/e1'});
 const response=await queryTaskRecord(record,async(...args)=>{calls.push(args);return {id:'e1',status:'completed'};});
 assert.equal(response.status,'completed');
 assert.deepEqual(calls,[['/api/workstation/export/e1']]);
 await assert.rejects(()=>queryTaskRecord(record,async()=>({id:'different'})),/编号/);
 assert.throws(()=>taskQueryRequest({...record,kind:'creative'}),/未知任务类型/);
});
