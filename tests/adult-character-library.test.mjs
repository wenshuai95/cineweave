import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AnimationMixer,Box3,Vector3} from 'three';
import {normalizeAsset} from '../src/asset-geometry.mjs';
import {clipLabel} from '../src/clip-labels.mjs';
import {checkGLB} from '../src/glb-format.mjs';
const root=new URL('../public/assets/',import.meta.url);
test('eight adult outfit models retain complete native skeletons, named playable clips and offline materials',async()=>{
 const catalog=JSON.parse(await readFile(new URL('manifest.json',root)));
 const models=catalog.assets.filter(a=>a.sourcePath?.includes('Individual Characters/glTF/'));
 assert.equal(models.length,8);assert.equal(models.filter(a=>a.gender==='female').length,5);
 assert.ok(!catalog.assets.some(a=>['adult-female-rigged','adult-male-rigged'].includes(a.id)));
 for(const a of models){
  const data=await readFile(new URL(a.file,root)),buffer=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  checkGLB(buffer);assert.equal(createHash('sha256').update(data).digest('hex'),a.sha256);
  assert.match(await readFile(new URL(a.licenseFile,root),'utf8'),/CC0/);
  assert.ok((await readFile(new URL(a.thumbnail,root))).length>1000);
  const gltf=await new GLTFLoader().parseAsync(buffer,'');assert.equal(gltf.animations.length,24);
  let skinned=0;gltf.scene.traverse(o=>{if(o.isSkinnedMesh){assert.equal(o.skeleton.bones.length,62);skinned++;}});assert.ok(skinned>0);
  const model=normalizeAsset(gltf.scene,a.modelSize),mixer=new AnimationMixer(gltf.scene);
  assert.ok(gltf.animations.some(c=>c.name===a.defaultClip));
  for(const clip of gltf.animations){
   assert.notEqual(clipLabel(clip.name),clip.name);assert.ok(clip.duration>0);
   for(const track of clip.tracks)assert.ok([...track.values].every(Number.isFinite));
   mixer.stopAllAction();mixer.clipAction(clip).play();
   for(const t of [0,.35,.7]){mixer.setTime(clip.duration*t);model.updateMatrixWorld(true);const box=new Box3().setFromObject(model,true),size=box.getSize(new Vector3());assert.ok(size.toArray().every(n=>Number.isFinite(n)&&n>0&&n<8),`${a.id}/${clip.name}`);assert.ok(box.min.y>-.6&&box.max.y<4,`${a.id}/${clip.name} vertical placement`);}
  }
 }
});
