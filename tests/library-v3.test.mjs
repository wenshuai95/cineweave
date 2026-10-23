import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {AnimationMixer,Box3,Vector3} from 'three';
import {normalizeAsset} from '../src/asset-geometry.mjs';import {checkGLB} from '../src/glb-format.mjs';import {starterProject,demoProject,validateProject,sampleObject} from '../src/model.mjs';import {clipLabel} from '../src/clip-labels.mjs';
const root=new URL('../public/assets/',import.meta.url);
test('new example uses offline skinned people while old procedural projects remain readable',()=>{const p=starterProject();assert.doesNotThrow(()=>validateProject(p));assert.equal(p.objects.filter(o=>o.type==='actor').length,0);assert.ok(p.objects.filter(o=>o.type==='model').every(o=>o.modelSrc.startsWith('/assets/models/adult-')));assert.equal(sampleObject(p.objects[0],2).modelClip,'Adult_Walk');assert.equal(sampleObject(p.objects[0],8).modelClip,'Adult_Idle_Neutral');assert.doesNotThrow(()=>validateProject(demoProject()));});
test('every selectable offline model has a real PNG thumbnail, retired white models stay hidden',async()=>{const m=JSON.parse(await readFile(new URL('manifest.json',root)));assert.ok(m.assets.length>=39);assert.equal(new Set(m.assets.map(a=>a.id)).size,m.assets.length);assert.ok(!m.assets.some(a=>['adult-female-rigged','adult-male-rigged'].includes(a.id)));for(const a of m.assets){assert.ok(a.thumbnail);const b=await readFile(new URL(a.thumbnail,root));assert.equal(b.subarray(1,4).toString(),'PNG');assert.ok(b.length>1000);}});
test('both adult female base models have 85 adapted clips with functioning skinned geometry',async()=>{
 const catalog=JSON.parse(await readFile(new URL('manifest.json',root)));
 for(const a of catalog.assets.filter(a=>a.adultBase)){
  const b=await readFile(new URL(a.file,root)),buffer=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);checkGLB(buffer);assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256);
  const g=await new GLTFLoader().parseAsync(buffer,'');assert.equal(g.animations.length,85);assert.equal(new Set(g.animations.map(c=>c.name)).size,85);
  let mesh;g.scene.traverse(o=>{if(o.isSkinnedMesh){mesh=o;assert.equal(o.skeleton.bones.length,65);}});assert.ok(mesh);
  const model=normalizeAsset(g.scene,a.modelSize),mixer=new AnimationMixer(g.scene);let animated=0;
  for(const c of g.animations){assert.notEqual(clipLabel(c.name),c.name);mixer.stopAllAction();mixer.clipAction(c).play();let first;
   for(const t of [0,.25,.55,.85]){mixer.setTime(c.duration*t);model.updateMatrixWorld(true);const box=new Box3().setFromObject(model,true),size=box.getSize(new Vector3());assert.ok(size.toArray().every(x=>Number.isFinite(x)&&x>0&&x<8),`${a.id}/${c.name}`);const pose=mesh.skeleton.bones.flatMap(b=>b.quaternion.toArray());if(!first)first=pose;else if(pose.some((v,i)=>Math.abs(v-first[i])>.001))animated++;}
  }
  assert.ok(animated>100,`${a.id}: animation channels must actually move bones`);
 }
});
