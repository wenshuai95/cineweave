import {isStoryNodeCurrent,isAssetImageCurrent} from './story-canvas.mjs';
// Small provenance stamps, never a second copy of project text or credentials.
function stamp(value){
 const text=JSON.stringify(value);let a=2166136261,b=5381;
 for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}
 return `${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}
export function normalizeWorkflow(raw){
 const out={};
 for(const key of ['scriptForShots','sourceForAssets'])if(typeof raw?.[key]==='string'&&/^[a-f0-9]{16}$/.test(raw[key]))out[key]=raw[key];
 return out;
}
const scriptStamp=ws=>stamp([ws.script||'',ws.writing?.brief||'']);
const assetStamp=ws=>stamp([ws.script||'',ws.writing?.brief||'',(ws.story?.shots||[]).map(s=>[s.id,s.scene,s.characters,s.description,s.dialogue,s.duration,s.shotSize,s.cameraMovement])]);
export function recordWorkflowStep(ws,step){
 ws.workflow=normalizeWorkflow(ws.workflow);
 if(step==='shots')ws.workflow.scriptForShots=scriptStamp(ws);
 if(step==='assets')ws.workflow.sourceForAssets=assetStamp(ws);
}
export function workflowState(project){
 const ws=project.workstation,story=ws.story||{shots:[],assets:[]},flow=normalizeWorkflow(ws.workflow);
 const shotsStale=!!story.shots.length&&!!flow.scriptForShots&&flow.scriptForShots!==scriptStamp(ws);
 const assetsStale=!!story.assets.length&&!!flow.sourceForAssets&&flow.sourceForAssets!==assetStamp(ws);
 const nodes=new Set((project.nodes||[]).map(n=>n.id));
 const planned=[...story.shots,...story.assets];
 const pendingSync=[['shots',story.shots],['assets',story.assets]].reduce((count,[kind,items])=>count+items.filter((r,i)=>!isStoryNodeCurrent(r,(project.nodes||[]).find(n=>n.id===r.canvasNodeId),kind,i)||(kind==='assets'&&!isAssetImageCurrent(project,r))).length,0);
 return {scriptChars:(ws.script||'').trim().length,shots:story.shots.length,assets:story.assets.length,
  synced:planned.filter(r=>nodes.has(r.canvasNodeId)).length,total:planned.length,pendingSync,
  shotsStale,assetsStale,
  clips:(ws.sequence?.video?.length||0)+(ws.sequence?.audio?.length||0),
  deliveries:(ws.deliver?.tasks||[]).filter(t=>t.status==='done').length};
}
