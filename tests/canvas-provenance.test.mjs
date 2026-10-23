import test from 'node:test';import assert from 'node:assert/strict';
import {demoProject,validateProject} from '../src/model.mjs';
import {buildCanvasCopy,pasteCanvasCopy} from '../src/board-operations.mjs';
import {ensureScriptNode,getScriptNode,editStoryNode,syncCanonicalNodes} from '../src/workstation/canvas-source.mjs';
import {sendStoryPackageToCanvas} from '../src/workstation/story-canvas.mjs';
const project=()=>{const p=demoProject();p.nodes=[];p.edges=[];p.workstation.script='早晨，少年走进院落。';p.workstation.story={shots:[{id:'shot1',scene:'院子',description:'推门入院',dialogue:'我回来了。',characters:['少年'],duration:5,shotSize:'全景',cameraMovement:'固定',assetIds:['asset1']}],assets:[{id:'asset1',kind:'scene',name:'院落',description:'小院',prompt:'清晨的小院',shotIds:['shot1']}]};return p;};
test('canonical and legacy planning provenance survives actual project validation and source editing',()=>{
 const p=project();sendStoryPackageToCanvas(p);const script=getScriptNode(p),shot=p.nodes.find(n=>n.storyRef?.kind==='shot'),asset=p.nodes.find(n=>n.storyRef?.kind==='asset');
 // Legacy generated planning nodes may carry media without being official-image nodes.
 Object.assign(asset,{type:'image',src:'data:image/png;base64,aGVsbG8='});
 const saved=validateProject(JSON.parse(JSON.stringify(p)));assert.equal(getScriptNode(saved).id,script.id);assert.equal(saved.nodes.find(n=>n.id===asset.id).src,asset.src);
 editStoryNode(saved,script.id,{text:'傍晚，少年离开院落。'});assert.equal(saved.workstation.script,'傍晚，少年离开院落。');assert.match(saved.nodes.find(n=>n.id===shot.id).text,/对白：我回来了。/);assert.equal(saved.nodes.find(n=>n.id===asset.id).src,asset.src);
});
test('invalid source ownership is rejected before save: kinds, ids, duplicate canonical nodes and media collision',()=>{
 for(const ref of [{kind:'unknown',id:'x'},{kind:'asset',id:'../invalid'},{kind:'script',id:'another-script'},null]){
  const p=project(),script=ensureScriptNode(p);script.storyRef=ref;assert.throws(()=>validateProject(p),/来源|剧本节点/);
 }
 const duplicate=project(),source=ensureScriptNode(duplicate);duplicate.nodes.push({...source,id:'duplicate'});assert.throws(()=>validateProject(duplicate),/剧本节点/);
 const collision=project(),node=ensureScriptNode(collision);node.storyImageRef={assetId:'asset1',versionId:'version1'};assert.throws(()=>validateProject(collision),/来源/);
 const media=project(),script=ensureScriptNode(media);script.type='image';assert.throws(()=>validateProject(media),/剧本节点/);
});
test('orphaned valid planning provenance remains recoverable without deleting downstream media',()=>{
 const p=project();sendStoryPackageToCanvas(p);const asset=p.nodes.find(n=>n.storyRef?.kind==='asset');p.nodes.push({id:'generated-image',type:'image',title:'生成图',text:'图片',src:'data:image/png;base64,aGVsbG8=',x:0,y:0,w:320});p.edges.push({from:asset.id,to:'generated-image'});
 p.workstation.story.assets=[];const media=structuredClone(p.nodes.find(n=>n.id==='generated-image'));const saved=validateProject(JSON.parse(JSON.stringify(p)));syncCanonicalNodes(saved);assert.deepEqual(saved.nodes.find(n=>n.id==='generated-image'),media);assert.ok(saved.edges.some(e=>e.from===asset.id&&e.to===media.id));
});
test('copying and pasting a full-length script preserves all text while detaching canonical ownership',()=>{
 const p=project();p.workstation.script='甲'.repeat(200000);const source=ensureScriptNode(p);const clip=buildCanvasCopy(p.nodes,p.edges,[source.id]);assert.equal(clip.nodes[0].text.length,200000);assert.equal(clip.nodes[0].storyRef,undefined);
 const copy=pasteCanvasCopy(JSON.parse(JSON.stringify(clip)),{uid:()=> 'pasted-script'}).nodes[0];assert.equal(copy.text,p.workstation.script);assert.equal(copy.storyRef,undefined);
 p.nodes.push(copy);const saved=validateProject(JSON.parse(JSON.stringify(p)));assert.equal(saved.nodes.find(n=>n.id===copy.id).text.length,200000);assert.equal(saved.nodes.filter(n=>n.storyRef?.kind==='script').length,1);
});
