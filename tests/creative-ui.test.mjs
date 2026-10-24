import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Exercise the actual page controller without adding a DOM dependency. The
// minimal surface models only form/event methods; browser QA covers layout.
class Surface{
 constructor(){this.elements=new Map();this.inner='';this.classList={add(){}};this.value='';this.selectionStart=0;this.selectionEnd=0;this.scrollTop=0;this.style={};this.events=new Map();}
 set innerHTML(value){this.inner=value;this.elements.clear();}
 get innerHTML(){return this.inner;}
 querySelector(selector){if(!this.elements.has(selector)){const element=new Surface();element.dataset={};const pair=selector.match(/^\[data-(view|creative-view)="([^"]+)"\]$/);if(pair)element.dataset[pair[1]==='view'?'view':'creativeView']=pair[2];const attribute=selector.match(/^\[data-([\w-]+)="([^"]+)"\]$/);if(attribute)element.dataset[attribute[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=attribute[2];this.elements.set(selector,element);}return this.elements.get(selector);}
 querySelectorAll(selector){const key=selector.match(/^\[data-([\w-]+)\]$/)?.[1]||null;return key?[...new Set([...this.inner.matchAll(new RegExp('data-'+key+'="([^"]+)"','g'))].map(m=>m[1]))].map(v=>this.querySelector('[data-'+key+'="'+v+'"]')):[];}
 setAttribute(key,value){this[key]=value;}
 addEventListener(name,fn){this.events.set(name,fn);}
 contains(){return false;}
 focus(){}
 setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
 insertAdjacentHTML(_where,html){this.inner+=html;}
}
let serial=0;
async function fixture(){
 const id='creativeTest'+(++serial),state={calls:[],pending:[],adoptions:0,saves:[],checkpoint:0};
 globalThis[id]=state;
 const source=(await readFile(new URL('../src/workstation/creative-page.mjs',import.meta.url),'utf8')).replace(/^import .*?;\n/gm,'');
 // All external effects are replaced. runCreativeTask deliberately permits a
 // late completion, verifying the UI's independent cancellation barrier.
 const mocks=`const f=globalThis[${JSON.stringify(id)}];
 const esc=v=>String(v??'').replace(/[<>]/g,'');
 import zh from ${JSON.stringify(new URL('../src/i18n/zh-CN.json',import.meta.url).href)} with { type: 'json' };
 const t=(key,args)=>{let v=key.split('.').reduce((o,k)=>o?.[k],zh);if(typeof v!=='string')return key;return v.replace(/\{(\w+)\}/g,(_,k)=>String(args?.[k]??'{'+k+'}'));};
 const writingSkills=[{id:'general',name:'通用编剧',description:'按要求创作'}];
 const normalizeWriting=r=>({brief:'',skill:'general',messages:[],...r});
 const boundedHistory=r=>r;
 import {snapshotStory} from ${JSON.stringify(new URL('../src/workstation/story.mjs',import.meta.url).href)};
 import {creativeConversationEntries,restoreCreativeVersion,creativeDiscussionHistory,creativeProductionBrief} from ${JSON.stringify(new URL('../src/workstation/creative-conversation.mjs',import.meta.url).href)};
 import {resolveCreativeSource,creativeSourceSignature} from ${JSON.stringify(new URL('../src/workstation/creative-agent.mjs',import.meta.url).href)};
 const normalizeCreativeTasks=r=>structuredClone(r||[]);
 let taskNo=0;
 const createCreativeTask=(p,o)=>{if(!p.workstation.script.trim())throw Error('请先填写剧本');if(o.flow==='selection-rewrite'&&(!o.selection||p.workstation.script.slice(o.selection.start,o.selection.end)!==o.selection.text))throw Error('选中文字已变化');return {id:'t'+(++taskNo),projectId:p.id,...o,sourceSignature:creativeSourceSignature(p),status:'queued',steps:[{id:'first',label:'分镜',status:'queued'}],candidate:null,createdAt:Date.now(),updatedAt:Date.now()};};
 const textStatus=async()=>({config:{configured:true,model:'mock'}});
 const connectionLabel=()=> 'mock';
 const showTextSettings=async()=>{};
 const textPost=async(_path,body,opts)=>{f.calls.push({body,signal:opts?.signal});return new Promise(resolve=>f.pending.push(resolve));};
 const runCreativeTask=async(task,request,{signal,onChange})=>{task.status='running';task.steps[0].status='running';onChange(task);const result=await request({kind:task.flow,prompt:task.prompt},{signal});task.candidate=task.flow==='selection-rewrite'?{kind:'selection-rewrite',text:result.text}:{kind:'story-package',shots:Array.isArray(result.shots)?result.shots:[],assets:Array.isArray(result.assets)?result.assets:[]};task.status='ready';task.steps[0].status='completed';onChange(task);return task;};\n`;
 const {createCreativePage}=await import('data:text/javascript;base64,'+Buffer.from(mocks+source).toString('base64'));
 globalThis.document={activeElement:null};
 const makeProject=(name,script='原文段落。第二段。')=>({id:name,workstation:{script,story:{shots:[],assets:[],versions:[]},writing:{brief:'',skill:'general',messages:[]},creativeTasks:[]}});
 let current=makeProject('a');const root=new Surface();
 const ctx={project:()=>current,checkpoint:()=>state.checkpoint++,commit(){},persist(){current.workstation.creativeTasks=structuredClone(current.workstation.creativeTasks);},toast(){},onCreativeTasksChanged(){},saveCreativeTasks:async(projectId,tasks)=>state.saves.push({projectId,tasks}),getCanvasSelection:()=>null,adoptCreativeTask:async task=>{state.adoptions++;const saved=current.workstation.creativeTasks.find(t=>t.id===task.id);saved.status='adopted';saved.candidate=null;return true;}};
 const page=createCreativePage(root,ctx);page.onShow();
 await Promise.resolve();
 const message=async value=>{const input=root.querySelector('#creativePrompt');input.value=value;input.oninput();root.querySelector('form').onsubmit({preventDefault(){}});await Promise.resolve();};
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 const produce=async value=>{const input=root.querySelector('#creativePrompt');input.value=value;input.oninput();root.querySelector('[data-action="package"]').onclick();await flush();};
 return {root,page,state,ctx,message,produce,flush,current:()=>current,switchProject(p){current=p;},makeProject,cleanup(){delete globalThis[id];}};
}

test('cancel remains terminal when a late model response arrives',async()=>{
 const f=await fixture();try{
  await f.produce('把剧本拆成三个分镜并整理资产');
  assert.equal(f.state.calls.length,1);
  assert.equal(f.page.tasks()[0].status,'running');
  f.page.cancelAll();assert.equal(f.state.calls[0].signal.aborted,true);
  f.state.pending.shift()({text:'迟到结果'});await f.flush();
  assert.equal(f.page.tasks()[0].status,'canceled');assert.equal(f.page.tasks()[0].candidate,null);
  assert.equal(f.state.calls.length,1);
 }finally{f.cleanup();}
});

test('project switch isolates task, receipt and late completion from the new project',async()=>{
 const f=await fixture();try{
  const original=f.current();await f.produce('拆分镜并整理资产');
  const next=f.makeProject('b','另一份剧本');f.switchProject(next);f.page.onProjectChanged();
  f.state.pending.shift()({text:'旧工程结果'});await f.flush();
  assert.deepEqual(next.workstation.creativeTasks,[]);assert.deepEqual(next.workstation.writing.messages,[]);
  assert.equal(original.workstation.creativeTasks[0].status,'interrupted');
  assert.equal(original.workstation.creativeTasks[0].candidate,null);
  assert.ok(f.state.saves.some(s=>s.projectId==='a'));
 }finally{f.cleanup();}
});

test('same-ID object replacement interrupts the captured run instead of writing into an undo clone',async()=>{
 const f=await fixture();try{
  const before=f.current();await f.produce('拆分镜并整理资产');
  const restored=structuredClone(before);restored.workstation.script='撤销恢复后的剧本';
  f.switchProject(restored);f.page.refresh();
  f.state.pending.shift()({text:'迟到'});await f.flush();
  assert.equal(restored.workstation.script,'撤销恢复后的剧本');
  assert.equal(restored.workstation.creativeTasks[0].candidate,null);
  assert.equal(before.workstation.creativeTasks[0].status,'interrupted');
 }finally{f.cleanup();}
});

test('normalization may clone every save and candidate still adopts exactly once through the host',async()=>{
 const f=await fixture();try{
  await f.produce('拆分镜并整理资产');f.state.pending.shift()({text:'完成'});await f.flush();
  assert.equal(f.page.tasks()[0].status,'ready');
  const area=f.root.querySelector('.creative-task-area');
  await area.querySelector('[data-task-adopt]').events.get('click')();
  assert.equal(f.page.tasks()[0].status,'adopted');assert.equal(f.state.adoptions,1);
  assert.equal(f.state.checkpoint,0,'the host owns the single adoption checkpoint');
 }finally{f.cleanup();}
});

test('direct document selection supports local rewrite and IME Enter never sends a request',async()=>{
 const f=await fixture();try{
  const editor=f.root.querySelector('#creativeScript');editor.selectionStart=0;editor.selectionEnd=4;
  f.root.querySelector('[data-action="use-selection"]').onclick();
  const input=f.root.querySelector('#creativePrompt');input.value='把这段改写得简短一些';input.oninput();
  input.onkeydown({key:'Enter',shiftKey:false,isComposing:true,keyCode:229,preventDefault(){}});
  assert.equal(f.state.calls.length,0);
  input.onkeydown({key:'Enter',shiftKey:true,isComposing:false,keyCode:13,preventDefault(){}});
  assert.equal(f.state.calls.length,0);
  input.onkeydown({key:'Enter',shiftKey:false,isComposing:false,keyCode:13,preventDefault(){}});
  await f.flush();assert.equal(f.state.calls.length,1);assert.equal(f.state.calls[0].body.kind,'selection-rewrite');
  assert.deepEqual(f.page.tasks()[0].selection,{start:0,end:4,text:'原文段落'});
  f.page.cancelAll();f.state.pending.shift()({text:'短句'});await f.flush();
 }finally{f.cleanup();}
});

test('closing the panel leaves a task running and reopening retains its ready preview',async()=>{
 const f=await fixture();try{
  await f.produce('拆分镜并整理资产');f.page.onHide();
  assert.equal(f.state.calls[0].signal.aborted,false);
  f.state.pending.shift()({text:'完成'});await f.flush();
  assert.equal(f.page.tasks()[0].status,'ready');
  f.page.onShow();assert.match(f.root.querySelector('.creative-task-area').innerHTML,/采用并关联到画布/);
  assert.equal(f.current().workstation.writing.messages.at(-1).role,'assistant');
 }finally{f.cleanup();}
});

test('an identical ready task is reused instead of issuing another request',async()=>{
 const f=await fixture();try{
  await f.produce('拆分镜并整理资产');f.state.pending.shift()({text:'完成'});await f.flush();
  await f.produce('拆分镜并整理资产');await f.flush();
  assert.equal(f.state.calls.length,1);assert.equal(f.page.tasks().length,1);
  assert.match(f.root.querySelector('.creative-note').textContent,/已有相同任务/);
 }finally{f.cleanup();}
});

test('ordinary discussion stores advice but never creates a production task or edits script',async()=>{
 const f=await fixture();try{
  const before=f.current().workstation.script;
  await f.message('这个故事的人物动机有什么问题？');
  assert.equal(f.state.calls[0].body.kind,'chat');
  f.state.pending.shift()({text:'可以让人物的目标更明确。'});await f.flush();
  assert.deepEqual(f.page.tasks(),[]);assert.equal(f.current().workstation.script,before);
  assert.equal(f.current().workstation.writing.messages.at(-1).content,'可以让人物的目标更明确。');
 }finally{f.cleanup();}
});

const samplePackage=()=>({shots:[
 {id:'s1',scene:'码头',description:'夜色里货船靠岸，灯光扫过水面。',dialogue:'到了。',duration:4,shotSize:'中景',cameraMovement:'固定',characters:['阿云'],assetIds:[]},
 {id:'s2',scene:'巷口',description:'两道身影一前一后穿过窄巷。',duration:3,shotSize:'全景',cameraMovement:'跟拍',characters:[],assetIds:[]},
 {id:'s3',scene:'天台',description:'风声里两人对峙。',duration:5,shotSize:'远景',cameraMovement:'缓推',characters:[],assetIds:[]},
 {id:'s4',scene:'出租屋',description:'阿云数着线索卡片。',duration:3,shotSize:'特写',cameraMovement:'固定',characters:[],assetIds:[]}],
 assets:[{id:'a1',kind:'character',name:'阿云',description:'主角',prompt:'穿风衣的年轻女性，神情警觉',negativePrompt:'',shotIds:['s1']},
  {id:'a2',kind:'scene',name:'码头',description:'开场场景',prompt:'雨夜码头，冷色霓虹',negativePrompt:'',shotIds:['s1']}]});

test('story-package candidate defaults to counts and a brief digest with full content behind details',async()=>{
 const f=await fixture();try{
  await f.produce('拆分镜并整理资产');
  f.state.pending.shift()(samplePackage());await f.flush();
  const html=f.root.querySelector('.creative-task-area').innerHTML;
  assert.match(html,/分镜[\s\S]*?4[\s\S]*?镜/);assert.match(html,/资产提示词[\s\S]*?2[\s\S]*?项/);
  assert.match(html,/镜头 1·码头/);assert.match(html,/角色「阿云」/);
  assert.match(html,/查看完整分镜[\s\S]*?4[\s\S]*?镜/);assert.match(html,/查看完整资产提示词[\s\S]*?2[\s\S]*?项/);
  for(const tag of (html.match(/<details class="creative-detail"[^>]*>/g)||[]))assert.doesNotMatch(tag,/\bopen\b/);
  assert.match(html,/穿风衣的年轻女性，神情警觉/,'完整提示词仍保留在可展开详情里');
  assert.match(html,/镜头[\s\S]*?4[\s\S]*?出租屋/);
 }finally{f.cleanup();}
});

test('a ready task whose source changed shows 来源已变化 as the only state and cannot be adopted',async()=>{
 const f=await fixture();try{
  await f.produce('拆分镜并整理资产');f.state.pending.shift()({text:'完成'});await f.flush();
  const area=()=>f.root.querySelector('.creative-task-area').innerHTML;
  assert.match(area(),/待你采用/);
  f.current().workstation.script='剧本已经修改过了。';f.page.refresh();
  assert.match(area(),/来源已变化/);assert.doesNotMatch(area(),/待你采用/);
  assert.match(area(),/data-task-adopt[^>]*disabled/);
  assert.match(area(),/按当前内容重新生成/);
  const task=f.page.tasks()[0];
  assert.equal(task.status,'ready');assert.ok(task.candidate,'失效候选保留，供展开查看');
  await f.root.querySelector('.creative-task-area').querySelector('[data-task-adopt]').events.get('click')();
  assert.equal(f.state.adoptions,0);
  assert.match(f.root.querySelector('.creative-messages').innerHTML,/<small>来源已变化<\/small>/,'对话中的任务入口同样标注来源变化');
 }finally{f.cleanup();}
});

test('explicit regeneration from a stale task never overwrites the kept candidate',async()=>{
 const f=await fixture();try{
  await f.produce('拆分镜并整理资产');f.state.pending.shift()(samplePackage());await f.flush();
  const first=f.page.tasks()[0];
  f.current().workstation.script='剧本已经修改过了。';f.page.refresh();
  f.root.querySelector('.creative-task-area').querySelector('[data-task-retry]').events.get('click')();
  await f.flush();
  assert.equal(f.state.calls.length,2,'重新生成按当前内容发起新任务');
  assert.equal(f.page.tasks().length,2);
  assert.equal(first.status,'ready');assert.equal(first.candidate.shots.length,4,'原候选未被自动覆盖');
  f.state.pending.shift()({text:'新结果'});await f.flush();
  assert.equal(f.page.tasks()[1].status,'ready');
 }finally{f.cleanup();}
});

test('context panel and task prompt collapse by default without losing full content',async()=>{
 const f=await fixture();try{
  const html=f.root.innerHTML;
  const context=html.match(/<details class="creative-context"[^>]*>/)[0];
  assert.doesNotMatch(context,/\bopen\b/);
  assert.match(html,/class="creative-counts">[^<]*字 · /,'收起时仍可见字数与分镜资产计数');
  assert.match(html,/creative-context-body/);
  assert.match(html,/请用明确的制作按钮生成候选/,'完整上下文说明仍在文档中');
  await f.produce('拆分镜并整理资产');f.state.pending.shift()({text:'完成'});await f.flush();
  const area=f.root.querySelector('.creative-task-area').innerHTML;
  const promptDetail=area.match(/<details class="creative-prompt-detail"[^>]*>/)[0];
  assert.doesNotMatch(promptDetail,/\bopen\b/);
  assert.match(area,/<p class="creative-task-prompt">拆分镜并整理资产<\/p>/,'完整要求保留在详情里');
  assert.match(area,/本次要求[\s\S]*?拆分镜并整理资产/);
 }finally{f.cleanup();}
});

test('assistant opens on conversation and view switches preserve an unsent draft',async()=>{
 const f=await fixture();try{
  const pane=id=>f.root.querySelector('[data-creative-view="'+id+'"]');
  assert.equal(pane('chat').hidden,false);assert.equal(pane('document').hidden,true);assert.doesNotMatch(f.root.innerHTML,/data-creative-view="tasks"/);
  const input=f.root.querySelector('#creativePrompt');input.value='尚未发送的创意';input.oninput();
  f.root.querySelector('[data-view="document"]').onclick();assert.equal(pane('document').hidden,false);assert.equal(pane('chat').hidden,true);
  f.root.querySelector('[data-view="chat"]').onclick();assert.equal(input.value,'尚未发送的创意');assert.equal(f.state.calls.length,0);
  f.page.onShow({editDocument:true});assert.equal(pane('document').hidden,false);
  f.page.onShow();assert.equal(pane('chat').hidden,false);assert.equal(f.root.querySelector('#creativePrompt').value,'尚未发送的创意');
 }finally{f.cleanup();}
});

test('production stays in conversation and reopening the assistant does not force an old candidate over the conversation',async()=>{
 const f=await fixture();try{
  await f.produce('拆分镜并整理资产');
  assert.equal(f.root.querySelector('[data-creative-view="chat"]').hidden,false);
  f.state.pending.shift()(samplePackage());await f.flush();
  f.page.onShow();assert.equal(f.root.querySelector('[data-creative-view="chat"]').hidden,false);
  assert.match(f.root.querySelector('.creative-messages').innerHTML,/待你采用/);
  assert.equal(f.page.openTask(f.page.tasks()[0].id),true);
  assert.equal(f.root.querySelector('[data-creative-view="chat"]').hidden,false);
  assert.equal(f.state.adoptions,0);
 }finally{f.cleanup();}
});


test('keywords and negation in normal chat never silently create production tasks',async()=>{
 const f=await fixture();try{
  const original=structuredClone(f.current().workstation);
  await f.message('先讨论一下分镜，不要生成，也不要整理资产提示词');
  assert.equal(f.state.calls[0].body.kind,'chat');assert.deepEqual(f.page.tasks(),[]);
  f.state.pending.shift()({text:'先讨论镜头节奏。'});await f.flush();
  assert.equal(f.current().workstation.script,original.script);
  assert.deepEqual(f.current().workstation.story,original.story);
 }finally{f.cleanup();}
});

test('node entry reads its actual body and preserves project script, while project-scope switch is explicit',async()=>{
 const f=await fixture();try{
  f.current().nodes=[{id:'node-a',type:'text',title:'战斗构思',text:'女修在背后偷偷结印。'}];
  f.page.onShow({sourceNodeId:'node-a',operation:'storyboard'});await f.flush();
  assert.match(f.root.innerHTML,/战斗构思/);
  await f.message('先讨论分镜，不要生成');
  assert.equal(f.state.calls[0].body.kind,'chat');assert.equal(f.state.calls[0].body.script,'女修在背后偷偷结印。');
  assert.deepEqual(f.state.calls[0].body.shots,[]);assert.deepEqual(f.state.calls[0].body.assets,[]);assert.deepEqual(f.page.tasks(),[]);
  f.state.pending.shift()({text:'可以先建立反打关系。'});await f.flush();
  f.root.querySelector('[data-action="project-scope"]').events.get('click')();
  await f.message('分析正文');assert.equal(f.state.calls[1].body.script,'原文段落。第二段。');
  assert.equal(f.current().workstation.script,'原文段落。第二段。');
 }finally{f.cleanup();}
});

test('deleted source node blocks the request instead of silently using the project script',async()=>{
 const f=await fixture();try{
  f.current().nodes=[{id:'node-a',type:'text',title:'笔记',text:'节点正文'}];f.page.onShow({sourceNodeId:'node-a'});
  f.current().nodes=[];await f.message('继续分析');assert.equal(f.state.calls.length,0);
  assert.match(f.root.querySelector('.creative-note').textContent,/来源节点已删除/);
 }finally{f.cleanup();}
});

test('versions stay inside the document and restore protects the current draft with a snapshot',async()=>{
 const f=await fixture();try{
  f.page.onShow({editDocument:true});
  f.root.querySelector('[data-action="save-version"]').onclick();
  const editor=f.root.querySelector('#creativeScript');editor.value='当前编辑中的剧本';editor.oninput();
  const input=f.root.querySelector('#creativePrompt');input.value='保留未发送的要求';input.oninput();
  f.root.querySelector('[data-action="legacy"]').onclick();
  const versions=f.root.querySelector('.creative-versions');assert.equal(versions.hidden,false);assert.match(versions.innerHTML,/恢复前会自动保存当前内容/);
  assert.doesNotMatch(f.root.innerHTML,/data-creative-view="tasks"/);
  const restore=versions.querySelectorAll('[data-restore-version]')[0];restore.onclick();
  assert.equal(f.current().workstation.script,'原文段落。第二段。');
  assert.equal(f.current().workstation.story.versions.at(-1).script,'当前编辑中的剧本');
  assert.equal(f.root.querySelector('#creativePrompt').value,'保留未发送的要求');
  assert.equal(f.state.calls.length,0);
 }finally{f.cleanup();}
});

test('document selection survives opening version records and returning from conversation',async()=>{
 const f=await fixture();try{
  f.page.onShow({editDocument:true});const editor=f.root.querySelector('#creativeScript');editor.selectionStart=2;editor.selectionEnd=6;editor.scrollTop=41;editor.events.get('select')();
  f.root.querySelector('[data-action="legacy"]').onclick();
  assert.equal(editor.selectionStart,2);assert.equal(editor.selectionEnd,6);
  f.root.querySelector('[data-view="chat"]').onclick();f.page.onShow({editDocument:true});
  const reopened=f.root.querySelector('#creativeScript');assert.equal(reopened.selectionStart,2);assert.equal(reopened.selectionEnd,6);assert.equal(reopened.scrollTop,41);
  assert.equal(f.root.querySelector('[data-action="use-selection"]').disabled,false);
 }finally{f.cleanup();}
});

test('discussion reads the expanded unadopted candidate and never adopts it',async()=>{
 const f=await fixture();try{
  await f.produce('拆分镜并整理资产');f.state.pending.shift()(samplePackage());await f.flush();
  const id=f.page.tasks()[0].id;assert.equal(f.current().workstation.writing.messages[0].taskId,id);
  await f.message('第二镜可以如何调整？');
  const body=f.state.calls.at(-1).body;assert.equal(body.kind,'chat');assert.match(body.history.at(-1).content,/尚未写入工程/);assert.match(body.history.at(-1).content,/巷口/);
  f.state.pending.shift()({text:'建议继续保持动作方向。'});await f.flush();assert.equal(f.state.adoptions,0);assert.equal(f.page.tasks()[0].status,'ready');
 }finally{f.cleanup();}
});

test('a changed source is never attached as a current candidate to a discussion',async()=>{
 const f=await fixture();try{
  await f.produce('拆分镜并整理资产');f.state.pending.shift()(samplePackage());await f.flush();f.current().workstation.script='新的故事';
  await f.message('继续讨论');assert.ok(!f.state.calls.at(-1).body.history.some(m=>m.content.includes('尚未写入工程')));
  f.state.pending.shift()({text:'按当前故事讨论'});await f.flush();
 }finally{f.cleanup();}
});

test('new discussion allows an explicit production revision without overwriting the old candidate',async()=>{
 const f=await fixture();try{
  await f.produce('拆分镜并整理资产');f.state.pending.shift()(samplePackage());await f.flush();
  await f.message('改成夜景，并让人物从左边入画');f.state.pending.shift()({text:'可以将入场方向统一。'});await f.flush();
  await f.produce('拆分镜并整理资产');assert.equal(f.state.calls.length,3);assert.equal(f.page.tasks().length,2);assert.equal(f.page.tasks()[0].status,'ready');
  f.state.pending.shift()(samplePackage());await f.flush();
 }finally{f.cleanup();}
});
