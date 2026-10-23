import test from 'node:test';import assert from 'node:assert/strict';
import {createTimelineNav,scaledScroll} from '../src/timeline-nav.mjs';
import {adjacentKeyTime,adjacentParameterKeyTime,advancePlayTime} from '../src/timeline-playhead.mjs';
import {isAnimatedTrack} from '../src/timeline-filter.mjs';
import {nodeMatchesQuery} from '../src/node-search.mjs';
import {saveWorkspaceState,loadWorkspaceState} from '../src/workspace-state.mjs';
import {layoutPresets,fitLayout} from '../src/panel-layout.mjs';

// 模拟 #tracks：车道左缘固定 132px（含标签列），车道宽随缩放伸展，滚动按内容宽度限幅。
function mockNavHost({clientWidth=400,laneLeft=132,base=600}={}){
 let zoom=1,left=0;const handlers={};
 const host={
  get scrollLeft(){return left},
  set scrollLeft(v){const max=Math.max(0,host.scrollWidth-clientWidth);left=Math.max(0,Math.min(max,v));},
  scrollTop:0,
  get clientWidth(){return clientWidth},
  get scrollWidth(){return laneLeft+base*zoom},
  getBoundingClientRect(){return {left:0,top:0,width:clientWidth,height:300}},
  style:{setProperty(k,v){if(k==='--tl-zoom')zoom=Number(v)}},
  addEventListener(k,v){handlers[k]=v},
 };
 const metrics=()=>({left:laneLeft,width:base*zoom});
 const nav=()=>createTimelineNav(host,{win:{addEventListener(){}},body:{classList:{add(){},remove(){}}},metrics});
 return {host,metrics,handlers,nav,zoom:()=>zoom,left:()=>left};
}

test('zoom keeps an asymmetric anchor time fixed through the label column, lane and clamps',()=>{
 const m=mockNavHost();const n=m.nav();
 n.setZoom(2);
 assert.equal(m.zoom(),2);
 m.host.scrollLeft=100;
 n.setZoom(4,{clientX:250});
 assert.equal(m.zoom(),4);
 // 锚点 clientX=250（非视口中心）：frac=(100+250-132)/1200，新车道宽 2400 → newLeft=132+frac*2400-250=318。
 assert.equal(m.left(),318);
 // 缩放回 2 倍，同一锚点时间不变 → 滚动位置回到 100。
 n.setZoom(2,{clientX:250});
 assert.equal(m.left(),100);
});

test('zoom clamps at both content edges and keeps the playhead-side anchor',()=>{
 const m=mockNavHost();const n=m.nav();
 // 锚点位于固定标签栏上方：车道分数为负 → 缩放后贴左缘 0。
 n.setZoom(2);m.host.scrollLeft=0;
 n.setZoom(4,{clientX:50});
 assert.equal(m.left(),0);
 // 视口右缘锚点在缩小时越界 → 限幅到最大滚动。
 const m2=mockNavHost();const n2b=m2.nav();
 n2b.setZoom(2);m2.host.scrollLeft=932;
 n2b.setZoom(1,{clientX:380});
 assert.equal(m2.left(),Math.max(0,132+600-400));
});

test('without lane metrics zoom falls back to proportional scroll (legacy hosts)',()=>{
 const handlers={};let left=0,max=0;
 const host={get scrollLeft(){return left},set scrollLeft(v){left=Math.max(0,Math.min(max,v))},scrollTop:0,style:{setProperty(k,v){if(k==='--tl-zoom')max=(Number(v)-1)*100}},addEventListener(k,v){handlers[k]=v}};
 const nav=createTimelineNav(host,{win:{addEventListener(){}},body:{classList:{add(){},remove(){}}}});
 nav.setZoom(2);host.scrollLeft=80;nav.setZoom(4);
 assert.equal(host.scrollLeft,scaledScroll(80,4,2));
 assert.equal(host.scrollLeft,160);
});

test('Alt+wheel zooms around the mouse and Shift+wheel still pans',()=>{
 const m=mockNavHost();const n=m.nav();
 m.handlers.wheel({altKey:true,deltaY:-10,clientX:250,preventDefault(){}});
 assert.equal(m.zoom(),1.5);
 // frac=(0+250-132)/600；1.5 倍车道 900：132+frac*900-250
 assert.equal(m.left(),132+(250-132)/600*900-250);
 let prevented=0;m.handlers.wheel({shiftKey:true,deltaY:30,clientX:250,preventDefault(){prevented++}});
 assert.equal(prevented,1);assert.equal(m.left(),132+(250-132)/600*900-250+30);
 // 无修饰键滚轮不拦截（交给原生纵向滚动 / 触控板横滚）。
 const before=m.left();m.handlers.wheel({deltaY:30,clientX:250,preventDefault(){throw Error('should not prevent')}});
 assert.equal(m.left(),before);
});

test('fit toggle remembers detail zoom and scroll, then returns exactly',()=>{
 const m=mockNavHost();const n=m.nav();
 n.setZoom(3);m.host.scrollLeft=300;
 let state=n.fitToggle();
 assert.equal(state.fit,true);assert.equal(state.canReturn,true);assert.equal(m.zoom(),1);assert.equal(m.left(),0);
 state=n.fitToggle();
 assert.equal(state.fit,false);assert.equal(m.zoom(),3);assert.equal(m.left(),300);
 state=n.fitToggle(); // 再次进入全览仍记忆
 assert.equal(state.fit,true);assert.equal(m.left(),0);
 // 已在全览且无记忆时按钮禁用语义：fitState.canReturn 分支。
 const fresh=mockNavHost().nav();
 const s=fresh.fitState();
 assert.equal(s.fit,true);assert.equal(s.canReturn,false);
});

test('advancePlayTime stops at the end, wraps in loop mode and never affects export timing',()=>{
 assert.deepEqual(advancePlayTime(1,.5,10,false),{time:1.5,playing:true});
 assert.deepEqual(advancePlayTime(9.8,.5,10,false),{time:10,playing:false});
 const wrapped=advancePlayTime(9.8,.5,10,true);assert.equal(wrapped.playing,true);assert.ok(Math.abs(wrapped.time-.3)<1e-9);
 assert.deepEqual(advancePlayTime(9.5,.5,10,true),{time:0,playing:true});
 assert.deepEqual(advancePlayTime(0,-.1,10,false),{time:0,playing:true});
});

test('per-parameter key navigation scopes to one channel, dedupes and honours boundaries',()=>{
 const o={keys:[{t:5}],channels:{fov:[{t:2},{t:2},{t:4}],positionX:[{t:7}]}};
 assert.equal(adjacentParameterKeyTime(o,'fov',2,-1),null);
 assert.equal(adjacentParameterKeyTime(o,'fov',2,1),4);
 assert.equal(adjacentParameterKeyTime(o,'fov',3,-1),2);
 assert.equal(adjacentParameterKeyTime(o,'fov',4,1),null);
 assert.equal(adjacentParameterKeyTime(o,'fov',4,-1),2);
 assert.equal(adjacentParameterKeyTime(o,'positionX',5,-1),null); // 对象姿态键 t=5 不属于 positionX
 assert.equal(adjacentParameterKeyTime(o,'positionX',5,1),7);
 assert.equal(adjacentParameterKeyTime(o,null,5,1),7); // null 回退为对象总览
 assert.equal(adjacentKeyTime(o,2,1),4); // 对象总览仍合并全部通道
});

test('animated-track detection counts hold actions, paths and shot usage, not bare actors',()=>{
 assert.equal(isAnimatedTrack({keys:[],channels:{},actions:[]},[]),false);
 assert.equal(isAnimatedTrack(null),false);
 assert.equal(isAnimatedTrack({keys:[{t:0}]},[]),true);
 assert.equal(isAnimatedTrack({keys:[],channels:{fov:[{t:1}]}},[]),true);
 assert.equal(isAnimatedTrack({keys:[],channels:{},actions:[{mode:'hold',start:0,end:2}]},[]),true);
 assert.equal(isAnimatedTrack({keys:[],channels:{},actions:[],pathHandles:[{t:1,in:[0,0,0],out:[0,0,0]}]},[]),true);
 assert.equal(isAnimatedTrack({id:'cam1',keys:[],channels:{},actions:[]},[{id:'s',cameraId:'cam1'}]),true);
 assert.equal(isAnimatedTrack({id:'cam2',keys:[],channels:{},actions:[]},[{id:'s',cameraId:'cam1'}]),false);
 assert.equal(isAnimatedTrack({keys:[],channels:{},actions:[],modelClip:'idle'},[]),false); // 仅默认循环不是轨道动画
});

test('node search matches title and text, multi-word AND, never mutates the node',()=>{
 const n={title:'夜晚街道',text:'角色走进小巷 Night'};
 const copy=JSON.parse(JSON.stringify(n));
 assert.equal(nodeMatchesQuery(n,''),true);
 assert.equal(nodeMatchesQuery(n,'街道'),true);
 assert.equal(nodeMatchesQuery(n,'街道 小巷'),true);
 assert.equal(nodeMatchesQuery(n,'night'),true);
 assert.equal(nodeMatchesQuery(n,'街道 雨天'),false);
 assert.equal(nodeMatchesQuery(n,'不存在'),false);
 assert.equal(nodeMatchesQuery(null,'x'),false);
 assert.deepEqual(n,copy);
});

test('workspace state round-trips per project, clamps corrupt values and degrades safely',()=>{
 const store=new Map();
 const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>{store.set(k,v)}};
 saveWorkspaceState('p1',{mode:'stage',selectedId:'obj1',time:3.5,board:{x:10,y:-20,zoom:.8},timeline:{zoom:4,scrollLeft:120},expanded:['a','b'],filter:'image'},storage);
 const s=loadWorkspaceState('p1',storage);
 assert.equal(s.mode,'stage');assert.equal(s.selectedId,'obj1');assert.equal(s.time,3.5);
 assert.equal(s.board.zoom,.8);assert.equal(s.timeline.zoom,4);assert.equal(s.timeline.scrollLeft,120);
 assert.deepEqual(s.expanded,['a','b']);assert.equal(s.filter,'image');
 assert.equal(loadWorkspaceState('missing',storage),null);
 store.set('director-canvas-workspace-v1','{corrupt');
 assert.equal(loadWorkspaceState('p1',storage),null);
 saveWorkspaceState('p2',{mode:'weird',time:9999,board:{x:1e9,y:NaN,zoom:99},timeline:{zoom:0,scrollLeft:-5},expanded:['ok',42,'x'.repeat(99)],filter:42},storage);
 const t=loadWorkspaceState('p2',storage);
 assert.equal(t.mode,'board');assert.equal(t.time,3600);assert.equal(t.board.zoom,2);assert.equal(t.board.y,null);
 assert.equal(t.timeline.zoom,1);assert.equal(t.timeline.scrollLeft,0);assert.deepEqual(t.expanded,['ok']);assert.equal(t.filter,null);
 assert.equal(loadWorkspaceState('p1'),null); // 无存储句柄时安全回退
 saveWorkspaceState('p1',{mode:'board'},null); // 不抛错
});

test('layout presets keep a usable center and stage at 1280x800',()=>{
 for(const [name,preset] of Object.entries(layoutPresets)){
  const s=fitLayout(preset,1280,800);
  assert.ok(s.left>=180&&s.right>=230,name);
  assert.ok(1280-s.left-s.right-12>=360,name);
  assert.ok(800-s.timeline-53>=170,name);
  assert.ok(800-s.preview-50>=140,name);
 }
 assert.ok(fitLayout(layoutPresets.animate,1280,800).timeline>=400);
 assert.ok(fitLayout(layoutPresets.preview,1280,800).preview>=400);
 assert.ok(fitLayout(layoutPresets.compose,1280,800).timeline<=200);
});
