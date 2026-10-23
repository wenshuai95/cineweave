import test from 'node:test';
import assert from 'node:assert/strict';
import {starterProject,validateProject} from '../src/model.mjs';
import {cutLibraryRows,prepareCutCanvasResult} from '../src/workstation/cut-library.mjs';
import {createMediaStore} from '../src/workstation/media-store.mjs';
import {buildWorkstationBackup,restoreWorkstationBackup} from '../src/workstation/backup.mjs';
import {indexedDB} from 'fake-indexeddb';

function fixture(){
 const p=validateProject(starterProject());p.nodes=[];p.edges=[];
 const node=(id,type,title,extra={})=>({id,type,title,text:'',x:0,y:0,w:280,...extra});
 p.nodes=[node('director','director','导演台'),node('previz','video','追逐白模',{src:'data:video/mp4;base64,YQ=='}),node('clip','video','实拍参考',{src:'data:video/mp4;base64,Yg==',mediaId:'local'}),node('audio','audio','配音',{src:'data:audio/wav;base64,Yw=='}),node('empty','video','空视频')];
 p.edges=[{from:'director',to:'previz'}];
 p.workstation.assets=[{id:'local',kind:'video',name:'实拍参考.mp4',mime:'video/mp4',size:1,durationSec:4,createdAt:1},{id:'image',kind:'image',name:'参考图',mime:'image/png',size:1,createdAt:1}];
 return p;
}
test('cut library includes canvas previz without importing it or adding clips, and deduplicates linked media',()=>{
 const p=fixture(),before=structuredClone(p),rows=cutLibraryRows(p);
 assert.equal(rows.length,3);assert.equal(rows.filter(r=>r.nodeId==='clip').length,1);
 assert.equal(cutLibraryRows(p,{filter:'previz'})[0].nodeId,'previz');
 assert.equal(cutLibraryRows(p,{filter:'audio',query:'配音'})[0].kind,'audio');
 assert.equal(cutLibraryRows(p,{query:'不存在'}).length,0);
 assert.deepEqual(p,before);
});
test('cut output is an independent MP4 node with source links and exact edited duration',()=>{
 const p=fixture(),before=structuredClone(p);
 const out=prepareCutCanvasResult(p,{src:'data:video/mp4;base64,ZG9uZQ==',size:4,frames:72,fps:24,height:720,sourceNodeIds:['previz','deleted'],mediaId:'output-media',nodeId:'output-node',createdAt:1});
 assert.equal(out.asset.durationSec,3);assert.equal(out.node.type,'video');assert.equal(out.node.mediaId,'output-media');
 assert.deepEqual(out.edges,[{from:'previz',to:'output-node'}]);assert.deepEqual(p,before);
 p.nodes.push(out.node);p.edges.push(...out.edges);p.workstation.assets.push(out.asset);
 const normalized=validateProject(structuredClone(p));
 assert.equal(cutLibraryRows(normalized).filter(r=>r.assetId==='output-media').length,1);
 assert.equal(normalized.nodes.find(n=>n.id==='previz').src,'data:video/mp4;base64,YQ==');
});
test('full canvas and oversized cut output fail before mutating the project',()=>{
 const p=fixture(),input={src:'data:video/mp4;base64,YQ==',size:1,frames:24,fps:24,height:720};
 p.nodes=Array.from({length:500},(_,i)=>({id:'node'+i}));const before=structuredClone(p);
 assert.throws(()=>prepareCutCanvasResult(p,input),/500/);assert.deepEqual(p,before);
 p.nodes=[];assert.throws(()=>prepareCutCanvasResult(p,{...input,size:301*1024*1024}),/300 MB/);
});
test('cut result survives backup and restore with both canvas and library references remapped',async()=>{
 const connect=()=>new Promise((resolve,reject)=>{const req=indexedDB.open('cut-'+crypto.randomUUID(),1);req.onupgradeneeded=()=>req.result.createObjectStore('media',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 const store=createMediaStore(connect),p=validateProject(starterProject());p.nodes=[];p.edges=[];
 const blob=new Blob(['done'],{type:'video/mp4'}),out=prepareCutCanvasResult(p,{src:'data:video/mp4;base64,ZG9uZQ==',size:4,frames:48,fps:24,height:1080,mediaId:'cut',nodeId:'cut-node'});
 await store.put({...out.asset,blob});p.nodes.push(out.node);p.workstation.assets.push(out.asset);
 const {backup}=await buildWorkstationBackup(p,store),fresh=createMediaStore(connect),restored=await restoreWorkstationBackup(backup,fresh);
 const restoredId=restored.project.nodes[0].mediaId;
 assert.notEqual(restoredId,'cut');assert.equal(restored.project.workstation.assets[0].id,restoredId);
 assert.equal(await(await fresh.blob(restoredId)).text(),'done');assert.equal(cutLibraryRows(restored.project).length,1);
});
