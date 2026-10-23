import {Group,Mesh,CapsuleGeometry,CylinderGeometry,SphereGeometry,BoxGeometry,MeshStandardMaterial} from 'three';
export const actorVariants={
 adultMale:{name:'成年男性',height:1.8,head:.145,shoulder:.25,hip:.115,leg:.82,torso:.48,arm:.55},
 adultFemale:{name:'成年女性',height:1.65,head:.14,shoulder:.205,hip:.125,leg:.76,torso:.43,arm:.50},
 boy:{name:'男孩',height:1.15,head:.155,shoulder:.175,hip:.09,leg:.47,torso:.29,arm:.34},
 girl:{name:'女孩',height:1.10,head:.15,shoulder:.165,hip:.09,leg:.45,torso:.27,arm:.32}
};
export function buildActor(group,material,variant='adultMale'){
 const v=actorVariants[variant]||actorVariants.adultMale;
 const part=(parent,geometry,mat,position)=>{const m=new Mesh(geometry,mat);m.position.set(...position);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 const hipY=v.leg,shoulderY=hipY+v.torso,headY=v.height-v.head;
 const torso=part(group,new CapsuleGeometry(.16,v.torso-.1,6,12),material,[0,hipY+v.torso/2,0]);torso.scale.set(v.shoulder/.25,1,.72);
 const neckBottom=shoulderY-.02,neckTop=headY-v.head+.025;
 if(neckTop>neckBottom)part(group,new CylinderGeometry(v.head*.4,v.head*.45,neckTop-neckBottom,12),material,[0,(neckTop+neckBottom)/2,0]);
 part(group,new SphereGeometry(v.head,20,16),material,[0,headY,0]);
 const faceMat=new MeshStandardMaterial({color:'#354347',roughness:.8});
 part(group,new BoxGeometry(v.head*.8,.035,.012),faceMat,[0,headY+.02,v.head*.95]);
 // Hair silhouettes are restrained, clothed previz figures with separate child proportions.
 if(variant==='adultFemale'||variant==='girl'){
  const hair=part(group,new SphereGeometry(v.head*1.06,16,12,0,Math.PI*2,0,Math.PI*.43),faceMat,[0,headY,0]);hair.scale.z=1.03;
 }
 group.userData.limbs=[];
 for(const side of [-1,1]){
  const arm=new Group();arm.position.set(side*v.shoulder,shoulderY,0);
  part(arm,new CapsuleGeometry(v.arm*.10,v.arm*.80,4,10),material,[0,-v.arm/2,0]);group.add(arm);
  const leg=new Group();leg.position.set(side*v.hip,hipY,0);
  part(leg,new CapsuleGeometry(v.leg*.087,v.leg*.75,4,10),material,[0,-v.leg*.47,0]);
  part(leg,new BoxGeometry(v.hip*1.2,.08,v.leg*.26),material,[0,-v.leg+.04,v.leg*.055]);group.add(leg);
  group.userData.limbs.push(arm,leg);
 }
 group.userData.actorVariant=variant;
}
