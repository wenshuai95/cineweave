import {getCanvasStoryContext,editStoryNode,syncCanonicalNodes} from './workstation/canvas-source.mjs';

// Edit the owning record, never the generated summary of a structured shot.
export function inlineNodeText(project,id){
 const node=project.nodes.find(n=>n.id===id);if(node?.type!=='text')return null;
 const context=getCanvasStoryContext(project,id),kind=context?.kind;
 return {node,value:kind==='shot'?context.record.description||'':node.text||'',limit:['asset','shot'].includes(kind)?6000:200000,label:kind==='shot'?'分镜画面描述':'节点正文'};
}
export function writeInlineNodeText(project,id,value){
 const state=inlineNodeText(project,id);if(!state||typeof value!=='string')return false;
 value=value.slice(0,state.limit);if(value===state.value)return false;
 const context=getCanvasStoryContext(project,id);
 if(context?.kind==='shot'){context.record.description=value;syncCanonicalNodes(project);}
 else if(context&&['script','asset'].includes(context.kind))editStoryNode(project,id,{text:value});
 else state.node.text=value;
 return true;
}
