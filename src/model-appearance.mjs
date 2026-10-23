import {Color} from 'three';
// Skeleton clones share source materials. Clone materials per instance, but retain textures.
export function prepareModelMaterials(scene){
 const unique=new Map();let bones=0,skinnedMeshes=0;
 scene.traverse(mesh=>{if(mesh.isBone)bones++;if(mesh.isSkinnedMesh)skinnedMeshes++;if(!mesh.isMesh)return;
 const copy=source=>{if(!unique.has(source)){const material=source.clone();unique.set(source,{material,color:source.color?.clone(),map:source.map,vertexColors:source.vertexColors,emissive:source.emissive?.clone(),emissiveMap:source.emissiveMap});}return unique.get(source).material;};
 mesh.material=Array.isArray(mesh.material)?mesh.material.map(copy):copy(mesh.material);
 });return {materials:[...unique.values()],bones,skinnedMeshes};
}
export function applyModelAppearance(data,mode='original',hex='#ffffff'){
 if(!data?.materials)return;const signature=mode+hex;if(data.appearanceSignature===signature)return;
 const tint=new Color(hex);
 for(const base of data.materials){const m=base.material,solid=mode==='solid';if(!base.color)continue;
 m.color.copy(mode==='original'?base.color:solid?tint:base.color.clone().multiply(tint));
 const map=solid?null:base.map,vertices=solid?false:base.vertexColors;
 if(m.map!==map||m.vertexColors!==vertices||m.emissiveMap!==(solid?null:base.emissiveMap))m.needsUpdate=true;
 m.map=map;m.vertexColors=vertices;
 if(base.emissive){m.emissive.copy(solid?new Color(0):base.emissive);m.emissiveMap=solid?null:base.emissiveMap;}
 }data.appearanceSignature=signature;
}
export function disposeModelMaterials(data){for(const base of data?.materials||[])base.material.dispose();}
