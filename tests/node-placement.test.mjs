import test from 'node:test';
import assert from 'node:assert/strict';
import {freeNodePosition} from '../src/node-placement.mjs';
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+280>b.x&&a.y<b.y+b.h&&a.y+260>b.y;
test('new card uses preferred location when clear and never moves the existing layout',()=>{
 const nodes=[{id:'one',x:-500,y:-200,w:280,h:400}],before=structuredClone(nodes);
 assert.deepEqual(freeNodePosition(nodes,{x:20,y:40}),{x:20,y:40});assert.deepEqual(nodes,before);
});
test('repeated creation around an occupied center finds distinct free positions',()=>{
 const nodes=[{id:'director',x:0,y:0,w:280,h:260}];
 for(let i=0;i<30;i++){const position=freeNodePosition(nodes,{x:0,y:0});assert.ok(nodes.every(n=>!overlap(position,n)));nodes.push({...position,w:280,h:260});}
 assert.equal(nodes[0].x,0);assert.equal(nodes[0].y,0);
});
test('placement respects measured card heights and off-grid coordinates',()=>{
 const nodes=[{x:10,y:15,w:400}];const next=freeNodePosition(nodes,{x:20,y:400,w:280,h:260},()=>900);
 assert.ok(!overlap(next,{x:10,y:15,w:400,h:900}));
});
