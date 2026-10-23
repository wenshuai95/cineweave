export function lastFrameTime(start,end,fps){if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(fps)||fps<=0||end<=start)throw Error('采样区间或帧率无效');return Math.max(start,(Math.ceil(end*fps-1e-7)-1)/fps);}
export function timecode(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(2).padStart(5,'0')}`;}
export function shotReferencePlan(project){
 const fps=project.fps;if(!Number.isFinite(fps)||fps<=0)throw Error('工程帧率无效');
 if(!project.shots.length)throw Error('请先在镜头编排中添加镜头');
 return [...project.shots].sort((a,b)=>a.start-b.start).map((s,i)=>{
  const camera=project.objects.find(o=>o.id===s.cameraId&&o.type==='camera');
  if(!camera||!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start||s.end>project.duration)throw Error(`镜头 ${i+1} 的机位或时间无效`);
  const firstTime=s.start,lastTime=lastFrameTime(s.start,s.end,fps);
  return {number:i+1,id:s.id,name:s.name||camera.name,cameraId:camera.id,cameraName:camera.name,start:s.start,end:s.end,firstTime,lastTime,fileStem:'shot-'+String(i+1).padStart(3,'0')};
 });
}
export function referenceManifest(project,refs,depth){return {schema:'director-shot-reference/1',projectName:project.name,fps:project.fps,duration:project.duration,depthMaps:!!depth,notes:'参考包不提交视频生成。尾帧位于镜头结束前；深度图沿用本机预演的相对深度。',shots:refs.map(r=>({...r,files:['start','end'].flatMap(k=>[`${r.fileStem}-${k}.png`,...(depth?[`${r.fileStem}-${k}-depth.png`]:[])])}))};}
