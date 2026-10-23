// Shared interaction rules kept independent of rendering and project mutation.
export function mediaRemovalImpact(ws,id){
 const video=ws.sequence.video.filter(c=>c.assetId===id).length;
 const audio=ws.sequence.audio.filter(c=>c.assetId===id).length;
 return {video,audio,total:video+audio};
}
export function removeMediaWithConsent(ws,id,{confirm=()=>false,checkpoint=()=>{},commit=()=>{},persist=()=>{}}={}){
 const asset=ws.assets.find(a=>a.id===id);if(!asset)return false;
 const impact=mediaRemovalImpact(ws,id);
 if(impact.total&&!confirm(`删除「${asset.name}」？\n时间线中引用它的 ${impact.total} 个片段也会移除（视频 ${impact.video} 段、音频 ${impact.audio} 段）。\n原始文件保留，可通过撤销恢复。`))return false;
 checkpoint();ws.assets=ws.assets.filter(a=>a.id!==id);
 ws.sequence.video=ws.sequence.video.filter(c=>c.assetId!==id);
 ws.sequence.audio=ws.sequence.audio.filter(c=>c.assetId!==id);
 commit();persist();return true;
}
export function parseClipTime(value,unit,fps){
 const text=String(value).trim();if(!text)throw Error('请输入时间');
 if(unit==='timecode'){
  const m=/^(?:(\d+):)?([0-5]?\d):([0-5]?\d)[.:](\d{1,2})$/.exec(text);
  if(!m||Number(m[4])>=fps)throw Error(`请输入 时:分:秒:帧，帧数应小于 ${fps}`);
  const frames=((Number(m[1]||0)*3600+Number(m[2])*60+Number(m[3]))*fps)+Number(m[4]);
  if(!Number.isSafeInteger(frames))throw Error('时间数值过大');return frames;
 }
 const n=Number(text);if(!Number.isFinite(n)||n<0)throw Error('请输入不小于零的有效数值');
 if(unit==='frames'&&!Number.isInteger(n))throw Error('帧数必须是整数');
 const frames=Math.round(n*(unit==='seconds'?fps:1));if(!Number.isSafeInteger(frames))throw Error('时间数值过大');return frames;
}
export function displayClipTime(frames,unit,fps){
 if(unit==='frames')return String(frames);
 if(unit==='seconds')return String(Number((frames/fps).toFixed(6)));
 const seconds=Math.floor(frames/fps);
 return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60,frames%fps].map(n=>String(n).padStart(2,'0')).join(':');
}
export function isNativeActivationTarget(target){
 return !!target?.closest?.('button,a[href],summary,[role="button"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"]');
}
