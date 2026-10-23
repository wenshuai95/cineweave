import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createLocalModelStore} from '../model3d-service.mjs';
import {demoProject,validateProject,uid,clone} from '../src/model.mjs';
import {generatedModelNode,modelNodeToStage} from '../src/generated-model.mjs';
const input={kind:'animal',size:1,title:'测试模型'};
const glb=await readFile(new URL('../public/assets/models/shiba.glb',import.meta.url)).catch(async()=>{const m=JSON.parse(await readFile(new URL('../public/assets/manifest.json',import.meta.url)));return readFile(new URL('../public/assets/'+m.assets.find(a=>a.id==='shiba').file,import.meta.url));});
test('model node -> director works for scenes, humans, animals and creatures and survives project reload',()=>{
 for(const kind of ['scene','human','animal','creature']){const p=demoProject(),before=clone(p),source={id:uid(),type:'image',title:'参考',text:'',src:'data:image/png;base64,AAAA',x:80,y:50,w:280};p.nodes.push(source);const job={...input,id:uid(),projectId:p.id,sourceId:source.id,kind},src='data:model/gltf-binary;base64,'+glb.toString('base64');
 const n=generatedModelNode(p,job,src);assert.equal(generatedModelNode(p,job,src).id,n.id);assert.equal(p.objects.length,before.objects.length);assert.ok(p.edges.some(e=>e.from===source.id&&e.to===n.id));const o=modelNodeToStage(p,n);assert.equal(o.modelSrc,src);assert.equal(modelNodeToStage(p,n).id,o.id);assert.equal(p.objects.length,before.objects.length+1);assert.ok(p.edges.some(e=>e.from===n.id&&p.nodes.find(n=>n.id===e.to)?.type==='director'));
 const loaded=validateProject(JSON.parse(JSON.stringify(p)));assert.equal(loaded.nodes.find(a=>a.id===n.id).objectId,o.id);assert.equal(loaded.objects.find(a=>a.id===o.id).modelSize,1);assert.throws(()=>generatedModelNode({...p,id:'different'},job,src),/所属工程/);
 }
});

test('legacy downloaded GLB remains readable without cloud configuration or network access',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'local-model-'));
 try{
  await writeFile(join(folder,'jobs.json'),JSON.stringify([{id:'old-model',status:'succeeded'},{id:'pending-model',status:'pending'}]));await writeFile(join(folder,'old-model.glb'),glb);
  const store=createLocalModelStore({folder});assert.deepEqual(await store.model('old-model'),glb);
  await assert.rejects(store.model('pending-model'),/尚未下载/);await assert.rejects(store.model('../escape'),/标识/);
  assert.deepEqual(Object.keys(store),['model']);
 }finally{await rm(folder,{recursive:true,force:true});}
});
