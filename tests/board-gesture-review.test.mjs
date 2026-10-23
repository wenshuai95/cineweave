import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {sanitizeSelection} from '../src/board-operations.mjs';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const functionBlock=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
class PointerTarget{
 listeners=new Map();captured=false;
 addEventListener(k,f){if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(f)}
 removeEventListener(k,f){this.listeners.get(k)?.delete(f)}
 setPointerCapture(){this.captured=true}hasPointerCapture(){return this.captured}releasePointerCapture(){this.captured=false}
 dispatch(k,e={}){for(const f of [...(this.listeners.get(k)||[])])f({pointerId:1,...e})}
}
function dragHarness({history=[],future=[]}={}){
 const p={nodes:[{id:'a',x:20,y:30},{id:'b',x:200,y:400}],board:{zoom:2},objects:[{id:'actor',position:[1,2,3]}],shots:[{cameraId:'camera'}]};
 const c=vm.createContext({p,history,future,nudgeStamp:0,boardSelection:['a','b'],boardGesture:null,sanitizeSelection,
 clone:structuredClone,updateUndo(){},updateDraggedNodes(){},drawEdges(){},persist(){c.saved++},saved:0,window:new PointerTarget()});
 vm.runInContext(functionBlock('function checkpoint(){','function updateUndo()')+functionBlock('function beginBoardNodesDrag(','function deleteBoardSelection()'),c);
 const target=new PointerTarget();c.beginBoardNodesDrag({clientX:100,clientY:100,pointerId:1},target,['a','b']);return {c,target};
}
test('drag moves all selected cards in world units, commits once and leaves director state untouched',()=>{
 const {c,target}=dragHarness();const director=JSON.stringify({objects:c.p.objects,shots:c.p.shots});
 target.dispatch('pointermove',{clientX:140,clientY:160});target.dispatch('pointermove',{clientX:180,clientY:200});target.dispatch('pointerup');
 assert.deepEqual(c.p.nodes.map(n=>[n.x,n.y]),[[60,80],[240,450]]);assert.equal(c.history.length,1);assert.equal(c.saved,1);assert.equal(c.boardGesture,null);
 assert.equal(JSON.stringify({objects:c.p.objects,shots:c.p.shots}),director);assert.equal(target.captured,false);
});
test('cancelled drag restores node positions and the preexisting redo branch',()=>{
 const originalHistory=[{name:'prior'}],originalFuture=[{name:'redo'}];const {c,target}=dragHarness({history:[...originalHistory],future:[...originalFuture]});
 target.dispatch('pointermove',{clientX:180,clientY:200});target.dispatch('pointercancel');
 assert.deepEqual(c.p.nodes.map(n=>[n.x,n.y]),[[20,30],[200,400]]);assert.deepEqual(c.history,originalHistory);assert.deepEqual(c.future,originalFuture);assert.equal(c.saved,0);assert.equal(c.boardGesture,null);
});
test('cancel at the 30-entry history limit does not discard the oldest undo state',()=>{
 const old=Array.from({length:30},(_,i)=>({name:`undo-${i}`}));const {c,target}=dragHarness({history:[...old]});
 target.dispatch('pointermove',{clientX:160,clientY:140});target.dispatch('pointercancel');assert.deepEqual(c.history,old);
});
test('blur during drag cancels and releases pointer capture without a save or dangling listener',()=>{
 const {c,target}=dragHarness();target.dispatch('pointermove',{clientX:160,clientY:140});c.window.dispatch('blur');
 assert.deepEqual(c.p.nodes.map(n=>[n.x,n.y]),[[20,30],[200,400]]);assert.equal(target.captured,false);assert.equal(c.saved,0);
 target.dispatch('pointermove',{clientX:500,clientY:500});assert.equal(c.p.nodes[0].x,20);
});
