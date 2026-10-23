import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AnimationMixer,Box3,Vector3} from 'three';
import {normalizeAsset} from '../src/asset-geometry.mjs';
import {checkGLB} from '../src/glb-format.mjs';
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:16,height:16,close(){}});
const root=new URL('../public/assets/',import.meta.url);

test('expanded offline characters are self contained, licensed, correctly hashed and animate on their own rigs',async()=>{
 const catalog=JSON.parse(await readFile(new URL('manifest.json',root)));
 const added=catalog.assets.filter(a=>a.id==='quaternius-performer'||/^character-(male|female)-(b|d|e|f)$/.test(a.id));
 assert.equal(added.length,9);
 for(const a of added){
  const data=await readFile(new URL(a.file,root)),buffer=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  checkGLB(buffer);assert.equal(createHash('sha256').update(data).digest('hex'),a.sha256);assert.ok((await readFile(new URL(a.licenseFile,root))).length>100);
  const gltf=await new GLTFLoader().parseAsync(buffer,'');assert.equal(gltf.animations.length,a.id==='quaternius-performer'?46:32);assert.equal(new Set(gltf.animations.map(c=>c.name)).size,gltf.animations.length);
  let skinned=0;gltf.scene.traverse(m=>{if(m.isSkinnedMesh)skinned++});assert.ok(skinned>0);
  const model=normalizeAsset(gltf.scene,a.modelSize),mixer=new AnimationMixer(gltf.scene);
  for(const clip of gltf.animations){
   assert.ok(clip.duration>0&&clip.tracks.length>0);
   for(const track of clip.tracks)assert.ok([...track.values].every(Number.isFinite));
   mixer.stopAllAction();mixer.clipAction(clip).play();
   for(const ratio of [0,.35,.7]){mixer.setTime(clip.duration*ratio);model.updateMatrixWorld(true);const box=new Box3().setFromObject(model,true),size=box.getSize(new Vector3());assert.ok(size.toArray().every(n=>Number.isFinite(n)&&n>0&&n<12),`${a.id} / ${clip.name} bounds`);}
  }
 }
});
