import test from 'node:test';
import assert from 'node:assert/strict';
import {planCanvasArrangement} from '../src/canvas-arrange.mjs';
import {boardItems,groupCardRect} from '../src/board-presentation.mjs';
const node=(id,extra={})=>({id,type:'text',x:3,y:7,w:320,text:'保留内容',...extra});
const apply=(p,positions)=>{for(const position of positions)Object.assign(p.nodes.find(n=>n.id===position.id),{x:position.x,y:position.y});};
function noOverlap(p,positions){const boxes=positions.map(pos=>({...pos,w:p.nodes.find(n=>n.id===pos.id).w,h:240}));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,`${a.id} overlaps ${b.id}`);}}
test('reference flow arranges from left to right without changing project data',()=>{
 const p={nodes:['script','shot','asset','image'].map(id=>node(id)),edges:[{from:'script',to:'shot'},{from:'shot',to:'asset'},{from:'asset',to:'image'}]},before=structuredClone(p),positions=planCanvasArrangement(p,()=>240);
 assert.deepEqual(p,before);for(let i=1;i<positions.length;i++)assert.ok(positions[i].x>positions[i-1].x);noOverlap(p,positions);
});
test('cycles and disconnected cards remain finite, separated and deterministic',()=>{
 const p={nodes:Array.from({length:40},(_,i)=>node('n'+i,{w:i%3===0?600:320})),edges:[{from:'n0',to:'n1'},{from:'n1',to:'n0'},{from:'n1',to:'n2'}]};
 const first=planCanvasArrangement(p,()=>240);assert.equal(first.length,40);assert.ok(first.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));noOverlap(p,first);apply(p,first);assert.deepEqual(planCanvasArrangement(p,()=>240),first);
});
test('group moves as a block and preserves member offsets and membership',()=>{
 const p={nodes:[node('a',{x:120,y:150}),node('b',{x:560,y:210}),node('c')],boardGroups:[{id:'g',name:'一组',memberIds:['a','b']}],edges:[{from:'b',to:'c'}]},before=structuredClone(p),positions=planCanvasArrangement(p,()=>240);
 const a=positions.find(p=>p.id==='a'),b=positions.find(p=>p.id==='b'),c=positions.find(p=>p.id==='c');assert.equal(b.x-a.x,440);assert.equal(b.y-a.y,60);assert.ok(c.x>b.x+320);assert.deepEqual(p,before);noOverlap(p,positions);
});
test('measured tall cards reserve their full height',()=>{
 const p={nodes:Array.from({length:9},(_,i)=>node('n'+i)),edges:[]},positions=planCanvasArrangement(p,n=>n.id==='n0'?1200:240);const a=positions.find(n=>n.id==='n0'),next=positions.find(n=>n.id==='n1');assert.equal(next.x,a.x);assert.ok(next.y>=a.y+1280);
});
test('empty project has no positions and group self-edges need no special handling',()=>{
 assert.deepEqual(planCanvasArrangement({nodes:[],edges:[]}),[]);const p={nodes:[node('a'),node('b',{x:400})],boardGroups:[{id:'g',memberIds:['a','b']}],edges:[{from:'a',to:'b'},{from:'b',to:'a'}]};assert.equal(planCanvasArrangement(p).length,2);
});
test('shot envelope and all its versions move together regardless of data group order and card height',()=>{
 const p={nodes:[node('v1',{x:1400,y:900}),node('entry',{x:600,y:20}),node('image',{x:30,y:60}),node('v2',{x:2000,y:900}),node('out')],boardGroups:[{id:'versions',name:'版本',memberIds:['v1','v2'],videoVersions:true,sourceNodeId:'entry',collapsed:true},{id:'shot',name:'镜头',memberIds:['entry','image'],shotBundle:true,shotSourceId:'entry',collapsed:true}],edges:[{from:'image',to:'entry'},{from:'entry',to:'v1'},{from:'v2',to:'out'}]},before=structuredClone(p);
 const moves=planCanvasArrangement(p,()=>240);assert.deepEqual(p,before);assert.equal(moves.length,p.nodes.length);apply(p,moves);
 const delta=p.nodes[0].x-before.nodes[0].x,dy=p.nodes[0].y-before.nodes[0].y;for(const id of ['entry','image','v2']){const n=p.nodes.find(n=>n.id===id),old=before.nodes.find(n=>n.id===id);assert.equal(n.x-old.x,delta);assert.equal(n.y-old.y,dy);}
 const items=boardItems(p,()=>({w:320,h:240}));assert.equal(items.length,2);const card=groupCardRect(p,p.boardGroups[1]);assert.equal(card.h,300);assert.ok(items[1].x>=card.x+card.w);assert.deepEqual(planCanvasArrangement(p,()=>240),moves);
});
test('stacked collapsed version and shot cards reserve 300 pixels rather than ordinary card height',()=>{
 const p={nodes:['a','b','c','d'].map((id,i)=>node(id,{x:i*100})),boardGroups:[{id:'va',memberIds:['a'],videoVersions:true,collapsed:true},{id:'sb',memberIds:['b'],shotBundle:true,shotSourceId:'b',collapsed:true},{id:'vc',memberIds:['c'],videoVersions:true,collapsed:true},{id:'sd',memberIds:['d'],shotBundle:true,shotSourceId:'d',collapsed:true}],edges:[]};
 apply(p,planCanvasArrangement(p,()=>240));const items=boardItems(p,()=>({w:320,h:240}));for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
});
