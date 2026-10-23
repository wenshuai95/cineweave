import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasRelations,wireRelationState,relationTargets,fitRelationView,snapshotCanvasView} from '../src/canvas-focus.mjs';
import {boardItems,boardWires} from '../src/board-presentation.mjs';

const project=()=>({nodes:['source','hero','result','distant','next'].map((id,i)=>({id,x:i*400,y:0,w:300,h:200})),edges:[{from:'source',to:'hero'},{from:'hero',to:'result'},{from:'result',to:'next'},{from:'distant',to:'next'}]});

test('selection highlights only direct input/output edges, excluding neighbor-to-neighbor and transitive edges',()=>{
 const p=project(),before=structuredClone(p),r=canvasRelations(p,['hero']);
 assert.deepEqual(r.selectedIds,['hero']);assert.deepEqual(r.relatedIds,['hero','source','result']);assert.deepEqual(r.edgeIndices,[0,1]);
 assert.equal(wireRelationState({indices:[0]},r),'related');assert.equal(wireRelationState({indices:[2]},r),'muted');assert.deepEqual(p,before);
});
test('multi selection and full group selection include all directly attached relations',()=>{
 const r=canvasRelations(project(),['hero','distant','hero','deleted']);
 assert.deepEqual(r.selectedIds,['hero','distant']);assert.deepEqual(r.edgeIndices,[0,1,3]);assert.equal(wireRelationState({indices:[2,3]},r),'related');
});
test('empty or deleted selection restores all wires, and malformed dangling edges do not affect fit',()=>{
 const p=project();p.edges.push({from:'hero',to:'missing'});
 assert.equal(wireRelationState({indices:[1]},canvasRelations(p,[])),'neutral');
 assert.deepEqual(canvasRelations(p,['missing']).relatedIds,[]);assert.deepEqual(canvasRelations(p,['hero']).edgeIndices,[0,1]);
});
test('collapsed cards preserve related aggregated wires without opening groups or altering data',()=>{
 const p=project();p.boardGroups=[{id:'g',collapsed:true,memberIds:['hero','distant']}];const before=structuredClone(p);
 const items=boardItems(p,n=>({w:n.w,h:n.h})),wires=boardWires(p,items),r=canvasRelations(p,['hero','distant']);
 assert.equal(items.find(n=>n.groupId==='g').id,'group:g');
 assert.ok(wires.filter(w=>w.a.groupId==='g'||w.b.groupId==='g').every(w=>wireRelationState(w,r)==='related'));
 assert.ok(fitRelationView(items,r,{width:1080,height:720}));assert.deepEqual(p,before);
});
test('focus fits visible presentation bounds, preserves node placement, and saved return view is independent',()=>{
 const p=project(),before=structuredClone(p),items=boardItems(p,n=>({w:n.w,h:n.h}));
 const view=fitRelationView(items,canvasRelations(p,['hero']),{width:1440,height:940});
 assert.equal(view.zoom,1.15);assert.ok(items.filter(n=>['source','hero','result'].includes(n.id)).every(n=>n.x*view.zoom+view.x>=40&& (n.x+n.w)*view.zoom+view.x<=1400));
 const old={x:-100,y:80,zoom:.75},saved=snapshotCanvasView(old);old.x=400;assert.deepEqual(saved,{x:-100,y:80,zoom:.75});assert.deepEqual(p,before);
});
test('focus uses only rendered items when category filters hide related neighbors',()=>{
 const p=project(),r=canvasRelations(p,['hero']);const items=boardItems(p,n=>({w:n.w,h:n.h}),n=>n.id==='hero');
 const view=fitRelationView(items,r,{width:1080,height:720});assert.equal(view.zoom,1.15);
 assert.equal(fitRelationView([],r,{width:1080,height:720}),null);assert.equal(fitRelationView(items,r,{width:0,height:720}),null);assert.equal(snapshotCanvasView({x:0,y:0,zoom:NaN}),null);
});
test('relation navigation offers existing immediate sources/targets in stable order with no duplicates',()=>{
 const p=project();p.edges.push({from:'source',to:'hero'},{from:'hero',to:'missing'},{from:'hero',to:'hero'});
 assert.deepEqual(relationTargets(p,['hero'],'in'),['source']);assert.deepEqual(relationTargets(p,['hero'],'out'),['result']);assert.deepEqual(relationTargets(p,['hero']),['source','result']);assert.deepEqual(relationTargets(p,['hero','result'],'out'),['next']);
});
