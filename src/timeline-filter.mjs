// 「仅动画轨道」显示过滤的判定：只影响轨道可见性，不修改工程内容。
// 定格（hold）动作也是表演片段，计入动画；被镜头编排引用的机位同样保留。
export function isAnimatedTrack(object,shots=[]){
 if(!object||typeof object!=='object')return false;
 if(Array.isArray(object.keys)&&object.keys.length)return true;
 const channels=Object.values(object.channels||{});
 if(channels.some(list=>Array.isArray(list)&&list.length))return true;
 if(Array.isArray(object.actions)&&object.actions.length)return true;
 if(Array.isArray(object.pathHandles)&&object.pathHandles.length)return true;
 if(Array.isArray(shots)&&shots.some(s=>s&&s.cameraId===object.id))return true;
 return false;
}
