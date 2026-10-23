import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {CANVAS_CLIP_MIME,pasteCanvasCopy} from '../src/board-operations.mjs';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function clipboardHarness(mode='board'){
 const handlers={},node={id:'a',type:'text',title:'测试',text:'',x:0,y:0,w:280};
 const c=vm.createContext({document:{activeElement:null,addEventListener:(k,f)=>handlers[k]=f},mode,managerOpen:false,transitioning:false,exporting:false,boardGesture:null,
 editingTarget:e=>e.target?.editing===true,$:s=>s==='#contextMenu'?{classList:{contains:()=>true}}:null,
 boardSelection:['a'],CANVAS_CLIP_MIME,pasteCanvasCopy,canvasClipboard:{app:'director-canvas',version:1,nodes:[node],edges:[],groups:[]},canvasClipboardToken:'token',pasteSerial:0,
 p:{nodes:[node],boardGroups:[]},uid:()=>`copy_${c.allocations++}`,allocations:0,toast(){},copyBoardSelection:()=>c.canvasClipboard,applyCanvasPaste:plan=>c.plans.push(plan),plans:[]});
 const start=source.indexOf("document.addEventListener('copy',e=>{");const end=source.indexOf('function duplicateBoardSelection()',start);
 vm.runInContext(source.slice(start,end),c);return {c,handlers};
}
const pasteEvent=({text='',raw='',files=[],editing=false}={})=>({target:{editing},clipboardData:{files,items:files.map(()=>({kind:'file'})),getData:type=>type===CANVAS_CLIP_MIME?raw:type==='text/plain'?text:''},prevented:false,preventDefault(){this.prevented=true}});
test('external image/file paste is not replaced by stale copied canvas nodes',()=>{
 const {c,handlers}=clipboardHarness();const e=pasteEvent({files:[{name:'reference.png'}]});handlers.paste(e);assert.equal(c.plans.length,0);assert.equal(e.prevented,false);
});
test('ordinary text paste and all input-field pastes retain native editing behavior',()=>{
 for(const event of [pasteEvent({text:'普通文字'}),pasteEvent({editing:true,raw:JSON.stringify({app:'director-canvas',version:1,nodes:[],edges:[]})})]){
  const {c,handlers}=clipboardHarness();handlers.paste(event);assert.equal(c.plans.length,0);assert.equal(event.prevented,false);
 }
});
test('canvas copy/paste listeners stay inactive in director mode',()=>{
 const {c,handlers}=clipboardHarness('stage');const e=pasteEvent({raw:JSON.stringify(c.canvasClipboard)});handlers.paste(e);assert.equal(c.plans.length,0);assert.equal(e.prevented,false);
});
test('own clipboard payload batches new ids and internal edges once',()=>{
 const {c,handlers}=clipboardHarness();const clip={...c.canvasClipboard,nodes:[...c.canvasClipboard.nodes,{...c.canvasClipboard.nodes[0],id:'b',x:400}],edges:[{from:'a',to:'b'}]};
 const e=pasteEvent({raw:JSON.stringify(clip)});handlers.paste(e);assert.equal(c.plans.length,1);assert.equal(c.plans[0].nodes.length,2);assert.equal(c.plans[0].edges.length,1);assert.equal(e.prevented,true);
});
