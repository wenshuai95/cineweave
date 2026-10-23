import {MAX_BOARD_NODES} from './board-operations.mjs';

// Plan a result without overwriting an existing image or breaking template wires.
// `context` is an immutable provenance snapshot from the source node; it only
// marks where the result came from, never which asset it belongs to.
export function planCanvasImageResult(project,{sourceId,taskId,src,prompt,createNode,context=null}){
 const existing=project.nodes.find(n=>n.generatedTask===taskId);
 if(existing)return {already:true,node:existing};
 const extra=context?{imageResultContext:structuredClone(context)}:{};
 const target=project.nodes.find(n=>n.id===sourceId&&n.type==='image'&&!n.src);
 if(target)return {replace:true,node:{...target,src,text:prompt,generatedTask:taskId,...extra}};
 if(project.nodes.length>=MAX_BOARD_NODES)throw Error('画布节点已满，图片仍保留在任务中，可释放节点后恢复');
 const node=createNode({src,text:prompt,generatedTask:taskId,...extra});
 return {replace:false,node,edge:project.nodes.some(n=>n.id===sourceId)?{from:sourceId,to:node.id}:null};
}
export function canvasImagePrompt(project,source){
 if(!source)return '';
 const incoming=project.edges.filter(e=>e.to===source.id).map(e=>project.nodes.find(n=>n.id===e.from)).filter(n=>n&&['text','actor','scene'].includes(n.type)&&n.text?.trim()).slice(0,3);
 // A template's media description is guidance; connected definitions are the actual prompt.
 return (incoming.length?incoming.map(n=>n.title+'\n'+n.text).join('\n\n'):source.text||'').slice(0,6000);
}
