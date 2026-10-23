import {recordingFormat} from './video-format.mjs';
import {lastFrameTime} from './shot-reference.mjs';
import {createSimplifiedCharacter,disposeSimplifiedCharacters,withSimplifiedCharacters} from './export-characters.mjs';
import {DEFAULT_GROUND_COLOR} from './ground-colors.mjs';
import {draftPathEdit} from './path-edit.mjs';
import {prepareModelMaterials,applyModelAppearance,disposeModelMaterials} from './model-appearance.mjs';
import * as THREE from 'three';
import {normalizeAsset,visibleBounds} from './asset-geometry.mjs';
import {buildActor,actorVariants} from './actors.mjs';
import {cameraQuaternion,cameraAimFromQuaternion} from './orientation.mjs';
import {DirectorNavigation} from './navigation.mjs';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {formatFor,editorVisible,positionTimes} from './director.mjs';
import {loadAsset} from './asset-loader.mjs';
import {sampleObject,activeCamera} from './model.mjs';
export class Stage {
 constructor(host,preview,onSelect,onTransform,onTarget=()=>{},onInteraction=()=>{}){
 this.onTarget=onTarget;this.onInteraction=onInteraction;this.targetEditing=false;this.showTarget=true;this.paramPreview=null;this.targetDrag=null;this.host=host;this.previewHost=preview;this.onSelect=onSelect;this.onTransform=onTransform;this.meshes=new Map();this.p=null;this.time=0;
 this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#293035');this.scene.fog=new THREE.Fog('#293035',35,90);
 this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;host.append(this.renderer.domElement);
 this.camera=new THREE.PerspectiveCamera(42,1,.05,200);this.camera.position.set(12,10,13);
 this.selectedId=null;this.tool='translate';
 this.scene.add(new THREE.HemisphereLight(0xd5e6ec,0x676053,2.1));const sun=new THREE.DirectionalLight(0xffe4bc,3.1);sun.position.set(-6,12,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-20;sun.shadow.camera.right=20;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;sun.shadow.bias=-.0003;this.scene.add(sun);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:DEFAULT_GROUND_COLOR,roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;this.floor=floor;this.scene.add(floor);
 this.grid=new THREE.GridHelper(60,60,0x80918f,0x566265);this.grid.position.y=.005;this.grid.material.transparent=true;this.grid.material.opacity=.27;this.scene.add(this.grid);
 this.pathSelection=null;this.assetPromises=new Set();this.paths=new THREE.Group();this.scene.add(this.paths);
 this.transform=new TransformControls(this.camera,this.renderer.domElement);this.scene.add(this.transform.getHelper());this.transform.addEventListener('dragging-changed',e=>{this.orbit.enabled=!e.value;if(e.value)this.onInteraction(this.selectedId);if(!e.value&&this.transform.object){const m=this.transform.object;if(m.userData.pathEditor){this.pathPreview=null;this.onPathEdit?.(m.userData.pathEditor,m.position.toArray());return;}const o=this.p.objects.find(o=>o.id===m.userData.id);let target=null,roll=null;if(o?.type==='camera'&&this.transform.getMode()==='rotate'){const old=sampleObject(o,this.time);const distance=Math.max(1,m.position.distanceTo(new THREE.Vector3(...old.target)));({target,roll}=cameraAimFromQuaternion(m.position.toArray(),m.quaternion,distance,old.roll));}this.onTransform(m.userData.id,[m.position.x,m.position.y,m.position.z],[m.rotation.x,m.rotation.y,m.rotation.z].map(THREE.MathUtils.radToDeg),m.scale.x,target,roll);}});
 this.transform.addEventListener('objectChange',()=>{if(this.transform.dragging&&this.transform.object?.userData.pathEditor)this.previewPathEdit();if(this.transform.dragging&&this.transform.getMode()==='scale'&&this.transform.object){const m=this.transform.object,axis=this.transform.axis;const value=axis==='Y'?m.scale.y:axis==='Z'?m.scale.z:m.scale.x;m.scale.setScalar(Math.max(.1,Math.min(20,value)));}});
 this.targetVisual=new THREE.Group();this.scene.add(this.targetVisual);
 this.targetDot=new THREE.Mesh(new THREE.SphereGeometry(.16,20,14),new THREE.MeshBasicMaterial({color:0xff394e,depthTest:false,depthWrite:false}));this.targetDot.renderOrder=1000;this.targetVisual.add(this.targetDot);
 this.targetLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:0xff5d6e,dashSize:.15,gapSize:.1,transparent:true,opacity:.7,depthTest:false,depthWrite:false}));this.targetLine.renderOrder=999;this.targetVisual.add(this.targetLine);
 this.targetTransform=new TransformControls(this.camera,this.renderer.domElement);this.targetTransform.setMode('translate');this.targetTransform.setSize(.7);this.scene.add(this.targetTransform.getHelper());
 this.targetTransform.addEventListener('dragging-changed',e=>{this.orbit.enabled=!e.value;if(e.value)this.onInteraction(this.selectedId);else this.finishTarget();});
 this.orbit=new DirectorNavigation(this.camera,this.renderer.domElement,()=>!this.transform.axis&&!this.transform.dragging&&!this.targetTransform.axis&&!this.targetTransform.dragging);
 this.ray=new THREE.Raycaster();let start;
 const canvas=this.renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||!this.targetVisual.visible||this.targetTransform.axis||this.transform.axis)return;
  this.pointerRay(e);if(!this.ray.intersectObject(this.targetDot).length)return;
  e.stopImmediatePropagation();e.preventDefault();this.onInteraction(this.selectedId);canvas.focus({preventScroll:true});
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()),this.targetDot.position);
  const hit=this.ray.ray.intersectPlane(plane,new THREE.Vector3());if(!hit)return;
  this.targetDrag={id:e.pointerId,plane,offset:this.targetDot.position.clone().sub(hit),original:this.targetDot.position.clone()};
  this.orbit.clear();this.orbit.enabled=false;canvas.setPointerCapture(e.pointerId);
 },true);
 canvas.addEventListener('pointermove',e=>{if(!this.targetDrag||this.targetDrag.id!==e.pointerId)return;e.stopImmediatePropagation();this.pointerRay(e);const hit=this.ray.ray.intersectPlane(this.targetDrag.plane,new THREE.Vector3());if(hit)this.targetDot.position.copy(hit.add(this.targetDrag.offset)).clampScalar(-1000,1000);},true);
 const releaseTarget=(e,cancel=false)=>{if(!this.targetDrag||this.targetDrag.id!==e.pointerId)return;e.stopImmediatePropagation();if(cancel)this.targetDot.position.copy(this.targetDrag.original);this.targetDrag=null;this.orbit.enabled=true;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!cancel)this.finishTarget();};
 canvas.addEventListener('pointerup',e=>releaseTarget(e),true);canvas.addEventListener('pointercancel',e=>releaseTarget(e,true),true);
 window.addEventListener('blur',()=>{if(this.targetDrag)releaseTarget({pointerId:this.targetDrag.id,stopImmediatePropagation(){}},true)});

 this.renderer.domElement.addEventListener('pointerdown',e=>{start=e.button===0?[e.clientX,e.clientY]:null;});
 this.renderer.domElement.addEventListener('pointerup',e=>{if(!start||Math.hypot(e.clientX-start[0],e.clientY-start[1])>4||this.transform.axis||this.targetTransform.axis)return;const r=this.renderer.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);this.ray.params.Line.threshold=.12;
 const pathHits=this.ray.intersectObjects(this.paths.children,true).filter(h=>h.object.visible&&h.object.userData.pathEditor&&!this.p.objects.find(o=>o.id===h.object.userData.pathEditor.id)?.locked),ph=pathHits.find(h=>h.object.userData.pathEditor.kind!=='line')||pathHits[0];
 const hits=this.ray.intersectObjects([...this.meshes.values()].filter(m=>m.visible),true);
 if(ph&&(ph.object.userData.pathEditor.kind!=='line'||!hits.length)){const data=ph.object.userData.pathEditor;this.onSelect(data.id);if(data.kind==='line'){const o=this.p.objects.find(o=>o.id===data.id),t=positionTimes(o).reduce((best,t)=>new THREE.Vector3(...sampleObject(o,t).position).distanceToSquared(ph.point)<new THREE.Vector3(...sampleObject(o,best).position).distanceToSquared(ph.point)?t:best);const point={id:data.id,t,kind:'point'};this.selectPath(point);this.onPathSelect?.(point);return;}this.selectPath(data);this.onPathSelect?.(data);return;}
 if(hits.length){let m=hits[0].object;while(m&&!m.userData.id)m=m.parent;if(m)this.onSelect(m.userData.id);}else this.onSelect(null);});
 this.previewRenderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});this.previewRenderer.setSize(640,360);this.previewRenderer.shadowMap.enabled=true;this.previewRenderer.outputColorSpace=THREE.SRGBColorSpace;preview.append(this.previewRenderer.domElement);
 this.shotCamera=new THREE.PerspectiveCamera(45,16/9,.05,200);
 this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
 }
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 material(color){return new THREE.MeshStandardMaterial({color,roughness:.7});}
 part(group,geo,mat,pos){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
 make(o){const g=new THREE.Group();g.userData.id=o.id;const mat=this.material(o.color);g.userData.bodyMaterial=mat;
 if(o.type==='model'){
 const placeholder=this.part(g,new THREE.BoxGeometry(.6,.6,.6),mat,[0,.3,0]);placeholder.material.wireframe=true;
 const pending=loadAsset(o.modelSrc).then(({scene,animations})=>{
  if(this.meshes.get(o.id)!==g)return;
  g.remove(placeholder);placeholder.geometry.dispose();placeholder.material.dispose();
  Object.assign(g.userData,prepareModelMaterials(scene));
  const normalized=normalizeAsset(scene,o.modelSize||2);g.userData.exportSize=visibleBounds(normalized).getSize(new THREE.Vector3());
  scene.traverse(m=>{if(m.isMesh){m.castShadow=m.receiveShadow=true;}});g.add(normalized);g.userData.clips=animations;g.userData.mixer=new THREE.AnimationMixer(scene);g.userData.loaded=true;this.onAssetLoaded?.(o.id,animations.map(a=>a.name));
 }).catch(e=>{g.userData.loadError=e.message;this.onAssetError?.(o.name,e.message)}).finally(()=>this.assetPromises.delete(pending));this.assetPromises.add(pending);
 }else if(o.type==='actor'){
 buildActor(g,mat,o.actorVariant);
 }else if(o.type==='camera'){
 this.part(g,new THREE.BoxGeometry(.42,.3,.5),mat,[0,0,0]);const lens=this.part(g,new THREE.CylinderGeometry(.12,.17,.25,12),mat,[0,0,-.35]);lens.rotation.x=Math.PI/2;
 const points=[new THREE.Vector3(0,0,-.4),new THREE.Vector3(-.65,-.36,-1.3),new THREE.Vector3(.65,-.36,-1.3),new THREE.Vector3(0,0,-.4),new THREE.Vector3(.65,.36,-1.3),new THREE.Vector3(-.65,.36,-1.3),new THREE.Vector3(0,0,-.4),new THREE.Vector3(-.65,-.36,-1.3),new THREE.Vector3(-.65,.36,-1.3),new THREE.Vector3(.65,.36,-1.3),new THREE.Vector3(.65,-.36,-1.3)];g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:o.color,transparent:true,opacity:.7})));
 }else if(o.type==='wall'){this.part(g,new THREE.BoxGeometry(12,3,.3),mat,[0,1.5,0]);}
 else if(o.type==='table'){this.part(g,new THREE.BoxGeometry(2,.14,1),mat,[0,.9,0]);for(const x of [-.8,.8])for(const z of [-.35,.35])this.part(g,new THREE.BoxGeometry(.1,.86,.1),mat,[x,.43,z]);}
 else if(o.type==='pillar'){this.part(g,new THREE.CylinderGeometry(.3,.34,3.5,16),mat,[0,1.75,0]);this.part(g,new THREE.BoxGeometry(.85,.18,.85),mat,[0,.09,0]);}
 else this.part(g,new THREE.BoxGeometry(1,1,1),mat,[0,.5,0]);
 return g;
 }
 rebuild(p){this.p=p;this.targetTransform.detach();this.targetEditing=false;this.targetDrag=null;this.transform.detach();for(const m of this.meshes.values()){this.scene.remove(m);disposeModelMaterials(m.userData);m.traverse(n=>{if(m.userData.loaded)return;n.geometry?.dispose();if(n.material)Array.isArray(n.material)?n.material.forEach(a=>a.dispose()):n.material.dispose()});}this.meshes.clear();for(const o of p.objects){const m=this.make(o);this.meshes.set(o.id,m);this.scene.add(m);}this.updatePaths();this.apply(this.time);}
 updatePaths(){
 const selection=this.pathSelection;if(this.transform.object?.userData.pathEditor)this.transform.detach();this.pathSelection=null;this.pathPreview=null;
 for(const c of [...this.paths.children]){this.paths.remove(c);c.geometry?.dispose();c.material?.dispose();}
 for(const o of this.p.objects){const times=positionTimes(o);if(times.length<2||!editorVisible(o,this.p.objects))continue;
 const points=[];for(let t=times[0];t<=times.at(-1)+.001;t+=Math.max(.05,(times.at(-1)-times[0])/300))points.push(new THREE.Vector3(...sampleObject(o,Math.min(t,times.at(-1))).position));points.push(new THREE.Vector3(...sampleObject(o,times.at(-1)).position));
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:o.id===this.selectedId?0xffd98a:o.color,transparent:true,opacity:.75}));line.userData.pathEditor={id:o.id,kind:'line'};this.paths.add(line);
 for(const t of times){const pos=new THREE.Vector3(...sampleObject(o,t).position),dot=new THREE.Mesh(new THREE.SphereGeometry(.085,12,8),new THREE.MeshBasicMaterial({color:o.id===this.selectedId?0xffd98a:o.color,depthTest:false}));dot.position.copy(pos);dot.renderOrder=800;dot.userData.pathEditor={id:o.id,t,kind:'point'};this.paths.add(dot);
 if(o.id===this.selectedId){const handles=o.pathHandles?.find(k=>Math.abs(k.t-t)<.0001);for(const kind of ['in','out'])if(handles?.[kind]&&(kind==='in'?t>times[0]:t<times.at(-1))){const h=new THREE.Mesh(new THREE.OctahedronGeometry(.09),new THREE.MeshBasicMaterial({color:kind==='in'?0x91d7e8:0xd5a4ef,depthTest:false}));h.position.copy(pos).add(new THREE.Vector3(...handles[kind]));h.userData.pathEditor={id:o.id,t,kind};h.renderOrder=800;this.paths.add(h);const connector=new THREE.Line(new THREE.BufferGeometry().setFromPoints([pos,h.position]),new THREE.LineBasicMaterial({color:0xa4b2bd,transparent:true,opacity:.7}));connector.userData.pathConnector={id:o.id,t,kind};this.paths.add(connector);}}
 }
 }
 if(selection)this.selectPath(selection);
 }

 selectPath(data){
 const o=this.p.objects.find(o=>o.id===data.id);if(!o||o.locked||!editorVisible(o,this.p.objects))return false;
 const handle=this.paths.children.find(x=>x.userData.pathEditor?.id===data.id&&Math.abs(x.userData.pathEditor?.t-data.t)<.0001&&x.userData.pathEditor?.kind===data.kind);if(!handle)return false;
 this.pathSelection={...data};this.pathPreview=null;this.targetEditing=false;this.tool='translate';this.targetTransform.detach();this.transform.setMode('translate');this.transform.setSpace('world');this.transform.showX=this.transform.showY=this.transform.showZ=true;this.transform.attach(handle);this.updateTarget();return true;
 }
 previewPathEdit(){
 const handle=this.transform.object,data=handle?.userData.pathEditor,o=this.p.objects.find(o=>o.id===data?.id);if(!o)return;
 try{this.pathPreview=draftPathEdit(o,data,handle.position.toArray());}catch{return;}
 for(const child of this.paths.children){const d=child.userData.pathEditor;if(d?.id!==o.id||d.kind!=='line')continue;const points=child.geometry.attributes.position,times=positionTimes(o);for(let i=0;i<points.count;i++)points.setXYZ(i,...sampleObject(this.pathPreview,times[0]+(times.at(-1)-times[0])*i/(points.count-1)).position);points.needsUpdate=true;child.geometry.computeBoundingSphere();}
 for(const child of this.paths.children){const d=child.userData.pathEditor;if(d?.id!==o.id||d.kind==='line')continue;const pos=sampleObject(this.pathPreview,d.t).position;if(d.kind!=='point'){const h=this.pathPreview.pathHandles?.find(k=>Math.abs(k.t-d.t)<.0001);if(h?.[d.kind])for(let i=0;i<3;i++)pos[i]+=h[d.kind][i];}if(child!==handle)child.position.set(...pos);}
 for(const child of this.paths.children){const d=child.userData.pathConnector;if(d?.id!==o.id)continue;const pos=sampleObject(this.pathPreview,d.t).position,h=this.pathPreview.pathHandles?.find(k=>Math.abs(k.t-d.t)<.0001)?.[d.kind];if(h){const attr=child.geometry.attributes.position;attr.setXYZ(0,...pos);attr.setXYZ(1,...pos.map((v,i)=>v+h[i]));attr.needsUpdate=true;child.geometry.computeBoundingSphere();}}
 }

 select(id){this.pathSelection=null;this.pathPreview=null;if(this.selectedId!==id)this.targetEditing=false;this.selectedId=id;const m=this.meshes.get(id);this.targetTransform.detach();if(m&&!this.p.objects.find(o=>o.id===id)?.locked&&editorVisible(this.p.objects.find(o=>o.id===id),this.p.objects)&&this.tool!=='select'&&!this.targetEditing)this.transform.attach(m);else this.transform.detach();this.updateTarget();if(this.targetVisual.visible)this.targetTransform.attach(this.targetDot);this.updatePaths();}
 pointerRay(e){const r=this.renderer.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);}
 editingTarget(enabled=true){this.targetEditing=enabled;this.showTarget=true;this.select(this.selectedId);}
 stateFor(o,t){if(this.pathPreview?.id===o.id)return sampleObject(this.pathPreview,t);const s=this.paramPreview?.id===o.id?this.paramPreview.state:sampleObject(o,t);return o.id===this.selectedId&&(this.targetDrag||this.targetTransform.dragging)?{...s,target:this.targetDot.position.toArray()}:s;}
 updateTarget(){const o=this.p?.objects.find(o=>o.id===this.selectedId&&o.type==='camera');this.targetVisual.visible=!!o&&!o.locked&&editorVisible(o,this.p.objects)&&this.showTarget&&!this.pathSelection;if(!this.targetVisual.visible){this.targetTransform.detach();return}const s=this.stateFor(o,this.time);if(!this.targetDrag&&!this.targetTransform.dragging)this.targetDot.position.set(...s.target);this.targetDot.scale.setScalar(Math.max(.6,this.camera.position.distanceTo(this.targetDot.position)*.04));const a=this.targetLine.geometry.attributes.position;a.setXYZ(0,...s.position);a.setXYZ(1,...this.targetDot.position.toArray());a.needsUpdate=true;this.targetLine.geometry.computeBoundingSphere();this.targetLine.computeLineDistances();}
 finishTarget(){const o=this.p?.objects.find(o=>o.id===this.selectedId);if(!o)return;const next=this.targetDot.position.clone().clampScalar(-1000,1000);if(next.distanceToSquared(new THREE.Vector3(...sampleObject(o,this.time).target))>1e-10)this.onTarget(o.id,next.toArray());}

 mode(mode){this.targetEditing=false;this.tool=mode;this.select(this.selectedId);if(mode==='select')return;this.transform.setMode(mode);this.transform.showX=true;this.transform.showY=true;this.transform.showZ=true}
 frameSelection(){if(this.pathSelection){const box=new THREE.Box3();for(const child of this.paths.children)if(child.userData.pathEditor?.id===this.pathSelection.id)box.expandByObject(child);if(!box.isEmpty()){const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());this.orbit.clear();this.orbit.target.copy(center);this.camera.position.copy(center).add(new THREE.Vector3(1,.8,1.3).normalize().multiplyScalar(Math.max(3,size.length()*1.8)));this.camera.lookAt(center);return;}}const m=this.targetEditing?this.targetDot:this.meshes.get(this.selectedId);if(!m)return;this.orbit.clear();const bounds=visibleBounds(m),center=bounds.isEmpty()?m.position.clone():bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());const radius=Math.max(.3,size.length()/2),distance=Math.max(1.2,radius/Math.sin(THREE.MathUtils.degToRad(this.camera.fov)/2)*1.2);this.orbit.target.copy(center);this.camera.position.copy(center).add(new THREE.Vector3(1,.6,1.3).normalize().multiplyScalar(distance));this.camera.lookAt(center);}

 viewPreset(v){this.orbit.clear();this.camera.fov=42;this.camera.updateProjectionMatrix();this.orbit.target.set(0,1,0);this.camera.position.set(...({perspective:[12,10,13],top:[0,20,.01],front:[0,4,16]}[v]));}
 apply(t){this.time=t;if(!this.p)return;const ground=this.p.groundColor||DEFAULT_GROUND_COLOR;if(this.groundColor!==ground){this.floor.material.color.set(ground);this.groundColor=ground;}for(const o of this.p.objects){const s=this.stateFor(o,t),m=this.meshes.get(o.id);m.visible=editorVisible(o,this.p.objects);if(this.transform.dragging&&this.transform.object===m)continue;m.position.set(...s.position);m.rotation.set(...[s.rotationX,s.rotation,s.rotationZ].map(THREE.MathUtils.degToRad));m.scale.setScalar(s.scale);if(o.type==='model')applyModelAppearance(m.userData,o.modelColorMode||'original',s.modelTint);if(o.type!=='model'&&m.userData.lastColor!==s.color){m.userData.bodyMaterial.color.set(s.color);m.userData.lastColor=s.color;}if(o.type==='camera'){m.quaternion.copy(cameraQuaternion(s.position,s.target,s.roll));}if(o.type==='model'&&m.userData.mixer){const clip=m.userData.clips.find(a=>a.name===s.modelClip);if(m.userData.clipName!==s.modelClip){m.userData.mixer.stopAllAction();if(clip)m.userData.mixer.clipAction(clip).play();m.userData.clipName=s.modelClip;}if(clip)m.userData.mixer.setTime(s.actionTime??t);}if(o.type==='actor'){const limbs=m.userData.limbs;limbs.forEach(l=>l.rotation.set(0,0,0));if(s.pose==='walk'||s.pose==='run'){const speed=s.pose==='run'?12:7,amp=s.pose==='run'?.95:.55;limbs.forEach((l,i)=>l.rotation.x=Math.sin((s.actionTime??t)*speed+(i===0||i===3?0:Math.PI))*amp);}if(s.pose==='sit'){limbs[1].rotation.x=-Math.PI/2;limbs[3].rotation.x=-Math.PI/2;}if(s.pose==='point')limbs[0].rotation.x=-Math.PI/2;if(s.pose==='wave'){limbs[0].rotation.z=-2.5+Math.sin((s.actionTime??t)*8)*.3;}if(s.pose==='cheer'){limbs[0].rotation.z=-2.5;limbs[2].rotation.z=2.5;limbs[0].rotation.x=limbs[2].rotation.x=Math.sin((s.actionTime??t)*6)*.2;}}}
 }
 setShotCamera(t,override){const o=this.p.objects.find(o=>o.id===override)||activeCamera(this.p,t);if(!o)return;const s=this.stateFor(o,t);this.shotCamera.position.set(...s.position);this.shotCamera.quaternion.copy(cameraQuaternion(s.position,s.target,s.roll));this.shotCamera.fov=s.fov;const format=formatFor(o);this.shotCamera.aspect=format.width/format.height;this.shotCamera.updateProjectionMatrix();return o;}
 cleanRender(renderer,camera,proxies=null){
 const objects=[this.transform.getHelper(),this.targetVisual,this.targetTransform.getHelper(),this.grid,this.paths,...this.p.objects.filter(o=>o.type==='camera').map(o=>this.meshes.get(o.id))];
 const solidObjects=this.p.objects.filter(o=>o.type!=='camera'),solids=solidObjects.map(o=>this.meshes.get(o.id)),solidVisibility=solids.map(o=>o.visible);solids.forEach((m,i)=>m.visible=!solidObjects[i].hidden);const visibility=objects.map(o=>o.visible);objects.forEach(o=>o.visible=false);
 try{if(proxies?.size)withSimplifiedCharacters(this.scene,this.meshes,proxies,()=>renderer.render(this.scene,camera));else renderer.render(this.scene,camera)}finally{objects.forEach((o,i)=>o.visible=visibility[i]);solids.forEach((o,i)=>o.visible=solidVisibility[i])}
 }

 groundPosition(id){this.apply(this.time);const m=this.meshes.get(id);if(!m)return null;const box=visibleBounds(m);return [m.position.x,m.position.y-box.min.y,m.position.z];}
 render(t,override,elapsed=0){if(!this.p)return;this.apply(t);this.orbit.update(elapsed);this.updateTarget();if(this.host.clientWidth)this.renderer.render(this.scene,this.camera);const o=this.setShotCamera(t,override),f=formatFor(o);if(this.previewAspect!==o?.aspect){this.previewRenderer.setSize(Math.round(f.width/2),Math.round(f.height/2));this.previewHost.style.aspectRatio=`${f.width}/${f.height}`;this.previewHost.style.width=`min(100%, ${240*f.width/f.height}px)`;this.previewAspect=o?.aspect;}this.cleanRender(this.previewRenderer,this.shotCamera);}
 createExportCharacters(ids=[]){
 const proxies=new Map();try{for(const id of new Set(ids)){const m=this.meshes.get(id),o=this.p.objects.find(o=>o.id===id);if(!m||!['actor','model'].includes(o?.type))continue;
 const size=m.userData.exportSize||(o.type==='actor'?new THREE.Vector3(.45,(actorVariants[o.actorVariant]||actorVariants.adultMale).height,.3):new THREE.Vector3(.45,o.modelSize||1.8,.3));
 proxies.set(id,createSimplifiedCharacter(size));}return proxies;}catch(error){disposeSimplifiedCharacters(proxies);throw error;}
 }
 screenshot(t,override,options={}){this.apply(t);const o=this.setShotCamera(t,override),f=formatFor(o),proxies=this.createExportCharacters(options.simplifiedCharacterIds);
 try{const width=Number.isFinite(options.previewWidth)?Math.max(32,Math.min(f.width,Math.round(options.previewWidth))):f.width;this.previewRenderer.setSize(width,Math.max(1,Math.round(f.height*width/f.width)));this.cleanRender(this.previewRenderer,this.shotCamera,proxies);return this.previewRenderer.domElement.toDataURL('image/png');}
 finally{disposeSimplifiedCharacters(proxies);this.previewRenderer.setSize(Math.round(f.width/2),Math.round(f.height/2));}}
 depthShot(t,override,options={}){this.apply(t);const o=this.setShotCamera(t,override),f=formatFor(o),proxies=this.createExportCharacters(options.simplifiedCharacterIds);
 try{this.previewRenderer.setSize(f.width,f.height);const bg=this.scene.background,fog=this.scene.fog,om=this.scene.overrideMaterial,cn=this.shotCamera.near,cf=this.shotCamera.far;this.scene.background=new THREE.Color('#000000');this.scene.fog=null;this.shotCamera.near=.5;this.shotCamera.far=45;this.scene.overrideMaterial=this._depthMaterial||(this._depthMaterial=new THREE.MeshDepthMaterial());this.cleanRender(this.previewRenderer,this.shotCamera,proxies);const c=document.createElement('canvas');c.width=f.width;c.height=f.height;const g=c.getContext('2d');g.drawImage(this.previewRenderer.domElement,0,0);const d=g.getImageData(0,0,c.width,c.height);let mn=255,mx=0;for(let i=0;i<d.data.length;i+=4){const v=d.data[i];if(v<mn)mn=v;if(v>mx)mx=v}const rng=Math.max(1,mx-mn);for(let i=0;i<d.data.length;i+=4){const v=Math.round((d.data[i]-mn)*255/rng);d.data[i]=d.data[i+1]=d.data[i+2]=v}g.putImageData(d,0,0);this.shotCamera.near=cn;this.shotCamera.far=cf;this.scene.overrideMaterial=om;this.scene.background=bg;this.scene.fog=fog;return c.toDataURL('image/png');}
 finally{disposeSimplifiedCharacters(proxies);this.previewRenderer.setSize(Math.round(f.width/2),Math.round(f.height/2));}
 }
 async readyAssets(){await Promise.all([...this.assetPromises]);const bad=[...this.meshes.values()].find(m=>m.userData.loadError);if(bad)throw new Error('有模型加载失败，请先重新导入或删除该模型');}

 async exportVideo(p,onProgress,signal,options={}){
 await this.readyAssets();const start=options.start??0,end=options.end??p.duration,override=options.cameraId||null,format=options.format||formatFor(p.objects.find(o=>o.id===override)||activeCamera(p,start));
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw new Error('此浏览器不支持视频导出，请使用 Chrome 或 Edge。');
 const recording=recordingFormat(options.container||'webm',m=>MediaRecorder.isTypeSupported(m)),mime=recording.mime;
 const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(format.width,format.height);r.shadowMap.enabled=true;r.outputColorSpace=THREE.SRGBColorSpace;const stream=r.domElement.captureStream(p.fps);const chunks=[];const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});
 let proxies=new Map();
 try{proxies=this.createExportCharacters(options.simplifiedCharacterIds);const finish=new Promise((resolve,reject)=>{rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onstop=()=>resolve(new Blob(chunks,{type:recording.type}));rec.onerror=e=>reject(e.error||new Error('录制失败'));});
 const draw=t=>{this.apply(t);const o=this.setShotCamera(t,override),f=formatFor(o),scale=Math.min(format.width/f.width,format.height/f.height),w=Math.round(f.width*scale),h=Math.round(f.height*scale);r.setScissorTest(false);r.setViewport(0,0,format.width,format.height);r.setClearColor(0x000000);r.clear();r.setViewport(Math.floor((format.width-w)/2),Math.floor((format.height-h)/2),w,h);r.setScissor(Math.floor((format.width-w)/2),Math.floor((format.height-h)/2),w,h);r.setScissorTest(true);this.cleanRender(r,this.shotCamera,proxies);r.setScissorTest(false);};draw(start);rec.start();const started=performance.now(),last=lastFrameTime(start,end,p.fps);
 await new Promise((resolve,reject)=>{const tick=()=>{if(signal.aborted){reject(new DOMException('已取消','AbortError'));return}const t=Math.min(end,start+(performance.now()-started)/1000);draw(Math.min(t,last));onProgress((t-start)/(end-start));if(t>=end){resolve();return}requestAnimationFrame(tick);};tick();});rec.stop();return await finish;
 }finally{disposeSimplifiedCharacters(proxies);if(rec.state!=='inactive')rec.stop();stream.getTracks().forEach(t=>t.stop());r.dispose();}
 }
}
