import {uid} from '../model.mjs';

// Canvas media is offered directly, without silently appending anything to a track.
export function cutLibraryRows(project,{filter='all',query='',includeImages=false}={}){
 const assets=project.workstation.assets.filter(a=>(includeImages?['video','audio','image']:['video','audio']).includes(a.kind));
 const nodes=project.nodes.filter(n=>['video','audio'].includes(n.type)&&/^data:(video|audio)\//.test(n.src||''));
 const directors=new Set(project.nodes.filter(n=>n.type==='director').map(n=>n.id));
 const previzIds=new Set(project.edges.filter(e=>directors.has(e.from)).map(e=>e.to));
 const rows=assets.map(a=>{
  const linked=nodes.filter(n=>n.mediaId===a.id),node=linked.find(n=>previzIds.has(n.id))||linked[0];
  return {key:'asset:'+a.id,assetId:a.id,nodeId:node?.id,name:a.name,kind:a.kind,durationSec:a.durationSec,previz:linked.some(n=>previzIds.has(n.id)),source:node?'画布':'本地素材'};
 });
 for(const n of nodes){
  if(assets.some(a=>a.id===n.mediaId))continue;
  rows.push({key:'node:'+n.id,nodeId:n.id,name:n.title,kind:n.type,durationSec:null,previz:previzIds.has(n.id),source:'画布'});
 }
 const q=query.trim().toLocaleLowerCase();
 return rows.filter(r=>(filter==='all'||(filter==='previz'?r.previz:r.kind===filter))&&(!q||r.name.toLocaleLowerCase().includes(q)));
}

// Stage one immutable output before the caller commits it to the owning project.
export function prepareCutCanvasResult(project,{src,size,frames,fps,height,sourceNodeIds=[],mediaId=uid(),nodeId=uid(),createdAt=Date.now(),name}={}){
 if(project.nodes.length>=500)throw Error('画布节点已达 500 个上限，请整理后再送入画布');
 if(project.workstation.assets.length>=500)throw Error('素材库已达 500 个上限，请整理后再送入画布');
 if(!/^data:video\/mp4;base64,[A-Za-z0-9+/\r\n]*={0,2}$/.test(src||'')||!Number.isFinite(size)||size<=0||size>300*1024*1024)throw Error('成片无效或超过 300 MB，请导出文件后分段使用');
 if(!Number.isInteger(frames)||frames<=0||![24,25,30].includes(fps)||![720,1080].includes(height))throw Error('成片参数无效，请重新导出');
 const sources=project.nodes.filter(n=>sourceNodeIds.includes(n.id)),anchor=sources.at(-1);
 let x=anchor?anchor.x+anchor.w+80:80,y=anchor?anchor.y:80;
 for(let i=0;i<=project.nodes.length&&project.nodes.some(n=>Math.abs(n.x-x)<300&&Math.abs(n.y-y)<220);i++)y+=260;
 const title=String(name||project.name+' · 粗剪').slice(0,160),durationSec=frames/fps,width=height===1080?1920:1280;
 const asset={id:mediaId,kind:'video',name:title+'.mp4',mime:'video/mp4',size,durationSec,width,height,createdAt};
 const node={id:nodeId,type:'video',title,text:`剪辑输出 · ${durationSec.toFixed(2)} 秒 · ${fps} fps · ${width} × ${height}\nH.264 / MP4 · 保留时间线裁切、拼接与音量`,x,y,w:280,src,mediaId};
 return {asset,node,edges:sources.map(n=>({from:n.id,to:nodeId}))};
}
