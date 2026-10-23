// Find a nearby empty rectangle for a new card. Existing node positions are never
// changed; the caller's checkpoint keeps creation and placement one undo step.
export function freeNodePosition(nodes,preferred={x:60,y:60,w:280,h:260},heightOf=n=>n.h||260){
 const finite=(n,f)=>Number.isFinite(n)?n:f,gap=32;
 const origin={x:finite(preferred.x,60),y:finite(preferred.y,60)};
 const w=Math.max(100,finite(preferred.w,280)),h=Math.max(100,finite(preferred.h,260));
 const occupied=(nodes||[]).filter(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)).map(n=>({x:n.x,y:n.y,w:Math.max(100,finite(n.w,280)),h:Math.max(100,finite(heightOf(n),260))}));
 const blocked=q=>occupied.some(n=>q.x<n.x+n.w+gap&&q.x+w+gap>n.x&&q.y<n.y+n.h+gap&&q.y+h+gap>n.y);
 if(!blocked(origin))return origin;
 const candidates=[];
 for(const n of occupied){
  for(const x of [n.x+n.w+gap,n.x-w-gap])for(const y of [origin.y,n.y,n.y+n.h-h])candidates.push({x,y});
  for(const y of [n.y+n.h+gap,n.y-h-gap])for(const x of [origin.x,n.x,n.x+n.w-w])candidates.push({x,y});
 }
 candidates.sort((a,b)=>(a.x-origin.x)**2+(a.y-origin.y)**2-((b.x-origin.x)**2+(b.y-origin.y)**2));
 for(const candidate of candidates)if(!blocked(candidate))return candidate;
 return {x:Math.max(origin.x,...occupied.map(n=>n.x+n.w+gap)),y:origin.y};
}
