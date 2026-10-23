import {Vector3,MathUtils} from 'three';

export const navigationCodes=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyI','KeyJ','KeyK','KeyL','Minus','Equal','NumpadSubtract','NumpadAdd']);

// Director navigation rotates around the viewer, leaving the shot camera intact.
export function turnView(camera,target,yaw,pitch){
 const direction=target.clone().sub(camera.position),distance=Math.max(.1,direction.length());
 const heading=Math.atan2(direction.x,-direction.z)+yaw;
 const elevation=MathUtils.clamp(Math.asin(MathUtils.clamp(direction.y/distance,-1,1))+pitch,-Math.PI/2+.01,Math.PI/2-.01);
 direction.set(Math.sin(heading)*Math.cos(elevation),Math.sin(elevation),-Math.cos(heading)*Math.cos(elevation));
 target.copy(camera.position).addScaledVector(direction,distance);camera.lookAt(target);
}
export function changeFov(camera,delta){camera.fov=MathUtils.clamp(camera.fov+delta,10,120);camera.updateProjectionMatrix();}
export function stepView(camera,target,keys,elapsed){
 const dt=MathUtils.clamp(elapsed||0,0,.05),boost=keys.has('ShiftLeft')||keys.has('ShiftRight')?3:1;
 const axis=(positive,negative)=>Number(keys.has(positive))-Number(keys.has(negative));
 turnView(camera,target,axis('KeyL','KeyJ')*dt*1.15*boost,axis('KeyI','KeyK')*dt*1.15*boost);
 const forward=target.clone().sub(camera.position).normalize();
 const right=new Vector3().crossVectors(forward,new Vector3(0,1,0)).normalize();
 const delta=forward.multiplyScalar(axis('KeyW','KeyS')).addScaledVector(right,axis('KeyD','KeyA'));
 delta.y+=axis('KeyE','KeyQ');
 if(delta.lengthSq()>1)delta.normalize();delta.multiplyScalar(dt*4*boost);
 camera.position.add(delta);target.add(delta);camera.lookAt(target);
 const zoom=Number(keys.has('Minus')||keys.has('NumpadSubtract'))-Number(keys.has('Equal')||keys.has('NumpadAdd'));
 if(zoom)changeFov(camera,zoom*dt*35);
}

export class DirectorNavigation {
 constructor(camera,element,canDrag){
  this.camera=camera;this.target=new Vector3(0,1,0);this.enabled=true;this.keys=new Set();this.pointer=null;
  element.style.touchAction='none';element.tabIndex=0;element.setAttribute('aria-label','导演视角，WASD 移动，QE 升降，IJKL 转向');
  element.addEventListener('contextmenu',e=>e.preventDefault());
  element.addEventListener('pointerdown',e=>{
   element.focus({preventScroll:true});
   if(!this.enabled||!canDrag()||![0,2].includes(e.button))return;
   this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY,button:e.button};element.setPointerCapture(e.pointerId);
  });
  element.addEventListener('pointermove',e=>{
   const p=this.pointer;if(!p||p.id!==e.pointerId||!this.enabled)return;
   const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
   if(p.button===0)turnView(camera,this.target,dx*.004,-dy*.004);
   else{
    const distance=Math.max(1,camera.position.distanceTo(this.target));
    const scale=2*distance*Math.tan(MathUtils.degToRad(camera.fov/2))/Math.max(1,element.clientHeight);
    const delta=new Vector3(1,0,0).applyQuaternion(camera.quaternion).multiplyScalar(-dx*scale)
     .addScaledVector(new Vector3(0,1,0).applyQuaternion(camera.quaternion),dy*scale);
    camera.position.add(delta);this.target.add(delta);
   }
  });
  const release=e=>{if(this.pointer?.id===e.pointerId)this.pointer=null;};
  element.addEventListener('pointerup',release);element.addEventListener('pointercancel',release);element.addEventListener('lostpointercapture',release);
  element.addEventListener('wheel',e=>{
   e.preventDefault();if(!this.enabled)return;
   const factor=e.deltaMode===1?16:e.deltaMode===2?element.clientHeight:1;
   if(e.altKey||e.ctrlKey)changeFov(camera,MathUtils.clamp(e.deltaY*factor*.06,-12,12));
   else turnView(camera,this.target,MathUtils.clamp(e.deltaX*factor*.003,-.3,.3),MathUtils.clamp(-e.deltaY*factor*.003,-.3,.3));
  },{passive:false});
  this.update();
 }
 clear(){this.keys.clear();this.pointer=null;}
 update(elapsed=0){if(this.enabled)stepView(this.camera,this.target,this.keys,elapsed);}
}
