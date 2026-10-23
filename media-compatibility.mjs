// Diagnose uploaded media from container contents, not a filename or MIME claim.
// Browser support still depends on the local playback engine: this is a hint,
// never a promise that every H.264 file will play.
export function describeMediaCompatibility(data,declaredMime=''){
 const streams=Array.isArray(data?.streams)?data.streams:[];
 const video=streams.find(s=>s.codec_type==='video');
 const audio=streams.find(s=>s.codec_type==='audio');
 const format=String(data?.format?.format_name||'');
 const mp4=format.split(',').some(f=>['mov','mp4'].includes(f));
 const webm=format.split(',').some(f=>['matroska','webm'].includes(f));
 const detectedMime=mp4?'video/mp4':webm?'video/webm':null;
 const reasons=[];
 if(['video/mp4','video/webm'].includes(declaredMime)&&detectedMime&&detectedMime!==declaredMime)reasons.push('container-mismatch');
 if(video&&!(mp4&&video.codec_name==='h264'&&['yuv420p','yuvj420p'].includes(video.pix_fmt)||webm&&['vp8','vp9','av1'].includes(video.codec_name)))reasons.push('video-codec');
 if(audio&&!(mp4&&['aac','mp3'].includes(audio.codec_name)||webm&&['opus','vorbis'].includes(audio.codec_name)))reasons.push('audio-codec');
 return {container:format,detectedMime,videoCodec:video?.codec_name||null,audioCodec:audio?.codec_name||null,pixelFormat:video?.pix_fmt||null,reasons,needsCompatibilityCopy:reasons.length>0,
  note:reasons.length?'媒体的封装或编码可能影响预览，可尝试生成兼容副本。':'未发现常见封装或编码问题；实际播放仍以当前设备为准。'};
}

export function compatibilityEncodeArgs(source,out,maxBytes=300*1024*1024){
 return ['-hide_banner','-loglevel','error','-nostdin','-progress','pipe:1','-nostats','-y',
  '-fflags','+genpts','-i',source,'-map','0:v:0','-map','0:a:0?',
  '-map_metadata','-1','-map_chapters','-1',
  '-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
  '-c:v','libx264','-preset','veryfast','-crf','20',
  '-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart','-fs',String(maxBytes),'-f','mp4',out];
}

export function validateCompatibilitySource(info){
 if(!info?.hasVideo)throw Error('素材不含可修复的视频流');
 if(!Number.isFinite(info.durationSec)||info.durationSec<=0||info.durationSec>3600)throw Error('兼容副本仅支持时长明确且不超过 1 小时的视频');
 if(!Number.isInteger(info.width)||!Number.isInteger(info.height)||info.width<2||info.height<2||info.width>4096||info.height>4096)throw Error('兼容副本仅支持 2–4096 像素的视频尺寸');
}
