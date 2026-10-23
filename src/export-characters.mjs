import {Group,Mesh,CapsuleGeometry,SphereGeometry,MeshStandardMaterial} from 'three';

// Classification comes from asset metadata or the generated node, never from names or bones.
export function exportCharacterCandidates(project,catalog=[]){
 return project.objects.flatMap(o=>{
  if(o.type==='actor')return [{id:o.id,name:o.name,automatic:true}];
  if(o.type!=='model')return [];
  const node=project.nodes.find(n=>n.type==='model'&&n.objectId===o.id),asset=catalog.find(a=>(a.file.startsWith('/assets/')?a.file:'/assets/'+a.file)===o.modelSrc);
  if(node?.modelKind)return node.modelKind==='human'?[{id:o.id,name:o.name,automatic:true}]:[];
  if(asset)return asset.category==='character'?[{id:o.id,name:o.name,automatic:true}]:[];
  return [{id:o.id,name:o.name,automatic:false}];
 });
}
export function createSimplifiedCharacter(size){
 const h=Math.max(.1,size.y),width=Math.min(h*.42,Math.max(h*.22,size.x)),depth=Math.min(h*.32,Math.max(h*.16,size.z));
 const group=new Group(),material=new MeshStandardMaterial({color:'#dbd9d1',roughness:.92});
 const body=new Mesh(new CapsuleGeometry(1,2,8,16),material);body.scale.set(width/2,h*.81/4,depth/2);body.position.y=h*.405;
 const head=new Mesh(new SphereGeometry(1,20,16),material);head.scale.set(h*.085,h*.095,h*.08);head.position.y=h*.905;
 // A restrained front marker makes the character's heading readable, without facial detail.
 const front=new Mesh(new SphereGeometry(1,12,8),new MeshStandardMaterial({color:'#a5a49e',roughness:1}));front.scale.set(h*.025,h*.014,h*.008);front.position.set(0,h*.91,h*.079);
 group.add(body,head,front);group.traverse(m=>{if(m.isMesh)m.castShadow=m.receiveShadow=true});return group;
}
export function disposeSimplifiedCharacters(proxies){
 const geometries=new Set(),materials=new Set();for(const proxy of proxies.values()){proxy.removeFromParent();proxy.traverse(m=>{if(m.geometry)geometries.add(m.geometry);if(m.material)materials.add(m.material)})}for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
}
// Overrides exist for the synchronous render only, also restoring the scene on render errors.
export function withSimplifiedCharacters(scene,meshes,proxies,render){
 const restore=[];
 try{
  for(const [id,proxy] of proxies){const original=meshes.get(id);if(!original||!original.visible)continue;restore.push([original,original.visible]);proxy.position.copy(original.position);proxy.quaternion.copy(original.quaternion);proxy.scale.copy(original.scale);original.visible=false;scene.add(proxy);}
  return render();
 }finally{for(const [original,visible] of restore)original.visible=visible;for(const proxy of proxies.values())proxy.removeFromParent();}
}
