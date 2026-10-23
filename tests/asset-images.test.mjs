import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeAssetImages,addAssetImageVersions,selectAssetImage,removeAssetImageVersion,validateImageFile,IMAGE_MAX_BYTES} from '../src/workstation/asset-images.mjs';
import {normalizeStory,snapshotStory,validateStoryOutput} from '../src/workstation/story.mjs';
const version=(id='v1')=>({id,mediaId:'m-'+id,name:'Blender 场景.png',mime:'image/png',size:120,width:1280,height:720,createdAt:1});
test('local image metadata is bounded, credential-free and survives story history',()=>{
 const ws={script:'院子',story:normalizeStory({assets:[{id:'a1',kind:'scene',name:'院子',imageVersions:[{...version(),src:'data:SECRET',key:'SECRET',prompt:'木门'}],selectedImageId:'v1'}]})};
 snapshotStory(ws,'导入场景图');const saved=normalizeStory(ws.story);
 assert.equal(saved.assets[0].selectedImageId,'v1');assert.equal(saved.versions[0].assets[0].imageVersions[0].mediaId,'m-v1');assert.ok(!JSON.stringify(saved).includes('SECRET'));
 const dirty=normalizeAssetImages({imageVersions:[version(),version(),version('bad id'),{...version('v2'),size:IMAGE_MAX_BYTES+1}],selectedImageId:'v2'});
 assert.equal(dirty.imageVersions.length,1);assert.equal(dirty.selectedImageId,undefined);
});
test('candidate import chooses first image once and supports official selection/removal without touching bytes',()=>{
 const asset={};const first=addAssetImageVersions(asset,[version()]);assert.equal(first[0].id,'v1');assert.equal(asset.selectedImageId,'v1');
 addAssetImageVersions(asset,[version('v2')]);assert.equal(asset.selectedImageId,'v1');selectAssetImage(asset,'v2');assert.equal(asset.selectedImageId,'v2');
 assert.equal(removeAssetImageVersion(asset,'v2').mediaId,'m-v2');assert.equal(asset.selectedImageId,'v1');
 removeAssetImageVersion(asset,'v1');assert.deepEqual(asset,{imageVersions:[]});assert.throws(()=>selectAssetImage(asset,'v1'),/不存在/);
});
test('invalid batch and candidate limit fail atomically',()=>{
 const asset={imageVersions:[version()],selectedImageId:'v1'},before=structuredClone(asset);
 assert.throws(()=>addAssetImageVersions(asset,[version('v2'),{...version('v3'),width:0}]),/不完整/);assert.deepEqual(asset,before);
 assert.throws(()=>addAssetImageVersions(asset,Array.from({length:20},(_,i)=>version('new'+i))),/20/);assert.deepEqual(asset,before);
 assert.throws(()=>addAssetImageVersions(asset,[version()]),/重复/);assert.deepEqual(asset,before);
});
test('file validation checks bytes and bounded size, not filename extensions',async()=>{
 const png=new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'});
 assert.equal(await validateImageFile(png),'image/png');
 assert.equal(await validateImageFile(new Blob([new Uint8Array([255,216,255])])),'image/jpeg');
 assert.equal(await validateImageFile(new Blob(['RIFF1234WEBP'],{type:'image/webp'})),'image/webp');
 await assert.rejects(validateImageFile(new Blob(['<svg/>'],{type:'image/png'})),/仅支持/);
 await assert.rejects(validateImageFile(new Blob([await png.arrayBuffer()],{type:'image/jpeg'})),/不一致/);
 await assert.rejects(validateImageFile({size:IMAGE_MAX_BYTES+1,slice(){throw Error('must not read');}}),/20 MB/);
});
test('AI asset output cannot invent local media or official-image references',()=>{
 const output=validateStoryOutput({assets:[{kind:'scene',name:'院子',description:'木门',imageVersions:[version()],selectedImageId:'v1'}]},'assets');
 assert.equal(output.assets[0].imageVersions,undefined);assert.equal(output.assets[0].selectedImageId,undefined);
});
