import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture,Bone,SkinnedMesh} from 'three';
import {prepareModelMaterials,applyModelAppearance,disposeModelMaterials} from '../src/model-appearance.mjs';
import {object,demoProject,validateProject,sampleObject,addParameterKey,parameterValue,frame} from '../src/model.mjs';
test('color edits isolate instances, preserve source materials and textures, and fully restore',()=>{
 const map=new Texture(),emissiveMap=new Texture(),source=new MeshStandardMaterial({color:'#bbaabb',map,vertexColors:true,emissive:'#332211',emissiveMap});
 const scene=new Group();scene.add(new Mesh(new BoxGeometry(),source),new Mesh(new BoxGeometry(),[source,source]));
 const other=scene.clone(),a=prepareModelMaterials(scene),b=prepareModelMaterials(other);
 assert.equal(a.materials.length,1);assert.notEqual(a.materials[0].material,b.materials[0].material);
 applyModelAppearance(a,'tint','#4285f4');assert.equal(a.materials[0].material.map,map);assert.notEqual(a.materials[0].material.color.getHexString(),source.color.getHexString());assert.equal(b.materials[0].material.color.getHexString(),source.color.getHexString());
 applyModelAppearance(a,'solid','#e85d62');const m=a.materials[0].material;assert.equal(m.color.getHexString(),'e85d62');assert.equal(m.map,null);assert.equal(m.vertexColors,false);assert.equal(m.emissive.getHex(),0);assert.equal(m.emissiveMap,null);
 applyModelAppearance(a,'original');assert.equal(m.color.getHexString(),source.color.getHexString());assert.equal(m.map,map);assert.equal(m.vertexColors,true);assert.equal(m.emissiveMap,emissiveMap);assert.equal(m.emissive.getHex(),source.emissive.getHex());
 let disposed=false;map.addEventListener('dispose',()=>disposed=true);disposeModelMaterials(a);assert.equal(disposed,false);
});
test('rig inspection distinguishes a static mesh from skinned geometry',()=>{
 const staticScene=new Group();staticScene.add(new Mesh(new BoxGeometry(),new MeshStandardMaterial()));assert.equal(prepareModelMaterials(staticScene).skinnedMeshes,0);
 const rig=new Group();rig.add(new Bone(),new SkinnedMesh(new BoxGeometry(),new MeshStandardMaterial()));const info=prepareModelMaterials(rig);assert.equal(info.bones,1);assert.equal(info.skinnedMeshes,1);
});
test('legacy models retain neutral tint; animated model color and action draft survive project validation',()=>{
 const p=demoProject(),o=object('model','Test');o.modelSrc='/assets/models/test.glb';o.modelSize=2;p.objects.push(o);
 assert.equal(sampleObject(o,0).modelTint,'#ffffff');assert.equal(parameterValue(o,'modelTint'),'#ffffff');
 o.keys=[frame(o,0),frame(o,4)];addParameterKey(o,'modelTint',0,'#000000','linear');addParameterKey(o,'modelTint',4,'#ffffff','linear');assert.equal(sampleObject(o,2).modelTint,'#808080');
 o.modelColorMode='solid';o.motionDraft={prompt:'向前走，挥手',duration:5};const restored=JSON.parse(JSON.stringify(p));validateProject(restored);assert.deepEqual(restored.objects.at(-1).motionDraft,o.motionDraft);
 restored.objects.at(-1).motionDraft.duration=13;assert.throws(()=>validateProject(restored));restored.objects.at(-1).motionDraft.duration=5;restored.objects.at(-1).modelColorMode='invalid';assert.throws(()=>validateProject(restored));
});
