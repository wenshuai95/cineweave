import test from 'node:test';
import assert from 'node:assert/strict';
import {nodeOverlayPosition} from '../src/node-popover.mjs';

const overlap=(p,o,q)=>p.left<q.x+q.w&&p.left+o.width>q.x&&p.top<q.y+q.h&&p.top+o.height>q.y;
test('a busy low-zoom board docks the toolbar at a labelled edge instead of pushing it far from the selected node',()=>{
 const node={x:400,y:300,w:280,h:160},overlay={width:300,height:44};
 const obstacles=[
  {x:0,y:100,w:700,h:180}, // above + top-left, leaves a far top-right slot
  {x:0,y:350,w:1080,h:370}, // below and the bottom band
  {x:0,y:240,w:392,h:120}, // left of the node
  {x:680,y:240,w:400,h:120} // right of the node
 ];
 const result=nodeOverlayPosition({board:{width:1080,height:720},node,overlay,obstacles});
 assert.equal(result.placement,'docked');assert.equal(result.dock,'top');
 assert.ok(!overlap(result,overlay,node),'never covers the selected image');
 assert.ok(result.top>=60&&result.top+overlay.height<=720-85);
 assert.ok(result.left>=12&&result.left+overlay.width<=1068);
 const dx=Math.max(0,node.x-(result.left+overlay.width),result.left-(node.x+node.w));
 const dy=Math.max(0,node.y-(result.top+overlay.height),result.top-(node.y+node.h));
 assert.ok(Math.hypot(dx,dy)<260,'docked at the nearest clear edge, not pushed off the visible work area');
});
test('ordinary selected nodes still use the close above/below placement and do not get a dock label',()=>{
 const plain=nodeOverlayPosition({board:{width:1080,height:720},node:{x:400,y:300,w:280,h:160},overlay:{width:300,height:44}});
 assert.equal(plain.placement,'above');assert.equal(plain.dock,undefined);
});
test('busy landscape, portrait, edge and resized nodes keep the source and dialogue clear',()=>{
 const obstacles=[
  {x:0,y:90,w:640,h:150},
  {x:0,y:352,w:1080,h:368},
  {x:0,y:220,w:360,h:140},
  {x:720,y:220,w:360,h:140}
 ];
 for(const node of [
  {x:360,y:280,w:360,h:240},
  {x:430,y:220,w:220,h:420},
  {x:12,y:300,w:280,h:160},
  {x:900,y:280,w:200,h:160},
  {x:360,y:280,w:720,h:320}
 ])for(const overlay of [{width:300,height:44},{width:620,height:48}]){
  const result=nodeOverlayPosition({board:{width:1080,height:720},node,overlay,obstacles});
  assert.ok(!overlap(result,overlay,node),JSON.stringify({node,result}));
  if(result.placement!=='outside'){assert.ok(result.top>=60&&result.top+overlay.height<=635,JSON.stringify({node,result}));}
 }
});
