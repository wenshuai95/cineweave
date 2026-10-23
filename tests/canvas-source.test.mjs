import test from 'node:test';import assert from 'node:assert/strict';
import {ensureScriptNode,getScriptNode,syncCanonicalNodes,getCanvasStoryContext,editStoryNode,promoteTextToScript,connectScriptSources} from '../src/workstation/canvas-source.mjs';
import {sendStoryPackageToCanvas,sendStoryToCanvas} from '../src/workstation/story-canvas.mjs';
const project=()=>({nodes:[],edges:[],workstation:{script:'一人推门走入院子。',story:{shots:[{id:'s1',scene:'院子',characters:['甲'],description:'甲推门',dialogue:'有人吗？',duration:3,shotSize:'全景',cameraMovement:'固定',assetIds:['a1']}],assets:[{id:'a1',kind:'scene',name:'院子',description:'木门小院',prompt:'清晨的木门小院',shotIds:['s1']}]}}});
test('legacy project gets one script node without altering existing media or placing duplicates',()=>{
 const p=project();p.nodes.push({id:'manual',type:'text',title:'剧本',text:'我的笔记',x:1,y:2,w:320});
 const before=structuredClone(p.nodes[0]),script=ensureScriptNode(p);assert.equal(script.text,p.workstation.script);assert.deepEqual(script.storyRef,{kind:'script',id:'main-script'});
 Object.assign(script,{x:999,y:888,w:555,title:'我的剧本'});p.workstation.script='修改后的文稿';
 assert.equal(ensureScriptNode(p),script);assert.equal(p.nodes.length,2);assert.equal(script.text,'修改后的文稿');assert.deepEqual([script.x,script.y,script.w,script.title],[999,888,555,'我的剧本']);assert.deepEqual(p.nodes[0],before);
});
test('explicit empty script creation is allowed but synchronization does not create any nodes',()=>{
 const p=project();p.workstation.script='';assert.equal(syncCanonicalNodes(p),false);assert.equal(p.nodes.length,0);
 assert.equal(ensureScriptNode(p).text,'');assert.equal(p.nodes.length,1);
});
test('canonical script edits update source; shot summary cannot accidentally replace structured dialogue',()=>{
 const p=project();sendStoryPackageToCanvas(p);const script=getScriptNode(p),shot=p.nodes.find(n=>n.storyRef?.kind==='shot'),asset=p.nodes.find(n=>n.storyRef?.kind==='asset');
 editStoryNode(p,script.id,{text:'雨中，两人走进院落。',title:'雨夜'});assert.equal(p.workstation.script,script.text);assert.equal(script.title,'雨夜');
 const oldShot=structuredClone(p.workstation.story.shots[0]);assert.throws(()=>editStoryNode(p,shot.id,{text:'危险的摘要替换'}),/对应的分镜/);assert.deepEqual(p.workstation.story.shots[0],oldShot);
 editStoryNode(p,asset.id,{text:'深夜的院落',title:'雨夜院子'});assert.equal(p.workstation.story.assets[0].prompt,'深夜的院落');assert.equal(asset.title,'雨夜院子');
});
test('sync updates only bound planning text and leaves official image, manual nodes, and node geometry intact',()=>{
 const p=project();sendStoryPackageToCanvas(p);const shot=p.nodes.find(n=>n.storyRef?.kind==='shot');Object.assign(shot,{x:123,y:456,w:444});
 p.nodes.push({id:'image',type:'image',title:'正式图片',text:'原图提示词',src:'data:image/png;base64,aGVsbG8=',storyImageRef:{assetId:'a1',versionId:'v1'},x:1,y:2,w:320},{id:'manual',type:'text',title:'随手写',text:'保留',x:4,y:5,w:320});
 const preserved=structuredClone(p.nodes.slice(-2)),edges=structuredClone(p.edges);
 p.workstation.story.shots[0].description='甲站在门口';p.workstation.story.shots[0].dialogue='我回来了';p.workstation.story.assets[0].prompt='黄昏院落';
 assert.equal(syncCanonicalNodes(p),true);assert.match(shot.text,/甲站在门口/);assert.match(shot.text,/对白：我回来了/);assert.deepEqual([shot.x,shot.y,shot.w],[123,456,444]);assert.deepEqual(p.nodes.slice(-2),preserved);assert.deepEqual(p.edges,edges);assert.equal(syncCanonicalNodes(p),false);
});
test('node context resolves live source and image origin but refuses orphaned or malformed provenance',()=>{
 const p=project();sendStoryPackageToCanvas(p);const asset=p.nodes.find(n=>n.storyRef?.kind==='asset');assert.equal(getCanvasStoryContext(p,asset.id).asset,p.workstation.story.assets[0]);
 p.nodes.push({id:'img',type:'image',storyImageRef:{assetId:'a1',versionId:'v1'}});assert.deepEqual(Object.keys(getCanvasStoryContext(p,'img')).sort(),['asset','assetId','kind','node','record','versionId']);assert.equal(getCanvasStoryContext(p,'img').kind,'image');
 p.nodes.push({id:'bad',type:'text',storyRef:{kind:'asset',id:'../a1'}},{id:'orphan',type:'text',storyRef:{kind:'shot',id:'missing'}});assert.equal(getCanvasStoryContext(p,'bad'),null);assert.equal(getCanvasStoryContext(p,'orphan'),null);assert.equal(getCanvasStoryContext(p,'absent'),null);
});
test('promotion confirms source replacement and reuses existing canonical node without duplicate ownership',()=>{
 const p=project();const script=ensureScriptNode(p);p.nodes.push({id:'candidate',type:'text',title:'新稿',text:'第二版剧本',x:0,y:0,w:320});
 const before=structuredClone(p);assert.throws(()=>promoteTextToScript(p,'candidate'),/需要确认/);assert.deepEqual(p,before);
 assert.equal(promoteTextToScript(p,'candidate',{replaceConfirmed:true}),script);assert.equal(p.workstation.script,'第二版剧本');assert.equal(script.text,'第二版剧本');assert.equal(p.nodes.filter(n=>n.storyRef?.kind==='script').length,1);assert.equal(p.nodes.find(n=>n.id==='candidate').storyRef,undefined);
});
test('a blank project can promote a plain node in place even at capacity, but owned nodes cannot be promoted',()=>{
 const p=project();p.workstation.script='';p.nodes=Array.from({length:500},(_,i)=>({id:'n'+i,type:'text',title:'笔记',text:'新故事',x:0,y:0,w:320}));
 assert.equal(promoteTextToScript(p,'n0').id,'n0');assert.equal(p.nodes.length,500);assert.equal(p.workstation.script,'新故事');
 p.nodes[1].storyRef={kind:'shot',id:'s1'};assert.throws(()=>promoteTextToScript(p,'n1',{replaceConfirmed:true}),/普通文本/);
});
test('package includes script in capacity preflight and fails atomically before synchronizing anything',()=>{
 const p=project();p.nodes=Array.from({length:498},(_,i)=>({id:'n'+i,type:'text',title:'笔记',text:'保留',x:0,y:0,w:320}));const before=structuredClone(p);
 assert.throws(()=>sendStoryPackageToCanvas(p),/500/);assert.deepEqual(p,before);
 const script=ensureScriptNode(p);assert.equal(p.nodes.length,499);assert.throws(()=>sendStoryPackageToCanvas(p),/500/);assert.equal(getScriptNode(p),script);assert.equal(p.nodes.length,499);
});
test('one selected shot plus canonical script can fit exactly at limit and repeat sending reuses both',()=>{
 const p=project();p.nodes=Array.from({length:498},(_,i)=>({id:'n'+i,type:'text',title:'笔记',text:'保留',x:0,y:0,w:320}));
 const ids=sendStoryToCanvas(p,'shots',['s1']);assert.equal(ids.length,2);assert.equal(p.nodes.length,500);assert.deepEqual(sendStoryToCanvas(p,'shots',['s1']),ids);assert.equal(p.edges.filter(e=>e.storySourceLink).length,1);
});
test('script links are idempotent and prune only their own outdated wires',()=>{
 const p=project();sendStoryPackageToCanvas(p);const source=p.edges.find(e=>e.storySourceLink),script=getScriptNode(p);
 assert.equal(source.from,script.id);const manual={from:source.to,to:script.id};p.edges.push(manual);connectScriptSources(p);assert.equal(p.edges.filter(e=>e.storySourceLink).length,1);
 p.workstation.story.shots=[];connectScriptSources(p,{prune:true});assert.equal(p.edges.filter(e=>e.storySourceLink).length,0);assert.ok(p.edges.includes(manual));
});
test('creating canonical script after legacy planning nodes connects existing shots immediately',()=>{
 const p=project(),text=p.workstation.script;p.workstation.script='';sendStoryToCanvas(p,'shots',['s1']);assert.equal(p.edges.length,0);
 p.workstation.script=text;const node=ensureScriptNode(p);assert.ok(p.edges.some(e=>e.storySourceLink&&e.from===node.id&&e.to===p.workstation.story.shots[0].canvasNodeId));
});
test('promoting a text draft after legacy planning connects source without regenerating planning nodes',()=>{
 const p=project();p.workstation.script='';sendStoryToCanvas(p,'shots',['s1']);const shotId=p.workstation.story.shots[0].canvasNodeId;
 p.nodes.push({id:'draft',type:'text',title:'新剧本',text:'故事草稿',x:10,y:20,w:320});const source=promoteTextToScript(p,'draft');assert.equal(source.id,'draft');assert.equal(p.nodes.length,2);assert.equal(p.workstation.story.shots[0].canvasNodeId,shotId);assert.ok(p.edges.some(e=>e.from==='draft'&&e.to===shotId&&e.storySourceLink));
});
test('new planning cards avoid off-grid canonical and manual cards, while repeat synchronization keeps every position',()=>{
 const p=project(),script=ensureScriptNode(p);Object.assign(script,{x:340,y:393});p.nodes.push({id:'manual',type:'text',title:'笔记',text:'保留',x:780,y:50,w:650});
 const originals=structuredClone(p.nodes),rects=node=>({x:node.x,y:node.y,w:node.w,h:480});
 const assertSeparated=nodes=>{for(let a=0;a<nodes.length;a++)for(let b=a+1;b<nodes.length;b++){const x=rects(nodes[a]),y=rects(nodes[b]);assert.ok(x.x+x.w+40<=y.x||y.x+y.w+40<=x.x||x.y+x.h+40<=y.y||y.y+y.h+40<=x.y,`${nodes[a].id} overlaps ${nodes[b].id}`);}};
 sendStoryPackageToCanvas(p);assertSeparated(p.nodes);for(const old of originals){const now=p.nodes.find(n=>n.id===old.id);assert.deepEqual([now.x,now.y,now.w],[old.x,old.y,old.w]);}
 const placements=p.nodes.map(n=>[n.id,n.x,n.y,n.w]);sendStoryPackageToCanvas(p);assert.deepEqual(p.nodes.map(n=>[n.id,n.x,n.y,n.w]),placements);
});
test('new official images reserve free space beside script, shot and asset cards and retain it on resend',()=>{
 const p=project(),asset=p.workstation.story.assets[0];asset.imageVersions=[{id:'v1',mediaId:'m1'}];asset.selectedImageId='v1';const script=ensureScriptNode(p);Object.assign(script,{x:340,y:393});
 const options={imagesByAssetId:{a1:{versionId:'v1',mediaId:'m1',src:'data:image/png;base64,aGVsbG8='}}};sendStoryPackageToCanvas(p,options);const image=p.nodes.find(n=>n.storyImageRef);
 for(const n of p.nodes.filter(n=>n!==image))assert.ok(image.x+image.w+40<=n.x||n.x+n.w+40<=image.x||image.y+480+40<=n.y||n.y+480+40<=image.y);
 const placement=[image.x,image.y,image.w];sendStoryPackageToCanvas(p,options);assert.deepEqual([image.x,image.y,image.w],placement);
});
