import {Box3,Vector3,Group} from 'three';

export function visibleBounds(root){
 // SkinnedMesh bind inverses and bone world matrices must be current before
 // measuring vertices; cached boxes from cloned FBX rigs can be 100x too big.
 root.updateMatrixWorld(true);
 return new Box3().setFromObject(root,true);
}
export function normalizeAsset(scene,longestSide){
 const bounds=visibleBounds(scene),size=bounds.getSize(new Vector3());
 const length=Math.max(size.x,size.y,size.z);
 if(!Number.isFinite(length)||length<=0)throw Error('模型没有可见的有效网格');
 const wrapper=new Group(),factor=longestSide/length,center=bounds.getCenter(new Vector3());
 wrapper.add(scene);wrapper.scale.setScalar(factor);
 wrapper.position.set(-center.x*factor,-bounds.min.y*factor,-center.z*factor);
 wrapper.updateMatrixWorld(true);
 scene.traverse(m=>{if(m.isSkinnedMesh){m.frustumCulled=false;m.boundingBox=null;m.boundingSphere=null;}});
 return wrapper;
}
