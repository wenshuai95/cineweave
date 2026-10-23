import test from 'node:test';import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {createMediaStore} from '../src/workstation/media-store.mjs';
import {buildWorkstationBackup,restoreWorkstationBackup,BACKUP_SCHEMA} from '../src/workstation/backup.mjs';
import {demoProject} from '../src/model.mjs';

// 媒体库：独立 DB 名，不动 v1 的 jingchang-studio projects 库
async function store(){return createMediaStore(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('ws-media-'+crypto.randomUUID(),1);r.onupgradeneeded=()=>r.result.createObjectStore('media',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}

test('media store keeps blobs out of the project and reuses object URLs',async()=>{
 const s=await store();
 const blob=new Blob([new Uint8Array([1,2,3,4])],{type:'video/mp4'});
 const entry=await s.put({id:'m1',kind:'video',name:'测试.mp4',mime:'video/mp4',createdAt:5,durationSec:2,blob});
 assert.equal(entry.size,4);
 const list=await s.list();
 assert.equal(list.length,1);assert.equal(list[0].blob,undefined);assert.equal(list[0].id,'m1');
 const url1=await s.url('m1'),url2=await s.url('m1');
 assert.equal(url1,url2);assert.match(url1,/^blob:/);
 const got=await s.blob('m1');
 assert.equal(got.size,4);assert.equal(got.type,'video/mp4');
 assert.equal(await s.get('missing'),null);
 await s.delete('m1');
 assert.equal((await s.list()).length,0);
 await assert.rejects(s.put({id:'bad id',blob}),/无效的媒体 ID/);
 await assert.rejects(s.put({id:'ok',kind:'video',name:'x',blob:'not a blob'}),/Blob/);
});

test('backup embeds referenced media and restore rehydrates the same assetIds',async()=>{
 const s=await store();
 await s.put({id:'m1',kind:'video',name:'A.mp4',mime:'video/mp4',createdAt:1,durationSec:2,width:1280,height:720,blob:new Blob([new Uint8Array([9,9])],{type:'video/mp4'})});
 await s.put({id:'m2',kind:'audio',name:'B.mp3',mime:'audio/mpeg',createdAt:2,durationSec:3,blob:new Blob([new Uint8Array([7])],{type:'audio/mpeg'})});
 const project=demoProject();
 project.workstation={script:'s',assets:[{id:'m1',kind:'video',name:'A.mp4',mime:'video/mp4',size:2,durationSec:2,width:1280,height:720,createdAt:1},{id:'m2',kind:'audio',name:'B.mp3',mime:'audio/mpeg',size:1,durationSec:3,createdAt:2},{id:'m9',kind:'video',name:'缺失',mime:'video/mp4',size:5,createdAt:3}],sequence:{fps:24,video:[{id:'c1',assetId:'m1',start:0,in:0,out:24,volume:1,muted:false}],audio:[{id:'c2',assetId:'m2',start:0,in:0,out:48,volume:1,muted:false}]},deliver:{height:'720p',tasks:[]}};
 const {backup,mediaBytes,missingCount}=await buildWorkstationBackup(project,s);
 assert.equal(backup.schema,BACKUP_SCHEMA);
 assert.equal(backup.media.length,2);
 assert.equal(missingCount,1); // m9 在库里不存在，被如实报告
 assert.equal(mediaBytes,3);
 assert.equal(backup.project.workstation.sequence.video.length,1);

 // 恢复到全新媒体库：沿用原 assetId，时间线引用不失效
 const fresh=await store();
 const restored=await restoreWorkstationBackup(backup,fresh);
 assert.equal(restored.mediaRestored,2);
 const mapped=restored.project.workstation.assets.find(a=>a.name==='A.mp4').id;
 assert.notEqual(mapped,'m1');
 assert.equal(restored.project.workstation.sequence.video[0].assetId,mapped);
 const again=await fresh.get(mapped);
 assert.equal(again.size,2);assert.equal(again.mime,'video/mp4');assert.equal(again.durationSec,2);
 const roundtrip=await buildWorkstationBackup(restored.project,fresh);
 assert.equal(roundtrip.missingCount,1);assert.equal(roundtrip.backup.media.length,2);

 // 非备份 JSON 与缺失媒体库都被明确拒绝
 await assert.rejects(restoreWorkstationBackup({schema:'other'},fresh),/备份/);
 await assert.rejects(restoreWorkstationBackup(backup,null),/媒体库/);
});

test('backup import validates first and never overwrites an existing media ID',async()=>{
 const s=await store(),project=demoProject();
 const blob=new Blob(['old'],{type:'video/mp4'});await s.put({id:'same',kind:'video',name:'Old',mime:blob.type,blob});
 project.workstation.assets=[{id:'same',kind:'video',name:'New',mime:blob.type,size:3,createdAt:1}];
 const backup={schema:BACKUP_SCHEMA,project,media:[{id:'same',kind:'video',name:'New',mime:blob.type,size:3,encoding:'base64',data:btoa('new')}]};
 const result=await restoreWorkstationBackup(backup,s);
 assert.equal(await (await s.blob('same')).text(),'old');
 assert.equal(await (await s.blob(result.project.workstation.assets[0].id)).text(),'new');
 const invalid=structuredClone(backup);invalid.project.schema='bad';
 const before=(await s.list()).length;await assert.rejects(restoreWorkstationBackup(invalid,s));assert.equal((await s.list()).length,before);
});
