import test from 'node:test';
import assert from 'node:assert/strict';
import {CANVAS_TEMPLATES,planCanvasTemplate,MAX_BOARD_GROUPS} from '../src/canvas-templates.mjs';
import {MAX_BOARD_NODES,buildCanvasCopy,pasteCanvasCopy} from '../src/board-operations.mjs';
import {collapsedGroupFor,boardItems,boardWires} from '../src/board-presentation.mjs';
import {starterProject,validateProject,clone} from '../src/model.mjs';
const ID_RE=/^[a-zA-Z0-9_-]{1,100}$/;
const MEDIA_TYPES=['image','video','audio'];
const byid=id=>CANVAS_TEMPLATES.find(t=>t.id===id);
const EXPECT={'character-board':['actor','image'],'scene-board':['scene','image'],'first-last-video':['image','image','video'],'voice-prep':['text','audio']};
let serial=0;
const nextCreateId=()=>()=>`tpl-${++serial}`;
function fresh(){serial=0;return validateProject(starterProject());}
// 写入计划的最小集成路径：只追加，不改动任何既有数据。
function apply(project,plan,{delta=0}={}){
 const p=clone(project);
 p.nodes.push(...plan.nodes.map(n=>({...n,x:n.x+delta,y:n.y+delta})));
 p.edges.push(...plan.edges.map(e=>({...e})));
 p.boardGroups=[...(p.boardGroups||[]),{...plan.group,memberIds:[...plan.group.memberIds]}];
 return p;
}
function fillNodes(count){const p=fresh();for(let i=p.nodes.length;i<count;i++)p.nodes.push({id:`filler-${i}`,type:'text',title:'填充',text:'占位',x:2000+i,y:4000,w:320});return p;}

test('exactly four templates with stable ids, copy and steps',()=>{
 assert.deepEqual(CANVAS_TEMPLATES.map(t=>t.id),['character-board','scene-board','first-last-video','voice-prep']);
 assert.equal(new Set(CANVAS_TEMPLATES.map(t=>t.id)).size,4);
 for(const t of CANVAS_TEMPLATES){
  assert.equal(typeof t.title,'string');assert.ok(t.title.length>0&&t.title.length<=100);
  assert.equal(typeof t.description,'string');assert.ok(t.description.length>0);
  assert.ok(Array.isArray(t.steps)&&t.steps.length>=2&&t.steps.every(s=>typeof s==='string'&&s.length));
 }
});

test('each template plans its declared node types on a readable grid',()=>{
 for(const template of CANVAS_TEMPLATES){
  const plan=planCanvasTemplate(fresh(),template.id,{x:120,y:80,createId:nextCreateId()});
  assert.deepEqual(plan.nodes.map(n=>n.type),EXPECT[template.id]);
  assert.equal(plan.nodes.length,template.steps.length);
  assert.equal(plan.primaryId,plan.nodes[0].id);
  const slots=new Set();
  for(const n of plan.nodes){
   assert.deepEqual(Object.keys(n),['id','type','title','text','x','y','w']);
   assert.match(n.id,ID_RE);assert.equal(n.w,320);
   assert.ok(n.title.length>0&&n.title.length<=100);
   assert.ok(n.text.length>0&&n.text.length<=200000);
   assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y));
   if(MEDIA_TYPES.includes(n.type))assert.equal('src'in n,false,`${template.id} must not carry media data`);
   slots.add(`${n.x}:${n.y}`);
  }
  assert.equal(slots.size,plan.nodes.length,'planned cards never stack on each other');
  assert.equal(plan.edges.length,template.id==='first-last-video'?2:1);
 }
});

test('planning never touches the project it was derived from',()=>{
 const p=fresh(),before=structuredClone(p);
 const plan=planCanvasTemplate(p,'character-board',{createId:nextCreateId()});
 assert.deepEqual(p,before);
 assert.equal(p.boardGroups,undefined);
 // Mutating the returned plan must not leak back into the project either.
 plan.group.name='被改名';plan.nodes[0].text='被改写';
 assert.deepEqual(p.nodes.map(n=>n.text),before.nodes.map(n=>n.text));
 assert.notDeepEqual(plan.nodes[0],p.nodes[0]);
});

test('every wire stays inside the plan and matches the template flow',()=>{
 for(const template of CANVAS_TEMPLATES){
  const p=fresh(),plan=planCanvasTemplate(p,template.id,{createId:nextCreateId()});
  const ids=new Set(plan.nodes.map(n=>n.id)),existing=new Set(p.nodes.map(n=>n.id));
  for(const e of plan.edges){
   assert.deepEqual(Object.keys(e),['from','to']);
   assert.ok(ids.has(e.from)&&ids.has(e.to),'wires only connect newly created cards');
   assert.notEqual(e.from,e.to);
   assert.ok(!existing.has(e.from)&&!existing.has(e.to));
  }
  assert.equal(new Set(plan.edges.map(e=>`${e.from}>${e.to}`)).size,plan.edges.length);
 }
 const pair=planCanvasTemplate(fresh(),'character-board',{createId:nextCreateId()});
 assert.deepEqual(pair.edges,[{from:pair.nodes[0].id,to:pair.nodes[1].id}]);
 const video=planCanvasTemplate(fresh(),'first-last-video',{createId:nextCreateId()});
 for(const e of video.edges)assert.equal(e.to,video.nodes[2].id,'both frames feed the video node');
});

test('the whole batch collapses into one new group card',()=>{
 const p=fresh(),plan=planCanvasTemplate(p,'first-last-video',{createId:nextCreateId()});
 assert.equal(plan.group.name,byid('first-last-video').title);
 assert.deepEqual(plan.group.memberIds,plan.nodes.map(n=>n.id));
 assert.equal(plan.group.collapsed,true);
 assert.match(plan.group.id,ID_RE);
 assert.ok(!(p.boardGroups||[]).some(g=>g.id===plan.group.id));
 const merged=apply(p,plan);
 assert.equal(validateProject(merged).boardGroups.length,1);
 for(const id of plan.group.memberIds)assert.equal(collapsedGroupFor(merged,id).id,plan.group.id);
 // A collapsed group renders as one board item; its internal wires do not surface as wires.
 const items=boardItems(merged,()=>({w:320,h:240}));
 assert.equal(items.filter(i=>i.groupId===plan.group.id).length,1);
 assert.equal(items.length,p.nodes.length+1);
 const wires=boardWires(merged,items);
 assert.equal(wires.length,p.edges.length);
 assert.ok(wires.every(w=>w.a!==w.b));
});

test('existing nodes, wires and groups survive alongside the new card',()=>{
 const base=fresh();
 base.boardGroups=[{id:'kept-group',name:'保留组',memberIds:[base.nodes[1].id,base.nodes[2].id],collapsed:false}];
 const plan=planCanvasTemplate(base,'voice-prep',{createId:nextCreateId()});
 const merged=apply(base,plan);
 validateProject(merged);
 assert.equal(merged.nodes.length,base.nodes.length+2);
 assert.equal(merged.edges.length,base.edges.length+1);
 assert.deepEqual(merged.boardGroups[0],base.boardGroups[0]);
 assert.equal(merged.boardGroups[1].id,plan.group.id);
 for(const n of base.nodes)assert.deepEqual(merged.nodes.find(x=>x.id===n.id),n);
 for(const e of base.edges)assert.ok(merged.edges.some(x=>x.from===e.from&&x.to===e.to));
 assert.equal(new Set(merged.boardGroups.flatMap(g=>g.memberIds)).size,4);
});

test('spacing, offsets and repeated templates stay deterministic and apart',()=>{
 const a=planCanvasTemplate(fresh(),'character-board',{x:0,y:0,createId:nextCreateId()});
 assert.equal(a.nodes[1].x-a.nodes[0].x,420);assert.equal(a.nodes[1].y-a.nodes[0].y,0);
 const b=planCanvasTemplate(fresh(),'character-board',{x:960,y:-540,createId:nextCreateId()});
 assert.deepEqual([b.nodes[0].x,b.nodes[0].y],[960,-540]);
 assert.deepEqual([b.nodes[1].x,b.nodes[1].y],[1380,-540]);
 const video=planCanvasTemplate(fresh(),'first-last-video',{x:40,y:60,createId:nextCreateId()});
 assert.deepEqual([video.nodes[0].x,video.nodes[0].y],[40,60]);
 assert.deepEqual([video.nodes[1].x,video.nodes[1].y],[40,400],'second frame sits on the next row');
 assert.deepEqual([video.nodes[2].x,video.nodes[2].y],[460,60]);
 const first=planCanvasTemplate(fresh(),'scene-board',{x:300,y:200,createId:nextCreateId()});
 const second=planCanvasTemplate(apply(fresh(),first),'scene-board',{x:300,y:200,createId:nextCreateId()});
 assert.notEqual(first.nodes[0].id,second.nodes[0].id);
 assert.notEqual(first.group.id,second.group.id);
 assert.deepEqual(first.nodes.map(n=>[n.x,n.y]),second.nodes.map(n=>[n.x,n.y]));
});

test('project stays untouched when capacity refuses the batch',()=>{
 const almostFull=fillNodes(MAX_BOARD_NODES-3);
 const ok=planCanvasTemplate(almostFull,'first-last-video',{createId:nextCreateId()});
 assert.equal(ok.nodes.length,3);
 validateProject(apply(almostFull,ok));
 const full=apply(almostFull,ok),before=structuredClone(full);
 assert.throws(()=>planCanvasTemplate(full,'scene-board',{createId:nextCreateId()}),/上限/);
 assert.throws(()=>planCanvasTemplate(full,'scene-board',{createId:nextCreateId()}),/模板未创建/);
 assert.deepEqual(full,before);
 assert.equal(full.nodes.length,MAX_BOARD_NODES);
 const many=fresh();
 many.boardGroups=Array.from({length:MAX_BOARD_GROUPS},(_,i)=>({id:`grp-${i}`,name:'分组',memberIds:[many.nodes[i%2].id]}));
 const groupsBefore=structuredClone(many.boardGroups);
 assert.throws(()=>planCanvasTemplate(many,'character-board',{createId:nextCreateId()}),/分组已达上限/);
 assert.deepEqual(many.boardGroups,groupsBefore);
 assert.equal(many.nodes.length,fresh().nodes.length);
});

test('invalid template, coordinates and id generators fail fast and finitely',()=>{
 const p=fresh();
 assert.throws(()=>planCanvasTemplate(p,'no-such-template',{createId:nextCreateId()}),/未知的画布流程模板/);
 assert.throws(()=>planCanvasTemplate(p,undefined,{createId:nextCreateId()}),/未知的画布流程模板/);
 assert.throws(()=>planCanvasTemplate(null,'voice-prep',{createId:nextCreateId()}),/工程数据无效/);
 for(const bad of [NaN,Infinity,-Infinity,'40'])
  assert.throws(()=>planCanvasTemplate(p,'voice-prep',{x:bad,y:0,createId:nextCreateId()}),/落点位置无效/);
 for(const bad of [NaN,Infinity,'12'])
  assert.throws(()=>planCanvasTemplate(p,'voice-prep',{x:0,y:bad,createId:nextCreateId()}),/落点位置无效/);
 assert.throws(()=>planCanvasTemplate(p,'voice-prep',{createId:'not-a-function'}),/缺少 ID 生成器/);
 // Illegal or permanently colliding ids must give up after a bounded number of tries.
 for(const bad of [()=>'非法 字符',()=>'',()=>123,()=>null,()=>'a'.repeat(101),()=>'stuck']){
  let calls=0;
  assert.throws(()=>planCanvasTemplate(fresh(),'character-board',{createId:()=>{calls++;return bad();}}),/ID 生成失败/);
  assert.ok(calls<=65,`id generation must stay bounded, saw ${calls} calls`);
 }
 const occupied=fresh();
 assert.throws(()=>planCanvasTemplate(occupied,'character-board',{createId:()=>occupied.nodes[0].id}),/ID 生成失败/);
});

test('clipboard round trip keeps the collapsed group and internal wires',()=>{
 const p=fresh(),plan=planCanvasTemplate(p,'first-last-video',{createId:nextCreateId()});
 const merged=apply(p,plan);
 const copy=buildCanvasCopy(merged.nodes,merged.edges,plan.group.memberIds,merged.boardGroups);
 assert.equal(copy.nodes.length,3);
 assert.equal(copy.groups.length,1);
 assert.equal(copy.groups[0].name,plan.group.name);
 assert.equal(copy.groups[0].collapsed,true);
 assert.deepEqual(copy.groups[0].memberIds,plan.group.memberIds);
 assert.equal(copy.edges.length,2,'wires inside the selection are copied exactly once');
 assert.ok(copy.nodes.every(n=>MEDIA_TYPES.includes(n.type)?n.src===undefined:true));
 let pasted=0;
 const produced=pasteCanvasCopy(copy,{uid:()=>`paste-${++pasted}`,offset:{x:40,y:40}});
 assert.equal(produced.nodes.length,3);
 assert.deepEqual(produced.edges.map(e=>[produced.nodes.findIndex(n=>n.id===e.from),produced.nodes.findIndex(n=>n.id===e.to)]),[[0,2],[1,2]]);
 assert.equal(produced.groups.length,1);
 assert.equal(produced.groups[0].collapsed,true);
 assert.deepEqual(produced.groups[0].memberIds,produced.nodes.map(n=>n.id));
 const freshIds=new Set([...produced.nodes.map(n=>n.id),produced.groups[0].id]);
 assert.equal(freshIds.size,4);
 assert.ok([...freshIds].every(id=>!merged.nodes.some(n=>n.id===id)&&!(merged.boardGroups||[]).some(g=>g.id===id)));
 const target=apply(merged,{nodes:produced.nodes,edges:produced.edges,group:produced.groups[0],primaryId:produced.nodes[0].id});
 validateProject(target);
 assert.equal(target.boardGroups.length,2);
});

test('template copy never claims to have generated media',()=>{
 for(const template of CANVAS_TEMPLATES){
  assert.doesNotMatch(template.description,/一键生|自动生/);
  for(const n of planCanvasTemplate(fresh(),template.id,{createId:nextCreateId()}).nodes){
   assert.doesNotMatch(n.text,/一键生|自动生[成]|已生[成]/);
   if(n.type==='image')assert.match(n.text,/导入素材|复制粘贴/);
   if(n.type==='video'||n.type==='audio'){
    assert.equal('src' in n,false);
    if(n.type==='audio'){assert.match(n.title,/待导入/);assert.match(n.text,/没有语音生成接口/);}
    else assert.doesNotMatch(n.text,/当前没有视频生成接口/);
    assert.match(n.text,/导入/);
    assert.doesNotMatch(n.text,/立即生[成]|点击生[成]/);
   }
  }
 }
 const actor=planCanvasTemplate(fresh(),'character-board',{createId:nextCreateId()}).nodes[0].text;
 for(const field of ['姓名','外观','服装','识别点','风格'])assert.match(actor,new RegExp(field));
 const scene=planCanvasTemplate(fresh(),'scene-board',{createId:nextCreateId()}).nodes[0].text;
 for(const field of ['空间','年代','光线','材质','禁忌'])assert.match(scene,new RegExp(field));
});
