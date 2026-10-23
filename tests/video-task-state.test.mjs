import test from 'node:test';
import assert from 'node:assert/strict';
import {videoTaskState,latestVideoJobs,planVideoRetry,shortAudioWarning} from '../src/video-task-state.mjs';

test('task display distinguishes transport stages, platform generation and uncertain submission',()=>{
 assert.equal(videoTaskState({status:'preparing',phase:'uploading'}).label,'上传参考');
 assert.equal(videoTaskState({status:'pending',phase:'downloading'}).label,'接收视频');
 assert.equal(videoTaskState({status:'pending'}).label,'平台生成中','old ledgers remain readable');
 assert.equal(videoTaskState({status:'unknown',phase:'submitting'}).busy,false);
 assert.equal(videoTaskState({status:'failed',phase:'downloading'}).label,'生成失败');
 const jobs=[{sourceId:'a',id:'new',createdAt:20},{sourceId:'b',id:'other',createdAt:30},{sourceId:'a',id:'old',createdAt:10}];
 assert.equal(latestVideoJobs(jobs).get('a').id,'new');
 assert.deepEqual(jobs.map(j=>j.id),['new','other','old']);
});
test('retry preserves original input and aliases, reconnects available media and reports missing references',()=>{
 const project={id:'p',nodes:[{id:'s',type:'video',x:0,y:0,w:280,videoDraft:{prompt:'new work'}},{id:'img',type:'image',src:'keep',x:400,y:0,w:280}],edges:[{from:'img',to:'s'}]};
 const job={id:'j',projectId:'p',sourceId:'s',status:'failed',prompt:'参考 @图片4 和 @音频2',modelId:'63',duration:5,aspect:'16:9',referenceIds:['img','missing'],references:[{nodeId:'img',kind:'image',alias:'图片4',purpose:'style'},{nodeId:'missing',kind:'audio',alias:'音频2',purpose:'voice'}]};
 const before=structuredClone(project),retry=planVideoRetry(project,job,extra=>({id:'retry',type:'video',w:280,...extra}));
 assert.deepEqual(project,before);
 assert.equal(retry.node.videoDraft.prompt,job.prompt);
 assert.equal(retry.node.videoDraft.aliases[0].alias,'图片4');
 assert.equal(retry.node.videoDraft.aliases[1].alias,'音频2');
 assert.deepEqual(retry.edges,[{from:'img',to:'retry'}]);
 assert.deepEqual(retry.missing,['missing']);
 assert.equal(retry.node.y,320,'retry must not cover another node');
 for(const status of ['pending','unknown','succeeded'])assert.throws(()=>planVideoRetry(project,{...job,status},()=>{}),/不能直接重试/);
 assert.throws(()=>planVideoRetry({...project,id:'other'},job,()=>{}),/不能直接重试/);
 assert.throws(()=>planVideoRetry(project,{...job,retryable:false},()=>{}),/不能直接重试/);
});
test('short audio is an advisory, without claiming a universal two-second model rule',()=>{
 assert.match(shortAudioWarning([{kind:'audio',alias:'音频2',duration:1.8}]),/@音频2.*1.8 秒.*建议/);
 assert.equal(shortAudioWarning([{kind:'audio',duration:5}]),'');
 assert.equal(shortAudioWarning([{kind:'audio'}]),'');
});
