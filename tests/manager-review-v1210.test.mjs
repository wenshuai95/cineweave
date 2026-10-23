import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCanvasCopy,pasteCanvasCopy,groupBounds,alignSelection,distributeSelection,regroup,pruneGroups,nodesInRect,minimapBounds,sanitizeSelection} from '../src/board-operations.mjs';
import {demoProject,clone,validateProject} from '../src/model.mjs';
const node=(id,x=0,y=0,extra={})=>({id,type:'text',title:id,text:'',x,y,w:200,...extra});
const size=n=>({w:n.w,h:n.h??100});
const idFactory=()=>{let i=0;return()=>`new_${++i}`};
const packet=(nodes,edges=[],groups=[])=>({app:'director-canvas',version:1,nodes,edges,groups});
test('cross-project copy strips scene/task bindings and preserves media and internal edges',()=>{
 const a=node('a',10,20,{src:'data:image/png;base64,AAAA',objectId:'old_object',sceneObjectIds:['old_prop'],modelTask:{taskId:'old'},generatedTask:'old',privateField:'x'}),b=node('b',500,100),c=node('c');
 const raw=buildCanvasCopy([a,b,c],[{from:'a',to:'b'},{from:'b',to:'c'}],['a','b'],[{id:'group',name:'镜头1',memberIds:['a','b','c']}]);
 const before=JSON.stringify(raw),pasted=pasteCanvasCopy(raw,{uid:idFactory(),limit:2});
 assert.equal(JSON.stringify(raw),before);assert.equal(pasted.nodes.length,2);assert.equal(pasted.nodes[0].src,a.src);assert.equal(pasted.nodes[0].x,50);
 for(const n of pasted.nodes)for(const key of ['objectId','sceneObjectIds','modelTask','generatedTask','privateField'])assert.equal(key in n,false);
 assert.deepEqual(pasted.edges,[{from:pasted.nodes[0].id,to:pasted.nodes[1].id}]);assert.deepEqual(pasted.groups[0].memberIds,pasted.nodes.map(n=>n.id));
});
test('copy/paste into another old-schema project keeps director data unchanged and reloads',()=>{
 const source=demoProject(),target=demoProject(),before=JSON.stringify({objects:target.objects,shots:target.shots});
 const raw=buildCanvasCopy(source.nodes,source.edges,source.nodes.map(n=>n.id));
 const r=pasteCanvasCopy(raw,{uid:idFactory(),limit:500-target.nodes.length});target.nodes.push(...r.nodes);target.edges.push(...r.edges);
 assert.equal(JSON.stringify({objects:target.objects,shots:target.shots}),before);assert.equal(validateProject(clone(target)).nodes.length,target.nodes.length);
});
test('batch capacity rejects before allocating ids and leaves its clipboard input intact',()=>{
 const raw=packet([node('a'),node('b')]),before=JSON.stringify(raw);let ids=0;
 assert.throws(()=>pasteCanvasCopy(raw,{uid:()=>{ids++;return 'new'},limit:1}),/上限/);assert.equal(ids,0);assert.equal(JSON.stringify(raw),before);
});
test('clipboard rejects dangling/self edges and malformed node ids',()=>{
 for(const edges of [[{from:'a',to:'absent'}],[{from:'a',to:'a'}]])assert.throws(()=>pasteCanvasCopy(packet([node('a')],edges),{uid:idFactory()}));
 assert.throws(()=>pasteCanvasCopy(packet([node('invalid id')]),{uid:idFactory()}));
});
test('clipboard rejects unsafe resources, duplicate ids and nonfinite geometry',()=>{
 for(const nodes of [[node('a',0,0,{src:'https://host/private'})],[node('a'),node('a')],[node('a',Infinity)]])assert.throws(()=>pasteCanvasCopy(packet(nodes),{uid:idFactory()}));
 assert.throws(()=>pasteCanvasCopy(packet([node('a')]),{uid:idFactory(),offset:{x:NaN,y:0}}));
});
test('group frame includes title bar and bottom of unequal member cards',()=>{
 const members=[node('a',30,50,{h:150}),node('b',400,200,{h:300})],r=groupBounds(members,size);
 assert.ok(r.y<50-28);assert.ok(r.y+r.h>=500+14);assert.ok(r.x+r.w>=600+14);
});
test('regrouping and deleting members leave no duplicate membership or dangling entries',()=>{
 const nodes=[node('a'),node('b'),node('c')],groups=[{id:'g1',name:'一',memberIds:['a','b']},{id:'g2',name:'二',memberIds:['c']}];
 const next=regroup(groups,['b','c'],'g3','镜头');assert.deepEqual(next.flatMap(g=>g.memberIds).sort(),['a','b','c']);
 const kept=pruneGroups(next,[nodes[0],nodes[2]]);assert.deepEqual(kept.flatMap(g=>g.memberIds).sort(),['a','c']);assert.equal(JSON.stringify(groups).includes('g3'),false);
});
test('alignment uses unequal rendered heights without mutating dimensions or source nodes',()=>{
 const nodes=[node('a',10,20,{h:80}),node('b',450,180,{h:300})],before=JSON.stringify(nodes);
 const bottom=alignSelection(nodes,['a','b'],'bottom',size);assert.equal(bottom.get('a').y+80,bottom.get('b').y+300);
 const right=alignSelection(nodes,['a','b'],'right',size);assert.equal(right.get('a').x+200,right.get('b').x+200);assert.equal(JSON.stringify(nodes),before);
});
test('distribution gives equal gaps with unequal card sizes and preserves outer span',()=>{
 const nodes=[node('a',0,0,{w:100}),node('b',350,20,{w:200}),node('c',900,30,{w:300})];const out=distributeSelection(nodes,['a','b','c'],'x',size);
 assert.equal(out.get('b').x-(out.get('a').x+100),out.get('c').x-(out.get('b').x+200));assert.equal(out.get('a').x,0);assert.equal(out.get('c').x+300,1200);
});
test('marquee and minimap support negative coordinates and exclude exact-touch selection',()=>{
 const nodes=[node('a',-200,-100),node('b',1000,0)];assert.deepEqual(nodesInRect(nodes,{x:-150,y:-80,w:100,h:50},size),['a']);
 assert.deepEqual(nodesInRect(nodes,{x:0,y:0,w:10,h:10},size),[]);assert.deepEqual(sanitizeSelection(['a','a','lost','b'],nodes),['a','b']);
 const r=minimapBounds([{x:-200,y:-100,w:200,h:100}],{x:1000,y:100,w:500,h:300});assert.ok(r.x<=-200&&r.x+r.w>=1500&&r.y+r.h>=400);
});
