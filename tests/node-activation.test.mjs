import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const start=source.indexOf('function activateCanvasNode('),end=source.indexOf('function nodeVisible(',start);
function harness(node,story=false){
 const calls=[];
 const ctx=vm.createContext({p:{nodes:[node]},activeDirectorId:null,getCanvasStoryContext:()=>story?{}:null,setMode:m=>calls.push(['mode',m]),enterGeneratedModel:n=>calls.push(['model',n.id]),openNodeTool:id=>calls.push(['story',id]),mediaNodePanel:n=>calls.push(['media',n.id]),videoGenerationModal:n=>calls.push(['generate',n.id]),editCanvasNode:id=>calls.push(['edit',id])});
 vm.runInContext(source.slice(start,end),ctx);ctx.activateCanvasNode(node.id);return {calls,ctx};
}
test('shared node activation opens a director scene or model instead of their text editor',()=>{
 const stage=harness({id:'director',type:'director'});assert.deepEqual(stage.calls,[['mode','stage']]);assert.equal(stage.ctx.activeDirectorId,'director');
 assert.deepEqual(harness({id:'model',type:'model'}).calls,[['model','model']]);
});
test('shared activation respects canonical content, filled media and empty generation inputs',()=>{
 assert.deepEqual(harness({id:'story',type:'text'},true).calls,[['edit','story']]);
 for(const type of ['image','video','audio'])assert.deepEqual(harness({id:type,type,src:'media'}).calls,[['media',type]]);
 assert.deepEqual(harness({id:'video',type:'video'}).calls,[['generate','video']]);
 assert.deepEqual(harness({id:'text',type:'text'}).calls,[['edit','text']]);
});
