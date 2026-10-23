import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimelineNav} from '../src/timeline-nav.mjs';
import {adjacentParameterKeyTime,advancePlayTime} from '../src/timeline-playhead.mjs';
import {isAnimatedTrack} from '../src/timeline-filter.mjs';
import {nodeMatchesQuery} from '../src/node-search.mjs';
import {saveWorkspaceState,loadWorkspaceState} from '../src/workspace-state.mjs';
import {installPanelLayout} from '../src/panel-layout.mjs';

test('zoom preserves a noncentral screen anchor with fixed label gutter and existing scroll',()=>{
 let zoom=1;
 const host={scrollLeft:400,clientWidth:700,get scrollWidth(){return 120+1000*zoom;},style:{setProperty(){}},addEventListener(){},getBoundingClientRect(){return {left:80,width:700};}};
 const nav=createTimelineNav(host,{onZoom:z=>zoom=z,metrics:()=>({left:120,width:1000*zoom}),body:{classList:{add(){},remove(){}}},win:{addEventListener(){}}});
 const fraction=(host.scrollLeft+350-120)/1000;
 nav.setZoom(2,{clientX:430});
 assert.equal(Math.round(120+fraction*2000-host.scrollLeft),350);
 nav.setZoom(1,{clientX:430});assert.equal(host.scrollLeft,400);
 nav.setZoom(2,{clientX:430});const detail=host.scrollLeft;
 nav.fit();assert.equal(nav.zoom(),1);assert.equal(host.scrollLeft,0);
 nav.fit();assert.equal(nav.zoom(),2);assert.equal(host.scrollLeft,detail);
 nav.clearFitMemory();assert.equal(nav.fitState().canReturn,false);
});
test('parameter navigation stays in its own channel and disables both outer boundaries',()=>{
 const o={keys:[{t:4}],channels:{scale:[{t:1},{t:3},{t:80}],rotation:[{t:2},{t:6}]}};
 assert.equal(adjacentParameterKeyTime(o,'scale',1,1),3);
 assert.equal(adjacentParameterKeyTime(o,'rotation',3,1),6);
 assert.equal(adjacentParameterKeyTime(o,'scale',80,1),null);
 assert.equal(adjacentParameterKeyTime(o,'rotation',2,-1),null);
 assert.equal(adjacentParameterKeyTime(o,'scale',3+1e-8,-1),1);
});
test('loop retains overshoot across the boundary while ordinary playback stops',()=>{
 assert.deepEqual(advancePlayTime(11.9,.3,12,true),{time:(11.9+.3)%12,playing:true});
 assert.deepEqual(advancePlayTime(11.9,.3,12,false),{time:12,playing:false});
 assert.deepEqual(advancePlayTime(0,.2,0,true),{time:0,playing:false});
});
test('animation filtering includes frozen actions and shot cameras without mutating data',()=>{
 const frozen={id:'actor',keys:[],actions:[{mode:'hold',start:0,end:4}]},camera={id:'camera',keys:[]},staticObject={id:'prop',keys:[],channels:{scale:[]}};
 const before=JSON.stringify([frozen,camera,staticObject]);
 assert.equal(isAnimatedTrack(frozen),true);assert.equal(isAnimatedTrack(camera,[{cameraId:'camera'}]),true);assert.equal(isAnimatedTrack(staticObject),false);
 assert.equal(JSON.stringify([frozen,camera,staticObject]),before);
});
test('node search matches title and text, clears safely and leaves original node intact',()=>{
 const node={title:'角色 Alice',text:'庭院等待来访者'},before=JSON.stringify(node);
 assert.equal(nodeMatchesQuery(node,'alice 庭院'),true);assert.equal(nodeMatchesQuery(node,'不存在'),false);assert.equal(nodeMatchesQuery(node,''),true);assert.equal(JSON.stringify(node),before);
});
test('workspace state stays isolated across projects and ignores malformed storage',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 saveWorkspaceState('A',{mode:'stage',time:80,selectedId:'actor',timeline:{zoom:4,scrollLeft:500,scrollTop:220},expanded:['actor'],collapsed:['camera']},storage);
 saveWorkspaceState('B',{mode:'board',time:2,timeline:{zoom:1,scrollLeft:0}},storage);
 assert.equal(loadWorkspaceState('A',storage).time,80);assert.equal(loadWorkspaceState('A',storage).timeline.zoom,4);assert.equal(loadWorkspaceState('B',storage).mode,'board');
 assert.equal(loadWorkspaceState('A',storage).timeline.scrollTop,220);assert.deepEqual(loadWorkspaceState('A',storage).collapsed,['camera']);assert.deepEqual(loadWorkspaceState('B',storage).collapsed,[]);
 assert.equal(loadWorkspaceState('missing',storage),null);
 for(const k of store.keys())store.set(k,'{broken');assert.equal(loadWorkspaceState('A',storage),null);
});
test('panel restore keeps mode visibility and repeatedly applying an old layout never toggles panels',()=>{
 const names=['localStorage','window','document','ResizeObserver'],before=Object.fromEntries(names.map(k=>[k,globalThis[k]]));
 const panel=hidden=>({style:{},classList:{toggle(){throw Error('mode hidden class must stay untouched');}},modeHidden:hidden});
 const left=panel(false),right=panel(false),timeline=panel(true),preview=panel(false);
 const panels={'.sidebar':left,'.inspector':right,'.timeline':timeline,'#previewSection':preview};
 const root={clientWidth:1280,clientHeight:800,style:{setProperty(){}},querySelector:s=>panels[s],querySelectorAll:()=>[]};
 try{
  globalThis.localStorage={getItem:()=>JSON.stringify({left:260,right:280}),setItem(){}};
  globalThis.window={addEventListener(){}};globalThis.document={addEventListener(){},body:{classList:{remove(){}}}};
  globalThis.ResizeObserver=class{observe(){}};
  const layout=installPanelLayout({root});layout.refresh();layout.refresh();
  assert.equal(left.style.display,'');assert.equal(timeline.modeHidden,true);
  layout.collapse('left');assert.equal(left.style.display,'none');layout.expand('left');assert.equal(left.style.display,'');
  layout.collapse('right');layout.saveCustom();layout.reset();layout.applyCustom();assert.equal(right.style.display,'none');
  layout.applyPreset('animate');assert.equal(right.style.display,'');assert.equal(timeline.modeHidden,true);
 }finally{for(const k of names){if(before[k]===undefined)delete globalThis[k];else globalThis[k]=before[k];}}
});
