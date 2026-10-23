import test from 'node:test';import assert from 'node:assert/strict';
import {createProjectSaver} from '../src/project-saver.mjs';
test('saving an earlier revision cannot mark later edits saved; flush waits for latest snapshot',async()=>{
 const writes=[],states=[];let release;const saver=createProjectSaver(async p=>{writes.push(p);if(writes.length===1)await new Promise(r=>release=r)},s=>states.push(s),10000);
 const p={name:'A'};saver.request(p);const first=saver.flush();await Promise.resolve();await Promise.resolve();p.name='B';saver.request(p);release();await first;assert.equal(saver.pending,true);assert.notEqual(states.at(-1),'saved');await saver.flush();assert.deepEqual(writes,[{name:'A'},{name:'B'}]);assert.equal(saver.pending,false);assert.equal(states.at(-1),'saved');
});
test('a failed save remains pending and can be retried with flush',async()=>{let n=0;const saver=createProjectSaver(async()=>{if(!n++)throw Error('disk full')},()=>{},10000);saver.request({v:1});await assert.rejects(saver.flush());assert.equal(saver.pending,true);await saver.flush();assert.equal(saver.pending,false);assert.equal(n,2);});
test('manual mode queues edits without writing until explicitly flushed',async()=>{
 const writes=[],states=[],saver=createProjectSaver(async p=>writes.push(p),s=>states.push(s),null);
 saver.request({v:1});saver.request({v:2});await new Promise(r=>setTimeout(r,20));assert.equal(writes.length,0);assert.equal(saver.pending,true);assert.equal(states.at(-1),'pending');await saver.flush();assert.deepEqual(writes,[{v:2}]);assert.equal(saver.pending,false);
});
test('changing autosave settings cancels a queued timer and resumes pending edits',async()=>{
 const writes=[],saver=createProjectSaver(async p=>writes.push(p),()=>{},10);saver.request({v:1});saver.setDelay(null);await new Promise(r=>setTimeout(r,25));assert.equal(writes.length,0);saver.request({v:2});saver.setDelay(0);await new Promise(r=>setTimeout(r,25));assert.deepEqual(writes,[{v:2}]);assert.equal(saver.pending,false);
});
