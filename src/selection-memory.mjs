import {resolveKeyRefs} from './timeline-multiselect.mjs';

// Canvas nodes and stage objects live in different ID spaces: board selection is
// a node id (plus an optional edge), stage selection is an object id (plus an
// optional timeline selection). Each workspace keeps its own memory and only
// restores what still exists when the user comes back or undoes an edit.
export function saveSelection({selected=null,timelineSelection=null,selectedEdge=null}={}){
 return {selected,timelineSelection:timelineSelection?JSON.parse(JSON.stringify(timelineSelection)):null,selectedEdge:selectedEdge?{...selectedEdge}:null};
}
function pruneTimelineSelection(ts,project){
 if(!ts||typeof ts!=='object')return null;
 if(ts.kind==='keys'){
  const hits=resolveKeyRefs(project.objects,ts.items||[]);
  return hits.length?{kind:'keys',items:hits.map(h=>h.ref)}:null;
 }
 if(ts.kind==='key'){
  const hits=resolveKeyRefs(project.objects,[ts]);
  return hits.length?{...hits[0].ref,kind:'key'}:null;
 }
 if(ts.kind==='action'){
  const o=project.objects.find(o=>o.id===ts.objectId);
  return o?.actions?.some(a=>a.id===ts.actionId)?{kind:'action',objectId:o.id,actionId:ts.actionId}:null;
 }
 if(ts.kind==='shot'){
  const shot=project.shots.find(s=>s.id===ts.shotId);
  return shot&&project.objects.some(o=>o.id===shot.cameraId)?{kind:'shot',shotId:shot.id}:null;
 }
 return null;
}
export function restoreSelection(memory,project,mode){
 const out={selected:null,timelineSelection:null,selectedEdge:null};
 if(!memory)return out;
 if(memory.selected&&(mode==='board'?project.nodes:project.objects).some(x=>x.id===memory.selected))out.selected=memory.selected;
 if(mode==='stage')out.timelineSelection=pruneTimelineSelection(memory.timelineSelection,project);
 if(mode==='board'&&memory.selectedEdge&&project.edges.some(e=>e.from===memory.selectedEdge.from&&e.to===memory.selectedEdge.to))out.selectedEdge=memory.selectedEdge;
 return out;
}
