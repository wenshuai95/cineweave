import {sanitizeVideoDraft} from './video-references.mjs';
import {referenceSnapshotFor} from './workstation/asset-image-context.mjs';

export function submittedReferenceSnapshot(job){
 if(Array.isArray(job?.referenceSnapshot))return job.referenceSnapshot;
 return (Array.isArray(job?.references)?job.references:[]).filter(reference=>reference?.nodeId).map(reference=>({nodeId:reference.nodeId,kind:reference.kind,legacy:true,unknown:true}));
}

/** Shared placement for a generated video result; no provider-specific metadata. */
export function planVideoResult(project,job,src,createNode){
 const existing=project.nodes.find(n=>n.generatedTask===job.id);if(existing)return {already:true,node:existing};
 const bundledSource=(project.boardGroups||[]).some(g=>g.shotBundle===true&&g.memberIds.includes(job.sourceId));
 const target=!bundledSource&&project.nodes.find(n=>n.id===job.sourceId&&n.type==='video'&&!n.src&&(n.text||'')===(job.sourceText||'')&&(!n.videoDraft?.prompt||n.videoDraft.prompt===job.prompt));
 if(!target&&project.nodes.length>=500)throw Error('画布节点已满，视频保留在任务中心，可清理后恢复');
 const origin=project.nodes.find(n=>n.id===job.sourceId),draft=sanitizeVideoDraft(target?.videoDraft||origin?.videoDraft);
 const details={videoDraft:sanitizeVideoDraft({...draft,prompt:job.prompt,modelId:job.modelId||draft.modelId,duration:job.duration?String(job.duration):draft.duration,resolution:job.resolution||draft.resolution,aspect:job.aspect||draft.aspect,aliases:job.references?.length?job.references:draft.aliases,referenceOrder:job.referenceIds||draft.referenceOrder,excludeSelf:true}),generatedInput:{modelId:job.modelId,duration:job.duration,resolution:job.resolution,aspect:job.aspect,references:job.references||[]},referenceSnapshot:submittedReferenceSnapshot(job),src,text:job.prompt,generatedTask:job.id,generatedSource:job.sourceId,generatedProvider:job.providerId||'provider',generatedModel:job.modelName||'',generatedPoints:job.points??null,generatedActualPoints:job.actualPoints??null,generatedAt:job.createdAt||Date.now()};
 const position=origin?{x:origin.x+origin.w+100,y:origin.y}:{};
 if(origin)for(let i=0;i<=project.nodes.length;i++){if(!project.nodes.some(n=>Math.abs(n.y-position.y)<250&&position.x<n.x+n.w+24&&position.x+280>n.x-24))break;position.y+=280;}
 const node=target?{...target,...details}:createNode({...position,title:'Provider · '+job.prompt.slice(0,24),...details});
 const ids=[...new Set([job.sourceId,...(job.referenceIds||[])])].filter(id=>id&&id!==node.id&&project.nodes.some(n=>n.id===id));
 return {node,replace:!!target,edges:ids.filter(from=>!project.edges.some(e=>e.from===from&&e.to===node.id)).map(from=>({from,to:node.id}))};
}
