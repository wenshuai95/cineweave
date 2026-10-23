// A shot card is a presentation envelope. Versions keep their real, exclusive
// membership in videoVersions groups; this function never changes ownership.
export function bundleVersionGroups(project,group){return group?.shotBundle===true&&group.shotSourceId?(project.boardGroups||[]).filter(g=>g.videoVersions===true&&g.sourceNodeId===group.shotSourceId):[];}
export function hiddenByShotBundle(project,group){return group?.videoVersions===true&&(project.boardGroups||[]).some(g=>g.shotBundle===true&&g.collapsed===true&&g.shotSourceId===group.sourceNodeId);}
export function bundleMemberIds(project,group){
 const existing=new Set((project.nodes||[]).map(n=>n.id));
 const ids=[...(group?.memberIds||[])];
 if(group?.shotBundle===true&&group.shotSourceId){
  for(const versions of bundleVersionGroups(project,group))ids.push(...(versions.memberIds||[]));
 }
 return [...new Set(ids)].filter(id=>existing.has(id));
}

// Return a complete, reviewable change without touching the source project.
// Only selected nodes and the source's direct inputs are considered.
export function planShotBundle(project,{nodeIds=[],sourceId,name,createId}={}){
 const nodes=project.nodes||[],byId=new Map(nodes.map(n=>[n.id,n])),groups=project.boardGroups||[];
 const selected=new Set(nodeIds);
 if([...selected].some(id=>!byId.has(id)))throw Error('所选节点已被移除，请重新选择镜头素材');
 const owner=new Map();for(const group of groups)for(const id of group.memberIds||[])owner.set(id,group);
 const selectedNodes=nodes.filter(n=>selected.has(n.id));
 const rootFor=node=>{const group=owner.get(node.id);return group?.videoVersions?group.sourceNodeId:group?.shotBundle?group.shotSourceId:node.generatedSource;};
 if(!sourceId){
  const roots=[...new Set(selectedNodes.map(rootFor).filter(id=>byId.has(id)))];
  const entries=selectedNodes.filter(n=>n.type==='video'&&!n.src);
  if(entries.length===1)sourceId=entries[0].id;
  else if(entries.length>1)throw Error('一次只能整理一个镜头，请只选择一个视频生成入口');
  else if(roots.length===1)sourceId=roots[0];
  else if(roots.length>1)throw Error('所选素材来自多个镜头，请分别整理');
  else if(selectedNodes.length===1)sourceId=selectedNodes[0].id;
  else throw Error('请选中一个视频生成入口，或指定这个镜头的来源节点');
 }
 const source=byId.get(sourceId);if(!source)throw Error('镜头来源节点已被移除，请重新选择');
 const sourceOwner=owner.get(sourceId);
 if(sourceOwner?.videoVersions&&sourceOwner.sourceNodeId!==sourceId)throw Error('请选择这个版本对应的生成入口整理镜头');
 const matches=groups.filter(g=>g.shotBundle===true&&g.shotSourceId===sourceId);
 if(matches.length>1)throw Error('这个镜头有多个重复镜头组，请先保留一个镜头组');
 const current=matches[0],converting=new Set(),excludedIds=[];
 selected.add(sourceId);
 // Selecting an entire ordinary group is explicit consent to convert its
 // grouping. A partial selection, or a dedicated group, is never dismantled.
 for(const id of selected){
  const group=owner.get(id);if(!group||group===current)continue;
  if(group.videoVersions){if(group.sourceNodeId!==sourceId)throw Error('所选版本属于其他镜头，请分别整理');continue;}
  if(group.storyShots)throw Error('请先将需要的分镜从分镜组中提取，再整理镜头');
  if(group.shotBundle)throw Error('所选节点已在另一个镜头组中，请先移出该镜头组');
  if(!group.memberIds.every(member=>selected.has(member)))throw Error('部分节点已在其他分组中，请选中完整分组后再整理');
  converting.add(group);
 }
 const desired=new Set([...(current?.memberIds||[]),...selected]);
 const allowedInputs=new Set(['text','image','video','audio']);
 for(const edge of project.edges||[])if(edge.to===sourceId&&allowedInputs.has(byId.get(edge.from)?.type)){
  const group=owner.get(edge.from);
  if(group&&group!==current&&!converting.has(group)){
   // Matching versions are already included dynamically. Other groups win.
   if(!(group.videoVersions&&group.sourceNodeId===sourceId))excludedIds.push(edge.from);
  }else desired.add(edge.from);
 }
 const memberIds=nodes.filter(n=>desired.has(n.id)&&!owner.get(n.id)?.videoVersions).map(n=>n.id);
 if(!memberIds.length)throw Error('这个镜头只有版本视频，请先连入参考素材或选中分镜文字，再整理镜头');
 if(memberIds.length>500)throw Error('镜头组节点过多，请缩小选择范围');
 const retained=groups.filter(g=>g!==current&&!converting.has(g));
 if(retained.length>=200)throw Error('画布分组已达上限，请先移除不需要的分组');
 const id=current?.id||createId?.();
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||retained.some(g=>g.id===id))throw Error('无法创建镜头组编号，请重试');
 const label=String(name??current?.name??`${source.title||'未命名镜头'} · 镜头组`).trim().slice(0,100)||'镜头组';
 const group={...(current?structuredClone(current):{}),id,name:label,memberIds,collapsed:current?.collapsed??true,shotBundle:true,shotSourceId:sourceId};
 const boardGroups=retained.map(g=>structuredClone(g));
 // Keep an existing group's position so arranging and the sidebar stay stable.
 const insertion=current?groups.slice(0,groups.indexOf(current)).filter(g=>!converting.has(g)).length:boardGroups.length;
 boardGroups.splice(Math.min(insertion,boardGroups.length),0,group);
 return {group,boardGroups,memberIds:[...memberIds],excludedIds:[...new Set(excludedIds)],updated:!!current};
}
