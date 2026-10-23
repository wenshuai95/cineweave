import test from 'node:test';import assert from 'node:assert/strict';
import {sanitizeSelection,nodesInRect,buildCanvasCopy,pasteCanvasCopy,alignSelection,distributeSelection,pruneGroups,regroup,groupBounds,groupsForSelection,minimapBounds} from '../src/board-operations.mjs';
import {starterProject,validateProject} from '../src/model.mjs';

// 与 main.js 一致的 ID 生成器替身：可预测、无重复。
const makeUid=()=>{let i=0;return ()=> 'pasted-'+(++i)};

function fixture(){
 const nodes=[
  {id:'a',type:'text',title:'A',text:'alpha',x:0,y:0,w:280,objectId:'obj-a',sceneObjectIds:['o1'],modelTask:'task-1',generatedTask:'gen-1'},
  {id:'b',type:'image',title:'B',text:'',x:400,y:0,w:280,src:'data:image/png;base64,AA=='},
  {id:'c',type:'model',title:'C',text:'',x:800,y:0,w:280,modelSrc:'data:model/gltf-binary;base64,AA==',modelSize:2,modelKind:'scene',objectId:'obj-c'},
  {id:'d',type:'text',title:'D',text:'',x:0,y:400,w:280},
 ];
 const edges=[{from:'a',to:'b'},{from:'b',to:'c'},{from:'c',to:'d'}];
 return {nodes,edges};
}
const sizeOf=n=>({w:n.w,h:200});

test('sanitizeSelection keeps order, drops unknown ids and duplicates',()=>{
 assert.deepEqual(sanitizeSelection(['b','zz','a','b','a'],fixture().nodes),['b','a']);
 assert.deepEqual(sanitizeSelection(null,fixture().nodes),[]);
});

test('marquee hit test intersects with rendered sizes and counts partial overlaps',()=>{
 const {nodes}=fixture();
 const hits=nodesInRect(nodes,{x:-10,y:-10,w:100,h:100},sizeOf);
 assert.deepEqual(hits,['a']); // 只碰到 A
 assert.deepEqual(nodesInRect(nodes,{x:0,y:0,w:1,h:1},sizeOf),['a']); // 压到一角即选中
 assert.deepEqual(nodesInRect(nodes,{x:300,y:250,w:50,h:50},sizeOf),[]); // A 右下与 B 左上都够不到
 assert.deepEqual(nodesInRect(nodes,{x:0,y:0,w:2000,h:2000},sizeOf),['a','b','c','d']);
 assert.deepEqual(nodesInRect(nodes,{x:0,y:0,w:0,h:99},sizeOf),[]); // 零面积不选中
});

test('buildCanvasCopy strips project bindings, keeps local media and internal edges only',()=>{
 const {nodes,edges}=fixture();
 const groups=[{id:'g1',name:'G1',memberIds:['a','b','d']},{id:'g2',name:'G2',memberIds:['c','d']}];
 const clip=buildCanvasCopy(nodes,edges,['a','b'],groups);
 assert.equal(clip.app,'director-canvas');assert.equal(clip.version,1);
 for(const n of clip.nodes){
  assert.equal(n.objectId,undefined);assert.equal(n.sceneObjectIds,undefined);
  assert.equal(n.modelTask,undefined);assert.equal(n.generatedTask,undefined);
 }
 const b=clip.nodes.find(n=>n.type==='image');
 assert.equal(b.src,'data:image/png;base64,AA=='); // 本地已完成媒体保留
 assert.deepEqual(clip.edges,[{from:'a',to:'b'}]); // 只保留所选节点之间的内部连线
 assert.deepEqual(clip.groups,[{name:'G1',memberIds:['a','b']}]); // 只选 1 个成员的组不复制
 // 模型节点本地数据保留
 const modelClip=buildCanvasCopy(nodes,edges,['c'],[]);
 assert.equal(modelClip.nodes[0].modelSrc,'data:model/gltf-binary;base64,AA==');
 assert.equal(modelClip.nodes[0].objectId,undefined);
 assert.deepEqual(modelClip.edges,[]);
});

test('pasteCanvasCopy re-ids, offsets, remaps internal edges and groups; result passes validateProject',()=>{
 const {nodes,edges}=fixture();
 const clip=buildCanvasCopy(nodes,edges,['a','b','c'],[{id:'g1',name:'G1',memberIds:['a','b','c']}]);
 const plan=pasteCanvasCopy(clip,{uid:makeUid(),offset:{x:40,y:40},limit:500});
 assert.equal(plan.nodes.length,3);
 assert.deepEqual(plan.nodes.map(n=>n.id),['pasted-1','pasted-2','pasted-3']);
 for(const n of plan.nodes){assert.equal(n.id.startsWith('pasted-'),true);assert.equal(n.x%40,0);assert.ok(n.x>=40)}
 assert.deepEqual(plan.edges,[{from:'pasted-1',to:'pasted-2'},{from:'pasted-2',to:'pasted-3'}]); // 内部连线跟随新 ID
 assert.equal(plan.groups.length,1);
 assert.deepEqual(plan.groups[0].memberIds,['pasted-1','pasted-2','pasted-3']);
 assert.notEqual(plan.groups[0].id,'g1'); // 组重新编号
 // 组装成合法工程再走全量校验
 const p=starterProject();p.nodes=plan.nodes.map(n=>({...n,id:n.id,type:n.type==='model'?'text':n.type}));p.nodes.forEach(n=>{delete n.modelSrc;delete n.modelSize;delete n.modelKind});
 p.edges=plan.edges;p.boardGroups=plan.groups;
 assert.equal(validateProject(p),p);
});

test('paste fails atomically at the 500-node cap and on malformed or polluted payloads',()=>{
 const {nodes,edges}=fixture();
 const clip=buildCanvasCopy(nodes,edges,['a','b'],[]);
 assert.throws(()=>pasteCanvasCopy(clip,{uid:makeUid(),limit:1}),/上限/); // 剩余容量不足：整批拒绝
 const big={...clip,nodes:Array.from({length:501},(_,i)=>({...clip.nodes[0],id:'n'+i}))};
 assert.throws(()=>pasteCanvasCopy(big,{uid:makeUid()}),/上限/); // 粘贴内容自身超上限
 assert.throws(()=>pasteCanvasCopy({app:'other',version:1,nodes:clip.nodes,edges:[]},{uid:makeUid()}),/有效/); // 非自有标记
 assert.throws(()=>pasteCanvasCopy({app:'director-canvas',version:2,nodes:clip.nodes,edges:[]},{uid:makeUid()}),/有效/); // 版本不符
 assert.throws(()=>pasteCanvasCopy({...clip,nodes:[{...clip.nodes[0],id:'x',type:'camera'}]},{uid:makeUid()}),/类型/); // 不支持的节点类型
 assert.throws(()=>pasteCanvasCopy({...clip,nodes:[{...clip.nodes[0],id:'x',type:'image',src:'https://evil.example/x.png'}]},{uid:makeUid()}),/媒体/); // 外部 URL 冒充内嵌媒体
 assert.throws(()=>pasteCanvasCopy({...clip,edges:[{from:'a',to:'ghost'}]},{uid:makeUid()}),/端点/); // 无效连线端点
 assert.throws(()=>pasteCanvasCopy({...clip,groups:[{name:'G',memberIds:['ghost','a']}]},{uid:makeUid()}),/分组/); // 污染分组成员
 assert.throws(()=>pasteCanvasCopy({...clip,nodes:[{...clip.nodes[0],id:'x',type:'model'}]},{uid:makeUid()}),/模型/); // 模型节点缺 modelSrc
 // 长标题截断；不合法的几何尺寸整批拒绝。
 const plan=pasteCanvasCopy({...clip,edges:[],nodes:[{...clip.nodes[0],id:'x',title:'x'.repeat(500)}]},{uid:makeUid(),limit:500});
 assert.equal(plan.nodes[0].title.length,100);
 assert.throws(()=>pasteCanvasCopy({...clip,nodes:[{...clip.nodes[0],w:99999}]},{uid:makeUid()}),/尺寸/);
});

test('alignSelection aligns to the selection bounding box using real rendered sizes',()=>{
 const nodes=[
  {id:'a',type:'text',x:0,y:0,w:280},
  {id:'b',type:'text',x:400,y:60,w:200},
  {id:'c',type:'text',x:100,y:300,w:240},
 ];
 const size=n=>({w:n.w,h:n.id==='c'?400:200});
 const left=alignSelection(nodes,['a','b','c'],'left',size);
 assert.deepEqual([...left.values()].map(v=>v.x),[0,0,0]); // 左对齐到 min x
 const right=alignSelection(nodes,['a','b','c'],'right',size);
 assert.deepEqual([...right.values()].map(v=>v.x),[320,400,360]); // 右缘对齐 max(x+w)
 const hcenter=alignSelection(nodes,['a','b','c'],'hcenter',size);
 assert.deepEqual([...hcenter].map(([id,v])=>v.x+nodes.find(n=>n.id===id).w/2),[300,300,300]); // 返回值只含位置，尺寸取原卡片
 const bottom=alignSelection(nodes,['a','b','c'],'bottom',size);
 assert.deepEqual([...bottom.values()].map(v=>v.y),[500,500,300]); // 底缘对齐 max(y+h)，高度不同各让各的
 assert.equal(alignSelection(nodes,['a'],'left',size),null); // 少于 2 个不操作
});

test('distributeSelection keeps the outer span and equalizes gaps for 3+ nodes',()=>{
 const nodes=[{id:'a',type:'text',x:0,w:100,y:0},{id:'b',type:'text',x:200,w:200,y:10},{id:'c',type:'text',x:600,w:100,y:20},{id:'d',type:'text',x:900,w:100,y:30}];
 const size=n=>({w:n.w,h:150});
 const out=distributeSelection(nodes,['a','b','c','d'],'x',size);
 // 总跨度 0→1000 不变；总宽 500，空闲 500，3 个间隙各 500/3
 const xs=['a','b','c','d'].map(id=>out.get(id).x);
 assert.equal(xs[0],0);assert.ok(Math.abs(xs.at(-1)+100-1000)<1e-9);
 const gaps=xs.slice(1).map((v,i)=>v-(xs[i]+[100,200,100,100][i]));
 assert.ok(gaps.every(g=>Math.abs(g-500/3)<1e-9));
 for(const [id,pos] of out)assert.equal(pos.y,nodes.find(n=>n.id===id).y); // 只动一个轴
 assert.equal(distributeSelection(nodes,['a','b'],'x',size),null); // 少于 3 个不分布
});

test('pruneGroups removes dangling members, empty groups and cross-group duplicates',()=>{
 const nodes=[{id:'a'},{id:'b'},{id:'c'}];
 const out=pruneGroups([
  {id:'g1',name:'G1',memberIds:['a','zz']},
  {id:'g2',name:'G2',memberIds:['gone']},
  {id:'g3',name:'G3',memberIds:['a','b','a']}, // 与 g1 重复的 a 只归第一个组
  {id:'g4',name:'G4',memberIds:['c']},
 ],nodes);
 assert.deepEqual(out,[
  {id:'g1',name:'G1',memberIds:['a']},
  {id:'g3',name:'G3',memberIds:['b']},
  {id:'g4',name:'G4',memberIds:['c']},
 ]);
 assert.deepEqual(pruneGroups('junk'  ,nodes),[]);
});

test('regroup moves members out of other groups without dangling ids',()=>{
 const groups=[{id:'g1',name:'G1',memberIds:['a','b']},{id:'g2',name:'G2',memberIds:['c']}];
 const out=regroup(groups,['b','c','new-node'],'g9','新组');
 assert.deepEqual(out.find(g=>g.id==='g1').memberIds,['a']);
 assert.equal(out.find(g=>g.id==='g2'),undefined); // 全员移出后空组消失
 assert.deepEqual(out.at(-1),{id:'g9',name:'新组',memberIds:['b','c','new-node']});
 const all=new Set(out.flatMap(g=>g.memberIds));
 assert.equal(all.size,[...all].length); // 无重复成员
});

test('groupBounds and groupsForSelection use rendered sizes with padding',()=>{
 const members=[{id:'a',x:0,y:0,w:280},{id:'b',x:400,y:200,w:200}];
 const rect=groupBounds(members,n=>({w:n.w,h:200}),14,28);
 assert.deepEqual(rect,{x:-14,y:-42,w:200+14*2+400,h:200+14*2+200+28});
 assert.equal(groupBounds([],sizeOf),null);
 const groups=[{id:'g1',name:'G1',memberIds:['a','b']},{id:'g2',name:'G2',memberIds:['c']}];
 assert.deepEqual(groupsForSelection(groups,['b','zz']),[groups[0]]);
 assert.deepEqual(groupsForSelection(groups,['zz']),[]);
});

test('minimapBounds unions nodes with the viewport and pads',()=>{
 const rects=[{x:0,y:0,w:280,h:200},{x:1000,y:800,w:280,h:200}];
 const view={x:-100,y:-100,w:500,h:400};
 const b=minimapBounds(rects,view,60);
 assert.deepEqual(b,{x:-160,y:-160,w:1500,h:1220}); // maxX=1280,minX=-100：宽 1380+120；maxY=1000,minY=-100：高 1100+120
 assert.deepEqual(minimapBounds([],view),{x:-160,y:-160,w:620,h:520});
 assert.deepEqual(minimapBounds([{x:0,y:0,w:10,h:10}],{x:0,y:0,w:10,h:10},0),{x:0,y:0,w:10,h:10});
});

test('validateProject accepts optional boardGroups and rejects invalid ones',()=>{
 const base=()=>{const p=starterProject();p.edges=[];return p};
 const ok=base();ok.boardGroups=[{id:'grp-1',name:'分组一',memberIds:[ok.nodes[0].id,ok.nodes[1].id]}];
 assert.equal(validateProject(ok),ok); // 合法分组通过
 const old=base();assert.equal(validateProject(old),old); // 旧工程：没有 boardGroups 也通过
 const missing=base();missing.boardGroups=[{id:'g',name:'G',memberIds:['ghost']}];
 assert.throws(()=>validateProject(missing),/画布分组/); // 成员不存在
 const dup=base();dup.boardGroups=[{id:'g1',name:'G',memberIds:[dup.nodes[0].id]},{id:'g2',name:'G2',memberIds:[dup.nodes[0].id]}];
 assert.throws(()=>validateProject(dup),/画布分组/); // 跨组重复成员
 const badName=base();badName.boardGroups=[{id:'g1',name:123,memberIds:[badName.nodes[0].id]}];
 assert.throws(()=>validateProject(badName),/画布分组/); // 名称类型错误
 const badId=base();badId.boardGroups=[{id:'g 1',name:'G',memberIds:[badId.nodes[0].id]}];
 assert.throws(()=>validateProject(badId),/画布分组/); // 异常组 ID
 const tooMany=base();tooMany.boardGroups=Array.from({length:201},(_,i)=>({id:'g'+i,name:'G',memberIds:[]}));
 assert.throws(()=>validateProject(tooMany),/画布分组/); // 分组数量超上限
 const notArray=base();notArray.boardGroups={id:'g'};
 assert.throws(()=>validateProject(notArray),/画布分组/); // 非数组
});

test('copy → paste round-trip never resurrects deleted bindings and stays within the cap',()=>{
 const {nodes,edges}=fixture();
 const clip=buildCanvasCopy(nodes,edges,['a','b','c'],[]);
 const uid=makeUid();
 const first=pasteCanvasCopy(clip,{uid,offset:{x:40,y:40},limit:500});
 const second=pasteCanvasCopy(clip,{uid,offset:{x:80,y:80},limit:500});
 const ids=new Set([...first.nodes,...second.nodes].map(n=>n.id));
 assert.equal(ids.size,6); // 两批粘贴互不冲突
 for(const n of [...first.nodes,...second.nodes]){
  assert.ok(['text','image','model'].includes(n.type));
  if(n.type==='model')assert.ok(n.modelSrc.startsWith('data:model/gltf-binary;base64,'));
  else if(n.type==='image')assert.ok(n.src.startsWith('data:image/png;base64,'));
 }
 assert.throws(()=>pasteCanvasCopy(clip,{uid:makeUid(),limit:2}),/上限/); // 剩余容量不足整批失败
});
