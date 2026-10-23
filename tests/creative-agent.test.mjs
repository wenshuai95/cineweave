import test from 'node:test';import assert from 'node:assert/strict';
import {creativeSourceSignature,createCreativeTask,normalizeCreativeTasks,runCreativeTask,prepareCreativeAdoption} from '../src/workstation/creative-agent.mjs';
import {normalizeStory} from '../src/workstation/story.mjs';

const SCRIPT='EXT. 老城巷口 · 傍晚\n\n小明穿过街道，在巷口停下，抬头望向屋顶的阿蓝。';
function makeProject(){
 const story=normalizeStory({
  shots:[
   {id:'shot-1',scene:'街道',characters:['小明'],description:'小明走进街道。',dialogue:'到了。',duration:3,shotSize:'中景',cameraMovement:'跟拍',canvasNodeId:'node-shot-1'},
   {id:'shot-2',scene:'屋顶',characters:['小明','阿蓝'],description:'两人望向远处。',dialogue:'',duration:4,shotSize:'全景',cameraMovement:'摇',canvasNodeId:'node-shot-2'}
  ],
  assets:[
   {id:'asset-ming',kind:'character',name:'小明',description:'主角少年',prompt:'少年，蓝外套',negativePrompt:'',shotIds:['shot-1'],imageVersions:[{id:'v1',mediaId:'media-1',name:'定稿',mime:'image/png',size:1000,width:64,height:64,createdAt:1}],selectedImageId:'v1'},
   {id:'asset-hand',kind:'prop',name:'旧信',description:'手工登记的道具',prompt:'',shotIds:[]}
  ]});
 const node=(id,type,extra={})=>({id,type,title:id,text:'',x:60,y:60,w:320,...extra});
 return {schema:'jingchang/1',id:'proj-1',name:'测试工程',objects:[],shots:[],board:{x:0,y:0,zoom:1},
  nodes:[
   node('node-shot-1','text',{title:'镜头 01 · 街道',text:'小明走进街道。',storyRef:{kind:'shot',id:'shot-1'}}),
   node('node-shot-2','text',{title:'镜头 02 · 屋顶',text:'两人望向远处。',storyRef:{kind:'shot',id:'shot-2'}}),
   node('node-img','image',{title:'小明 · 正式图片',src:'data:image/png;base64,AAAA',mediaId:'media-1',x:700,storyImageRef:{assetId:'asset-ming',versionId:'v1'}}),
   node('node-manual','text',{title:'手记',text:'用户手工内容',y:700}),
   node('node-scene','scene',{title:'手工场景',text:'用户手放的场景',y:700,x:700})
  ],
  edges:[{from:'node-manual',to:'node-scene'}],
  workstation:{script:SCRIPT,story,writing:{brief:'基调：克制',skill:'shots',artDirection:'写实电影感'},creativeTasks:[]}};
}
const modelShot=(over={})=>({scene:'巷口',characters:['小明'],description:'小明停在巷口，抬头。',dialogue:'就是这里。',duration:2.5,shotSize:'近景',cameraMovement:'缓推',...over});
const modelAsset=(over={})=>({kind:'character',name:'小明',description:'主角少年',prompt:'少年，蓝外套，写实定稿',shotIds:['shot-1'],...over});
// 模型总会试图夹带画布/图片字段；软件必须全部剥除。
const inject=rows=>rows.map(r=>({...r,canvasNodeId:'node-evil',imageVersions:[{id:'evil',mediaId:'evil'}],mediaId:'evil',selectedImageId:'evil'}));
const storyboardRequest=async()=>({shots:inject([modelShot(),modelShot({scene:'屋顶',description:'屋顶上阿蓝回头。',dialogue:'你来了。'})])});
const assetsRequest=async body=>({assets:inject([modelAsset({shotIds:[body.shots[0].id]}),modelAsset({kind:'scene',name:'巷口',description:'老城巷口',prompt:'老城巷口，傍晚暖光',shotIds:[body.shots.at(-1).id]})])});
const twoStepRequest=(first=storyboardRequest,second=assetsRequest)=>{
 const bodies=[];
 return {bodies,request:async body=>{bodies.push(body);return bodies.length===1?first(body):second(body);}};
};
async function readyStoryTask(project,first=storyboardRequest){
 const task=createCreativeTask(project,{flow:'story-package',prompt:'拆成 2 个分镜并整理资产'});
 const {request}=twoStepRequest(first);
 await runCreativeTask(task,request);
 return task;
}

test('createCreativeTask 校验剧本、流程与精确 selection，快照不含图片/版本/画布字段',()=>{
 const p=makeProject();
 assert.throws(()=>createCreativeTask(p,{flow:'chat',prompt:'你好'}),/未知的创作任务类型/);
 assert.throws(()=>createCreativeTask({...p,workstation:{...p.workstation,script:''}},{flow:'story-package',prompt:'拆分镜'}),/剧本文稿/);
 assert.throws(()=>createCreativeTask(p,{flow:'story-package',prompt:'  '}),/创作要求/);
 assert.throws(()=>createCreativeTask(p,{flow:'selection-rewrite',prompt:'改写',selection:{start:0,end:6,text:'XXXXXX'}}),/选中文字/);
 const good=createCreativeTask(p,{flow:'selection-rewrite',prompt:'更口语',selection:{start:0,end:3,text:SCRIPT.slice(0,3)},sourceNodeId:'node-shot-1'});
 assert.equal(good.status,'queued');
 assert.deepEqual(good.steps.map(s=>[s.id,s.status]),[['rewrite','queued']]);
 assert.equal(good.sourceNodeId,'node-shot-1');
 assert.equal(good.snapshot.script,SCRIPT);
 assert.ok(!JSON.stringify(good.snapshot).includes('imageVersions')&&!JSON.stringify(good.snapshot).includes('canvasNodeId'));
 assert.equal(good.snapshot.skill,'shots');
 const pack=createCreativeTask(p,{flow:'story-package',prompt:'拆分镜'});
 assert.deepEqual(pack.steps.map(s=>s.label),['分镜','资产提示词']);
 assert.equal(pack.selection,null);
 assert.equal(pack.skillVersion,'1');
});

test('creativeSourceSignature 覆盖策划内容，排除版本/画布/任务等界面状态',()=>{
 const p=makeProject(),sig=creativeSourceSignature(p);
 p.workstation.story.versions=[{id:'v9',createdAt:1,label:'手动',script:'x',shots:[],assets:[]}];
 p.workstation.creativeTasks=[{id:'t1'}];
 p.nodes[0].x=999;
 p.workstation.story.shots[0].canvasNodeId='node-moved';
 assert.equal(creativeSourceSignature(p),sig);
 delete p.workstation.story.shots[0].canvasNodeId;
 assert.equal(creativeSourceSignature(p),sig);
 const changed=[
  {...p,workstation:{...p.workstation,script:SCRIPT+'（新结尾）'}},
  {...p,workstation:{...p.workstation,story:{...p.workstation.story,shots:p.workstation.story.shots.map((s,i)=>i?s:{...s,description:'改动了。'})}}},
  {...p,workstation:{...p.workstation,story:{...p.workstation.story,assets:p.workstation.story.assets.map(a=>a.id==='asset-hand'?{...a,description:'手工改'}:a)}}},
  {...p,workstation:{...p.workstation,writing:{...p.workstation.writing,brief:'新的基调'}}},
  {...p,workstation:{...p.workstation,writing:{...p.workstation.writing,skill:'general'}}},
  {...p,workstation:{...p.workstation,writing:{...p.workstation.writing,artDirection:'水墨'}}},
  {...p,id:'proj-2'}];
 for(const c of changed)assert.notEqual(creativeSourceSignature(c),sig);
 // 图片版本与画布引用变化不算来源变化。
 const withImage=makeProject();
 withImage.workstation.story.assets[0].imageVersions.push({id:'v2',mediaId:'media-2',name:'新图',mime:'image/jpeg',size:2000,width:32,height:32,createdAt:2});
 withImage.workstation.story.assets[0].selectedImageId='v2';
 assert.equal(creativeSourceSignature(withImage),creativeSourceSignature(makeProject()));
});

test('runCreativeTask story-package 成功：不改工程、变化镜头使用新 ID、候选剥除模型夹带字段',async()=>{
 const p=makeProject(),before=structuredClone(p);
 const task=createCreativeTask(p,{flow:'story-package',prompt:'按剧本拆成 2 个分镜'});
 const {bodies,request}=twoStepRequest();
 const events=[];
 const out=await runCreativeTask(task,request,{onChange:changed=>events.push(changed.status)});
 assert.equal(out.status,'ready');
 assert.deepEqual(out.steps.map(s=>s.status),['done','done']);
 assert.ok(out.candidate.shots.every(s=>!['shot-1','shot-2'].includes(s.id)));
 assert.ok(out.candidate.shots.every(s=>!s.canvasNodeId));
 for(const a of out.candidate.assets)assert.ok(!a.canvasNodeId&&!a.imageVersions&&!a.mediaId&&!a.selectedImageId);
 assert.deepEqual(p,before);
 assert.equal(bodies[0].kind,'storyboard');
 assert.equal(bodies[0].prompt,'按剧本拆成 2 个分镜');
 assert.equal(bodies[0].script,SCRIPT);
 assert.equal(bodies[1].kind,'assets');
 assert.deepEqual(bodies[1].shots.map(s=>s.id),out.candidate.shots.map(s=>s.id));
 assert.match(bodies[0].brief,/写实电影感/);assert.match(bodies[1].brief,/写实电影感/);
 assert.deepEqual(new Set(out.candidate.assets.map(a=>a.name)),new Set(['巷口','小明']));
 assert.ok(events.length>=3);
});

test('第一步失败不执行第二步，错误进 message 不自动重试',async()=>{
 const p=makeProject();
 const task=createCreativeTask(p,{flow:'story-package',prompt:'拆分镜'});
 const {bodies,request}=twoStepRequest(async()=>{throw Error('模型超时');});
 const out=await runCreativeTask(task,request);
 assert.equal(out.status,'failed');
 assert.equal(out.message,'模型超时');
 assert.equal(out.candidate,null);
 assert.equal(bodies.length,1);
 assert.deepEqual(out.steps.map(s=>s.status),['failed','skipped']);
});

test('请求前已中止直接取消，不发起任何请求',async()=>{
 const p=makeProject();
 const task=createCreativeTask(p,{flow:'story-package',prompt:'拆分镜'});
 const bodies=[];
 const out=await runCreativeTask(task,async body=>{bodies.push(body);return storyboardRequest();},{signal:AbortSignal.abort()});
 assert.equal(out.status,'canceled');
 assert.equal(bodies.length,0);
 assert.deepEqual(out.steps.map(s=>s.status),['canceled','skipped']);
});

test('取消后的迟到响应不能把任务变成 ready，也不会触发第二步',async()=>{
 const p=makeProject();
 const task=createCreativeTask(p,{flow:'story-package',prompt:'拆分镜'});
 const bodies=[];let release;
 const request=body=>new Promise(resolve=>{bodies.push(body);release=resolve;});
 const controller=new AbortController();
 const running=runCreativeTask(task,request,{signal:controller.signal});
 await new Promise(r=>setTimeout(r,0));
 assert.equal(task.status,'running');
 controller.abort();
 release({shots:[modelShot(),modelShot()]}); // 迟到的成功响应
 const out=await running;
 assert.equal(out.status,'canceled');
 assert.equal(out.candidate,null);
 assert.equal(bodies.length,1);
 assert.deepEqual(out.steps.map(s=>s.status),['canceled','skipped']);
});

test('模型资产非法时任务失败：重名、未知镜头引用、空资产、分镜结构错误',async()=>{
 const p=makeProject();
 const cases=[
  [async()=>({shots:inject([modelShot(),modelShot()])}),async body=>({assets:inject([modelAsset({shotIds:[body.shots[0].id]}),modelAsset({description:'同名重复',prompt:'x',shotIds:[]})])}),/名称重复/],
  [async()=>({shots:inject([modelShot(),modelShot()])}),async()=>({assets:inject([modelAsset({shotIds:['shot-999']})])}),/未知镜头/],
  [async()=>({shots:inject([modelShot(),modelShot()])}),async()=>({assets:[]}),/资产数量/],
  [async()=>({shots:[{scene:'巷口'}]}),async()=>({assets:inject([modelAsset()])}),/分镜缺少|数据结构/]
 ];
 for(const [first,second,matcher] of cases){
  const task=createCreativeTask(p,{flow:'story-package',prompt:'拆分镜'});
  const {request}=twoStepRequest(first,second);
  const out=await runCreativeTask(task,request);
  assert.equal(out.status,'failed');
  assert.match(out.message,matcher);
 }
});

test('prepareCreativeAdoption 整包采用：原工程不变、相同镜头 ID/画布节点复用、图片与手工内容保留',async()=>{
 const p=makeProject();
 p.nodes.push({id:'node-script',type:'text',title:'剧本',text:SCRIPT,x:60,y:1400,w:320,storyRef:{kind:'script',id:'main-script'}});
 const task=await readyStoryTask(p,async()=>({shots:inject(p.workstation.story.shots)}));
 p.workstation.creativeTasks=[task];
 const before=structuredClone(p);
 const copy=prepareCreativeAdoption(p,task);
 assert.deepEqual(p,before); // 未采用成功前绝不改原工程
 assert.equal(task.status,'ready'); // 模块不改传入 task，由调用方同步
 const ws=copy.workstation;
 assert.deepEqual(ws.story.shots.map(s=>s.id),['shot-1','shot-2']);
 assert.ok(ws.story.shots.every(s=>s.canvasNodeId==='node-shot-1'||s.canvasNodeId==='node-shot-2'||!s.canvasNodeId));
 const ming=ws.story.assets.find(a=>a.name==='小明');
 assert.equal(ming.id,'asset-ming'); // 同名合并保留既有 ID
 assert.equal(ming.prompt,'少年，蓝外套，写实定稿');
 assert.equal(ming.imageVersions.length,1);
 assert.equal(ming.selectedImageId,'v1');
 const alley=ws.story.assets.find(a=>a.name==='巷口');
 assert.ok(alley&&alley.id!=='asset-ming');
 assert.deepEqual(alley.shotIds,['shot-2']); // 新资产只关联候选镜头
 assert.ok(ws.story.assets.some(a=>a.id==='asset-hand'&&a.prompt==='')); // 手工资产原样保留
 const node=copy.nodes.find(n=>n.id==='node-img');
 assert.ok(node&&node.src==='data:image/png;base64,AAAA'&&node.mediaId==='media-1');
 const manual=copy.nodes.find(n=>n.id==='node-manual');
 assert.ok(manual&&manual.text==='用户手工内容');
 assert.ok(copy.edges.some(e=>e.from==='node-manual'&&e.to==='node-scene'));
 assert.ok(copy.nodes.some(n=>n.id==='node-scene'));
 assert.equal(ws.story.versions.length,1); // 整包采用只记一次快照
 assert.ok(ws.workflow.scriptForShots&&ws.workflow.sourceForAssets);
 // 候选镜头全部建立画布节点并带来源标记
 for(const s of ws.story.shots)assert.ok(copy.nodes.some(n=>n.id===s.canvasNodeId&&n.storyRef?.kind==='shot'&&n.storyRef.id===s.id));
 // 副本中的任务记录已采用并清空候选，重复采用被拒绝
 const record=ws.creativeTasks.find(t=>t.id===task.id);
 assert.equal(record.status,'adopted');
 assert.equal(record.candidate,null);
 assert.equal(record.snapshot.script,'');
 assert.throws(()=>prepareCreativeAdoption(copy,record),/已采用过/);
 // 调用方同步副本后，旧任务对象再采用会因来源变化被拒绝
 p.workstation=copy.workstation;p.nodes=copy.nodes;p.edges=copy.edges;
 assert.throws(()=>prepareCreativeAdoption(p,task),/过期|已采用/);
});

test('采用后来源过期或跨工程一律拒绝',async()=>{
 const p=makeProject();
 const task=await readyStoryTask(p);
 p.workstation.creativeTasks=[structuredClone(task)];
 const stale=structuredClone(p);
 stale.workstation.script=SCRIPT+'\n新段落';
 assert.throws(()=>prepareCreativeAdoption(stale,task),/过期/);
 const other=structuredClone(p);
 other.id='proj-2';
 assert.throws(()=>prepareCreativeAdoption(other,task),/不属于当前工程/);
 assert.throws(()=>prepareCreativeAdoption(p,{...task,status:'running'}),/尚未完成/);
});

test('分镜缩减时：删除镜头的旧系统节点保留但摘除 storyRef，资产引用被清理',async()=>{
 const p=makeProject();
 const task=createCreativeTask(p,{flow:'story-package',prompt:'只保留第一个镜头'});
 const {request}=twoStepRequest(async()=>({shots:inject([p.workstation.story.shots[0]])}),async body=>({assets:inject([modelAsset({shotIds:[body.shots[0].id]})])}));
 await runCreativeTask(task,request);
 p.workstation.creativeTasks=[task];
 const copy=prepareCreativeAdoption(p,task);
 const ws=copy.workstation.story;
 assert.deepEqual(ws.shots.map(s=>s.id),['shot-1']);
 const orphan=copy.nodes.find(n=>n.id==='node-shot-2');
 assert.ok(orphan); // 不能删用户可见内容
 assert.ok(!orphan.storyRef);
 for(const a of ws.assets)assert.ok(a.shotIds.every(id=>id==='shot-1'||!ws.shots.length||ws.shots.some(s=>s.id===id)));
 assert.equal(ws.assets.find(a=>a.id==='asset-hand').shotIds.length,0);
});

test('selection-rewrite 运行与采用：只替换选中范围，超长文本在生成期被拒绝',async()=>{
 const p=makeProject();
 p.nodes.push({id:'node-script',type:'text',title:'剧本',text:SCRIPT,x:60,y:1400,w:320,storyRef:{kind:'script',id:'main-script'}});
 const sel={start:SCRIPT.indexOf('小明'),end:SCRIPT.indexOf('小明')+2,text:SCRIPT.slice(SCRIPT.indexOf('小明'),SCRIPT.indexOf('小明')+2)};
 assert.equal(SCRIPT.slice(sel.start,sel.end),sel.text);
 const task=createCreativeTask(p,{flow:'selection-rewrite',prompt:'更口语',selection:sel});
 const bodies=[];
 const out=await runCreativeTask(task,async body=>{bodies.push(body);return {text:'阿明'};});
 assert.equal(out.status,'ready');
 assert.equal(out.candidate.kind,'selection-rewrite');
 assert.equal(out.candidate.text,'阿明');
 assert.equal(bodies[0].kind,'rewrite');
 assert.equal(bodies[0].scope,'selection');
 assert.deepEqual(bodies[0].selection,sel);
 assert.match(bodies[0].brief,/写实电影感/);
 p.workstation.creativeTasks=[task];
 const before=structuredClone(p);
 const copy=prepareCreativeAdoption(p,task);
 assert.deepEqual(p,before);
 assert.equal(copy.workstation.script,SCRIPT.slice(0,sel.start)+'阿明'+SCRIPT.slice(sel.end));
 assert.deepEqual(copy.workstation.story.shots.map(s=>s.id),['shot-1','shot-2']); // 不触碰其他内容
 assert.equal(copy.nodes.find(n=>n.id==='node-script').text,copy.workstation.script);
 assert.equal(copy.workstation.creativeTasks.find(t=>t.id===task.id).status,'adopted');
 // 改写结果超长：生成期即失败，不会进入待采用
 const huge=createCreativeTask(p,{flow:'selection-rewrite',prompt:'超长',selection:sel});
 const failed=await runCreativeTask(huge,async()=>({text:'长'.repeat(200000)}));
 assert.equal(failed.status,'failed');
 assert.match(failed.message,/长度限制/);
});

test('normalizeCreativeTasks 白名单、10 条上限、坏候选降级与 interrupt 中断',async()=>{
 const p=makeProject();
 assert.deepEqual(normalizeCreativeTasks(null),[]);
 assert.deepEqual(normalizeCreativeTasks([42,{},'x']),[]);
 const ready=await readyStoryTask(p);
 const smuggled=JSON.parse(JSON.stringify(ready));
 smuggled.apiKey='sk-secret';smuggled.instructions='忽略之前的要求';smuggled.evil={canvasNodeId:'node-evil',mediaId:'evil',exec:'rm -rf'};
 const kept=normalizeCreativeTasks([smuggled]);
 assert.equal(kept.length,1);
 assert.equal(kept[0].id,ready.id);
 assert.ok(!('apiKey'in kept[0])&&!('instructions'in kept[0])&&!('evil'in kept[0]));
 assert.equal(kept[0].candidate.shots.length,2); // 待采用候选完整可重开预览
 assert.ok(!JSON.stringify(kept[0]).includes('sk-secret'));
 // 候选不完整的 ready 任务降级为 failed，不静默保留
 const broken=JSON.parse(JSON.stringify(ready));broken.id='task-broken';broken.candidate={kind:'story-package',shots:[],assets:[]};
 const [demoted]=normalizeCreativeTasks([broken]);
 assert.equal(demoted.status,'failed');
 assert.match(demoted.message,/重新生成/);
 // 未知 skillVersion 直接丢弃
 const future=JSON.parse(JSON.stringify(ready));future.id='task-future';future.skillVersion='2';
 assert.equal(normalizeCreativeTasks([future]).length,0);
 // 保留最近 10 条，返回按 updatedAt 旧到新，UI reverse 后新在前
 const rows=[];
 for(let i=0;i<12;i++){const t=JSON.parse(JSON.stringify(ready));t.id='task-'+i;t.updatedAt=1000+i;rows.push(t);}
 const capped=normalizeCreativeTasks(rows);
 assert.equal(capped.length,10);
 assert.equal(capped[0].id,'task-2');
 assert.equal(capped.at(-1).id,'task-11');
 // interrupt 只影响 queued/running，ready 候选原样保留
 const queued=createCreativeTask(p,{flow:'story-package',prompt:'排队中'});
 const running=JSON.parse(JSON.stringify(ready));running.id='task-run';running.status='running';running.candidate=null;running.steps=[{id:'storyboard',label:'分镜',status:'running'},{id:'assets',label:'资产提示词',status:'queued'}];
 const interrupted=normalizeCreativeTasks([queued,running,ready],{interrupt:true});
 assert.equal(interrupted.find(t=>t.id===queued.id).status,'interrupted');
 const runRow=interrupted.find(t=>t.id==='task-run');
 assert.equal(runRow.status,'interrupted');
 assert.deepEqual(runRow.steps.map(s=>s.status),['interrupted','interrupted']);
 const readyRow=interrupted.find(t=>t.id===ready.id);
 assert.equal(readyRow.status,'ready');
 assert.equal(readyRow.candidate.shots.length,2);
 // 正常序列化保留 queued/running 原状
 const calm=normalizeCreativeTasks([queued,running]);
 assert.equal(calm.find(t=>t.id===queued.id).status,'queued');
 assert.equal(calm.find(t=>t.id==='task-run').status,'running');
 // selection-rewrite 的 ready 候选与精确 selection 一起保留
 const p2=makeProject();
 const sel={start:0,end:3,text:SCRIPT.slice(0,3)};
 const rewrite=createCreativeTask(p2,{flow:'selection-rewrite',prompt:'改写',selection:sel});
 await runCreativeTask(rewrite,async()=>({text:'EXT 改写'}));
 const [keptRewrite]=normalizeCreativeTasks([JSON.parse(JSON.stringify(rewrite))]);
 assert.equal(keptRewrite.candidate.text,'EXT 改写');
 assert.deepEqual(keptRewrite.selection,sel);
});

test('取消后的任务可手动重试并成功完成',async()=>{
 const p=makeProject();
 const task=createCreativeTask(p,{flow:'story-package',prompt:'拆分镜'});
 const bodies=[];let release;
 const first=runCreativeTask(task,body=>new Promise(resolve=>{bodies.push(body);release=resolve;}));
 await new Promise(r=>setTimeout(r,0));
 task.status='canceled'; // 外部取消（UI 直接改状态）
 release({shots:[modelShot()]}); // 模拟响应迟到，不让等待中的请求悬挂
 const stopped=await first;
 assert.equal(stopped.status,'canceled');
 const {request}=twoStepRequest();
 const retry=createCreativeTask(p,{flow:task.flow,prompt:task.prompt});
 const redone=await runCreativeTask(retry,request); // 明确新建重试任务
 assert.equal(redone.status,'ready');
 assert.deepEqual(redone.steps.map(s=>s.status),['done','done']);
 assert.ok(redone.candidate.assets.length);
});

test('前插镜头按语义保留原镜头 ID，不误绑定资产、图片或手工连线',async()=>{
 const p=makeProject(),originalShots=structuredClone(p.workstation.story.shots);
 p.edges.push({from:'node-img',to:'node-shot-1'},{from:'node-manual',to:'node-shot-2'});
 const before=structuredClone(p),task=createCreativeTask(p,{flow:'story-package',prompt:'最前面增加一个空镜，保留原有两个镜头'});
 const {request}=twoStepRequest(async()=>({shots:inject([modelShot({scene:'天空',characters:[],description:'空镜：晚霞缓缓流动。',dialogue:''}),...originalShots])}),async body=>({assets:[modelAsset({kind:'scene',name:'晚霞天空',description:'新增空镜场景',prompt:'暮色中的晚霞天空',shotIds:[body.shots[0].id]})]}));
 await runCreativeTask(task,request);assert.equal(task.status,'ready');
 assert.deepEqual(task.candidate.shots.slice(1).map(s=>s.id),['shot-1','shot-2']);
 const newId=task.candidate.shots[0].id;assert.ok(!['shot-1','shot-2'].includes(newId));
 p.workstation.creativeTasks=[task];const copy=prepareCreativeAdoption(p,task);
 assert.deepEqual(copy.workstation.story.shots.map(s=>s.id),[newId,'shot-1','shot-2']);
 assert.equal(copy.workstation.story.shots[1].canvasNodeId,'node-shot-1');
 assert.equal(copy.workstation.story.shots[2].canvasNodeId,'node-shot-2');
 assert.notEqual(copy.workstation.story.shots[0].canvasNodeId,'node-shot-1');
 const originalMing=before.workstation.story.assets.find(a=>a.id==='asset-ming');
 const ming=copy.workstation.story.assets.find(a=>a.id==='asset-ming');
 assert.deepEqual(ming.shotIds,['shot-1']);assert.deepEqual(ming.imageVersions,originalMing.imageVersions);assert.equal(ming.selectedImageId,originalMing.selectedImageId);
 assert.ok(!copy.workstation.story.shots[0].assetIds.includes('asset-ming'));
 assert.deepEqual(copy.nodes.find(n=>n.id==='node-img'),before.nodes.find(n=>n.id==='node-img'));
 for(const edge of before.edges)assert.ok(copy.edges.some(e=>e.from===edge.from&&e.to===edge.to));
 for(const id of ['node-shot-1','node-shot-2']){const old=before.nodes.find(n=>n.id===id),node=copy.nodes.find(n=>n.id===id);assert.equal(node.x,old.x);assert.equal(node.y,old.y);}
 assert.equal(copy.workstation.story.versions.length,1);
});

test('discarded 状态与清空候选可持久化，重启后不会变失败或重新出现候选',async()=>{
 const p=makeProject(),task=await readyStoryTask(p);
 task.status='discarded';task.candidate=null;task.message='已丢弃候选';task.updatedAt=Date.now();
 const rows=normalizeCreativeTasks(JSON.parse(JSON.stringify([task])),{interrupt:true});
 assert.equal(rows.length,1);assert.equal(rows[0].status,'discarded');assert.equal(rows[0].candidate,null);assert.equal(rows[0].message,'已丢弃候选');
 assert.throws(()=>prepareCreativeAdoption({...p,workstation:{...p.workstation,creativeTasks:rows}},rows[0]),/尚未完成|丢弃/);
});

test('仅严格相同镜头语义可复用 ID，任一字段变化都分配新 ID',async()=>{
 const patches=[{scene:'新场景'},{characters:['阿蓝']},{description:'全新动作。'},{dialogue:'新对白'},{duration:8},{shotSize:'特写'},{cameraMovement:'固定'}];
 for(const patch of patches){
  const p=makeProject(),task=createCreativeTask(p,{flow:'story-package',prompt:'修改第一镜头，第二镜头不变'});
  const {request}=twoStepRequest(async()=>({shots:[{...p.workstation.story.shots[0],...patch},p.workstation.story.shots[1]]}));
  await runCreativeTask(task,request);assert.equal(task.status,'ready');
  assert.notEqual(task.candidate.shots[0].id,'shot-1',Object.keys(patch)[0]);
  assert.equal(task.candidate.shots[1].id,'shot-2');
 }
});

test('画布节点超限时整包采用原子失败，不改工程和任务状态',async()=>{
 const p=makeProject(),task=await readyStoryTask(p);
 while(p.nodes.length<499)p.nodes.push({id:'manual-'+p.nodes.length,type:'text',title:'手记',text:'保留我',x:0,y:0,w:320});
 p.workstation.creativeTasks=[task];const before=structuredClone(p);
 assert.throws(()=>prepareCreativeAdoption(p,task),/500|上限/);
 assert.deepEqual(p,before);assert.equal(task.status,'ready');
});

test('node-scoped production snapshots the actual node body and survives normalization',async()=>{
 const p=makeProject(),before=structuredClone(p),task=createCreativeTask(p,{flow:'story-package',sourceScope:'node',sourceNodeId:'node-manual',prompt:'拆成两个镜头'});
 assert.equal(task.snapshot.script,'用户手工内容');assert.deepEqual(task.snapshot.shots,[]);assert.deepEqual(task.snapshot.assets,[]);
 const {request,bodies}=twoStepRequest();await runCreativeTask(task,request);
 assert.equal(bodies[0].script,'用户手工内容');assert.equal(bodies[1].script,'用户手工内容');
 const [restored]=normalizeCreativeTasks(JSON.parse(JSON.stringify([task])));
 assert.equal(restored.sourceScope,'node');assert.equal(restored.sourceTitle,'手记');assert.equal(restored.snapshot.script,'用户手工内容');
 p.workstation.creativeTasks=[restored];const copy=prepareCreativeAdoption(p,restored);
 assert.equal(copy.workstation.script,before.workstation.script,'planning adoption never promotes a node into the project script');
 assert.equal(copy.nodes.find(n=>n.id==='node-manual').text,'用户手工内容');
 assert.ok(copy.edges.some(e=>e.from==='node-manual'&&e.creativeSourceLink));assert.deepEqual(p.nodes,before.nodes);
});

test('node rewrite changes only that node, and late adoption refuses a deleted or edited source',async()=>{
 const p=makeProject(),node=p.nodes.find(n=>n.id==='node-manual'),selection={start:0,end:node.text.length,text:node.text};
 const task=createCreativeTask(p,{flow:'selection-rewrite',sourceScope:'node',sourceNodeId:node.id,prompt:'精简',selection});
 await runCreativeTask(task,async body=>{assert.equal(body.script,'用户手工内容');return {text:'精简手记'};});
 p.workstation.creativeTasks=[task];const before=structuredClone(p),copy=prepareCreativeAdoption(p,task);
 assert.equal(copy.nodes.find(n=>n.id===node.id).text,'精简手记');assert.equal(copy.workstation.script,p.workstation.script);
 assert.deepEqual(copy.workstation.story,p.workstation.story);assert.deepEqual(p,before);
 node.text='已经改动';assert.throws(()=>prepareCreativeAdoption(p,task),/变化|过期/);
 p.nodes=p.nodes.filter(n=>n.id!==node.id);assert.throws(()=>prepareCreativeAdoption(p,task),/节点已删除/);
});

test('an empty project script does not prevent an explicit populated node source; absent nodes never fall back',()=>{
 const p=makeProject();p.workstation.script='';
 assert.equal(createCreativeTask(p,{flow:'story-package',sourceScope:'node',sourceNodeId:'node-manual',prompt:'拆分镜'}).snapshot.script,'用户手工内容');
 assert.throws(()=>createCreativeTask(p,{flow:'story-package',sourceScope:'node',sourceNodeId:'missing',prompt:'拆分镜'}),/节点已删除/);
 assert.throws(()=>createCreativeTask(p,{flow:'selection-rewrite',sourceScope:'node',sourceNodeId:'node-shot-1',prompt:'改写',selection:{start:0,end:1,text:'小'}}),/对应面板修改/);
});
