import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {starterProject} from '../src/model.mjs';
class Surface{
 constructor(){this.isConnected=true;this.elements=new Map();this.events=new Map();this.value='';this.scrollHeight=100;}
 set innerHTML(v){this.html=v;this.elements.clear();}get innerHTML(){return this.html;}
 querySelector(key){if(!this.elements.has(key)){const el=new Surface();el.selector=key;el.dataset={};const match=key.match(/data-director="([^"]+)"/);if(match)el.dataset.director=match[1];this.elements.set(key,el);}return this.elements.get(key);}
 contains(el){return [...this.elements.values()].includes(el);}
 matches(selector){return this.selector===selector;}
 focus(){globalThis.document={activeElement:this};}
 setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
 addEventListener(name,fn){this.events.set(name,fn);}
}
let serial=0;
async function fixture(){
 const key='directorPanelTest'+(++serial),f={calls:[],pending:[],adoptions:0};globalThis[key]=f;
 let source=await readFile(new URL('../src/workstation/director-panel.mjs',import.meta.url),'utf8');
 source=source.replace("'./director-agent.mjs'",JSON.stringify(new URL('../src/workstation/director-agent.mjs',import.meta.url).href)).replace("'./director-state.mjs'",JSON.stringify(new URL('../src/workstation/director-state.mjs',import.meta.url).href));
 source=source.replace(/^import .*text-settings.mjs';$/m,`const f=globalThis[${JSON.stringify(key)}];const esc=String;const showTextSettings=async()=>{};const textPost=async(_path,body,opts)=>{f.calls.push({body,signal:opts.signal});return new Promise(resolve=>f.pending.push(resolve));};`).replace(/^import .*css';$/m,'');
 const {createDirectorPanel}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 let p=starterProject();p.workstation={directorAssistant:{messages:[],candidate:null}};const root=new Surface();
 const ctx={project:()=>p,persist(){},readDirectorContext:async()=>({}),captureDirectorFrames:async()=>[{image:'test-image',time:0,label:'镜头'}],directorClipCatalog:()=>({}),adoptDirectorPlan(){f.adoptions++;return {};},previewDirectorPlan:async()=>[]};
 const panel=createDirectorPanel(ctx);panel.mount(root);
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 const click=async key=>{root.querySelector(`[data-director="${key}"]`).events.get('click')();await flush();};
 const send=async()=>{const input=root.querySelector('textarea');input.value='摄影机改为蓝色';input.oninput();await click('send');};
 const reply=()=>({message:'已准备',operations:[{tool:'color',objectId:p.objects[0].id,color:'#0088ff',time:0}],warnings:[]});
 return {f,root,panel,ctx,flush,click,send,reply,project:()=>p,switch(next){p=next;panel.onProjectChanged();},cleanup(){delete globalThis[key];}};
}
test('director cancellation rejects a late API result without creating a candidate',async()=>{const x=await fixture();try{await x.send();assert.equal(x.f.calls.length,1);await x.click('cancel');assert.equal(x.f.calls[0].signal.aborted,true);x.f.pending.shift()(x.reply());await x.flush();assert.equal(x.project().workstation.directorAssistant.candidate,null);}finally{x.cleanup();}});
test('director project switch rejects a late reply even when the project ID is retained',async()=>{const x=await fixture();try{await x.send();const next=structuredClone(x.project());next.workstation.directorAssistant.messages=[];x.switch(next);x.f.pending.shift()(x.reply());await x.flush();assert.equal(next.workstation.directorAssistant.candidate,null);assert.deepEqual(next.workstation.directorAssistant.messages,[]);}finally{x.cleanup();}});
test('director adoption requires completed local preview and exposes its decision outside scrolling chat',async()=>{const x=await fixture();try{await x.send();x.f.pending.shift()(x.reply());await x.flush();assert.ok(x.project().workstation.directorAssistant.candidate);await x.click('adopt');assert.equal(x.f.adoptions,0);assert.match(x.root.innerHTML,/<div class="director-decision">/);await x.click('preview');await x.click('adopt');assert.equal(x.f.adoptions,1);assert.equal(x.project().workstation.directorAssistant.candidate,null);}finally{x.cleanup();}});

test('visual capture is sent with the plan, while image state is not persisted',async()=>{const x=await fixture();try{await x.send();assert.equal(x.f.calls[0].body.frames[0].image,'test-image');assert.ok(!JSON.stringify(x.project().workstation.directorAssistant).includes('test-image'));}finally{x.panel.cancel();x.cleanup();}});
test('switching or canceling while screenshots are pending never sends them to the model',async()=>{const x=await fixture();try{let finish;x.ctx.captureDirectorFrames=()=>new Promise(resolve=>finish=resolve);await x.send();assert.equal(x.f.calls.length,0);await x.click('cancel');finish([{image:'late-image',time:0}]);await x.flush();assert.equal(x.f.calls.length,0);}finally{x.cleanup();}});
test('AI review merges corrections, re-previews locally, and does not apply until adopted',async()=>{const x=await fixture();try{
 const id=x.project().objects[0].id;let previewCount=0;x.ctx.previewDirectorPlan=async()=>{previewCount++;return [{time:0,label:'镜头',before:'before-image',after:'after-image'}];};let requestCandidate=null;x.ctx.readDirectorContext=async options=>{requestCandidate=options?.candidate;return {};};
 await x.send();x.f.pending.shift()(x.reply());await x.flush();await x.click('preview');await x.click('review');assert.ok(requestCandidate);assert.equal(x.f.calls[1].body.kind,'director-review');assert.deepEqual(x.f.calls[1].body.frames.map(f=>f.phase),['before','after']);
 x.f.pending.shift()({message:'摄影机应向右半米',operations:[{tool:'move',objectId:id,time:0,offset:[.5,0,0]}],warnings:[]});await x.flush();assert.equal(previewCount,2);assert.equal(x.project().workstation.directorAssistant.candidate.plan.operations.length,2);assert.equal(x.f.adoptions,0);await x.click('adopt');assert.equal(x.f.adoptions,1);
 }finally{x.cleanup();}});
test('canceling a late visual review preserves the original candidate',async()=>{const x=await fixture();try{x.ctx.previewDirectorPlan=async()=>[{time:0,before:'before',after:'after'}];await x.send();x.f.pending.shift()(x.reply());await x.flush();await x.click('preview');const before=structuredClone(x.project().workstation.directorAssistant.candidate);await x.click('review');await x.click('cancel');x.f.pending.shift()({message:'late',operations:[],warnings:[]});await x.flush();assert.deepEqual(x.project().workstation.directorAssistant.candidate,before);}finally{x.cleanup();}});


test('a candidate can be refined through conversation without mutating the project or reusing its old preview',async()=>{const x=await fixture();try{
 const before=structuredClone(x.project().objects),id=x.project().objects[0].id;let seenCandidate=null;
 x.ctx.previewDirectorPlan=async()=>[{time:0,before:'before',after:'candidate-after'}];
 x.ctx.readDirectorContext=async options=>{seenCandidate=options?.candidate;return {candidate:!!seenCandidate};};
 await x.send();x.f.pending.shift()(x.reply());await x.flush();await x.click('preview');
 assert.match(x.root.innerHTML,/微调方案/);assert.match(x.root.innerHTML,/对白模导演说出要求/);
 const input=x.root.querySelector('textarea');input.value='再向右半米';input.oninput();await x.click('send');
 assert.ok(seenCandidate);assert.equal(x.f.calls[1].body.context.candidate,true);
 assert.equal(x.f.calls[1].body.frames[0].image,'candidate-after','refinement sees candidate screenshots, not the unchanged official scene');
 x.f.pending.shift()({message:'向右半米',operations:[{tool:'move',objectId:id,time:0,offset:[.5,0,0]}],warnings:[]});await x.flush();
 assert.equal(x.project().workstation.directorAssistant.candidate.plan.operations.length,2);
 assert.deepEqual(x.project().objects,before);assert.equal(x.f.adoptions,0);
 await x.click('adopt');assert.equal(x.f.adoptions,0,'a changed candidate needs a new local preview');
 await x.click('preview');await x.click('adopt');assert.equal(x.f.adoptions,1);
}finally{x.cleanup();}});

test('canceling a conversational refinement preserves the previous candidate and completed preview',async()=>{const x=await fixture();try{
 x.ctx.previewDirectorPlan=async()=>[{time:0,before:'before',after:'after'}];await x.send();x.f.pending.shift()(x.reply());await x.flush();await x.click('preview');
 const before=structuredClone(x.project().workstation.directorAssistant.candidate);
 await x.send();await x.click('cancel');x.f.pending.shift()(x.reply());await x.flush();
 assert.deepEqual(x.project().workstation.directorAssistant.candidate,before);
 await x.click('adopt');assert.equal(x.f.adoptions,1,'the canceled change does not invalidate the kept completed preview');
}finally{x.cleanup();}});

test('refresh preserves a draft, textarea focus and selection, and a scrolled-back conversation',async()=>{const x=await fixture();try{
 const input=x.root.querySelector('textarea');input.value='尚未发送的微调';input.oninput();input.selectionStart=2;input.selectionEnd=4;input.scrollTop=7;input.focus();
 const log=x.root.querySelector('.director-log');log.scrollTop=40;log.scrollHeight=1000;log.clientHeight=200;
 x.panel.refresh();const next=x.root.querySelector('textarea');
 assert.equal(next.value,'尚未发送的微调');assert.equal(globalThis.document.activeElement,next);assert.equal(next.selectionStart,2);assert.equal(next.selectionEnd,4);assert.equal(next.scrollTop,7);
 assert.equal(x.root.querySelector('.director-log').scrollTop,40,'incoming state must not pull a reader down to the end');
}finally{delete globalThis.document;x.cleanup();}});
