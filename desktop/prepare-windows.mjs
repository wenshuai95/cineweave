// Windows staging template only. Complete WINDOWS-HANDOFF.md before shipping.
import {cp,mkdir,readFile,writeFile,rm,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),stage=join(root,'build/windows-app');
await access(join(root,'dist/index.html'));
const version=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;
await rm(stage,{recursive:true,force:true});await mkdir(join(stage,'service'),{recursive:true});
for(const file of ['main.cjs','preload.cjs'])await cp(join(root,'desktop',file),join(stage,file));
for(const file of ['server.mjs','ai-service.mjs','model3d-service.mjs','src','dist','public'])await cp(join(root,file),join(stage,'service',file),{recursive:true});
await cp(join(root,'THIRD-PARTY-LICENSES.txt'),join(stage,'THIRD-PARTY-LICENSES.txt'));
await writeFile(join(stage,'package.json'),JSON.stringify({name:'director-canvas',productName:'超级无敌导演画布',version,main:'main.cjs',private:true,description:'本地创作 · 画布与 3D 预演',author:'超级无敌导演画布'},null,2)+'\n');
console.log('Windows staging ready: '+stage+'\nThis is a build template, not a Windows-validated release.');
