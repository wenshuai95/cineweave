import test from 'node:test';
import assert from 'node:assert/strict';
import {nodeOverlayPosition,positionNodeOverlay,installNodeOverlayTracking} from '../src/node-popover.mjs';

const at=(board,node,overlay,kind)=>nodeOverlayPosition({board,node,overlay,kind});
test('composer follows below the node, flips above when needed, and stays visible on a small board',()=>{
 assert.deepEqual(at({width:1000,height:1000},{x:300,y:180,w:200,h:100},{width:500,height:300},'composer'),{left:150,top:288,placement:'below'});
 assert.deepEqual(at({width:1000,height:1000},{x:300,y:650,w:200,h:100},{width:500,height:300},'composer'),{left:150,top:342,placement:'above'});
 const p=at({width:600,height:650},{x:300,y:280,w:200,h:100},{width:560,height:400},'composer');assert.ok(p.left>=0&&p.left+560<=600);assert.ok(p.top>=60&&p.top+400<=565);
});

test('toolbar centers above the node when the top reserve allows it',()=>{
 assert.deepEqual(at({width:1000,height:800},{x:400,y:200,w:200,h:100},{width:300,height:40}),{left:350,top:152,placement:'above'});
});
test('toolbar flips below the node when the 60px top reserve blocks the space above',()=>{
 assert.deepEqual(at({width:1000,height:800},{x:400,y:80,w:200,h:100},{width:300,height:40}),{left:350,top:188,placement:'below'});
 assert.deepEqual(at({width:1000,height:800},{x:400,y:108,w:200,h:100},{width:300,height:40}),{left:350,top:60,placement:'above'});
 assert.deepEqual(at({width:1000,height:800},{x:400,y:107,w:200,h:100},{width:300,height:40}),{left:350,top:215,placement:'below'});
});
test('toolbar placed below a node stays clear of the 85px bottom reserve',()=>{
 const p=at({width:1000,height:800},{x:100,y:90,w:100,h:500},{width:300,height:40});
 assert.deepEqual(p,{left:12,top:598,placement:'below'});
 assert.ok(p.top+40<=800-85);
});
test('a tall node uses clear space beside the card instead of clamping over its image',()=>{
 assert.deepEqual(at({width:1000,height:800},{x:400,y:100,w:200,h:700},{width:300,height:40}),{left:92,top:100,placement:'clear'});
});
test('nodes scrolled out above or below the board pin to the nearest safe edge',()=>{
 assert.deepEqual(at({width:1000,height:800},{x:400,y:-300,w:200,h:100},{width:300,height:40}),{left:350,top:60,placement:'clamped'});
 assert.deepEqual(at({width:1000,height:800},{x:400,y:850,w:200,h:100},{width:300,height:40}),{left:350,top:675,placement:'clamped'});
});
test('toolbar clamps horizontally to the side margin',()=>{
 assert.deepEqual(at({width:600,height:800},{x:20,y:300,w:100,h:80},{width:300,height:44}),{left:12,top:248,placement:'above'});
});
test('narrow boards degrade to visible placements instead of NaN or off-canvas values',()=>{
 assert.deepEqual(at({width:260,height:800},{x:80,y:300,w:100,h:80},{width:300,height:44}),{left:0,top:248,placement:'above'});
 assert.deepEqual(at({width:320,height:800},{x:80,y:300,w:100,h:80},{width:300,height:44}),{left:12,top:248,placement:'above'});
 const short=at({width:1000,height:190},{x:400,y:100,w:200,h:40},{width:300,height:40});
 assert.deepEqual(short,{left:92,top:65,placement:'clear'});
 assert.ok(short.top+40<=190-85);
 assert.deepEqual(at({width:0,height:0},{x:400,y:200,w:200,h:100},{width:300,height:40}),{left:0,top:60,placement:'clamped'});
});
test('missing or non-finite dimensions never produce NaN',()=>{
 assert.deepEqual(at({width:NaN,height:NaN},{x:400,y:200,w:200,h:100},{width:300,height:40}),{left:350,top:152,placement:'above'});
 assert.deepEqual(at({width:1000,height:800},{x:400,y:200,w:200,h:100}),{left:500,top:192,placement:'above'});
});
test('panel prefers the right of the node, then the left, then edge clamping on narrow boards',()=>{
 assert.deepEqual(at({width:1000,height:800},{x:300,y:200,w:200,h:160},{width:400,height:500},'panel'),{left:508,top:200,placement:'right'});
 assert.deepEqual(at({width:1000,height:800},{x:500,y:200,w:200,h:160},{width:400,height:500},'panel'),{left:92,top:200,placement:'left'});
 assert.deepEqual(at({width:700,height:800},{x:260,y:200,w:200,h:160},{width:400,height:300},'panel'),{left:160,top:200,placement:'clamped'});
 assert.deepEqual(at({width:380,height:800},{x:100,y:200,w:80,h:60},{width:400,height:300},'panel'),{left:0,top:200,placement:'clamped'});
});
test('panel keeps its body inside the vertical band even when anchored low or off-board',()=>{
 const low=at({width:1000,height:800},{x:300,y:700,w:200,h:100},{width:400,height:500},'panel');
 assert.deepEqual(low,{left:508,top:215,placement:'right'});
 assert.equal(low.top+500,800-85);
 assert.deepEqual(at({width:1000,height:800},{x:-500,y:200,w:100,h:100},{width:400,height:300},'panel'),{left:12,top:200,placement:'right'});
});
test('unknown kind falls back to toolbar placement and inputs are never mutated',()=>{
 const input={board:{width:1000,height:800},node:{x:400,y:200,w:200,h:100},overlay:{width:300,height:40},kind:'menu'};
 const snapshot=JSON.stringify(input);
 assert.deepEqual(nodeOverlayPosition(input),{left:350,top:152,placement:'above'});
 assert.equal(JSON.stringify(input),snapshot);
});

// 最小 DOM 面：只提供定位 / 跟踪用到的几何与事件方法，浏览器 QA 负责真实布局。
const el=r=>({style:{},rect:r,getBoundingClientRect(){return this.rect;}});
test('positionNodeOverlay writes fixed viewport coordinates for an anchored toolbar',()=>{
 const board=el({left:100,top:50,width:800,height:600}),anchor=el({left:200,top:150,width:120,height:90}),bar=el({left:0,top:0,width:300,height:44});
 const p=positionNodeOverlay(bar,{board,anchor,kind:'toolbar'});
 assert.deepEqual(p,{left:112,top:248,placement:'below'});
 assert.equal(bar.style.position,'fixed');assert.equal(bar.style.left,'112px');assert.equal(bar.style.top,'248px');
});
test('positionNodeOverlay falls back to a board-center anchor and rejects missing geometry',()=>{
 const board=el({left:100,top:50,width:800,height:600}),bar=el({left:0,top:0,width:300,height:44});
 assert.deepEqual(positionNodeOverlay(bar,{board,kind:'toolbar'}),{left:350,top:298,placement:'above'});
 assert.equal(positionNodeOverlay(bar,{kind:'toolbar'}),null);
 assert.equal(positionNodeOverlay(null,{board,kind:'toolbar'}),null);
});
test('tracking is a no-op outside a browser context',()=>{
 const bar=el({left:0,top:0,width:300,height:44}),t=installNodeOverlayTracking({element:bar,board:el({left:0,top:0,width:800,height:600}),anchor:()=>el({left:0,top:0,width:10,height:10}),kind:'toolbar'});
 t.refresh();t.dispose();
 assert.equal(bar.style.left,undefined);
});
test('tracking refreshes on rAF after resize/scroll events, skips self-scroll, and disposes cleanly',()=>{
 const handlers=new Map();let frames=[],seq=0;
 globalThis.window={addEventListener(n,f){handlers.set(n,f);},removeEventListener(n){handlers.delete(n);},requestAnimationFrame(cb){frames.push(cb);return ++seq;},cancelAnimationFrame(){}};
 const flush=()=>{const f=frames;frames=[];f.forEach(cb=>cb());};
 try{
  const board=el({left:100,top:50,width:800,height:600}),bar=el({left:0,top:0,width:300,height:44});
  const anchor=el({left:200,top:150,width:120,height:90});
  const t=installNodeOverlayTracking({element:bar,board,anchor:()=>anchor,kind:'toolbar'});
  t.refresh();assert.equal(frames.length,1);flush();
  assert.equal(bar.style.left,'112px');assert.equal(bar.style.top,'248px');
  anchor.rect={left:700,top:150,width:120,height:90};
  handlers.get('scroll')({target:null});flush();
  assert.equal(bar.style.left,'588px');assert.equal(bar.style.top,'248px');
  handlers.get('scroll')({target:bar});assert.equal(frames.length,0);
  const onResize=handlers.get('resize');
  t.dispose();assert.equal(handlers.size,0);
  onResize?.(); // dispose 后残留引用也不再排帧。
  assert.equal(frames.length,0);
  t.dispose(); // 幂等。
 }finally{delete globalThis.window;}
});
test('toolbar finds a clear nearby position rather than covering a neighboring card',()=>{
 const obstacle={x:250,y:240,w:500,h:100};
 const input={board:{width:1000,height:900},node:{x:400,y:300,w:200,h:200},overlay:{width:400,height:44},obstacles:[obstacle]};
 const result=nodeOverlayPosition(input);
 assert.ok(!(result.left<obstacle.x+obstacle.w&&result.left+400>obstacle.x&&result.top<obstacle.y+obstacle.h&&result.top+44>obstacle.y));
 assert.ok(result.top>=60&&result.top+44<=815);
});

test('a node assistant can use the lower canvas band without obscuring its source',()=>{
 const p=nodeOverlayPosition({board:{width:1280,height:596},node:{x:528,y:150,w:224,h:131},overlay:{width:580,height:290},kind:'composer',bottomReserve:16});
 assert.equal(p.placement,'below');assert.ok(p.top>=281);assert.ok(p.top+290<=580);
});

const overlap=(p,o,q)=>p.left<q.x+q.w&&p.left+o.width>q.x&&p.top<q.y+q.h&&p.top+o.height>q.y;
test('an open image composer never pushes the toolbar into its own image',()=>{
 const node={x:320,y:144,w:360,h:240},overlay={width:650,height:50},composer={x:160,y:360,w:680,h:300};
 const result=nodeOverlayPosition({board:{width:1000,height:800},node,overlay,obstacles:[composer]});
 assert.equal(result.top,86);assert.ok(!overlap(result,overlay,node));assert.ok(!overlap(result,overlay,composer));
});
test('source exclusion holds for landscape, portrait, zoomed and boundary image geometry',()=>{
 const overlay={width:600,height:48};
 for(const x of [-200,12,200,800])for(const y of [-200,70,144,400])for(const [w,h]of [[320,180],[180,500],[1000,900]]){
  const node={x,y,w,h},result=nodeOverlayPosition({board:{width:1080,height:620},node,overlay,obstacles:[{x:190,y:380,w:680,h:220}]});
  assert.ok(!overlap(result,overlay,node),JSON.stringify({node,result}));
  if(result.placement!=='outside'){assert.ok(result.top>=60&&result.top+48<=535);assert.ok(result.left>=12&&result.left+600<=1068);}
 }
});
test('when no clear screen position exists the toolbar requests viewport framing instead of covering source',()=>{
 const node={x:0,y:0,w:1000,h:800},overlay={width:700,height:50};
 const result=nodeOverlayPosition({board:{width:1000,height:800},node,overlay});
 assert.equal(result.placement,'outside');assert.ok(!overlap(result,overlay,node));
});
