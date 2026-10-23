import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,Group,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import {stepView,turnView,changeFov} from '../src/navigation.mjs';
import {Stage} from '../src/stage.js';
const view=()=>({camera:new PerspectiveCamera(42,1,.05,200),target:new Vector3(0,0,-10)});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('W/S and A/D move director camera and aim together, Q/E change height',()=>{
 for(const [code,axis,direction] of [['KeyW','z',-1],['KeyS','z',1],['KeyA','x',-1],['KeyD','x',1],['KeyQ','y',-1],['KeyE','y',1]]){
  const {camera,target}=view(),before=target.clone();stepView(camera,target,new Set([code]),.05);
  near(camera.position[axis],.2*direction);near(target[axis]-before[axis],camera.position[axis]);
 }
});
test('IJKL turn around the viewer without translating the viewer',()=>{
 for(const [code,axis,direction] of [['KeyI','y',1],['KeyK','y',-1],['KeyJ','x',-1],['KeyL','x',1]]){
  const {camera,target}=view();stepView(camera,target,new Set([code]),.05);
  assert.ok(target[axis]*direction>0);near(camera.position.length(),0);near(target.length(),10);
 }
});
test('navigation is frame-rate independent, Shift accelerates and opposite keys cancel',()=>{
 const a=view(),b=view();for(let i=0;i<60;i++)stepView(a.camera,a.target,new Set(['KeyW']),1/60);
 for(let i=0;i<30;i++)stepView(b.camera,b.target,new Set(['KeyW']),1/30);
 near(a.camera.position.z,b.camera.position.z);
 const c=view();stepView(c.camera,c.target,new Set(['KeyW','ShiftLeft']),.05);near(c.camera.position.z,-.6);
 const d=view();stepView(d.camera,d.target,new Set(['KeyW','KeyS','KeyQ','KeyE']),.05);near(d.camera.position.length(),0);
});
test('focus loss key clear stops motion and long frame gaps are bounded',()=>{
 const {camera,target}=view(),keys=new Set(['KeyW']);stepView(camera,target,keys,100);near(camera.position.z,-.2);
 keys.clear();stepView(camera,target,keys,.05);near(camera.position.z,-.2);
});
test('FOV zoom never translates the camera, pitch and lens stay within limits',()=>{
 const {camera,target}=view();changeFov(camera,-1000);near(camera.fov,10);changeFov(camera,1000);near(camera.fov,120);
 near(camera.position.length(),0);turnView(camera,target,0,100);assert.ok(target.y<10);assert.ok(Number.isFinite(camera.quaternion.w));
});
test('ground snap uses actual bounds for raised and scaled objects',()=>{
 const m=new Group(),mesh=new Mesh(new BoxGeometry(1,1,1),new MeshBasicMaterial());mesh.position.y=.5;m.add(mesh);m.position.set(2,5,3);m.scale.setScalar(2);
 const position=Stage.prototype.groundPosition.call({time:0,apply(){},meshes:new Map([['box',m]])},'box');
 assert.deepEqual(position,[2,0,3]);mesh.geometry.dispose();mesh.material.dispose();
});
