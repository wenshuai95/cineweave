import {object,uid} from './model.mjs';
export const modelKinds={scene:'场景',human:'人形角色',animal:'动物',creature:'怪物 / 其他生物'};
export function generatedModelNode(project,job,modelSrc){
 if(project.id!==job.projectId)throw Error('请先打开生成任务所属工程');
 const existing=project.nodes.find(n=>n.modelTask===job.id);if(existing)return existing;
 if(project.nodes.length>=500)throw Error('画布节点已达上限，请先删除不需要的节点');
 const source=project.nodes.find(n=>n.id===job.sourceId);
 const n={id:uid(),type:'model',title:job.title,text:`${modelKinds[job.kind]} · 本地模型\n模型已下载到本地；拖线到导演台节点即可使用。`,x:(source?.x||0)+(source?.w||280)+90,y:source?.y||80,w:280,modelSrc,modelSize:job.size,modelKind:job.kind,modelTask:job.id,src:source?.src};
 project.nodes.push(n);if(source)project.edges.push({from:source.id,to:n.id});return n;
}
export function modelNodeToStage(project,node,directorId){
 if(node.type!=='model'||!node.modelSrc)throw Error('请先导入 3D 模型');
 let director=project.nodes.find(n=>n.type==='director'&&(!directorId||n.id===directorId));
 if(directorId&&!director)throw Error('目标导演台节点不存在');
 const existing=project.objects.find(o=>o.id===node.objectId);
 if(!existing&&project.objects.length>=300)throw Error('场景对象已达上限');
 if(!director&&project.nodes.length>=500)throw Error('无法添加预演节点：画布已满');
 const o=existing||object('model',node.title);
 if(!existing){o.modelSrc=node.modelSrc;o.modelSize=node.modelSize;project.objects.push(o);node.objectId=o.id;}
 if(!director){director={id:uid(),type:'director',title:'生成模型 · 3D 预演',text:'在导演台摆放模型、设计镜头与运动轨迹。',x:node.x+370,y:node.y,w:280};project.nodes.push(director);}
 if(!project.edges.some(e=>e.from===node.id&&e.to===director.id))project.edges.push({from:node.id,to:director.id});
 return o;
}

// A reference wire never invokes a paid API. Only a finished model imports geometry.
export function connectCanvasNodes(project,edge){
 const source=project.nodes.find(n=>n.id===edge.from),target=project.nodes.find(n=>n.id===edge.to);
 if(!source||!target||source===target)throw Error('请选择两个不同的有效节点');
 if(source.type==='model'&&target.type==='director'){
  const existed=project.objects.some(o=>o.id===source.objectId),o=modelNodeToStage(project,source,target.id);
  return {objectId:o.id,imported:!existed,director:true};
 }
 if(!project.edges.some(e=>e.from===edge.from&&e.to===edge.to))project.edges.push({...edge});
 return {objectId:target.type==='director'?project.objects.find(o=>o.id===source.objectId)?.id:undefined,imported:false,director:target.type==='director'};
}
