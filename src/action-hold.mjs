// Frame zero is the first frame; never sample the looping clip's end boundary.
export function holdFrameLimit(duration,fps){
 if(!Number.isFinite(duration)||duration<0||!Number.isInteger(fps)||fps<1)throw Error('动作时长或帧率无效');
 return Math.max(0,Math.ceil(duration*fps-1e-7)-1);
}
export function holdFrameTime(frame,duration,fps){
 const last=holdFrameLimit(duration,fps);
 if(!Number.isInteger(frame)||frame<0||frame>last)throw Error(`定格帧须为 0–${last}`);
 return Math.min(frame/fps,Math.max(0,duration-1e-7));
}
