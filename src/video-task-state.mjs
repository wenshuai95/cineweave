import {sanitizeVideoDraft} from './video-references.mjs';

const phases={preparing:'准备参考',uploading:'上传参考',validating:'校验参数',submitting:'提交任务',generating:'平台生成中',downloading:'接收视频',succeeded:'生成完成',failed:'生成失败',unknown:'提交待核对'};
export function videoTaskState(job){
 const busy=['preparing','submitting','pending'].includes(job.status);
 const phase=busy?(Object.hasOwn(phases,job.phase)?job.phase:job.status==='pending'?'generating':job.status):job.status;
 return {busy,label:phases[phase]||'任务待查询',detail:job.message|| (busy?'可继续编辑，结果会保留在任务中心':'请在任务中心查看详情')};
}
export function latestVideoJobs(jobs){
 const out=new Map();
 for(const job of [...jobs].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)))if(job.sourceId)out.set(job.sourceId,job);
 return out;
}
export function referenceDurationText(duration){
 return Number.isFinite(duration)&&duration>0?`${duration.toFixed(2).replace(/\.?0+$/,'')} 秒`:'';
}
export function shortAudioWarning(references){
 const short=references.find(r=>r.kind==='audio'&&r.duration>0&&r.duration<=2);
 return short?`@${short.alias||'音频'} 只有 ${referenceDurationText(short.duration)}，建议换成长一些的片段；能否使用以当前模型校验为准。`:'';
}
// Retrying is an explicit new draft, never a replay of the paid submission.
// Original drafts, tasks and reference aliases are left intact, including missing aliases.
export function planVideoRetry(project,job,createNode){
 if(job.projectId!==project.id||job.status!=='failed'||job.retryable===false)throw Error('此任务不能直接重试，请先核对平台记录');
 if(project.nodes.length>=500)throw Error('画布节点已满，请先整理后重试');
 const original=project.nodes.find(n=>n.id===job.sourceId),refs=job.references||[];
 const draft=sanitizeVideoDraft({prompt:job.prompt,modelId:job.modelId,duration:String(job.duration||''),resolution:job.resolution||'',aspect:job.aspect||'',aliases:refs,referenceOrder:job.referenceIds||refs.map(r=>r.nodeId),excludeSelf:true});
 const ids=[...new Set(draft.referenceOrder)].filter(id=>project.nodes.some(n=>n.id===id&&n.src));
 const position={x:original?original.x+original.w+100:0,y:original?.y||0};
 while(project.nodes.some(n=>position.x<n.x+n.w+24&&position.x+280>n.x-24&&Math.abs(position.y-n.y)<280))position.y+=320;
 const node=createNode({...position,title:'重试 · '+String(job.prompt||'镜头').slice(0,20),text:job.prompt||'',videoDraft:draft});
 return {node,edges:ids.map(from=>({from,to:node.id})),missing:draft.referenceOrder.filter(id=>!ids.includes(id))};
}
