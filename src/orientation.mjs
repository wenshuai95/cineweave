import {PerspectiveCamera,Vector3,MathUtils} from 'three';

export function cameraQuaternion(position,target,roll=0){
 const camera=new PerspectiveCamera();camera.position.fromArray(position);camera.lookAt(new Vector3(...target));camera.rotateZ(MathUtils.degToRad(roll));return camera.quaternion.clone();
}
export function cameraAimFromQuaternion(position,quaternion,distance,previousRoll=0){
 const target=new Vector3(...position).add(new Vector3(0,0,-1).applyQuaternion(quaternion).multiplyScalar(distance)).toArray();
 const relative=cameraQuaternion(position,target).invert().multiply(quaternion);
 let roll=MathUtils.radToDeg(2*Math.atan2(relative.z,relative.w));
 roll+=360*Math.round((previousRoll-roll)/360);
 return {target,roll};
}
