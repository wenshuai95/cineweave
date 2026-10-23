export function recordingFormat(container='webm',supported=()=>false){
 const mp4=container==='mp4';
 const candidates=mp4?['video/mp4;codecs=avc1.42001E','video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1.4D0032','video/mp4;codecs=h264']:['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
 if(!['mp4','webm'].includes(container))throw Error('未知视频格式');
 const mime=candidates.find(supported);
 if(!mime)throw Error(mp4?'当前运行环境不支持 H.264 / MP4 录制，请选择 WebM。':'当前运行环境不支持 WebM 录制。');
 return {mime,type:mp4?'video/mp4':'video/webm',extension:container,label:mp4?'H.264 / MP4':'WebM'};
}
