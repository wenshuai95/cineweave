import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Vector3,Box3} from 'three';
import {exportCharacterCandidates,createSimplifiedCharacter,disposeSimplifiedCharacters,withSimplifiedCharacters} from '../src/export-characters.mjs';
import {Stage} from '../src/stage.js';

test('only metadata-classified humans default to simplification; unknown GLB needs explicit selection',()=>{
 const project={objects:[{id:'a',type:'actor',name:'A'},{id:'h',type:'model',modelSrc:'/assets/human.glb'},{id:'dog',type:'model',modelSrc:'/assets/dog.glb'},{id:'house',type:'model',modelSrc:'/assets/house.glb'},{id:'generated',type:'model'},{id:'monster',type:'model'},{id:'unknown',type:'model'},{id:'cam',type:'camera'}],nodes:[{type:'model',objectId:'generated',modelKind:'human'},{type:'model',objectId:'monster',modelKind:'creature'}]};
 const catalog=[{file:'human.glb',category:'character'},{file:'dog.glb',category:'animal'},{file:'house.glb',category:'building'}];
 assert.deepEqual(exportCharacterCandidates(project,catalog).map(c=>[c.id,c.automatic]),[['a',true],['h',true],['generated',true],['unknown',false]]);
});
test('limbless proxy is grounded at the original height for adults and children',()=>{
 for(const height of [1.1,1.7,2.2]){const proxy=createSimplifiedCharacter(new Vector3(2,height,.4)),size=new Box3().setFromObject(proxy);assert.ok(Math.abs(size.min.y)<1e-6);assert.ok(Math.abs(size.max.y-height)<1e-6);assert.equal(proxy.children.length,3);assert.ok(proxy.children.every(m=>!m.isSkinnedMesh));disposeSimplifiedCharacters(new Map([['p',proxy]]));}
});
test('render-only replacement follows position rotation and scale, preserves other models and restores on failure',()=>{
 const scene=new Group(),original=new Group(),animal=new Group(),hidden=new Group();original.add(new Mesh(new BoxGeometry(),new MeshStandardMaterial()));original.position.set(3,2,1);original.rotation.y=1;original.scale.setScalar(2);hidden.visible=false;scene.add(original,animal,hidden);
 const mesh=original.children[0],geometry=mesh.geometry,material=mesh.material,proxy=createSimplifiedCharacter(new Vector3(.5,1.8,.3)),hiddenProxy=createSimplifiedCharacter(new Vector3(.5,1.8,.3)),proxies=new Map([['human',proxy],['hidden',hiddenProxy]]),meshes=new Map([['human',original],['hidden',hidden]]);
 assert.throws(()=>withSimplifiedCharacters(scene,meshes,proxies,()=>{assert.equal(original.visible,false);assert.equal(animal.visible,true);assert.equal(proxy.parent,scene);assert.equal(hiddenProxy.parent,null);assert.deepEqual(proxy.position,original.position);assert.deepEqual(proxy.quaternion.toArray(),original.quaternion.toArray());assert.deepEqual(proxy.scale,original.scale);throw Error('render failed')}),/render failed/);
 assert.equal(original.visible,true);assert.equal(hidden.visible,false);assert.equal(proxy.parent,null);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(scene.children.length,3);
 let disposed=0;proxy.children[0].material.addEventListener('dispose',()=>disposed++);disposeSimplifiedCharacters(proxies);assert.equal(disposed,1);
});
test('shot render respects hidden and solo states with proxies and restores editor state',()=>{
 const scene=new Group(),human=new Group(),hidden=new Group(),camera=new Group();scene.add(human,hidden,camera);human.visible=false;hidden.visible=false;
 const proxy=createSimplifiedCharacter(new Vector3(.5,1.8,.3)),hiddenProxy=createSimplifiedCharacter(new Vector3(.5,1.8,.3)),proxies=new Map([['human',proxy],['hidden',hiddenProxy]]);
 const helper=()=>({visible:true});const stage={p:{objects:[{id:'human',type:'model'},{id:'hidden',type:'model',hidden:true},{id:'camera',type:'camera'}]},meshes:new Map([['human',human],['hidden',hidden],['camera',camera]]),scene,transform:{getHelper:helper},targetTransform:{getHelper:helper},targetVisual:helper(),grid:helper(),paths:helper()};
 Stage.prototype.cleanRender.call(stage,{render(){assert.equal(human.visible,false);assert.equal(proxy.parent,scene);assert.equal(hiddenProxy.parent,null);assert.equal(camera.visible,false)}},{},proxies);
 assert.equal(human.visible,false);assert.equal(hidden.visible,false);assert.equal(camera.visible,true);assert.equal(proxy.parent,null);disposeSimplifiedCharacters(proxies);
});
