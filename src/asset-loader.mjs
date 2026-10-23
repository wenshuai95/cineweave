import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
const cache=new Map();
import {checkGLB} from './glb-format.mjs';
export {checkGLB} from './glb-format.mjs';
export async function loadAsset(src){
 if(!cache.has(src))cache.set(src,(async()=>{const response=await fetch(src);if(!response.ok)throw new Error('模型文件无法读取');const buffer=await response.arrayBuffer();checkGLB(buffer);return await new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,'',resolve,reject));})().catch(e=>{cache.delete(src);throw e}));
 const gltf=await cache.get(src);return {scene:clone(gltf.scene),animations:gltf.animations};
}
