import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
class Element{
 constructor(tag='div'){this.tag=tag}
 closest(selector){if(selector.includes('[data-panel-resize]'))return null;return selector.split(',').some(s=>s.trim()===this.tag)?this:null}
}
function harness(mode='board',{modal=false,nodePanel=false}={}){
 const handlers={},calls=[],menu={classList:{contains:()=>true}};
 const c=vm.createContext({Element,document:{addEventListener:(k,f)=>handlers[k]=f},wsShell:null,managerOpen:false,transitioning:false,exporting:false,timelineGesture:null,boardGesture:null,
 mode,selectedEdge:null,boardSelection:['a'],deleteBoardSelection:()=>calls.push('delete'),timelineSelection:null,stage:{transform:{dragging:false},targetTransform:{dragging:false},orbit:{keys:new Set(),clear(){}}},navigationCodes:new Set(),calls,
 $:s=>s==='#contextMenu'?menu:s==='#playBtn'?{click:()=>calls.push('play')}:s==='.modal:not(.node-tool-panel)'&&modal&&!nodePanel?{}:null,
 p:{nodes:[{id:'a',type:'text'},{id:'b',type:'image'}]},nodeVisible:n=>n.type==='text',
 setBoardSelection:ids=>calls.push(['select',...ids]),setBoardTool:tool=>calls.push(tool),beginSpaceHand:()=>calls.push('hand-on'),endSpaceHand:()=>calls.push('hand-off'),
 groupBoardSelection:()=>calls.push('group'),ungroupBoardSelection:()=>calls.push('ungroup'),nudgeBoardSelection:(x,y)=>calls.push(['nudge',x,y]),
 fitBoard:()=>calls.push('fit'),focusBoardSelection:()=>calls.push('focus'),boardZoomTo100:()=>calls.push('100'),boardZoomStep:()=>calls.push('zoom'),duplicateBoardSelection:()=>calls.push('duplicate')});
 const a=src.indexOf('const editingTarget=e=>');const b=src.indexOf("window.addEventListener('blur'",a);vm.runInContext(src.slice(a,b),c);
 const key=(code,{tag='div',metaKey=false,shiftKey=false,key=code}={})=>{const e={code,key,metaKey,shiftKey,target:new Element(tag),prevented:false,preventDefault(){this.prevented=true}};handlers.keydown(e);return e};return {calls,key,handlers};
}
test('V/H, shifted views and group shortcuts route only to canvas actions',()=>{
 const {calls,key}=harness();for(const code of ['KeyV','KeyH'])assert.equal(key(code).prevented,true);
 key('Digit1',{shiftKey:true});key('Digit2',{shiftKey:true});key('Digit0',{shiftKey:true});key('KeyG',{metaKey:true});key('KeyG',{metaKey:true,shiftKey:true});
 assert.deepEqual(calls,['select','hand','fit','focus','100','group','ungroup']);
});
test('typing, numeric fields and audio/video focus keep their own keys',()=>{
 for(const tag of ['input','textarea','select','video','audio']){
  const {calls,key}=harness();assert.equal(key('KeyV',{tag}).prevented,false);assert.equal(key('KeyA',{tag,metaKey:true}).prevented,false);assert.equal(key('ArrowRight',{tag}).prevented,false);assert.deepEqual(calls,[]);
 }
});
test('Space starts temporary hand only in canvas; keyup releases it; buttons retain activation',()=>{
 const {calls,key,handlers}=harness();assert.equal(key('Space').prevented,true);handlers.keyup({code:'Space'});assert.deepEqual(calls,['hand-on','hand-off']);
 const onButton=harness();assert.equal(onButton.key('Space',{tag:'button'}).prevented,false);assert.deepEqual(onButton.calls,[]);
 const stage=harness('stage');assert.equal(stage.key('Space').prevented,true);stage.key('KeyH');assert.deepEqual(stage.calls,['play']);
});
test('select-all obeys current category; native copy/paste keys are not swallowed',()=>{
 const {calls,key}=harness();assert.equal(key('KeyA',{metaKey:true}).prevented,true);assert.deepEqual(calls,[['select','a']]);
 assert.equal(key('KeyC',{metaKey:true}).prevented,false);assert.equal(key('KeyV',{metaKey:true}).prevented,false);
});
test('arrow-key fine and coarse steps apply in canvas units',()=>{
 const {calls,key}=harness();key('ArrowRight');key('ArrowUp',{shiftKey:true});assert.deepEqual(calls,[['nudge',1,0],['nudge',0,-10]]);
});

test('Delete and Backspace delete selected nodes with a node composer open, but preserve typing and settings',()=>{
 for(const keyName of ['Delete','Backspace']){
  const c=harness('board',{modal:true,nodePanel:true});assert.equal(c.key(keyName,{key:keyName}).prevented,true);assert.deepEqual(c.calls,['delete']);
  for(const tag of ['input','textarea','select']){const typing=harness();assert.equal(typing.key(keyName,{key:keyName,tag}).prevented,false);assert.deepEqual(typing.calls,[]);}
  const modal=harness('board',{modal:true});assert.equal(modal.key(keyName,{key:keyName}).prevented,false);assert.deepEqual(modal.calls,[]);
 }
});
