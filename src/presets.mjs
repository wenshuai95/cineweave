import {Vector3,MathUtils} from 'three';
import {clone,frame,addKey,addParameterKey,parameterValue} from './model.mjs';

export const motions={
 push:{name:'推进',unit:'米',value:2},pull:{name:'拉远',unit:'米',value:2},
 truckLeft:{name:'左移',unit:'米',value:2},truckRight:{name:'右移',unit:'米',value:2},
 rise:{name:'升镜头',unit:'米',value:2},fall:{name:'降镜头',unit:'米',value:1},
 orbitLeft:{name:'左环绕',unit:'度',value:45},orbitRight:{name:'右环绕',unit:'度',value:45},
 panLeft:{name:'左摇',unit:'度',value:30},panRight:{name:'右摇',unit:'度',value:30},
 zoomIn:{name:'变焦拉近',unit:'度',value:15},zoomOut:{name:'变焦拉远',unit:'度',value:15}
};

export function actionRange(o,clip,duration){
 if(!['actor','model'].includes(o.type)||!Number.isFinite(clip.start)||!Number.isFinite(clip.end)||clip.start<0||clip.end>duration||clip.end<=clip.start)throw new Error('动作起止时间必须在工程范围内，结束时间须晚于开始时间');
 if((o.actions||[]).some(a=>a.id!==clip.id&&a.start<clip.end&&clip.start<a.end))throw new Error('动作片段重叠，请调整起止时间');
}

// Return a draft first so validation and replacement happen before a history entry.
export function motionDraft(o,kind,start,end,amount,duration,fps,ease='smooth'){
 if(o.type!=='camera'||!motions[kind])throw new Error('请选择摄影机和运镜方式');
 if(![start,end,amount].every(Number.isFinite)||start<0||end>duration||end-start<1/fps||amount<=0)throw new Error('请输入有效时间区间和大于 0 的幅度');
 const base=frame(o,start),origin=new Vector3(...base.position),aim=new Vector3(...base.target);
 const offset=origin.clone().sub(aim),distance=offset.length();
 if(distance<.05)throw new Error('机位与注视点过近，请先拉开距离');
 if(kind==='push'&&amount>=distance-.1)throw new Error('推进距离过大，会穿过注视点；请减小幅度');
 if((kind.startsWith('orbit')||kind.startsWith('pan'))&&amount>360)throw new Error('环绕 / 摇镜幅度不能超过 360 度');
 if(kind==='zoomIn'&&base.fov-amount<10||kind==='zoomOut'&&base.fov+amount>120)throw new Error('变焦后的 FOV 须在 10–120 度之间');
 const forward=aim.clone().sub(origin).normalize(),right=new Vector3().crossVectors(forward,new Vector3(0,1,0)).normalize();
 if(kind.startsWith('truck')&&right.lengthSq()<.001)throw new Error('垂直机位无法确定左右方向，请先调整注视点');
 const draft=clone(o);draft.keys=draft.keys.filter(k=>k.t<start-.0001||k.t>end+.0001);
 // Guard the preceding frame: a new preset must not animate the earlier hold.
 if(start>0)addKey(draft,frame(o,Math.max(0,start-1/fps),'hold'));
 const count=Math.max(1,Math.min(Math.floor((end-start)*fps+1e-7),Math.ceil((end-start)*8)));
 for(let i=0;i<=count;i++){
  const u=i/count,v=ease==='smooth'?u*u*(3-2*u):u,k=clone(base),pos=origin.clone(),target=aim.clone();
  k.t=start+(end-start)*u;k.ease='linear';
  const n=amount*v,angle=MathUtils.degToRad(n);
  if(kind==='push'||kind==='pull')pos.addScaledVector(forward,n*(kind==='push'?1:-1));
  if(kind.startsWith('truck')){const delta=right.clone().multiplyScalar(n*(kind==='truckRight'?1:-1));pos.add(delta);target.add(delta);}
  if(kind==='rise'||kind==='fall'){const delta=new Vector3(0,n*(kind==='rise'?1:-1),0);pos.add(delta);target.add(delta);}
  if(kind.startsWith('orbit'))pos.copy(offset).applyAxisAngle(new Vector3(0,1,0),angle*(kind==='orbitRight'?1:-1)).add(aim);
  if(kind.startsWith('pan'))target.copy(aim).sub(origin).applyAxisAngle(new Vector3(0,1,0),angle*(kind==='panRight'?-1:1)).add(origin);
  if(kind.startsWith('zoom'))k.fov=base.fov+n*(kind==='zoomIn'?-1:1);
  k.position=pos.toArray();k.target=target.toArray();
  if([...k.position,...k.target].some(x=>Math.abs(x)>1000))throw new Error('运镜超出场景坐标范围');
  if(i===0)k.note=motions[kind].name;if(i===count)k.ease='smooth';
  addKey(draft,k);
 }
 const affected=kind.startsWith('zoom')?['fov']:kind.startsWith('pan')?['targetX','targetY','targetZ']:kind.startsWith('truck')||kind==='rise'||kind==='fall'?['positionX','positionY','positionZ','targetX','targetY','targetZ']:['positionX','positionY','positionZ'];
 for(const id of affected){
  if(!o.channels?.[id]?.length)continue;
  draft.channels[id]=draft.channels[id].filter(k=>k.t<start-.0001||k.t>end+.0001);
  for(const k of draft.keys.filter(k=>k.t>=Math.max(0,start-1/fps)-.0001&&k.t<=end+.0001))addParameterKey(draft,id,k.t,parameterValue(k,id),k.ease);
 }
 // The final pose holds or blends toward the next existing key; no one-frame snap back.
 if(draft.keys.length>1000)throw new Error('关键帧超过 1000 个，请缩短预设时长');
 return draft;
}
