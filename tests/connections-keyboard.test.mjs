import test from 'node:test';
import assert from 'node:assert/strict';
import {installPortDrag,connectionFor} from '../src/connections.mjs';
function fixture(){
 const handlers=new Map(),classes=new Set();let captured=false,removed=0,activations=0,connected=[];
 const target={dataset:{port:'in'},closest(selector){return selector==='.port'?this:{dataset:{id:'target'}};},classList:{add(){},remove(){}}};
 const doc={createElementNS(ns,tag){return {namespaceURI:ns,classList:{add(){}},append(){},setAttribute(){},remove(){removed++;}};},body:{append(){}},elementFromPoint(){return target;},addEventListener(n,fn){handlers.set(n,fn);},removeEventListener(n){handlers.delete(n);}};
 const win={addEventListener(){},removeEventListener(){}};
 const button={dataset:{port:'out'},closest(){return {dataset:{id:'source'}};},getBoundingClientRect(){return {x:0,y:0,width:20,height:20};},classList:{add(c){classes.add(c);},remove(c){classes.delete(c);}},setPointerCapture(){captured=true;},hasPointerCapture(){return captured;},releasePointerCapture(){captured=false;}};
 const event=extra=>({button:0,pointerId:1,clientX:10,clientY:10,detail:1,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){},...extra});
 const prevDoc=globalThis.document,prevWin=globalThis.window;globalThis.document=doc;globalThis.window=win;
 installPortDrag(button,{edges:()=>[],onConnect:edge=>connected.push(edge),onActivate:()=>activations++});
 return {button,event,handlers,classes,get removed(){return removed;},get activations(){return activations;},connected,restore(){globalThis.document=prevDoc;globalThis.window=prevWin;}};
}
test('port native activation opens a target chooser without creating a wire',()=>{
 const f=fixture();try{f.button.onclick(f.event({detail:0}));assert.equal(f.activations,1);assert.deepEqual(f.connected,[]);}finally{f.restore();}
});
test('drag creates one wire and suppresses its trailing mouse click, while keyboard activation still works',()=>{
 const f=fixture();try{f.button.onpointerdown(f.event());f.handlers.get('pointermove')(f.event({clientX:100}));f.handlers.get('pointerup')(f.event({clientX:100}));assert.deepEqual(f.connected,[{from:'source',to:'target'}]);assert.equal(f.handlers.size,0);f.button.onclick(f.event());assert.equal(f.activations,0);f.button.onclick(f.event({detail:0}));assert.equal(f.activations,1);}finally{f.restore();}
});
test('Escape cancels a port drag without a connection or leftover capture handlers',()=>{
 const f=fixture();try{f.button.onpointerdown(f.event());f.handlers.get('keydown')(f.event({key:'Escape'}));assert.equal(f.handlers.size,0);assert.equal(f.classes.has('pending'),false);assert.deepEqual(f.connected,[]);}finally{f.restore();}
});
test('connection direction and duplicate protection are identical for incoming and outgoing ports',()=>{
 assert.deepEqual(connectionFor({id:'b',port:'in'},{id:'a',port:'out'},[]),{from:'a',to:'b'});
 assert.equal(connectionFor({id:'a',port:'out'},{id:'b',port:'in'},[{from:'a',to:'b'}]),null);
});
