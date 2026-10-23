import test from 'node:test';import assert from 'node:assert/strict';
import {classifyImportFile,planImportBatch,boardPointFromClient,staggeredNodeOrigins,MEDIA_MAX_BYTES,GLB_MAX_BYTES} from '../src/drop-import.mjs';
import {demoProject,validateProject,uid} from '../src/model.mjs';
const KB=1024,MB=KB*KB,stub=(name,type='',size=1)=>({name,type,size});
test('known MIME types classify to their media kind',()=>{
 for(const [mime,kind] of [['image/png','image'],['image/jpeg','image'],['image/webp','image'],['image/gif','image'],['video/mp4','video'],['video/webm','video'],['audio/mpeg','audio'],['audio/mp3','audio'],['audio/wav','audio'],['audio/x-wav','audio'],['audio/ogg','audio'],['audio/mp4','audio'],['audio/webm','audio'],['model/gltf-binary','glb']]){
  const r=classifyImportFile(stub('f.bin',mime,MB));
  assert.equal(r.ok,true,mime);assert.equal(r.kind,kind,mime);
 }
});
test('MIME wins over a contradictory extension when both are present',()=>{
 assert.equal(classifyImportFile(stub('song.glb','audio/mpeg',MB)).kind,'audio');
 assert.equal(classifyImportFile(stub('photo.mp4','image/png',MB)).kind,'image');
});
test('empty or generic MIME falls back to the filename extension',()=>{
 for(const [ext,kind] of [['png','image'],['jpg','image'],['jpeg','image'],['webp','image'],['gif','image'],['mp4','video'],['webm','video'],['mp3','audio'],['wav','audio'],['ogg','audio'],['m4a','audio'],['glb','glb']]){
  assert.equal(classifyImportFile(stub('file.'+ext,'',MB)).kind,kind,ext);
  assert.equal(classifyImportFile(stub('file.'+ext,'application/octet-stream',MB)).kind,kind,'octet-stream '+ext);
 }
 assert.equal(classifyImportFile(stub('模型.GLB','',MB)).kind,'glb'); // 大写扩展名与中文文件名
});
test('unsupported files are rejected with a Chinese reason',()=>{
 for(const file of [stub('notes.txt','text/plain',MB),stub('virus.exe','',MB),stub('data.json','application/json',MB),stub('noext','',MB),stub('weird.rar','application/x-rar-compressed',MB)]){
  const r=classifyImportFile(file);
  assert.equal(r.ok,false,file.name);
  assert.match(r.error,/不支持的类型/);
 }
});
test('unusable size metadata is rejected instead of passing through',()=>{
 for(const size of [NaN,Infinity,-1])assert.equal(classifyImportFile(stub('a.png','image/png',size)).ok,false);
});
test('media files are capped at 25 MB, boundary inclusive',()=>{
 assert.equal(classifyImportFile(stub('a.png','image/png',25*MB)).ok,true);
 for(const f of [stub('a.png','image/png',25*MB+1),stub('c.mp4','video/mp4',25*MB+1),stub('d.mp3','audio/mpeg',26*MB)])assert.match(classifyImportFile(f).error,/超过 25 MB 上限/,f.name);
});
test('GLB keeps its own 40 MB limit even beyond the media cap',()=>{
 assert.equal(classifyImportFile(stub('a.glb','model/gltf-binary',40*MB)).ok,true);
 assert.equal(classifyImportFile(stub('b.glb','',40*MB)).ok,true);
 assert.equal(classifyImportFile(stub('c.glb','model/gltf-binary',30*MB)).kind,'glb'); // 30MB 超媒体限但 GLB 允许
 assert.match(classifyImportFile(stub('d.glb','model/gltf-binary',40*MB+1)).error,/超过 40 MB 上限/);
 assert.equal(MEDIA_MAX_BYTES,25*1024*1024);assert.equal(GLB_MAX_BYTES,40*1024*1024);
});
test('planImportBatch splits mixed drops and keeps the valid remainder',()=>{
 const plan=planImportBatch([stub('a.png','image/png',MB),stub('b.mp3','audio/mpeg',MB),stub('c.glb','',MB),stub('bad.txt','text/plain',MB),stub('huge.jpg','image/jpeg',99*MB)]);
 assert.equal(plan.media.length,2);assert.deepEqual(plan.media.map(m=>m.kind),['image','audio']);
 assert.equal(plan.glbs.length,1);assert.equal(plan.glbs[0].kind,'glb');
 assert.equal(plan.errors.length,2);assert.ok(plan.errors.some(e=>e.includes('bad.txt')));assert.ok(plan.errors.some(e=>e.includes('huge.jpg')&&e.includes('25 MB')));
 assert.deepEqual(planImportBatch([]),{media:[],glbs:[],errors:[]});
});
test('boardPointFromClient maps screen coordinates through pan and zoom',()=>{
 const rect={left:100,top:50};
 assert.deepEqual(boardPointFromClient(200,120,rect,{x:0,y:0,zoom:1}),{x:100,y:70});
 // pan shifts the world: view at (40,20) means world origin renders at screen (140,70)
 assert.deepEqual(boardPointFromClient(140,70,rect,{x:40,y:20,zoom:1}),{x:0,y:0});
 // zoom scales distances from the view origin
 assert.deepEqual(boardPointFromClient(240,120,rect,{x:0,y:0,zoom:.8}),{x:175,y:87.5});
 // round trip: world point -> screen -> world survives pan+zoom
 const view={x:-260,y:130,zoom:1.25},world={x:520,y:-84};
 const screen={left:100+view.x+world.x*view.zoom,top:50+view.y+world.y*view.zoom};
 assert.deepEqual(boardPointFromClient(screen.left,screen.top,rect,view),world);
});
test('empty-MIME drops survive project save/reload via the resolved MIME',async()=>{
 const bytes=new Uint8Array([137,80,78,71,13,10,26,10]);
 const file={name:'海报.png',type:'',size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer};
 const verdict=classifyImportFile(file);
 assert.equal(verdict.ok,true);assert.equal(verdict.mime,'image/png');
 // 与 main.js readMediaFile 同构：以解析出的具体 MIME 重建 Blob，再转 data URL
 const rebuilt=new Blob([await file.arrayBuffer()],{type:verdict.mime});
 const src='data:'+rebuilt.type+';base64,'+Buffer.from(await rebuilt.arrayBuffer()).toString('base64');
 assert.equal(rebuilt.type,'image/png');
 const p=demoProject();p.nodes.push({id:uid(),type:'image',title:'海报.png',text:'本地导入的参考素材',x:80,y:80,w:280,src});
 assert.doesNotThrow(()=>validateProject(JSON.parse(JSON.stringify(p)))); // 保存 → 重新打开
 // 旧行为（直接读取原始空 MIME 文件）生成的 data URL 会被工程校验拒绝
 for(const badType of ['','application/octet-stream']){
  const raw='data:'+badType+';base64,'+Buffer.from(bytes).toString('base64');
  const q=demoProject();q.nodes.push({id:uid(),type:'image',title:'x.png',text:'',x:80,y:80,w:280,src:raw});
  assert.throws(()=>validateProject(q),/仅支持内嵌/);
 }
});
test('every extension fallback resolves to a whitelisted concrete MIME',()=>{
 for(const [ext,mime] of [['png','image/png'],['jpg','image/jpeg'],['jpeg','image/jpeg'],['webp','image/webp'],['gif','image/gif'],['mp4','video/mp4'],['webm','video/webm'],['mp3','audio/mpeg'],['wav','audio/wav'],['ogg','audio/ogg'],['m4a','audio/mp4'],['glb','model/gltf-binary']]){
  const r=classifyImportFile(stub('a.'+ext,'',MB));
  assert.equal(r.mime,mime,ext);assert.ok(!/\*$/.test(r.mime));
 }
 assert.equal(classifyImportFile(stub('b.mov','video/quicktime',MB)).ok,false); // 有 MIME 但不在白名单，不做扩展名替换
});
test('local GLB model nodes default to modelKind scene and validate on roundtrip',()=>{
 const p=demoProject();
 p.nodes.push({id:uid(),type:'model',title:'本地 3D 模型',text:'本地导入的 3D 模型（GLB）。\n拖线到导演台节点即可加入场景；选中节点可在右侧加入导演台。',x:100,y:60,w:280,modelSrc:'data:model/gltf-binary;base64,AAAA',modelSize:2,modelKind:'scene'});
 assert.doesNotThrow(()=>validateProject(JSON.parse(JSON.stringify(p))));
 const q=demoProject();
 q.nodes.push({id:uid(),type:'model',title:'缺 modelKind',text:'',x:100,y:60,w:280,modelSrc:'data:model/gltf-binary;base64,AAAA',modelSize:2});
 assert.throws(()=>validateProject(q),/生成模型节点/);
});
test('staggeredNodeOrigins lays dropped nodes out in a grid from the drop point',()=>{
 assert.deepEqual(staggeredNodeOrigins(0,{x:10,y:20}),[]);
 assert.deepEqual(staggeredNodeOrigins(1,{x:100,y:60}),[{x:100,y:60}]);
 const five=staggeredNodeOrigins(5,{x:0,y:0});
 assert.equal(five.length,5);
 assert.deepEqual(five[3],{x:0,y:330}); // 第 4 个换行回到第一列
 assert.deepEqual(five[4],{x:310,y:330});
 for(const a of five)for(const b of five)if(a!==b)assert.ok(a.x!==b.x||a.y!==b.y); // 无重叠
 const custom=staggeredNodeOrigins(2,{x:5,y:7},{columns:1,stepX:99,stepY:42});
 assert.deepEqual(custom,[{x:5,y:7},{x:5,y:49}]);
 assert.deepEqual(staggeredNodeOrigins(2,null),[{x:80,y:80},{x:390,y:80}]); // 无落点回退按钮布局
});
