const encoder=new TextEncoder();
const table=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0});
export function crc32(data){let c=0xffffffff;for(const b of data)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export function zipFiles(files){
 if(files.length>65535)throw Error('参考包文件过多');
 const local=[],central=[];let offset=0,totalCentral=0;
 const header=(size,signature)=>{const b=new Uint8Array(size),v=new DataView(b.buffer);v.setUint32(0,signature,true);return [b,v]};
 for(const f of files){if(!f.name||f.name.includes('..')||f.name.startsWith('/'))throw Error('无效文件名');const name=encoder.encode(f.name),data=typeof f.data==='string'?encoder.encode(f.data):f.data;if(!(data instanceof Uint8Array)||data.length>0xffffffff||name.length>65535)throw Error('无效或过大的文件');const crc=crc32(data),[h,v]=header(30,0x04034b50);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,0x21,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.push(h,name,data);
  const [c,w]=header(46,0x02014b50);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,0x21,true);w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);central.push(c,name);offset+=h.length+name.length+data.length;totalCentral+=c.length+name.length;
 }
 if(offset+totalCentral>0xffffffff)throw Error('参考包超过 ZIP 上限，请减少镜头');const [end,v]=header(22,0x06054b50);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,totalCentral,true);v.setUint32(16,offset,true);const result=new Uint8Array(offset+totalCentral+end.length);let n=0;for(const b of [...local,...central,end]){result.set(b,n);n+=b.length}return result;
}
