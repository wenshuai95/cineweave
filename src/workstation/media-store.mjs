// 工作站媒体库：IndexedDB Blob 对象库（独立数据库 jingchang-workstation，
// 不动 jingchang-studio v1 的 projects 库，旧数据与旧测试零影响）。
// 工程里只保存 assetId 引用与元数据，视频 / 音频不再 base64 进工程 JSON。
const DB_NAME='jingchang-workstation',DB_VERSION=1,STORE='media';

export function openMediaDB(indexedDBImpl){
 const idb=indexedDBImpl||((typeof indexedDB!=='undefined')?indexedDB:null);
 if(!idb)return Promise.reject(Error('此环境不支持 IndexedDB'));
 return new Promise((resolve,reject)=>{
  const r=idb.open(DB_NAME,DB_VERSION);
  r.onupgradeneeded=()=>{r.result.createObjectStore(STORE,{keyPath:'id'});};
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error||Error('媒体库打开失败'));
 });
}

export function createMediaStore(connect=openMediaDB){
 let dbPromise=null;
 const db=()=>(dbPromise??=connect());
 const transact=(mode,run)=>db().then(connection=>new Promise((resolve,reject)=>{
  const tx=connection.transaction(STORE,mode),store=tx.objectStore(STORE);
  let result,error;
  tx.oncomplete=()=>{resolve(result);};
  tx.onabort=()=>reject(error||tx.error||Error('媒体库操作失败'));
  tx.onerror=()=>reject(tx.error||Error('媒体库操作失败'));
  try{run(store,value=>{result=value;});}catch(e){error=e;try{tx.abort();}catch{}}
 }));
 const urls=new Map();
 return {
  put(record){
   if(!record||typeof record.id!=='string'||!/^[\w-]{1,100}$/.test(record.id))return Promise.reject(Error('无效的媒体 ID'));
   if(!(record.blob instanceof Blob))return Promise.reject(Error('媒体内容必须是 Blob'));
   const entry={id:record.id,kind:record.kind,name:String(record.name||'未命名').slice(0,200),mime:String(record.mime||record.blob.type||'application/octet-stream').slice(0,80),size:record.blob.size,createdAt:Number.isFinite(record.createdAt)?record.createdAt:Date.now(),durationSec:Number.isFinite(record.durationSec)&&record.durationSec>0?record.durationSec:null,width:Number.isInteger(record.width)?record.width:null,height:Number.isInteger(record.height)?record.height:null,blob:record.blob};
   return transact('readwrite',(store,done)=>done(store.put(entry))).then(()=>entry);
  },
  get(id){return transact('readonly',(store,done)=>{const r=store.get(id);r.onsuccess=()=>done(r.result||null);});},
  list(){
   return transact('readonly',(store,done)=>{const rows=[];const r=store.openCursor();r.onsuccess=()=>{const c=r.result;if(c){const {blob,...meta}=c.value;rows.push(meta);c.continue();}else done(rows);};});
  },
  delete(id){if(urls.has(id)){URL.revokeObjectURL(urls.get(id));urls.delete(id);}return transact('readwrite',(store,done)=>{const r=store.delete(id);r.onsuccess=()=>done(true);});},
  // 预览地址：同一 assetId 复用同一 objectURL，避免泄漏。
  async url(id){
   if(urls.has(id))return urls.get(id);
   const entry=await this.get(id);
   if(!entry)return null;
   const url=URL.createObjectURL(entry.blob);
   urls.set(id,url);
   return url;
  },
  async blob(id){const entry=await this.get(id);return entry?entry.blob:null;},
  revokeAll(){for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();},
 };
}
