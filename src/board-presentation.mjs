// Presentation only: collapsed cards retain every source node and actual edge.
import {bundleMemberIds} from './shot-bundles.mjs';
export const GROUP_CARD_WIDTH=360;
export const GROUP_CARD_HEIGHT=190;
export function collapsedGroupFor(project,nodeId){const groups=project.boardGroups||[];return groups.find(g=>g.shotBundle===true&&g.collapsed===true&&bundleMemberIds(project,g).includes(nodeId))||groups.find(g=>g.collapsed===true&&g.memberIds.includes(nodeId));}
export function groupCardRect(project,group,visible=()=>true){
 const ids=new Set(bundleMemberIds(project,group)),members=project.nodes.filter(n=>ids.has(n.id)&&visible(n));
 if(!members.length)return null;
 return {x:members[0].x,y:members[0].y,w:GROUP_CARD_WIDTH,h:group.videoVersions||group.shotBundle?300:GROUP_CARD_HEIGHT};
}
export function boardItems(project,sizeOf,visible=()=>true){
 const out=[],seen=new Set();
 for(const n of project.nodes){
  if(!visible(n))continue;
  const group=collapsedGroupFor(project,n.id);
  if(group){if(seen.has(group.id))continue;seen.add(group.id);out.push({id:'group:'+group.id,groupId:group.id,memberIds:bundleMemberIds(project,group).filter(id=>project.nodes.some(n=>n.id===id&&visible(n))),...groupCardRect(project,group,visible)});}
  else out.push({id:n.id,memberIds:[n.id],x:n.x,y:n.y,...sizeOf(n)});
 }
 return out;
}
export function boardWires(project,items){
 const itemFor=new Map(items.flatMap(item=>item.memberIds.map(id=>[id,item]))),wires=new Map();
 for(const [index,edge] of project.edges.entries()){
  const a=itemFor.get(edge.from),b=itemFor.get(edge.to);if(!a||!b||a===b)continue;
  const key=JSON.stringify([a.id,b.id]);let wire=wires.get(key);
  if(!wire){wire={a,b,indices:[],groupIds:[a.groupId,b.groupId].filter(Boolean)};wires.set(key,wire);}wire.indices.push(index);
 }
 return [...wires.values()];
}
export function ensureStoryShotGroup(project,{force=false}={}){
 const groups=project.boardGroups||[],group=groups.find(g=>g.storyShots===true),claimed=new Set(groups.filter(g=>g!==group).flatMap(g=>g.memberIds));
 const shots=new Set((project.workstation?.story?.shots||[]).map(s=>s.id));
 const current=project.nodes.filter(n=>n.storyRef?.kind==='shot'&&shots.has(n.storyRef.id)&&!claimed.has(n.id)&&(force||!n.storyStandalone));
 if(force)for(const n of current)delete n.storyStandalone;
 const existing=new Set(project.nodes.map(n=>n.id)),members=[...new Set([...(group?.memberIds||[]).filter(id=>existing.has(id)),...current.map(n=>n.id)])];
 if(!members.length||(!group&&members.length<2)||(!group&&groups.length>=200))return null;
 if(group){group.memberIds=members;if(force)group.collapsed=true;return group;}
 const used=new Set(groups.map(g=>g.id));let id='story-shots';for(let i=2;used.has(id);i++)id='story-shots-'+i;
 const next={id,name:'分镜组',memberIds:members,storyShots:true,collapsed:true};project.boardGroups=[...groups,next];return next;
}
export function detachGroupNode(project,groupId,nodeId){
 const group=project.boardGroups?.find(g=>g.id===groupId);if(!group?.memberIds.includes(nodeId))return false;
 const node=project.nodes.find(n=>n.id===nodeId),rect=groupCardRect(project,group);if(!node||!rect)return false;
 group.memberIds=group.memberIds.filter(id=>id!==nodeId);node.storyStandalone=true;
 node.x=rect.x+rect.w+96;node.y=rect.y;
 // Avoid covering another standalone node; all media, provenance and wires stay intact.
 while(project.nodes.some(n=>n!==node&&!collapsedGroupFor(project,n.id)&&node.x<n.x+n.w&&node.x+node.w>n.x&&Math.abs(node.y-n.y)<280))node.y+=320;
 project.boardGroups=project.boardGroups.filter(g=>g.memberIds.length);return true;
}
