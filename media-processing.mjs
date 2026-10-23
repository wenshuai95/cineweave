// Local processing uses a fixed operation vocabulary; no caller-supplied paths or filters.
export const MEDIA_OPERATIONS={trim:'截取片段',audio:'提取音频',mute:'移除声音',depth:'提取深度视频'};
export function processingOptions(raw,info){
 if(!raw||!Object.hasOwn(MEDIA_OPERATIONS,raw.operation))throw Error('未知素材处理操作');
 if(!info?.hasVideo||!Number.isFinite(info.durationSec)||info.durationSec<=0||info.durationSec>3600)throw Error('请选择时长不超过 1 小时的完整视频');
 if(info.width<2||info.height<2||info.width>4096||info.height>4096)throw Error('处理支持 2–4096 像素的视频');
 if(raw.operation==='audio'&&!info.hasAudio)throw Error('此视频没有音轨，无法提取音频');
 const start=raw.start===undefined?0:raw.start,end=raw.end===undefined?info.durationSec:raw.end;
 if(typeof start!=='number'||typeof end!=='number'||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>info.durationSec+0.03||end-start<0.1)throw Error('请填写有效的开始和结束时间，片段至少 0.1 秒');
 if(raw.operation==='depth'&&end-start>15)throw Error('深度处理首版支持最长 15 秒，请先截取片段');
 return {operation:raw.operation,start,end:Math.min(end,info.durationSec),durationSec:Math.min(end,info.durationSec)-start};
}
export function processingEncodeArgs(source,out,opts){
 const args=['-hide_banner','-loglevel','error','-nostdin','-progress','pipe:1','-nostats','-y','-ss',String(opts.start),'-i',source,'-t',String(opts.durationSec),'-map_metadata','-1','-map_chapters','-1'];
 if(opts.operation==='audio')return [...args,'-map','0:a:0','-vn','-c:a','pcm_s16le','-ar','48000','-ac','2','-f','wav',out];
 return [...args,'-map','0:v:0',...(opts.operation==='mute'?['-an']:['-map','0:a:0?','-c:a','aac','-b:a','192k']),'-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','20','-movflags','+faststart','-f','mp4',out];
}
