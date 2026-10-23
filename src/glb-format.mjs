export function checkGLB(buffer){
 const v=new DataView(buffer);if(buffer.byteLength<20||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==buffer.byteLength)throw new Error('需要有效的 GLB 2.0 文件');
 const len=v.getUint32(12,true);if(v.getUint32(16,true)!==0x4e4f534a||20+len>buffer.byteLength)throw new Error('GLB JSON 区块无效');
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,len)));
 for(const r of [...(json.buffers||[]),...(json.images||[])])if(r.uri&&!/^data:/.test(r.uri))throw new Error('请使用纹理和缓冲区全部内嵌的 GLB，离线库不加载外部地址');
 if(json.extensionsRequired?.some(x=>['KHR_draco_mesh_compression','KHR_texture_basisu','EXT_meshopt_compression'].includes(x)))throw new Error('请导出不依赖 Draco / KTX / Meshopt 解码器的 GLB');
 return json;
}
