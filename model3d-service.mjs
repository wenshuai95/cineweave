// Read-only compatibility for GLB files downloaded by earlier versions.
// No cloud credentials, task polling, uploads, signing or network requests.
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export function createLocalModelStore({folder}){
 return {async model(id){
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('模型标识无效');
  const rows=JSON.parse(await readFile(join(folder,'jobs.json'),'utf8'));
  if(!Array.isArray(rows)||!rows.some(j=>j.id===id&&j.status==='succeeded'))throw Error('本地模型不存在或尚未下载');
  return readFile(join(folder,id+'.glb'));
 }};
}
