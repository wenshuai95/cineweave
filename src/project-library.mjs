import {openDB,clone,uid,validateProject} from './model.mjs';
import {normalizeCreativeTasks} from './workstation/creative-agent.mjs';

// Keep the v1 store and its legacy `current` record intact. Project bodies and
// lightweight card metadata commit atomically, without loading all media to list.
export function projectLibrary(connect=openDB){
 let pending=0;const idleWaiters=[];
 const transact=async(mode,run)=>{pending++;try{const db=await connect();return await new Promise((resolve,reject)=>{
  const tx=db.transaction('projects',mode),store=tx.objectStore('projects');let result,error;
  const fail=e=>{error=e;try{tx.abort()}catch{}};
  const get=(key,callback)=>{const r=store.get(key);r.onsuccess=()=>{try{callback(r.result)}catch(e){fail(e)}};};
  tx.oncomplete=()=>{db.close();resolve(result)};tx.onabort=()=>{db.close();reject(error||tx.error||Error('本地保存失败'))};
  try{run(store,get,value=>{result=value},fail)}catch(e){fail(e)}
 });}finally{pending--;if(!pending)idleWaiters.splice(0).forEach(resolve=>resolve())}};
 const metadata=(p,previous={},cover)=>({id:p.id,name:p.name,createdAt:previous.createdAt||Date.now(),updatedAt:Date.now(),archived:previous.archived||false,nodes:p.nodes.length,objects:p.objects.length,shots:p.shots.length,duration:p.duration,cover:cover??previous.cover??''});
 const put=(store,p,previous,cover)=>{const meta=metadata(p,previous,cover);store.put(p,'project:'+p.id);store.put(meta,'meta:'+p.id);return meta;};
 return {get pending(){return pending},idle:()=>pending?new Promise(resolve=>idleWaiters.push(resolve)):Promise.resolve(),
  initialize:()=>transact('readwrite',(store,get,done)=>get('library:migrated',flag=>{
   if(flag)return done(false);
   get('current',legacy=>{if(legacy){const p=validateProject(clone(legacy));get('project:'+p.id,existing=>{if(!existing)put(store,p);store.put(true,'library:migrated');done(!!legacy)});}else{store.put(true,'library:migrated');done(false)}});
  })),
  list:()=>transact('readonly',(store,_get,done)=>{const rows=[],r=store.openCursor(IDBKeyRange.bound('meta:','meta:\uffff'));r.onsuccess=()=>{const c=r.result;if(c){rows.push(c.value);c.continue()}else done(rows)};}),
  read:id=>transact('readonly',(_store,get,done)=>get('project:'+id,p=>done(p?validateProject(p):null))),
  save:project=>{const p=validateProject(clone(project));return transact('readwrite',(store,get,done)=>get('meta:'+p.id,previous=>{if(previous?.archived)throw Error('项目已在回收站中，请先恢复');done(put(store,p,previous))}));},
  patchCreativeTasks:(id,records)=>{const incoming=normalizeCreativeTasks(records);return transact('readwrite',(store,get,done)=>get('project:'+id,raw=>{
   if(!raw)return done(null);
   get('meta:'+id,meta=>{if(meta?.archived)return done(null);
    const p=validateProject(raw),merged=new Map(normalizeCreativeTasks(p.workstation.creativeTasks).map(t=>[t.id,t]));
    for(const task of incoming){const old=merged.get(task.id);if(!old||task.updatedAt>=old.updatedAt)merged.set(task.id,task);}
    p.workstation.creativeTasks=normalizeCreativeTasks([...merged.values()]);put(store,p,meta);done(p.workstation.creativeTasks);
   });
  }));},
  add:(project,{forceCopy=false}={})=>{const p=validateProject(clone(project));return transact('readwrite',(store,get,done)=>get('project:'+p.id,existing=>{if(existing||forceCopy)p.id=uid();put(store,p);done(p)}));},
  rename:(id,name)=>transact('readwrite',(store,get,done)=>get('project:'+id,p=>{if(!p)throw Error('项目不存在');p.name=name.trim().slice(0,200);if(!p.name)throw Error('请输入项目名称');get('meta:'+id,meta=>done(put(store,p,meta)))})),
  archive:(id,archived)=>transact('readwrite',(store,get,done)=>get('meta:'+id,meta=>{if(!meta)throw Error('项目不存在');meta.archived=archived;store.put(meta,'meta:'+id);done(meta)})),
  cover:(id,cover)=>transact('readwrite',(store,get,done)=>get('meta:'+id,meta=>{if(meta){meta.cover=cover;store.put(meta,'meta:'+id)}done(meta)}))
 };
}
