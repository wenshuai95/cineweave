import {sanitizeSelection} from './board-operations.mjs';
import {bundleMemberIds} from './shot-bundles.mjs';
// A card/title selects the whole group even when a media category hides some
// members. Keep movement, copy and deletion consistent with that visible card.
export function groupAwareSelection(project,ids,visible=()=>true){
 const next=sanitizeSelection(ids,project.nodes),selected=new Set(next),whole=new Set();
 for(const g of project.boardGroups||[]){const members=bundleMemberIds(project,g);if(members.length&&members.every(id=>selected.has(id)))members.forEach(id=>whole.add(id));}
 return next.filter(id=>whole.has(id)||visible(project.nodes.find(n=>n.id===id)));
}
