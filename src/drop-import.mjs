// Shared logic for Finder drag/drop and button imports: classification, limits,
// screen→board coordinates and multi-node stagger. Keep DOM-free so tests run in node.
export const MEDIA_MAX_BYTES=25*1024*1024;
export const GLB_MAX_BYTES=40*1024*1024;
const MEDIA_MIME_KINDS={'image/png':'image','image/jpeg':'image','image/webp':'image','image/gif':'image','video/mp4':'video','video/webm':'video','audio/mpeg':'audio','audio/mp3':'audio','audio/wav':'audio','audio/x-wav':'audio','audio/ogg':'audio','audio/mp4':'audio','audio/webm':'audio'};
// Extension fallback resolves to a concrete MIME because project validation only
// accepts real media types inside data URLs — never image/* or application/octet-stream.
const EXTENSION_MIMES={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',mpeg:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',glb:'model/gltf-binary'};
const GENERIC_MIME=new Set(['','application/octet-stream','application/binary']);
const limitMb=kind=>kind==='glb'?40:25;
export function classifyImportFile(file){
 const name=String(file?.name??''),mime=String(file?.type??'').toLowerCase(),size=Number(file?.size);
 const ext=(name.match(/\.([A-Za-z0-9]+)$/)?.[1]||'').toLowerCase();
 let resolved=mime;
 if(!MEDIA_MIME_KINDS[mime]&&mime!=='model/gltf-binary'&&GENERIC_MIME.has(mime)&&EXTENSION_MIMES[ext])resolved=EXTENSION_MIMES[ext];
 const kind=resolved==='model/gltf-binary'?'glb':MEDIA_MIME_KINDS[resolved]||null;
 if(!kind)return {ok:false,error:`「${name||'未命名文件'}」是不支持的类型，可导入图片 / 视频 / 音频或 GLB 模型`};
 if(!Number.isFinite(size)||size<0)return {ok:false,error:`「${name}」无法读取文件大小`};
 if(size>(kind==='glb'?GLB_MAX_BYTES:MEDIA_MAX_BYTES))return {ok:false,error:`「${name}」超过 ${limitMb(kind)} MB 上限`};
 return {ok:true,kind,mime:resolved};
}
export function planImportBatch(files){
 const media=[],glbs=[],errors=[];
 for(const file of files){const c=classifyImportFile(file);if(!c.ok)errors.push(c.error);else (c.kind==='glb'?glbs:media).push({file,kind:c.kind,mime:c.mime});}
 return {media,glbs,errors};
}
export function boardPointFromClient(clientX,clientY,boardRect,view){
 const zoom=Number(view?.zoom)||1,x=Number(view?.x)||0,y=Number(view?.y)||0;
 return {x:(clientX-boardRect.left-x)/zoom,y:(clientY-boardRect.top-y)/zoom};
}
export function staggeredNodeOrigins(count,origin,{columns=3,stepX=310,stepY=330}={}){
 const x0=Number.isFinite(origin?.x)?origin.x:80,y0=Number.isFinite(origin?.y)?origin.y:80;
 const points=[];for(let i=0;i<count;i++)points.push({x:x0+(i%columns)*stepX,y:y0+Math.floor(i/columns)*stepY});
 return points;
}
