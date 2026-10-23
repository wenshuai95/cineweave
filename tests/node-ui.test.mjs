import test from 'node:test';
import assert from 'node:assert/strict';
import {nodePresentation,nodeQuickActions} from '../src/node-ui.mjs';
import {starterProject,validateProject} from '../src/model.mjs';
import {ensureScriptNode} from '../src/workstation/canvas-source.mjs';
test('script source keeps its planning actions and is not presented as an ordinary note',()=>{
 const p=starterProject();p.workstation=validateProject(p).workstation;
 const n=ensureScriptNode(p),before=JSON.stringify(p);
 assert.equal(nodePresentation(p,n).label,'项目剧本');
 assert.ok(nodeQuickActions(p,n).some(a=>a.id==='storyboard'));
 assert.ok(!nodeQuickActions(p,n).some(a=>a.id==='promote'));
 assert.equal(JSON.stringify(p),before);
});
test('an empty video cannot claim generation or offer editing without a real result',()=>{
 const p={nodes:[],workstation:{story:{shots:[],assets:[]}}};
 const n={id:'v',type:'video',title:'参考视频',text:''};p.nodes.push(n);
 assert.equal(nodePresentation(p,n).status,'待导入');
 assert.equal(nodePresentation(p,n).empty,true);
 assert.ok(!nodeQuickActions(p,n).some(a=>a.id==='edit-media'));
 n.src='data:video/mp4;base64,AAAA';
 assert.equal(nodePresentation(p,n).status,'已有素材');
 assert.equal(nodePresentation(p,n).empty,false);
 assert.ok(nodeQuickActions(p,n).some(a=>a.id==='edit-media'));
});
test('model status and action require the real model binding, and an empty picture has no modelling action',()=>{
 const p={nodes:[]},n={id:'m',type:'model',title:'模型',text:''};p.nodes.push(n);
 assert.equal(nodePresentation(p,n).status,'待接入');n.objectId='real-object';
 assert.equal(nodePresentation(p,n).status,'已接入');
 const pic={id:'i',type:'image',text:''};p.nodes.push(pic);
 assert.ok(!nodeQuickActions(p,pic).some(a=>a.id==='model'));
 pic.src='data:image/png;base64,AAAA';
 assert.ok(!nodeQuickActions(p,pic).some(a=>a.id==='model'));
});

test('common media operations are visible while maintenance stays in More',async()=>{
 const {visibleNodeActions}=await import('../src/node-ui.mjs');
 const p={nodes:[]},n={id:'video',type:'video',src:'data:video/mp4;base64,AAAA',text:''};p.nodes.push(n);
 const ids=visibleNodeActions(p,n).map(a=>a.id);
 for(const action of ['video','frames','trim','audio','depth','edit-media'])assert.ok(ids.includes(action));
 assert.ok(!ids.includes('compatibility'));
 assert.ok(nodeQuickActions(p,n).some(a=>a.id==='compatibility'));
 n.src='';
 assert.ok(!visibleNodeActions(p,n).some(a=>['frames','trim','audio','depth'].includes(a.id)));
 const pic={id:'picture',type:'image',src:'data:image/png;base64,AAAA'};p.nodes.push(pic);
 for(const action of ['video','media','download'])assert.ok(visibleNodeActions(p,pic).some(a=>a.id===action));
});

test('a generated asset picture exposes adoption actions only with a real asset context',()=>{
 const p={nodes:[],workstation:{story:{shots:[],assets:[{id:'a1',kind:'scene',name:'院子',imageVersions:[{id:'v1',mediaId:'m1'}],selectedImageId:'v1'}]}}};
 const candidate={id:'candidate',type:'image',title:'院子 · 生成候选图',text:'生成',src:'data:image/png;base64,AAAA',imageResultContext:{kind:'asset',sourceNodeId:'asset-node',assetId:'a1',assetName:'院子'}};
 p.nodes.push(candidate);
 let ids=nodeQuickActions(p,candidate).map(action=>action.id);
 assert.ok(ids.includes('asset-version'));assert.ok(ids.includes('asset-official'));assert.equal(nodePresentation(p,candidate).status,'资产候选图');
 candidate.storyImageRef={assetId:'a1',versionId:'v1'};candidate.mediaId='m1';
 ids=nodeQuickActions(p,candidate).map(action=>action.id);assert.ok(!ids.includes('asset-version'));assert.ok(!ids.includes('asset-official'));assert.ok(ids.includes('edit'));assert.equal(nodePresentation(p,candidate).status,'正式图');
 const plain={id:'plain',type:'image',title:'自由生成',text:'',src:'data:image/png;base64,BBBB'};p.nodes.push(plain);
 ids=nodeQuickActions(p,plain).map(action=>action.id);assert.ok(!ids.includes('asset-version'));assert.ok(!ids.includes('asset-official'));
});
