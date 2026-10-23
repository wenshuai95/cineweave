import test from 'node:test';import assert from 'node:assert/strict';
import {sendStoryPackageToCanvas,sendStoryToCanvas,isStoryNodeCurrent} from '../src/workstation/story-canvas.mjs';
const project=()=>({nodes:[],edges:[],workstation:{story:{shots:[{id:'s1',scene:'院子',characters:['甲'],description:'甲走入院子',dialogue:'',duration:3,shotSize:'中景',cameraMovement:'固定',assetIds:[]}],assets:[{id:'a1',kind:'character',name:'甲',description:'人物',prompt:'白衣男子',shotIds:['s1']}]}}});
test('two legacy records sharing a node cannot bypass whole-package capacity',()=>{
 const p=project();p.nodes=Array.from({length:500},(_,i)=>({id:'legacy'+i}));
 p.workstation.story.shots[0].canvasNodeId='legacy0';p.workstation.story.assets[0].canvasNodeId='legacy0';
 const before=structuredClone(p);assert.throws(()=>sendStoryPackageToCanvas(p),/500/);assert.deepEqual(p,before);
});
test('package preflights both record types and leaves no partial nodes or record links',()=>{const p=project();p.nodes=Array.from({length:499},(_,i)=>({id:'existing'+i}));const before=structuredClone(p);assert.throws(()=>sendStoryPackageToCanvas(p),/500/);assert.deepEqual(p,before);});
test('repeat package preserves generated media and layout while updating planning text',()=>{const p=project();const ids=sendStoryPackageToCanvas(p);assert.equal(ids.length,2);const asset=p.nodes.find(n=>n.storyRef.kind==='asset');Object.assign(asset,{type:'image',src:'data:image/png;base64,result',x:999,y:888,w:444,generated:{task:'ready'}});const saved=structuredClone(asset);p.workstation.story.assets[0].prompt='黑衣男子';assert.equal(isStoryNodeCurrent(p.workstation.story.assets[0],asset,'assets',0),false);assert.deepEqual(sendStoryPackageToCanvas(p),ids);assert.equal(p.nodes.length,2);assert.equal(p.edges.length,1);for(const k of ['src','x','y','w','type','generated'])assert.deepEqual(asset[k],saved[k]);assert.equal(asset.text,'黑衣男子');assert.equal(isStoryNodeCurrent(p.workstation.story.assets[0],asset,'assets',0),true);});
test('both one-sided relationships connect and deleted back-reference recovers by provenance',()=>{const p=project();p.workstation.story.assets[0].shotIds=[];p.workstation.story.shots[0].assetIds=['a1'];sendStoryToCanvas(p,'shots',['s1']);sendStoryToCanvas(p,'assets',['a1']);assert.equal(p.edges.length,1);const id=p.workstation.story.assets[0].canvasNodeId;delete p.workstation.story.assets[0].canvasNodeId;sendStoryPackageToCanvas(p);assert.equal(p.workstation.story.assets[0].canvasNodeId,id);assert.equal(p.nodes.length,2);assert.equal(p.edges.length,1);});
test('empty package has no side effects',()=>{const p=project();p.workstation.story={shots:[],assets:[]};const before=structuredClone(p);assert.deepEqual(sendStoryPackageToCanvas(p),[]);assert.deepEqual(p,before);});
test('a corrupt back-reference never overwrites another record-owned node',()=>{
 const p=project();sendStoryPackageToCanvas(p);
 const original=p.nodes.find(n=>n.storyRef.kind==='asset'),saved=structuredClone(original);
 p.workstation.story.assets.push({id:'a2',kind:'prop',name:'伞',description:'纸伞',prompt:'油纸伞',shotIds:[],canvasNodeId:original.id});
 sendStoryPackageToCanvas(p);
 assert.deepEqual(original,saved);
 assert.equal(p.nodes.length,3);
 assert.notEqual(p.workstation.story.assets[1].canvasNodeId,original.id);
 assert.equal(p.nodes.find(n=>n.id===p.workstation.story.assets[1].canvasNodeId).storyRef.id,'a2');
});
test('legacy back-references without provenance still reuse their nodes',()=>{
 const p=project(),legacy={id:'legacy',type:'image',title:'旧角色',text:'旧描述',x:9,y:8,w:200,src:'data:image/png;base64,kept'};
 p.nodes.push(legacy);p.workstation.story.assets[0].canvasNodeId='legacy';
 sendStoryPackageToCanvas(p);
 assert.equal(p.nodes.length,2);assert.equal(legacy.src,'data:image/png;base64,kept');
 assert.deepEqual(legacy.storyRef,{kind:'asset',id:'a1'});
});
test('full sync prunes expired automatic relationships and preserves manual and legacy wires',()=>{
 const p=project();sendStoryPackageToCanvas(p);
 const automatic=structuredClone(p.edges[0]);assert.equal(automatic.storyLink,true);
 p.nodes.push({id:'generated',type:'image'});
 const generated={from:automatic.from,to:'generated'},manual={from:'generated',to:automatic.to},legacy={from:automatic.to,to:automatic.from};
 p.edges.push(generated,manual,legacy);
 p.workstation.story.assets[0].shotIds=[];
 sendStoryPackageToCanvas(p);
 assert.deepEqual(p.edges,[generated,manual,legacy]);
 p.workstation.story.shots[0].assetIds=['a1'];sendStoryPackageToCanvas(p);
 assert.equal(p.edges.filter(e=>e.storyLink===true).length,1);
 p.workstation.story={shots:[],assets:[]};sendStoryPackageToCanvas(p);
 assert.deepEqual(p.edges,[generated,manual,legacy]);
});
test('existing unmarked relationship edges are never adopted or removed automatically',()=>{
 const p=project();sendStoryPackageToCanvas(p);delete p.edges[0].storyLink;
 const before=structuredClone(p.edges);sendStoryPackageToCanvas(p);assert.deepEqual(p.edges,before);
 p.workstation.story.assets=[];sendStoryPackageToCanvas(p);assert.deepEqual(p.edges,before);
});
test('capacity preflight counts corrupt references as missing and preserves all content on failure',()=>{
 const p=project();sendStoryPackageToCanvas(p);
 p.workstation.story.assets.push({id:'a2',kind:'prop',name:'伞',description:'',prompt:'伞',shotIds:[],canvasNodeId:p.workstation.story.assets[0].canvasNodeId});
 while(p.nodes.length<500)p.nodes.push({id:'filler'+p.nodes.length});
 const before=structuredClone(p);assert.throws(()=>sendStoryPackageToCanvas(p),/500/);assert.deepEqual(p,before);
});
