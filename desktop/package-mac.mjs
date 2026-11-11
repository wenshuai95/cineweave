import {execFileSync} from 'node:child_process';
import {packager} from '@electron/packager';
import {cp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const appVersion=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;
const work=resolve(root,'../../work/release-'+appVersion),stage=join(work,'desktop-source');
await rm(stage,{recursive:true,force:true});await mkdir(join(stage,'service'),{recursive:true});
for(const file of ['main.cjs','preload.cjs'])await cp(join(root,'desktop',file),join(stage,file));
// v1.3.0：workstation-server.mjs 是交付导出（ffmpeg）服务模块，必须随包分发。
// tools/ 是 Blender 桥接脚本（工程导出 / 采样 / 逐镜渲染 / 编码）；少了它导出预演页的 Blender 选项不可用。
for(const file of [...(await readdir(root)).filter(f=>f.endsWith('.mjs')),'dist','src','public','creative-skills','tools','generation'])await cp(join(root,file),join(stage,'service',file),{recursive:true});
// Python 运行缓存不进安装包（首次运行时会自动重建）
const dropPyCache=async dir=>{let entries=[];try{entries=await readdir(dir,{withFileTypes:true})}catch{return}for(const entry of entries){const path=join(dir,entry.name);if(entry.isDirectory()){if(entry.name==='__pycache__')await rm(path,{recursive:true,force:true});else await dropPyCache(path);}}};
await dropPyCache(join(stage,'service','tools'));
await writeFile(join(stage,'package.json'),JSON.stringify({name:'ai-video-workstation',productName:'造梦工坊',version:appVersion,main:'main.cjs',private:true},null,2));
await cp(join(root,'desktop/安装与使用说明.txt'),join(stage,'安装与使用说明.txt'));
const version=JSON.parse(await readFile(join(root,'node_modules/electron/package.json'))).version;
const outputs=await packager({dir:stage,out:join(work,'packaged'),name:'造梦工坊',executableName:'AIVideoWorkstation',appBundleId:'cn.directorcanvas.aiworkstation',appVersion,buildVersion:'3',platform:'darwin',arch:'arm64',electronVersion:version,electronZipDir:process.env.ELECTRON_ZIP_DIR||undefined,icon:join(root,'desktop/DirectorCanvas.icns'),overwrite:true,prune:false,asar:false,extendInfo:{NSHumanReadableCopyright:'本地创作 · 剧本 / 资产 / 画布 / 剪辑 / 交付',LSMinimumSystemVersion:'13.0'}});
for(const output of outputs){
 const bundle=join(output,'造梦工坊.app');
 for(const name of ['LICENSE','LICENSES.chromium.html'])await cp(join(output,name),join(bundle,'Contents/Resources',name));
 await cp(join(root,'node_modules/three/LICENSE'),join(bundle,'Contents/Resources/LICENSE.three.txt'));
 await cp(join(root,'THIRD-PARTY-LICENSES.txt'),join(bundle,'Contents/Resources/THIRD-PARTY-LICENSES.txt'));
 await cp(join(root,'docs/ASSET-LICENSE.md'),join(bundle,'Contents/Resources/ASSET-LICENSE.md'));
 execFileSync('codesign',['--force','--deep','--sign','-',bundle],{stdio:'inherit'});
 execFileSync('codesign',['--verify','--deep','--strict',bundle],{stdio:'inherit'});
}
console.log(outputs.join('\n'));
