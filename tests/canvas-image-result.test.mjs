import test from 'node:test';
import assert from 'node:assert/strict';
import {planCanvasImageResult,canvasImagePrompt} from '../src/canvas-image-result.mjs';
const image={id:'image',type:'image',title:'角色参考图',text:'请导入图片',x:420,y:0,w:320};
const actor={id:'actor',type:'actor',title:'角色档案',text:'姓名：小林；服装：米色风衣'};
const project=()=>({nodes:[actor,{...image}],edges:[{from:'actor',to:'image'}],boardGroups:[{id:'g',name:'角色设定',memberIds:['actor','image'],collapsed:true}]});
const result={sourceId:'image',taskId:'job-1',src:'data:image/png;base64,YQ==',prompt:'实际生成描述',createNode:extra=>({id:'new',type:'image',...extra})};
test('empty template picture is filled in place, preserving group and wire identity',()=>{
 const p=project(),before=structuredClone(p),plan=planCanvasImageResult(p,result);
 assert.equal(plan.replace,true);assert.equal(plan.node.id,'image');assert.equal(plan.node.title,image.title);
 assert.equal(plan.node.src,result.src);assert.deepEqual(p,before);assert.equal(plan.edge,undefined);
});
test('a result never overwrites an image imported while generation was running',()=>{
 const p=project();p.nodes[1].src='user-import';const plan=planCanvasImageResult(p,result);
 assert.equal(plan.replace,false);assert.equal(p.nodes[1].src,'user-import');assert.deepEqual(plan.edge,{from:'image',to:'new'});
 p.nodes.push(plan.node);assert.equal(planCanvasImageResult(p,result).already,true);
});
test('deleted source stays deleted, and full canvas only permits an in-place fill',()=>{
 const p=project();p.nodes=p.nodes.filter(n=>n.id!=='image');assert.equal(planCanvasImageResult(p,result).edge,null);
 p.nodes=Array.from({length:500},(_,i)=>({id:'n'+i,type:'text'}));assert.throws(()=>planCanvasImageResult(p,result),/已满/);
 p.nodes[0]={...image};assert.equal(planCanvasImageResult(p,result).replace,true);
});
test('reference prompt follows incoming definitions, with a bounded fallback',()=>{
 assert.equal(canvasImagePrompt(project(),image),'角色档案\n'+actor.text);
 assert.equal(canvasImagePrompt({nodes:[],edges:[]},{text:'x'.repeat(20000)}).length,6000);
 assert.equal(canvasImagePrompt(project(),null),'');
});
