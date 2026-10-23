import {groupCardRect} from './board-presentation.mjs';
import {bundleMemberIds} from './shot-bundles.mjs';
// Plan positions only: references, media, edges and group membership stay intact.
// Groups move as a single block and retain their internal layout.
export function planCanvasArrangement(project,heightOf=()=>480){
 const nodes=project.nodes||[],byId=new Map(nodes.map(n=>[n.id,n]));
 const groupFor=new Map();
 for(const group of project.boardGroups||[])if(group.shotBundle)for(const id of bundleMemberIds(project,group))if(!groupFor.has(id))groupFor.set(id,group.id);
 for(const group of project.boardGroups||[])for(const id of group.memberIds||[])if(byId.has(id)&&!groupFor.has(id))groupFor.set(id,group.id);
 const units=[],unitFor=new Map(),groupUnits=new Map();
 for(const node of nodes){
  const groupId=groupFor.get(node.id);let unit=groupId&&groupUnits.get(groupId);
  if(!unit){unit={index:units.length,members:[],grouped:!!groupId,collapsed:!!groupId&&(project.boardGroups||[]).find(g=>g.id===groupId)?.collapsed===true};units.push(unit);if(groupId)groupUnits.set(groupId,unit);}
  unit.members.push(node);unitFor.set(node.id,unit.index);
 }
 for(const unit of units){
  const rects=unit.members.map(n=>({node:n,x:n.x,y:n.y,w:n.w,h:Math.max(80,Number(heightOf(n))||480)}));
  unit.left=Math.min(...rects.map(n=>n.x));unit.top=Math.min(...rects.map(n=>n.y));
  unit.pad=unit.grouped&&!unit.collapsed?32:0;unit.head=unit.grouped&&!unit.collapsed?48:0;
  unit.w=Math.max(...rects.map(n=>n.x+n.w))-unit.left+unit.pad*2;
  unit.h=Math.max(...rects.map(n=>n.y+n.h))-unit.top+unit.head+unit.pad;
  if(unit.collapsed){const card=groupCardRect(project,(project.boardGroups||[]).find(g=>g.id===groupFor.get(unit.members[0].id)));unit.left=card.x;unit.top=card.y;unit.w=card.w;unit.h=card.h;}
 }
 if(!units.length)return [];
 const links=units.map(()=>new Set());
 for(const edge of project.edges||[]){const from=unitFor.get(edge.from),to=unitFor.get(edge.to);if(from!==undefined&&to!==undefined&&from!==to)links[from].add(to);}
 // Collapse cycles so any valid user-made reference graph has a finite layout.
 let serial=0;const visits=new Map(),low=new Map(),stack=[],active=new Set(),components=[],componentFor=[];
 const visit=id=>{visits.set(id,serial);low.set(id,serial++);stack.push(id);active.add(id);
  for(const to of links[id]){if(!visits.has(to)){visit(to);low.set(id,Math.min(low.get(id),low.get(to)));}else if(active.has(to))low.set(id,Math.min(low.get(id),visits.get(to)));}
  if(low.get(id)===visits.get(id)){const component=[];let next;do{next=stack.pop();active.delete(next);componentFor[next]=components.length;component.push(next);}while(next!==id);components.push(component);}
 };
 units.forEach(u=>{if(!visits.has(u.index))visit(u.index);});
 const outgoing=components.map(()=>new Set()),indegree=components.map(()=>0),rank=components.map(()=>0);
 links.forEach((targets,from)=>{for(const to of targets){const a=componentFor[from],b=componentFor[to];if(a!==b&&!outgoing[a].has(b)){outgoing[a].add(b);indegree[b]++;}}});
 const queue=indegree.flatMap((n,i)=>n===0?[i]:[]);
 for(let cursor=0;cursor<queue.length;cursor++){const id=queue[cursor];for(const next of outgoing[id]){rank[next]=Math.max(rank[next],rank[id]+1);if(--indegree[next]===0)queue.push(next);}}
 const layers=new Map();for(const unit of units){const level=rank[componentFor[unit.index]];if(!layers.has(level))layers.set(level,[]);layers.get(level).push(unit);}
 const bands=[];let nextX=80;
 for(const level of [...layers.keys()].sort((a,b)=>a-b)){
  const members=layers.get(level),rows=Math.min(6,Math.ceil(Math.sqrt(members.length))),columns=[];let columnX=0;
  for(let offset=0;offset<members.length;offset+=rows){const items=members.slice(offset,offset+rows),height=items.reduce((sum,u)=>sum+u.h,0)+(items.length-1)*80,width=Math.max(...items.map(u=>u.w));columns.push({items,x:columnX,height});columnX+=width+96;}
  const height=Math.max(...columns.map(c=>c.height));bands.push({x:nextX,height,columns});nextX+=columnX+64;
 }
 const maxHeight=Math.max(...bands.map(b=>b.height)),positions=[];
 for(const band of bands)for(const column of band.columns){let y=80+(maxHeight-column.height)/2;
  for(const unit of column.items){const x=band.x+column.x;for(const n of unit.members)positions.push({id:n.id,x:x+unit.pad+n.x-unit.left,y:y+unit.head+n.y-unit.top});y+=unit.h+80;}
 }
 return positions;
}
